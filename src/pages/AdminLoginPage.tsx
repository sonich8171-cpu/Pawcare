import { ArrowRight, CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { PawCareLogo } from '../components/PawCareLogo';
import { useAuth } from '../contexts/AuthContext';
import { BRAND_ASSETS } from '../data/defaults';
import { formatFirebaseAuthError } from '../lib/authErrors';

export function AdminLoginPage() {
  const {
    firebaseUser,
    authLoading,
    isAdmin,
    effectiveRole,
    loginWithEmail,
    signInAdminWithGoogle,
    resetPassword,
    logout,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && firebaseUser && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authLoading, firebaseUser, isAdmin, navigate]);

  const handleEmailAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (showReset) {
        await resetPassword(email);
        setInfoMsg('Admin password reset instructions sent if this address exists.');
      } else {
        await loginWithEmail(email, password, 'admin');
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInAdminWithGoogle();
      navigate('/admin/dashboard', { replace: true });
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
        {/* Left Visual Showcase */}
        <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[580px] bg-stone-900 overflow-hidden">
          <ImageWithFallback
            src={BRAND_ASSETS.trustCaregiverImg}
            alt="PawCare Dehradun Administrator Trust & Operations"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-stone-950/92 via-stone-950/55 to-stone-950/25"
            aria-hidden="true"
          />
          <div className="relative z-10 h-full flex flex-col justify-between p-7 sm:p-9 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-violet-200">
                Restricted Operations Console
              </span>
              <span className="text-xs font-medium text-stone-300">Admin Access Only</span>
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight text-balance">
                Command operations, caregiver verification, and marketplace finances.
              </h2>
              <p className="text-sm text-stone-200 leading-relaxed max-w-md">
                Authorized PawCare administrators manage caregiver approvals, booking disputes,
                commission splits, reviews moderation, and platform configuration.
              </p>

              <div className="pt-3 border-t border-white/15 flex items-start gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Strict Role Isolation</p>
                  <p className="text-stone-300">
                    Public registration is disabled. Only verified accounts listed in Firebase
                    admins registry can enter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Admin Login Form */}
        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-5">
          <div className="space-y-2">
            <PawCareLogo />
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-900 pt-2">
              {showReset ? 'Reset Admin Password' : 'Administrator Login'}
            </h1>
            <p className="text-sm text-stone-600">
              Sign in with authorized Admin Email & Password or Admin Gmail.
            </p>
          </div>

          <div className="text-xs text-violet-950 bg-violet-50 border border-violet-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No Public Admin Registration</p>
              <p className="text-violet-800 mt-0.5">
                Admin access is granted exclusively through the verified Firebase{' '}
                <code className="font-mono">admins</code> registry.
              </p>
            </div>
          </div>

          {firebaseUser && !isAdmin && (
            <div className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <p>
                Currently signed in as <strong>{firebaseUser.email}</strong> (role:{' '}
                <strong className="capitalize">{effectiveRole || 'customer'}</strong>), which does
                not have administrator privileges.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={
                    effectiveRole === 'caregiver'
                      ? '/caregiver/dashboard'
                      : '/customer/dashboard'
                  }
                  className="px-3 py-1.5 font-semibold text-white bg-teal-700 rounded-lg"
                >
                  Open My Dashboard
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

          <form onSubmit={handleEmailAdminLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pawcare.in"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>

            {!showReset && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading
                  ? 'Verifying Admin Credentials...'
                  : showReset
                  ? 'Send Admin Password Reset'
                  : 'Sign In to Admin Console'}
              </span>
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setShowReset((p) => !p);
                  setError('');
                  setInfoMsg('');
                }}
                className="text-xs font-medium text-stone-500 hover:text-stone-900 underline cursor-pointer"
              >
                {showReset ? 'Back to Admin Sign In' : 'Forgot Admin Password?'}
              </button>
            </div>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-stone-200" />
            <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Or Authorized Admin Gmail
            </span>
            <div className="flex-grow border-t border-stone-200" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleAdminLogin}
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
            <span>Sign In with Admin Gmail</span>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </button>

          <p className="text-xs text-stone-500 text-center pt-1">
            Pet parent looking for care?{' '}
            <Link to="/login/customer" className="font-semibold text-teal-700 hover:underline">
              Customer Login →
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
