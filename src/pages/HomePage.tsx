import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Gamepad2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { usePublicData } from '../contexts/DataContext';
import { BRAND_ASSETS, resolveServiceImage } from '../data/defaults';

export function HomePage() {
  const { services, publicCaregivers, reviews, platformSettings } = usePublicData();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');
  const faqs = platformSettings.faqs || [];
  const testimonials = platformSettings.testimonials || [];

  const getCaregiverRating = (caregiverId: string) => {
    const cgReviews = reviews.filter((r) => r.caregiverId === caregiverId);
    if (cgReviews.length === 0) return { avg: 0, count: 0 };
    const sum = cgReviews.reduce((acc, r) => acc + r.rating, 0);
    return { avg: Number((sum / cgReviews.length).toFixed(1)), count: cgReviews.length };
  };

  return (
    <div className="space-y-24 pb-12">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 lg:pt-14">
        {platformSettings.heroBannerNotice && (
          <p className="text-xs font-medium text-emerald-900 mb-5 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
            <span>{platformSettings.heroBannerNotice}</span>
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-emerald-800 tracking-tight">
                Dehradun Pet Care Marketplace · Your Pet&apos;s Happiness, Our Priority
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-stone-900 tracking-tight leading-[1.12] text-balance">
                Trusted Pet Care, Whenever You Need It.
              </h1>
              <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">
                PawCare connects busy pet parents, college students, and families across Dehradun
                with verified local caregivers for reliable pet sitting, dog walking, feeding, and
                daily care.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate('/customer/dashboard/book')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Book a Service
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/caregivers"
                className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Explore Caregivers
              </Link>
              <Link
                to="/play"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-emerald-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Gamepad2 className="w-4 h-4" /> Play Zone
              </Link>
            </div>

            <div className="pt-4 border-t border-stone-200 grid grid-cols-3 gap-4 text-xs sm:text-sm">
              <div>
                <p className="font-semibold text-stone-900">ID-Checked</p>
                <p className="text-stone-500">Admin-approved caregivers</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 font-mono-tabular">₹500 / session</p>
                <p className="text-stone-500">Transparent initial pricing</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Local Dehradun</p>
                <p className="text-stone-500">{platformSettings.localities.length}+ areas covered</p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="group h-full min-h-[300px] lg:min-h-[440px] rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-sm">
              <ImageWithFallback
                src={BRAND_ASSETS.heroPetcareImg}
                alt="Caregiver walking a happy Golden Retriever on a sunlit residential avenue in Dehradun"
                className="w-full h-full object-cover"
                fallbackLabel="PawCare Dehradun"
                loading="eager"
                hoverZoom
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
              Core Pet Care Services
            </h2>
            <p className="text-stone-600 max-w-2xl">
              Affordable, scheduled care sessions designed around college timetables, office hours,
              and weekend travel in Dehradun.
            </p>
          </div>
          <Link
            to="/services"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            View all services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {services.slice(0, 5).map((service, idx) => (
            <motion.div
              key={service.serviceId}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:border-teal-300 hover:shadow-sm"
            >
              <div>
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                  <ImageWithFallback
                    src={resolveServiceImage(service)}
                    alt={`${service.title} service in Dehradun`}
                    className="w-full h-full object-cover"
                    fallbackLabel={service.title}
                    hoverZoom
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="text-xs font-medium text-stone-500 flex items-center gap-1.5">
                    <span className="font-mono-tabular text-teal-700 font-semibold">
                      ₹{service.basePrice}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{service.durationLabel}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-stone-900">{service.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                    {service.description}
                  </p>
                </div>
              </div>
              <div className="px-4 pb-4 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/customer/dashboard/book?service=${service.serviceId}`)}
                  className="w-full py-2 px-3 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Book {service.title}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How PawCare Works */}
      <section className="bg-white border-y border-stone-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
              How PawCare Works
            </h2>
            <p className="text-stone-600">
              A transparent, four-step booking workflow built to protect both pets and caregivers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                num: '01.',
                title: 'Create Your Pet Profile',
                desc: 'Save feeding schedules, health notes, behavioral habits, and emergency contact details once.',
              },
              {
                num: '02.',
                title: 'Pick a Verified Caregiver',
                desc: 'Browse admin-approved caregivers in your Dehradun locality with real experience and ratings.',
              },
              {
                num: '03.',
                title: 'Confirm Slot & Instructions',
                desc: 'Atomic slot locking prevents overlapping bookings. Review exact session pricing before submitting.',
              },
              {
                num: '04.',
                title: 'Care Session & Review',
                desc: 'Caregiver accepts and updates live status. Rate your experience once the session completes.',
              },
            ].map((step) => (
              <div key={step.num} className="space-y-3">
                <p className="font-mono-tabular text-sm font-semibold text-violet-700">{step.num}</p>
                <h3 className="font-display text-lg font-bold text-stone-900">{step.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Why Choose PawCare */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5">
            <div className="group h-full min-h-[300px] rounded-2xl overflow-hidden border border-stone-200">
              <ImageWithFallback
                src={BRAND_ASSETS.trustCaregiverImg}
                alt="Verified PawCare caregiver gently greeting a Beagle indoors"
                className="w-full h-full object-cover"
                fallbackLabel="Trust & Safety"
                hoverZoom
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
                Why Dehradun Pet Parents Choose PawCare
              </h2>
              <p className="text-stone-600">
                Built around safety, clear accountability, and realistic local pricing instead of
                unverified informal referrals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  title: 'Admin-Reviewed Verification',
                  desc: 'Caregivers never appear in public search until identity documents and local address are reviewed.',
                },
                {
                  title: 'Zero Overlapping Bookings',
                  desc: 'Firestore slot-locking transactions ensure a caregiver cannot be double-booked for the same time.',
                },
                {
                  title: 'Detailed Care Handoffs',
                  desc: 'Feeding portions, leash triggers, and special instructions travel automatically with every booking.',
                },
                {
                  title: 'Clear Non-Medical Scope',
                  desc: 'Honest focus on sitting, walking, and feeding — never misrepresenting non-vet care as medical treatment.',
                },
              ].map((item) => (
                <div key={item.title} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Verified Caregivers Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
              Verified Caregivers in Dehradun
            </h2>
            <p className="text-stone-600">
              Only profiles approved by PawCare administrators are listed for booking.
            </p>
          </div>
          <Link
            to="/caregivers"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            Browse directory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {publicCaregivers.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h3 className="font-display text-xl font-bold text-stone-900">
                Currently Onboarding Local Caregivers in Dehradun
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Caregiver profiles appear here only after submitting identity documentation and
                receiving administrator approval. Are you an experienced pet lover in Dehradun?
              </p>
            </div>
            <Link
              to="/register/caregiver"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl whitespace-nowrap shrink-0 transition-colors"
            >
              Apply as a Caregiver
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {publicCaregivers.slice(0, 3).map((cg) => {
              const rating = getCaregiverRating(cg.caregiverId);
              return (
                <div
                  key={cg.caregiverId}
                  className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                        <ImageWithFallback
                          src={cg.photoUrl}
                          alt={`${cg.fullName} profile photo`}
                          className="w-full h-full object-cover rounded-full"
                          variant="avatar"
                          seed={cg.caregiverId}
                          fallbackLabel={cg.fullName}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-stone-900 truncate">
                          {cg.fullName}
                        </h3>
                        <p className="text-xs text-stone-500 flex items-center gap-1.5">
                          <span>{cg.locality}</span>
                          <span aria-hidden="true">·</span>
                          <span>{cg.experienceYears} yrs exp</span>
                        </p>
                        <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified Caregiver
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-stone-600 line-clamp-2">
                      {cg.bio || `Available for ${cg.servicesOffered.join(', ')} in ${cg.locality}.`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1 text-stone-700 font-medium">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-mono-tabular">
                        {rating.count > 0 ? `${rating.avg} (${rating.count})` : 'New'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/customer/dashboard/book?caregiver=${cg.caregiverId}`)}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      Book Session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 mb-8">
            <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
              Early Community Feedback
            </h2>
            <p className="text-stone-600">
              Reflections from Dehradun students, engineers, and families shaping PawCare.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-500" />
                  ))}
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="pt-2 border-t border-stone-100 text-xs">
                  <p className="font-semibold text-stone-900">{t.name}</p>
                  <p className="text-stone-500">
                    {t.role} · {t.locality}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Play Zone Highlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4" /> PawCare Play Zone · 4 Free Games
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold">
              Relax with Paw Runner, Memory Match, Treat Catcher &amp; Pet Rescue
            </h2>
            <p className="text-sm text-emerald-100 leading-relaxed">
              Play anytime in your browser, collect Paw Points, and unlock 6 entertainment badges
              synced to your customer profile at ₹0 cost.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/play"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-sm font-bold transition-colors"
            >
              <Gamepad2 className="w-4 h-4" /> Enter Play Zone
            </Link>
            <Link
              to="/rewards"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-semibold transition-colors"
            >
              View Badges
            </Link>
          </div>
        </div>
      </section>

      {/* FAQs & Contact Band */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between gap-4 text-left font-semibold text-stone-900 cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-2.5 text-sm text-stone-600 leading-relaxed overflow-hidden"
                      >
                        {faq.answer}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-emerald-950 text-white rounded-2xl p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-amber-300">Dehradun Care Desk</p>
            <h3 className="font-display text-2xl font-bold tracking-tight">
              Need help matching a caregiver or scheduling regular walks?
            </h3>
            <p className="text-sm text-emerald-100 leading-relaxed">
              Reach our local team directly on WhatsApp or open a live support message from the
              widget below.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                'Hello PawCare Dehradun, I would like to inquire about booking pet care.'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-emerald-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on WhatsApp
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white border border-white/20 hover:bg-white/10 rounded-xl transition-colors"
            >
              Contact Form
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
