import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  ensureUserDocument,
  seedInitialCatalogIfAdmin,
  subscribeMyCaregiverProfile,
} from '../services/firestoreService';
import type { CaregiverPrivateProfile, UserProfile } from '../types/pawcare';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  caregiverProfile: CaregiverPrivateProfile | null;
  authLoading: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  firestoreConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverPrivateProfile | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [firestoreConnected, setFirestoreConnected] = useState(true);

  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | undefined;
    let unsubCaregiverDoc: (() => void) | undefined;
    let unsubAdminDoc: (() => void) | undefined;
    let isCancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (unsubUserDoc) unsubUserDoc();
        if (unsubCaregiverDoc) unsubCaregiverDoc();
        if (unsubAdminDoc) unsubAdminDoc();
        setFirebaseUser(null);
        setUserProfile(null);
        setCaregiverProfile(null);
        setHasAdminDoc(false);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      setFirebaseUser(user);
      if (unsubUserDoc) unsubUserDoc();
      if (unsubCaregiverDoc) unsubCaregiverDoc();
      if (unsubAdminDoc) unsubAdminDoc();

      if (user.emailVerified) {
        try {
          await ensureUserDocument({
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Pet Parent',
            email: user.email || '',
            photoUrl: user.photoURL || undefined,
          });
        } catch (err) {
          console.error('Failed to ensure user profile:', err);
        }

        if (isCancelled) return;

        unsubUserDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data() as UserProfile);
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
        );

        unsubCaregiverDoc = subscribeMyCaregiverProfile(user.uid, (profile) => {
          setCaregiverProfile(profile);
        });

        const isBootstrappedAdmin =
          user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        if (isBootstrappedAdmin) {
          setHasAdminDoc(true);
          seedInitialCatalogIfAdmin().catch(console.error);
        } else {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            if (!isCancelled) {
              setHasAdminDoc(adminSnap.exists());
            }
          } catch {
            if (!isCancelled) setHasAdminDoc(false);
          }

          if (!isCancelled) {
            unsubAdminDoc = onSnapshot(
              doc(db, 'admins', user.uid),
              (snap) => setHasAdminDoc(snap.exists()),
              () => setHasAdminDoc(false)
            );
          }
        }
      }

      if (!isCancelled) {
        setAuthLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubCaregiverDoc) unsubCaregiverDoc();
      if (unsubAdminDoc) unsubAdminDoc();
    };
  }, []);

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);
  const isAdmin = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      (firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() || hasAdminDoc)
  );

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setFirebaseUser(updated ? ({ ...updated } as User) : null);
    if (updated?.emailVerified) {
      await ensureUserDocument({
        uid: updated.uid,
        displayName: updated.displayName || updated.email?.split('@')[0] || 'Pet Parent',
        email: updated.email || '',
        photoUrl: updated.photoURL || undefined,
      });
    }
    return Boolean(updated?.emailVerified);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        caregiverProfile,
        authLoading,
        isAdmin,
        isEmailVerified,
        firestoreConnected,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        resetPassword,
        resendVerificationEmail,
        refreshAuthUser,
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
