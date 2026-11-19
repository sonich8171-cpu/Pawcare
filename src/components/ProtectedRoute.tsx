import { MailWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatFirebaseAuthError } from '../lib/authErrors';
import type { UserRole } from '../types/pawcare';

export function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: ReactNode;
  allowedRole: UserRole;
}) {
  const {
    firebaseUser,
    userProfile,
    authLoading,
    profileSyncError,
    isAdmin,
    effectiveRole,
    isEmailVerified,
    signInWithGoogle,
    resendVerificationEmail,
    refreshAuthUser,
    retryProfileSync,
    logout,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [resentMsg, setResentMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [switchingGmail, setSwitchingGmail] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 text-center"
        >
          <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-600">Loading your PawCare session...</p>
        </motion.div>
      </div>
    );
  }

  if (!firebaseUser) {
    const loginPath =
      allowedRole === 'admin'
        ? '/login/admin'
        : allowedRole === 'caregiver'
        ? '/login/caregiver'
        : '/login/customer';
    return (
      <Navigate
        to={loginPath}
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  if (!isEmailVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto my-16 p-8 bg-white border border-stone-200 rounded-2xl text-center space-y-5 shadow-sm"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
          <MailWarning className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Email Verification Required
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Your account <span className="font-semibold">{firebaseUser.email}</span> must be
            verified before accessing your dashboard. Click the verification link sent to your
            inbox, then select Recheck Verification.
          </p>
        </div>

        {resentMsg && (
          <p className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-lg">
            {resentMsg}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                const verified = await refreshAuthUser();
                if (!verified) {
                  setResentMsg('Email is not verified yet. Please click the link in your inbox.');
                }
              } catch (err) {
                setResentMsg(formatFirebaseAuthError(err));
              } finally {
                setChecking(false);
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {checking ? 'Checking...' : 'Recheck Verification'}
          </button>

          {allowedRole !== 'admin' && (
            <button
              type="button"
              disabled={switchingGmail}
              onClick={async () => {
                setSwitchingGmail(true);
                try {
                  await signInWithGoogle(allowedRole === 'caregiver' ? 'caregiver' : 'customer');
                } catch (err) {
                  setResentMsg(formatFirebaseAuthError(err));
                } finally {
                  setSwitchingGmail(false);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              Continue with Gmail
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-stone-500">
          <button
            type="button"
            onClick={async () => {
              try {
                await resendVerificationEmail();
                setResentMsg('Verification email sent again. Check spam/promotions if missing.');
              } catch (err) {
                setResentMsg(formatFirebaseAuthError(err));
              }
            }}
            className="hover:text-stone-900 underline cursor-pointer"
          >
            Resend Verification Email
          </button>
          <button
            type="button"
            onClick={logout}
            className="hover:text-stone-900 underline cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    );
  }

  if (profileSyncError && !userProfile && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-amber-200 rounded-2xl text-center space-y-4 shadow-sm">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-stone-900">
          Could Not Sync Account Profile
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">{profileSyncError}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={retryingSync}
            onClick={async () => {
              setRetryingSync(true);
              try {
                await retryProfileSync();
              } finally {
                setRetryingSync(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${retryingSync ? 'animate-spin' : ''}`} />
            {retryingSync ? 'Retrying Sync...' : 'Retry Profile Sync'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (userProfile?.accountStatus === 'suspended' && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-red-200 rounded-2xl text-center space-y-4 shadow-sm">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-stone-900">Account Suspended</h1>
        <p className="text-sm text-stone-600">
          Your PawCare account is currently suspended by administration. Please contact Dehradun
          support for assistance.
        </p>
        <button
          type="button"
          onClick={logout}
          className="px-4 py-2 text-sm font-semibold text-white bg-stone-800 rounded-xl cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Strict Role Isolation Enforcement
  const roleMismatch =
    (allowedRole === 'admin' && !isAdmin) ||
    (allowedRole === 'caregiver' && (isAdmin || effectiveRole !== 'caregiver')) ||
    (allowedRole === 'customer' && (isAdmin || effectiveRole === 'caregiver'));

  if (roleMismatch) {
    const ownDashboard =
      effectiveRole === 'admin'
        ? '/admin/dashboard'
        : effectiveRole === 'caregiver'
        ? '/caregiver/dashboard'
        : '/customer/dashboard';

    const ownLabel =
      effectiveRole === 'admin'
        ? 'Admin Dashboard'
        : effectiveRole === 'caregiver'
        ? 'Caregiver Dashboard'
        : 'Customer Dashboard';

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto my-16 p-8 bg-white border border-red-200 rounded-2xl text-center space-y-4 shadow-sm"
      >
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-stone-900">
          Access Denied — Role Restricted
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          You are signed in as{' '}
          <span className="font-semibold text-stone-900">{firebaseUser.email}</span> (role:{' '}
          <span className="font-semibold capitalize">{effectiveRole || 'customer'}</span>). This{' '}
          <span className="capitalize font-semibold">{allowedRole}</span> dashboard is strictly
          isolated from other account types.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to={ownDashboard}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
          >
            Open My {ownLabel}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate(
                allowedRole === 'admin'
                  ? '/login/admin'
                  : allowedRole === 'caregiver'
                  ? '/login/caregiver'
                  : '/login/customer'
              );
            }}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
          >
            Sign Out & Switch Account
          </button>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
