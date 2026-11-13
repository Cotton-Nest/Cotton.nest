import { test } from 'node:test';
import assert from 'node:assert';
import { shouldShowExitBannerOnBackPress } from './exitBannerNavigation';

test('shows exit banner ONLY on home screen with empty history, no open overlays, and not already exiting/open', () => {
  assert.strictEqual(
    shouldShowExitBannerOnBackPress({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: false,
    }),
    true
  );
});

test('never shows exit banner while navigating internal pages or when tab history remains', () => {
  const internalTabs = ['catalogue', 'seasonal', 'story', 'store', 'orders', 'tc', 'reviews', 'analytics'];
  for (const tab of internalTabs) {
    assert.strictEqual(
      shouldShowExitBannerOnBackPress({
        activeTab: tab,
        tabHistoryLength: 0,
        hasOpenOverlay: false,
        isExitBannerOpen: false,
        isExiting: false,
      }),
      false
    );
  }

  assert.strictEqual(
    shouldShowExitBannerOnBackPress({
      activeTab: 'home',
      tabHistoryLength: 1,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: false,
    }),
    false
  );
});

test('never shows exit banner when login, checkout, cart, order modal, or lightbox overlay is open', () => {
  assert.strictEqual(
    shouldShowExitBannerOnBackPress({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: true,
      isExitBannerOpen: false,
      isExiting: false,
    }),
    false
  );
});

test('does not repeatedly show exit banner during the same exit attempt', () => {
  assert.strictEqual(
    shouldShowExitBannerOnBackPress({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: true,
      isExiting: false,
    }),
    false
  );

  assert.strictEqual(
    shouldShowExitBannerOnBackPress({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: true,
    }),
    false
  );
});
