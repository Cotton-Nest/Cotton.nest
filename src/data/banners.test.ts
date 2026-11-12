import { test } from 'node:test';
import assert from 'node:assert';
import { formatValidityDate, computeBannerStatus, HomepageBanner } from './banners';

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

test('computeBannerStatus correctly evaluates scheduled, active, expired, and disabled', () => {
  const now = new Date('2026-11-20T12:00:00Z');

  const baseBanner: HomepageBanner = {
    id: 'test-1',
    campaignName: 'Test',
    category: 'Diwali',
    heading: 'Heading',
    subtitle: 'Subtitle',
    ctaText: 'CTA',
    ctaDestination: 'catalogue',
    backgroundColor: '#fff',
    textColor: '#000',
    textAlignment: 'center',
    priority: 1,
    status: 'active',
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Disabled
  assert.strictEqual(computeBannerStatus({ ...baseBanner, isEnabled: false }, now), 'disabled');

  // Scheduled (future start)
  assert.strictEqual(
    computeBannerStatus({ ...baseBanner, startDate: '2026-11-25T10:00:00Z' }, now),
    'scheduled'
  );

  // Expired (past expiry)
  assert.strictEqual(
    computeBannerStatus({ ...baseBanner, expiryDate: '2026-11-15T10:00:00Z' }, now),
    'expired'
  );

  // Active (within valid window)
  assert.strictEqual(
    computeBannerStatus(
      {
        ...baseBanner,
        startDate: '2026-11-15T10:00:00Z',
        expiryDate: '2026-11-25T10:00:00Z',
      },
      now
    ),
    'active'
  );
});
