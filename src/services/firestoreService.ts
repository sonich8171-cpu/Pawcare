import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_SERVICES, resolveServiceImage } from '../data/defaults';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AdminAuditLog,
  BookingRecord,
  BookingStatus,
  CaregiverPrivateProfile,
  CaregiverPublicProfile,
  GameId,
  GameSessionRecord,
  NotificationRecord,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  PetProfile,
  PlatformSettings,
  PromotionOffer,
  ReviewRecord,
  ServiceItem,
  SupportConversation,
  SupportConversationMessage,
  SupportTicket,
  TransactionRecord,
  UserProfile,
  UserRewardProfile,
} from '../types/pawcare';

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function makeBookingLockId(
  caregiverId: string,
  bookingDate: string,
  timeSlot: string,
  startTime?: string,
  endTime?: string
): string {
  const safeSlot = timeSlot.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
  if (startTime && endTime) {
    const safeStart = startTime.replace(/[^a-zA-Z0-9]/g, '');
    const safeEnd = endTime.replace(/[^a-zA-Z0-9]/g, '');
    return `lock_${caregiverId}_${bookingDate}_${safeSlot}_${safeStart}_${safeEnd}`.slice(0, 120);
  }
  return `lock_${caregiverId}_${bookingDate}_${safeSlot}`.slice(0, 120);
}

function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function sortByCreatedDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
}

export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  const match24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (match24) {
    return Number(match24[1]) * 60 + Number(match24[2]);
  }
  const match12 = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i.exec(trimmed);
  if (match12) {
    let h = Number(match12[1]) % 12;
    if (match12[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(match12[2]);
  }
  return null;
}

export function deriveTimeRangeFromSlot(timeSlot: string): { startTime: string; endTime: string } {
  const lower = timeSlot.toLowerCase();
  if (lower.includes('morning')) return { startTime: '07:00', endTime: '10:00' };
  if (lower.includes('midday')) return { startTime: '11:00', endTime: '14:00' };
  if (lower.includes('evening')) return { startTime: '16:00', endTime: '19:00' };
  if (lower.includes('full day') || lower.includes('overnight')) {
    return { startTime: '08:00', endTime: '20:00' };
  }
  return { startTime: '09:00', endTime: '10:00' };
}

function normalizeBooking(raw: BookingRecord): BookingRecord {
  const derived = deriveTimeRangeFromSlot(raw.timeSlot || '');
  const resolvedStatus = raw.bookingStatus || raw.status || 'pending';
  return {
    ...raw,
    serviceName: raw.serviceName || raw.serviceTitle,
    serviceTitle: raw.serviceTitle || raw.serviceName || 'Pet Care Session',
    bookingAmount: raw.bookingAmount ?? raw.grossAmount,
    grossAmount: raw.grossAmount ?? raw.bookingAmount ?? 0,
    bookingStatus: resolvedStatus,
    status: raw.status || resolvedStatus,
    startTime: raw.startTime || derived.startTime,
    endTime: raw.endTime || derived.endTime,
  };
}

function reportSnapshotError(
  err: unknown,
  op: OperationType,
  path: string,
  onError?: (err: Error) => void
) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[Firestore ${op} @ ${path}]`, msg);
  if (onError) {
    onError(err instanceof Error ? err : new Error(msg));
  }
}

// --- Users & Customers ---
export async function ensureUserDocument(params: {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  intendedRole?: 'customer' | 'caregiver' | 'admin';
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const customerRef = doc(db, 'customers', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingUser = snap.data() as UserProfile;
      if (params.intendedRole === 'admin' && existingUser.role !== 'admin') {
        await updateDoc(userRef, {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
        return { ...existingUser, role: 'admin' };
      }
      if (existingUser.role === 'customer') {
        const custSnap = await getDoc(customerRef);
        if (!custSnap.exists()) {
          await setDoc(customerRef, {
            uid: existingUser.uid,
            displayName: existingUser.displayName,
            email: existingUser.email,
            role: 'customer',
            accountStatus: existingUser.accountStatus,
            ...(existingUser.photoUrl ? { photoUrl: existingUser.photoUrl } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      return existingUser;
    }
    const assignedRole =
      params.intendedRole === 'admin'
        ? 'admin'
        : params.intendedRole === 'caregiver'
        ? 'caregiver'
        : 'customer';
    const rawName = (params.displayName || '').trim();
    const safeDisplayName = (rawName.length >= 2 ? rawName : 'PawCare Member').slice(0, 100);
    const newUser: UserProfile = {
      uid: params.uid,
      displayName: safeDisplayName,
      email: params.email.slice(0, 160),
      role: assignedRole,
      accountStatus: 'active',
      ...(params.photoUrl ? { photoUrl: params.photoUrl.slice(0, 1000) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(userRef, newUser);
    if (assignedRole === 'customer') {
      batch.set(customerRef, newUser);
    }
    await batch.commit();
    return newUser;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function ensureBootstrapAdminRecord(uid: string, email: string): Promise<boolean> {
  const adminRef = doc(db, 'admins', uid);
  try {
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        uid,
        email: email.trim().slice(0, 160),
        createdAt: serverTimestamp(),
      });
    }
    return true;
  } catch (err) {
    console.error('Could not verify/create admin record:', err);
    return false;
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      'displayName' | 'phone' | 'locality' | 'address' | 'photoUrl' | 'emergencyContactName' | 'emergencyContactPhone'
    >
  >,
  fallbackEmail?: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) {
      const trimmedName = updates.displayName.trim().slice(0, 100);
      if (trimmedName.length < 2) {
        throw new Error('Display name must be at least 2 characters.');
      }
      payload.displayName = trimmedName;
    }
    if (updates.phone !== undefined) payload.phone = updates.phone.trim().slice(0, 20);
    if (updates.locality !== undefined) payload.locality = updates.locality.trim().slice(0, 100);
    if (updates.address !== undefined) payload.address = updates.address.trim().slice(0, 300);
    if (updates.photoUrl !== undefined) payload.photoUrl = updates.photoUrl.trim().slice(0, 1000);
    if (updates.emergencyContactName !== undefined) {
      payload.emergencyContactName = updates.emergencyContactName.trim().slice(0, 100);
    }
    if (updates.emergencyContactPhone !== undefined) {
      payload.emergencyContactPhone = updates.emergencyContactPhone.trim().slice(0, 20);
    }
    const userRef = doc(db, 'users', uid);
    const [userSnap, custSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(doc(db, 'customers', uid)),
    ]);
    const batch = writeBatch(db);
    if (userSnap.exists()) {
      batch.update(userRef, payload);
    } else {
      batch.set(userRef, {
        uid,
        displayName: (updates.displayName?.trim() || 'PawCare Member').slice(0, 100),
        email: (fallbackEmail || '').slice(0, 160),
        role: 'customer',
        accountStatus: 'active',
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    if (custSnap.exists()) {
      batch.update(doc(db, 'customers', uid), payload);
    }
    await batch.commit();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Display name must be')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeAllUsersAdmin(
  callback: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as UserProfile)));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminUpdateUserStatus(
  uid: string,
  accountStatus: 'active' | 'suspended'
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      accountStatus,
      updatedAt: serverTimestamp(),
    });
    const custSnap = await getDoc(doc(db, 'customers', uid));
    if (custSnap.exists()) {
      batch.update(doc(db, 'customers', uid), {
        accountStatus,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface AdminRecord {
  uid: string;
  email: string;
  createdAt?: unknown;
}

export function subscribeAdminsListAdmin(
  callback: (admins: AdminRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'admins';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as AdminRecord)));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminGrantAccess(uid: string, email: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'admins', uid), {
      uid,
      email: email.trim().slice(0, 160),
      createdAt: serverTimestamp(),
    });
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      batch.update(doc(db, 'users', uid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminRevokeAccess(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'admins', uid));
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      batch.update(doc(db, 'users', uid), {
        role: 'customer',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Pets ---
export function subscribeMyPets(
  uid: string,
  callback: (pets: PetProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'pets';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PetProfile)));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllPetsAdmin(
  callback: (pets: PetProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'pets';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PetProfile)));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function savePet(
  ownerId: string,
  petData: Omit<PetProfile, 'petId' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  existingPetId?: string
): Promise<string> {
  const petId = existingPetId || generateId('pet');
  const path = `pets/${petId}`;
  try {
    const trimmedName = petData.name.trim().slice(0, 80);
    if (!trimmedName) {
      throw new Error('Pet name is required.');
    }
    const parsedAge = Number(petData.ageYears);
    const safeAge = Number.isFinite(parsedAge) ? Math.min(40, Math.max(0, parsedAge)) : 1;
    const cleanPayload: Record<string, unknown> = {
      name: trimmedName,
      petType: petData.petType,
      breed: (petData.breed.trim() || 'Mixed / Indie').slice(0, 80),
      ageYears: safeAge,
      gender: petData.gender,
      healthInfo: (petData.healthInfo ?? '').trim().slice(0, 600),
      feedingInstructions: (petData.feedingInstructions ?? '').trim().slice(0, 600),
      behavioralInfo: (petData.behavioralInfo ?? '').trim().slice(0, 600),
      specialCare: (petData.specialCare ?? '').trim().slice(0, 600),
      photoUrl: (petData.photoUrl ?? '').trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    };

    if (existingPetId) {
      await updateDoc(doc(db, 'pets', petId), cleanPayload);
    } else {
      await setDoc(doc(db, 'pets', petId), {
        ...cleanPayload,
        petId,
        ownerId,
        createdAt: serverTimestamp(),
      });
    }
    return petId;
  } catch (err) {
    if (err instanceof Error && err.message === 'Pet name is required.') {
      throw err;
    }
    handleFirestoreError(err, existingPetId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deletePet(petId: string): Promise<void> {
  const path = `pets/${petId}`;
  try {
    await deleteDoc(doc(db, 'pets', petId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Caregivers ---
export function subscribeMyCaregiverProfile(
  uid: string,
  callback: (profile: CaregiverPrivateProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `caregivers/${uid}`;
  return onSnapshot(
    doc(db, 'caregivers', uid),
    (snap) => {
      callback(snap.exists() ? (snap.data() as CaregiverPrivateProfile) : null);
    },
    (err) => reportSnapshotError(err, OperationType.GET, path, onError)
  );
}

export function subscribePublicCaregivers(
  callback: (caregivers: CaregiverPublicProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'caregiversPublic';
  const q = query(collection(db, path), where('verificationStatus', '==', 'verified'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as CaregiverPublicProfile)
        .filter((c) => c.accountStatus === 'active');
      callback(sortByCreatedDesc(list));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllCaregiversAdmin(
  callback: (caregivers: CaregiverPrivateProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'caregivers';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as CaregiverPrivateProfile)));
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function submitOrUpdateCaregiverApplication(
  uid: string,
  input: Omit<
    CaregiverPrivateProfile,
    'caregiverId' | 'userId' | 'verificationStatus' | 'accountStatus' | 'adminNotes' | 'createdAt' | 'updatedAt'
  >,
  existingProfile: CaregiverPrivateProfile | null
): Promise<void> {
  const path = `caregivers/${uid}`;
  try {
    const baseFields: Record<string, unknown> = {
      fullName: input.fullName.trim().slice(0, 100),
      phone: input.phone.trim().slice(0, 20),
      address: input.address.trim().slice(0, 300),
      locality: input.locality.trim().slice(0, 100),
      photoUrl: (input.photoUrl ?? '').trim().slice(0, 1000),
      bio: (input.bio ?? '').trim().slice(0, 800),
      experienceYears: Math.min(60, Math.max(0, Number(input.experienceYears) || 0)),
      skills: input.skills.slice(0, 15),
      servicesOffered: input.servicesOffered.slice(0, 10),
      availability: input.availability.slice(0, 14),
      expectedCharge: Math.min(10000, Math.max(100, Number(input.expectedCharge) || 300)),
      idDocType: input.idDocType,
      idDocNumber: input.idDocNumber.trim().slice(0, 40),
      idDocUrl: (input.idDocUrl ?? '').trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    };

    if (!existingProfile) {
      await setDoc(doc(db, 'caregivers', uid), {
        ...baseFields,
        caregiverId: uid,
        userId: uid,
        email: input.email.trim().slice(0, 160),
        verificationStatus: 'pending',
        accountStatus: 'active',
        createdAt: serverTimestamp(),
      });
    } else {
      const batch = writeBatch(db);
      batch.update(doc(db, 'caregivers', uid), baseFields);

      if (existingProfile.verificationStatus === 'verified') {
        const pubRef = doc(db, 'caregiversPublic', uid);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists() && (pubSnap.data() as CaregiverPublicProfile).verificationStatus === 'verified') {
          const publicFields: Record<string, unknown> = {
            fullName: baseFields.fullName,
            locality: baseFields.locality,
            photoUrl: baseFields.photoUrl,
            bio: baseFields.bio,
            experienceYears: baseFields.experienceYears,
            skills: baseFields.skills,
            servicesOffered: baseFields.servicesOffered,
            availability: baseFields.availability,
            expectedCharge: baseFields.expectedCharge,
            updatedAt: serverTimestamp(),
          };
          batch.update(pubRef, publicFields);
        }
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, existingProfile ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateCaregiverQuickAvailability(
  uid: string,
  availability: string[],
  isVerified: boolean
): Promise<void> {
  const cleanSlots = availability.map((s) => s.trim()).filter(Boolean).slice(0, 14);
  if (cleanSlots.length === 0) {
    throw new Error('At least one active availability slot is required.');
  }
  const path = `caregivers/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'caregivers', uid), {
      availability: cleanSlots,
      updatedAt: serverTimestamp(),
    });
    if (isVerified) {
      const pubRef = doc(db, 'caregiversPublic', uid);
      const pubSnap = await getDoc(pubRef);
      if (pubSnap.exists() && (pubSnap.data() as CaregiverPublicProfile).verificationStatus === 'verified') {
        batch.update(pubRef, {
          availability: cleanSlots,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminUpdateCaregiverVerification(
  caregiver: CaregiverPrivateProfile,
  verificationStatus: 'pending' | 'verified' | 'rejected',
  accountStatus: 'active' | 'suspended',
  adminNotes: string
): Promise<void> {
  const path = `caregivers/${caregiver.caregiverId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'caregivers', caregiver.caregiverId), {
      verificationStatus,
      accountStatus,
      adminNotes: adminNotes.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });

    const publicRef = doc(db, 'caregiversPublic', caregiver.caregiverId);
    const publicSnap = await getDoc(publicRef);

    if (verificationStatus === 'verified') {
      const publicPayload: Record<string, unknown> = {
        caregiverId: caregiver.caregiverId,
        fullName: caregiver.fullName,
        locality: caregiver.locality,
        experienceYears: caregiver.experienceYears,
        skills: caregiver.skills,
        servicesOffered: caregiver.servicesOffered,
        availability: caregiver.availability,
        expectedCharge: caregiver.expectedCharge,
        verificationStatus,
        accountStatus,
        ratingAvg: publicSnap.exists() ? (publicSnap.data() as CaregiverPublicProfile).ratingAvg : 0,
        reviewCount: publicSnap.exists() ? (publicSnap.data() as CaregiverPublicProfile).reviewCount : 0,
        updatedAt: serverTimestamp(),
      };
      if (caregiver.photoUrl) publicPayload.photoUrl = caregiver.photoUrl;
      if (caregiver.bio) publicPayload.bio = caregiver.bio;

      if (publicSnap.exists()) {
        batch.update(publicRef, publicPayload);
      } else {
        batch.set(publicRef, {
          ...publicPayload,
          createdAt: serverTimestamp(),
        });
      }
    } else if (publicSnap.exists()) {
      batch.update(publicRef, {
        verificationStatus,
        accountStatus,
        updatedAt: serverTimestamp(),
      });
    }

    const notifId = generateId('notif');
    batch.set(doc(db, 'notifications', notifId), {
      notificationId: notifId,
      userId: caregiver.userId,
      title:
        verificationStatus === 'verified'
          ? 'Caregiver Profile Verified'
          : verificationStatus === 'rejected'
          ? 'Caregiver Verification Update'
          : 'Caregiver Status Updated',
      message:
        verificationStatus === 'verified'
          ? 'Your PawCare caregiver profile is verified and now live in the Dehradun directory.'
          : adminNotes.trim() || `Verification status changed to ${verificationStatus}.`,
      type: 'verification',
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Services & Platform Settings ---
export function subscribeActiveServices(
  callback: (services: ServiceItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'services';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(DEFAULT_SERVICES);
      } else {
        callback(
          snap.docs.map((d) => {
            const item = d.data() as ServiceItem;
            return { ...item, imageUrl: resolveServiceImage(item) };
          })
        );
      }
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllServicesAdmin(
  callback: (services: ServiceItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'services';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const item = d.data() as ServiceItem;
          return { ...item, imageUrl: resolveServiceImage(item) };
        })
      );
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminSaveService(service: ServiceItem, isNew: boolean): Promise<void> {
  const path = `services/${service.serviceId}`;
  try {
    const rawImage = (service.imageUrl || '').trim();
    const safeRemoteImage =
      rawImage.startsWith('https://') || rawImage.startsWith('http://')
        ? rawImage.slice(0, 500)
        : '';
    const payload: Record<string, unknown> = {
      serviceId: service.serviceId,
      slug: service.slug.trim().slice(0, 80),
      title: service.title.trim().slice(0, 100),
      description: service.description.trim().slice(0, 800),
      durationLabel: service.durationLabel.trim().slice(0, 60),
      basePrice: Number(service.basePrice),
      providerPayout: Number(service.providerPayout),
      platformCommission: Number(service.platformCommission),
      isActive: Boolean(service.isActive),
      imageUrl: safeRemoteImage,
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(doc(db, 'services', service.serviceId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'services', service.serviceId), payload);
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function adminDeleteService(serviceId: string): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribePlatformSettings(
  callback: (settings: PlatformSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'platformSettings/public_config';
  return onSnapshot(
    doc(db, 'platformSettings', 'public_config'),
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_PLATFORM_SETTINGS, ...(snap.data() as PlatformSettings) });
      } else {
        callback(DEFAULT_PLATFORM_SETTINGS);
      }
    },
    (err) => reportSnapshotError(err, OperationType.GET, path, onError)
  );
}

export async function adminSavePlatformSettings(settings: PlatformSettings): Promise<void> {
  const path = 'platformSettings/public_config';
  try {
    const ref = doc(db, 'platformSettings', 'public_config');
    const snap = await getDoc(ref);
    const cleanLocalities = settings.localities
      .map((l) => l.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 40);
    const cleanPhone = settings.whatsappNumber.trim().slice(0, 20);
    if (cleanPhone.length < 8) {
      throw new Error('WhatsApp number must be between 8 and 20 characters.');
    }
    const payload: Record<string, unknown> = {
      settingId: 'public_config',
      platformName: (settings.platformName || 'PawCare').trim().slice(0, 80),
      whatsappNumber: cleanPhone,
      supportEmail: (settings.supportEmail || '').trim().slice(0, 160),
      heroBannerNotice: (settings.heroBannerNotice || '').trim().slice(0, 300),
      bookingPolicy: (settings.bookingPolicy || '').trim().slice(0, 1200),
      cancellationPolicy: (settings.cancellationPolicy || '').trim().slice(0, 1200),
      defaultBookingPrice: Math.max(1, Number(settings.defaultBookingPrice) || 500),
      defaultProviderCost: Math.max(0, Number(settings.defaultProviderCost) || 300),
      monthlyFixedCost: Math.max(0, Number(settings.monthlyFixedCost) || 0),
      commissionModel: settings.commissionModel,
      commissionPercentage: Math.min(100, Math.max(0, Number(settings.commissionPercentage || 0))),
      localities: cleanLocalities,
      faqs: (settings.faqs || []).slice(0, 30),
      testimonials: (settings.testimonials || []).slice(0, 30),
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('WhatsApp number must be')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function seedInitialCatalogIfAdmin(): Promise<void> {
  const path = 'services';
  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (servicesSnap.empty) {
      const batch = writeBatch(db);
      for (const svc of DEFAULT_SERVICES) {
        batch.set(doc(db, 'services', svc.serviceId), {
          serviceId: svc.serviceId,
          slug: svc.slug,
          title: svc.title,
          description: svc.description,
          durationLabel: svc.durationLabel,
          basePrice: svc.basePrice,
          providerPayout: svc.providerPayout,
          platformCommission: svc.platformCommission,
          isActive: svc.isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    const configRef = doc(db, 'platformSettings', 'public_config');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        ...DEFAULT_PLATFORM_SETTINGS,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Bookings (Atomic Slot Locking + Interval Overlap Prevention) ---
async function hasOverlappingActiveLock(
  caregiverId: string,
  bookingDate: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const newStart = parseTimeToMinutes(startTime);
  const newEnd = parseTimeToMinutes(endTime);
  if (newStart === null || newEnd === null) return false;

  // Query single indexed status field to avoid requiring a multi-field composite index
  const q = query(collection(db, 'bookingLocks'), where('status', '==', 'active'));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const lock = d.data() as {
      caregiverId?: string;
      bookingDate?: string;
      startTime?: string;
      endTime?: string;
      timeSlot?: string;
    };
    if (lock.caregiverId !== caregiverId || lock.bookingDate !== bookingDate) {
      continue;
    }
    const derived = deriveTimeRangeFromSlot(lock.timeSlot || '');
    const existStart = parseTimeToMinutes(lock.startTime || derived.startTime);
    const existEnd = parseTimeToMinutes(lock.endTime || derived.endTime);
    if (existStart !== null && existEnd !== null) {
      if (newStart < existEnd && newEnd > existStart) {
        return true;
      }
    }
  }
  return false;
}

export async function checkCaregiverSlotAvailability(
  caregiverId: string,
  bookingDate: string,
  timeSlot: string,
  startTime?: string,
  endTime?: string
): Promise<boolean> {
  const derived = deriveTimeRangeFromSlot(timeSlot);
  const sTime = startTime || derived.startTime;
  const eTime = endTime || derived.endTime;
  const lockId = makeBookingLockId(caregiverId, bookingDate, timeSlot, sTime, eTime);
  const path = `bookingLocks/${lockId}`;
  try {
    const snap = await getDoc(doc(db, 'bookingLocks', lockId));
    if (snap.exists()) {
      const data = snap.data() as { status: string };
      if (data.status === 'active') return false;
    }
    const overlaps = await hasOverlappingActiveLock(caregiverId, bookingDate, sTime, eTime);
    return !overlaps;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createAtomicBooking(params: {
  customer: UserProfile;
  caregiver: CaregiverPublicProfile;
  pet: PetProfile;
  service: ServiceItem;
  bookingDate: string;
  startTime?: string;
  endTime?: string;
  timeSlot: string;
  locality: string;
  serviceAddress: string;
  specialInstructions: string;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  caregiverPayout: number;
  platformCommission: number;
}): Promise<string> {
  const derived = deriveTimeRangeFromSlot(params.timeSlot);
  const resolvedStart = (params.startTime || derived.startTime).trim().slice(0, 16);
  const resolvedEnd = (params.endTime || derived.endTime).trim().slice(0, 16);

  const startMin = parseTimeToMinutes(resolvedStart);
  const endMin = parseTimeToMinutes(resolvedEnd);
  if (startMin !== null && endMin !== null && startMin >= endMin) {
    throw new Error('INVALID_TIME: End time must be after start time.');
  }

  const bookingId = generateId('bk');
  const paymentId = generateId('pay');
  const transactionId = generateId('txn');
  const notifId = generateId('notif');
  const lockId = makeBookingLockId(
    params.caregiver.caregiverId,
    params.bookingDate,
    params.timeSlot,
    resolvedStart,
    resolvedEnd
  );

  const path = `bookings/${bookingId}`;
  try {
    const overlaps = await hasOverlappingActiveLock(
      params.caregiver.caregiverId,
      params.bookingDate,
      resolvedStart,
      resolvedEnd
    );
    if (overlaps) {
      throw new Error(
        'SLOT_UNAVAILABLE: This caregiver already has an overlapping booking for the selected date and time range.'
      );
    }

    await runTransaction(db, async (tx) => {
      const lockRef = doc(db, 'bookingLocks', lockId);
      const lockSnap = await tx.get(lockRef);

      if (lockSnap.exists()) {
        const existingLock = lockSnap.data() as { status: string };
        if (existingLock.status === 'active') {
          throw new Error(
            'SLOT_UNAVAILABLE: This caregiver is already booked for the selected date and time slot.'
          );
        }
      }

      const petSummary = [
        params.pet.healthInfo ? `Health: ${params.pet.healthInfo}` : '',
        params.pet.feedingInstructions ? `Feeding: ${params.pet.feedingInstructions}` : '',
        params.pet.behavioralInfo ? `Behavior: ${params.pet.behavioralInfo}` : '',
        params.pet.specialCare ? `Special Care: ${params.pet.specialCare}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 1000);

      const rawCustName = (params.customer.displayName || '').trim();
      const safeCustomerName = (rawCustName.length >= 2 ? rawCustName : 'Pet Parent').slice(0, 100);
      const safeCaregiverName = (params.caregiver.fullName.trim().length >= 2
        ? params.caregiver.fullName.trim()
        : 'Caregiver'
      ).slice(0, 100);

      const bookingRef = doc(db, 'bookings', bookingId);
      tx.set(bookingRef, {
        bookingId,
        customerId: params.customer.uid,
        customerName: safeCustomerName,
        customerEmail: params.customer.email.slice(0, 160),
        ...(params.customer.phone ? { customerPhone: params.customer.phone.slice(0, 20) } : {}),
        caregiverId: params.caregiver.caregiverId,
        caregiverName: safeCaregiverName,
        petId: params.pet.petId,
        petName: params.pet.name.trim().slice(0, 80),
        petType: params.pet.petType,
        petBreed: (params.pet.breed.trim() || 'Mixed / Indie').slice(0, 80),
        ...(petSummary ? { petInstructions: petSummary } : {}),
        serviceId: params.service.serviceId,
        serviceName: params.service.title.slice(0, 100),
        serviceTitle: params.service.title.slice(0, 100),
        bookingDate: params.bookingDate,
        startTime: resolvedStart,
        endTime: resolvedEnd,
        timeSlot: params.timeSlot.slice(0, 40),
        locality: params.locality.slice(0, 100),
        serviceAddress: params.serviceAddress.trim().slice(0, 300),
        ...(params.specialInstructions.trim()
          ? { specialInstructions: params.specialInstructions.trim().slice(0, 600) }
          : {}),
        bookingAmount: params.grossAmount,
        grossAmount: params.grossAmount,
        caregiverPayout: params.caregiverPayout,
        platformCommission: params.platformCommission,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'pending',
        bookingStatus: 'pending',
        status: 'pending',
        hasReview: false,
        disputeStatus: 'none',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (lockSnap.exists()) {
        tx.update(lockRef, {
          bookingId,
          customerId: params.customer.uid,
          startTime: resolvedStart,
          endTime: resolvedEnd,
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(lockRef, {
          lockId,
          bookingId,
          caregiverId: params.caregiver.caregiverId,
          customerId: params.customer.uid,
          bookingDate: params.bookingDate,
          startTime: resolvedStart,
          endTime: resolvedEnd,
          timeSlot: params.timeSlot.slice(0, 40),
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const gatewayMode =
        params.paymentMethod === 'cash'
          ? 'cash_on_service'
          : params.paymentMethod === 'upi'
          ? 'pending_integration'
          : 'test_mode';

      tx.set(doc(db, 'payments', paymentId), {
        paymentId,
        bookingId,
        customerId: params.customer.uid,
        caregiverId: params.caregiver.caregiverId,
        grossAmount: params.grossAmount,
        platformCommission: params.platformCommission,
        caregiverPayout: params.caregiverPayout,
        method: params.paymentMethod,
        status: 'pending',
        gatewayMode,
        referenceCode: `PAW-${bookingId.slice(-6).toUpperCase()}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(doc(db, 'transactions', transactionId), {
        transactionId,
        bookingId,
        customerId: params.customer.uid,
        caregiverId: params.caregiver.caregiverId,
        grossAmount: params.grossAmount,
        platformCommission: params.platformCommission,
        caregiverPayout: params.caregiverPayout,
        type: 'booking_charge',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        userId: params.caregiver.caregiverId,
        title: 'New Booking Request',
        message: `${safeCustomerName} requested ${params.service.title} for ${params.pet.name} on ${params.bookingDate} (${resolvedStart}–${resolvedEnd}).`.slice(
          0,
          400
        ),
        type: 'booking_request',
        relatedBookingId: bookingId,
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return bookingId;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.startsWith('SLOT_UNAVAILABLE:') || err.message.startsWith('INVALID_TIME:'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateBookingStatus(params: {
  booking: BookingRecord;
  nextStatus: BookingStatus;
  paymentStatus?: PaymentStatus;
  actorRole: 'customer' | 'caregiver' | 'admin';
}): Promise<void> {
  const { booking, nextStatus, paymentStatus, actorRole } = params;
  const path = `bookings/${booking.bookingId}`;
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      bookingStatus: nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (paymentStatus) {
      updatePayload.paymentStatus = paymentStatus;
    }
    batch.update(doc(db, 'bookings', booking.bookingId), updatePayload);

    if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
      const exactLockId = makeBookingLockId(
        booking.caregiverId,
        booking.bookingDate,
        booking.timeSlot,
        booking.startTime,
        booking.endTime
      );
      const legacyLockId = makeBookingLockId(
        booking.caregiverId,
        booking.bookingDate,
        booking.timeSlot
      );
      const exactLockRef = doc(db, 'bookingLocks', exactLockId);
      const exactSnap = await getDoc(exactLockRef);
      if (exactSnap.exists() && (exactSnap.data() as { status: string }).status === 'active') {
        batch.update(exactLockRef, {
          status: 'released',
          updatedAt: serverTimestamp(),
        });
      } else if (legacyLockId !== exactLockId) {
        const legacyLockRef = doc(db, 'bookingLocks', legacyLockId);
        const legacySnap = await getDoc(legacyLockRef);
        if (legacySnap.exists() && (legacySnap.data() as { status: string }).status === 'active') {
          batch.update(legacyLockRef, {
            status: 'released',
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    const recipientId =
      actorRole === 'caregiver' ? booking.customerId : booking.caregiverId;
    const notifId = generateId('notif');
    const titleMap: Record<BookingStatus, string> = {
      pending: 'Booking Pending',
      accepted: 'Caregiver Accepted Booking',
      rejected: 'Booking Request Declined',
      confirmed: 'Booking Confirmed',
      in_progress: 'Pet Care Session Started',
      completed: 'Booking Completed — Leave a Review',
      cancelled: 'Booking Cancelled',
    };
    batch.set(doc(db, 'notifications', notifId), {
      notificationId: notifId,
      userId: recipientId,
      title: titleMap[nextStatus].slice(0, 120),
      message: `${booking.serviceTitle} for ${booking.petName} (${booking.bookingDate}) is now ${nextStatus.replace('_', ' ')}.`.slice(
        0,
        400
      ),
      type:
        nextStatus === 'cancelled' || nextStatus === 'rejected'
          ? 'cancellation'
          : nextStatus === 'completed'
          ? 'review_reminder'
          : 'booking_update',
      relatedBookingId: booking.bookingId,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function customerConfirmTestPayment(
  booking: BookingRecord,
  paymentRecord?: PaymentRecord
): Promise<void> {
  const path = `bookings/${booking.bookingId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'bookings', booking.bookingId), {
      status: 'confirmed',
      bookingStatus: 'confirmed',
      paymentStatus: 'test_verified',
      updatedAt: serverTimestamp(),
    });
    if (paymentRecord) {
      batch.update(doc(db, 'payments', paymentRecord.paymentId), {
        status: 'test_verified',
        referenceCode: `TEST-${Date.now().toString().slice(-6)}`,
        updatedAt: serverTimestamp(),
      });
    }
    const notifId = generateId('notif');
    batch.set(doc(db, 'notifications', notifId), {
      notificationId: notifId,
      userId: booking.caregiverId,
      title: 'Booking Confirmed',
      message: `${booking.customerName} confirmed ${booking.serviceTitle} for ${booking.petName} on ${booking.bookingDate}.`.slice(
        0,
        400
      ),
      type: 'booking_update',
      relatedBookingId: booking.bookingId,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function customerOpenBookingDispute(
  bookingId: string,
  disputeNotes: string
): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      disputeStatus: 'open',
      disputeNotes: disputeNotes.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminResolveBookingDispute(
  bookingId: string,
  disputeStatus: 'resolved' | 'open',
  disputeNotes: string
): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      disputeStatus,
      disputeNotes: disputeNotes.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeCustomerBookings(
  customerId: string,
  callback: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) =>
      callback(sortByCreatedDesc(snap.docs.map((d) => normalizeBooking(d.data() as BookingRecord)))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeCaregiverBookings(
  caregiverId: string,
  callback: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('caregiverId', '==', caregiverId));
  return onSnapshot(
    q,
    (snap) =>
      callback(sortByCreatedDesc(snap.docs.map((d) => normalizeBooking(d.data() as BookingRecord)))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllBookingsAdmin(
  callback: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  return onSnapshot(
    collection(db, path),
    (snap) =>
      callback(sortByCreatedDesc(snap.docs.map((d) => normalizeBooking(d.data() as BookingRecord)))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

// --- Reviews ---
export function subscribeAllReviews(
  callback: (reviews: ReviewRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, path), where('rating', '>=', 1), where('rating', '<=', 5));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as ReviewRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminDeleteReview(reviewId: string): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function submitReview(params: {
  booking: BookingRecord;
  rating: number;
  comment: string;
  wouldRepeat: boolean;
}): Promise<void> {
  const reviewId = params.booking.bookingId;
  const path = `reviews/${reviewId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'reviews', reviewId), {
      reviewId,
      bookingId: params.booking.bookingId,
      customerId: params.booking.customerId,
      customerName: params.booking.customerName.slice(0, 100),
      caregiverId: params.booking.caregiverId,
      rating: Number(params.rating),
      comment: params.comment.trim().slice(0, 600),
      wouldRepeat: Boolean(params.wouldRepeat),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'bookings', params.booking.bookingId), {
      hasReview: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// --- Notifications ---
export function subscribeNotifications(
  userId: string,
  callback: (notifications: NotificationRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as NotificationRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Payments & Transactions ---
export function subscribeCustomerPayments(
  customerId: string,
  callback: (payments: PaymentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'payments';
  const q = query(collection(db, path), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllPaymentsAdmin(
  callback: (payments: PaymentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'payments';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllTransactionsAdmin(
  callback: (txns: TransactionRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'transactions';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as TransactionRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminUpdatePaymentStatus(
  payment: PaymentRecord,
  status: PaymentStatus
): Promise<void> {
  const path = `payments/${payment.paymentId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payments', payment.paymentId), {
      status,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'bookings', payment.bookingId), {
      paymentStatus: status,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Support Tickets ---
export async function submitSupportTicket(params: {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  bookingId?: string;
}): Promise<string> {
  const ticketId = generateId('tkt');
  const path = `supportTickets/${ticketId}`;
  try {
    await setDoc(doc(db, 'supportTickets', ticketId), {
      ticketId,
      userId: params.userId,
      name: params.name.trim().slice(0, 100),
      email: params.email.trim().slice(0, 160),
      ...(params.phone?.trim() ? { phone: params.phone.trim().slice(0, 20) } : {}),
      subject: params.subject.trim().slice(0, 150),
      message: params.message.trim().slice(0, 1000),
      ...(params.bookingId?.trim() ? { bookingId: params.bookingId.trim().slice(0, 128) } : {}),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ticketId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeUserSupportTickets(
  userId: string,
  callback: (tickets: SupportTicket[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'supportTickets';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllTicketsAdmin(
  callback: (tickets: SupportTicket[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'supportTickets';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminResolveTicket(
  ticketId: string,
  status: 'open' | 'in_review' | 'resolved',
  adminResponse: string
): Promise<void> {
  const path = `supportTickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      status,
      adminResponse: adminResponse.trim().slice(0, 600),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Promotions ---
export function subscribeActivePromotions(
  callback: (promos: PromotionOffer[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'promotions';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PromotionOffer))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllPromotionsAdmin(
  callback: (promos: PromotionOffer[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'promotions';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PromotionOffer))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function adminSavePromotion(
  promo: Omit<PromotionOffer, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const path = `promotions/${promo.promoId}`;
  try {
    const payload: Record<string, unknown> = {
      promoId: promo.promoId,
      code: promo.code.trim().toUpperCase().slice(0, 30),
      title: promo.title.trim().slice(0, 120),
      ...(promo.description?.trim() ? { description: promo.description.trim().slice(0, 400) } : {}),
      discountPercent: Number(promo.discountPercent),
      isActive: Boolean(promo.isActive),
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      await setDoc(doc(db, 'promotions', promo.promoId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'promotions', promo.promoId), payload);
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function adminDeletePromotion(promoId: string): Promise<void> {
  const path = `promotions/${promoId}`;
  try {
    await deleteDoc(doc(db, 'promotions', promoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Play Zone Game Sessions & Rewards ---
export const PLAY_ACHIEVEMENTS: { id: string; title: string; description: string }[] = [
  { id: 'first_play', title: 'First Paw Step', description: 'Complete your first Play Zone mini-game.' },
  { id: 'runner_500', title: 'Park Runner', description: 'Score 500+ in Paw Runner.' },
  { id: 'memory_master', title: 'Memory Master', description: 'Complete a Paw Memory Match board.' },
  { id: 'treat_catcher', title: 'Treat Champion', description: 'Score 120+ in Feed the Puppy.' },
  { id: 'rescue_hero', title: 'Rescue Hero', description: 'Complete a rescue mission in Pet Rescue Adventure.' },
  { id: 'play_legend', title: 'Play Zone Legend', description: 'Earn 300+ cumulative PawCare entertainment points.' },
];

export function subscribeMyRewards(
  userId: string,
  callback: (rewards: UserRewardProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `rewards/${userId}`;
  return onSnapshot(
    doc(db, 'rewards', userId),
    (snap) => callback(snap.exists() ? (snap.data() as UserRewardProfile) : null),
    (err) => reportSnapshotError(err, OperationType.GET, path, onError)
  );
}

export function subscribeMyGameSessions(
  userId: string,
  callback: (sessions: GameSessionRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'gameSessions';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as GameSessionRecord))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function recordGameSessionAndRewards(params: {
  userId: string;
  gameId: GameId;
  score: number;
  pointsEarned: number;
  levelReached: number;
  durationSec: number;
  wonRound?: boolean;
}): Promise<number> {
  const safeScore = Math.max(0, Math.min(1000000, Math.round(params.score)));
  const safePoints = Math.max(0, Math.min(150, Math.round(params.pointsEarned)));
  const safeLevel = Math.max(1, Math.min(99, Math.round(params.levelReached)));
  const safeDuration = Math.max(1, Math.min(7200, Math.round(params.durationSec)));
  const sessionId = generateId('gs');
  const path = `rewards/${params.userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const rewardRef = doc(db, 'rewards', params.userId);
      const rewardSnap = await tx.get(rewardRef);
      const sessionRef = doc(db, 'gameSessions', sessionId);

      const existing = rewardSnap.exists() ? (rewardSnap.data() as UserRewardProfile) : null;
      const nextTotal = (existing?.totalPoints || 0) + safePoints;
      const nextGames = (existing?.gamesPlayed || 0) + 1;
      const prevBest = existing?.bestScores || {};
      const nextBest: Partial<Record<GameId, number>> = {
        ...prevBest,
        [params.gameId]: Math.max(prevBest[params.gameId] || 0, safeScore),
      };

      const badgeSet = new Set<string>(existing?.achievements || []);
      badgeSet.add('first_play');
      if (params.gameId === 'paw_runner' && safeScore >= 500) badgeSet.add('runner_500');
      if (params.gameId === 'paw_memory' && (params.wonRound || safeScore > 0)) {
        badgeSet.add('memory_master');
      }
      if (params.gameId === 'feed_puppy' && safeScore >= 120) badgeSet.add('treat_catcher');
      if (params.gameId === 'pet_rescue' && (params.wonRound || safeLevel >= 2 || safeScore >= 150)) {
        badgeSet.add('rescue_hero');
      }
      if (nextTotal >= 300) badgeSet.add('play_legend');

      tx.set(sessionRef, {
        sessionId,
        userId: params.userId,
        gameId: params.gameId,
        score: safeScore,
        pointsEarned: safePoints,
        levelReached: safeLevel,
        durationSec: safeDuration,
        createdAt: serverTimestamp(),
      });

      if (existing) {
        tx.update(rewardRef, {
          totalPoints: nextTotal,
          gamesPlayed: nextGames,
          bestScores: nextBest,
          achievements: Array.from(badgeSet).slice(0, 16),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(rewardRef, {
          userId: params.userId,
          totalPoints: nextTotal,
          gamesPlayed: 1,
          bestScores: nextBest,
          achievements: Array.from(badgeSet).slice(0, 16),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    return safePoints;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Live Customer/Caregiver <-> Admin Support Conversations ---
export function subscribeMyConversations(
  userId: string,
  callback: (convos: SupportConversation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'conversations';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as SupportConversation);
      list.sort((a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt));
      callback(list);
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeAllConversationsAdmin(
  callback: (convos: SupportConversation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'conversations';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as SupportConversation);
      list.sort((a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt));
      callback(list);
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export function subscribeConversationMessages(
  conversationId: string,
  callback: (messages: SupportConversationMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `conversations/${conversationId}/messages`;
  return onSnapshot(
    collection(db, 'conversations', conversationId, 'messages'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as SupportConversationMessage);
      list.sort((a, b) => getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt));
      callback(list);
    },
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

export async function sendUserConversationMessage(params: {
  conversationId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'customer' | 'caregiver';
  subject?: string;
  text: string;
}): Promise<string> {
  const cleanText = params.text.trim().slice(0, 1000);
  if (!cleanText) throw new Error('Message cannot be empty.');
  const convId = params.conversationId || generateId('conv');
  const msgId = generateId('msg');
  const safeName = (params.userName.trim().length >= 2 ? params.userName.trim() : 'PawCare Member').slice(
    0,
    100
  );
  const path = `conversations/${convId}`;

  try {
    if (!params.conversationId) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'conversations', convId), {
        conversationId: convId,
        userId: params.userId,
        userName: safeName,
        userEmail: params.userEmail.trim().slice(0, 160),
        userRole: params.userRole,
        subject: (params.subject?.trim() || 'PawCare Live Support').slice(0, 150),
        status: 'open',
        lastMessage: cleanText.slice(0, 800),
        lastSenderRole: 'user',
        unreadByAdmin: true,
        unreadByUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'conversations', convId, 'messages', msgId), {
        messageId: msgId,
        conversationId: convId,
        senderId: params.userId,
        senderName: safeName,
        senderRole: 'user',
        text: cleanText,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      const batch = writeBatch(db);
      batch.update(doc(db, 'conversations', convId), {
        lastMessage: cleanText.slice(0, 800),
        lastSenderRole: 'user',
        status: 'open',
        unreadByAdmin: true,
        unreadByUser: false,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'conversations', convId, 'messages', msgId), {
        messageId: msgId,
        conversationId: convId,
        senderId: params.userId,
        senderName: safeName,
        senderRole: 'user',
        text: cleanText,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    }
    return convId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function markConversationReadByUser(conversationId: string): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      unreadByUser: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function replyConversationAsAdmin(params: {
  conversationId: string;
  adminUid: string;
  adminName: string;
  text: string;
  nextStatus?: 'open' | 'in_review' | 'resolved';
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, 1000);
  if (!cleanText) throw new Error('Reply text cannot be empty.');
  const msgId = generateId('msg');
  const path = `conversations/${params.conversationId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'conversations', params.conversationId), {
      lastMessage: cleanText.slice(0, 800),
      lastSenderRole: 'admin',
      status: params.nextStatus || 'in_review',
      unreadByAdmin: false,
      unreadByUser: true,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'conversations', params.conversationId, 'messages', msgId), {
      messageId: msgId,
      conversationId: params.conversationId,
      senderId: params.adminUid,
      senderName: (params.adminName.trim() || 'PawCare Admin').slice(0, 100),
      senderRole: 'admin',
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateConversationStatusAdmin(
  conversationId: string,
  status: 'open' | 'in_review' | 'resolved'
): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      status,
      unreadByAdmin: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Admin Audit Logs ---
export async function logAdminAction(params: {
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) return;
  const logId = generateId('aud');
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      logId,
      actorUid: currentUser.uid,
      actorEmail: currentUser.email.slice(0, 160),
      action: params.action.trim().slice(0, 80),
      targetType: params.targetType.trim().slice(0, 60),
      targetId: params.targetId.trim().slice(0, 128),
      details: params.details.trim().slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[AuditLog write skipped]', err);
  }
}

export function subscribeAuditLogsAdmin(
  callback: (logs: AdminAuditLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'auditLogs';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as AdminAuditLog))),
    (err) => reportSnapshotError(err, OperationType.LIST, path, onError)
  );
}

