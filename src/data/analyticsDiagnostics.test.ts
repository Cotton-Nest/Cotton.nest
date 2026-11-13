import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AuthDiagnosticContext,
  buildFirestoreDiagnostic,
  extractFirebaseErrorCode,
  isAuthorizedOwnerEmail,
} from './analyticsDiagnostics';

const baseAuth: AuthDiagnosticContext = {
  firestoreProjectId: 'river-fusion-rz0s9',
  firestoreDatabaseId: 'ai-studio-remixcottonnestl-79807e95-0ce0-4626-9bba-b37acdbe97c1',
  previewAuthProjectId: 'gen-lang-client-0838797128',
  primarySignedIn: false,
  primaryUid: null,
  primaryEmail: null,
  primaryEmailVerified: false,
  primaryHasAdminClaim: false,
  previewSignedIn: false,
  previewUid: null,
  previewEmail: null,
  previewEmailVerified: false,
  tokenRefreshedAt: null,
  bridgeError: null,
};

test('isAuthorizedOwnerEmail recognizes canonical Cotton Nest owners case-insensitively', () => {
  assert.equal(isAuthorizedOwnerEmail('Adityaa.451485@gmail.com '), true);
  assert.equal(isAuthorizedOwnerEmail('cottonnest.atelier@gmail.com'), true);
  assert.equal(isAuthorizedOwnerEmail('customer@example.com'), false);
  assert.equal(isAuthorizedOwnerEmail(null), false);
});

test('extractFirebaseErrorCode extracts Firestore error code or maps fallback messages', () => {
  assert.equal(
    extractFirebaseErrorCode({ code: 'permission-denied', message: 'Missing permissions' }),
    'permission-denied'
  );
  assert.equal(
    extractFirebaseErrorCode(new Error('Missing or insufficient permissions.')),
    'permission-denied'
  );
  assert.equal(extractFirebaseErrorCode({ code: 'unavailable', message: 'offline' }), 'unavailable');
});

test('buildFirestoreDiagnostic reports preview-only vs primary-auth split accurately', () => {
  const diag = buildFirestoreDiagnostic({
    sourceKey: 'traffic',
    label: 'Site Traffic',
    collectionPath: 'analytics/site_traffic',
    error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    auth: {
      ...baseAuth,
      previewSignedIn: true,
      previewUid: 'prev_uid_1',
      previewEmail: 'adityaa.451485@gmail.com',
      previewEmailVerified: true,
      bridgeError: '[auth/invalid-credential] audience mismatch',
    },
  });

  assert.equal(diag.errorCode, 'permission-denied');
  assert.equal(diag.collectionPath, 'analytics/site_traffic');
  assert.match(diag.accountStatus, /Primary Auth \(river-fusion-rz0s9\): Not signed in/);
  assert.match(diag.accountStatus, /Preview Auth \(gen-lang-client-0838797128\): adityaa\.451485@gmail\.com/);
  assert.match(diag.ownerAuthStatus, /missing primary Firestore/i);
  assert.match(diag.denialReason, /invalid-credential/);
});

test('buildFirestoreDiagnostic reports verified primary owner denial with CEL/rules context', () => {
  const diag = buildFirestoreDiagnostic({
    sourceKey: 'customer_activity',
    label: 'Customer Activity',
    collectionPath: 'customer_activity',
    error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    auth: {
      ...baseAuth,
      primarySignedIn: true,
      primaryUid: 'owner_uid_123',
      primaryEmail: 'adityaa.451485@gmail.com',
      primaryEmailVerified: true,
    },
  });

  assert.equal(diag.errorCode, 'permission-denied');
  assert.equal(diag.collectionPath, 'customer_activity');
  assert.match(diag.ownerAuthStatus, /Authorized Cotton Nest Owner/);
  assert.match(diag.denialReason, /\.lower\(\)/);
  assert.match(diag.denialReason, /owner_uid_123/);
});

test('buildFirestoreDiagnostic reports unverified email, unauthenticated PIN-only, and custom claims properly', () => {
  const pinOnly = buildFirestoreDiagnostic({
    sourceKey: 'orders',
    label: 'Orders',
    collectionPath: 'orders',
    error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    auth: baseAuth,
  });
  assert.match(pinOnly.denialReason, /request\.auth == null/);

  const unverified = buildFirestoreDiagnostic({
    sourceKey: 'traffic',
    label: 'Site Traffic',
    collectionPath: 'analytics/site_traffic',
    error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    auth: {
      ...baseAuth,
      primarySignedIn: true,
      primaryUid: 'u1',
      primaryEmail: 'adityaa.451485@gmail.com',
      primaryEmailVerified: false,
    },
  });
  assert.match(unverified.denialReason, /emailVerified == false/);

  const customClaimAdmin = buildFirestoreDiagnostic({
    sourceKey: 'traffic',
    label: 'Site Traffic',
    collectionPath: 'analytics/site_traffic',
    error: { code: 'unavailable', message: 'network timeout' },
    auth: {
      ...baseAuth,
      primarySignedIn: true,
      primaryUid: 'u2',
      primaryEmail: 'staff@cottonnest.in',
      primaryEmailVerified: true,
      primaryHasAdminClaim: true,
    },
  });
  assert.equal(customClaimAdmin.errorCode, 'unavailable');
  assert.match(customClaimAdmin.ownerAuthStatus, /Admin Claim active/);
});

test('firestore.rules avoids unsupported .toLowerCase() and preserves private analytics security', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  assert.equal(
    rulesText.includes('.toLowerCase('),
    false,
    'firestore.rules must never use unsupported JavaScript .toLowerCase()'
  );
  assert.match(rulesText, /request\.auth\.token\.email\.lower\(\)\s*==\s*'adityaa\.451485@gmail\.com'/);
  assert.match(rulesText, /request\.auth\.token\.email\.lower\(\)\s*==\s*'adityaa\.22082011@gmail\.com'/);
  assert.match(rulesText, /request\.auth\.token\.email\.lower\(\)\s*==\s*'cottonnest\.atelier@gmail\.com'/);

  // Extract analytics match block and ensure it is never publicly readable
  const analyticsBlockMatch = rulesText.match(/match \/analytics\/\{docId\}\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(analyticsBlockMatch, 'analytics match block must exist in firestore.rules');
  assert.equal(/allow\s+read\s*:\s*if\s+true/.test(analyticsBlockMatch[0]), false);
  assert.match(analyticsBlockMatch[0], /allow get:.*isOwnerOrAdmin\(\)/);
  assert.match(analyticsBlockMatch[0], /allow list:\s*if\s+isOwnerClaimOrEmail\(\)/);

  // Extract customer_activity match block and ensure it is never publicly readable
  const activityBlockMatch = rulesText.match(/match \/customer_activity\/\{userId\}\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(activityBlockMatch, 'customer_activity match block must exist in firestore.rules');
  assert.equal(/allow\s+read\s*:\s*if\s+true/.test(activityBlockMatch[0]), false);
  assert.match(activityBlockMatch[0], /allow list:\s*if\s+isOwnerClaimOrEmail\(\)/);

  // Ensure firebase-applet-config.json targets the exact Cotton Nest project and database
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(fbConfig.projectId, 'river-fusion-rz0s9');
  assert.equal(
    fbConfig.firestoreDatabaseId,
    'ai-studio-remixcottonnestl-79807e95-0ce0-4626-9bba-b37acdbe97c1'
  );
});

