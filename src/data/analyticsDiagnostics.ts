/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AUTHORIZED_OWNER_EMAILS = [
  'adityaa.451485@gmail.com',
  'adityaa.22082011@gmail.com',
  'cottonnest.atelier@gmail.com',
] as const;

export function isAuthorizedOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return AUTHORIZED_OWNER_EMAILS.some((e) => e === clean);
}

export interface AuthDiagnosticContext {
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
  bridgeError?: string | null;
}

export interface AnalyticsDiagnosticDetail {
  sourceKey: string;
  label: string;
  collectionPath: string;
  errorCode: string;
  rawMessage: string;
  accountStatus: string;
  ownerAuthStatus: string;
  denialReason: string;
  formattedSummary: string;
}

export function extractFirebaseErrorCode(err: unknown): string {
  const rawCode = String((err as any)?.code || '').trim();
  if (rawCode) return rawCode;
  const msg = err instanceof Error ? err.message : String(err || '');
  const lower = msg.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient permissions')) {
    return 'permission-denied';
  }
  if (lower.includes('unauthenticated')) {
    return 'unauthenticated';
  }
  if (lower.includes('unavailable') || lower.includes('offline')) {
    return 'unavailable';
  }
  if (lower.includes('quota') || lower.includes('resource-exhausted')) {
    return 'resource-exhausted';
  }
  return 'unknown';
}

export function buildAccountStatusText(auth: AuthDiagnosticContext): string {
  if (auth.primarySignedIn) {
    return `Primary Auth (${auth.firestoreProjectId}): Signed in as ${
      auth.primaryEmail || auth.primaryUid || 'Unknown user'
    } (UID: ${auth.primaryUid || '—'}, emailVerified: ${auth.primaryEmailVerified ? 'true' : 'false'})`;
  }
  if (auth.previewSignedIn) {
    return `Primary Auth (${auth.firestoreProjectId}): Not signed in (null) | Preview Auth (${auth.previewAuthProjectId}): ${
      auth.previewEmail || auth.previewUid || 'Unknown user'
    }`;
  }
  return `Not signed in to Firebase Auth for project ${auth.firestoreProjectId} (local/PIN/OTP UI session only)`;
}

export function buildOwnerAuthorizationStatusText(auth: AuthDiagnosticContext): string {
  if (auth.primarySignedIn) {
    const emailOwner = isAuthorizedOwnerEmail(auth.primaryEmail);
    if (emailOwner && auth.primaryEmailVerified) {
      return `Authorized Cotton Nest Owner (${auth.primaryEmail}) — verified primary token active${
        auth.primaryHasAdminClaim ? ' + admin claim' : ''
      }`;
    }
    if (emailOwner && !auth.primaryEmailVerified) {
      return `Owner email (${auth.primaryEmail}) on primary auth, but emailVerified is FALSE`;
    }
    if (auth.primaryHasAdminClaim) {
      return `Authorized Admin Claim active on primary auth (${auth.primaryEmail || auth.primaryUid})`;
    }
    return `Not authorized as owner (${auth.primaryEmail || auth.primaryUid || 'no email'})`;
  }

  if (auth.previewSignedIn) {
    const previewOwner = isAuthorizedOwnerEmail(auth.previewEmail);
    return previewOwner
      ? `Owner email (${auth.previewEmail}) signed into Preview Auth only — missing primary Firestore (${auth.firestoreProjectId}) ID token`
      : `Non-owner (${auth.previewEmail || 'unknown'}) on Preview Auth only — no primary Firestore token`;
  }

  return 'Unauthenticated on Firebase Auth (request.auth == null in Firestore Rules)';
}

export function buildExactDenialReason(
  collectionPath: string,
  errorCode: string,
  rawMessage: string,
  auth: AuthDiagnosticContext
): string {
  if (errorCode === 'resource-exhausted') {
    return `Firestore read/write quota exhausted for ${collectionPath} (${rawMessage}).`;
  }
  if (errorCode === 'unavailable') {
    return `Firestore network connection unavailable while reading ${collectionPath} (${rawMessage}).`;
  }

  const isPerm =
    errorCode === 'permission-denied' ||
    errorCode === 'unauthenticated' ||
    rawMessage.toLowerCase().includes('permission');

  if (!isPerm) {
    return `Firestore error [${errorCode}] on ${collectionPath}: ${rawMessage}`;
  }

  if (!auth.primarySignedIn) {
    if (auth.previewSignedIn) {
      const bridgeNote = auth.bridgeError ? ` Credential bridge error: ${auth.bridgeError}.` : '';
      return `Firestore database (${auth.firestoreProjectId}) only accepts tokens from primaryAuth, which currently has no active user because Google Sign-In ran on previewAuth (${auth.previewAuthProjectId}).${bridgeNote}`;
    }
    return `Firestore received request.auth == null on ${collectionPath} because no Firebase Google account is signed into project ${auth.firestoreProjectId} (PIN/OTP unlock does not mint a Firebase Auth ID token).`;
  }

  if (!auth.primaryEmailVerified) {
    return `Signed-in account (${auth.primaryEmail || auth.primaryUid}) has emailVerified == false, so Firestore owner rules rejected access to ${collectionPath}.`;
  }

  if (!isAuthorizedOwnerEmail(auth.primaryEmail) && !auth.primaryHasAdminClaim) {
    return `Signed-in primary account (${auth.primaryEmail || auth.primaryUid}) is not listed as an authorized Cotton Nest owner and has no admin role document/claim.`;
  }

  return `Primary owner token for ${auth.primaryEmail} (UID: ${auth.primaryUid}) reached Firestore rules for ${collectionPath} on DB ${auth.firestoreDatabaseId}, which returned ${errorCode} (${rawMessage}). Verify deployed firestore.rules use valid CEL (.lower() instead of .toLowerCase()) and are deployed to project ${auth.firestoreProjectId}.`;
}

export function buildFirestoreDiagnostic(params: {
  sourceKey: string;
  label: string;
  collectionPath: string;
  error: unknown;
  auth: AuthDiagnosticContext;
}): AnalyticsDiagnosticDetail {
  const errorCode = extractFirebaseErrorCode(params.error);
  const rawMessage =
    params.error instanceof Error ? params.error.message : String(params.error || 'Unknown Firestore error');
  const accountStatus = buildAccountStatusText(params.auth);
  const ownerAuthStatus = buildOwnerAuthorizationStatusText(params.auth);
  const denialReason = buildExactDenialReason(
    params.collectionPath,
    errorCode,
    rawMessage,
    params.auth
  );

  const formattedSummary = `${params.label} [${errorCode}] on "${params.collectionPath}": ${denialReason}`;

  return {
    sourceKey: params.sourceKey,
    label: params.label,
    collectionPath: params.collectionPath,
    errorCode,
    rawMessage,
    accountStatus,
    ownerAuthStatus,
    denialReason,
    formattedSummary,
  };
}
