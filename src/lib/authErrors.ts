export function formatFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('ADMIN_UNAUTHORIZED:')) {
    return msg.replace('ADMIN_UNAUTHORIZED:', '').trim();
  }
  if (msg.startsWith('ADMIN_UNVERIFIED:')) {
    return msg.replace('ADMIN_UNVERIFIED:', '').trim();
  }
  if (msg.startsWith('ROLE_MISMATCH_ADMIN:')) {
    return msg.replace('ROLE_MISMATCH_ADMIN:', '').trim();
  }
  if (msg.startsWith('ROLE_MISMATCH_CAREGIVER:')) {
    return msg.replace('ROLE_MISMATCH_CAREGIVER:', '').trim();
  }
  if (msg.startsWith('ROLE_MISMATCH_CUSTOMER:')) {
    return msg.replace('ROLE_MISMATCH_CUSTOMER:', '').trim();
  }
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in provider is not enabled in Firebase Authentication yet. Please enable Email/Password in Firebase Console or use Google Sign-In.';
  }
  if (
    msg.includes('auth/invalid-credential') ||
    msg.includes('auth/wrong-password') ||
    msg.includes('auth/user-not-found')
  ) {
    return 'Invalid email or password. Double-check your credentials or reset your password.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account already exists with this email. Please sign in instead.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (msg.includes('auth/unauthorized-domain')) {
    return `Sign-in blocked: "${window.location.hostname}" is not added under Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (msg.includes('auth/api-key-not-valid')) {
    return 'Firebase API key configuration error. Verify VITE_FIREBASE_API_KEY in hosting settings.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing. Please try again.';
  }
  if (msg.includes('auth/popup-blocked')) {
    return 'Browser blocked the Google sign-in popup. Allow popups for this site and retry.';
  }
  return msg;
}

export function formatAppError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!err) return fallback;
  let rawMsg = err instanceof Error ? err.message : String(err);

  // Unwrap JSON-stringified FirestoreErrorInfo thrown by handleFirestoreError
  if (rawMsg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMsg) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        rawMsg = parsed.error;
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  if (!rawMsg.trim()) return fallback;
  if (rawMsg.startsWith('SLOT_UNAVAILABLE:')) {
    return rawMsg.replace('SLOT_UNAVAILABLE:', '').trim();
  }
  if (rawMsg.startsWith('INVALID_TIME:')) {
    return rawMsg.replace('INVALID_TIME:', '').trim();
  }
  if (rawMsg.startsWith('STORAGE_TIMEOUT:')) {
    return rawMsg.replace('STORAGE_TIMEOUT:', '').trim();
  }
  if (rawMsg.includes('Missing or insufficient permissions') || rawMsg.includes('permission-denied')) {
    return 'Permission check failed or invalid input format. Please check required fields (e.g. phone 8+ digits, valid name) and ensure your email is verified.';
  }
  if (rawMsg.includes('Quota exceeded')) {
    return 'Daily Firestore quota exceeded. Please try again tomorrow or upgrade your Firebase plan.';
  }
  if (rawMsg.includes('not-found') || rawMsg.includes('No document to update')) {
    return 'Requested record was not found or may have been removed. Please refresh.';
  }
  if (rawMsg.includes('unavailable') || rawMsg.includes('client is offline')) {
    return 'Network connection interrupted. Please check your internet connection and retry.';
  }
  if (rawMsg.includes('auth/')) {
    return formatFirebaseAuthError(err);
  }
  return rawMsg;
}
