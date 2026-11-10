import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore WriteStream backoff console spam when free tier daily quota is reached
try {
  setLogLevel('silent');
} catch {}

const QUOTA_SESSION_KEY = 'cn_firestore_write_quota_exhausted_date';

export function isFirestoreWriteQuotaExhausted(): boolean {
  try {
    const flaggedDate = sessionStorage.getItem(QUOTA_SESSION_KEY);
    if (!flaggedDate) return false;
    const todayUtc = new Date().toISOString().slice(0, 10);
    return flaggedDate === todayUtc;
  } catch {
    return false;
  }
}

export function markFirestoreWriteQuotaExhausted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as any)?.code || '';
  if (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  ) {
    try {
      const todayUtc = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem(QUOTA_SESSION_KEY, todayUtc);
    } catch {}
    return true;
  }
  return false;
}

// Primary app for Firestore database (preserves all original store data in river-fusion-rz0s9 / ai-studio-remixcottonnestl-79807e95-0ce0-4626-9bba-b37acdbe97c1)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const primaryAuth = getAuth(app);

// Dedicated Auth app provisioned for Google Sign-In on AI Studio preview/shared domains and custom domains added to gen-lang-client-0838797128
export const GOOGLE_AUTH_FIREBASE_CONFIG = {
  projectId: 'gen-lang-client-0838797128',
  appId: '1:75793127604:web:533d29cda660c07d7f1fe1',
  apiKey: 'AIzaSyA_vG4vMDXTrit6StLthavVuuGucEzVzX8',
  authDomain: 'gen-lang-client-0838797128.firebaseapp.com',
};

const googleAuthApp = initializeApp(GOOGLE_AUTH_FIREBASE_CONFIG, 'google-signin-only');
export const previewAuth = getAuth(googleAuthApp);

// Default export auth points to previewAuth (gen-lang-client-0838797128), while AuthContext dynamically selects whichever project has the current hostname authorized
export const auth: Auth = previewAuth;

function isHostMatchingAuthorizedList(hostname: string, domains: string[]): boolean {
  const cleanHost = hostname.trim().toLowerCase();
  if (!cleanHost) return false;
  return domains.some((d) => d.trim().toLowerCase() === cleanHost);
}

export interface DomainAuthResolution {
  authInstance: Auth;
  projectId: string;
  isAuthorized: boolean;
  hostname: string;
}

let cachedResolution: DomainAuthResolution | null = null;

/**
 * Checks Firebase Identity Toolkit project config for both provisioned projects
 * so that whichever Firebase project (gen-lang-client-0838797128 or river-fusion-rz0s9)
 * has the current hostname (e.g. *.run.app or *.vercel.app) in its Authorized Domains
 * is automatically used for signInWithPopup.
 */
export async function resolveAuthForCurrentDomain(forceRefresh = false): Promise<DomainAuthResolution> {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (!hostname) {
    return {
      authInstance: previewAuth,
      projectId: GOOGLE_AUTH_FIREBASE_CONFIG.projectId,
      isAuthorized: true,
      hostname: '',
    };
  }

  if (cachedResolution && !forceRefresh && cachedResolution.hostname === hostname && cachedResolution.isAuthorized) {
    return cachedResolution;
  }

  try {
    const [previewRes, primaryRes] = await Promise.all([
      fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${GOOGLE_AUTH_FIREBASE_CONFIG.apiKey}`).then((r) =>
        r.ok ? r.json() : null
      ).catch(() => null),
      fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${firebaseConfig.apiKey}`).then((r) =>
        r.ok ? r.json() : null
      ).catch(() => null),
    ]);

    const previewDomains: string[] = Array.isArray(previewRes?.authorizedDomains) ? previewRes.authorizedDomains : [];
    const primaryDomains: string[] = Array.isArray(primaryRes?.authorizedDomains) ? primaryRes.authorizedDomains : [];

    if (isHostMatchingAuthorizedList(hostname, previewDomains)) {
      cachedResolution = {
        authInstance: previewAuth,
        projectId: GOOGLE_AUTH_FIREBASE_CONFIG.projectId,
        isAuthorized: true,
        hostname,
      };
      return cachedResolution;
    }

    if (isHostMatchingAuthorizedList(hostname, primaryDomains)) {
      cachedResolution = {
        authInstance: primaryAuth,
        projectId: firebaseConfig.projectId,
        isAuthorized: true,
        hostname,
      };
      return cachedResolution;
    }

    // If neither project has the current domain (e.g. a new .vercel.app deployment) in authorizedDomains yet
    cachedResolution = {
      authInstance: previewAuth,
      projectId: GOOGLE_AUTH_FIREBASE_CONFIG.projectId,
      isAuthorized: false,
      hostname,
    };
    return cachedResolution;
  } catch {
    return {
      authInstance: previewAuth,
      projectId: GOOGLE_AUTH_FIREBASE_CONFIG.projectId,
      isAuthorized: true,
      hostname,
    };
  }
}

export function getBestSyncAuthInstance(): Auth {
  if (cachedResolution && cachedResolution.isAuthorized) {
    return cachedResolution.authInstance;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (
      h.includes('vercel.app') ||
      h.includes('cottonnest') ||
      h.includes('river-fusion-rz0s9') ||
      h.includes('21454338513')
    ) {
      return primaryAuth;
    }
  }
  return previewAuth;
}

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  markFirestoreWriteQuotaExhausted(error);
  const activeUser = previewAuth.currentUser || primaryAuth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid,
      email: activeUser?.email,
      emailVerified: activeUser?.emailVerified,
      isAnonymous: activeUser?.isAnonymous,
      tenantId: activeUser?.tenantId,
      providerInfo:
        activeUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  return errInfo;
}

// Connection test on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
