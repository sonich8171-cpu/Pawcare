import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { PawCareLogo } from '../components/PawCareLogo';
import { useAuth } from '../contexts/AuthContext';
import { BRAND_ASSETS } from '../data/defaults';
import { formatFirebaseAuthError } from '../lib/authErrors';

type AuthMode = 'login' | 'register' | 'reset';

export function CustomerAuthPage({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const {
    firebaseUser,
    authLoading,
    effectiveRole,
    isEmailVerified,
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string } | null)?.from;
  const safeTarget =
    rawFrom && rawFrom.startsWith('/customer') ? rawFrom : '/customer/dashboard';

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setInfoMsg('');
  }, [initialMode]);

  useEffect(() => {
    if (!authLoading && firebaseUser && isEmailVerified && effectiveRole === 'customer') {
      navigate(safeTarget, { replace: true });
    }
  }, [authLoading, firebaseUser, isEmailVerified, effectiveRole, navigate, safeTarget]);

  const handleGoogleSignIn = async () => {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithGoogle('customer');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password, 'customer');
      } else if (mode === 'register') {
        if (name.trim().length < 2) {
          setError('Please enter your full name (at least 2 characters).');
          setLoading(false);
          return;
        }
        await registerWithEmail(name, email, password, 'customer');
        setInfoMsg(
          'Customer account created! A verification link has been sent to your email. Click it and press "I Have Verified My Email" below.'
        );
      } else {
        await resetPassword(email);
        setInfoMsg('Password reset link sent. Please check your inbox.');
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[84vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl bg-white border border-stone-200 rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm"
      >
        <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[600px] bg-stone-900 overflow-hidden">
          <ImageWithFallback
            src={BRAND_ASSETS.heroPetcareImg}
            alt="Happy dog with PawCare Dehradun caregiver outdoors"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-stone-950/20"
            aria-hidden="true"
          />
          <div className="relative z-10 h-full flex flex-col justify-between p-7 sm:p-9 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-teal-200">
                Customer Portal · Dehradun
              </span>
              <span className="text-xs font-medium text-stone-200">Pet Parents</span>
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight text-balance">
                Your pets, schedules, and verified local caregivers in one place.
              </h2>
              <p className="text-sm text-stone-200 leading-relaxed max-w-md">
                Create pet care profiles, browse background-verified Dehradun caregivers, lock
                slots without double-bookings, and track sessions live.
              </p>

              <div className="pt-3 border-t border-white/15 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">Verified Sign-In</p>
                    <p className="text-stone-300">Google & Email/Password</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">Atomic Slot Locking</p>
                    <p className="text-stone-300">Zero double bookings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-5">
          <div className="space-y-2">
            <PawCareLogo />
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-900 pt-2">
              {mode === 'login'
                ? 'Customer Sign In'
                : mode === 'register'
                ? 'Create Customer Account'
                : 'Reset Customer Password'}
            </h1>
            <p className="text-sm text-stone-600">
              Pet parent access for booking verified Dehradun pet care services.
            </p>
          </div>

          {/* Non-customer mismatch banner */}
          {firebaseUser && isEmailVerified && effectiveRole && effectiveRole !== 'customer' && (
            <div className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <p>
                Signed in as <strong>{firebaseUser.email}</strong> (role:{' '}
                <strong className="capitalize">{effectiveRole}</strong>). Customer Login is
                restricted to customer accounts.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={effectiveRole === 'admin' ? '/admin/dashboard' : '/caregiver/dashboard'}
                  className="px-3 py-1.5 font-semibold text-white bg-teal-700 rounded-lg"
                >
                  Go to {effectiveRole === 'admin' ? 'Admin' : 'Caregiver'} Dashboard
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-200 rounded-lg cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Unverified email check box */}
          {firebaseUser && !isEmailVerified && (
            <div className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <MailCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Email Verification Pending</p>
                  <p className="mt-0.5">
                    Verify <strong>{firebaseUser.email}</strong> via the link sent to your inbox.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={checkingVerify}
                  onClick={async () => {
                    setCheckingVerify(true);
                    setError('');
                    try {
                      const ok = await refreshAuthUser();
                      if (!ok) setError('Still not verified. Check your inbox and click the link.');
                    } catch (err) {
                      setError(formatFirebaseAuthError(err));
                    } finally {
                      setCheckingVerify(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {checkingVerify ? 'Checking...' : 'I Have Verified My Email'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    try {
                      await resendVerificationEmail();
                      setInfoMsg('Verification email resent.');
                    } catch (err) {
                      setError(formatFirebaseAuthError(err));
                    }
                  }}
                  className="px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-200 rounded-lg cursor-pointer"
                >
                  Resend Link
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 font-medium text-stone-600 underline cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3.5 leading-relaxed">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-xl p-3.5 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-xl text-xs font-semibold">
            {(
              [
                { id: 'login', label: 'Sign In', path: '/login/customer' },
                { id: 'register', label: 'Register', path: '/register/customer' },
                { id: 'reset', label: 'Forgot Password', path: null },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setError('');
                  setInfoMsg('');
                  if (tab.path) navigate(tab.path, { replace: true });
                }}
                className={`py-2 rounded-lg transition-colors cursor-pointer ${
                  mode === tab.id ? 'bg-white text-teal-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Riya Sharma"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In as Customer'
                  : mode === 'register'
                  ? 'Register Customer Account'
                  : 'Send Reset Email'}
              </span>
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-stone-200" />
            <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Or instant Gmail login
            </span>
            <div className="flex-grow border-t border-stone-200" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 text-sm font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Continue with Google (Customer)</span>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </button>

          <p className="text-xs text-stone-500 text-center pt-1">
            Want to work as a pet caregiver?{' '}
            <Link to="/register/caregiver" className="font-semibold text-violet-700 hover:underline">
              Caregiver Registration →
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
