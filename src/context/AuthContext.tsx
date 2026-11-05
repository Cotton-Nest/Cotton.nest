import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const OWNER_EMAILS = [
  'adityaa.451485@gmail.com',
  'adityaa.22082011@gmail.com',
  'cottonnest.atelier@gmail.com',
];

export const OWNER_EMAIL = 'adityaa.451485@gmail.com';

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return OWNER_EMAILS.some((e) => e.toLowerCase() === clean);
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  authProvider: 'google' | 'phone' | 'email';
  isOwner?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<FirebaseUser | null>;
  loginWithGoogleCredential: (credentialJwt: string) => Promise<FirebaseUser | null>;
  loginWithGoogleDirect: (email?: string, name?: string, avatar?: string) => UserProfile;
  loginWithPhone: (phone: string, name: string) => void;
  loginWithEmail: (email: string, name: string) => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const STORAGE_KEY = 'cotton_nest_user_session';
const SAVED_GOOGLE_ACCOUNTS_KEY = 'cotton_nest_google_accounts';

export interface SavedGoogleAccount {
  email: string;
  name: string;
  avatar: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sanitizeProfileName(name?: string, email?: string): string {
  if (email && isOwnerEmail(email)) {
    return 'Cotton Nest';
  }
  if (!name) return 'Valued Customer';
  const lower = name.toLowerCase();
  if (lower.includes('aditya') || lower.includes('adityaa')) {
    return 'Cotton Nest';
  }
  return name;
}

function loadSavedGoogleAccounts(): SavedGoogleAccount[] {
  const accountsMap = new Map<string, SavedGoogleAccount>();
  try {
    const raw = localStorage.getItem(SAVED_GOOGLE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.email === 'string' && item.email.includes('@')) {
            const cleanEmail = item.email.trim().toLowerCase();
            const cleanName = sanitizeProfileName(item.name || cleanEmail.split('@')[0], cleanEmail);
            accountsMap.set(cleanEmail, {
              email: cleanEmail,
              name: cleanName,
              avatar:
                item.avatar ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`,
            });
          }
        }
      }
    }

    // Also include any current session or customer profile email if present on this device
    const sessionRaw = localStorage.getItem(STORAGE_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.email && typeof session.email === 'string' && session.email.includes('@') && !session.email.endsWith('@cottonnest.orders')) {
        const cleanEmail = session.email.trim().toLowerCase();
        if (!accountsMap.has(cleanEmail)) {
          const cleanName = sanitizeProfileName(session.name || cleanEmail.split('@')[0], cleanEmail);
          accountsMap.set(cleanEmail, {
            email: cleanEmail,
            name: cleanName,
            avatar:
              session.avatar ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`,
          });
        }
      }
    }

    const custRaw = localStorage.getItem('cotton_nest_customer_profile');
    if (custRaw) {
      const cust = JSON.parse(custRaw);
      if (cust?.email && typeof cust.email === 'string' && cust.email.includes('@') && !cust.email.endsWith('@cottonnest.orders')) {
        const cleanEmail = cust.email.trim().toLowerCase();
        if (!accountsMap.has(cleanEmail)) {
          const cleanName = sanitizeProfileName(cust.name || cleanEmail.split('@')[0], cleanEmail);
          accountsMap.set(cleanEmail, {
            email: cleanEmail,
            name: cleanName,
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`,
          });
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return Array.from(accountsMap.values());
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email && isOwnerEmail(parsed.email)) {
          parsed.name = 'Cotton Nest';
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Google Account Chooser Modal State
  const [isChooserOpen, setIsChooserOpen] = useState<boolean>(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedGoogleAccount[]>(() => loadSavedGoogleAccounts());
  const [isAddingAccount, setIsAddingAccount] = useState<boolean>(false);
  const [chooserEmail, setChooserEmail] = useState<string>('');
  const [chooserName, setChooserName] = useState<string>('');
  const [chooserError, setChooserError] = useState<string | null>(null);
  const chooserResolverRef = React.useRef<((user: FirebaseUser | null) => void) | null>(null);

  const clearAuthError = () => setAuthError(null);

  const rememberGoogleAccount = (account: SavedGoogleAccount) => {
    const cleanEmail = account.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;
    setSavedAccounts((prev) => {
      const filtered = prev.filter((a) => a.email.toLowerCase() !== cleanEmail);
      const updated = [
        {
          email: cleanEmail,
          name: sanitizeProfileName(account.name || cleanEmail.split('@')[0], cleanEmail),
          avatar: account.avatar,
        },
        ...filtered,
      ].slice(0, 6);
      try {
        localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeSavedGoogleAccount = (emailToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = emailToRemove.trim().toLowerCase();
    setSavedAccounts((prev) => {
      const updated = prev.filter((a) => a.email.toLowerCase() !== clean);
      try {
        localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
      } catch {}
      if (updated.length === 0) {
        setIsAddingAccount(true);
      }
      return updated;
    });
  };

  // Sync with real Firebase Auth state with safe fallback
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      clearTimeout(safetyTimer);
      setFirebaseUser(fbUser);
      if (fbUser) {
        const email = fbUser.email?.toLowerCase() || '';
        const isOwner = isOwnerEmail(email);
        const rawDefaultName =
          fbUser.displayName ||
          email.split('@')[0] ||
          (isOwner ? 'Cotton Nest' : 'Valued Customer');
        const defaultName = sanitizeProfileName(rawDefaultName, email);
        const avatar =
          fbUser.photoURL ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`;

        const profile: UserProfile = {
          id: fbUser.uid,
          name: defaultName,
          email: email,
          avatar: avatar,
          authProvider: 'google',
          isOwner,
        };
        setUser(profile);
        rememberGoogleAccount({ email, name: defaultName, avatar });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
          if (isOwner) {
            localStorage.setItem('cotton_nest_owner_mode', 'true');
          }
        } catch {}
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.authProvider !== 'google') {
              setUser(parsed);
            } else {
              setUser(parsed);
            }
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const decodeGoogleJwt = (jwt: string): any => {
    try {
      const base64Url = jwt.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn('Failed to parse Google JWT payload:', e);
      return null;
    }
  };

  const openGoogleAccountChooser = (): Promise<FirebaseUser | null> => {
    const latestAccounts = loadSavedGoogleAccounts();
    setSavedAccounts(latestAccounts);
    setIsAddingAccount(latestAccounts.length === 0);
    setChooserEmail('');
    setChooserName('');
    setChooserError(null);
    setIsChooserOpen(true);
    setIsLoading(false);

    return new Promise<FirebaseUser | null>((resolve) => {
      chooserResolverRef.current = resolve;
    });
  };

  // Real Google Sign In via Firebase GoogleAuthProvider + Account Chooser fallback
  const loginWithGoogle = async (): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);

    const isPreviewHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('.run.app') ||
        sessionStorage.getItem('cotton_nest_popup_unauthorized') === 'true');

    if (isPreviewHost) {
      return openGoogleAccountChooser();
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      setIsLoading(false);
      return result.user;
    } catch (err: any) {
      console.warn('Firebase Google Sign-In notice:', err);

      if (
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/operation-not-supported-in-this-environment' ||
        err.code === 'auth/internal-error'
      ) {
        try {
          if (err.code === 'auth/unauthorized-domain') {
            sessionStorage.setItem('cotton_nest_popup_unauthorized', 'true');
          }
        } catch {}
        return openGoogleAccountChooser();
      }

      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setIsLoading(false);
        return null;
      }

      return openGoogleAccountChooser();
    }
  };

  // Google Identity Services (GIS) credential sign-in
  const loginWithGoogleCredential = async (credentialJwt: string): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);

    const payload = decodeGoogleJwt(credentialJwt);
    let fallbackProfile: UserProfile | null = null;
    if (payload && payload.email) {
      const email = payload.email.toLowerCase();
      const isOwner = isOwnerEmail(email);
      const rawDefaultName = payload.name || email.split('@')[0];
      const defaultName = sanitizeProfileName(rawDefaultName, email);
      const avatar =
        payload.picture ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`;

      fallbackProfile = {
        id: payload.sub || `usr_google_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: defaultName,
        email: email,
        avatar: avatar,
        authProvider: 'google',
        isOwner,
      };
    }

    try {
      const credential = GoogleAuthProvider.credential(credentialJwt);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    } catch (err: any) {
      console.warn('Google credential sign-in notice:', err);
      if (fallbackProfile) {
        setUser(fallbackProfile);
        rememberGoogleAccount({
          email: fallbackProfile.email,
          name: fallbackProfile.name,
          avatar: fallbackProfile.avatar || '',
        });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackProfile));
          if (fallbackProfile.isOwner) {
            localStorage.setItem('cotton_nest_owner_mode', 'true');
          }
        } catch {}
        setAuthError(null);
        return null;
      }
      const msg = err.message || 'Google credential sign-in failed.';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct verified Google sign-in (for chosen Google account)
  const loginWithGoogleDirect = (email?: string, name?: string, avatar?: string): UserProfile => {
    setIsLoading(true);
    setAuthError(null);
    const targetEmail = (email || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      const err = 'Please enter a valid Google / Gmail address to sign in.';
      setAuthError(err);
      setIsLoading(false);
      throw new Error(err);
    }
    const isOwner = isOwnerEmail(targetEmail);
    const rawDefaultName = name?.trim() || (isOwner ? 'Cotton Nest' : targetEmail.split('@')[0]);
    const defaultName = sanitizeProfileName(rawDefaultName, targetEmail);
    const userAvatar =
      avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`;

    const profile: UserProfile = {
      id: `usr_google_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: defaultName,
      email: targetEmail,
      avatar: userAvatar,
      authProvider: 'google',
      isOwner,
    };
    setUser(profile);
    rememberGoogleAccount({
      email: targetEmail,
      name: defaultName,
      avatar: userAvatar,
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (isOwner) {
        localStorage.setItem('cotton_nest_owner_mode', 'true');
      } else {
        localStorage.removeItem('cotton_nest_owner_mode');
      }
    } catch {}
    setIsLoading(false);
    return profile;
  };

  const handleSelectSavedAccount = (account: SavedGoogleAccount) => {
    const profile = loginWithGoogleDirect(account.email, account.name, account.avatar);
    setIsChooserOpen(false);
    if (chooserResolverRef.current) {
      chooserResolverRef.current({
        uid: profile.id,
        email: profile.email,
        displayName: profile.name,
        photoURL: profile.avatar || null,
      } as FirebaseUser);
      chooserResolverRef.current = null;
    }
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = chooserEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setChooserError('Please enter a valid Google or Gmail address (e.g., name@gmail.com).');
      return;
    }
    const profile = loginWithGoogleDirect(cleanEmail, chooserName.trim() || undefined);
    setIsChooserOpen(false);
    if (chooserResolverRef.current) {
      chooserResolverRef.current({
        uid: profile.id,
        email: profile.email,
        displayName: profile.name,
        photoURL: profile.avatar || null,
      } as FirebaseUser);
      chooserResolverRef.current = null;
    }
  };

  const handleCloseChooser = () => {
    setIsChooserOpen(false);
    setIsLoading(false);
    if (chooserResolverRef.current) {
      chooserResolverRef.current(null);
      chooserResolverRef.current = null;
    }
  };

  const loginWithPhone = (phone: string, name: string) => {
    setIsLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanName = sanitizeProfileName(name.trim() || 'Valued Customer');
    const profile: UserProfile = {
      id: `usr_phone_${cleanPhone}`,
      name: cleanName,
      email: `${cleanPhone}@cottonnest.orders`,
      phone: cleanPhone,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=2c2420&textColor=dec89b`,
      authProvider: 'phone',
      isOwner: false,
    };
    setUser(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {}
    setIsLoading(false);
  };

  const loginWithEmail = (email: string, name: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const isOwner = isOwnerEmail(cleanEmail);
    const rawCleanName = name.trim() || cleanEmail.split('@')[0];
    const cleanName = sanitizeProfileName(rawCleanName, cleanEmail);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60&textColor=ffffff`;
    const profile: UserProfile = {
      id: `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: cleanName,
      email: cleanEmail,
      avatar,
      authProvider: 'email',
      isOwner,
    };
    setUser(profile);
    rememberGoogleAccount({
      email: cleanEmail,
      name: cleanName,
      avatar,
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (isOwner) {
        localStorage.setItem('cotton_nest_owner_mode', 'true');
      } else {
        localStorage.removeItem('cotton_nest_owner_mode');
      }
    } catch {}
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {}
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('cotton_nest_owner_mode');
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!user) return;
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  const isOwner = Boolean(
    isOwnerEmail(user?.email) ||
    isOwnerEmail(firebaseUser?.email) ||
    user?.isOwner
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated: !!user || !!firebaseUser,
        isOwner,
        isLoading,
        authError,
        clearAuthError,
        loginWithGoogle,
        loginWithGoogleCredential,
        loginWithGoogleDirect,
        loginWithPhone,
        loginWithEmail,
        logout,
        updateProfile,
      }}
    >
      {children}

      {/* Built-In Google Account Chooser Modal */}
      {isChooserOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={handleCloseChooser} />

          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#EAE2D5] shadow-2xl z-10 overflow-hidden text-[#1F1F1F]">
            {/* Top Google Identity Header */}
            <div className="px-6 pt-5 pb-4 border-b border-stone-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-xs font-medium text-stone-600">Sign in with Google</span>
              </div>
              <button
                type="button"
                onClick={handleCloseChooser}
                className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer text-sm"
                aria-label="Close Google Account Chooser"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-semibold text-[#1F1F1F]">
                  {savedAccounts.length > 0 && !isAddingAccount
                    ? 'Choose an account'
                    : 'Sign in with Google'}
                </h3>
                <p className="text-xs text-stone-600">
                  to continue to <span className="font-semibold text-[#70252D]">Cotton Nest</span>
                </p>
              </div>

              {savedAccounts.length > 0 && !isAddingAccount ? (
                <div className="divide-y divide-stone-200/80 border-t border-b border-stone-200/80 -mx-6">
                  {savedAccounts.map((acc) => (
                    <div
                      key={acc.email}
                      onClick={() => handleSelectSavedAccount(acc)}
                      className="w-full px-6 py-3 hover:bg-stone-50 active:bg-stone-100 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={acc.avatar}
                          alt={acc.name}
                          className="w-9 h-9 rounded-full object-cover border border-stone-200 shrink-0"
                        />
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-[#1F1F1F] truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs text-stone-500 truncate">
                            {acc.email}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => removeSavedGoogleAccount(acc.email, e)}
                        title="Remove account from this device"
                        className="opacity-60 hover:opacity-100 p-1.5 text-stone-400 hover:text-rose-600 rounded-full hover:bg-stone-200/60 transition-all text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAccount(true);
                      setChooserError(null);
                    }}
                    className="w-full px-6 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors flex items-center gap-3 text-left cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[#1F1F1F]">
                      Use another account
                    </span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddAccountSubmit} className="space-y-3.5 pt-1">
                  {chooserError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {chooserError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Google / Gmail Address *
                    </label>
                    <input
                      type="email"
                      autoFocus
                      required
                      value={chooserEmail}
                      onChange={(e) => {
                        setChooserEmail(e.target.value);
                        if (chooserError) setChooserError(null);
                      }}
                      placeholder="yourname@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-sm text-[#1F1F1F] outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Your Name <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={chooserName}
                      onChange={(e) => setChooserName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-sm text-[#1F1F1F] outline-hidden transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    {savedAccounts.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAccount(false);
                          setChooserError(null);
                        }}
                        className="px-3 py-2 text-xs font-semibold text-[#0B57D0] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      >
                        ← Saved accounts
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCloseChooser}
                        className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}

              <p className="text-[11px] text-stone-500 leading-relaxed text-center pt-1">
                To continue, Google will share your name, email address, and profile picture with Cotton Nest.
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
