import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatValidityDate,
  computeBannerStatus,
  parseIstTimestamp,
  validateBannerValidityPeriod,
  doesBannerMatchAudience,
  getTopEligibleCustomerBanner,
  getNextBannerTransitionDelayMs,
  splitIstDateTimeParts,
  combineIstDateTimeParts,
  HomepageBanner,
} from './banners';

const createBaseBanner = (overrides: Partial<HomepageBanner> = {}): HomepageBanner => ({
  id: 'test-1',
  campaignName: 'Test Campaign',
  category: 'Festive',
  heading: 'Test Heading',
  subtitle: 'Supporting message for Cotton Nest.',
  ctaText: 'Shop Now',
  ctaDestination: 'catalogue',
  backgroundColor: '#FAF7F2',
  textColor: '#2C2420',
  accentColor: '#8C2E46',
  textStyle: 'editorial_serif',
  textAlignment: 'center',
  targetAudience: 'all',
  priority: 1,
  status: 'active',
  isEnabled: true,
  createdAt: 1763000000000,
  updatedAt: 1763000000000,
  ...overrides,
});

test('formatValidityDate formats valid dates into IST format', () => {
  const resultFrom = formatValidityDate('2026-11-15T10:00');
  assert.match(resultFrom, /15 Nov 2026 · 10:00 AM IST/);

  const resultTo = formatValidityDate('2026-11-30T23:59');
  assert.match(resultTo, /30 Nov 2026 · 11:59 PM IST/);
});

test('formatValidityDate handles missing date gracefully', () => {
  assert.strictEqual(formatValidityDate(undefined), 'Not Set');
  assert.strictEqual(formatValidityDate('invalid-date'), 'Not Set');
});

test('parseIstTimestamp consistently treats naive datetime strings as IST (+05:30)', () => {
  const istMs = parseIstTimestamp('2026-11-15T10:00');
  const utcEquivalentMs = Date.parse('2026-11-15T04:30:00.000Z');
  assert.strictEqual(istMs, utcEquivalentMs);
});

test('splitIstDateTimeParts and combineIstDateTimeParts round-trip date & time cleanly', () => {
  assert.deepStrictEqual(splitIstDateTimeParts('2026-11-15T10:30'), {
    date: '2026-11-15',
    time: '10:30',
  });
  assert.strictEqual(combineIstDateTimeParts('2026-11-15', '10:30'), '2026-11-15T10:30');
  assert.strictEqual(combineIstDateTimeParts('', '10:30'), '');
});

test('validateBannerValidityPeriod prevents saving when end date/time is earlier than start date/time', () => {
  assert.strictEqual(
    validateBannerValidityPeriod('2026-11-15T10:00', '2026-11-15T09:59').valid,
    false
  );
  assert.strictEqual(
    validateBannerValidityPeriod('2026-11-20T10:00', '2026-11-15T23:59').valid,
    false
  );
  assert.strictEqual(
    validateBannerValidityPeriod('2026-11-15T10:00', '2026-11-15T10:00').valid,
    true
  );
  assert.strictEqual(
    validateBannerValidityPeriod('2026-11-15T10:00', '2026-11-30T23:59').valid,
    true
  );
});

test('computeBannerStatus handles start/end IST transitions and ensures OFF overrides active window', () => {
  const startIst = '2026-11-15T10:00'; // 04:30 UTC
  const endIst = '2026-11-15T18:00'; // 12:30 UTC

  const beforeStart = new Date('2026-11-15T04:29:59Z'); // 09:59:59 IST
  const duringWindow = new Date('2026-11-15T04:30:00Z'); // 10:00:00 IST
  const afterEnd = new Date('2026-11-15T12:30:01Z'); // 18:00:01 IST

  const enabledScheduledBanner = createBaseBanner({
    isEnabled: true,
    startDate: startIst,
    expiryDate: endIst,
  });

  // Start -> Active -> Expired transitions
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, beforeStart), 'scheduled');
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, duringWindow), 'active');
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, afterEnd), 'expired');

  // Admin OFF toggle strictly overrides even during active validity period
  const disabledDuringActiveWindow = { ...enabledScheduledBanner, isEnabled: false };
  assert.strictEqual(computeBannerStatus(disabledDuringActiveWindow, duringWindow), 'disabled');
});

test('doesBannerMatchAudience enforces All visitors, New users, and Registered users', () => {
  const allBanner = createBaseBanner({ targetAudience: 'all' });
  const newBanner = createBaseBanner({ targetAudience: 'new_users' });
  const regBanner = createBaseBanner({ targetAudience: 'registered_users' });

  const guestNewContext = { isAuthenticated: false, isNewUser: true };
  const signedInNewContext = { isAuthenticated: true, isNewUser: true };
  const returningRegContext = { isAuthenticated: true, isNewUser: false };

  assert.strictEqual(doesBannerMatchAudience(allBanner, guestNewContext), true);
  assert.strictEqual(doesBannerMatchAudience(allBanner, returningRegContext), true);

  assert.strictEqual(doesBannerMatchAudience(newBanner, guestNewContext), true);
  assert.strictEqual(doesBannerMatchAudience(newBanner, signedInNewContext), true);
  assert.strictEqual(doesBannerMatchAudience(newBanner, returningRegContext), false);

  assert.strictEqual(doesBannerMatchAudience(regBanner, guestNewContext), false);
  assert.strictEqual(doesBannerMatchAudience(regBanner, signedInNewContext), true);
  assert.strictEqual(doesBannerMatchAudience(regBanner, returningRegContext), true);
});

test('getTopEligibleCustomerBanner returns only single highest-priority qualifying banner and hides disabled ones', () => {
  const now = new Date('2026-11-15T06:00:00Z'); // 11:30 AM IST

  const banners: HomepageBanner[] = [
    createBaseBanner({
      id: 'p1-disabled',
      campaignName: 'Disabled Top Priority',
      priority: 1,
      isEnabled: false,
      startDate: '2026-11-15T10:00',
      expiryDate: '2026-11-20T23:59',
    }),
    createBaseBanner({
      id: 'p2-reg-only',
      campaignName: 'Registered Members Exclusive',
      priority: 2,
      isEnabled: true,
      targetAudience: 'registered_users',
      startDate: '2026-11-15T10:00',
      expiryDate: '2026-11-20T23:59',
    }),
    createBaseBanner({
      id: 'p3-all',
      campaignName: 'General Festive Banner',
      priority: 3,
      isEnabled: true,
      targetAudience: 'all',
      startDate: '2026-11-15T10:00',
      expiryDate: '2026-11-20T23:59',
    }),
  ];

  // Guest visitor: p1 is disabled, p2 requires registered user -> gets p3 ONLY
  const guestResult = getTopEligibleCustomerBanner(banners, now, {
    isAuthenticated: false,
    isNewUser: true,
  });
  assert.strictEqual(guestResult?.id, 'p3-all');

  // Signed-in visitor: p1 is disabled, p2 (priority 2) beats p3 (priority 3) -> gets p2 ONLY
  const regResult = getTopEligibleCustomerBanner(banners, now, {
    isAuthenticated: true,
    isNewUser: false,
  });
  assert.strictEqual(regResult?.id, 'p2-reg-only');

  // Re-enabling p1 makes p1 win immediately
  const updated = banners.map((b) => (b.id === 'p1-disabled' ? { ...b, isEnabled: true } : b));
  assert.strictEqual(
    getTopEligibleCustomerBanner(updated, now, { isAuthenticated: true, isNewUser: false })?.id,
    'p1-disabled'
  );
});

test('getNextBannerTransitionDelayMs computes earliest future start or expiry without polling', () => {
  const nowMs = Date.parse('2026-11-15T04:00:00.000Z'); // 09:30 AM IST
  const banners: HomepageBanner[] = [
    createBaseBanner({
      id: 'disabled-early',
      isEnabled: false,
      startDate: '2026-11-15T09:31',
    }),
    createBaseBanner({
      id: 'scheduled-next',
      isEnabled: true,
      startDate: '2026-11-15T09:40', // 10 minutes from nowMs
      expiryDate: '2026-11-15T10:00',
    }),
  ];

  const delay = getNextBannerTransitionDelayMs(banners, nowMs);
  assert.strictEqual(delay, 10 * 60 * 1000 + 250);
});
