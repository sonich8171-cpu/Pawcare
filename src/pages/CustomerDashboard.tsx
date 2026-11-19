import {
  AlertCircle,
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Edit3,
  FileText,
  Gamepad2,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  PawPrint,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BookingReceiptModal } from '../components/BookingReceiptModal';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { PlayZoneSection } from '../components/PlayZoneSection';
import { SupportHelpPanel } from '../components/SupportHelpPanel';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import {
  AVAILABILITY_SLOTS,
  BRAND_ASSETS,
  PET_PHOTO_PRESETS,
  resolvePetImage,
  resolveServiceImage,
} from '../data/defaults';
import { formatAppError } from '../lib/authErrors';
import {
  checkCaregiverSlotAvailability,
  createAtomicBooking,
  customerConfirmTestPayment,
  customerOpenBookingDispute,
  deletePet,
  deriveTimeRangeFromSlot,
  markNotificationRead,
  parseTimeToMinutes,
  savePet,
  subscribeCustomerBookings,
  subscribeCustomerPayments,
  subscribeMyPets,
  subscribeNotifications,
  submitReview,
  updateBookingStatus,
  updateUserProfile,
} from '../services/firestoreService';
import type {
  BookingRecord,
  BookingStatus,
  NotificationRecord,
  PaymentMethod,
  PaymentRecord,
  PetGender,
  PetProfile,
  PetType,
  UserProfile,
} from '../types/pawcare';

type CustomerTab =
  | 'overview'
  | 'pets'
  | 'services'
  | 'caregivers'
  | 'book'
  | 'bookings'
  | 'history'
  | 'play'
  | 'rewards'
  | 'reviews'
  | 'notifications'
  | 'help'
  | 'profile'
  | 'settings';

const BOOKING_PROGRESS_STEPS: { key: BookingStatus; label: string }[] = [
  { key: 'pending', label: 'Requested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Care' },
];

function getStepIndex(status: BookingStatus): number {
  const idx = BOOKING_PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export function CustomerDashboard() {
  const { firebaseUser, userProfile, resetPassword, logout } = useAuth();
  const { services, publicCaregivers, platformSettings, promotions, reviews } = usePublicData();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialTab: CustomerTab = location.pathname.endsWith('/book') ? 'book' : 'overview';
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pet Modal state
  const [petModalOpen, setPetModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<PetProfile | null>(null);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<PetType>('Dog');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('2');
  const [petGender, setPetGender] = useState<PetGender>('Male');
  const [petHealth, setPetHealth] = useState('');
  const [petFeeding, setPetFeeding] = useState('');
  const [petBehavior, setPetBehavior] = useState('');
  const [petSpecial, setPetSpecial] = useState('');
  const [petPhotoUrl, setPetPhotoUrl] = useState('');
  const [savingPet, setSavingPet] = useState(false);

  // Booking form state
  const initialRange = deriveTimeRangeFromSlot(AVAILABILITY_SLOTS[0]);
  const [bkPetId, setBkPetId] = useState('');
  const [bkServiceId, setBkServiceId] = useState(searchParams.get('service') || '');
  const [bkCaregiverId, setBkCaregiverId] = useState(searchParams.get('caregiver') || '');
  const [bkDate, setBkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bkTimeSlot, setBkTimeSlot] = useState(AVAILABILITY_SLOTS[0]);
  const [bkStartTime, setBkStartTime] = useState(initialRange.startTime);
  const [bkEndTime, setBkEndTime] = useState(initialRange.endTime);
  const [bkLocality, setBkLocality] = useState(
    userProfile?.locality || platformSettings.localities[0] || 'Rajpur Road'
  );
  const [bkAddress, setBkAddress] = useState(userProfile?.address || '');
  const [bkInstructions, setBkInstructions] = useState('');
  const [bkPaymentMethod, setBkPaymentMethod] = useState<PaymentMethod>('cash');
  const [bkPromoCode, setBkPromoCode] = useState('');
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [confirmedBookingSummary, setConfirmedBookingSummary] = useState<{
    bookingId: string;
    petName: string;
    serviceName: string;
    caregiverName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    amount: number;
  } | null>(null);

  // Caregiver search inside dashboard
  const [cgSearch, setCgSearch] = useState('');
  const [cgLocality, setCgLocality] = useState('all');
  const [cgServiceFilter, setCgServiceFilter] = useState('all');
  const [cgAvailFilter, setCgAvailFilter] = useState('all');

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState<BookingRecord | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRepeat, setReviewRepeat] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Dispute modal state
  const [disputeBooking, setDisputeBooking] = useState<BookingRecord | null>(null);
  const [disputeNotes, setDisputeNotes] = useState('');

  // Receipt modal & super-app search/filter states
  const [receiptBooking, setReceiptBooking] = useState<BookingRecord | null>(null);
  const [omniSearch, setOmniSearch] = useState('');
  const [bookingsSearch, setBookingsSearch] = useState('');
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState<'all' | BookingStatus>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | 'completed' | 'cancelled' | 'rejected'
  >('all');

  // Profile form state
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profLocality, setProfLocality] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profEmergName, setProfEmergName] = useState('');
  const [profEmergPhone, setProfEmergPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (location.pathname.endsWith('/book')) {
      setActiveTab('book');
    }
  }, [location.pathname]);

  useEffect(() => {
    const svc = searchParams.get('service');
    const cg = searchParams.get('caregiver');
    if (svc) setBkServiceId(svc);
    if (cg) setBkCaregiverId(cg);
  }, [searchParams]);

  useEffect(() => {
    if (userProfile) {
      setProfName(userProfile.displayName || '');
      setProfPhone(userProfile.phone || '');
      setProfLocality(userProfile.locality || platformSettings.localities[0] || '');
      setProfAddress(userProfile.address || '');
      setProfEmergName(userProfile.emergencyContactName || '');
      setProfEmergPhone(userProfile.emergencyContactPhone || '');
      if (!bkAddress && userProfile.address) setBkAddress(userProfile.address);
      if (userProfile.locality) setBkLocality(userProfile.locality);
    }
  }, [userProfile, platformSettings.localities]);

  useEffect(() => {
    if (!firebaseUser) return;
    setListenerError(null);
    const onSubErr = (err: Error) => {
      setListenerError(`Live data sync issue: ${err.message}`);
    };
    const unsubs = [
      subscribeMyPets(
        firebaseUser.uid,
        (list) => {
          setPets(list);
          if (list.length > 0) {
            setBkPetId((prev) => (prev && list.some((p) => p.petId === prev) ? prev : list[0].petId));
          } else {
            setBkPetId('');
          }
        },
        onSubErr
      ),
      subscribeCustomerBookings(firebaseUser.uid, setBookings, onSubErr),
      subscribeCustomerPayments(firebaseUser.uid, setPayments, onSubErr),
      subscribeNotifications(firebaseUser.uid, setNotifications, onSubErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [firebaseUser]);

  useEffect(() => {
    if (!bkServiceId && services.length > 0) setBkServiceId(services[0].serviceId);
  }, [bkServiceId, services]);

  useEffect(() => {
    if (!bkCaregiverId && publicCaregivers.length > 0) {
      setBkCaregiverId(publicCaregivers[0].caregiverId);
    }
  }, [bkCaregiverId, publicCaregivers]);

  useEffect(() => {
    const derived = deriveTimeRangeFromSlot(bkTimeSlot);
    setBkStartTime(derived.startTime);
    setBkEndTime(derived.endTime);
  }, [bkTimeSlot]);

  useEffect(() => {
    let active = true;
    if (!bkCaregiverId || !bkDate || !bkTimeSlot) {
      setSlotAvailable(null);
      return;
    }
    const startMin = parseTimeToMinutes(bkStartTime);
    const endMin = parseTimeToMinutes(bkEndTime);
    if (startMin !== null && endMin !== null && startMin >= endMin) {
      setSlotAvailable(null);
      return;
    }
    setCheckingSlot(true);
    checkCaregiverSlotAvailability(bkCaregiverId, bkDate, bkTimeSlot, bkStartTime, bkEndTime)
      .then((ok) => {
        if (active) setSlotAvailable(ok);
      })
      .catch(() => {
        if (active) setSlotAvailable(null);
      })
      .finally(() => {
        if (active) setCheckingSlot(false);
      });
    return () => {
      active = false;
    };
  }, [bkCaregiverId, bkDate, bkTimeSlot, bkStartTime, bkEndTime]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeBookings = bookings.filter((b) =>
    ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
  );
  const pastBookings = bookings.filter((b) =>
    ['completed', 'cancelled', 'rejected'].includes(b.status)
  );
  const completedUnreviewed = bookings.filter((b) => b.status === 'completed' && !b.hasReview);
  const mySubmittedReviews = useMemo(
    () => reviews.filter((r) => r.customerId === firebaseUser?.uid),
    [reviews, firebaseUser]
  );

  const selectedPet = pets.find((p) => p.petId === bkPetId) || pets[0];
  const selectedService = services.find((s) => s.serviceId === bkServiceId) || services[0];
  const selectedCaregiver = publicCaregivers.find((c) => c.caregiverId === bkCaregiverId);

  useEffect(() => {
    if (
      selectedCaregiver &&
      selectedCaregiver.availability.length > 0 &&
      !selectedCaregiver.availability.includes(bkTimeSlot)
    ) {
      setBkTimeSlot(selectedCaregiver.availability[0]);
    }
  }, [selectedCaregiver, bkTimeSlot]);

  const totalSpentINR = useMemo(
    () =>
      bookings
        .filter((b) => !['cancelled', 'rejected'].includes(b.status))
        .reduce((sum, b) => sum + b.grossAmount, 0),
    [bookings]
  );

  const quickReorderOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: BookingRecord[] = [];
    for (const b of bookings) {
      const key = `${b.petId}_${b.serviceId}_${b.caregiverId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(b);
      if (list.length >= 3) break;
    }
    return list;
  }, [bookings]);

  const omniMatches = useMemo(() => {
    const q = omniSearch.trim().toLowerCase();
    if (!q) return { services: [], caregivers: [] };
    return {
      services: services
        .filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.durationLabel.toLowerCase().includes(q)
        )
        .slice(0, 4),
      caregivers: publicCaregivers
        .filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.locality.toLowerCase().includes(q) ||
            c.servicesOffered.some((so) => so.toLowerCase().includes(q)) ||
            c.skills.some((sk) => sk.toLowerCase().includes(q))
        )
        .slice(0, 4),
    };
  }, [omniSearch, services, publicCaregivers]);

  const filteredActiveBookings = useMemo(() => {
    const q = bookingsSearch.trim().toLowerCase();
    return activeBookings.filter((b) => {
      const matchesStatus = bookingsStatusFilter === 'all' || b.status === bookingsStatusFilter;
      const matchesQ =
        !q ||
        b.serviceTitle.toLowerCase().includes(q) ||
        b.petName.toLowerCase().includes(q) ||
        b.caregiverName.toLowerCase().includes(q) ||
        b.bookingId.toLowerCase().includes(q);
      return matchesStatus && matchesQ;
    });
  }, [activeBookings, bookingsSearch, bookingsStatusFilter]);

  const filteredPastBookings = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return pastBookings.filter((b) => {
      const matchesStatus = historyStatusFilter === 'all' || b.status === historyStatusFilter;
      const matchesQ =
        !q ||
        b.serviceTitle.toLowerCase().includes(q) ||
        b.petName.toLowerCase().includes(q) ||
        b.caregiverName.toLowerCase().includes(q) ||
        b.bookingId.toLowerCase().includes(q);
      return matchesStatus && matchesQ;
    });
  }, [pastBookings, historySearch, historyStatusFilter]);

  const matchedPromo = useMemo(() => {
    const code = bkPromoCode.trim().toUpperCase();
    if (!code) return null;
    return promotions.find((p) => p.isActive && p.code.toUpperCase() === code) || null;
  }, [bkPromoCode, promotions]);

  const pricingBreakdown = useMemo(() => {
    const base = selectedService?.basePrice ?? platformSettings.defaultBookingPrice;
    const discount = matchedPromo ? Math.round((base * matchedPromo.discountPercent) / 100) : 0;
    const gross = Math.max(50, base - discount);
    const payout = Math.min(
      gross,
      selectedService?.providerPayout ?? platformSettings.defaultProviderCost
    );
    const commission = Math.max(0, gross - payout);
    return { base, gross, payout, commission, discount };
  }, [selectedService, matchedPromo, platformSettings]);

  const openPetModal = (pet?: PetProfile) => {
    if (pet) {
      setEditingPet(pet);
      setPetName(pet.name);
      setPetType(pet.petType);
      setPetBreed(pet.breed);
      setPetAge(String(pet.ageYears));
      setPetGender(pet.gender);
      setPetHealth(pet.healthInfo || '');
      setPetFeeding(pet.feedingInstructions || '');
      setPetBehavior(pet.behavioralInfo || '');
      setPetSpecial(pet.specialCare || '');
      setPetPhotoUrl(pet.photoUrl || '');
    } else {
      setEditingPet(null);
      setPetName('');
      setPetType('Dog');
      setPetBreed('');
      setPetAge('2');
      setPetGender('Male');
      setPetHealth('');
      setPetFeeding('');
      setPetBehavior('');
      setPetSpecial('');
      setPetPhotoUrl('');
    }
    setPetModalOpen(true);
  };

  const handleSavePet = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (petName.trim().length < 1) {
      showToast('error', 'Please enter a valid pet name.');
      return;
    }
    setSavingPet(true);
    try {
      const finalPhotoUrl = petPhotoUrl.trim();

      const parsedAge = Number(petAge);
      await savePet(
        firebaseUser.uid,
        {
          name: petName.trim(),
          petType,
          breed: petBreed.trim() || 'Mixed / Indie',
          ageYears: Number.isFinite(parsedAge) ? parsedAge : 1,
          gender: petGender,
          healthInfo: petHealth,
          feedingInstructions: petFeeding,
          behavioralInfo: petBehavior,
          specialCare: petSpecial,
          photoUrl: finalPhotoUrl,
        },
        editingPet?.petId
      );
      setPetModalOpen(false);
      showToast('success', editingPet ? 'Pet profile updated.' : 'Pet profile added.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Failed to save pet.'));
    } finally {
      setSavingPet(false);
    }
  };

  const handleCreateBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      showToast('error', 'Please sign in as a customer to place a booking.');
      return;
    }

    const effectiveCustomer: UserProfile = userProfile || {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pet Parent',
      email: firebaseUser.email || '',
      role: 'customer',
      accountStatus: 'active',
      photoUrl: firebaseUser.photoURL || undefined,
    };

    const pet = pets.find((p) => p.petId === bkPetId) || pets[0];
    if (!pet) {
      showToast('error', 'Please select or create a pet profile first.');
      return;
    }
    if (!selectedService) {
      showToast('error', 'Please select a valid service.');
      return;
    }
    if (!selectedCaregiver) {
      showToast('error', 'Please select a verified caregiver.');
      return;
    }
    const startMin = parseTimeToMinutes(bkStartTime);
    const endMin = parseTimeToMinutes(bkEndTime);
    if (startMin === null || endMin === null || startMin >= endMin) {
      showToast('error', 'End time must be strictly after start time.');
      return;
    }
    if (bkAddress.trim().length < 5) {
      showToast('error', 'Please enter a complete Dehradun service address (at least 5 characters).');
      return;
    }
    if (slotAvailable === false) {
      showToast('error', 'Selected date and time overlaps with an existing caregiver booking.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const bookingId = await createAtomicBooking({
        customer: effectiveCustomer,
        caregiver: selectedCaregiver,
        pet,
        service: selectedService,
        bookingDate: bkDate,
        startTime: bkStartTime,
        endTime: bkEndTime,
        timeSlot: bkTimeSlot,
        locality: bkLocality,
        serviceAddress: bkAddress,
        specialInstructions: bkInstructions,
        paymentMethod: bkPaymentMethod,
        grossAmount: pricingBreakdown.gross,
        caregiverPayout: pricingBreakdown.payout,
        platformCommission: pricingBreakdown.commission,
      });
      setConfirmedBookingSummary({
        bookingId,
        petName: pet.name,
        serviceName: selectedService.title,
        caregiverName: selectedCaregiver.fullName,
        bookingDate: bkDate,
        startTime: bkStartTime,
        endTime: bkEndTime,
        amount: pricingBreakdown.gross,
      });
      showToast('success', `Booking ${bookingId} submitted! Caregiver has been notified.`);
      setBkInstructions('');
    } catch (err) {
      showToast('error', formatAppError(err, 'Booking submission failed.'));
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (profName.trim().length < 2) {
      showToast('error', 'Full name must be at least 2 characters.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfile(
        firebaseUser.uid,
        {
          displayName: profName.trim(),
          phone: profPhone,
          locality: profLocality,
          address: profAddress,
          emergencyContactName: profEmergName,
          emergencyContactPhone: profEmergPhone,
        },
        firebaseUser.email || ''
      );
      showToast('success', 'Profile updated.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewBooking) return;
    setSubmittingReview(true);
    try {
      await submitReview({
        booking: reviewBooking,
        rating: reviewRating,
        comment: reviewComment,
        wouldRepeat: reviewRepeat,
      });
      setReviewBooking(null);
      setReviewComment('');
      showToast('success', 'Thank you! Your verified review has been published.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not submit review.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.notificationId)));
      showToast('success', 'All notifications marked as read.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not mark notifications as read.'));
    }
  };

  const navItems: { id: CustomerTab; label: string; icon: typeof LayoutDashboard; badge?: number }[] =
    [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'pets', label: 'My Pets', icon: PawPrint, badge: pets.length },
      { id: 'services', label: 'Browse Services', icon: Briefcase, badge: services.length },
      { id: 'caregivers', label: 'Find Caregivers', icon: Search },
      { id: 'book', label: 'Book Service', icon: Plus },
      { id: 'bookings', label: 'Active Bookings', icon: Calendar, badge: activeBookings.length },
      { id: 'history', label: 'History', icon: History },
      { id: 'play', label: 'Play Zone', icon: Gamepad2 },
      { id: 'rewards', label: 'Rewards & Badges', icon: Trophy },
      { id: 'reviews', label: 'Reviews', icon: Star, badge: completedUnreviewed.length },
      { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
      { id: 'help', label: 'Help & Support', icon: HelpCircle },
      { id: 'profile', label: 'My Profile', icon: User },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];

  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');

  const filteredDirectory = publicCaregivers.filter((c) => {
    const q = cgSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.locality.toLowerCase().includes(q) ||
      c.servicesOffered.some((s) => s.toLowerCase().includes(q)) ||
      c.skills.some((sk) => sk.toLowerCase().includes(q));
    const matchesLoc = cgLocality === 'all' || c.locality === cgLocality;
    const matchesService =
      cgServiceFilter === 'all' || c.servicesOffered.includes(cgServiceFilter);
    const matchesAvail =
      cgAvailFilter === 'all' || c.availability.includes(cgAvailFilter);
    return matchesSearch && matchesLoc && matchesService && matchesAvail;
  });

  const nextSpotlightBooking = activeBookings[0] || null;
  const firstName = (userProfile?.displayName || firebaseUser?.displayName || 'Friend').split(' ')[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {listenerError && (
        <div
          role="alert"
          className="mb-5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm font-medium flex items-center justify-between gap-3"
        >
          <span>{listenerError}</span>
          <button
            type="button"
            onClick={() => setListenerError(null)}
            className="p-1 rounded hover:bg-red-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            className={`mb-6 px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between ${
              toast.type === 'success'
                ? 'bg-teal-50 border-teal-200 text-teal-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="cursor-pointer p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Compact Identity + Sign Out Bar */}
      <div className="lg:hidden mb-3 flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-teal-700">Customer Account</p>
          <p className="text-sm font-bold text-stone-900 truncate">
            {userProfile?.displayName || firebaseUser?.displayName || firebaseUser?.email || 'Pet Parent'}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Mobile Compact Horizontal Nav */}
      <div className="lg:hidden mb-5 overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active ? 'bg-white text-teal-800 shadow-sm' : 'text-stone-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="font-mono-tabular text-[11px] text-teal-700">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-22 space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                <ImageWithFallback
                  src={userProfile?.photoUrl || firebaseUser?.photoURL || undefined}
                  alt={userProfile?.displayName || firebaseUser?.displayName || 'Pet Parent'}
                  fallbackLabel={userProfile?.displayName || firebaseUser?.displayName || 'Pet Parent'}
                  variant="avatar"
                  seed={firebaseUser?.uid || firebaseUser?.email || 'customer'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-teal-700">Customer Account</p>
                <p className="font-display font-bold text-stone-900 truncate">
                  {userProfile?.displayName || firebaseUser?.displayName || 'Pet Parent'}
                </p>
                <p className="text-xs text-stone-500 truncate">{firebaseUser?.email}</p>
              </div>
            </div>

            <nav className="space-y-1" aria-label="Customer Dashboard Sections">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                      active ? 'text-white' : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="customer-sidebar-active"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        className="absolute inset-0 bg-emerald-900 rounded-xl -z-0"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className={`relative z-10 font-mono-tabular text-xs font-semibold ${
                          active ? 'text-teal-100' : 'text-stone-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-stone-100 space-y-2">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-9 min-w-0 space-y-5">
          {/* Blinkit / Swiggy Style Top Locality & Quick-Search Bar */}
          <div className="bg-white border border-stone-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Active Locality Selector */}
              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 shrink-0">
                <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
                <select
                  aria-label="Active Dehradun locality"
                  value={bkLocality}
                  onChange={(e) => {
                    const nextLoc = e.target.value;
                    setBkLocality(nextLoc);
                    setCgLocality(nextLoc);
                  }}
                  className="bg-transparent text-xs font-semibold text-stone-900 focus:outline-none cursor-pointer"
                >
                  {platformSettings.localities.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instant Omni-Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={omniSearch}
                  onChange={(e) => setOmniSearch(e.target.value)}
                  placeholder="Search services (walking, boarding) or Dehradun caregivers..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600"
                />
                {omniSearch && (
                  <button
                    type="button"
                    onClick={() => setOmniSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  aria-label="View alerts"
                  className="relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Bell className="w-3.5 h-3.5 text-teal-700" />
                  <span className="font-mono-tabular">{unreadCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('help')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-violet-700" />
                  <span>Help</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('book')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Book Now
                </button>
              </div>
            </div>

            {/* Instant Omni-Search Results Drawer */}
            {omniSearch.trim().length > 0 && (
              <div className="pt-2 border-t border-stone-100 space-y-2">
                {omniMatches.services.length === 0 && omniMatches.caregivers.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    No services or caregivers matched "{omniSearch}".
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {omniMatches.services.map((svc) => (
                      <button
                        key={svc.serviceId}
                        type="button"
                        onClick={() => {
                          setBkServiceId(svc.serviceId);
                          setOmniSearch('');
                          setActiveTab('book');
                        }}
                        className="flex items-center justify-between gap-2 p-2.5 text-left border border-stone-200 hover:border-teal-300 rounded-xl bg-stone-50/70 hover:bg-teal-50/40 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{svc.title}</p>
                          <p className="text-[11px] text-stone-500 font-mono-tabular">
                            Service · ₹{svc.basePrice} · {svc.durationLabel}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-teal-700 shrink-0">
                          Book →
                        </span>
                      </button>
                    ))}
                    {omniMatches.caregivers.map((cg) => (
                      <button
                        key={cg.caregiverId}
                        type="button"
                        onClick={() => {
                          setBkCaregiverId(cg.caregiverId);
                          setOmniSearch('');
                          setActiveTab('book');
                        }}
                        className="flex items-center justify-between gap-2 p-2.5 text-left border border-stone-200 hover:border-violet-300 rounded-xl bg-stone-50/70 hover:bg-violet-50/40 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{cg.fullName}</p>
                          <p className="text-[11px] text-stone-500 truncate">
                            Caregiver · {cg.locality} · {cg.experienceYears} yrs exp
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-violet-700 shrink-0">
                          Select →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* 1. Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Welcome Header Card */}
                  <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{bkLocality || userProfile?.locality || 'Dehradun, Uttarakhand'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Verified Gmail Session</span>
                      </p>
                      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white text-balance">
                        Welcome back, {firstName}
                      </h1>
                      <p className="text-sm text-emerald-100 max-w-xl">
                        Manage your pet care routines, lock verified Dehradun caregivers, play
                        mini-games, and follow every session live.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPetModal()}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <PawPrint className="w-3.5 h-3.5" /> Add Pet
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('play')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-950 bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" /> Play Zone
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('book')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-950 bg-white hover:bg-emerald-50 rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> Book Care Session
                      </button>
                    </div>
                  </div>

                  {/* 4 Key Customer Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Registered Pets', value: pets.length, action: () => setActiveTab('pets') },
                      {
                        label: 'Active Sessions',
                        value: activeBookings.length,
                        action: () => setActiveTab('bookings'),
                      },
                      {
                        label: 'Total Spent',
                        value: `₹${totalSpentINR}`,
                        action: () => setActiveTab('history'),
                      },
                      {
                        label: 'Unread Alerts',
                        value: unreadCount,
                        action: () => setActiveTab('notifications'),
                      },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={stat.action}
                        className="text-left bg-white border border-stone-200 hover:border-teal-300 rounded-2xl p-5 space-y-1 transition-colors cursor-pointer"
                      >
                        <p className="text-xs text-stone-500">{stat.label}</p>
                        <p className="font-display text-2xl font-bold text-stone-900 font-mono-tabular">
                          {stat.value}
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Next Active Care Session Spotlight */}
                  {nextSpotlightBooking && (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolveServiceImage(nextSpotlightBooking.serviceTitle)}
                              alt={nextSpotlightBooking.serviceTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-semibold text-teal-700">
                              Upcoming Care Session
                            </p>
                            <h2 className="font-display text-lg font-bold text-stone-900 truncate">
                              {nextSpotlightBooking.serviceTitle} for {nextSpotlightBooking.petName}
                            </h2>
                            <p className="text-xs text-stone-500">
                              Caregiver: {nextSpotlightBooking.caregiverName} ·{' '}
                              {nextSpotlightBooking.bookingDate} · {nextSpotlightBooking.timeSlot}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {nextSpotlightBooking.status === 'accepted' && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const paymentRec = payments.find(
                                    (p) => p.bookingId === nextSpotlightBooking.bookingId
                                  );
                                  await customerConfirmTestPayment(nextSpotlightBooking, paymentRec);
                                  showToast('success', 'Booking confirmed!');
                                } catch (err) {
                                  showToast('error', formatAppError(err, 'Could not confirm booking.'));
                                }
                              }}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                            >
                              Confirm Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setReceiptBooking(nextSpotlightBooking)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('bookings')}
                            className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                          >
                            Manage Booking
                          </button>
                        </div>
                      </div>

                      {/* 4-Step Session Tracker */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-stone-100">
                        {BOOKING_PROGRESS_STEPS.map((step, idx) => {
                          const currentIdx = getStepIndex(nextSpotlightBooking.status);
                          const reached = idx <= currentIdx;
                          return (
                            <div key={step.key} className="space-y-1.5">
                              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    reached ? 'bg-teal-600 w-full' : 'w-0'
                                  }`}
                                />
                              </div>
                              <p
                                className={`text-[11px] font-medium ${
                                  reached ? 'text-teal-800' : 'text-stone-400'
                                }`}
                              >
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* My Pets Quick-Book Section */}
                  {pets.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center -space-x-3 shrink-0">
                          {[BRAND_ASSETS.dogPortraitImg, BRAND_ASSETS.catPortraitImg].map(
                            (src, idx) => (
                              <div
                                key={idx}
                                className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white border border-stone-200"
                              >
                                <ImageWithFallback
                                  src={src}
                                  alt="Companion pet portrait"
                                  variant="pet"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )
                          )}
                        </div>
                        <div className="space-y-1">
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Add Your First Pet Profile
                          </h2>
                          <p className="text-sm text-stone-600">
                            Save feeding instructions, breed details, and health notes once to share
                            with every caregiver.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPetModal()}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        Create Pet Profile
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Your Registered Pets
                          </h2>
                          <p className="text-xs text-stone-500">
                            Jump directly into scheduling care for any of your companions.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('pets')}
                          className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                        >
                          Manage pets
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pets.map((pet) => (
                          <div
                            key={pet.petId}
                            className="group border border-stone-200 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-teal-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                                <ImageWithFallback
                                  src={resolvePetImage(pet)}
                                  alt={pet.name}
                                  fallbackLabel={pet.petType}
                                  variant="pet"
                                  hoverZoom
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-display font-bold text-sm text-stone-900 truncate">
                                  {pet.name}
                                </p>
                                <p className="text-xs text-stone-500 truncate">
                                  {pet.petType} · {pet.breed}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBkPetId(pet.petId);
                                setActiveTab('book');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg shrink-0 cursor-pointer"
                            >
                              Book
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offers & Promo Coupons Strip */}
                  {promotions.length > 0 && (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-violet-700" /> Offers & Promo Coupons
                          </h2>
                          <p className="text-xs text-stone-500">
                            Apply active Dehradun care discounts in one click during booking.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {promotions.map((promo) => {
                          const applied = bkPromoCode.trim().toUpperCase() === promo.code.toUpperCase();
                          return (
                            <div
                              key={promo.promoId}
                              className="border border-stone-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-stone-50/60"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono-tabular text-xs font-bold text-violet-800 tracking-wide">
                                    {promo.code}
                                  </span>
                                  <span className="font-mono-tabular text-xs font-bold text-teal-700">
                                    {promo.discountPercent}% OFF
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-stone-900">{promo.title}</p>
                                {promo.description && (
                                  <p className="text-[11px] text-stone-500">{promo.description}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBkPromoCode(promo.code);
                                  setActiveTab('book');
                                  showToast(
                                    'success',
                                    `Promo ${promo.code} (${promo.discountPercent}% OFF) applied to booking checkout.`
                                  );
                                }}
                                className={`w-full py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                                  applied
                                    ? 'bg-teal-700 text-white'
                                    : 'bg-white border border-stone-200 text-stone-800 hover:bg-stone-100'
                                }`}
                              >
                                {applied ? 'Applied — Go to Book' : 'Apply & Book'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 1-Tap Book Again Strip */}
                  {quickReorderOptions.length > 0 && (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Book Again in 1 Tap
                          </h2>
                          <p className="text-xs text-stone-500">
                            Repeat your recent caregiver & pet combinations with pre-filled details.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('history')}
                          className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                        >
                          Full history
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {quickReorderOptions.map((b) => (
                          <div
                            key={b.bookingId}
                            className="border border-stone-200 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-stone-200">
                                <ImageWithFallback
                                  src={resolveServiceImage(b.serviceTitle)}
                                  alt={b.serviceTitle}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-stone-900 truncate">
                                  {b.serviceTitle}
                                </p>
                                <p className="text-[11px] text-stone-500 truncate">
                                  {b.petName} · {b.caregiverName}
                                </p>
                                <p className="text-[11px] font-mono-tabular text-stone-600">
                                  ₹{b.grossAmount} · {b.locality}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBkPetId(b.petId);
                                setBkServiceId(b.serviceId);
                                setBkCaregiverId(b.caregiverId);
                                if (b.locality) setBkLocality(b.locality);
                                if (b.serviceAddress) setBkAddress(b.serviceAddress);
                                setConfirmedBookingSummary(null);
                                setActiveTab('book');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Repeat Session
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick-Launch Services Strip */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-lg font-bold text-stone-900">
                          Quick Book Dehradun Services
                        </h2>
                        <p className="text-xs text-stone-500">
                          Choose any verified pet care service to start scheduling.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('services')}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        All services ({services.length})
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {services.map((svc) => (
                        <button
                          key={svc.serviceId}
                          type="button"
                          onClick={() => {
                            setBkServiceId(svc.serviceId);
                            setConfirmedBookingSummary(null);
                            setActiveTab('book');
                          }}
                          className="group text-left border border-stone-200 hover:border-teal-300 rounded-xl overflow-hidden flex items-center gap-3 p-2.5 transition-colors cursor-pointer"
                        >
                          <div className="w-16 h-14 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback
                              src={resolveServiceImage(svc)}
                              alt={svc.title}
                              hoverZoom
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-sm text-stone-900 truncate">
                              {svc.title}
                            </p>
                            <p className="text-xs text-stone-500 font-mono-tabular">
                              ₹{svc.basePrice} · {svc.durationLabel}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-teal-700 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. My Pets */}
              {activeTab === 'pets' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-stone-900">My Pets</h1>
                      <p className="text-sm text-stone-600">
                        Keep feeding schedules, health disclosures, and behavior notes up to date.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPetModal()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> Add Pet
                    </button>
                  </div>

                  {pets.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-4">
                      <div className="flex items-center justify-center -space-x-3">
                        {[
                          { src: BRAND_ASSETS.dogPortraitImg, alt: 'Dog profile' },
                          { src: BRAND_ASSETS.catPortraitImg, alt: 'Cat profile' },
                          { src: BRAND_ASSETS.rabbitPortraitImg, alt: 'Rabbit profile' },
                          { src: BRAND_ASSETS.birdPortraitImg, alt: 'Bird profile' },
                        ].map((item) => (
                          <div
                            key={item.alt}
                            className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white shadow-sm"
                          >
                            <ImageWithFallback
                              src={item.src}
                              alt={item.alt}
                              variant="pet"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      <h2 className="font-display text-lg font-bold text-stone-900">
                        No Pets Added Yet
                      </h2>
                      <p className="text-sm text-stone-600 max-w-md mx-auto">
                        Add your dog, cat, rabbit, or bird profile and upload their photo to share
                        care routines with verified Dehradun caregivers.
                      </p>
                      <button
                        type="button"
                        onClick={() => openPetModal()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                      >
                        Create First Pet Profile
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pets.map((pet) => (
                        <div
                          key={pet.petId}
                          className="group bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3.5">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 shrink-0 ring-1 ring-stone-200">
                                  <ImageWithFallback
                                    src={resolvePetImage(pet)}
                                    alt={`${pet.name} (${pet.petType})`}
                                    fallbackLabel={pet.petType}
                                    variant="pet"
                                    hoverZoom
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div>
                                  <h2 className="font-display text-lg font-bold text-stone-900">
                                    {pet.name}
                                  </h2>
                                  <p className="text-xs text-stone-500">
                                    {pet.petType} · {pet.breed} · {pet.ageYears} yrs · {pet.gender}
                                  </p>
                                  <p className="text-[11px] font-medium text-teal-700 mt-0.5">
                                    {pet.photoUrl?.trim()
                                      ? 'Custom uploaded photo'
                                      : `${pet.petType} portrait`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openPetModal(pet)}
                                  className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
                                  aria-label={`Edit ${pet.name}`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deletePet(pet.petId);
                                      showToast('success', `${pet.name} removed.`);
                                    } catch (err) {
                                      showToast('error', formatAppError(err, 'Could not remove pet.'));
                                    }
                                  }}
                                  className="p-2 text-stone-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                  aria-label={`Delete ${pet.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-100">
                              {pet.feedingInstructions && (
                                <p>
                                  <span className="font-semibold text-stone-800">Feeding:</span>{' '}
                                  {pet.feedingInstructions}
                                </p>
                              )}
                              {pet.healthInfo && (
                                <p>
                                  <span className="font-semibold text-stone-800">Health:</span>{' '}
                                  {pet.healthInfo}
                                </p>
                              )}
                              {pet.behavioralInfo && (
                                <p>
                                  <span className="font-semibold text-stone-800">Behavior:</span>{' '}
                                  {pet.behavioralInfo}
                                </p>
                              )}
                              {pet.specialCare && (
                                <p>
                                  <span className="font-semibold text-stone-800">Special Care:</span>{' '}
                                  {pet.specialCare}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setBkPetId(pet.petId);
                              setActiveTab('book');
                            }}
                            className="w-full py-2 px-3 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors cursor-pointer"
                          >
                            Book Care Session for {pet.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2.5 Browse Services */}
              {activeTab === 'services' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      Browse Dehradun Pet Care Services
                    </h1>
                    <p className="text-sm text-stone-600">
                      Transparent non-medical pet care pricing with verified caregiver check-ins.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map((svc) => (
                      <div
                        key={svc.serviceId}
                        className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div className="aspect-[16/10] bg-stone-100 overflow-hidden">
                            <ImageWithFallback
                              src={resolveServiceImage(svc)}
                              alt={svc.title}
                              hoverZoom
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-stone-500">{svc.durationLabel}</span>
                              <span className="font-mono-tabular font-bold text-teal-800 text-sm">
                                ₹{svc.basePrice}
                              </span>
                            </div>
                            <h2 className="font-display text-lg font-bold text-stone-900">
                              {svc.title}
                            </h2>
                            <p className="text-xs text-stone-600 leading-relaxed">
                              {svc.description}
                            </p>
                          </div>
                        </div>
                        <div className="px-5 pb-5">
                          <button
                            type="button"
                            onClick={() => {
                              setBkServiceId(svc.serviceId);
                              setConfirmedBookingSummary(null);
                              setActiveTab('book');
                            }}
                            className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer transition-colors"
                          >
                            Book {svc.title} (₹{svc.basePrice})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Find Caregivers */}
              {activeTab === 'caregivers' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      Find Verified Caregivers
                    </h1>
                    <p className="text-sm text-stone-600">
                      Browse admin-approved caregivers in Dehradun and jump straight to booking.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={cgSearch}
                      onChange={(e) => setCgSearch(e.target.value)}
                      placeholder="Search name, skill, service..."
                      className="px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <select
                      value={cgServiceFilter}
                      onChange={(e) => setCgServiceFilter(e.target.value)}
                      className="px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="all">All Services</option>
                      {services.map((svc) => (
                        <option key={svc.serviceId} value={svc.title}>
                          {svc.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cgLocality}
                      onChange={(e) => setCgLocality(e.target.value)}
                      className="px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="all">All Dehradun Localities</option>
                      {platformSettings.localities.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cgAvailFilter}
                      onChange={(e) => setCgAvailFilter(e.target.value)}
                      className="px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="all">Any Time Slot</option>
                      {AVAILABILITY_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>

                  {filteredDirectory.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                      No verified caregivers match your current filter.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {filteredDirectory.map((cg) => {
                        const cgRevs = reviews.filter((r) => r.caregiverId === cg.caregiverId);
                        const avgRating =
                          cgRevs.length > 0
                            ? (cgRevs.reduce((s, r) => s + r.rating, 0) / cgRevs.length).toFixed(1)
                            : null;
                        return (
                          <div
                            key={cg.caregiverId}
                            className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-stone-100 shrink-0 ring-1 ring-stone-200">
                                  <ImageWithFallback
                                    src={cg.photoUrl}
                                    alt={`${cg.fullName} — Verified PawCare Caregiver`}
                                    fallbackLabel={cg.fullName}
                                    variant="avatar"
                                    seed={cg.caregiverId}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="font-display font-bold text-stone-900 truncate">
                                    {cg.fullName}
                                  </h2>
                                  <p className="text-xs text-stone-500">
                                    {cg.locality} · {cg.experienceYears} yrs exp
                                  </p>
                                  <p className="text-xs text-teal-700 font-medium inline-flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Admin Verified
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-mono-tabular font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg shrink-0">
                                {avgRating ? `${avgRating} ★ (${cgRevs.length})` : 'New'}
                              </span>
                            </div>
                            <p className="text-xs text-stone-600">
                              Services: {cg.servicesOffered.join(', ')}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              Availability: {cg.availability.join(' · ')}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setBkCaregiverId(cg.caregiverId);
                                setActiveTab('book');
                              }}
                              className="w-full py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                            >
                              Select & Book {cg.fullName.split(' ')[0]}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Book a Service */}
              {activeTab === 'book' && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      Book a Pet Care Service
                    </h1>
                    <p className="text-sm text-stone-600">
                      Real-time slot & time-overlap validation prevents double-bookings on caregiver schedules.
                    </p>
                  </div>

                  {confirmedBookingSummary && (
                    <div className="p-5 bg-teal-50 border border-teal-200 rounded-2xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                          <div className="space-y-1 text-sm">
                            <p className="font-bold text-teal-950">
                              Booking Request Submitted!
                            </p>
                            <p className="text-xs text-teal-900">
                              Booking ID:{' '}
                              <span className="font-mono-tabular font-bold">
                                {confirmedBookingSummary.bookingId}
                              </span>{' '}
                              · Status: <span className="font-semibold">Pending Caregiver Response</span>
                            </p>
                            <p className="text-xs text-teal-800">
                              {confirmedBookingSummary.serviceName} for{' '}
                              {confirmedBookingSummary.petName} with{' '}
                              {confirmedBookingSummary.caregiverName} on{' '}
                              {confirmedBookingSummary.bookingDate} (
                              {confirmedBookingSummary.startTime}–{confirmedBookingSummary.endTime}) · ₹
                              {confirmedBookingSummary.amount}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmedBookingSummary(null)}
                          className="p-1 text-teal-800 hover:bg-teal-100 rounded-lg cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('bookings')}
                          className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                        >
                          View in Active Bookings
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmedBookingSummary(null)}
                          className="px-4 py-2 text-xs font-semibold text-teal-900 bg-white border border-teal-200 rounded-xl cursor-pointer"
                        >
                          Book Another Session
                        </button>
                      </div>
                    </div>
                  )}

                  {pets.length === 0 ? (
                    <div className="p-6 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                      <p className="text-sm font-medium text-stone-800">
                        You need at least one pet profile before creating a booking.
                      </p>
                      <button
                        type="button"
                        onClick={() => openPetModal()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                      >
                        Add Pet Profile Now
                      </button>
                    </div>
                  ) : publicCaregivers.length === 0 ? (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                      No verified caregivers are currently live in the directory yet. Once an
                      administrator verifies a caregiver application, they will appear here for
                      booking.
                    </div>
                  ) : (
                    <form onSubmit={handleCreateBooking} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            1. Select Pet
                          </label>
                          <select
                            value={bkPetId}
                            onChange={(e) => setBkPetId(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
                            {pets.map((p) => (
                              <option key={p.petId} value={p.petId}>
                                {p.name} ({p.petType} · {p.breed})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            2. Select Service
                          </label>
                          <select
                            value={bkServiceId}
                            onChange={(e) => setBkServiceId(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
                            {services.map((s) => (
                              <option key={s.serviceId} value={s.serviceId}>
                                {s.title} — ₹{s.basePrice} ({s.durationLabel})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          3. Select Verified Caregiver
                        </label>
                        <select
                          value={bkCaregiverId}
                          onChange={(e) => setBkCaregiverId(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                        >
                          {publicCaregivers.map((cg) => (
                            <option key={cg.caregiverId} value={cg.caregiverId}>
                              {cg.fullName} — {cg.locality} ({cg.experienceYears} yrs exp)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Live Selection Preview Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 border border-stone-200 rounded-xl p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolvePetImage(selectedPet)}
                              alt={selectedPet?.name || 'Selected pet'}
                              fallbackLabel={selectedPet?.petType}
                              variant="pet"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-stone-500">Pet</p>
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {selectedPet?.name || 'Select pet'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolveServiceImage(selectedService)}
                              alt={selectedService?.title || 'Selected service'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-stone-500">Service</p>
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {selectedService?.title || 'Select service'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={selectedCaregiver?.photoUrl}
                              alt={selectedCaregiver?.fullName || 'Selected caregiver'}
                              fallbackLabel={selectedCaregiver?.fullName}
                              variant="avatar"
                              seed={selectedCaregiver?.caregiverId}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-stone-500">Caregiver</p>
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {selectedCaregiver?.fullName || 'Select caregiver'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            4. Booking Date
                          </label>
                          <input
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={bkDate}
                            onChange={(e) => setBkDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            5. Caregiver Slot
                          </label>
                          <select
                            value={bkTimeSlot}
                            onChange={(e) => setBkTimeSlot(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
                            {(selectedCaregiver?.availability.length
                              ? selectedCaregiver.availability
                              : AVAILABILITY_SLOTS
                            ).map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            required
                            value={bkStartTime}
                            onChange={(e) => setBkStartTime(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            required
                            value={bkEndTime}
                            onChange={(e) => setBkEndTime(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                        </div>
                      </div>

                      <div className="text-xs">
                        {(() => {
                          const sMin = parseTimeToMinutes(bkStartTime);
                          const eMin = parseTimeToMinutes(bkEndTime);
                          if (sMin !== null && eMin !== null && sMin >= eMin) {
                            return (
                              <span className="text-red-700 font-medium">
                                Invalid time range — end time must be after start time.
                              </span>
                            );
                          }
                          if (checkingSlot) {
                            return (
                              <span className="text-stone-500">
                                Checking schedule & time-overlap availability...
                              </span>
                            );
                          }
                          if (slotAvailable === true) {
                            return (
                              <span className="text-teal-700 font-medium">
                                Time window ({bkStartTime}–{bkEndTime}) is available for{' '}
                                {selectedCaregiver?.fullName.split(' ')[0]}
                              </span>
                            );
                          }
                          if (slotAvailable === false) {
                            return (
                              <span className="text-red-700 font-medium">
                                Unavailable — overlaps with an existing booking for this caregiver.
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            6. Dehradun Locality
                          </label>
                          <select
                            value={bkLocality}
                            onChange={(e) => setBkLocality(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
                            {platformSettings.localities.map((loc) => (
                              <option key={loc} value={loc}>
                                {loc}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Promo Code (Optional)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={bkPromoCode}
                              onChange={(e) => setBkPromoCode(e.target.value)}
                              placeholder="e.g., DEHRADUN10"
                              className="flex-1 px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                            />
                            {bkPromoCode && (
                              <button
                                type="button"
                                onClick={() => setBkPromoCode('')}
                                className="px-3 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {matchedPromo && (
                            <p className="text-xs text-teal-700 font-medium mt-1">
                              Applied {matchedPromo.code}: {matchedPromo.discountPercent}% off (−₹
                              {pricingBreakdown.discount})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Available Offers */}
                      {promotions.length > 0 && (
                        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                          <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-violet-700" /> Available Offers (Tap
                            to apply)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {promotions.map((promo) => {
                              const active =
                                bkPromoCode.trim().toUpperCase() === promo.code.toUpperCase();
                              return (
                                <button
                                  key={promo.promoId}
                                  type="button"
                                  onClick={() =>
                                    setBkPromoCode(active ? '' : promo.code)
                                  }
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors font-mono-tabular ${
                                    active
                                      ? 'bg-teal-700 border-teal-700 text-white'
                                      : 'bg-white border-stone-200 text-stone-800 hover:border-teal-300'
                                  }`}
                                >
                                  {promo.code} · {promo.discountPercent}% OFF
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          7. Complete Service Address in Dehradun
                        </label>
                        <input
                          type="text"
                          required
                          value={bkAddress}
                          onChange={(e) => setBkAddress(e.target.value)}
                          placeholder="House/Flat No, Street, Landmark"
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          8. Special Instructions for Caregiver
                        </label>
                        <textarea
                          rows={3}
                          value={bkInstructions}
                          onChange={(e) => setBkInstructions(e.target.value)}
                          placeholder="Door entry instructions, leash preference, meal timings..."
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-2">
                          9. Payment Readiness Mode
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {(
                            [
                              {
                                id: 'cash',
                                title: 'Cash on Service',
                                sub: 'Pay caregiver directly upon visit',
                              },
                              {
                                id: 'upi',
                                title: 'UPI (Integration Ready)',
                                sub: 'Pending live merchant settlement',
                              },
                              {
                                id: 'online_gateway',
                                title: 'Online Gateway (Test Mode)',
                                sub: 'Safe test-mode verification',
                              },
                            ] as const
                          ).map((pm) => (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => setBkPaymentMethod(pm.id)}
                              className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                                bkPaymentMethod === pm.id
                                  ? 'border-teal-700 bg-teal-50/70'
                                  : 'border-stone-200 hover:bg-stone-50'
                              }`}
                            >
                              <p className="text-xs font-bold text-stone-900">{pm.title}</p>
                              <p className="text-[11px] text-stone-500 mt-0.5">{pm.sub}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-sm">
                        <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Bill Details
                        </p>
                        <div className="flex justify-between text-xs text-stone-600">
                          <span>Service Base Fee</span>
                          <span className="font-mono-tabular">₹{pricingBreakdown.base}</span>
                        </div>
                        {pricingBreakdown.discount > 0 && (
                          <div className="flex justify-between text-xs text-teal-700 font-medium">
                            <span>Promo Discount ({matchedPromo?.code})</span>
                            <span className="font-mono-tabular">
                              −₹{pricingBreakdown.discount}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>Caregiver Payout Portion</span>
                          <span className="font-mono-tabular">₹{pricingBreakdown.payout}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>Platform Service Contribution</span>
                          <span className="font-mono-tabular">₹{pricingBreakdown.commission}</span>
                        </div>
                        <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-stone-900">
                          <span>To Pay</span>
                          <span className="font-mono-tabular text-teal-800">
                            ₹{pricingBreakdown.gross}
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingBooking || slotAvailable === false}
                        className="w-full py-3 px-6 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {submittingBooking
                          ? 'Submitting Atomic Booking...'
                          : `Submit Booking Request (₹${pricingBreakdown.gross})`}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 5. Active Bookings */}
              {activeTab === 'bookings' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-stone-900">
                        Active Bookings
                      </h1>
                      <p className="text-sm text-stone-600">
                        Track caregiver responses, test payment readiness, and coordinate visits.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('book')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    >
                      New Booking
                    </button>
                  </div>

                  {activeBookings.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={bookingsSearch}
                        onChange={(e) => setBookingsSearch(e.target.value)}
                        placeholder="Filter by pet, caregiver, service or ID..."
                        className="flex-1 px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      />
                      <select
                        value={bookingsStatusFilter}
                        onChange={(e) =>
                          setBookingsStatusFilter(e.target.value as 'all' | BookingStatus)
                        }
                        className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      >
                        <option value="all">All Active Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="in_progress">In Progress</option>
                      </select>
                    </div>
                  )}

                  {activeBookings.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3">
                      <p className="text-sm text-stone-600">No active bookings right now.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('book')}
                        className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                      >
                        Schedule a Session
                      </button>
                    </div>
                  ) : filteredActiveBookings.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-2">
                      <p className="text-sm text-stone-600">
                        No active bookings match your filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingsSearch('');
                          setBookingsStatusFilter('all');
                        }}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredActiveBookings.map((b) => {
                        const paymentRec = payments.find((p) => p.bookingId === b.bookingId);
                        const stepIdx = getStepIndex(b.status);
                        return (
                          <div
                            key={b.bookingId}
                            className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                                  <ImageWithFallback
                                    src={resolveServiceImage(b.serviceTitle)}
                                    alt={b.serviceTitle}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="font-display text-lg font-bold text-stone-900 truncate">
                                    {b.serviceTitle} for {b.petName}
                                  </h2>
                                  <p className="text-xs text-stone-500">
                                    Caregiver: {b.caregiverName} · {b.bookingDate} · {b.timeSlot} ·{' '}
                                    {b.locality}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono-tabular text-sm font-bold text-stone-900">
                                  ₹{b.grossAmount}
                                </span>
                                <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                                  {b.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            {/* Live Session Progress Bar */}
                            <div className="grid grid-cols-4 gap-2">
                              {BOOKING_PROGRESS_STEPS.map((st, idx) => (
                                <div key={st.key} className="space-y-1">
                                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        idx <= stepIdx ? 'bg-teal-600 w-full' : 'w-0'
                                      }`}
                                    />
                                  </div>
                                  <p
                                    className={`text-[11px] font-medium ${
                                      idx <= stepIdx ? 'text-teal-800' : 'text-stone-400'
                                    }`}
                                  >
                                    {st.label}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                              <span>
                                Payment: {b.paymentMethod.replace('_', ' ')} (
                                {b.paymentStatus.replace('_', ' ')})
                              </span>
                              <span>Address: {b.serviceAddress}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-stone-100">
                              {b.status === 'accepted' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await customerConfirmTestPayment(b, paymentRec);
                                      showToast(
                                        'success',
                                        'Booking confirmed! Payment marked as test-verified / cash confirmed.'
                                      );
                                    } catch (err) {
                                      showToast('error', formatAppError(err, 'Could not confirm booking.'));
                                    }
                                  }}
                                  className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                                >
                                  Confirm Booking (
                                  {b.paymentMethod === 'cash' ? 'Cash' : 'Test Verify'})
                                </button>
                              )}

                              <a
                                href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                                  `Hi PawCare Desk, coordinating booking ${b.bookingId} (${b.serviceTitle} on ${b.bookingDate}) with caregiver ${b.caregiverName}.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg"
                              >
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Coordination
                              </a>

                              {['pending', 'accepted', 'confirmed'].includes(b.status) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await updateBookingStatus({
                                        booking: b,
                                        nextStatus: 'cancelled',
                                        paymentStatus:
                                          b.paymentStatus === 'test_verified'
                                            ? 'refund_pending'
                                            : b.paymentStatus,
                                        actorRole: 'customer',
                                      });
                                      showToast(
                                        'success',
                                        'Booking cancelled and caregiver slot released.'
                                      );
                                    } catch (err) {
                                      showToast('error', formatAppError(err, 'Could not cancel booking.'));
                                    }
                                  }}
                                  className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                                >
                                  Cancel Booking
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setReceiptBooking(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> Receipt
                              </button>

                              {['confirmed', 'in_progress'].includes(b.status) &&
                                b.disputeStatus === 'none' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDisputeBooking(b);
                                      setDisputeNotes('');
                                    }}
                                    className="px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                                  >
                                    Report Issue
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 6. Booking History */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-stone-900">
                        Booking History
                      </h1>
                      <p className="text-xs text-stone-500 font-mono-tabular">
                        Total Spent: ₹{totalSpentINR} · {pastBookings.length} past record(s)
                      </p>
                    </div>
                  </div>

                  {pastBookings.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search past bookings by pet, caregiver or service..."
                        className="flex-1 px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      />
                      <select
                        value={historyStatusFilter}
                        onChange={(e) =>
                          setHistoryStatusFilter(
                            e.target.value as 'all' | 'completed' | 'cancelled' | 'rejected'
                          )
                        }
                        className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      >
                        <option value="all">All Past Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  )}

                  {pastBookings.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                      Completed, cancelled, and declined bookings will appear here.
                    </div>
                  ) : filteredPastBookings.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600 space-y-2">
                      <p>No booking history records match your filter.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setHistorySearch('');
                          setHistoryStatusFilter('all');
                        }}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
                      {filteredPastBookings.map((b) => (
                        <div
                          key={b.bookingId}
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                              <ImageWithFallback
                                src={resolveServiceImage(b.serviceTitle)}
                                alt={b.serviceTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-stone-900 text-sm truncate">
                                {b.serviceTitle} · {b.petName} with {b.caregiverName}
                              </p>
                              <p className="text-xs text-stone-500">
                                {b.bookingDate} ({b.timeSlot}) · Payment: {b.paymentStatus}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono-tabular text-sm font-semibold text-stone-800">
                              ₹{b.grossAmount}
                            </span>
                            <span className="text-xs font-semibold capitalize text-stone-700">
                              {b.status}
                            </span>
                            {b.disputeStatus !== 'none' && (
                              <span className="text-xs font-semibold capitalize text-amber-800">
                                · Dispute: {b.disputeStatus}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setReceiptBooking(b)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                            >
                              <FileText className="w-3 h-3" /> Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBkPetId(b.petId);
                                setBkServiceId(b.serviceId);
                                setBkCaregiverId(b.caregiverId);
                                if (b.locality) setBkLocality(b.locality);
                                if (b.serviceAddress) setBkAddress(b.serviceAddress);
                                setActiveTab('book');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Book Again
                            </button>
                            {b.status === 'completed' && !b.hasReview && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewBooking(b);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-lg cursor-pointer"
                              >
                                Leave Review
                              </button>
                            )}
                            {b.status === 'completed' && b.disputeStatus === 'none' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeBooking(b);
                                  setDisputeNotes('');
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                              >
                                Report Issue
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7. Reviews & Ratings */}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  <h1 className="font-display text-2xl font-bold text-stone-900">
                    Reviews & Repeat Feedback
                  </h1>

                  {completedUnreviewed.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                      No completed bookings awaiting your review right now.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedUnreviewed.map((b) => (
                        <div
                          key={b.bookingId}
                          className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <p className="font-semibold text-stone-900">
                              {b.serviceTitle} with {b.caregiverName}
                            </p>
                            <p className="text-xs text-stone-500">
                              Pet: {b.petName} · Completed on {b.bookingDate}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewBooking(b);
                              setReviewRating(5);
                              setReviewComment('');
                            }}
                            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                          >
                            Rate & Review Session
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {mySubmittedReviews.length > 0 && (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <h2 className="font-display text-lg font-bold text-stone-900">
                        Your Published Reviews ({mySubmittedReviews.length})
                      </h2>
                      <div className="divide-y divide-stone-100">
                        {mySubmittedReviews.map((rev) => (
                          <div key={rev.reviewId} className="py-3 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-stone-900">
                                {rev.rating} / 5 Stars
                              </span>
                              <span className="text-stone-500">
                                {rev.wouldRepeat ? 'Would book again' : 'One-time session'}
                              </span>
                            </div>
                            <p className="text-stone-600">{rev.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 8. Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      Notifications
                    </h1>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                      No notifications yet. Booking confirmations and status alerts appear here.
                    </div>
                  ) : (
                    <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
                      {notifications.map((n) => (
                        <div
                          key={n.notificationId}
                          className={`p-4 flex items-start justify-between gap-4 ${
                            n.isRead ? 'opacity-70' : 'bg-teal-50/30'
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-stone-900">{n.title}</p>
                            <p className="text-xs text-stone-600">{n.message}</p>
                          </div>
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await markNotificationRead(n.notificationId);
                                } catch (err) {
                                  showToast('error', formatAppError(err, 'Could not mark notification as read.'));
                                }
                              }}
                              className="text-xs font-semibold text-teal-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8.5 Help & Support */}
              {activeTab === 'help' && firebaseUser && (
                <SupportHelpPanel
                  userId={firebaseUser.uid}
                  userName={userProfile?.displayName || firebaseUser.displayName || 'Pet Parent'}
                  userEmail={userProfile?.email || firebaseUser.email || ''}
                  userPhone={userProfile?.phone}
                  roleLabel="customer"
                  bookings={bookings}
                  platformSettings={platformSettings}
                  onToast={showToast}
                />
              )}

              {/* 9. My Profile */}
              {activeTab === 'profile' && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-5">
                  <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
                    <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                      <ImageWithFallback
                        src={userProfile?.photoUrl || firebaseUser?.photoURL || undefined}
                        alt={profName || 'Pet Parent'}
                        fallbackLabel={profName || 'Pet Parent'}
                        variant="avatar"
                        seed={firebaseUser?.uid || profName || 'customer'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h1 className="font-display text-2xl font-bold text-stone-900">My Profile</h1>
                      <p className="text-xs text-stone-500">{firebaseUser?.email}</p>
                    </div>
                  </div>
                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={profName}
                          onChange={(e) => setProfName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          maxLength={20}
                          value={profPhone}
                          onChange={(e) => setProfPhone(e.target.value)}
                          placeholder="+91 98XXXXXXXX"
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Dehradun Locality
                        </label>
                        <select
                          value={profLocality}
                          onChange={(e) => setProfLocality(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        >
                          {platformSettings.localities.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Default Address
                        </label>
                        <input
                          type="text"
                          value={profAddress}
                          onChange={(e) => setProfAddress(e.target.value)}
                          placeholder="Flat / House No., Street"
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={profEmergName}
                          onChange={(e) => setProfEmergName(e.target.value)}
                          placeholder="Family member or friend"
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          maxLength={20}
                          value={profEmergPhone}
                          onChange={(e) => setProfEmergPhone(e.target.value)}
                          placeholder="+91 98XXXXXXXX"
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer disabled:opacity-60"
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>
                </div>
              )}

              {/* 10. Settings */}
              {activeTab === 'settings' && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
                  <h1 className="font-display text-2xl font-bold text-stone-900">
                    Account Settings
                  </h1>

                  <div className="space-y-4 text-sm max-w-xl">
                    <div className="p-4 border border-stone-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">Firebase Gmail Account</p>
                        <p className="text-xs text-stone-500">
                          Signed in and verified as {firebaseUser?.email}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                      </span>
                    </div>

                    <div className="p-4 border border-stone-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">Password Reset</p>
                        <p className="text-xs text-stone-500">
                          Send a password reset email to {firebaseUser?.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!firebaseUser?.email) return;
                          try {
                            await resetPassword(firebaseUser.email);
                            showToast('success', 'Password reset email sent.');
                          } catch (err) {
                            showToast('error', formatAppError(err, 'Could not send reset email.'));
                          }
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                      >
                        Send Reset Link
                      </button>
                    </div>

                    <div className="p-4 border border-stone-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">
                          Trust & Cancellation Policies
                        </p>
                        <p className="text-xs text-stone-500">
                          Review PawCare non-medical care terms and refund handling.
                        </p>
                      </div>
                      <Link
                        to="/legal"
                        className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 rounded-lg"
                      >
                        Read Policies
                      </Link>
                    </div>

                    <div className="p-4 border border-red-200 bg-red-50/40 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">Sign Out of PawCare</p>
                        <p className="text-xs text-stone-500">
                          End your current customer session on this device.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 rounded-lg cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Play Zone & Rewards */}
              {activeTab === 'play' && <PlayZoneSection defaultView="play" />}
              {activeTab === 'rewards' && <PlayZoneSection defaultView="rewards" />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Add/Edit Pet Modal */}
      <AnimatePresence>
        {petModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-stone-900">
                  {editingPet ? `Edit ${editingPet.name}` : 'Add New Pet Profile'}
                </h2>
                <button
                  type="button"
                  onClick={() => setPetModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePet} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Pet Name
                    </label>
                    <input
                      type="text"
                      required
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="Bruno"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Pet Type
                    </label>
                    <select
                      value={petType}
                      onChange={(e) => setPetType(e.target.value as PetType)}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    >
                      {(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'] as const).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Breed</label>
                    <input
                      type="text"
                      required
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      placeholder="Golden Retriever"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Age (yrs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      step="0.5"
                      required
                      value={petAge}
                      onChange={(e) => setPetAge(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={petGender}
                      onChange={(e) => setPetGender(e.target.value as PetGender)}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-stone-700">
                      Pet Portrait (Choose Preset or Paste HTTPS Image URL)
                    </label>
                    {petPhotoUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => setPetPhotoUrl('')}
                        className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                      >
                        Use Default Portrait
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-stone-200 bg-white">
                      <ImageWithFallback
                        src={resolvePetImage({ photoUrl: petPhotoUrl, petType })}
                        alt={petName || `${petType} preview`}
                        fallbackLabel={petType}
                        variant="pet"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PET_PHOTO_PRESETS.map((preset) => {
                        const selected = petPhotoUrl.trim() === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setPetPhotoUrl(preset.url)}
                            title={preset.label}
                            className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer aspect-square ${
                              selected
                                ? 'border-emerald-800 ring-2 ring-emerald-500/30'
                                : 'border-stone-200 hover:border-emerald-400'
                            }`}
                          >
                            <img
                              src={preset.url}
                              alt={preset.label}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    type="url"
                    value={petPhotoUrl}
                    onChange={(e) => setPetPhotoUrl(e.target.value)}
                    placeholder="Or paste direct HTTPS photo URL (https://...)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Health & Vaccination Info
                  </label>
                  <textarea
                    rows={2}
                    value={petHealth}
                    onChange={(e) => setPetHealth(e.target.value)}
                    placeholder="Vaccinations up to date, sensitive stomach..."
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Feeding Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={petFeeding}
                    onChange={(e) => setPetFeeding(e.target.value)}
                    placeholder="1 cup kibble at 8 AM and 7 PM, fresh water..."
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Behavioral Info
                    </label>
                    <textarea
                      rows={2}
                      value={petBehavior}
                      onChange={(e) => setPetBehavior(e.target.value)}
                      placeholder="Friendly, pulls lightly on leash..."
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Special Care Requirements
                    </label>
                    <textarea
                      rows={2}
                      value={petSpecial}
                      onChange={(e) => setPetSpecial(e.target.value)}
                      placeholder="Keep indoors during thunder..."
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPetModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPet}
                    className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {savingPet ? 'Saving...' : 'Save Pet Profile'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <h2 className="font-display text-xl font-bold text-stone-900">
                Review {reviewBooking.caregiverName}
              </h2>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Rating (1–5)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReviewRating(num)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer ${
                          reviewRating >= num
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'border-stone-200 text-stone-500'
                        }`}
                      >
                        {num} ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Feedback
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="How was the caregiver with your pet?"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={reviewRepeat}
                    onChange={(e) => setReviewRepeat(e.target.checked)}
                  />
                  <span>I would book again or refer PawCare to another pet parent</span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewBooking(null)}
                    className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispute Modal */}
      <AnimatePresence>
        {disputeBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Report Booking Issue
                </h2>
              </div>
              <p className="text-xs text-stone-600">
                Describe what went wrong with booking {disputeBooking.bookingId}. Our Dehradun admin
                desk will review and follow up.
              </p>
              <textarea
                rows={3}
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                placeholder="Explain the issue..."
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisputeBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (disputeNotes.trim().length < 4) {
                      showToast('error', 'Please enter at least 4 characters describing the issue.');
                      return;
                    }
                    try {
                      await customerOpenBookingDispute(disputeBooking.bookingId, disputeNotes);
                      setDisputeBooking(null);
                      showToast('success', 'Dispute submitted for administrator review.');
                    } catch (err) {
                      showToast('error', formatAppError(err, 'Could not submit dispute.'));
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 rounded-xl cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BookingReceiptModal
        booking={receiptBooking}
        payment={
          receiptBooking
            ? payments.find((p) => p.bookingId === receiptBooking.bookingId)
            : undefined
        }
        viewerRole="customer"
        onClose={() => setReceiptBooking(null)}
      />
    </div>
  );
}
