import { MapPin, Search, ShieldCheck, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { usePublicData } from '../contexts/DataContext';
import { AVAILABILITY_SLOTS } from '../data/defaults';
import type { CaregiverPublicProfile } from '../types/pawcare';

export function CaregiversPage() {
  const { publicCaregivers, reviews, services, platformSettings } = usePublicData();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [localityFilter, setLocalityFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverPublicProfile | null>(null);
  const navigate = useNavigate();

  const getCaregiverReviews = (caregiverId: string) =>
    reviews.filter((r) => r.caregiverId === caregiverId);

  const filteredCaregivers = useMemo(() => {
    return publicCaregivers.filter((cg) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        cg.fullName.toLowerCase().includes(q) ||
        cg.locality.toLowerCase().includes(q) ||
        (cg.bio || '').toLowerCase().includes(q) ||
        cg.skills.some((s) => s.toLowerCase().includes(q));

      const matchesService =
        serviceFilter === 'all' || cg.servicesOffered.includes(serviceFilter);
      const matchesLocality = localityFilter === 'all' || cg.locality === localityFilter;
      const matchesAvailability =
        availabilityFilter === 'all' || cg.availability.includes(availabilityFilter);

      return matchesSearch && matchesService && matchesLocality && matchesAvailability;
    });
  }, [publicCaregivers, searchQuery, serviceFilter, localityFilter, availabilityFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-semibold text-teal-700">Dehradun Caregiver Directory</p>
          <h1 className="font-display text-4xl font-extrabold text-stone-900 tracking-tight">
            Verified Local Pet Caregivers
          </h1>
          <p className="text-sm sm:text-base text-stone-600">
            Search verified caregivers by Dehradun locality, service specialty, and time slot
            availability.
          </p>
        </div>
        <Link
          to="/caregiver"
          className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-xl whitespace-nowrap shrink-0 transition-colors"
        >
          Apply as a Caregiver
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, skill, or area..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          aria-label="Filter by service"
          className="w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="all">All Services</option>
          {services.map((s) => (
            <option key={s.serviceId} value={s.title}>
              {s.title}
            </option>
          ))}
        </select>

        <select
          value={localityFilter}
          onChange={(e) => setLocalityFilter(e.target.value)}
          aria-label="Filter by locality"
          className="w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="all">All Dehradun Localities</option>
          {platformSettings.localities.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
          aria-label="Filter by availability"
          className="w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="all">Any Time Availability</option>
          {AVAILABILITY_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>

      {/* Directory Grid */}
      {filteredCaregivers.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3">
          <h2 className="font-display text-xl font-bold text-stone-900">
            No Matching Verified Caregivers Found
          </h2>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            {publicCaregivers.length === 0
              ? 'Caregivers appear publicly here once their application and ID documents are approved by an administrator.'
              : 'Try clearing one of your locality, service, or time slot filters.'}
          </p>
          {(searchQuery || serviceFilter !== 'all' || localityFilter !== 'all' || availabilityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setServiceFilter('all');
                setLocalityFilter('all');
                setAvailabilityFilter('all');
              }}
              className="px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCaregivers.map((cg) => {
            const cgReviews = getCaregiverReviews(cg.caregiverId);
            const avg =
              cgReviews.length > 0
                ? (cgReviews.reduce((a, b) => a + b.rating, 0) / cgReviews.length).toFixed(1)
                : null;

            return (
              <div
                key={cg.caregiverId}
                className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                      <ImageWithFallback
                        src={cg.photoUrl}
                        alt={`${cg.fullName} profile photo`}
                        className="w-full h-full object-cover rounded-full"
                        variant="avatar"
                        seed={cg.caregiverId}
                        fallbackLabel={cg.fullName}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-display text-lg font-bold text-stone-900 truncate">
                        {cg.fullName}
                      </h2>
                      <p className="text-xs text-stone-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{cg.locality}</span>
                        <span aria-hidden="true">·</span>
                        <span>{cg.experienceYears} yrs exp</span>
                      </p>
                      <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Admin Verified</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-stone-600 line-clamp-2">
                    {cg.bio || `Experienced caregiver serving ${cg.locality}, Dehradun.`}
                  </p>

                  <div className="text-xs text-stone-600 space-y-1">
                    <p>
                      <span className="font-semibold text-stone-800">Services:</span>{' '}
                      {cg.servicesOffered.join(' · ')}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-800">Slots:</span>{' '}
                      {cg.availability.slice(0, 2).join(', ')}
                      {cg.availability.length > 2 ? ` +${cg.availability.length - 2} more` : ''}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="inline-flex items-center gap-1 font-semibold text-stone-900">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-mono-tabular">
                        {avg ? `${avg} (${cgReviews.length})` : 'New'}
                      </span>
                    </span>
                    <span className="text-xs text-stone-500 block font-mono-tabular">
                      Expected ₹{cg.expectedCharge}/session
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCaregiver(cg)}
                      className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/book?caregiver=${cg.caregiverId}`)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Caregiver Detail Modal */}
      {selectedCaregiver && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                  <ImageWithFallback
                    src={selectedCaregiver.photoUrl}
                    alt={`${selectedCaregiver.fullName} profile photo`}
                    className="w-full h-full object-cover rounded-full"
                    variant="avatar"
                    seed={selectedCaregiver.caregiverId}
                    fallbackLabel={selectedCaregiver.fullName}
                  />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-stone-900">
                    {selectedCaregiver.fullName}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {selectedCaregiver.locality} · {selectedCaregiver.experienceYears} years
                    experience
                  </p>
                  <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified by PawCare Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCaregiver(null)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="Close caregiver profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-stone-700 leading-relaxed">
                {selectedCaregiver.bio || 'Dedicated Dehradun pet caregiver.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div>
                  <p className="font-semibold text-stone-900 mb-1">Services Offered</p>
                  <p className="text-stone-600">{selectedCaregiver.servicesOffered.join(', ')}</p>
                </div>
                <div>
                  <p className="font-semibold text-stone-900 mb-1">Skills</p>
                  <p className="text-stone-600">
                    {selectedCaregiver.skills.length > 0
                      ? selectedCaregiver.skills.join(', ')
                      : 'General Pet Handling'}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-stone-900 mb-1">Available Time Slots</p>
                <p className="text-stone-600">{selectedCaregiver.availability.join(' · ')}</p>
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-3">
                <p className="font-semibold text-stone-900">
                  Verified Reviews ({getCaregiverReviews(selectedCaregiver.caregiverId).length})
                </p>
                {getCaregiverReviews(selectedCaregiver.caregiverId).length === 0 ? (
                  <p className="text-xs text-stone-500">No reviews submitted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {getCaregiverReviews(selectedCaregiver.caregiverId).map((rev) => (
                      <div key={rev.reviewId} className="bg-stone-50 rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-900">{rev.customerName}</span>
                          <span className="text-amber-600 font-mono-tabular">
                            {rev.rating} / 5
                          </span>
                        </div>
                        <p className="text-xs text-stone-600">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedCaregiver(null)}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`/dashboard/book?caregiver=${selectedCaregiver.caregiverId}`)
                }
                className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
              >
                Book With {selectedCaregiver.fullName.split(' ')[0]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
