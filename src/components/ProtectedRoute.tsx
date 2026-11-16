import { MailWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const {
    firebaseUser,
    userProfile,
    authLoading,
    isAdmin,
    isEmailVerified,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();
  const location = useLocation();
  const [resentMsg, setResentMsg] = useState('');
  const [checking, setChecking] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-600">Loading your PawCare account...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (!isEmailVerified) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-stone-200 rounded-2xl text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
          <MailWarning className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Verify your email to continue
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            We sent a verification link to <span className="font-semibold">{firebaseUser.email}</span>.
            For marketplace safety, pet profiles, bookings, and caregiver verification require a
            verified email address.
          </p>
        </div>

        {resentMsg && (
          <p className="text-xs font-medium text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">
            {resentMsg}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              const verified = await refreshAuthUser();
              if (!verified) {
                setResentMsg('Email not verified yet. Please check your inbox or spam folder.');
              }
              setChecking(false);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {checking ? 'Checking...' : "I've Verified — Continue"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await resendVerificationEmail();
              setResentMsg('Verification email sent again.');
            }}
            className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            Resend Email
          </button>
        </div>

        <button
          type="button"
          onClick={logout}
          className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
        >
          Sign out and use Google Sign-In instead
        </button>
      </div>
    );
  }

  if (userProfile?.accountStatus === 'suspended' && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-red-200 rounded-2xl text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-stone-900">Account Suspended</h1>
        <p className="text-sm text-stone-600">
          Your PawCare account is currently suspended by administration. Please contact Dehradun
          support for assistance.
        </p>
        <button
          type="button"
          onClick={logout}
          className="px-4 py-2 text-sm font-semibold text-white bg-stone-800 rounded-lg cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-stone-200 rounded-2xl text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-violet-700 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-stone-900">
          Administrator Access Required
        </h1>
        <p className="text-sm text-stone-600">
          This area is restricted to authorized PawCare administrators. Unauthorized access is
          blocked by server-enforced Firestore security rules.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
