export interface ExitBannerCheckParams {
  activeTab: string;
  tabHistoryLength: number;
  hasOpenOverlay: boolean;
  isExitBannerOpen: boolean;
  isExiting: boolean;
}

/**
 * Pure predicate determining whether an Android / browser back press
 * should display the Cotton Nest exit confirmation banner.
 *
 * Strictly displays ONLY when:
 * - User is on the 'home' screen
 * - No internal page navigation history remains
 * - No overlay / modal / drawer (cart, login, product details, lightbox, admin) is open
 * - The exit banner is not already open and app is not already exiting
 */
export function shouldShowExitBannerOnBackPress(params: ExitBannerCheckParams): boolean {
  const {
    activeTab,
    tabHistoryLength,
    hasOpenOverlay,
    isExitBannerOpen,
    isExiting,
  } = params;

  if (hasOpenOverlay) return false;
  if (isExitBannerOpen || isExiting) return false;
  if (activeTab !== 'home') return false;
  if (tabHistoryLength > 0) return false;

  return true;
}

export interface ArmHomeGuardParams {
  activeTab: string;
  tabHistoryLength: number;
  hasOpenOverlay: boolean;
  isExitBannerOpen: boolean;
  isExiting: boolean;
  historyState: Record<string, unknown> | null | undefined;
}

/**
 * Pure predicate determining whether the single 'cn_home_guard' history entry
 * can be safely armed without duplicating guards or interfering with internal pages/overlays.
 */
export function shouldArmHomeGuard(params: ArmHomeGuardParams): boolean {
  const {
    activeTab,
    tabHistoryLength,
    hasOpenOverlay,
    isExitBannerOpen,
    isExiting,
    historyState,
  } = params;

  if (isExiting || isExitBannerOpen) return false;
  if (hasOpenOverlay) return false;
  if (activeTab !== 'home' || tabHistoryLength > 0) return false;
  if (
    historyState?.cn_home_guard ||
    historyState?.cn_nav_tab ||
    historyState?.cn_nav_overlay
  ) {
    return false;
  }

  return true;
}

export interface ConfirmExitOnBackParams {
  isExitBannerOpen: boolean;
  isExiting: boolean;
  poppedState: Record<string, unknown> | null | undefined;
}

/**
 * When the exit banner is already open and the user presses Back again
 * (not Forward onto cn_home_guard), proceed cleanly with app exit.
 */
export function shouldConfirmExitOnBackPress(params: ConfirmExitOnBackParams): boolean {
  const { isExitBannerOpen, isExiting, poppedState } = params;
  if (!isExitBannerOpen || isExiting) return false;
  if (poppedState?.cn_home_guard) return false;
  return true;
}

/**
 * Synchronously triggers native WebView / Capacitor / Cordova / PWA window exit
 * inside a user-activation gesture, plus history back when prior external history exists.
 */
export function executeAppExitSequence(
  win: Window,
  options: { hasPriorHistory: boolean }
): void {
  const anyWin = win as unknown as Record<string, any>;
  const anyNav = win.navigator as unknown as Record<string, any>;

  // 1. Native Android / Hybrid WebView bridges
  try {
    anyWin.Android?.exitApp?.();
    anyWin.AndroidInterface?.exitApp?.();
    anyWin.AppBridge?.exitApp?.();
    anyWin.Capacitor?.Plugins?.App?.exitApp?.();
    anyNav.app?.exitApp?.();
    if (typeof anyWin.ReactNativeWebView?.postMessage === 'function') {
      anyWin.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EXIT_APP' }));
    }
  } catch {
    // ignore bridge errors
  }

  // 2. Synchronous window.close() preserves browser user activation (standalone PWAs / popups)
  try {
    win.close();
  } catch {
    // ignore
  }

  // 3. Navigate back past Cotton Nest root if prior browser history exists or guard is still top
  try {
    const hasGuardActive = Boolean(win.history?.state?.cn_home_guard);
    if (options.hasPriorHistory) {
      win.history.go(hasGuardActive ? -2 : -1);
    } else if (hasGuardActive) {
      win.history.back();
    }
  } catch {
    // ignore
  }
}
