import React, { useState } from 'react';
import { AlertTriangle, KeyRound, LogIn, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  AnalyticsDiagnosticDetail,
  AuthDiagnosticContext,
} from '../data/analyticsDiagnostics';
import { useAuth } from '../context/AuthContext';

interface AnalyticsPermissionDiagnosticBannerProps {
  sourceDetails: Record<string, AnalyticsDiagnosticDetail | undefined>;
  authDiagnostic?: AuthDiagnosticContext | null;
  fallbackSyncError?: string | null;
  isRefreshing?: boolean;
  onRetry: () => Promise<void> | void;
}

export const AnalyticsPermissionDiagnosticBanner: React.FC<
  AnalyticsPermissionDiagnosticBannerProps
> = ({ sourceDetails, authDiagnostic, fallbackSyncError, isRefreshing, onRetry }) => {
  const {
    primaryBridgeError,
    isPrimaryFirestoreAuthed,
    loginWithGoogle,
    refreshAuthSession,
  } = useAuth();
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  const entries = Object.values(sourceDetails).filter(
    (d): d is AnalyticsDiagnosticDetail => Boolean(d)
  );

  if (entries.length === 0 && !fallbackSyncError) {
    return null;
  }

  const handleRefreshTokenAndRetry = async () => {
    setIsReauthenticating(true);
    try {
      await refreshAuthSession();
      await onRetry();
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleSignInGoogleOwner = async () => {
    setIsReauthenticating(true);
    try {
      await loginWithGoogle();
      await refreshAuthSession();
      await onRetry();
    } finally {
      setIsReauthenticating(false);
    }
  };

  const showSignInButton = !isPrimaryFirestoreAuthed || (authDiagnostic && !authDiagnostic.primarySignedIn);

  return (
    <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-amber-50/95 border border-amber-300 text-amber-950 space-y-3 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-950">
              Firebase Analytics Access Diagnostics — Some Collections Could Not Sync
            </p>
            {authDiagnostic && (
              <p className="text-[11px] text-amber-900 mt-0.5">
                Project: <span className="font-mono font-semibold">{authDiagnostic.firestoreProjectId}</span>{' '}
                · DB:{' '}
                <span className="font-mono text-[10px]">{authDiagnostic.firestoreDatabaseId}</span>
                {authDiagnostic.tokenRefreshedAt && (
                  <>
                    {' '}
                    · Token checked{' '}
                    {new Date(authDiagnostic.tokenRefreshedAt).toLocaleTimeString('en-IN')}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {showSignInButton && (
            <button
              type="button"
              onClick={handleSignInGoogleOwner}
              disabled={isReauthenticating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#70252D] hover:bg-[#852C36] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isReauthenticating ? 'Signing in...' : 'Sign in Owner Google'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRefreshTokenAndRetry}
            disabled={isRefreshing || isReauthenticating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isReauthenticating ? 'animate-spin' : ''}`} />
            <span>Refresh Token &amp; Retry</span>
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entries.map((item) => (
            <div
              key={item.sourceKey}
              className="p-3 rounded-xl bg-white/90 border border-amber-200/90 text-[11px] space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-amber-100">
                <span className="font-bold text-[#2C2420] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#8C2E46]" />
                  {item.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-mono font-bold text-[10px]">
                  {item.errorCode}
                </span>
              </div>

              <div className="space-y-1 text-stone-700 leading-relaxed">
                <div>
                  <span className="font-semibold text-stone-900">Collection:</span>{' '}
                  <code className="font-mono bg-amber-50 px-1 py-0.5 rounded text-amber-950">
                    {item.collectionPath}
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-stone-900">Account Status:</span>{' '}
                  <span>{item.accountStatus}</span>
                </div>
                <div>
                  <span className="font-semibold text-stone-900">Owner Authorization:</span>{' '}
                  <span>{item.ownerAuthStatus}</span>
                </div>
                <div>
                  <span className="font-semibold text-stone-900">Reason Denied:</span>{' '}
                  <span className="text-rose-900">{item.denialReason}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-white/80 border border-amber-200 text-xs text-amber-950">
          {fallbackSyncError}
        </div>
      )}

      {primaryBridgeError && (
        <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
          <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Cross-Project Auth Bridge Notice:</span>{' '}
            <span className="font-mono text-[10px]">{primaryBridgeError}</span>
          </div>
        </div>
      )}
    </div>
  );
};
