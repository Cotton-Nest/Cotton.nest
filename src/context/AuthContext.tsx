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
import { sendEmailOtpApi, verifyEmailOtpApi } from '../services/api';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            ux_mode?: 'popup' | 'redirect';
            use_fedcm_for_prompt?: boolean;
            use_fedcm_for_button?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              use_fedcm_for_button?: boolean;
            }
          ) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback?: (done: { successful: boolean; error?: string }) => void) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export const GOOGLE_GIS_CLIENT_ID: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  (firebaseConfig as any).oAuthClientId ||
  '';

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
  otpVerified?: boolean;
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
  loginWithGoogleGis: () => Promise<FirebaseUser | null>;
  loginWithGoogleCredential: (credentialJwt: string) => Promise<FirebaseUser | null>;
  loginWithGoogleAccessToken: (accessToken: string) => Promise<FirebaseUser | null>;
  loginWithGoogleDirect: (email?: string, name?: string, avatar?: string) => UserProfile;
  loginWithPhone: (phone: string, name: string) => void;
  loginWithEmail: (email: string, name: string) => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const STORAGE_KEY = 'cotton_nest_user_session';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      // Always purge any legacy saved account lists or auto-owner flags so emails are never exposed
      localStorage.removeItem('cotton_nest_google_accounts');
      localStorage.removeItem('cotton_nest_owner_mode');

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          // Never restore an unverified synthetic google session
          if (parsed.authProvider === 'google' && String(parsed.id || '').startsWith('usr_google_') && !parsed.otpVerified) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
          if (isOwnerEmail(parsed.email)) {
            const activeFbEmail = auth.currentUser?.email?.trim().toLowerCase();
            if (activeFbEmail !== parsed.email.trim().toLowerCase() && !parsed.otpVerified) {
              localStorage.removeItem(STORAGE_KEY);
              return null;
            }
            parsed.name = 'Cotton Nest';
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // OTP-Verified Google/Gmail Modal State (used only if browser/domain blocks the Google OAuth popup)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(false);
  const [otpEmail, setOtpEmail] = useState<string>('');
  const [otpName, setOtpName] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const otpResolverRef = React.useRef<((user: FirebaseUser | null) => void) | null>(null);

  const clearAuthError = () => setAuthError(null);

  // Ensure Google Identity Services (GIS) SDK script is loaded & initialized without FedCM iframe errors
  const ensureGisSdkReady = React.useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const initGis = () => {
        if (!window.google?.accounts) {
          resolve(false);
          return;
        }
        if (GOOGLE_GIS_CLIENT_ID && window.google.accounts.id) {
          try {
            window.google.accounts.id.initialize({
              client_id: GOOGLE_GIS_CLIENT_ID,
              callback: (response) => {
                if (response?.credential) {
                  loginWithGoogleCredential(response.credential).catch(() => {});
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
              ux_mode: 'popup',
              // Disable FedCM so it never throws NotAllowedError in cross-origin preview iframes
              use_fedcm_for_prompt: false,
              use_fedcm_for_button: false,
            });
          } catch (err) {
            console.warn('GIS ID initialize notice:', err);
          }
        }
        resolve(true);
      };

      if (window.google?.accounts) {
        initGis();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src*="accounts.google.com/gsi/client"]'
      );
      if (existingScript) {
        let checks = 0;
        const timer = setInterval(() => {
          checks += 1;
          if (window.google?.accounts) {
            clearInterval(timer);
            initGis();
          } else if (checks > 25) {
            clearInterval(timer);
            resolve(false);
          }
        }, 120);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGis();
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    ensureGisSdkReady().catch(() => {});
  }, [ensureGisSdkReady]);

  // Sync with real Firebase Auth state
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
          otpVerified: true,
        };
        setUser(profile);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        } catch {}
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.otpVerified) {
              setUser(parsed);
            } else if (parsed && parsed.authProvider === 'phone') {
              setUser(parsed);
            } else {
              localStorage.removeItem(STORAGE_KEY);
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

  const openGmailOtpVerificationModal = (): Promise<FirebaseUser | null> => {
    setOtpEmail('');
    setOtpName('');
    setOtpSent(false);
    setOtpCode('');
    setOtpToken(null);
    setOtpError(null);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setIsOtpModalOpen(true);
    setIsLoading(false);

    return new Promise<FirebaseUser | null>((resolve) => {
      otpResolverRef.current = resolve;
    });
  };

  // Sign in using a Google Identity Services (GIS) OAuth 2.0 Access Token
  const loginWithGoogleAccessToken = async (accessToken: string): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);

    let verifiedProfile: UserProfile | null = null;
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        if (info && info.email) {
          const email = String(info.email).toLowerCase();
          const isOwner = isOwnerEmail(email);
          const rawDefaultName = info.name || email.split('@')[0];
          const defaultName = sanitizeProfileName(rawDefaultName, email);
          const avatar =
            info.picture ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`;

          verifiedProfile = {
            id: info.sub || `usr_gis_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: defaultName,
            email,
            avatar,
            authProvider: 'google',
            isOwner,
            otpVerified: true,
          };
        }
      }
    } catch (err) {
      console.warn('GIS userinfo fetch notice:', err);
    }

    try {
      const credential = GoogleAuthProvider.credential(null, accessToken);
      const result = await signInWithCredential(auth, credential);
      setIsLoading(false);
      return result.user;
    } catch (err: any) {
      console.warn('Firebase credential bridge from GIS accessToken notice:', err);
      if (verifiedProfile) {
        setUser(verifiedProfile);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(verifiedProfile));
        } catch {}
        setIsLoading(false);
        return {
          uid: verifiedProfile.id,
          email: verifiedProfile.email,
          displayName: verifiedProfile.name,
          photoURL: verifiedProfile.avatar || null,
        } as FirebaseUser;
      }
      setIsLoading(false);
      throw err;
    }
  };

  // Trigger Google Identity Services (GIS) SDK OAuth 2.0 Token Client popup synchronously on user click (no async await before requestAccessToken so popup blocker never triggers)
  const loginWithGoogleGis = (): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);

    const hasUserActivation =
      typeof navigator !== 'undefined' && 'userActivation' in navigator
        ? Boolean((navigator as any).userActivation?.isActive)
        : true;

    if (
      !hasUserActivation ||
      typeof window === 'undefined' ||
      !window.google?.accounts?.oauth2 ||
      !GOOGLE_GIS_CLIENT_ID
    ) {
      return openGmailOtpVerificationModal();
    }

    return new Promise<FirebaseUser | null>((resolve) => {
      try {
        const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: GOOGLE_GIS_CLIENT_ID,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: async (tokenResponse) => {
            if (tokenResponse?.error || !tokenResponse?.access_token) {
              if (tokenResponse?.error === 'access_denied') {
                setIsLoading(false);
                resolve(null);
                return;
              }
              const otpUser = await openGmailOtpVerificationModal();
              resolve(otpUser);
              return;
            }
            try {
              const signedInUser = await loginWithGoogleAccessToken(tokenResponse.access_token);
              resolve(signedInUser);
            } catch {
              const otpUser = await openGmailOtpVerificationModal();
              resolve(otpUser);
            }
          },
          error_callback: async (err) => {
            if (err?.type === 'popup_closed') {
              setIsLoading(false);
              resolve(null);
              return;
            }
            const otpUser = await openGmailOtpVerificationModal();
            resolve(otpUser);
          },
        });

        // Must be called synchronously inside the user click handler
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch {
        openGmailOtpVerificationModal().then(resolve);
      }
    });
  };

  // Real Google API Sign-In via Firebase GoogleAuthProvider + signInWithPopup
  const loginWithGoogle = async (): Promise<FirebaseUser | null> => {
    setIsLoading(true);
    setAuthError(null);

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

      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setIsLoading(false);
        return null;
      }

      // Note: Do NOT open a second window.open popup here because await signInWithPopup() already consumed
      // the browser's single-click user activation. Open the verification modal instead.
      return openGmailOtpVerificationModal();
    }
  };

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
        otpVerified: true,
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackProfile));
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

  // Direct email login is disabled without OTP verification; throws an error directing to OTP verification
  const loginWithGoogleDirect = (_email?: string, _name?: string, _avatar?: string): UserProfile => {
    const err = 'Email sign-in requires 6-digit OTP verification.';
    setAuthError(err);
    setIsLoading(false);
    throw new Error(err);
  };

  const handleSendModalOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setOtpError('Please enter a valid Google / Gmail address.');
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendEmailOtpApi(cleanEmail);
      if (res.success) {
        setOtpSent(true);
        setOtpCode('');
        if (res.verificationToken) {
          setOtpToken(res.verificationToken);
        }
      } else {
        setOtpError(res.error || 'Failed to send verification code. Please check your email and try again.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Network error while sending verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyModalOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setOtpError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const cleanEmail = otpEmail.trim().toLowerCase();
      const res = await verifyEmailOtpApi(cleanEmail, cleanCode, otpToken || undefined);
      if (res.success) {
        const isOwner = isOwnerEmail(cleanEmail);
        const rawCleanName = otpName.trim() || cleanEmail.split('@')[0];
        const cleanName = sanitizeProfileName(rawCleanName, cleanEmail);
        const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60&textColor=ffffff`;
        const profile: UserProfile = {
          id: `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: cleanName,
          email: cleanEmail,
          avatar,
          authProvider: 'email',
          isOwner,
          otpVerified: true,
        };
        setUser(profile);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        } catch {}

        setIsOtpModalOpen(false);
        if (otpResolverRef.current) {
          otpResolverRef.current({
            uid: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: profile.avatar || null,
          } as FirebaseUser);
          otpResolverRef.current = null;
        }
      } else {
        setOtpError(res.error || 'Invalid verification code. Please check your email and try again.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCloseOtpModal = () => {
    setIsOtpModalOpen(false);
    setIsLoading(false);
    if (otpResolverRef.current) {
      otpResolverRef.current(null);
      otpResolverRef.current = null;
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

  // Called only after 6-digit OTP verification succeeds in AuthModal
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
      otpVerified: true,
    };
    setUser(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {}
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch {}
    try {
      await firebaseSignOut(auth);
    } catch {}
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('cotton_nest_owner_mode');
    localStorage.removeItem('cotton_nest_google_accounts');
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
        loginWithGoogleGis,
        loginWithGoogleCredential,
        loginWithGoogleAccessToken,
        loginWithGoogleDirect,
        loginWithPhone,
        loginWithEmail,
        logout,
        updateProfile,
      }}
    >
      {children}

      {/* Google / Gmail 6-Digit OTP Verification Modal (shown if popup is blocked on current host) */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={handleCloseOtpModal} />

          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#EAE2D5] shadow-2xl z-10 overflow-hidden text-[#1F1F1F]">
            <div className="px-6 pt-5 pb-4 border-b border-stone-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-xs font-medium text-stone-600">Google / Gmail Verification</span>
              </div>
              <button
                type="button"
                onClick={handleCloseOtpModal}
                className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-semibold text-[#1F1F1F]">
                  {otpSent ? 'Enter Verification Code' : 'Sign in with Google'}
                </h3>
                <p className="text-xs text-stone-600">
                  {otpSent
                    ? `Enter the 6-digit OTP sent to ${otpEmail}`
                    : 'Verify your Google / Gmail account with a 6-digit OTP code'}
                </p>
              </div>

              {otpError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {otpError}
                </div>
              )}

              {!otpSent ? (
                <form onSubmit={handleSendModalOtp} className="space-y-3.5 pt-1">
                  {typeof window !== 'undefined' && window.google?.accounts?.oauth2 && GOOGLE_GIS_CLIENT_ID && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOtpModalOpen(false);
                          loginWithGoogleGis().then((u) => {
                            if (otpResolverRef.current) {
                              otpResolverRef.current(u);
                              otpResolverRef.current = null;
                            }
                          });
                        }}
                        className="w-full py-2.5 px-4 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#1F1F1F] font-semibold border border-[#DEC89B] rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Choose Google Account (GIS Popup)</span>
                      </button>
                      <div className="relative flex py-0.5 items-center">
                        <div className="grow border-t border-stone-200"></div>
                        <span className="shrink mx-2 text-[10px] text-stone-400 uppercase font-semibold">Or verify via 6-digit OTP</span>
                        <div className="grow border-t border-stone-200"></div>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Google / Gmail Address *
                    </label>
                    <input
                      type="email"
                      autoFocus
                      required
                      value={otpEmail}
                      onChange={(e) => {
                        setOtpEmail(e.target.value);
                        if (otpError) setOtpError(null);
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
                      value={otpName}
                      onChange={(e) => setOtpName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-sm text-[#1F1F1F] outline-hidden transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseOtpModal}
                      className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingOtp}
                      className="px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {isSendingOtp ? 'Sending OTP...' : 'Send 6-Digit OTP'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyModalOtp} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      6-Digit Verification Code *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (otpError) setOtpError(null);
                      }}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-center text-lg font-bold tracking-[0.35em] text-[#1F1F1F] outline-hidden transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpError(null);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Change Email
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingOtp || otpCode.length !== 6}
                      className="px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                  </div>
                </form>
              )}
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
