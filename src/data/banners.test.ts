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
  to12HourTimeParts,
  from12HourTimeParts,
  istDateTimePartsToDate,
  normalizeBannerDates,
  toBannerDate,
  INITIAL_BANNERS,
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

test('INITIAL_BANNERS stores real Date instances preserving exact IST timestamps', () => {
  assert.ok(INITIAL_BANNERS[0].startDate instanceof Date);
  assert.ok(INITIAL_BANNERS[0].expiryDate instanceof Date);
  assert.strictEqual(
    (INITIAL_BANNERS[0].startDate as Date).toISOString(),
    '2026-11-15T04:30:00.000Z'
  );
  assert.strictEqual(
    (INITIAL_BANNERS[0].expiryDate as Date).toISOString(),
    '2026-11-30T18:29:00.000Z'
  );
});

test('istDateTimePartsToDate and normalizeBannerDates build high-precision Date objects with exact hours/minutes and IST offset', () => {
  const startDate = istDateTimePartsToDate('2026-11-15', '09:35');
  const endDate = istDateTimePartsToDate('2026-11-15', '14:45');

  assert.ok(startDate instanceof Date);
  assert.ok(endDate instanceof Date);
  // 09:35 AM IST = 04:05:00.000Z; 02:45 PM IST = 09:15:00.000Z
  assert.strictEqual(startDate.toISOString(), '2026-11-15T04:05:00.000Z');
  assert.strictEqual(endDate.toISOString(), '2026-11-15T09:15:00.000Z');

  // Hydrate Firestore Timestamp-like objects cleanly into real Date objects
  const firestoreStartMock = {
    toDate: () => new Date('2026-11-15T04:47:00.000Z'), // 10:17 AM IST
    seconds: 1794718020,
    nanoseconds: 0,
  };
  const firestoreEndMock = {
    seconds: Math.floor(Date.parse('2026-11-15T18:29:00.000Z') / 1000), // 11:59 PM IST
    nanoseconds: 0,
  };

  const hydrated = normalizeBannerDates(
    createBaseBanner({
      startDate: firestoreStartMock as unknown as Date,
      expiryDate: firestoreEndMock as unknown as Date,
    })
  );

  assert.ok(hydrated.startDate instanceof Date);
  assert.ok(hydrated.expiryDate instanceof Date);
  assert.strictEqual(formatValidityDate(hydrated.startDate), '15 Nov 2026 · 10:17 AM IST');
  assert.strictEqual(formatValidityDate(hydrated.expiryDate), '15 Nov 2026 · 11:59 PM IST');
  assert.deepStrictEqual(splitIstDateTimeParts(hydrated.startDate), {
    date: '2026-11-15',
    time: '10:17',
  });
  assert.deepStrictEqual(splitIstDateTimeParts(hydrated.expiryDate), {
    date: '2026-11-15',
    time: '23:59',
  });
});

test('toBannerDate handles ISO JSON-cached strings, Date instances, and empty/invalid inputs', () => {
  const fromIso = toBannerDate('2026-11-15T04:05:00.000Z');
  assert.ok(fromIso instanceof Date);
  assert.strictEqual(formatValidityDate(fromIso), '15 Nov 2026 · 9:35 AM IST');
  assert.strictEqual(toBannerDate(''), undefined);
  assert.strictEqual(toBannerDate('invalid-date'), undefined);
});

test('formatValidityDate formats valid Date objects and strings into IST format', () => {
  const resultFrom = formatValidityDate(new Date('2026-11-15T10:00:00.000+05:30'));
  assert.strictEqual(resultFrom, '15 Nov 2026 · 10:00 AM IST');

  const resultTo = formatValidityDate('2026-11-30T23:59');
  assert.strictEqual(resultTo, '30 Nov 2026 · 11:59 PM IST');
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
  assert.deepStrictEqual(splitIstDateTimeParts('2026-11-15T9:35'), {
    date: '2026-11-15',
    time: '09:35',
  });
  assert.deepStrictEqual(splitIstDateTimeParts('2026-11-15T04:05:00.000Z'), {
    date: '2026-11-15',
    time: '09:35',
  });
  assert.strictEqual(combineIstDateTimeParts('2026-11-15', '10:30'), '2026-11-15T10:30');
  assert.strictEqual(combineIstDateTimeParts('', '10:30'), '');
});

test('12-hour AM/PM exact minute conversions and Date formatting preserve 9:35 AM, 10:17 AM, 2:45 PM, and 11:59 PM without rounding', () => {
  const cases = [
    { hour12: 9, minute: 35, period: 'AM' as const, time24: '09:35', expectedDisplay: '15 Nov 2026 · 9:35 AM IST' },
    { hour12: 10, minute: 17, period: 'AM' as const, time24: '10:17', expectedDisplay: '15 Nov 2026 · 10:17 AM IST' },
    { hour12: 2, minute: 45, period: 'PM' as const, time24: '14:45', expectedDisplay: '15 Nov 2026 · 2:45 PM IST' },
    { hour12: 11, minute: 59, period: 'PM' as const, time24: '23:59', expectedDisplay: '15 Nov 2026 · 11:59 PM IST' },
    { hour12: 12, minute: 0, period: 'AM' as const, time24: '00:00', expectedDisplay: '15 Nov 2026 · 12:00 AM IST' },
    { hour12: 12, minute: 35, period: 'AM' as const, time24: '00:35', expectedDisplay: '15 Nov 2026 · 12:35 AM IST' },
    { hour12: 12, minute: 0, period: 'PM' as const, time24: '12:00', expectedDisplay: '15 Nov 2026 · 12:00 PM IST' },
    { hour12: 12, minute: 45, period: 'PM' as const, time24: '12:45', expectedDisplay: '15 Nov 2026 · 12:45 PM IST' },
  ];

  for (const c of cases) {
    const converted24 = from12HourTimeParts(c.hour12, c.minute, c.period);
    assert.strictEqual(converted24, c.time24);

    const dateObj = istDateTimePartsToDate('2026-11-15', converted24);
    assert.ok(dateObj instanceof Date);

    // Formatting matches exact saved hour & minute in IST
    assert.strictEqual(formatValidityDate(dateObj), c.expectedDisplay);

    // Reloading into editor preserves exact date, hour, minute, and period
    const split = splitIstDateTimeParts(dateObj);
    assert.deepStrictEqual(split, { date: '2026-11-15', time: c.time24 });
    assert.deepStrictEqual(to12HourTimeParts(split.time), {
      hour12: c.hour12,
      minute: c.minute,
      period: c.period,
    });
  }
});

test('validateBannerValidityPeriod prevents saving when end Date is earlier than start Date', () => {
  assert.strictEqual(
    validateBannerValidityPeriod(
      istDateTimePartsToDate('2026-11-15', '10:00'),
      istDateTimePartsToDate('2026-11-15', '09:59')
    ).valid,
    false
  );
  assert.strictEqual(
    validateBannerValidityPeriod(
      istDateTimePartsToDate('2026-11-15', '09:35'),
      istDateTimePartsToDate('2026-11-15', '09:34')
    ).valid,
    false
  );
  assert.strictEqual(
    validateBannerValidityPeriod(
      istDateTimePartsToDate('2026-11-20', '10:00'),
      istDateTimePartsToDate('2026-11-15', '23:59')
    ).valid,
    false
  );
  assert.strictEqual(
    validateBannerValidityPeriod(
      istDateTimePartsToDate('2026-11-15', '10:00'),
      istDateTimePartsToDate('2026-11-15', '10:00')
    ).valid,
    true
  );
  assert.strictEqual(
    validateBannerValidityPeriod(
      istDateTimePartsToDate('2026-11-15', '09:35'),
      istDateTimePartsToDate('2026-11-15', '14:45')
    ).valid,
    true
  );
});

test('computeBannerStatus handles millisecond-level Date comparison for IST activation and expiration and OFF override', () => {
  const startDate = istDateTimePartsToDate('2026-11-15', '09:35')!; // 04:05:00.000Z
  const endDate = istDateTimePartsToDate('2026-11-15', '14:45')!; // 09:15:00.000Z

  const oneMsBeforeStart = new Date('2026-11-15T04:04:59.999Z'); // 09:34:59.999 AM IST
  const exactStart = new Date('2026-11-15T04:05:00.000Z'); // 09:35:00.000 AM IST
  const oneMsBeforeEnd = new Date('2026-11-15T09:14:59.999Z'); // 02:44:59.999 PM IST
  const exactEnd = new Date('2026-11-15T09:15:00.000Z'); // 02:45:00.000 PM IST

  const enabledScheduledBanner = createBaseBanner({
    isEnabled: true,
    startDate,
    expiryDate: endDate,
  });

  // Start -> Active -> Expired at exact millisecond/minute boundaries
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, oneMsBeforeStart), 'scheduled');
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, exactStart), 'active');
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, oneMsBeforeEnd), 'active');
  assert.strictEqual(computeBannerStatus(enabledScheduledBanner, exactEnd), 'expired');

  // Admin OFF toggle strictly overrides even during active validity period
  const disabledDuringActiveWindow = { ...enabledScheduledBanner, isEnabled: false };
  assert.strictEqual(computeBannerStatus(disabledDuringActiveWindow, exactStart), 'disabled');
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
  const now = new Date('2026-11-15T06:00:00.000Z'); // 11:30 AM IST

  const banners: HomepageBanner[] = [
    createBaseBanner({
      id: 'p1-disabled',
      campaignName: 'Disabled Top Priority',
      priority: 1,
      isEnabled: false,
      startDate: istDateTimePartsToDate('2026-11-15', '10:00'),
      expiryDate: istDateTimePartsToDate('2026-11-20', '23:59'),
    }),
    createBaseBanner({
      id: 'p2-reg-only',
      campaignName: 'Registered Members Exclusive',
      priority: 2,
      isEnabled: true,
      targetAudience: 'registered_users',
      startDate: istDateTimePartsToDate('2026-11-15', '10:00'),
      expiryDate: istDateTimePartsToDate('2026-11-20', '23:59'),
    }),
    createBaseBanner({
      id: 'p3-all',
      campaignName: 'General Festive Banner',
      priority: 3,
      isEnabled: true,
      targetAudience: 'all',
      startDate: istDateTimePartsToDate('2026-11-15', '10:00'),
      expiryDate: istDateTimePartsToDate('2026-11-20', '23:59'),
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

test('getNextBannerTransitionDelayMs computes earliest future start or expiry down to the exact minute without polling', () => {
  const nowMs = Date.parse('2026-11-15T04:00:00.000Z'); // 09:30 AM IST
  const banners: HomepageBanner[] = [
    createBaseBanner({
      id: 'disabled-early',
      isEnabled: false,
      startDate: istDateTimePartsToDate('2026-11-15', '09:31'),
    }),
    createBaseBanner({
      id: 'scheduled-next',
      isEnabled: true,
      startDate: istDateTimePartsToDate('2026-11-15', '09:35'), // 5 minutes from nowMs
      expiryDate: istDateTimePartsToDate('2026-11-15', '14:45'),
    }),
  ];

  const delay = getNextBannerTransitionDelayMs(banners, nowMs);
  assert.strictEqual(delay, 5 * 60 * 1000 + 50);
});
