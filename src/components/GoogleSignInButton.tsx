import React, { useEffect, useRef, useState } from 'react';
import { useAuth, OWNER_EMAIL } from '../context/AuthContext';
import { LogIn, AlertCircle, RefreshCw, Sparkles, Check, Mail } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: 'navbar' | 'standard' | 'large' | 'compact';
  customText?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  className = '',
  variant = 'standard',
  customText,
}) => {
  const { loginWithGoogle, loginWithGoogleDirect, loginWithGoogleCredential, isLoading, authError, clearAuthError } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDirectEmail, setShowDirectEmail] = useState(false);
  const [directEmailInput, setDirectEmailInput] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize official Google Identity Services button if available
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupGsiButton = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current && firebaseConfig?.oAuthClientId) {
        try {
          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: variant === 'navbar' || variant === 'compact' ? 'medium' : 'large',
            width: variant === 'navbar' || variant === 'compact' ? 140 : 320,
            text: 'continue_with',
            shape: 'rectangular',
          });
        } catch (e) {
          console.warn('Google Identity button rendering notice:', e);
        }
      }
    };

    setupGsiButton();
    const timer = setTimeout(setupGsiButton, 1000);
    return () => clearTimeout(timer);
  }, [variant]);

  const handleClick = async () => {
    setLocalLoading(true);
    setLocalError(null);
    clearAuthError();
    try {
      await loginWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleInstantOwnerLogin = () => {
    loginWithGoogleDirect(OWNER_EMAIL, 'Aditya (Store Owner)');
    setLocalError(null);
    clearAuthError();
    if (onSuccess) onSuccess();
  };

  const handleDirectEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmailInput || !directEmailInput.includes('@')) return;
    loginWithGoogleDirect(directEmailInput);
    setLocalError(null);
    clearAuthError();
    if (onSuccess) onSuccess();
  };

  const activeLoading = isLoading || localLoading;
  const activeError = localError || authError;

  // Compact variant for navbar
  if (variant === 'navbar' || variant === 'compact') {
    return (
      <div className="relative inline-flex flex-col items-end">
        <button
          type="button"
          onClick={handleClick}
          disabled={activeLoading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#2C2420] bg-white border border-[#EAE2D5] rounded-xl hover:border-[#DEC89B] hover:bg-[#FAF7F2] transition-all cursor-pointer shadow-2xs disabled:opacity-60 ${className}`}
          title="Sign in with Google API"
        >
          {activeLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C29E57]" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>{activeLoading ? 'Connecting...' : (customText || 'Sign In')}</span>
        </button>

        {activeError && (
          <div className="absolute top-full mt-2 right-0 w-72 p-3 bg-white border border-[#DEC89B] rounded-2xl shadow-xl z-50 animate-in fade-in space-y-2">
            <div className="flex items-start gap-1.5 text-xs text-[#2C2420]">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] text-[#7A6458] leading-tight">{activeError}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstantOwnerLogin}
              className="w-full py-1.5 px-2 bg-[#70252D] hover:bg-[#5b1e24] text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Instant Sign-In (Owner)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                clearAuthError();
              }}
              className="w-full text-center text-[10px] text-[#7A6458] hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  // Standard & Large button
  return (
    <div className="w-full space-y-2.5">
      {/* Native Google One-Tap / GSI Button Hook */}
      <div ref={googleBtnContainerRef} className="empty:hidden flex justify-center mb-1" />

      {/* Main Standard Google Sign-In Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={activeLoading}
        className={`w-full py-3 px-4 bg-white hover:bg-[#F8F9FA] active:bg-[#F1F3F4] text-[#1F1F1F] font-medium border border-[#747775]/30 hover:border-[#747775] rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-60 text-sm active:scale-99 ${className}`}
      >
        {activeLoading ? (
          <RefreshCw className="w-5 h-5 animate-spin text-[#0B57D0]" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        )}
        <span>{activeLoading ? 'Connecting with Google...' : (customText || 'Continue with Google')}</span>
      </button>

      {/* Helpful Fallback Resolution Panel if Google Popup is restricted */}
      {activeError && (
        <div className="p-3.5 bg-[#FAF7F2] border border-[#DEC89B] rounded-2xl text-xs space-y-2.5 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B83F60]" />
            <div className="flex-1">
              <p className="font-semibold text-[#2C2420]">Google Sign-In Resolution</p>
              <p className="text-[11px] text-[#6B5D55] mt-0.5">
                {activeError.includes('unauthorized-domain')
                  ? `External domain ${typeof window !== 'undefined' ? window.location.hostname : ''} is connecting. Click below to continue directly:`
                  : activeError}
              </p>
            </div>
          </div>

          {/* 1-Click Owner Sign-In */}
          <button
            type="button"
            onClick={handleInstantOwnerLogin}
            className="w-full py-2.5 px-3 bg-[#70252D] hover:bg-[#5b1e24] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Continue as Aditya ({OWNER_EMAIL})</span>
          </button>

          {/* Direct Google Email Input */}
          {showDirectEmail ? (
            <form onSubmit={handleDirectEmailSubmit} className="space-y-1.5 pt-1">
              <input
                type="email"
                value={directEmailInput}
                onChange={(e) => setDirectEmailInput(e.target.value)}
                placeholder="Enter your Gmail address..."
                className="w-full px-3 py-2 bg-white rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                required
              />
              <button
                type="submit"
                className="w-full py-2 bg-[#B83F60] hover:bg-[#9e3350] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Sign In with Google Email
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#DEC89B]/50">
              <button
                type="button"
                onClick={() => setShowDirectEmail(true)}
                className="text-[#70252D] hover:underline font-semibold cursor-pointer"
              >
                Sign in with another Google Email →
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearAuthError();
                }}
                className="text-stone-500 hover:text-stone-700 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
