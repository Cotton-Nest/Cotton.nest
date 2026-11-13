import { test } from 'node:test';
import assert from 'node:assert';
import {
  shouldShowExitBannerOnBackPress,
  shouldArmHomeGuard,
  shouldConfirmExitOnBackPress,
  executeAppExitSequence,
} from './exitBannerNavigation';

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

test('shouldArmHomeGuard avoids duplicate guards and skips non-home/overlay/exiting states', () => {
  assert.strictEqual(
    shouldArmHomeGuard({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: false,
      historyState: { cn_home_root: true },
    }),
    true
  );

  assert.strictEqual(
    shouldArmHomeGuard({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: false,
      historyState: { cn_home_guard: true },
    }),
    false
  );

  assert.strictEqual(
    shouldArmHomeGuard({
      activeTab: 'catalogue',
      tabHistoryLength: 0,
      hasOpenOverlay: false,
      isExitBannerOpen: false,
      isExiting: false,
      historyState: { cn_home_root: true },
    }),
    false
  );

  assert.strictEqual(
    shouldArmHomeGuard({
      activeTab: 'home',
      tabHistoryLength: 0,
      hasOpenOverlay: true,
      isExitBannerOpen: false,
      isExiting: false,
      historyState: { cn_home_root: true },
    }),
    false
  );
});

test('shouldConfirmExitOnBackPress triggers exit when back is pressed while exit banner is open', () => {
  assert.strictEqual(
    shouldConfirmExitOnBackPress({
      isExitBannerOpen: true,
      isExiting: false,
      poppedState: { cn_home_root: true },
    }),
    true
  );

  assert.strictEqual(
    shouldConfirmExitOnBackPress({
      isExitBannerOpen: true,
      isExiting: false,
      poppedState: { cn_home_guard: true },
    }),
    false
  );

  assert.strictEqual(
    shouldConfirmExitOnBackPress({
      isExitBannerOpen: true,
      isExiting: true,
      poppedState: null,
    }),
    false
  );
});

test('executeAppExitSequence synchronously triggers close, WebView bridges, and prior history back', () => {
  let closed = false;
  let androidExited = false;
  let historyDelta = 0;

  const mockWin = {
    close: () => {
      closed = true;
    },
    Android: {
      exitApp: () => {
        androidExited = true;
      },
    },
    navigator: {},
    history: {
      state: { cn_home_root: true },
      go: (delta: number) => {
        historyDelta = delta;
      },
      back: () => {
        historyDelta = -1;
      },
    },
  } as unknown as Window;

  executeAppExitSequence(mockWin, { hasPriorHistory: true });

  assert.strictEqual(closed, true);
  assert.strictEqual(androidExited, true);
  assert.strictEqual(historyDelta, -1);
});
