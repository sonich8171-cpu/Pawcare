import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  LayoutDashboard,
  MessageCircle,
  Phone,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import { AVAILABILITY_SLOTS, CAREGIVER_SKILLS, resolveServiceImage } from '../data/defaults';
import { uploadMediaFile } from '../lib/firebase';
import {
  submitOrUpdateCaregiverApplication,
  subscribeCaregiverBookings,
  updateBookingStatus,
} from '../services/firestoreService';
import type { BookingRecord, IdDocType } from '../types/pawcare';

type CaregiverTab =
  | 'overview'
  | 'requests'
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'earnings'
  | 'reviews'
  | 'profile'
  | 'settings';

export function CaregiverDashboard() {
  const { firebaseUser, userProfile, caregiverProfile, resetPassword } = useAuth();
  const { services, platformSettings, reviews } = usePublicData();

  const [activeTab, setActiveTab] = useState<CaregiverTab>('overview');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Registration / Profile form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState(platformSettings.localities[0] || 'Rajpur Road');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('1');
  const [expectedCharge, setExpectedCharge] = useState('300');
  const [skills, setSkills] = useState<string[]>(['Dog Handling']);
  const [servicesOffered, setServicesOffered] = useState<string[]>(['Pet Sitting', 'Dog Walking']);
  const [availability, setAvailability] = useState<string[]>([
    AVAILABILITY_SLOTS[0],
    AVAILABILITY_SLOTS[3],
  ]);
  const [idDocType, setIdDocType] = useState<IdDocType>('Aadhaar');
  const [idDocNumber, setIdDocNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [idDocUrl, setIdDocUrl] = useState('');
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (caregiverProfile) {
      setFullName(caregiverProfile.fullName);
      setEmail(caregiverProfile.email);
      setPhone(caregiverProfile.phone);
      setAddress(caregiverProfile.address);
      setLocality(caregiverProfile.locality);
      setBio(caregiverProfile.bio || '');
      setExperienceYears(String(caregiverProfile.experienceYears));
      setExpectedCharge(String(caregiverProfile.expectedCharge));
      setSkills(caregiverProfile.skills);
      setServicesOffered(caregiverProfile.servicesOffered);
      setAvailability(caregiverProfile.availability);
      setIdDocType(caregiverProfile.idDocType);
      setIdDocNumber(caregiverProfile.idDocNumber);
      setPhotoUrl(caregiverProfile.photoUrl || '');
      setIdDocUrl(caregiverProfile.idDocUrl || '');
    } else if (userProfile || firebaseUser) {
      setFullName(userProfile?.displayName || firebaseUser?.displayName || '');
      setEmail(userProfile?.email || firebaseUser?.email || '');
      setPhone(userProfile?.phone || '');
      setAddress(userProfile?.address || '');
      if (userProfile?.locality) setLocality(userProfile.locality);
    }
  }, [caregiverProfile, userProfile, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeCaregiverBookings(firebaseUser.uid, setBookings);
  }, [firebaseUser]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('');
      return;
    }
    const objUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [photoFile]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const toggleItem = (list: string[], item: string, setter: (next: string[]) => void) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleSubmitProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (servicesOffered.length === 0 || availability.length === 0) {
      showToast('error', 'Please select at least one service offered and one availability slot.');
      return;
    }

    setSaving(true);
    try {
      let finalPhoto = photoUrl.trim();
      let finalIdDoc = idDocUrl.trim();

      if (photoFile) {
        try {
          finalPhoto = await uploadMediaFile(
            `caregivers/${firebaseUser.uid}/public/avatar_${Date.now()}`,
            photoFile
          );
        } catch {
          showToast('error', 'Profile photo upload skipped (Firebase Storage not active).');
        }
      }

      if (idDocFile) {
        try {
          finalIdDoc = await uploadMediaFile(
            `caregivers/${firebaseUser.uid}/verification/id_${Date.now()}`,
            idDocFile
          );
        } catch {
          showToast('error', 'ID file upload skipped (Firebase Storage not active).');
        }
      }

      await submitOrUpdateCaregiverApplication(
        firebaseUser.uid,
        {
          fullName,
          email: email || firebaseUser.email || '',
          phone,
          address,
          locality,
          bio,
          experienceYears: Number(experienceYears) || 0,
          skills,
          servicesOffered,
          availability,
          expectedCharge: Math.max(100, Number(expectedCharge) || 300),
          idDocType,
          idDocNumber,
          photoUrl: finalPhoto,
          idDocUrl: finalIdDoc,
        },
        caregiverProfile
      );
      showToast(
        'success',
        caregiverProfile
          ? 'Caregiver profile updated.'
          : 'Application submitted! An administrator will verify your documents before listing you publicly.'
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not save caregiver profile.');
    } finally {
      setSaving(false);
    }
  };

  const pendingRequests = bookings.filter((b) => b.status === 'pending');
  const upcomingBookings = bookings.filter((b) => ['accepted', 'confirmed'].includes(b.status));
  const activeServices = bookings.filter((b) => b.status === 'in_progress');
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const cancelledBookings = bookings.filter((b) =>
    ['cancelled', 'rejected'].includes(b.status)
  );
  const myReviews = reviews.filter((r) => r.caregiverId === firebaseUser?.uid);
  const totalPayoutEarned = completedBookings.reduce((sum, b) => sum + b.caregiverPayout, 0);
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthlyPayoutEarned = completedBookings
    .filter((b) => b.bookingDate.startsWith(currentMonthPrefix))
    .reduce((sum, b) => sum + b.caregiverPayout, 0);
  const pendingPayoutTotal = bookings
    .filter((b) => ['accepted', 'confirmed', 'in_progress'].includes(b.status))
    .reduce((sum, b) => sum + b.caregiverPayout, 0);
  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');

  // If caregiver hasn't registered yet, render the complete onboarding application
  if (!caregiverProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-700">Caregiver Onboarding · Dehradun</p>
            <h1 className="font-display text-3xl font-extrabold text-stone-900">
              Apply to Become a Verified PawCare Caregiver
            </h1>
            <p className="text-sm text-stone-600 mt-1">
              Caregiver profiles remain hidden from public search until an administrator verifies
              your identity documents.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline shrink-0"
          >
            Back to Customer Dashboard
          </Link>
        </div>

        {toast && (
          <div
            className={`px-4 py-3 rounded-xl border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-teal-50 border-teal-200 text-teal-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {toast.text}
          </div>
        )}

        <form
          onSubmit={handleSubmitProfile}
          className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                required
                minLength={8}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
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
                Residential Address
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street / Hostel / Colony"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                required
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Expected Payout Per Session (₹)
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                required
                value={expectedCharge}
                onChange={(e) => setExpectedCharge(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Caregiver Bio & Pet Handling Experience
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell pet parents about your background with dogs, cats, or other pets..."
              className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Services Offered
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {services.map((svc) => (
                <label
                  key={svc.serviceId}
                  className="flex items-center gap-2 p-2.5 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={servicesOffered.includes(svc.title)}
                    onChange={() => toggleItem(servicesOffered, svc.title, setServicesOffered)}
                  />
                  <span>{svc.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Availability Slots
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {AVAILABILITY_SLOTS.map((slot) => (
                <label
                  key={slot}
                  className="flex items-center gap-2 p-2.5 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={availability.includes(slot)}
                    onChange={() => toggleItem(availability, slot, setAvailability)}
                  />
                  <span>{slot}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">Skills</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {CAREGIVER_SKILLS.map((skill) => (
                <label
                  key={skill}
                  className="flex items-center gap-2 p-2 border border-stone-200 rounded-xl cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={skills.includes(skill)}
                    onChange={() => toggleItem(skills, skill, setSkills)}
                  />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200 space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900">
              Identity Verification Documents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  ID Document Type
                </label>
                <select
                  value={idDocType}
                  onChange={(e) => setIdDocType(e.target.value as IdDocType)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                >
                  {(['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Student ID'] as const).map(
                    (docT) => (
                      <option key={docT} value={docT}>
                        {docT}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  ID Number / Last 4 Digits
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={idDocNumber}
                  onChange={(e) => setIdDocNumber(e.target.value)}
                  placeholder="XXXX-XXXX-1234"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Profile Photograph
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                    <ImageWithFallback
                      src={photoPreviewUrl || photoUrl || undefined}
                      alt={fullName || 'Caregiver portrait'}
                      fallbackLabel={fullName || 'Caregiver'}
                      variant="avatar"
                      seed={firebaseUser?.uid || fullName || 'caregiver'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="text-xs text-stone-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-stone-100 file:font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Upload ID Document (Private to Admin)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setIdDocFile(e.target.files?.[0] || null)}
                  className="text-xs text-stone-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-stone-100 file:font-semibold"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-6 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Submitting Application...' : 'Submit Caregiver Application for Verification'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between ${
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

      {/* Verification Status Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          caregiverProfile.verificationStatus === 'verified'
            ? 'bg-teal-50 border-teal-200 text-teal-950'
            : caregiverProfile.verificationStatus === 'rejected'
            ? 'bg-red-50 border-red-200 text-red-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {caregiverProfile.verificationStatus === 'verified' ? (
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-bold">
              Verification Status:{' '}
              <span className="capitalize">{caregiverProfile.verificationStatus}</span>
              {caregiverProfile.accountStatus === 'suspended' && ' (Account Suspended)'}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              {caregiverProfile.verificationStatus === 'verified'
                ? 'Your profile is publicly visible and bookable by Dehradun pet owners.'
                : caregiverProfile.verificationStatus === 'rejected'
                ? `Admin note: ${caregiverProfile.adminNotes || 'Please update your documents and details.'}`
                : 'Your application is awaiting administrator review. You will appear in the public directory once approved.'}
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-white border border-stone-200 text-stone-800 whitespace-nowrap shrink-0"
        >
          Customer Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-100 shrink-0 ring-1 ring-stone-200">
                <ImageWithFallback
                  src={caregiverProfile.photoUrl}
                  alt={caregiverProfile.fullName}
                  fallbackLabel={caregiverProfile.fullName}
                  variant="avatar"
                  seed={caregiverProfile.caregiverId}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-stone-500">Caregiver Panel</p>
                <p className="font-display font-bold text-stone-900 truncate">
                  {caregiverProfile.fullName}
                </p>
              </div>
            </div>

            <nav className="space-y-1">
              {(
                [
                  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                  {
                    id: 'requests',
                    label: 'Booking Requests',
                    icon: Clock,
                    badge: pendingRequests.length,
                  },
                  {
                    id: 'upcoming',
                    label: 'Upcoming Bookings',
                    icon: Calendar,
                    badge: upcomingBookings.length,
                  },
                  {
                    id: 'active',
                    label: 'Active Services',
                    icon: Activity,
                    badge: activeServices.length,
                  },
                  { id: 'completed', label: 'Completed Bookings', icon: CheckCircle2 },
                  { id: 'cancelled', label: 'Cancelled / Rejected', icon: X },
                  { id: 'earnings', label: 'Earnings', icon: IndianRupee },
                  { id: 'reviews', label: 'Reviews', icon: Star },
                  { id: 'profile', label: 'Profile & Availability', icon: UserCheck },
                  { id: 'settings', label: 'Settings & Trust', icon: Settings },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl cursor-pointer ${
                      active ? 'bg-violet-700 text-white' : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {'badge' in item && item.badge > 0 && (
                      <span className="font-mono-tabular text-xs font-semibold">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Pending Requests', value: pendingRequests.length },
                  { label: 'Upcoming Sessions', value: upcomingBookings.length },
                  { label: 'Completed', value: completedBookings.length },
                  { label: 'Net Payout Earned', value: `₹${totalPayoutEarned}` },
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

              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Incoming Booking Requests
                </h2>
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-stone-500">No pending requests right now.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((b) => (
                      <div
                        key={b.bookingId}
                        className="border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolveServiceImage(b.serviceTitle)}
                              alt={b.serviceTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="space-y-1 text-sm min-w-0">
                            <p className="font-semibold text-stone-900 truncate">
                              {b.serviceTitle} for {b.petName} ({b.petBreed})
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              Customer: {b.customerName} · {b.bookingDate} ({b.timeSlot}) ·{' '}
                              {b.locality}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateBookingStatus({
                                booking: b,
                                nextStatus: 'accepted',
                                actorRole: 'caregiver',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                          >
                            Accept (₹{b.caregiverPayout})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateBookingStatus({
                                booking: b,
                                nextStatus: 'rejected',
                                actorRole: 'caregiver',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {(activeTab === 'requests' ||
            activeTab === 'upcoming' ||
            activeTab === 'active' ||
            activeTab === 'completed' ||
            activeTab === 'cancelled') && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-stone-900 capitalize">
                {activeTab === 'requests'
                  ? 'Pending Booking Requests'
                  : activeTab === 'upcoming'
                  ? 'Upcoming Confirmed Bookings'
                  : activeTab === 'active'
                  ? 'Active Care Sessions (In Progress)'
                  : activeTab === 'completed'
                  ? 'Completed Bookings'
                  : 'Cancelled & Rejected Bookings'}
              </h1>

              {(activeTab === 'requests'
                ? pendingRequests
                : activeTab === 'upcoming'
                ? upcomingBookings
                : activeTab === 'active'
                ? activeServices
                : activeTab === 'completed'
                ? completedBookings
                : cancelledBookings
              ).length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-500">
                  No bookings in this category.
                </div>
              ) : (
                <div className="space-y-4">
                  {(activeTab === 'requests'
                    ? pendingRequests
                    : activeTab === 'upcoming'
                    ? upcomingBookings
                    : activeTab === 'active'
                    ? activeServices
                    : activeTab === 'completed'
                    ? completedBookings
                    : cancelledBookings
                  ).map((b) => (
                    <div
                      key={b.bookingId}
                      className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolveServiceImage(b.serviceTitle)}
                              alt={b.serviceTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h2 className="font-display text-lg font-bold text-stone-900 truncate">
                              {b.serviceTitle} · {b.petName} ({b.petType})
                            </h2>
                            <p className="text-xs text-stone-500">
                              Customer: {b.customerName}{' '}
                              {b.customerPhone ? `(${b.customerPhone})` : ''} · {b.bookingDate} ·{' '}
                              {b.timeSlot}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono-tabular text-sm font-bold text-teal-800 block">
                            Your Payout: ₹{b.caregiverPayout}
                          </span>
                          <span className="text-[11px] text-stone-500 capitalize">
                            Status: {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="bg-stone-50 rounded-xl p-3.5 text-xs text-stone-700 space-y-1">
                        <p>
                          <span className="font-semibold">Address:</span> {b.serviceAddress},{' '}
                          {b.locality}
                        </p>
                        {b.petInstructions && (
                          <p>
                            <span className="font-semibold">Pet Care Notes:</span>{' '}
                            {b.petInstructions}
                          </p>
                        )}
                        {b.specialInstructions && (
                          <p>
                            <span className="font-semibold">Customer Instructions:</span>{' '}
                            {b.specialInstructions}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {b.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateBookingStatus({
                                  booking: b,
                                  nextStatus: 'accepted',
                                  actorRole: 'caregiver',
                                })
                              }
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                            >
                              Accept Request
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateBookingStatus({
                                  booking: b,
                                  nextStatus: 'rejected',
                                  actorRole: 'caregiver',
                                })
                              }
                              className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-lg cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {b.status === 'accepted' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBookingStatus({
                                booking: b,
                                nextStatus: 'confirmed',
                                actorRole: 'caregiver',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                          >
                            Confirm Schedule
                          </button>
                        )}

                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBookingStatus({
                                booking: b,
                                nextStatus: 'in_progress',
                                actorRole: 'caregiver',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-violet-700 rounded-lg cursor-pointer"
                          >
                            Start Care Session
                          </button>
                        )}

                        {b.status === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBookingStatus({
                                booking: b,
                                nextStatus: 'completed',
                                actorRole: 'caregiver',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                          >
                            Mark Service Completed
                          </button>
                        )}

                        {b.customerPhone && (
                          <a
                            href={`tel:${b.customerPhone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 rounded-lg"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call Customer
                          </a>
                        )}

                        <a
                          href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                            `Hi PawCare Support, caregiver update for booking ${b.bookingId} (${b.petName}).`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 rounded-lg"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Support Desk
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-stone-200 rounded-2xl p-5">
                  <p className="text-xs text-stone-500">Total Net Payout Earned</p>
                  <p className="font-display text-2xl font-bold text-teal-800 font-mono-tabular mt-1">
                    ₹{totalPayoutEarned}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl p-5">
                  <p className="text-xs text-stone-500">This Month Payout</p>
                  <p className="font-display text-2xl font-bold text-stone-900 font-mono-tabular mt-1">
                    ₹{monthlyPayoutEarned}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl p-5">
                  <p className="text-xs text-stone-500">Scheduled / In-Progress Payout</p>
                  <p className="font-display text-2xl font-bold text-violet-800 font-mono-tabular mt-1">
                    ₹{pendingPayoutTotal}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-stone-900">
                    Caregiver Earnings Breakdown
                  </h1>
                  <p className="text-sm text-stone-600">
                    Shows gross booking value vs. platform contribution vs. your net caregiver payout.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-stone-200 text-xs text-stone-500">
                      <tr>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Service</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 pr-4 text-right">Gross Value</th>
                        <th className="py-2.5 pr-4 text-right">Platform Fee</th>
                        <th className="py-2.5 text-right">Your Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono-tabular text-xs">
                      {bookings.map((b) => (
                        <tr key={b.bookingId}>
                          <td className="py-3 pr-4">{b.bookingDate}</td>
                          <td className="py-3 pr-4 font-sans">{b.serviceTitle}</td>
                          <td className="py-3 pr-4 font-sans capitalize">{b.status}</td>
                          <td className="py-3 pr-4 text-right">₹{b.grossAmount}</td>
                          <td className="py-3 pr-4 text-right text-stone-500">
                            ₹{b.platformCommission}
                          </td>
                          <td className="py-3 text-right font-semibold text-teal-800">
                            ₹{b.caregiverPayout}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-stone-900">
                Customer Reviews ({myReviews.length})
              </h1>
              {myReviews.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-500">
                  Verified customer reviews appear here once bookings are completed and rated.
                </div>
              ) : (
                <div className="space-y-3">
                  {myReviews.map((r) => (
                    <div
                      key={r.reviewId}
                      className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-stone-900">{r.customerName}</span>
                        <span className="font-mono-tabular font-semibold text-amber-600">
                          {r.rating} / 5 ★
                        </span>
                      </div>
                      <p className="text-sm text-stone-600">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form
              onSubmit={handleSubmitProfile}
              className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5"
            >
              <h1 className="font-display text-2xl font-bold text-stone-900">
                Manage Profile, Services & Availability
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Locality
                  </label>
                  <select
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
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
                    Residential Address
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    required
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Expected Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    value={expectedCharge}
                    onChange={(e) => setExpectedCharge(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-stone-700">
                  Update Profile Photo (Upload or URL)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200 bg-white">
                    <ImageWithFallback
                      src={photoPreviewUrl || photoUrl || undefined}
                      alt={fullName || caregiverProfile.fullName}
                      fallbackLabel={fullName || caregiverProfile.fullName}
                      variant="avatar"
                      seed={caregiverProfile.caregiverId}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        className="text-xs text-stone-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white file:border file:border-stone-200 file:font-semibold"
                      />
                      {(photoFile || photoUrl.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoUrl('');
                          }}
                          className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Or paste photo URL (https://...)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Services Offered
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {services.map((svc) => (
                    <label
                      key={svc.serviceId}
                      className="flex items-center gap-2 p-2.5 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={servicesOffered.includes(svc.title)}
                        onChange={() => toggleItem(servicesOffered, svc.title, setServicesOffered)}
                      />
                      <span>{svc.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">Skills</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {CAREGIVER_SKILLS.map((skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 p-2 border border-stone-200 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={skills.includes(skill)}
                        onChange={() => toggleItem(skills, skill, setSkills)}
                      />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Availability Slots
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {AVAILABILITY_SLOTS.map((slot) => (
                    <label
                      key={slot}
                      className="flex items-center gap-2 p-2.5 border border-stone-200 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={availability.includes(slot)}
                        onChange={() => toggleItem(availability, slot, setAvailability)}
                      />
                      <span>{slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer"
              >
                {saving ? 'Updating...' : 'Save Caregiver Updates'}
              </button>
            </form>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
              <h1 className="font-display text-2xl font-bold text-stone-900">
                Verification & Account Settings
              </h1>
              <div className="p-4 border border-stone-200 rounded-xl text-xs space-y-1.5 bg-stone-50">
                <p className="font-semibold text-stone-900 text-sm">Submitted ID Verification</p>
                <p>
                  Document Type: <span className="font-semibold">{caregiverProfile.idDocType}</span> ·
                  Reference: <span className="font-mono-tabular">{caregiverProfile.idDocNumber}</span>
                </p>
                <p>
                  Verification Status:{' '}
                  <span className="capitalize font-semibold">{caregiverProfile.verificationStatus}</span>
                </p>
                {caregiverProfile.adminNotes && (
                  <p className="text-stone-600">Admin Note: {caregiverProfile.adminNotes}</p>
                )}
              </div>

              <div className="p-4 border border-stone-200 rounded-xl flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-semibold text-stone-900">Password Recovery</p>
                  <p className="text-xs text-stone-500">
                    Send a password reset link to {firebaseUser?.email}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
