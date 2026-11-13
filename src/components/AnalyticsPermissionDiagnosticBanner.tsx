import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  KeyRound,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  AnalyticsDiagnosticDetail,
  AuthDiagnosticContext,
  buildAccountStatusText,
  buildOwnerAuthorizationStatusText,
} from '../data/analyticsDiagnostics';
import { formatLastUpdatedIST } from '../data/unifiedAnalytics';
import { AnalyticsSourceHealth, AnalyticsSourceName } from '../services/analyticsSync';
import { useAuth } from '../context/AuthContext';

interface AnalyticsPermissionDiagnosticBannerProps {
  sourceDetails: Record<string, AnalyticsDiagnosticDetail | undefined>;
  sourceStatuses: Record<AnalyticsSourceName, AnalyticsSourceHealth>;
  authDiagnostic?: AuthDiagnosticContext | null;
  lastSuccessfulSyncAt?: number | null;
  fallbackSyncError?: string | null;
  isRefreshing?: boolean;
  onRetry: () => Promise<void> | void;
}

const ORDERED_SOURCES: AnalyticsSourceName[] = [
  'traffic',
  'customer_activity',
  'orders',
  'products',
  'reviews',
  'wishlists',
];

export const AnalyticsPermissionDiagnosticBanner: React.FC<
  AnalyticsPermissionDiagnosticBannerProps
> = ({
  sourceDetails,
  sourceStatuses,
  authDiagnostic,
  lastSuccessfulSyncAt,
  fallbackSyncError,
  isRefreshing,
  onRetry,
}) => {
  const {
    primaryBridgeError,
    isPrimaryFirestoreAuthed,
    loginWithGoogle,
    refreshAuthSession,
  } = useAuth();
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);

  const failedEntries = Object.values(sourceDetails).filter(
    (d): d is AnalyticsDiagnosticDetail => Boolean(d)
  );
  const allHealthRows = ORDERED_SOURCES.map((k) => sourceStatuses[k]);
  const allowedCount = allHealthRows.filter((r) => r.status === 'allowed').length;
  const failedCount = allHealthRows.filter((r) => r.status === 'denied' || r.status === 'error').length;
  const pendingCount = allHealthRows.filter((r) => r.status === 'pending').length;

  const hasFailures = failedCount > 0 || failedEntries.length > 0 || Boolean(fallbackSyncError);
  const isExpanded = manualExpanded !== null ? manualExpanded : hasFailures;

  const trafficStatus = sourceStatuses.traffic;
  const customerActivityStatus = sourceStatuses.customer_activity;

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

  const showSignInButton =
    !isPrimaryFirestoreAuthed || (authDiagnostic && !authDiagnostic.primarySignedIn);

  const renderStatusPill = (row: AnalyticsSourceHealth) => {
    if (row.status === 'allowed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3" />
          Allowed ({row.sourceKey === 'traffic' ? `${row.recordCount} visits` : `${row.recordCount} docs`})
        </span>
      );
    }
    if (row.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px]">
          <Clock className="w-3 h-3" />
          Checking...
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-mono font-bold text-[10px]">
        <XCircle className="w-3 h-3" />
        {row.errorCode || 'denied'}
      </span>
    );
  };

  const accountStatusText = authDiagnostic
    ? buildAccountStatusText(authDiagnostic)
    : 'Checking Firebase Auth session...';
  const ownerAuthStatusText = authDiagnostic
    ? buildOwnerAuthorizationStatusText(authDiagnostic)
    : 'Verifying owner authorization...';

  return (
    <div
      className={`mt-4 p-4 sm:p-5 rounded-2xl border space-y-3 shadow-2xs transition-colors ${
        hasFailures
          ? 'bg-amber-50/95 border-amber-300 text-amber-950'
          : 'bg-[#FAF7F2] border-[#EAE2D5] text-[#2C2420]'
      }`}
    >
      {/* Top Permanent Firebase Health Summary Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-xs">
          {hasFailures ? (
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          ) : pendingCount > 0 ? (
            <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">
                Firebase Health Check:{' '}
                {hasFailures
                  ? `${failedCount} Collection(s) Restricted / Failed (${allowedCount}/6 Allowed)`
                  : pendingCount > 0
                  ? `Verifying Firestore Permissions (${allowedCount}/6 Allowed)...`
                  : 'All 6 Analytics Collections Connected & Synchronized'}
              </p>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  hasFailures
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : pendingCount > 0
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {hasFailures ? 'Action Needed' : pendingCount > 0 ? 'Syncing' : 'Healthy'}
              </span>
            </div>

            {authDiagnostic && (
              <p className="text-[11px] opacity-85 mt-0.5">
                Project: <span className="font-mono font-semibold">{authDiagnostic.firestoreProjectId}</span>{' '}
                · Database:{' '}
                <span className="font-mono text-[10px]">{authDiagnostic.firestoreDatabaseId}</span> · Last
                full sync:{' '}
                <span className="font-semibold">
                  {lastSuccessfulSyncAt && !hasFailures
                    ? formatLastUpdatedIST(lastSuccessfulSyncAt)
                    : lastSuccessfulSyncAt
                    ? `${formatLastUpdatedIST(lastSuccessfulSyncAt)} (newer retry failed)`
                    : 'Not completed cleanly yet'}
                </span>
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${
              hasFailures
                ? 'bg-amber-900 hover:bg-amber-800'
                : 'bg-[#2C2420] hover:bg-[#70252D]'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || isReauthenticating ? 'animate-spin' : ''}`}
            />
            <span>Refresh Token &amp; Retry</span>
          </button>
          <button
            type="button"
            onClick={() => setManualExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-[#DEC89B] text-[#2C2420] text-xs font-semibold cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Details' : 'Inspect Health'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Detailed Permanent Health Check Matrix */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-black/10">
          {/* Core Identity, Project & Consistency Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
            <div className="p-3 rounded-xl bg-white/90 border border-[#EAE2D5] space-y-1">
              <div className="font-bold text-[#7A6458] uppercase text-[10px] tracking-wider">
                Project &amp; Database Target
              </div>
              <div>
                <span className="font-semibold">Firebase Project ID:</span>{' '}
                <code className="font-mono font-bold text-[#2C2420]">
                  {authDiagnostic?.firestoreProjectId || 'river-fusion-rz0s9'}
                </code>
              </div>
              <div className="break-all">
                <span className="font-semibold">Firestore DB ID:</span>{' '}
                <code className="font-mono text-[10px] text-[#2C2420]">
                  {authDiagnostic?.firestoreDatabaseId ||
                    'ai-studio-remixcottonnestl-79807e95-0ce0-4626-9bba-b37acdbe97c1'}
                </code>
              </div>
              <div>
                <span className="font-semibold">Web &amp; Mobile App Consistency:</span>{' '}
                <span className={hasFailures ? 'text-amber-800 font-semibold' : 'text-emerald-800 font-semibold'}>
                  {hasFailures
                    ? `Unified DB configured, but ${failedCount} collection(s) currently failing`
                    : 'Identical single-source Firestore DB & IST rules'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/90 border border-[#EAE2D5] space-y-1">
              <div className="font-bold text-[#7A6458] uppercase text-[10px] tracking-wider">
                Owner Authentication &amp; Token
              </div>
              <div>
                <span className="font-semibold">Authenticated Account:</span>{' '}
                <span>{accountStatusText}</span>
              </div>
              <div>
                <span className="font-semibold">Owner Authorization:</span>{' '}
                <span
                  className={
                    authDiagnostic?.primarySignedIn && authDiagnostic?.primaryEmailVerified
                      ? 'text-emerald-800 font-semibold'
                      : 'text-amber-800 font-semibold'
                  }
                >
                  {ownerAuthStatusText}
                </span>
              </div>
              <div>
                <span className="font-semibold">Last Full Sync:</span>{' '}
                <span>
                  {lastSuccessfulSyncAt && !hasFailures
                    ? formatLastUpdatedIST(lastSuccessfulSyncAt)
                    : hasFailures
                    ? 'Incomplete — failing collections must succeed first'
                    : 'Pending initial snapshot'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/90 border border-[#EAE2D5] space-y-1.5">
              <div className="font-bold text-[#7A6458] uppercase text-[10px] tracking-wider">
                Priority Collection Permissions
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Site Traffic ({trafficStatus.collectionPath}):</span>
                {renderStatusPill(trafficStatus)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Customer Activity ({customerActivityStatus.collectionPath}):
                </span>
                {renderStatusPill(customerActivityStatus)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Orders ({sourceStatuses.orders.collectionPath}):</span>
                {renderStatusPill(sourceStatuses.orders)}
              </div>
            </div>
          </div>

          {/* All 6 Collections Individual Permission & Error Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {allHealthRows.map((row) => (
              <div
                key={row.sourceKey}
                className={`p-3 rounded-xl bg-white/95 border text-[11px] space-y-1.5 ${
                  row.status === 'denied' || row.status === 'error'
                    ? 'border-rose-300'
                    : 'border-[#EAE2D5]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-stone-100">
                  <span className="font-bold text-[#2C2420] flex items-center gap-1.5">
                    <ShieldAlert
                      className={`w-3.5 h-3.5 ${
                        row.status === 'allowed' ? 'text-emerald-700' : 'text-[#8C2E46]'
                      }`}
                    />
                    {row.label}
                  </span>
                  {renderStatusPill(row)}
                </div>

                <div>
                  <span className="font-semibold text-stone-900">Collection Path:</span>{' '}
                  <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-900">
                    {row.collectionPath}
                  </code>
                </div>

                {row.detail ? (
                  <div className="space-y-1 text-stone-700 leading-relaxed">
                    <div>
                      <span className="font-semibold text-stone-900">Firebase Code:</span>{' '}
                      <code className="font-mono text-rose-800 font-bold">{row.detail.errorCode}</code>
                    </div>
                    <div>
                      <span className="font-semibold text-stone-900">Reason Denied:</span>{' '}
                      <span className="text-rose-900">{row.detail.denialReason}</span>
                    </div>
                  </div>
                ) : row.status === 'allowed' ? (
                  <div className="text-emerald-800">
                    Read &amp; real-time listener verified ({row.recordCount} record(s) synced).
                  </div>
                ) : (
                  <div className="text-stone-600">Awaiting Firestore server response...</div>
                )}
              </div>
            ))}
          </div>

          {fallbackSyncError && failedEntries.length === 0 && (
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
      )}
    </div>
  );
};
