import {
  AlertCircle,
  Bell,
  Calendar,
  Edit3,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PawPrint,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import {
  AVAILABILITY_SLOTS,
  BRAND_ASSETS,
  resolvePetImage,
  resolveServiceImage,
} from '../data/defaults';
import { uploadMediaFile } from '../lib/firebase';
import {
  checkCaregiverSlotAvailability,
  createAtomicBooking,
  customerConfirmTestPayment,
  customerOpenBookingDispute,
  deletePet,
  markNotificationRead,
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
  NotificationRecord,
  PaymentMethod,
  PaymentRecord,
  PetGender,
  PetProfile,
  PetType,
} from '../types/pawcare';

type CustomerTab =
  | 'overview'
  | 'pets'
  | 'caregivers'
  | 'book'
  | 'bookings'
  | 'history'
  | 'reviews'
  | 'notifications'
  | 'profile'
  | 'settings';

export function CustomerDashboard() {
  const { firebaseUser, userProfile, resetPassword, logout } = useAuth();
  const { services, publicCaregivers, platformSettings, promotions, reviews } = usePublicData();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialTab: CustomerTab = location.pathname.endsWith('/book') ? 'book' : 'overview';
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
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
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [petFilePreviewUrl, setPetFilePreviewUrl] = useState('');
  const [savingPet, setSavingPet] = useState(false);

  // Booking form state
  const [bkPetId, setBkPetId] = useState('');
  const [bkServiceId, setBkServiceId] = useState(searchParams.get('service') || '');
  const [bkCaregiverId, setBkCaregiverId] = useState(searchParams.get('caregiver') || '');
  const [bkDate, setBkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bkTimeSlot, setBkTimeSlot] = useState(AVAILABILITY_SLOTS[0]);
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
    const unsubs = [
      subscribeMyPets(firebaseUser.uid, (list) => {
        setPets(list);
        if (list.length > 0 && !bkPetId) setBkPetId(list[0].petId);
      }),
      subscribeCustomerBookings(firebaseUser.uid, setBookings),
      subscribeCustomerPayments(firebaseUser.uid, setPayments),
      subscribeNotifications(firebaseUser.uid, setNotifications),
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
    let active = true;
    if (!bkCaregiverId || !bkDate || !bkTimeSlot) {
      setSlotAvailable(null);
      return;
    }
    setCheckingSlot(true);
    checkCaregiverSlotAvailability(bkCaregiverId, bkDate, bkTimeSlot)
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
  }, [bkCaregiverId, bkDate, bkTimeSlot]);

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

  useEffect(() => {
    if (!petPhotoFile) {
      setPetFilePreviewUrl('');
      return;
    }
    const objUrl = URL.createObjectURL(petPhotoFile);
    setPetFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [petPhotoFile]);

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
    return { gross, payout, commission, discount };
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
    setPetPhotoFile(null);
    setPetModalOpen(true);
  };

  const handleSavePet = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingPet(true);
    try {
      let finalPhotoUrl = petPhotoUrl.trim();
      if (petPhotoFile) {
        try {
          finalPhotoUrl = await uploadMediaFile(
            `pets/${firebaseUser.uid}/${Date.now()}_${petPhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
            petPhotoFile
          );
        } catch {
          showToast(
            'error',
            'Photo upload via Firebase Storage failed (check Storage setup). Saving pet profile without uploaded file.'
          );
        }
      }

      await savePet(
        firebaseUser.uid,
        {
          name: petName,
          petType,
          breed: petBreed || 'Mixed / Indie',
          ageYears: Number(petAge) || 1,
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
      showToast('error', err instanceof Error ? err.message : 'Failed to save pet.');
    } finally {
      setSavingPet(false);
    }
  };

  const handleCreateBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !userProfile) return;
    const pet = pets.find((p) => p.petId === bkPetId);
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
    if (bkAddress.trim().length < 5) {
      showToast('error', 'Please enter a complete Dehradun service address.');
      return;
    }
    if (slotAvailable === false) {
      showToast('error', 'Selected date and slot is already booked for this caregiver.');
      return;
    }

    setSubmittingBooking(true);
    try {
      await createAtomicBooking({
        customer: userProfile,
        caregiver: selectedCaregiver,
        pet,
        service: selectedService,
        bookingDate: bkDate,
        timeSlot: bkTimeSlot,
        locality: bkLocality,
        serviceAddress: bkAddress,
        specialInstructions: bkInstructions,
        paymentMethod: bkPaymentMethod,
        grossAmount: pricingBreakdown.gross,
        caregiverPayout: pricingBreakdown.payout,
        platformCommission: pricingBreakdown.commission,
      });
      showToast('success', 'Booking request submitted! Caregiver has been notified.');
      setBkInstructions('');
      setActiveTab('bookings');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Booking submission failed.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingProfile(true);
    try {
      await updateUserProfile(firebaseUser.uid, {
        displayName: profName,
        phone: profPhone,
        locality: profLocality,
        address: profAddress,
        emergencyContactName: profEmergName,
        emergencyContactPhone: profEmergPhone,
      });
      showToast('success', 'Profile updated.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update profile.');
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
      showToast('error', err instanceof Error ? err.message : 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const navItems: { id: CustomerTab; label: string; icon: typeof LayoutDashboard; badge?: number }[] =
    [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'pets', label: 'My Pets', icon: PawPrint, badge: pets.length },
      { id: 'caregivers', label: 'Find Caregivers', icon: Search },
      { id: 'book', label: 'Book a Service', icon: Plus },
      { id: 'bookings', label: 'My Bookings', icon: Calendar, badge: activeBookings.length },
      { id: 'history', label: 'Booking History', icon: History },
      { id: 'reviews', label: 'Reviews & Ratings', icon: Star, badge: completedUnreviewed.length },
      { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toast && (
        <div
          role="status"
          className={`mb-6 px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
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
                <p className="text-xs text-stone-500">Customer Dashboard</p>
                <p className="font-display font-bold text-stone-900 truncate">
                  {userProfile?.displayName || firebaseUser?.displayName || 'Pet Parent'}
                </p>
                <p className="text-xs text-stone-500 truncate">{firebaseUser?.email}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                      active
                        ? 'bg-teal-700 text-white'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className={`font-mono-tabular text-xs font-semibold ${
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
              <Link
                to="/caregiver"
                className="block w-full text-center py-2 px-3 text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors"
              >
                Switch to Caregiver Panel
              </Link>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-9 space-y-6">
          {/* 1. Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-stone-900">
                    Welcome back, {(userProfile?.displayName || 'Friend').split(' ')[0]}
                  </h1>
                  <p className="text-sm text-stone-600">
                    Manage your pets, book verified caregivers in Dehradun, and track care sessions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('book')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" /> Book a Service
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'My Pets', value: pets.length },
                  { label: 'Active Bookings', value: activeBookings.length },
                  {
                    label: 'Completed Sessions',
                    value: bookings.filter((b) => b.status === 'completed').length,
                  },
                  { label: 'Unread Alerts', value: unreadCount },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white border border-stone-200 rounded-2xl p-5 space-y-1"
                  >
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="font-display text-2xl font-bold text-stone-900 font-mono-tabular">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {pets.length === 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                      <ImageWithFallback
                        src={BRAND_ASSETS.dogPortraitImg}
                        alt="Sample companion pet portrait"
                        variant="pet"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-display text-lg font-bold text-stone-900">
                        Add Your First Pet Profile
                      </h2>
                      <p className="text-sm text-stone-600">
                        Store feeding instructions, breed details, and emergency care notes before your
                        first booking.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPetModal()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer shrink-0"
                  >
                    Add Pet Profile
                  </button>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-stone-900">Recent Bookings</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bookings')}
                    className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                {bookings.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No bookings created yet. Select a pet and service to schedule your first
                    session.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {bookings.slice(0, 4).map((b) => (
                      <div
                        key={b.bookingId}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolveServiceImage(b.serviceTitle)}
                              alt={b.serviceTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">
                              {b.serviceTitle} · {b.petName}
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              Caregiver: {b.caregiverName} · {b.bookingDate} ({b.timeSlot})
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-tabular text-xs font-semibold text-stone-700">
                            ₹{b.grossAmount}
                          </span>
                          <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800">
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
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
                  <h2 className="font-display text-lg font-bold text-stone-900">No Pets Added Yet</h2>
                  <p className="text-sm text-stone-600 max-w-md mx-auto">
                    Add your dog, cat, rabbit, or bird profile and upload their photo to share care
                    routines with verified Dehradun caregivers.
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
                      className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolvePetImage(pet)}
                              alt={`${pet.name} (${pet.petType})`}
                              fallbackLabel={pet.petType}
                              variant="pet"
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
                                : `${pet.petType} default portrait`}
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
                              await deletePet(pet.petId);
                              showToast('success', `${pet.name} removed.`);
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
                  ))}
                </div>
              )}
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
                  Real-time slot checking prevents double-bookings on caregiver schedules.
                </p>
              </div>

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
                  administrator verifies a caregiver application, they will appear here for booking.
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        5. Time Slot
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
                      <p className="mt-1 text-xs">
                        {checkingSlot ? (
                          <span className="text-stone-500">Checking schedule availability...</span>
                        ) : slotAvailable === true ? (
                          <span className="text-teal-700 font-medium">
                            Slot available for {selectedCaregiver?.fullName.split(' ')[0]}
                          </span>
                        ) : slotAvailable === false ? (
                          <span className="text-red-700 font-medium">
                            Unavailable — already booked for this date & slot.
                          </span>
                        ) : null}
                      </p>
                    </div>
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
                      <input
                        type="text"
                        value={bkPromoCode}
                        onChange={(e) => setBkPromoCode(e.target.value)}
                        placeholder="e.g., DEHRADUN10"
                        className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      {matchedPromo && (
                        <p className="text-xs text-teal-700 mt-1">
                          Applied {matchedPromo.code}: {matchedPromo.discountPercent}% off
                        </p>
                      )}
                    </div>
                  </div>

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

                  {/* Transparent Price Summary */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Gross Booking Value</span>
                      <span className="font-mono-tabular font-bold text-stone-900">
                        ₹{pricingBreakdown.gross}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Caregiver Payout Portion</span>
                      <span className="font-mono-tabular">₹{pricingBreakdown.payout}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Platform Service Contribution</span>
                      <span className="font-mono-tabular">₹{pricingBreakdown.commission}</span>
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

          {/* 5. My Bookings */}
          {activeTab === 'bookings' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-stone-900">Active Bookings</h1>
                  <p className="text-sm text-stone-600">
                    Track caregiver responses, test payment readiness, and coordinate visits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('book')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                >
                  New Booking
                </button>
              </div>

              {activeBookings.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                  No active bookings right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeBookings.map((b) => {
                    const paymentRec = payments.find((p) => p.bookingId === b.bookingId);
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
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular text-sm font-bold text-stone-900">
                              ₹{b.grossAmount}
                            </span>
                            <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Payment: {b.paymentMethod.replace('_', ' ')} ({b.paymentStatus.replace('_', ' ')})
                          </span>
                          <span>Address: {b.serviceAddress}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-stone-100">
                          {b.status === 'accepted' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await customerConfirmTestPayment(b, paymentRec);
                                showToast(
                                  'success',
                                  'Booking confirmed! Payment marked as test-verified / cash confirmed.'
                                );
                              }}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                            >
                              Confirm Booking ({b.paymentMethod === 'cash' ? 'Cash' : 'Test Verify'})
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
                                await updateBookingStatus({
                                  booking: b,
                                  nextStatus: 'cancelled',
                                  paymentStatus:
                                    b.paymentStatus === 'test_verified'
                                      ? 'refund_pending'
                                      : b.paymentStatus,
                                  actorRole: 'customer',
                                });
                                showToast('success', 'Booking cancelled and caregiver slot released.');
                              }}
                              className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                            >
                              Cancel Booking
                            </button>
                          )}

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
              <h1 className="font-display text-2xl font-bold text-stone-900">Booking History</h1>
              {pastBookings.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-600">
                  Completed, cancelled, and declined bookings will appear here.
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
                  {pastBookings.map((b) => (
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
                        <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700">
                          {b.status}
                        </span>
                        {b.disputeStatus !== 'none' && (
                          <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                            Dispute: {b.disputeStatus}
                          </span>
                        )}
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
            <div className="space-y-5">
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
            </div>
          )}

          {/* 8. Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-stone-900">Notifications</h1>
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
                          onClick={() => markNotificationRead(n.notificationId)}
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
              <h1 className="font-display text-2xl font-bold text-stone-900">Account Settings</h1>

              <div className="space-y-4 text-sm max-w-xl">
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
                      if (firebaseUser?.email) {
                        await resetPassword(firebaseUser.email);
                        showToast('success', 'Password reset email sent.');
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </div>

                <div className="p-4 border border-stone-200 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-stone-900">Trust & Cancellation Policies</p>
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
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Pet Modal */}
      {petModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Pet Name</label>
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Pet Type</label>
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Age (yrs)</label>
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Gender</label>
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
                <label className="block text-xs font-semibold text-stone-700">
                  Pet Photo (Upload to Firebase Storage or Paste URL)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-stone-200 bg-white">
                    <ImageWithFallback
                      src={
                        petFilePreviewUrl ||
                        resolvePetImage({ photoUrl: petPhotoUrl, petType })
                      }
                      alt={petName || `${petType} preview`}
                      fallbackLabel={petType}
                      variant="pet"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <p className="text-[11px] text-stone-600">
                      {petFilePreviewUrl
                        ? 'Previewing selected photo — will upload to Firebase Storage when saved.'
                        : petPhotoUrl.trim()
                        ? 'Displaying your saved pet photo.'
                        : `Showing default ${petType} portrait until you upload a custom photo.`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPetPhotoFile(e.target.files?.[0] || null)}
                        className="text-xs text-stone-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white file:border file:border-stone-200 file:font-semibold"
                      />
                      {(petPhotoFile || petPhotoUrl.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPetPhotoFile(null);
                            setPetPhotoUrl('');
                          }}
                          className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="url"
                  value={petPhotoUrl}
                  onChange={(e) => setPetPhotoUrl(e.target.value)}
                  placeholder="Or paste direct photo URL (https://...)"
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
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4">
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
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeBooking && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4">
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
              placeholder="Explain the issue clearly..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisputeBooking(null)}
                className="px-4 py-2 text-xs font-semibold bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (disputeNotes.trim().length < 5) return;
                  await customerOpenBookingDispute(disputeBooking.bookingId, disputeNotes);
                  setDisputeBooking(null);
                  showToast('success', 'Dispute flagged for administrator review.');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 rounded-xl cursor-pointer"
              >
                Submit Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
