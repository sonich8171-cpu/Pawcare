import { Link } from 'react-router-dom';
import { usePublicData } from '../contexts/DataContext';
import { PawCareLogo } from './PawCareLogo';

export function Footer() {
  const { platformSettings } = usePublicData();
  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');

  return (
    <footer className="bg-white border-t border-stone-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1 space-y-4">
            <PawCareLogo />
            <p className="text-sm text-stone-600 leading-relaxed">
              Your Pet&apos;s Happiness, Our Priority. Connecting pet parents in Dehradun with
              local, vetted caregivers for sitting, walking, feeding, and basic daily care.
            </p>
            <p className="text-xs text-stone-500">
              Launch City: Dehradun, Uttarakhand, India
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Marketplace</h3>
            <ul className="space-y-2.5 text-sm text-stone-600">
              <li>
                <Link to="/services" className="hover:text-teal-700 transition-colors">
                  Pet Care Services
                </Link>
              </li>
              <li>
                <Link to="/caregivers" className="hover:text-teal-700 transition-colors">
                  Verified Caregivers
                </Link>
              </li>
              <li>
                <Link to="/dashboard/book" className="hover:text-teal-700 transition-colors">
                  Book a Session
                </Link>
              </li>
              <li>
                <Link to="/caregiver" className="hover:text-teal-700 transition-colors">
                  Become a Caregiver
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Trust & Policies</h3>
            <ul className="space-y-2.5 text-sm text-stone-600">
              <li>
                <Link to="/about" className="hover:text-teal-700 transition-colors">
                  Our Story & Safety
                </Link>
              </li>
              <li>
                <Link to="/legal#cancellation" className="hover:text-teal-700 transition-colors">
                  Cancellation Policy
                </Link>
              </li>
              <li>
                <Link to="/legal#privacy" className="hover:text-teal-700 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/legal#terms" className="hover:text-teal-700 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Dehradun Support</h3>
            <ul className="space-y-2.5 text-sm text-stone-600">
              <li>{platformSettings.supportEmail || 'care@pawcaredehradun.in'}</li>
              <li>
                <a
                  href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                    'Hello PawCare Dehradun team, I have a question about pet care.'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-700 font-medium hover:underline"
                >
                  WhatsApp Care Desk
                </a>
              </li>
              <li>
                <Link to="/contact" className="hover:text-teal-700 transition-colors">
                  Submit Support Inquiry
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500">
          <p>
            © {new Date().getFullYear()} PawCare Dehradun. Non-medical pet care marketplace — not a
            veterinary or emergency medical clinic.
          </p>
          <p>Built for Dehradun pet parents, students, and families.</p>
        </div>
      </div>
    </footer>
  );
}
