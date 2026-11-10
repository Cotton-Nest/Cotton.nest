import React, { useState, useEffect } from 'react';
import { Download, X, CheckCircle2, Smartphone, Share, PlusSquare, Sparkles, Copy, Check, MoreVertical, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

type GuideMode = 'ios' | 'unsupported' | 'already-installed' | null;

/**
 * Top-Right "Install app?" Pop-out & Platform-Aware Installation Guide Modal
 * CRITICAL: Never downloads index.html, an HTML document, or any source file.
 * - Android / Chrome: Uses native `beforeinstallprompt` event.
 * - iOS / Safari: Displays step-by-step Safari "Add to Home Screen" installation guide.
 * - Already Installed: Shows "App Already Installed" without prompting again.
 * - Unsupported Browser: Displays a helpful installation message.
 */
export const ChromeInstallPopout: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const hostName = typeof window !== 'undefined' ? window.location.host : 'cottonnest.in';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInstalled) {
      setVisible(false);
      return;
    }
    const dismissed = sessionStorage.getItem('cotton_nest_chrome_install_dismissed');
    if (!dismissed && (isInstallable || isIOS)) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isInstalled, isInstallable, isIOS]);

  // Listen for custom events dispatched by any Download App button
  useEffect(() => {
    const handleOpenInstallGuide = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: GuideMode }>).detail;
      if (detail?.mode) {
        setGuideMode(detail.mode);
        return;
      }
      if (isInstalled) {
        setGuideMode('already-installed');
      } else if (isIOS) {
        setGuideMode('ios');
      } else {
        setGuideMode('unsupported');
      }
    };

    window.addEventListener('open-pwa-install-guide', handleOpenInstallGuide);
    window.addEventListener('open-ios-homescreen-guide', handleOpenInstallGuide);
    return () => {
      window.removeEventListener('open-pwa-install-guide', handleOpenInstallGuide);
      window.removeEventListener('open-ios-homescreen-guide', handleOpenInstallGuide);
    };
  }, [isIOS, isInstalled]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('cotton_nest_chrome_install_dismissed', '1');
    } catch {}
  };

  const handleInstallClick = async () => {
    if (isInstalled) {
      setVisible(false);
      setGuideMode('already-installed');
      return;
    }

    if (isIOS && !isInstallable) {
      setVisible(false);
      setGuideMode('ios');
      return;
    }

    setInstalling(true);
    const outcome = await install();
    setInstalling(false);

    if (outcome === 'accepted') {
      setInstalledSuccess(true);
      setTimeout(() => {
        setVisible(false);
        setInstalledSuccess(false);
      }, 3000);
      return;
    }

    if (outcome === 'already-installed') {
      setVisible(false);
      setGuideMode('already-installed');
      return;
    }

    if (outcome === 'unsupported') {
      setVisible(false);
      setGuideMode(isIOS ? 'ios' : 'unsupported');
    }
  };

  const handleCopyAppUrl = async () => {
    if (!appUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {}
  };

  return (
    <>
      <AnimatePresence>
        {visible && (!isInstalled || installedSuccess) && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed top-3 right-3 sm:right-6 z-[9998] w-[calc(100vw-1.5rem)] max-w-[340px] bg-white text-[#202124] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.24)] border border-[#dadce0] p-4 font-sans"
            role="dialog"
            aria-label="Install Cotton Nest app"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="text-[15px] font-medium leading-snug text-[#202124]">
                {installedSuccess
                  ? 'App Already Installed'
                  : isIOS
                  ? 'Install Cotton Nest on iOS'
                  : 'Download Cotton Nest App?'}
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[#5f6368] hover:text-[#202124] p-0.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close install prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* App Info Row with Icon, Title & Host */}
            <div className="flex items-center gap-3.5 mb-4">
              <img
                src="/apple-touch-icon.png"
                alt="Cotton Nest App Icon"
                className="w-11 h-11 rounded-xl object-contain border border-[#e8eaed] bg-[#FAF7F2] p-1 shrink-0 shadow-2xs"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[#202124] truncate">
                  Cotton Nest — Luxury Bed Linens
                </div>
                <div className="text-[12px] text-[#5f6368] truncate">
                  {hostName}
                </div>
              </div>
            </div>

            {installedSuccess ? (
              <div className="flex items-center gap-2 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>App Already Installed on your device!</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-1.5 rounded-full border border-[#dadce0] text-[#5f6368] hover:bg-gray-50 text-[13px] font-medium transition-colors cursor-pointer"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="px-5 py-1.5 rounded-full bg-[#8C2E46] hover:bg-[#70252D] text-white text-[13px] font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isIOS ? <PlusSquare className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{installing ? 'Installing...' : 'Download App'}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform-Aware Installation Guide & Status Modal (Never downloads .html) */}
      <AnimatePresence>
        {guideMode !== null && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="w-full max-w-md rounded-3xl bg-[#FAF7F2] p-5 sm:p-6 shadow-2xl border border-[#DEC89B] text-[#2C2420]"
              role="dialog"
              aria-label="Cotton Nest App Installation"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src="/apple-touch-icon.png"
                      alt="Cotton Nest App Icon"
                      className="w-14 h-14 rounded-2xl border border-[#DEC89B] bg-white p-1.5 shadow-md"
                    />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8C2E46] text-white flex items-center justify-center shadow-xs">
                      <Sparkles className="w-3 h-3" />
                    </span>
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-[#70252D] border border-amber-200 mb-1">
                      {guideMode === 'already-installed'
                        ? 'Installed Web App'
                        : guideMode === 'ios'
                        ? 'iOS & Safari Guide'
                        : 'Web App Installation'}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-[#2C2420] leading-tight">
                      {guideMode === 'already-installed'
                        ? 'App Already Installed'
                        : guideMode === 'ios'
                        ? 'Install Cotton Nest on iOS'
                        : 'Install Cotton Nest App'}
                    </h3>
                    <p className="text-xs text-[#7A6458]">
                      {guideMode === 'already-installed'
                        ? 'Cotton Nest is already installed on your device'
                        : guideMode === 'ios'
                        ? 'Follow these steps to add Cotton Nest to your Home Screen'
                        : 'How to add Cotton Nest to your device Home Screen'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideMode(null)}
                  className="p-1.5 rounded-full text-[#7A6458] hover:text-[#2C2420] hover:bg-[#EAE2D5]/60 transition-colors cursor-pointer"
                  aria-label="Close installation guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode 1: Already Installed */}
              {guideMode === 'already-installed' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>App Already Installed</span>
                  </div>
                  <p className="leading-relaxed text-emerald-800">
                    Cotton Nest is already installed on your device. You can open it anytime directly from your Home Screen or App Launcher.
                  </p>
                </div>
              )}

              {/* Mode 2: iOS / Safari 5-Step Installation Guide */}
              {guideMode === 'ios' && (
                <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#2C2420]">
                        Open Cotton Nest in Safari.
                      </p>
                      <p className="text-[11px] text-[#7A6458] mt-0.5">
                        Use the Safari browser on your iPhone or iPad for Home Screen app installation.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#F4EFE6]" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#2C2420] flex items-center gap-1.5 flex-wrap">
                        <span>Tap the</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                          <Share className="w-3.5 h-3.5" /> Share
                        </span>
                        <span>icon.</span>
                      </p>
                      <p className="text-[11px] text-[#7A6458] mt-0.5">
                        Located at the bottom navigation bar in Safari (or top bar on iPad).
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#F4EFE6]" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#2C2420] flex items-center gap-1.5 flex-wrap">
                        <span>Select</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                          <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#F4EFE6]" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#2C2420]">
                        Enable <span className="text-emerald-700 font-bold">Open as Web App</span> if available.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#F4EFE6]" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      5
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#2C2420]">
                        Tap <span className="text-blue-600 font-bold">Add</span>.
                      </p>
                      <p className="text-[11px] text-[#7A6458] mt-0.5">
                        Cotton Nest will appear on your Home Screen as a standalone app.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 3: Unsupported / Browser Menu Fallback (No file download) */}
              {guideMode === 'unsupported' && (
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs text-xs">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Direct one-tap installation is not supported in this browser view. You can install the Cotton Nest app using your browser menu:
                    </p>
                  </div>

                  {isAndroid ? (
                    <div className="space-y-2 pt-1">
                      <p className="font-bold text-[#2C2420]">On Android (Chrome / Edge / Samsung Internet):</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-[#5C4C42]">
                        <li>
                          Tap the browser menu icon{' '}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#FAF7F2] border border-[#EAE2D5] font-bold text-[#2C2420]">
                            <MoreVertical className="w-3 h-3" />
                          </span>{' '}
                          in the top-right corner.
                        </li>
                        <li>
                          Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                        </li>
                        <li>
                          Confirm by tapping <strong>Install</strong>.
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <p className="font-bold text-[#2C2420]">How to install Cotton Nest:</p>
                      <ul className="space-y-1.5 text-[#5C4C42]">
                        <li>
                          • <strong>Chrome / Edge (Desktop or Android):</strong> Click the <strong>Install Cotton Nest</strong> icon in the address bar or open the browser menu (<strong>⋮</strong>) and select <strong>Install Cotton Nest</strong>.
                        </li>
                        <li>
                          • <strong>iOS / Safari (iPhone or iPad):</strong> Open Cotton Nest in Safari, tap the <strong>Share</strong> icon, select <strong>Add to Home Screen</strong>, enable <strong>Open as Web App</strong> if available, and tap <strong>Add</strong>.
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-between gap-2">
                {guideMode !== 'already-installed' && appUrl ? (
                  <button
                    type="button"
                    onClick={handleCopyAppUrl}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EAE2D5] text-xs font-semibold text-[#5C4C42] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#8C2E46]" />
                        <span>Copy App Link</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setGuideMode(null)}
                  className="px-5 py-2.5 rounded-xl bg-[#8C2E46] hover:bg-[#70252D] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

/**
 * Download App Button Component for Topbar, Navbar & Mobile Drawer
 * - Never has a `download` attribute or `.html` link.
 * - Triggers `beforeinstallprompt` on Android/Chrome.
 * - Opens Safari installation guide on iOS.
 * - Shows "App Already Installed" when installation is complete.
 */
export const PWAInstallButton: React.FC<{ variant?: 'navbar' | 'mobile' | 'topbar' | 'compact' }> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const handleTriggerInstall = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalled) {
      window.dispatchEvent(
        new CustomEvent('open-pwa-install-guide', { detail: { mode: 'already-installed' } })
      );
      return;
    }

    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'unsupported') {
        window.dispatchEvent(
          new CustomEvent('open-pwa-install-guide', { detail: { mode: isIOS ? 'ios' : 'unsupported' } })
        );
      }
      return;
    }

    if (isIOS) {
      window.dispatchEvent(
        new CustomEvent('open-pwa-install-guide', { detail: { mode: 'ios' } })
      );
      return;
    }

    window.dispatchEvent(
      new CustomEvent('open-pwa-install-guide', { detail: { mode: 'unsupported' } })
    );
  };

  if (variant === 'compact') {
    if (isInstalled) {
      return (
        <span
          data-testid="compact-app-installed-badge"
          title="Cotton Nest App is already installed"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span className="hidden xs:inline">Installed</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        title="Install Cotton Nest App"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#8C2E46] hover:bg-[#70252D] text-white shadow-2xs transition-colors cursor-pointer shrink-0"
      >
        <Download className="w-3 h-3 text-amber-200" />
        <span>Install App</span>
      </button>
    );
  }

  if (variant === 'topbar') {
    if (isInstalled) {
      return (
        <span
          data-testid="topbar-app-installed-badge"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>App Already Installed</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        title="Download Cotton Nest App"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#8C2E46] hover:bg-[#70252D] text-white shadow-2xs transition-colors cursor-pointer shrink-0"
      >
        <Download className="w-3 h-3" />
        <span>Download App</span>
      </button>
    );
  }

  if (variant === 'mobile') {
    if (isInstalled) {
      return (
        <div
          data-testid="mobile-app-installed-badge"
          className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>App Already Installed</span>
          </span>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Installed
          </span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#8C2E46] hover:bg-[#70252D] flex items-center justify-between shadow-2xs transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span>Download App</span>
        </span>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/20 text-white">
          App
        </span>
      </button>
    );
  }

  if (isInstalled) {
    return (
      <span
        data-testid="navbar-app-installed-badge"
        title="Cotton Nest App is already installed on your device"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full shadow-2xs shrink-0 whitespace-nowrap select-none"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>App Already Installed</span>
      </span>
    );
  }

  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={handleTriggerInstall}
      title="Download Cotton Nest App"
      data-testid="navbar-install-app-btn"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#8C2E46] hover:bg-[#70252D] border border-[#DEC89B]/60 rounded-full shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
    >
      <Download className="w-3.5 h-3.5 text-amber-200 shrink-0" />
      <span>Download App</span>
    </motion.button>
  );
};

/**
 * Non-intrusive Offline Connectivity Indicator
 */
export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Offline Mode — Cached Cotton Nest catalogue is being used.
    </div>
  );
};
