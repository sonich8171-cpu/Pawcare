import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PawCareLogo } from './PawCareLogo';

export function Navbar() {
  const { firebaseUser, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors pb-0.5 border-b-2 ${
      isActive
        ? 'text-teal-700 border-teal-700'
        : 'text-stone-600 border-transparent hover:text-stone-900 hover:border-stone-300'
    }`;

  const dashboardPath = isAdmin ? '/admin' : '/dashboard';
  const primaryLabel = firebaseUser ? (isAdmin ? 'Admin Console' : 'Dashboard') : 'Sign In';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <Link to="/" className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg">
          <PawCareLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/services" className={navLinkClass}>
            Services
          </NavLink>
          <NavLink to="/caregivers" className={navLinkClass}>
            Caregivers
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About Us
          </NavLink>
          <NavLink to="/contact" className={navLinkClass}>
            Contact
          </NavLink>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate(firebaseUser ? dashboardPath : '/auth')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 cursor-pointer"
          >
            {primaryLabel}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center p-2.5 rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-2">
          <div className="flex flex-col space-y-1">
            {[
              { to: '/', label: 'Home' },
              { to: '/services', label: 'Services' },
              { to: '/caregivers', label: 'Caregivers' },
              { to: '/about', label: 'About Us' },
              { to: '/contact', label: 'Contact' },
              ...(firebaseUser
                ? [
                    { to: '/dashboard', label: 'Customer Dashboard' },
                    { to: '/caregiver', label: 'Caregiver Panel' },
                    ...(isAdmin ? [{ to: '/admin', label: 'Admin Console' }] : []),
                  ]
                : []),
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate(firebaseUser ? dashboardPath : '/auth');
              }}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
