import {
  Activity,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Download,
  FileText,
  HelpCircle,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookingReceiptModal } from '../components/BookingReceiptModal';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { SupportHelpPanel } from '../components/SupportHelpPanel';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import { AVAILABILITY_SLOTS, CAREGIVER_SKILLS, resolveServiceImage } from '../data/defaults';
import { formatAppError } from '../lib/authErrors';
import {
  submitOrUpdateCaregiverApplication,
  subscribeCaregiverBookings,
  updateBookingStatus,
  updateCaregiverQuickAvailability,
} from '../services/firestoreService';
import type { BookingRecord, IdDocType } from '../types/pawcare';

type CaregiverTab =
  | 'overview'
  | 'profile'
  | 'verification'
  | 'requests'
  | 'upcoming'
  | 'accepted'
  | 'completed'
  | 'rejected'
  | 'earnings'
  | 'instructions'
  | 'reviews'
  | 'availability'
  | 'help';

export function CaregiverDashboard() {
  const { firebaseUser, userProfile, caregiverProfile, resetPassword, logout } = useAuth();
  const { services, platformSettings, reviews } = usePublicData();

  const [activeTab, setActiveTab] = useState<CaregiverTab>('overview');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
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
  const [idDocUrl, setIdDocUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Partner ergonomics state
  const [receiptBooking, setReceiptBooking] = useState<BookingRecord | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [earningsStatusFilter, setEarningsStatusFilter] = useState<
    'all' | 'completed' | 'active' | 'cancelled'
  >('all');
  const [togglingSlot, setTogglingSlot] = useState(false);

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
    setListenerError(null);
    return subscribeCaregiverBookings(
      firebaseUser.uid,
      setBookings,
      (err) => setListenerError(`Live booking sync issue: ${err.message}`)
    );
  }, [firebaseUser]);

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
    if (fullName.trim().length < 2) {
      showToast('error', 'Full name must be at least 2 characters.');
      return;
    }
    if (phone.trim().length < 8) {
      showToast('error', 'Please enter a valid phone number (at least 8 digits).');
      return;
    }
    if (address.trim().length < 5) {
      showToast('error', 'Residential address must be at least 5 characters.');
      return;
    }
    if (idDocNumber.trim().length < 4) {
      showToast('error', 'Government ID document number must be at least 4 characters.');
      return;
    }
    if (servicesOffered.length === 0 || availability.length === 0) {
      showToast('error', 'Please select at least one service offered and one availability slot.');
      return;
    }

    setSaving(true);
    try {
      const finalPhoto = photoUrl.trim();
      const finalIdDoc = idDocUrl.trim();

      await submitOrUpdateCaregiverApplication(
        firebaseUser.uid,
        {
          fullName: fullName.trim(),
          email: email || firebaseUser.email || '',
          phone: phone.trim(),
          address: address.trim(),
          locality,
          bio,
          experienceYears: Number(experienceYears) || 0,
          skills,
          servicesOffered,
          availability,
          expectedCharge: Math.max(100, Number(expectedCharge) || 300),
          idDocType,
          idDocNumber: idDocNumber.trim(),
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
      showToast('error', formatAppError(err, 'Could not save caregiver profile.'));
    } finally {
      setSaving(false);
    }
  };

  const isVerifiedCaregiver =
    caregiverProfile?.verificationStatus === 'verified' &&
    caregiverProfile?.accountStatus === 'active';

  const pendingRequests = bookings.filter((b) => b.status === 'pending');
  const upcomingBookings = bookings.filter((b) => ['confirmed', 'in_progress'].includes(b.status));
  const acceptedBookings = bookings.filter((b) =>
    ['accepted', 'confirmed', 'in_progress'].includes(b.status)
  );
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const rejectedBookings = bookings.filter((b) => ['rejected', 'cancelled'].includes(b.status));
  const instructionsBookings = bookings.filter((b) =>
    ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
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

  const earningsChartData = useMemo(() => {
    const map = new Map<string, { month: string; Earned: number; Scheduled: number }>();
    bookings.forEach((b) => {
      const month = (b.bookingDate || '').slice(0, 7) || 'Unknown';
      const entry = map.get(month) || { month, Earned: 0, Scheduled: 0 };
      if (b.status === 'completed') {
        entry.Earned += b.caregiverPayout;
      } else if (['accepted', 'confirmed', 'in_progress'].includes(b.status)) {
        entry.Scheduled += b.caregiverPayout;
      }
      map.set(month, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [bookings]);

  const filteredEarningsBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (earningsStatusFilter === 'completed') return b.status === 'completed';
      if (earningsStatusFilter === 'active') {
        return ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status);
      }
      if (earningsStatusFilter === 'cancelled') {
        return ['cancelled', 'rejected'].includes(b.status);
      }
      return true;
    });
  }, [bookings, earningsStatusFilter]);

  const handleQuickToggleSlot = async (slot: string) => {
    if (!firebaseUser || !caregiverProfile || togglingSlot) return;
    const exists = availability.includes(slot);
    if (exists && availability.length <= 1) {
      showToast('error', 'Keep at least one active availability slot enabled.');
      return;
    }
    const nextSlots = exists ? availability.filter((s) => s !== slot) : [...availability, slot];
    setTogglingSlot(true);
    try {
      setAvailability(nextSlots);
      await updateCaregiverQuickAvailability(firebaseUser.uid, nextSlots, isVerifiedCaregiver);
      showToast('success', `${exists ? 'Paused' : 'Enabled'} slot: ${slot}`);
    } catch (err) {
      setAvailability(caregiverProfile.availability);
      showToast('error', formatAppError(err, 'Could not update availability slot.'));
    } finally {
      setTogglingSlot(false);
    }
  };

  const handleCopyAddress = async (b: BookingRecord) => {
    const full = `${b.serviceAddress}, ${b.locality}`;
    try {
      await navigator.clipboard.writeText(full);
      showToast('success', `Address copied: ${full}`);
    } catch {
      showToast('error', 'Clipboard access unavailable on this browser.');
    }
  };

  const handleExportEarningsCsv = () => {
    const headers = ['Date', 'BookingID', 'Service', 'Pet', 'Status', 'GrossINR', 'PlatformFeeINR', 'NetPayoutINR'];
    const rows = filteredEarningsBookings.map((b) => [
      b.bookingDate,
      b.bookingId,
      b.serviceTitle,
      b.petName,
      b.status,
      b.grossAmount,
      b.platformCommission,
      b.caregiverPayout,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pawcare_caregiver_earnings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCaregiverBookingTransition = async (
    b: BookingRecord,
    nextStatus: 'accepted' | 'rejected' | 'confirmed' | 'in_progress' | 'completed'
  ) => {
    if (!isVerifiedCaregiver && nextStatus !== 'rejected') {
      showToast(
        'error',
        'Action blocked: Administrator verification is required before accepting or starting bookings.'
      );
      return;
    }
    try {
      await updateBookingStatus({
        booking: b,
        nextStatus,
        actorRole: 'caregiver',
      });
      showToast('success', `Booking ${b.bookingId} updated to ${nextStatus.replace('_', ' ')}.`);
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not update booking status.'));
    }
  };

  // If caregiver hasn't registered yet, render the complete onboarding application
  if (!caregiverProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
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
                minLength={2}
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
                maxLength={20}
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
                  Profile Portrait URL (Optional HTTPS link)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                    <ImageWithFallback
                      src={photoUrl.trim() || undefined}
                      alt={fullName || 'Caregiver portrait'}
                      fallbackLabel={fullName || 'Caregiver'}
                      variant="avatar"
                      seed={firebaseUser?.uid || fullName || 'caregiver'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://... (optional; monogram badge used if blank)"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  ID Document Reference Link (Optional, Admin-Only)
                </label>
                <input
                  type="url"
                  value={idDocUrl}
                  onChange={(e) => setIdDocUrl(e.target.value)}
                  placeholder="Optional Google Drive / secure link for admin review"
                  className="w-full px-3 py-2.5 text-xs bg-white border border-stone-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-6 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Submitting Application...' : 'Submit Caregiver Application for Verification'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {listenerError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm font-medium flex items-center justify-between gap-3"
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

      {/* Strict Verification Status Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isVerifiedCaregiver
            ? 'bg-teal-50 border-teal-200 text-teal-950'
            : caregiverProfile.verificationStatus === 'rejected' ||
              caregiverProfile.accountStatus === 'suspended'
            ? 'bg-red-50 border-red-200 text-red-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {isVerifiedCaregiver ? (
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-bold">
              {caregiverProfile.accountStatus === 'suspended'
                ? 'Account Suspended by Administration'
                : caregiverProfile.verificationStatus === 'verified'
                ? 'Verification Status: Approved & Verified'
                : caregiverProfile.verificationStatus === 'rejected'
                ? 'Verification Status: Application Rejected'
                : 'Pending Admin Verification'}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              {isVerifiedCaregiver
                ? 'Your profile is publicly listed and you can accept and manage pet care bookings.'
                : caregiverProfile.verificationStatus === 'rejected'
                ? `Admin note: ${caregiverProfile.adminNotes || 'Please update your documents and details before resubmitting.'}`
                : 'Your identity documents are under administrator review. Booking acceptance is locked until an admin approves your account.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-white border border-stone-200 text-stone-800 whitespace-nowrap shrink-0 cursor-pointer hover:bg-stone-50"
        >
          View Verification Details
        </button>
      </div>

      {/* Mobile Compact Identity + Sign Out Bar */}
      <div className="lg:hidden flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-violet-700">Caregiver Account</p>
          <p className="text-sm font-bold text-stone-900 truncate">
            {caregiverProfile.fullName}
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

      {/* Mobile Compact Nav */}
      <div className="lg:hidden overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl min-w-max">
          {(
            [
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'profile', label: 'My Profile', icon: UserCheck },
              { id: 'verification', label: 'Verification Status', icon: ShieldCheck },
              { id: 'requests', label: 'Requests', icon: Clock, badge: pendingRequests.length },
              { id: 'upcoming', label: 'Upcoming', icon: Calendar, badge: upcomingBookings.length },
              { id: 'accepted', label: 'Accepted', icon: Activity, badge: acceptedBookings.length },
              { id: 'completed', label: 'Completed', icon: CheckCircle2 },
              { id: 'rejected', label: 'Rejected', icon: XCircle },
              { id: 'earnings', label: 'Earnings', icon: IndianRupee },
              { id: 'instructions', label: 'Instructions', icon: ClipboardList },
              { id: 'reviews', label: 'Reviews', icon: Star },
              { id: 'availability', label: 'Availability', icon: Sliders },
              { id: 'help', label: 'Help & Support', icon: HelpCircle },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'bg-white text-violet-800 shadow-sm' : 'text-stone-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3">
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
                <p className="text-xs font-medium text-violet-700">Caregiver Account</p>
                <p className="font-display font-bold text-stone-900 truncate">
                  {caregiverProfile.fullName}
                </p>
                <p className="text-[11px] text-stone-500 truncate">{caregiverProfile.email}</p>
              </div>
            </div>

            <nav className="space-y-1" aria-label="Caregiver Dashboard Sections">
              {(
                [
                  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                  { id: 'profile', label: 'My Profile', icon: UserCheck },
                  { id: 'verification', label: 'Verification Status', icon: ShieldCheck },
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
                    id: 'accepted',
                    label: 'Accepted Bookings',
                    icon: Activity,
                    badge: acceptedBookings.length,
                  },
                  { id: 'completed', label: 'Completed Bookings', icon: CheckCircle2 },
                  { id: 'rejected', label: 'Rejected Bookings', icon: XCircle },
                  { id: 'earnings', label: 'Earnings', icon: IndianRupee },
                  {
                    id: 'instructions',
                    label: 'Customer Instructions',
                    icon: ClipboardList,
                    badge: instructionsBookings.length,
                  },
                  { id: 'reviews', label: 'Reviews', icon: Star },
                  { id: 'availability', label: 'Availability Settings', icon: Sliders },
                  { id: 'help', label: 'Help & Support', icon: HelpCircle },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl cursor-pointer transition-colors whitespace-nowrap ${
                      active ? 'text-white' : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="caregiver-sidebar-active"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 bg-violet-700 rounded-xl -z-0"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {'badge' in item && item.badge > 0 && (
                      <span className="relative z-10 font-mono-tabular text-xs font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-stone-100">
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

        <main className="lg:col-span-9 space-y-6">
          {/* Partner Duty & Quick Shift Bar */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-violet-700">
                  Partner Shift Control · {caregiverProfile.locality}
                </p>
                <p className="text-xs text-stone-600 font-mono-tabular">
                  Base Payout Rate: ₹{caregiverProfile.expectedCharge} ·{' '}
                  {availability.length} active slot(s) · {upcomingBookings.length} upcoming session(s)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl cursor-pointer font-mono-tabular"
                >
                  Requests ({pendingRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('earnings')}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer font-mono-tabular"
                >
                  Earned: ₹{totalPayoutEarned}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('help')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-violet-700" /> Help
                </button>
              </div>
            </div>

            <div className="pt-2.5 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-stone-500 mr-1">
                1-Tap Slots:
              </span>
              {AVAILABILITY_SLOTS.map((slot) => {
                const enabled = availability.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={togglingSlot}
                    onClick={() => handleQuickToggleSlot(slot)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-violet-700 border-violet-700 text-white'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {!isVerifiedCaregiver && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-2">
                  <h2 className="font-display text-lg font-bold text-amber-950">
                    Pending Approval — Limited Access Mode
                  </h2>
                  <p className="text-sm text-amber-900">
                    Until a PawCare administrator verifies your identity document (
                    {caregiverProfile.idDocType}), pet parents cannot see your profile in public
                    search and booking acceptance buttons remain disabled.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Pending Requests', value: pendingRequests.length, tab: 'requests' as CaregiverTab },
                  { label: 'Upcoming Sessions', value: upcomingBookings.length, tab: 'upcoming' as CaregiverTab },
                  { label: 'Completed', value: completedBookings.length, tab: 'completed' as CaregiverTab },
                  { label: 'Net Payout Earned', value: `₹${totalPayoutEarned}`, tab: 'earnings' as CaregiverTab },
                ].map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => setActiveTab(stat.tab)}
                    className="text-left bg-white border border-stone-200 hover:border-violet-300 rounded-2xl p-5 space-y-1 transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="font-display text-2xl font-bold text-stone-900 font-mono-tabular">
                      {stat.value}
                    </p>
                  </button>
                ))}
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Incoming Booking Requests
                  </h2>
                  {pendingRequests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('requests')}
                      className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      View all ({pendingRequests.length})
                    </button>
                  )}
                </div>
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
                              Customer: {b.customerName} · {b.bookingDate} (
                              {b.startTime && b.endTime
                                ? `${b.startTime}–${b.endTime}`
                                : b.timeSlot}
                              ) · {b.locality}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setReceiptBooking(b)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> Details
                          </button>
                          <button
                            type="button"
                            disabled={!isVerifiedCaregiver}
                            title={
                              isVerifiedCaregiver
                                ? 'Accept booking request'
                                : 'Admin verification required before accepting bookings'
                            }
                            onClick={() => handleCaregiverBookingTransition(b, 'accepted')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Accept (₹{b.caregiverPayout})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCaregiverBookingTransition(b, 'rejected')}
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

              {/* Active / Upcoming Care Queue */}
              {upcomingBookings.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold text-stone-900">
                      Upcoming & Live Care Queue ({upcomingBookings.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upcoming')}
                      className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      Open queue
                    </button>
                  </div>
                  <div className="space-y-3">
                    {upcomingBookings.slice(0, 3).map((b) => (
                      <div
                        key={b.bookingId}
                        className="border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-bold text-stone-900 truncate">
                            {b.serviceTitle} · {b.petName}
                          </p>
                          <p className="text-xs text-stone-500">
                            {b.bookingDate} ({b.startTime}–{b.endTime}) · {b.serviceAddress},{' '}
                            {b.locality}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(b)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Copy Address
                          </button>
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleCaregiverBookingTransition(b, 'in_progress')}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-lg cursor-pointer"
                            >
                              Start Session
                            </button>
                          )}
                          {b.status === 'in_progress' && (
                            <button
                              type="button"
                              onClick={() => handleCaregiverBookingTransition(b, 'completed')}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'requests' ||
            activeTab === 'upcoming' ||
            activeTab === 'accepted' ||
            activeTab === 'completed' ||
            activeTab === 'rejected') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-stone-900 capitalize">
                  {activeTab === 'requests'
                    ? 'Pending Booking Requests'
                    : activeTab === 'upcoming'
                    ? 'Upcoming Confirmed & Live Bookings'
                    : activeTab === 'accepted'
                    ? 'Accepted Bookings'
                    : activeTab === 'completed'
                    ? 'Completed Bookings'
                    : 'Rejected & Cancelled Bookings'}
                </h1>
                <div className="relative sm:w-64">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search pet, customer, area..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              {(() => {
                const baseList =
                  activeTab === 'requests'
                    ? pendingRequests
                    : activeTab === 'upcoming'
                    ? upcomingBookings
                    : activeTab === 'accepted'
                    ? acceptedBookings
                    : activeTab === 'completed'
                    ? completedBookings
                    : rejectedBookings;
                const q = bookingSearch.trim().toLowerCase();
                const visibleList = !q
                  ? baseList
                  : baseList.filter(
                      (b) =>
                        b.petName.toLowerCase().includes(q) ||
                        b.customerName.toLowerCase().includes(q) ||
                        b.locality.toLowerCase().includes(q) ||
                        b.serviceTitle.toLowerCase().includes(q) ||
                        b.bookingId.toLowerCase().includes(q)
                    );
                return visibleList.length === 0 ? (
                  <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-500">
                    {baseList.length === 0
                      ? 'No bookings in this category.'
                      : 'No bookings matched your search.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleList.map((b) => (
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
                                disabled={!isVerifiedCaregiver}
                                title={
                                  isVerifiedCaregiver
                                    ? 'Accept booking request'
                                    : 'Admin verification required before accepting bookings'
                                }
                                onClick={() => handleCaregiverBookingTransition(b, 'accepted')}
                                className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Accept Request
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCaregiverBookingTransition(b, 'rejected')}
                                className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-lg cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {b.status === 'accepted' && (
                            <button
                              type="button"
                              disabled={!isVerifiedCaregiver}
                              onClick={() => handleCaregiverBookingTransition(b, 'confirmed')}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Confirm Schedule
                            </button>
                          )}

                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              disabled={!isVerifiedCaregiver}
                              onClick={() => handleCaregiverBookingTransition(b, 'in_progress')}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-violet-700 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Start Care Session
                            </button>
                          )}

                          {b.status === 'in_progress' && (
                            <button
                              type="button"
                              disabled={!isVerifiedCaregiver}
                              onClick={() => handleCaregiverBookingTransition(b, 'completed')}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Mark Service Completed
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyAddress(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy Address
                          </button>

                          <button
                            type="button"
                            onClick={() => setReceiptBooking(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> Payout Slip
                          </button>

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
                );
              })()}
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

              {earningsChartData.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Monthly Payout Trend
                  </h2>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earningsChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="Earned" name="Earned (₹)" fill="#0F766E" radius={[6, 6, 0, 0]} />
                        <Bar
                          dataKey="Scheduled"
                          name="Scheduled (₹)"
                          fill="#6D28D9"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      Caregiver Earnings Breakdown
                    </h1>
                    <p className="text-sm text-stone-600">
                      Shows gross booking value vs. platform contribution vs. your net caregiver payout.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={earningsStatusFilter}
                      onChange={(e) =>
                        setEarningsStatusFilter(
                          e.target.value as 'all' | 'completed' | 'active' | 'cancelled'
                        )
                      }
                      className="px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                    >
                      <option value="all">All Bookings</option>
                      <option value="completed">Completed Only</option>
                      <option value="active">Scheduled / Active</option>
                      <option value="cancelled">Cancelled / Rejected</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleExportEarningsCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                  </div>
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
                        <th className="py-2.5 pr-4 text-right">Your Payout</th>
                        <th className="py-2.5 text-right">Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono-tabular text-xs">
                      {filteredEarningsBookings.map((b) => (
                        <tr key={b.bookingId}>
                          <td className="py-3 pr-4">{b.bookingDate}</td>
                          <td className="py-3 pr-4 font-sans">{b.serviceTitle}</td>
                          <td className="py-3 pr-4 font-sans capitalize">{b.status}</td>
                          <td className="py-3 pr-4 text-right">₹{b.grossAmount}</td>
                          <td className="py-3 pr-4 text-right text-stone-500">
                            ₹{b.platformCommission}
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-teal-800">
                            ₹{b.caregiverPayout}
                          </td>
                          <td className="py-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => setReceiptBooking(b)}
                              className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                            >
                              View
                            </button>
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
                    minLength={2}
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
                    minLength={8}
                    maxLength={20}
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
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-stone-700">
                    Profile Portrait (Optional HTTPS Image URL or Default Avatar)
                  </label>
                  {photoUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                    >
                      Reset to Monogram
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200 bg-white">
                    <ImageWithFallback
                      src={photoUrl.trim() || undefined}
                      alt={fullName || caregiverProfile.fullName}
                      fallbackLabel={fullName || caregiverProfile.fullName}
                      variant="avatar"
                      seed={caregiverProfile.caregiverId}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Paste direct HTTPS photo URL (https://...) or leave blank for initials badge"
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                    />
                    <p className="text-[11px] text-stone-500">
                      Binary uploads are disabled on the Spark ₹0 plan; direct HTTPS image URLs or verified initials badges keep hosting fast and free.
                    </p>
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

          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-stone-900">
                  Customer & Pet Care Instructions
                </h1>
                <p className="text-sm text-stone-600">
                  All feeding schedules, health disclosures, entry instructions, and addresses for active & upcoming bookings.
                </p>
              </div>
              {instructionsBookings.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-500">
                  No active or upcoming bookings with customer instructions right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {instructionsBookings.map((b) => (
                    <div
                      key={b.bookingId}
                      className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            {b.petName} ({b.petType}{b.petBreed ? ` · ${b.petBreed}` : ''}) —{' '}
                            {b.serviceTitle}
                          </h2>
                          <p className="text-xs text-stone-500">
                            Customer: {b.customerName} {b.customerPhone ? `(${b.customerPhone})` : ''} ·{' '}
                            {b.bookingDate} (
                            {b.startTime && b.endTime ? `${b.startTime}–${b.endTime}` : b.timeSlot})
                          </p>
                        </div>
                        <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 border border-violet-200 self-start sm:self-center">
                          {b.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs text-stone-700">
                        <p>
                          <span className="font-semibold text-stone-900">Service Address:</span>{' '}
                          {b.serviceAddress}, {b.locality}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">
                            Pet Feeding, Health & Behavior Notes:
                          </span>{' '}
                          {b.petInstructions || 'No additional pet notes provided.'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">
                            Customer Special Instructions:
                          </span>{' '}
                          {b.specialInstructions || 'No special entry or visit instructions provided.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <form
              onSubmit={handleSubmitProfile}
              className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5"
            >
              <div>
                <h1 className="font-display text-2xl font-bold text-stone-900">
                  Availability & Service Area Settings
                </h1>
                <p className="text-sm text-stone-600">
                  Update your Dehradun locality, active time slots, services offered, and expected session payout.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Primary Dehradun Locality
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
                    Expected Charge / Payout (₹)
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

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Active Time Slots
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

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Saving Availability...' : 'Save Availability Settings'}
              </button>
            </form>
          )}

          {activeTab === 'verification' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
              <h1 className="font-display text-2xl font-bold text-stone-900">
                Verification Status & Account Security
              </h1>
              <div
                className={`p-4 border rounded-xl text-xs space-y-1.5 ${
                  isVerifiedCaregiver
                    ? 'bg-teal-50 border-teal-200 text-teal-950'
                    : caregiverProfile.verificationStatus === 'rejected' ||
                      caregiverProfile.accountStatus === 'suspended'
                    ? 'bg-red-50 border-red-200 text-red-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <p className="font-semibold text-sm">
                  Current Status:{' '}
                  <span className="capitalize">{caregiverProfile.verificationStatus}</span> ·
                  Account: <span className="capitalize">{caregiverProfile.accountStatus}</span>
                </p>
                <p>
                  Submitted ID Document:{' '}
                  <span className="font-semibold">{caregiverProfile.idDocType}</span> · Reference:{' '}
                  <span className="font-mono-tabular">{caregiverProfile.idDocNumber}</span>
                </p>
                {caregiverProfile.adminNotes && (
                  <p>Admin Note: {caregiverProfile.adminNotes}</p>
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
            </div>
          )}
          {activeTab === 'help' && firebaseUser && (
            <SupportHelpPanel
              userId={firebaseUser.uid}
              userName={caregiverProfile.fullName || firebaseUser.displayName || 'Caregiver'}
              userEmail={caregiverProfile.email || firebaseUser.email || ''}
              userPhone={caregiverProfile.phone}
              roleLabel="caregiver"
              bookings={bookings}
              platformSettings={platformSettings}
              onToast={showToast}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BookingReceiptModal
        booking={receiptBooking}
        viewerRole="caregiver"
        onClose={() => setReceiptBooking(null)}
      />
    </div>
  );
}
