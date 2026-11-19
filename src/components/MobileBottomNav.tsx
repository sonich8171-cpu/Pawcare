import { Briefcase, Calendar, Gamepad2, Home, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function MobileBottomNav() {
  const location = useLocation();
  const { firebaseUser, effectiveRole } = useAuth();

  const dashboardHref =
    effectiveRole === 'admin'
      ? '/admin/dashboard'
      : effectiveRole === 'caregiver'
      ? '/caregiver/dashboard'
      : firebaseUser
      ? '/customer/dashboard'
      : '/login/customer';

  const bookingsHref =
    effectiveRole === 'caregiver'
      ? '/caregiver/dashboard'
      : effectiveRole === 'admin'
      ? '/admin/dashboard'
      : firebaseUser
      ? '/customer/dashboard/book'
      : '/login/customer';

  const items = [
    { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    { to: '/services', label: 'Services', icon: Briefcase, match: (p: string) => p.startsWith('/services') },
    { to: bookingsHref, label: 'Bookings', icon: Calendar, match: (p: string) => p.includes('/book') },
    { to: '/play', label: 'Play', icon: Gamepad2, match: (p: string) => p.startsWith('/play') || p.startsWith('/rewards') },
    {
      to: dashboardHref,
      label: firebaseUser ? 'Profile' : 'Sign In',
      icon: User,
      match: (p: string) =>
        p.startsWith('/customer') ||
        p.startsWith('/caregiver') ||
        p.startsWith('/admin') ||
        p.startsWith('/login'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-md border-t border-stone-200 px-2 py-1.5"
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(location.pathname);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                active ? 'text-emerald-900 bg-emerald-50' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-emerald-800' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
