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

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const PREVIEW_AUTH_PROJECT_ID = GOOGLE_AUTH_FIREBASE_CONFIG.projectId;

/**
 * Checks Firebase Identity Toolkit project config for both provisioned projects.
 * Prioritizes primaryAuth (river-fusion-rz0s9 — which owns Firestore) whenever the current
 * hostname is authorized on it, falling back to previewAuth (gen-lang-client-0838797128)
 * on AI Studio preview/sandbox hosts.
 */
export async function resolveAuthForCurrentDomain(forceRefresh = false): Promise<DomainAuthResolution> {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (!hostname) {
    return {
      authInstance: primaryAuth,
      projectId: firebaseConfig.projectId,
      isAuthorized: true,
      hostname: '',
    };
  }

  if (cachedResolution && !forceRefresh && cachedResolution.hostname === hostname && cachedResolution.isAuthorized) {
    return cachedResolution;
  }

  try {
    const [primaryRes, previewRes] = await Promise.all([
      fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${firebaseConfig.apiKey}`).then((r) =>
        r.ok ? r.json() : null
      ).catch(() => null),
      fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${GOOGLE_AUTH_FIREBASE_CONFIG.apiKey}`).then((r) =>
        r.ok ? r.json() : null
      ).catch(() => null),
    ]);

    const primaryDomains: string[] = Array.isArray(primaryRes?.authorizedDomains) ? primaryRes.authorizedDomains : [];
    const previewDomains: string[] = Array.isArray(previewRes?.authorizedDomains) ? previewRes.authorizedDomains : [];

    // Always prefer primaryAuth first so Firestore requests carry a native river-fusion-rz0s9 ID token
    if (isHostMatchingAuthorizedList(hostname, primaryDomains)) {
      cachedResolution = {
        authInstance: primaryAuth,
        projectId: firebaseConfig.projectId,
        isAuthorized: true,
        hostname,
      };
      return cachedResolution;
    }

    if (isHostMatchingAuthorizedList(hostname, previewDomains)) {
      cachedResolution = {
        authInstance: previewAuth,
        projectId: GOOGLE_AUTH_FIREBASE_CONFIG.projectId,
        isAuthorized: true,
        hostname,
      };
      return cachedResolution;
    }

    cachedResolution = {
      authInstance: primaryAuth,
      projectId: firebaseConfig.projectId,
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

export interface PrimaryAuthSnapshot {
  firestoreProjectId: string;
  firestoreDatabaseId: string;
  previewAuthProjectId: string;
  primarySignedIn: boolean;
  primaryUid: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  primaryHasAdminClaim: boolean;
  previewSignedIn: boolean;
  previewUid: string | null;
  previewEmail: string | null;
  previewEmailVerified: boolean;
  tokenRefreshedAt: number | null;
}

/**
 * Waits for Firebase Auth persistence hydration on both instances, optionally forces
 * a fresh ID token on primaryAuth, and inspects custom claims (admin / role).
 */
export async function inspectAndRefreshPrimaryAuth(forceRefreshToken = false): Promise<PrimaryAuthSnapshot> {
  try {
    await Promise.all([
      primaryAuth.authStateReady().catch(() => {}),
      previewAuth.authStateReady().catch(() => {}),
    ]);
  } catch {}

  const pUser = primaryAuth.currentUser;
  const prevUser = previewAuth.currentUser;

  let primaryHasAdminClaim = false;
  let tokenRefreshedAt: number | null = null;

  if (pUser) {
    try {
      const tokenRes = await pUser.getIdTokenResult(forceRefreshToken);
      tokenRefreshedAt = Date.now();
      const claims = tokenRes?.claims || {};
      primaryHasAdminClaim = claims.admin === true || claims.role === 'admin';
    } catch {
      // ignore token refresh failure when offline
    }
  }

  return {
    firestoreProjectId: FIREBASE_PROJECT_ID,
    firestoreDatabaseId: FIRESTORE_DATABASE_ID,
    previewAuthProjectId: PREVIEW_AUTH_PROJECT_ID,
    primarySignedIn: Boolean(pUser),
    primaryUid: pUser?.uid || null,
    primaryEmail: pUser?.email || null,
    primaryEmailVerified: Boolean(pUser?.emailVerified),
    primaryHasAdminClaim,
    previewSignedIn: Boolean(prevUser),
    previewUid: prevUser?.uid || null,
    previewEmail: prevUser?.email || null,
    previewEmailVerified: Boolean(prevUser?.emailVerified),
    tokenRefreshedAt,
  };
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
  code?: string;
  operationType: OperationType;
  path: string | null;
  projectId: string;
  databaseId: string;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    primarySignedIn?: boolean;
    previewEmail?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  markFirestoreWriteQuotaExhausted(error);
  const primaryUser = primaryAuth.currentUser;
  const previewUser = previewAuth.currentUser;
  const activeUser = primaryUser || previewUser;
  const code = String((error as any)?.code || '');
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    code: code || undefined,
    operationType,
    path,
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    authInfo: {
      userId: activeUser?.uid || null,
      email: activeUser?.email || null,
      emailVerified: activeUser?.emailVerified ?? null,
      isAnonymous: activeUser?.isAnonymous ?? null,
      tenantId: activeUser?.tenantId || null,
      primarySignedIn: Boolean(primaryUser),
      previewEmail: previewUser?.email || null,
      providerInfo:
        activeUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
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
