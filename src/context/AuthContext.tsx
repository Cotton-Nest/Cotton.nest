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

export const OWNER_EMAIL = 'adityaa.22082011@gmail.com';

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
  loginWithPhone: (phone: string, name: string) => void;
  loginWithEmail: (email: string, name: string) => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const STORAGE_KEY = 'cotton_nest_user_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearAuthError = () => setAuthError(null);

  // Sync with real Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const email = fbUser.email?.toLowerCase() || '';
        const isOwner = email === OWNER_EMAIL.toLowerCase();
        const defaultName =
          fbUser.displayName ||
          email.split('@')[0] ||
          (isOwner ? 'Aditya (Store Owner)' : 'Valued Customer');
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
          if (isOwner) {
            localStorage.setItem('cotton_nest_owner_mode', 'true');
          }
        } catch {}
      } else {
        // If not logged in via Firebase Auth, check if custom phone/email session exists
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.authProvider !== 'google') {
              setUser(parsed);
            } else {
              setUser(null);
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

    return () => unsubscribe();
  }, []);

  // Initialize Google Identity Services (GIS) API when script loads
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupGis = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && firebaseConfig?.oAuthClientId) {
        try {
          google.accounts.id.initialize({
            client_id: firebaseConfig.oAuthClientId,
            callback: async (response: any) => {
              if (response?.credential) {
                try {
                  await loginWithGoogleCredential(response.credential);
                } catch (e: any) {
                  console.error('GIS auto-credential sign-in failed:', e);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
        } catch (e) {
          console.warn('Google Identity Services init notice:', e);
        }
      }
    };

    setupGis();
    const timer = setTimeout(setupGis, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Real Google Sign In via Firebase GoogleAuthProvider + signInWithPopup
  const loginWithGoogle = async (): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err: any) {
      console.warn('Firebase Google Sign-In error:', err);
      let friendlyMessage = 'Google sign-in could not be completed.';

      if (err.code === 'auth/popup-blocked') {
        friendlyMessage =
          'The Google sign-in popup was blocked by your browser. Please allow popups for this site or use the direct sign-in button.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Google sign-in was cancelled before completing.';
      } else if (err.code === 'auth/unauthorized-domain') {
        friendlyMessage = `Google Auth domain needs authorization for ${window.location.hostname}. Please use the Owner PIN (2508) fallback while domain propagates.`;
      } else if (err.message) {
        friendlyMessage = err.message;
      }

      setAuthError(friendlyMessage);
      throw new Error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Identity Services (GIS) credential sign-in
  const loginWithGoogleCredential = async (credentialJwt: string): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const credential = GoogleAuthProvider.credential(credentialJwt);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    } catch (err: any) {
      console.error('Google credential sign-in error:', err);
      const msg = err.message || 'Google credential sign-in failed.';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPhone = (phone: string, name: string) => {
    setIsLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanName = name.trim() || 'Valued Customer';
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
    const isOwner = cleanEmail === OWNER_EMAIL.toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];
    const profile: UserProfile = {
      id: `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: cleanName,
      email: cleanEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60&textColor=ffffff`,
      authProvider: 'email',
      isOwner,
    };
    setUser(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (isOwner) {
        localStorage.setItem('cotton_nest_owner_mode', 'true');
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
    (user?.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) ||
    (firebaseUser?.email && firebaseUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) ||
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
        loginWithPhone,
        loginWithEmail,
        logout,
        updateProfile,
      }}
    >
      {children}
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
