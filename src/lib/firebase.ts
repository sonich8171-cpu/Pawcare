import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

function sanitizeEnvValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleaned || cleaned.startsWith('YOUR_') || cleaned.startsWith('<')) {
    return undefined;
  }
  return cleaned;
}

const rawApiKey = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY);
const envConfig = {
  apiKey: rawApiKey && rawApiKey.startsWith('AIza') ? rawApiKey : undefined,
  authDomain: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
  firestoreDatabaseId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_DATABASE_ID),
};

const firebaseConfig = {
  apiKey: envConfig.apiKey || appletConfig.apiKey,
  authDomain: envConfig.authDomain || appletConfig.authDomain,
  projectId: envConfig.projectId || appletConfig.projectId,
  storageBucket: envConfig.storageBucket || appletConfig.storageBucket,
  messagingSenderId: envConfig.messagingSenderId || appletConfig.messagingSenderId,
  appId: envConfig.appId || appletConfig.appId,
};

const databaseId = envConfig.firestoreDatabaseId || appletConfig.firestoreDatabaseId || '(default)';

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, databaseId);
export const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence setup notice:', err);
});
export const storage = getStorage(firebaseApp);

export const BOOTSTRAP_ADMIN_EMAIL = 'sonich8171@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
    return false;
  }
}

export async function uploadMediaFile(storagePath: string, file: File): Promise<string> {
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return await getDownloadURL(fileRef);
}
