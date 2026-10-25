import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, RefreshCw } from 'lucide-react';
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
  const { loginWithGoogle, isLoading, authError, clearAuthError } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

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
          <div className="absolute top-full mt-2 right-0 w-64 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 shadow-lg z-50 animate-in fade-in">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <p>{activeError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className="mt-1 font-semibold underline text-red-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard & Large button
  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={activeLoading}
        className={`w-full py-3 px-4 bg-white hover:bg-[#F8F9FA] active:bg-[#F1F3F4] text-[#1F1F1F] font-medium border border-[#747775]/30 hover:border-[#747775] rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-60 text-sm ${className}`}
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

      {activeError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium">{activeError}</p>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={handleClick}
                className="font-semibold underline text-red-800 hover:text-red-900 cursor-pointer"
              >
                Retry Google Sign-In
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearAuthError();
                }}
                className="text-red-600 hover:text-red-700 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
