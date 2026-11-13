import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BANNER_SLOTS,
  BANNER_BACKGROUND_TEMPLATES,
  FESTIVAL_OPTIONS,
  normalizeBannerSlots,
  applyFestivalSelectionToSlot,
  applyTemplateSelectionToSlot,
  fromIstDateTimeParts,
  toIstDateTimeParts,
  validateValidityWindow,
  computeSlotStatus,
  getActiveStorefrontBanner,
  getFestivalOptionById,
} from './bannerSlots';

test('normalizeBannerSlots always preserves exactly 5 predefined slots in fixed order', () => {
  const empty = normalizeBannerSlots(undefined);
  assert.equal(empty.length, 5);
  assert.deepEqual(
    empty.map((s) => s.id),
    ['welcome', 'festive', 'special_offer', 'new_collection', 'general_announcement']
  );

  // Even if someone passes extra unknown IDs or partial items, output remains strictly the 5 predefined slots
  const partial = normalizeBannerSlots([
    { id: 'festive', heading: 'Custom Diwali', enabled: true, templateId: 'festive-diwali' },
    { id: 'unknown_slot' as any, heading: 'Should Ignore' },
  ]);
  assert.equal(partial.length, 5);
  assert.equal(partial[1].heading, 'Custom Diwali');
  assert.equal(partial[1].enabled, true);
  assert.equal(partial[0].enabled, false);
});

test('every predefined category and festival has an optimized pre-designed background template', () => {
  for (const festival of FESTIVAL_OPTIONS) {
    const exists = BANNER_BACKGROUND_TEMPLATES.some((t) => t.id === festival.defaultTemplateId);
    assert.equal(exists, true, `Missing template for festival ${festival.id}`);
  }
  for (const template of BANNER_BACKGROUND_TEMPLATES) {
    assert.ok(template.imageUrl.startsWith('/images/banners/'), `Invalid path ${template.imageUrl}`);
  }
});

test('applyFestivalSelectionToSlot updates background without modifying text or auto-publishing', () => {
  const slot = {
    ...DEFAULT_BANNER_SLOTS[1],
    heading: 'My Custom Festive Heading',
    supportingMessage: 'My Custom Support Copy',
    enabled: false,
  };

  const eidUpdated = applyFestivalSelectionToSlot(slot, 'eid');
  assert.equal(eidUpdated.festivalId, 'eid');
  assert.equal(eidUpdated.templateId, getFestivalOptionById('eid').defaultTemplateId);
  assert.equal(eidUpdated.heading, 'My Custom Festive Heading');
  assert.equal(eidUpdated.supportingMessage, 'My Custom Support Copy');
  assert.equal(eidUpdated.enabled, false, 'Must never auto-publish without admin approval');
});

test('applyTemplateSelectionToSlot changes background image independently without altering banner text', () => {
  const slot = {
    ...DEFAULT_BANNER_SLOTS[0],
    heading: 'Keep This Exact Heading',
    supportingMessage: 'Keep This Exact Message',
  };

  const updated = applyTemplateSelectionToSlot(slot, 'special-offer');
  assert.equal(updated.templateId, 'special-offer');
  assert.equal(updated.heading, 'Keep This Exact Heading');
  assert.equal(updated.supportingMessage, 'Keep This Exact Message');
});

test('IST date/time helpers preserve exact minutes without rounding across all conversions', () => {
  const testTimes = ['09:35', '09:41', '10:17', '14:45', '23:59'];
  for (const time of testTimes) {
    const iso = fromIstDateTimeParts('2026-11-13', time);
    assert.ok(iso);
    assert.equal(iso, `2026-11-13T${time}:00+05:30`);
    const parts = toIstDateTimeParts(iso);
    assert.equal(parts.date, '2026-11-13');
    assert.equal(parts.time, time);
  }
});

test('validateValidityWindow rejects end earlier than or equal to start', () => {
  const start = fromIstDateTimeParts('2026-11-13', '14:00');
  const earlierEnd = fromIstDateTimeParts('2026-11-13', '13:59');
  const sameEnd = fromIstDateTimeParts('2026-11-13', '14:00');
  const laterEnd = fromIstDateTimeParts('2026-11-13', '14:01');

  assert.equal(validateValidityWindow(start, earlierEnd).valid, false);
  assert.equal(validateValidityWindow(start, sameEnd).valid, false);
  assert.equal(validateValidityWindow(start, laterEnd).valid, true);
});

test('computeSlotStatus & getActiveStorefrontBanner enforce disabled override, exact minute IST bounds, and priority', () => {
  const start = fromIstDateTimeParts('2026-11-13', '09:35');
  const end = fromIstDateTimeParts('2026-11-13', '14:45');

  const festiveSlot = {
    ...DEFAULT_BANNER_SLOTS[1],
    enabled: true,
    priority: 2,
    validFrom: start,
    validUntil: end,
  };

  assert.equal(computeSlotStatus(festiveSlot, new Date('2026-11-13T09:34:59+05:30')), 'scheduled');
  assert.equal(computeSlotStatus(festiveSlot, new Date('2026-11-13T09:35:00+05:30')), 'active');
  assert.equal(computeSlotStatus(festiveSlot, new Date('2026-11-13T14:44:59+05:30')), 'active');
  assert.equal(computeSlotStatus(festiveSlot, new Date('2026-11-13T14:45:00+05:30')), 'expired');

  // Admin OFF toggle disables banner even during active validity window
  const disabledFestive = { ...festiveSlot, enabled: false };
  assert.equal(computeSlotStatus(disabledFestive, new Date('2026-11-13T12:00:00+05:30')), 'disabled');

  // Highest priority (smallest number) active banner wins
  const welcomeSlot = {
    ...DEFAULT_BANNER_SLOTS[0],
    enabled: true,
    priority: 3,
  };
  const offerSlot = {
    ...DEFAULT_BANNER_SLOTS[2],
    enabled: true,
    priority: 1,
  };

  const chosen = getActiveStorefrontBanner(
    [welcomeSlot, festiveSlot, offerSlot],
    new Date('2026-11-13T12:00:00+05:30')
  );
  assert.equal(chosen?.id, 'special_offer');
});
