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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  BookingRecord,
  BookingStatus,
  CaregiverPrivateProfile,
  CaregiverPublicProfile,
  NotificationRecord,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  PetProfile,
  PlatformSettings,
  PromotionOffer,
  ReviewRecord,
  ServiceItem,
  SupportTicket,
  TransactionRecord,
  UserProfile,
} from '../types/pawcare';

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function makeBookingLockId(
  caregiverId: string,
  bookingDate: string,
  timeSlot: string
): string {
  const safeSlot = timeSlot.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
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

// --- Users & Customers ---
export async function ensureUserDocument(params: {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const customerRef = doc(db, 'customers', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingUser = snap.data() as UserProfile;
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
      return existingUser;
    }
    const rawName = (params.displayName || '').trim();
    const safeDisplayName = (rawName.length >= 2 ? rawName : 'PawCare Member').slice(0, 100);
    const newUser: UserProfile = {
      uid: params.uid,
      displayName: safeDisplayName,
      email: params.email.slice(0, 160),
      role: 'customer',
      accountStatus: 'active',
      ...(params.photoUrl ? { photoUrl: params.photoUrl.slice(0, 1000) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(userRef, newUser);
    batch.set(customerRef, newUser);
    await batch.commit();
    return newUser;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      'displayName' | 'phone' | 'locality' | 'address' | 'photoUrl' | 'emergencyContactName' | 'emergencyContactPhone'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) payload.displayName = updates.displayName.trim().slice(0, 100);
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
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), payload);
    const custSnap = await getDoc(doc(db, 'customers', uid));
    if (custSnap.exists()) {
      batch.update(doc(db, 'customers', uid), payload);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeAllUsersAdmin(callback: (users: UserProfile[]) => void): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as UserProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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

// --- Pets ---
export function subscribeMyPets(uid: string, callback: (pets: PetProfile[]) => void): Unsubscribe {
  const path = 'pets';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PetProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllPetsAdmin(callback: (pets: PetProfile[]) => void): Unsubscribe {
  const path = 'pets';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PetProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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
    const cleanPayload: Record<string, unknown> = {
      name: petData.name.trim().slice(0, 80),
      petType: petData.petType,
      breed: petData.breed.trim().slice(0, 80),
      ageYears: Number(petData.ageYears),
      gender: petData.gender,
      updatedAt: serverTimestamp(),
    };
    if (petData.healthInfo?.trim()) cleanPayload.healthInfo = petData.healthInfo.trim().slice(0, 600);
    if (petData.feedingInstructions?.trim()) {
      cleanPayload.feedingInstructions = petData.feedingInstructions.trim().slice(0, 600);
    }
    if (petData.behavioralInfo?.trim()) {
      cleanPayload.behavioralInfo = petData.behavioralInfo.trim().slice(0, 600);
    }
    if (petData.specialCare?.trim()) cleanPayload.specialCare = petData.specialCare.trim().slice(0, 600);
    if (petData.photoUrl?.trim()) cleanPayload.photoUrl = petData.photoUrl.trim().slice(0, 1000);

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
  callback: (profile: CaregiverPrivateProfile | null) => void
): Unsubscribe {
  const path = `caregivers/${uid}`;
  return onSnapshot(
    doc(db, 'caregivers', uid),
    (snap) => {
      callback(snap.exists() ? (snap.data() as CaregiverPrivateProfile) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function subscribePublicCaregivers(
  callback: (caregivers: CaregiverPublicProfile[]) => void
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
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllCaregiversAdmin(
  callback: (caregivers: CaregiverPrivateProfile[]) => void
): Unsubscribe {
  const path = 'caregivers';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as CaregiverPrivateProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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
      experienceYears: Number(input.experienceYears),
      skills: input.skills.slice(0, 15),
      servicesOffered: input.servicesOffered.slice(0, 10),
      availability: input.availability.slice(0, 14),
      expectedCharge: Number(input.expectedCharge),
      idDocType: input.idDocType,
      idDocNumber: input.idDocNumber.trim().slice(0, 40),
      updatedAt: serverTimestamp(),
    };
    if (input.photoUrl?.trim()) baseFields.photoUrl = input.photoUrl.trim().slice(0, 1000);
    if (input.bio?.trim()) baseFields.bio = input.bio.trim().slice(0, 800);
    if (input.idDocUrl?.trim()) baseFields.idDocUrl = input.idDocUrl.trim().slice(0, 1000);

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
        const publicFields: Record<string, unknown> = {
          fullName: baseFields.fullName,
          locality: baseFields.locality,
          experienceYears: baseFields.experienceYears,
          skills: baseFields.skills,
          servicesOffered: baseFields.servicesOffered,
          availability: baseFields.availability,
          expectedCharge: baseFields.expectedCharge,
          updatedAt: serverTimestamp(),
        };
        if (baseFields.photoUrl) publicFields.photoUrl = baseFields.photoUrl;
        if (baseFields.bio) publicFields.bio = baseFields.bio;
        batch.update(doc(db, 'caregiversPublic', uid), publicFields);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, existingProfile ? OperationType.UPDATE : OperationType.CREATE, path);
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
export function subscribeActiveServices(callback: (services: ServiceItem[]) => void): Unsubscribe {
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
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllServicesAdmin(callback: (services: ServiceItem[]) => void): Unsubscribe {
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
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function adminSaveService(service: ServiceItem, isNew: boolean): Promise<void> {
  const path = `services/${service.serviceId}`;
  try {
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
      updatedAt: serverTimestamp(),
    };
    if (service.imageUrl?.trim()) payload.imageUrl = service.imageUrl.trim().slice(0, 500);

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
  callback: (settings: PlatformSettings) => void
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
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export async function adminSavePlatformSettings(settings: PlatformSettings): Promise<void> {
  const path = 'platformSettings/public_config';
  try {
    const ref = doc(db, 'platformSettings', 'public_config');
    const snap = await getDoc(ref);
    const payload: Record<string, unknown> = {
      settingId: 'public_config',
      platformName: (settings.platformName || 'PawCare').trim().slice(0, 80),
      whatsappNumber: settings.whatsappNumber.trim().slice(0, 20),
      supportEmail: (settings.supportEmail || '').trim().slice(0, 160),
      heroBannerNotice: (settings.heroBannerNotice || '').trim().slice(0, 300),
      bookingPolicy: (settings.bookingPolicy || '').trim().slice(0, 1200),
      cancellationPolicy: (settings.cancellationPolicy || '').trim().slice(0, 1200),
      defaultBookingPrice: Number(settings.defaultBookingPrice),
      defaultProviderCost: Number(settings.defaultProviderCost),
      monthlyFixedCost: Number(settings.monthlyFixedCost),
      commissionModel: settings.commissionModel,
      commissionPercentage: Number(settings.commissionPercentage || 0),
      localities: settings.localities.slice(0, 40),
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

// --- Bookings (Atomic Slot Locking) ---
export async function checkCaregiverSlotAvailability(
  caregiverId: string,
  bookingDate: string,
  timeSlot: string
): Promise<boolean> {
  const lockId = makeBookingLockId(caregiverId, bookingDate, timeSlot);
  const path = `bookingLocks/${lockId}`;
  try {
    const snap = await getDoc(doc(db, 'bookingLocks', lockId));
    if (!snap.exists()) return true;
    const data = snap.data() as { status: string };
    return data.status === 'released';
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
  timeSlot: string;
  locality: string;
  serviceAddress: string;
  specialInstructions: string;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  caregiverPayout: number;
  platformCommission: number;
}): Promise<string> {
  const bookingId = generateId('bk');
  const paymentId = generateId('pay');
  const transactionId = generateId('txn');
  const notifId = generateId('notif');
  const lockId = makeBookingLockId(params.caregiver.caregiverId, params.bookingDate, params.timeSlot);

  const path = `bookings/${bookingId}`;
  try {
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

      const bookingRef = doc(db, 'bookings', bookingId);
      tx.set(bookingRef, {
        bookingId,
        customerId: params.customer.uid,
        customerName: params.customer.displayName.slice(0, 100),
        ...(params.customer.phone ? { customerPhone: params.customer.phone.slice(0, 20) } : {}),
        caregiverId: params.caregiver.caregiverId,
        caregiverName: params.caregiver.fullName.slice(0, 100),
        petId: params.pet.petId,
        petName: params.pet.name.slice(0, 80),
        petType: params.pet.petType,
        petBreed: params.pet.breed.slice(0, 80),
        ...(petSummary ? { petInstructions: petSummary } : {}),
        serviceId: params.service.serviceId,
        serviceTitle: params.service.title.slice(0, 100),
        bookingDate: params.bookingDate,
        timeSlot: params.timeSlot.slice(0, 40),
        locality: params.locality.slice(0, 100),
        serviceAddress: params.serviceAddress.trim().slice(0, 300),
        ...(params.specialInstructions.trim()
          ? { specialInstructions: params.specialInstructions.trim().slice(0, 600) }
          : {}),
        grossAmount: params.grossAmount,
        caregiverPayout: params.caregiverPayout,
        platformCommission: params.platformCommission,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'pending',
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
        message: `${params.customer.displayName} requested ${params.service.title} for ${params.pet.name} on ${params.bookingDate} (${params.timeSlot}).`,
        type: 'booking_request',
        relatedBookingId: bookingId,
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return bookingId;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('SLOT_UNAVAILABLE:')) {
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
      updatedAt: serverTimestamp(),
    };
    if (paymentStatus) {
      updatePayload.paymentStatus = paymentStatus;
    }
    batch.update(doc(db, 'bookings', booking.bookingId), updatePayload);

    if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
      const lockId = makeBookingLockId(booking.caregiverId, booking.bookingDate, booking.timeSlot);
      const lockRef = doc(db, 'bookingLocks', lockId);
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        batch.update(lockRef, {
          status: 'released',
          updatedAt: serverTimestamp(),
        });
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
      title: titleMap[nextStatus],
      message: `${booking.serviceTitle} for ${booking.petName} (${booking.bookingDate}) is now ${nextStatus.replace('_', ' ')}.`,
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
      message: `${booking.customerName} confirmed ${booking.serviceTitle} for ${booking.petName} on ${booking.bookingDate}.`,
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
  callback: (bookings: BookingRecord[]) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as BookingRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCaregiverBookings(
  caregiverId: string,
  callback: (bookings: BookingRecord[]) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('caregiverId', '==', caregiverId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as BookingRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllBookingsAdmin(
  callback: (bookings: BookingRecord[]) => void
): Unsubscribe {
  const path = 'bookings';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as BookingRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

// --- Reviews ---
export function subscribeAllReviews(callback: (reviews: ReviewRecord[]) => void): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, path), where('rating', '>=', 1), where('rating', '<=', 5));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as ReviewRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
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
  callback: (notifications: NotificationRecord[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as NotificationRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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
  callback: (payments: PaymentRecord[]) => void
): Unsubscribe {
  const path = 'payments';
  const q = query(collection(db, path), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllPaymentsAdmin(
  callback: (payments: PaymentRecord[]) => void
): Unsubscribe {
  const path = 'payments';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllTransactionsAdmin(
  callback: (txns: TransactionRecord[]) => void
): Unsubscribe {
  const path = 'transactions';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as TransactionRecord))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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

export function subscribeAllTicketsAdmin(
  callback: (tickets: SupportTicket[]) => void
): Unsubscribe {
  const path = 'supportTickets';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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
  callback: (promos: PromotionOffer[]) => void
): Unsubscribe {
  const path = 'promotions';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PromotionOffer))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllPromotionsAdmin(
  callback: (promos: PromotionOffer[]) => void
): Unsubscribe {
  const path = 'promotions';
  return onSnapshot(
    collection(db, path),
    (snap) => callback(sortByCreatedDesc(snap.docs.map((d) => d.data() as PromotionOffer))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
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
