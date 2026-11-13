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
