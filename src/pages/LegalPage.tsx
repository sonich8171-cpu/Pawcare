import { usePublicData } from '../contexts/DataContext';

export function LegalPage() {
  const { platformSettings } = usePublicData();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">Trust, Policies & Safety</p>
        <h1 className="font-display text-4xl font-extrabold text-stone-900 tracking-tight">
          {platformSettings.platformName || 'PawCare'} Policies & Legal Commitments
        </h1>
      </div>

      <section id="booking" className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
        <h2 className="font-display text-xl font-bold text-stone-900">Booking Policy</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          {platformSettings.bookingPolicy ||
            'Bookings require a verified email address, an active pet profile with feeding and health disclosures, and an administrator-approved Dehradun caregiver. Slot locks prevent overlapping bookings.'}
        </p>
      </section>

      <section id="cancellation" className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
        <h2 className="font-display text-xl font-bold text-stone-900">Cancellation Policy</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          {platformSettings.cancellationPolicy ||
            'Customers may cancel pending, accepted, or confirmed bookings directly from their dashboard before the scheduled care session starts. Cancelled slots are immediately released on the caregiver schedule. Any test-verified or advance payments are marked for refund processing by PawCare administrators.'}
        </p>
      </section>

      <section id="privacy" className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
        <h2 className="font-display text-xl font-bold text-stone-900">Privacy Policy</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          Personal contact information (phone numbers, residential addresses, emergency contacts, and
          caregiver ID verification documents) is isolated in protected Firestore documents
          accessible strictly to the account owner and authorized PawCare administrators. Public
          caregiver directory listings omit private contact details and government ID numbers.
        </p>
      </section>

      <section id="terms" className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
        <h2 className="font-display text-xl font-bold text-stone-900">
          Terms & Conditions & Non-Veterinary Disclaimer
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          PawCare operates exclusively as a non-medical pet care marketplace connecting Dehradun
          pet owners with verified caregivers for sitting, walking, feeding, and basic daily care.
          PawCare does not provide veterinary diagnosis, prescriptions, or emergency medical
          services. Pet owners are responsible for providing accurate health disclosures and
          emergency contacts prior to every booking.
        </p>
      </section>
    </div>
  );
}
