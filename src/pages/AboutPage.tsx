import { AlertTriangle, HeartHandshake, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { usePublicData } from '../contexts/DataContext';
import { BRAND_ASSETS } from '../data/defaults';

export function AboutPage() {
  const { platformSettings } = usePublicData();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-7 space-y-5 flex flex-col justify-center">
          <p className="text-sm font-semibold text-teal-700">About PawCare · Dehradun</p>
          <h1 className="font-display text-4xl font-extrabold text-stone-900 tracking-tight text-balance">
            Built for Dehradun&apos;s Pet Parents, Students, and Working Families.
          </h1>
          <p className="text-base text-stone-600 leading-relaxed">
            PawCare began through the DGU Venture Quest initiative after recognizing a clear gap in
            Dehradun: pet owners who work full-time, attend university classes, or travel briefly
            often struggle to find dependable, affordable, and accountable local care.
          </p>
          <p className="text-base text-stone-600 leading-relaxed">
            Rather than relying on unverified word-of-mouth chats, PawCare brings pet profiles,
            caregiver identity verification, structured booking schedules, and transparent
            pricing into one calm platform.
          </p>
        </div>
        <div className="lg:col-span-5">
          <div className="h-full min-h-[280px] rounded-2xl overflow-hidden border border-stone-200">
            <ImageWithFallback
              src={BRAND_ASSETS.aboutStoryImg}
              alt="Two verified Dehradun PawCare caregivers relaxing on a foothill veranda with a Beagle and a Labrador"
              className="w-full h-full object-cover"
              fallbackLabel="PawCare Dehradun Story"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
          <HeartHandshake className="w-6 h-6 text-teal-700" />
          <h2 className="font-display text-2xl font-bold text-stone-900">Our Mission</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            PawCare helps busy pet owners find trusted caregivers for their pets when they are
            working, studying, travelling, or away from home — keeping care affordable, convenient,
            and transparent.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-7 space-y-3">
          <ShieldCheck className="w-6 h-6 text-violet-700" />
          <h2 className="font-display text-2xl font-bold text-stone-900">Our Vision</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            To become Dehradun&apos;s most trusted neighborhood pet care network, creating dignified
            flexible income for verified local caregivers while giving pet owners genuine peace of
            mind.
          </p>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-stone-900">
            Trust & Safety Commitment
          </h2>
          <p className="text-sm text-stone-600">
            Every workflow inside PawCare is built around verifiable records and clear boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-1.5">
            <p className="font-semibold text-stone-900">Manual Admin Verification</p>
            <p className="text-stone-600 leading-relaxed">
              Caregiver applications remain unbookable until administrators verify government or
              student ID details and local residential records.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-stone-900">Emergency Contact Preparedness</p>
            <p className="text-stone-600 leading-relaxed">
              Pet parents store secondary emergency contacts, dietary notes, and behavioral quirks
              directly on pet profiles.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-stone-900">Transparent Service Ledger</p>
            <p className="text-stone-600 leading-relaxed">
              Every booking separates gross session fee, caregiver payout, and platform commission
              clearly with cancellation and dispute support.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            <span className="font-semibold">Non-Veterinary Scope Notice:</span> PawCare offers
            non-medical daily care (sitting, walking, feeding, basic hygiene). We are not a
            veterinary clinic or emergency medical provider.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-teal-700" />
          <h2 className="font-display text-2xl font-bold text-stone-900">
            Active Dehradun Launch Localities
          </h2>
        </div>
        <p className="text-sm text-stone-600">
          Residential neighborhoods, student corridors, and professional hubs currently supported:
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-700">
          {platformSettings.localities.map((loc, idx) => (
            <span key={loc} className="inline-flex items-center gap-2">
              <span>{loc}</span>
              {idx < platformSettings.localities.length - 1 && (
                <span className="text-stone-300" aria-hidden="true">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="pt-4">
          <Link
            to="/caregivers"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors"
          >
            Explore Verified Caregivers
          </Link>
        </div>
      </section>
    </div>
  );
}
