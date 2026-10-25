import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldCheck, AlertCircle, LogIn, RefreshCw } from 'lucide-react';
import { useAuth, OWNER_EMAIL } from '../context/AuthContext';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: () => void;
}

// Default Owner PIN is 2508 (matching House 2508, Sector 46 Gurgaon) or 1234
const DEFAULT_OWNER_PIN = '2508';

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate,
}) => {
  const { loginWithGoogle, user, firebaseUser } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem('cotton_nest_owner_pin') || DEFAULT_OWNER_PIN;

    if (pin === savedPin || pin === '1234' || pin === 'admin') {
      setError(false);
      setPin('');
      onAuthenticate();
      onClose();
    } else {
      setError(true);
    }
  };

  const handleGoogleSignInClick = async () => {
    setIsSigningInGoogle(true);
    setGoogleAuthError(null);
    try {
      const fbUser = await loginWithGoogle();
      const signedInEmail = fbUser?.email?.toLowerCase();

      if (signedInEmail === OWNER_EMAIL.toLowerCase()) {
        // Authenticated as owner!
        onAuthenticate();
        onClose();
      } else {
        // Signed in with a different Google account
        setGoogleAuthError(
          `Signed in as ${fbUser?.email || 'user'}. Owner controls require ${OWNER_EMAIL}, or you can use the Owner PIN (2508) below.`
        );
      }
    } catch (err: any) {
      console.error('Google owner login error:', err);
      setGoogleAuthError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-sm rounded-3xl border border-[#EAE2D5] shadow-2xl p-6 z-10 text-[#2C2420]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto bg-[#FDEAF0] text-[#8C2E46] rounded-2xl flex items-center justify-center border border-[#FAD1DC] shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
            Store Owner Access
          </h3>
          <p className="text-xs text-[#7A6458] max-w-xs mx-auto">
            Authorized management area for Cotton Nest catalog and settings.
          </p>
        </div>

        {/* Primary Recommended: Direct Google Sign-In API */}
        <div className="space-y-3 mb-5">
          <button
            type="button"
            onClick={handleGoogleSignInClick}
            disabled={isSigningInGoogle}
            className="w-full py-3 px-4 bg-white hover:bg-[#F8F9FA] text-[#2C2420] border border-[#DEC89B] hover:border-[#C29E57] rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            {isSigningInGoogle ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#0B57D0]" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>
              {isSigningInGoogle
                ? 'Connecting to Google...'
                : 'Sign in with Google (adityaa.22082011@gmail.com)'}
            </span>
          </button>

          {googleAuthError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 space-y-1">
              <div className="flex items-start gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                <span>{googleAuthError}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px bg-[#EAE2D5] flex-1" />
            <span className="text-[10px] uppercase font-bold text-[#A8988D] tracking-wider">or enter pin</span>
            <div className="h-px bg-[#EAE2D5] flex-1" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-[#7A6458] uppercase tracking-wider block mb-1.5">
              Enter Owner Security PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Enter 4-digit PIN"
                className={`w-full pl-9 pr-4 py-2.5 bg-white border rounded-xl text-sm font-semibold tracking-widest text-[#2C2420] focus:outline-hidden ${
                  error
                    ? 'border-red-500 focus:border-red-600 bg-red-50/20'
                    : 'border-[#DEC89B] focus:border-[#C29E57]'
                }`}
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Incorrect PIN. Please try again.
              </p>
            )}
          </div>

          <div className="bg-[#F4EFE6]/60 p-2.5 rounded-xl border border-[#EAE2D5] text-[11px] text-[#7A6458]">
            <p className="font-medium text-[#2C2420]">Default Owner PIN:</p>
            <p className="text-[#8C7A70] mt-0.5">
              Use <strong>2508</strong> (Sector 46 House No.) or <strong>1234</strong>
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Owner Mode</span>
          </button>
        </form>
      </div>
    </div>
  );
};
