import test from 'node:test';
import assert from 'node:assert/strict';

function detectFestiveType(name?: string, badge?: string, themeId?: string) {
  const combined = `${name || ''} ${badge || ''} ${themeId || ''}`.toLowerCase();
  // Check christmas / winter first or use regex word boundary for holi so "holiday" isn't matched as "holi"
  if (combined.includes('christmas') || combined.includes('xmas') || combined.includes('winter') || combined.includes('holiday')) {
    return 'christmas';
  }
  if (/\b(holi|gulal|rang|dhuleti)\b/i.test(combined) || combined.includes('colors of joy')) {
    return 'holi';
  }
  if (combined.includes('eid') || combined.includes('mubarak') || combined.includes('ramadan')) {
    return 'eid';
  }
  return 'diwali';
}

test('detectFestiveType correctly identifies festivals', () => {
  // Diwali detection
  assert.equal(detectFestiveType('Diwali Fest', 'Festive Special', 'classic'), 'diwali');
  assert.equal(detectFestiveType('Deepavali Sale', 'Special', 'luxury'), 'diwali');
  assert.equal(detectFestiveType('Festive Deals', 'Diwali Dhamaka', 'classic'), 'diwali');

  // Holi detection
  assert.equal(detectFestiveType('Holi Colors of Joy', 'Holi Utsav', 'classic'), 'holi');
  assert.equal(detectFestiveType('Spring Collection', 'Gulal Special', 'classic'), 'holi');
  assert.equal(detectFestiveType('Bedsheet Sale', 'Offers', 'holi'), 'holi');

  // Christmas / Winter detection
  assert.equal(detectFestiveType('Christmas & Winter Joy', 'Holiday Exclusive', 'classic'), 'christmas');
  assert.equal(detectFestiveType('Xmas Sale', 'Winter Cozy', 'classic'), 'christmas');

  // Eid detection
  assert.equal(detectFestiveType('Eid Mubarak Celebration', 'Regal Festive', 'classic'), 'eid');
});
