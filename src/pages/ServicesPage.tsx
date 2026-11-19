import { ArrowRight, Clock, IndianRupee } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { usePublicData } from '../contexts/DataContext';
import { resolveServiceImage } from '../data/defaults';

export function ServicesPage() {
  const { services } = usePublicData();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-semibold text-teal-700">Dehradun Service Catalog</p>
        <h1 className="font-display text-4xl font-extrabold text-stone-900 tracking-tight text-balance">
          Practical, Transparent Pet Care Sessions.
        </h1>
        <p className="text-base text-stone-600 leading-relaxed">
          Every PawCare service includes caregiver check-in notifications, strict adherence to your
          pet&apos;s feeding and behavioral notes, and straightforward pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
        {services.map((service, idx) => (
          <motion.div
            key={service.serviceId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:border-teal-300 hover:shadow-sm"
          >
            <div>
              <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                <ImageWithFallback
                  src={resolveServiceImage(service)}
                  alt={`${service.title} pet care service in Dehradun`}
                  className="w-full h-full object-cover"
                  fallbackLabel={service.title}
                  hoverZoom
                />
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-stone-500">
                  <span className="inline-flex items-center gap-1 text-stone-700">
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    {service.durationLabel}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-mono-tabular text-sm font-bold text-stone-900">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {service.basePrice}
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold text-stone-900">{service.title}</h2>
                <p className="text-sm text-stone-600 leading-relaxed">{service.description}</p>

                <div className="pt-2 border-t border-stone-100 text-xs text-stone-500 flex items-center justify-between">
                  <span>Caregiver Payout: ₹{service.providerPayout}</span>
                  <span>Platform Fee: ₹{service.platformCommission}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => navigate(`/customer/dashboard/book?service=${service.serviceId}`)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
              >
                Book {service.title}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-stone-500">
        Note: Listed ₹500 session value (₹300 caregiver payout / ₹200 platform contribution) reflects
        PawCare&apos;s initial Dehradun launch assumptions and may be updated by administrators as
        marketplace pricing matures.
      </p>
    </div>
  );
}
