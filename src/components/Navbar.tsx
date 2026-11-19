import { LogOut, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PawCareLogo } from './PawCareLogo';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/caregivers', label: 'Caregivers' },
  { to: '/play', label: 'Play Zone' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
] as const;

export function Navbar() {
  const { firebaseUser, effectiveRole, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const dashboardPath =
    effectiveRole === 'admin'
      ? '/admin/dashboard'
      : effectiveRole === 'caregiver'
      ? '/caregiver/dashboard'
      : '/customer/dashboard';

  const primaryLabel = !firebaseUser
    ? 'Customer Login'
    : effectiveRole === 'admin'
    ? 'Admin Dashboard'
    : effectiveRole === 'caregiver'
    ? 'Caregiver Dashboard'
    : 'Customer Dashboard';

  return (
    <header className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-200">
      <div className="bg-emerald-950 text-emerald-50 text-[11px] font-medium py-1.5 px-4 text-center">
        <span className="text-amber-300 font-semibold">Dehradun Launch</span> · Verified local pet
        care starting ₹500/session ·{' '}
        <Link to="/play" className="underline hover:text-amber-200 font-semibold">
          Play 4 Free Pet Mini-Games →
        </Link>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Link
          to="/"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-lg"
        >
          <PawCareLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `relative whitespace-nowrap shrink-0 text-sm font-medium transition-colors py-1 ${
                  isActive ? 'text-emerald-900 font-semibold' : 'text-stone-600 hover:text-stone-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="pawcare-nav-underline"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-emerald-800 rounded-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {!firebaseUser && (
            <>
              <Link
                to="/login/caregiver"
                className="hidden lg:inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Caregiver Portal
              </Link>
              <Link
                to="/login/admin"
                className="hidden sm:inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Admin Login
              </Link>
            </>
          )}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(firebaseUser ? dashboardPath : '/login/customer')}
            className={`hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer ${
              effectiveRole === 'admin'
                ? 'bg-emerald-950 hover:bg-emerald-900 focus-visible:ring-emerald-700'
                : 'bg-emerald-900 hover:bg-emerald-800 focus-visible:ring-emerald-700'
            }`}
          >
            {primaryLabel}
          </motion.button>

          {firebaseUser && (
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-red-700 hover:bg-red-50 border border-stone-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Sign out of PawCare"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center p-2.5 rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-2"
          >
            <div className="flex flex-col space-y-1">
              {[
                { to: '/', label: 'Home' },
                { to: '/services', label: 'Services' },
                { to: '/caregivers', label: 'Caregivers' },
                { to: '/play', label: 'Play Zone' },
                { to: '/about', label: 'About Us' },
                { to: '/contact', label: 'Contact' },
                ...(firebaseUser
                  ? [{ to: dashboardPath, label: primaryLabel }]
                  : [
                      { to: '/login/caregiver', label: 'Caregiver Login' },
                      { to: '/login/admin', label: 'Admin Login' },
                    ]),
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
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate(firebaseUser ? dashboardPath : '/login/customer');
                }}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl cursor-pointer"
              >
                {primaryLabel}
              </button>
              {firebaseUser && (
                <button
                  type="button"
                  onClick={async () => {
                    setMobileOpen(false);
                    await logout();
                    navigate('/');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
