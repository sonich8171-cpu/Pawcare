import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  ensureBootstrapAdminRecord,
  ensureUserDocument,
  seedInitialCatalogIfAdmin,
  subscribeMyCaregiverProfile,
} from '../services/firestoreService';
import type { CaregiverPrivateProfile, UserProfile, UserRole } from '../types/pawcare';

const INTENDED_ROLE_STORAGE_KEY = 'pawcare_intended_role';

function readStoredIntendedRole(): 'customer' | 'caregiver' {
  try {
    const val = window.sessionStorage.getItem(INTENDED_ROLE_STORAGE_KEY);
    if (val === 'caregiver') return 'caregiver';
    if (val === 'customer') return 'customer';
  } catch {
    // Ignore storage restriction
  }
  if (typeof window !== 'undefined' && window.location.pathname.includes('caregiver')) {
    return 'caregiver';
  }
  return 'customer';
}

function writeStoredIntendedRole(role: 'customer' | 'caregiver') {
  try {
    window.sessionStorage.setItem(INTENDED_ROLE_STORAGE_KEY, role);
  } catch {
    // Ignore storage restriction
  }
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  caregiverProfile: CaregiverPrivateProfile | null;
  authLoading: boolean;
  profileSyncError: string | null;
  isAdmin: boolean;
  effectiveRole: UserRole | null;
  isEmailVerified: boolean;
  firestoreConnected: boolean;
  signInWithGoogle: (intendedRole?: 'customer' | 'caregiver') => Promise<UserRole>;
  signInAdminWithGoogle: () => Promise<void>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    intendedRole?: 'customer' | 'caregiver'
  ) => Promise<void>;
  loginWithEmail: (
    email: string,
    password: string,
    portal?: 'customer' | 'caregiver' | 'admin'
  ) => Promise<UserRole>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  retryProfileSync: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveAdminStatusForUser(user: User): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    await ensureBootstrapAdminRecord(user.uid, user.email || BOOTSTRAP_ADMIN_EMAIL);
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverPrivateProfile | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileSyncError, setProfileSyncError] = useState<string | null>(null);
  const [firestoreConnected, setFirestoreConnected] = useState(true);
  const [, setUserVersion] = useState(0);

  const intendedRoleRef = useRef<'customer' | 'caregiver'>(readStoredIntendedRole());

  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);
    // Complete any mobile redirect sign-in gracefully without throwing if none occurred
    getRedirectResult(auth).catch((err) => {
      console.warn('Google redirect result check:', err?.code || err?.message || err);
    });
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | undefined;
    let unsubCaregiverDoc: (() => void) | undefined;
    let unsubAdminDoc: (() => void) | undefined;
    let isCancelled = false;

    const cleanupSubListeners = () => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = undefined;
      }
      if (unsubCaregiverDoc) {
        unsubCaregiverDoc();
        unsubCaregiverDoc = undefined;
      }
      if (unsubAdminDoc) {
        unsubAdminDoc();
        unsubAdminDoc = undefined;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      cleanupSubListeners();

      if (!user) {
        if (!isCancelled) {
          setFirebaseUser(null);
          setUserProfile(null);
          setCaregiverProfile(null);
          setHasAdminDoc(false);
          setProfileSyncError(null);
          setAuthLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setAuthLoading(true);
        setFirebaseUser(user);
        setProfileSyncError(null);
      }

      if (user.emailVerified) {
        const activeIntended = readStoredIntendedRole();
        intendedRoleRef.current = activeIntended;

        const [adminVerified, ensuredResult] = await Promise.all([
          resolveAdminStatusForUser(user),
          (async () => {
            const isBootstrapOwner =
              user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
            try {
              const profile = await ensureUserDocument({
                uid: user.uid,
                displayName: user.displayName || user.email?.split('@')[0] || 'Pet Parent',
                email: user.email || '',
                photoUrl: user.photoURL || undefined,
                intendedRole: isBootstrapOwner ? 'admin' : activeIntended,
              });
              return { profile, error: null as string | null };
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Profile setup failed.';
              console.error('Failed to ensure user profile:', err);
              return { profile: null, error: msg };
            }
          })(),
        ]);

        if (isCancelled) return;
        setHasAdminDoc(adminVerified);
        if (ensuredResult.error) {
          setProfileSyncError(ensuredResult.error);
        }

        const ensuredProfile = ensuredResult.profile;
        if (adminVerified && ensuredProfile && ensuredProfile.role !== 'admin') {
          ensureUserDocument({
            uid: user.uid,
            displayName: ensuredProfile.displayName,
            email: ensuredProfile.email,
            photoUrl: ensuredProfile.photoUrl,
            intendedRole: 'admin',
          })
            .then((updated) => {
              if (!isCancelled) setUserProfile(updated);
            })
            .catch(console.error);
        } else if (ensuredProfile) {
          setUserProfile(ensuredProfile);
        }

        if (adminVerified) {
          seedInitialCatalogIfAdmin().catch(console.error);
        }

        unsubUserDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data() as UserProfile);
              setProfileSyncError(null);
            }
          },
          (err) => {
            console.error('User profile snapshot error:', err);
          }
        );

        unsubCaregiverDoc = subscribeMyCaregiverProfile(
          user.uid,
          (profile) => {
            setCaregiverProfile(profile);
          },
          (err) => {
            console.error('Caregiver profile snapshot error:', err);
          }
        );

        if (user.email?.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
          unsubAdminDoc = onSnapshot(
            doc(db, 'admins', user.uid),
            (snap) => setHasAdminDoc(snap.exists()),
            () => setHasAdminDoc(false)
          );
        }
      }

      if (!isCancelled) {
        setAuthLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      unsubAuth();
      cleanupSubListeners();
    };
  }, []);

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);
  const isAdmin = Boolean(firebaseUser && firebaseUser.emailVerified && hasAdminDoc);

  const effectiveRole: UserRole | null = !firebaseUser
    ? null
    : isAdmin
    ? 'admin'
    : userProfile?.role === 'caregiver' || Boolean(caregiverProfile)
    ? 'caregiver'
    : 'customer';

  const signInWithGoogle = async (
    intendedRole: 'customer' | 'caregiver' = 'customer'
  ): Promise<UserRole> => {
    intendedRoleRef.current = intendedRole;
    writeStoredIntendedRole(intendedRole);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let user: User;
    try {
      const cred = await signInWithPopup(auth, provider);
      user = cred.user;
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return intendedRole;
      }
      throw err;
    }

    const adminCheck = await resolveAdminStatusForUser(user);
    if (adminCheck) {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_ADMIN: This account is registered as a PawCare Administrator. Please sign in at /login/admin.'
      );
    }

    const profile = await ensureUserDocument({
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Pet Parent',
      email: user.email || '',
      photoUrl: user.photoURL || undefined,
      intendedRole,
    });
    setUserProfile(profile);
    setProfileSyncError(null);

    if (intendedRole === 'customer' && profile.role === 'caregiver') {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_CAREGIVER: This account is registered as a Caregiver. Please sign in at /login/caregiver.'
      );
    }
    if (intendedRole === 'caregiver' && profile.role === 'customer') {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_CUSTOMER: This account is registered as a Customer. Please sign in at /login/customer or register a separate caregiver account.'
      );
    }
    return profile.role;
  };

  const signInAdminWithGoogle = async (): Promise<void> => {
    intendedRoleRef.current = 'customer';
    writeStoredIntendedRole('customer');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let user: User;
    try {
      const cred = await signInWithPopup(auth, provider);
      user = cred.user;
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }

    const adminCheck = await resolveAdminStatusForUser(user);
    if (!adminCheck) {
      await signOut(auth);
      throw new Error(
        `ADMIN_UNAUTHORIZED: "${user.email}" does not have PawCare Admin privileges.`
      );
    }
    setHasAdminDoc(true);
    seedInitialCatalogIfAdmin().catch(console.error);
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    password: string,
    intendedRole: 'customer' | 'caregiver' = 'customer'
  ): Promise<void> => {
    intendedRoleRef.current = intendedRole;
    writeStoredIntendedRole(intendedRole);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user);
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    portal: 'customer' | 'caregiver' | 'admin' = 'customer'
  ): Promise<UserRole> => {
    const nextIntended = portal === 'caregiver' ? 'caregiver' : 'customer';
    intendedRoleRef.current = nextIntended;
    writeStoredIntendedRole(nextIntended);

    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await cred.user.reload();
    const user = auth.currentUser || cred.user;

    if (!user.emailVerified) {
      if (portal === 'admin') {
        await signOut(auth);
        throw new Error(
          'ADMIN_UNVERIFIED: Admin email address must be verified before signing in.'
        );
      }
      return nextIntended;
    }

    await user.getIdToken(true);
    const adminCheck = await resolveAdminStatusForUser(user);
    if (portal === 'admin') {
      if (!adminCheck) {
        await signOut(auth);
        throw new Error(
          `ADMIN_UNAUTHORIZED: "${user.email}" is not an authorized PawCare Administrator.`
        );
      }
      setHasAdminDoc(true);
      ensureUserDocument({
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'PawCare Owner',
        email: user.email || '',
        photoUrl: user.photoURL || undefined,
        intendedRole: 'admin',
      })
        .then(setUserProfile)
        .catch(console.error);
      seedInitialCatalogIfAdmin().catch(console.error);
      return 'admin';
    }

    if (adminCheck) {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_ADMIN: This account is an Administrator account. Please sign in at /login/admin.'
      );
    }

    const profile = await ensureUserDocument({
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Pet Parent',
      email: user.email || '',
      photoUrl: user.photoURL || undefined,
      intendedRole: portal === 'caregiver' ? 'caregiver' : 'customer',
    });
    setUserProfile(profile);
    setProfileSyncError(null);

    if (portal === 'customer' && profile.role === 'caregiver') {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_CAREGIVER: This account is a Caregiver account. Please sign in at /login/caregiver.'
      );
    }
    if (portal === 'caregiver' && profile.role === 'customer') {
      await signOut(auth);
      throw new Error(
        'ROLE_MISMATCH_CUSTOMER: This account is a Customer account. Please sign in at /login/customer.'
      );
    }

    return profile.role;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const current = auth.currentUser;
    if (current?.emailVerified) {
      await current.getIdToken(true);
    }
    setFirebaseUser(current);
    setUserVersion((v) => v + 1);
    if (current?.emailVerified) {
      const adminCheck = await resolveAdminStatusForUser(current);
      setHasAdminDoc(adminCheck);
      const profile = await ensureUserDocument({
        uid: current.uid,
        displayName: current.displayName || current.email?.split('@')[0] || 'Pet Parent',
        email: current.email || '',
        photoUrl: current.photoURL || undefined,
        intendedRole: adminCheck ? 'admin' : readStoredIntendedRole(),
      });
      setUserProfile(profile);
      setProfileSyncError(null);
    }
    return Boolean(current?.emailVerified);
  };

  const retryProfileSync = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    const current = auth.currentUser;
    const adminCheck = await resolveAdminStatusForUser(current);
    const profile = await ensureUserDocument({
      uid: current.uid,
      displayName: current.displayName || current.email?.split('@')[0] || 'Pet Parent',
      email: current.email || '',
      photoUrl: current.photoURL || undefined,
      intendedRole: adminCheck ? 'admin' : readStoredIntendedRole(),
    });
    setHasAdminDoc(adminCheck);
    setUserProfile(profile);
    setProfileSyncError(null);
  };

  const logout = async () => {
    intendedRoleRef.current = 'customer';
    writeStoredIntendedRole('customer');
    setUserProfile(null);
    setCaregiverProfile(null);
    setHasAdminDoc(false);
    setProfileSyncError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        caregiverProfile,
        authLoading,
        profileSyncError,
        isAdmin,
        effectiveRole,
        isEmailVerified,
        firestoreConnected,
        signInWithGoogle,
        signInAdminWithGoogle,
        registerWithEmail,
        loginWithEmail,
        resetPassword,
        resendVerificationEmail,
        refreshAuthUser,
        retryProfileSync,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
