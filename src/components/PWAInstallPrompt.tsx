import React, { useState, useEffect } from 'react';
import { Download, X, CheckCircle2, Smartphone, Share, PlusSquare, ExternalLink, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

/**
 * Top-Right "Install app?" Pop-out & iOS "Add to Home Screen" Modal
 * Never downloads an .html file. Uses native `beforeinstallprompt` when supported,
 * and on iOS / iPadOS / Safari provides native iOS Share Sheet integration + visual
 * "Add to Home Screen" flow so Cotton Nest installs as a real Home Screen app icon.
 */
export const ChromeInstallPopout: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [showHomeScreenGuide, setShowHomeScreenGuide] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInstalled) {
      setVisible(false);
      return;
    }
    const dismissed = sessionStorage.getItem('cotton_nest_chrome_install_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  // Allow any "Install App" button in the app to open the Install prompt / Home Screen modal
  useEffect(() => {
    const handleOpenInstallPopout = () => {
      if (isIOS && !isInstallable) {
        setShowHomeScreenGuide(true);
      } else {
        setVisible(true);
      }
    };
    const handleOpenIOSHomeScreenGuide = () => {
      setShowHomeScreenGuide(true);
    };
    window.addEventListener('open-chrome-install-popout', handleOpenInstallPopout);
    window.addEventListener('open-ios-homescreen-guide', handleOpenIOSHomeScreenGuide);
    return () => {
      window.removeEventListener('open-chrome-install-popout', handleOpenInstallPopout);
      window.removeEventListener('open-ios-homescreen-guide', handleOpenIOSHomeScreenGuide);
    };
  }, [isIOS, isInstallable]);

  if (isInstalled && !installedSuccess) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('cotton_nest_chrome_install_dismissed', '1');
    } catch {}
  };

  const handleInstallClick = async () => {
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

    if (outcome === 'fallback') {
      setVisible(false);
      setShowHomeScreenGuide(true);
    }
  };

  const handleNativeIOSShare = async () => {
    setShareFeedback(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Cotton Nest',
          text: 'Cotton Nest — Luxury Bed Linens',
          url: appUrl,
        });
        setShareFeedback('In the menu that opened, tap "Add to Home Screen" to place Cotton Nest on your Home Screen.');
      } catch (err) {
        // User cancelled share sheet or share restricted in iframe
        if (isInIframe && appUrl) {
          window.open(appUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } else if (appUrl) {
      window.open(appUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const hostName = typeof window !== 'undefined' ? window.location.host : 'cottonnest.in';

  return (
    <>
      <AnimatePresence>
        {visible && (
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
                {installedSuccess ? 'App Installed' : isIOS ? 'Add to Home Screen' : 'Install app?'}
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
                <span>Cotton Nest added to your Home Screen!</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-1.5 rounded-full border border-[#dadce0] text-[#1a73e8] hover:bg-[#f8fbff] text-[13px] font-medium transition-colors cursor-pointer"
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
                  <span>{installing ? 'Adding...' : isIOS ? 'Add to Home Screen' : 'Install'}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS / Home Screen PWA Installation Modal (Never downloads .html) */}
      <AnimatePresence>
        {showHomeScreenGuide && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="w-full max-w-md rounded-3xl bg-[#FAF7F2] p-5 sm:p-6 shadow-2xl border border-[#DEC89B] text-[#2C2420]"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src="/apple-touch-icon.png"
                      alt="Cotton Nest Home Screen Icon"
                      className="w-14 h-14 rounded-2xl border border-[#DEC89B] bg-white p-1.5 shadow-md"
                    />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8C2E46] text-white flex items-center justify-center shadow-xs">
                      <Sparkles className="w-3 h-3" />
                    </span>
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-[#70252D] border border-amber-200 mb-1">
                      iOS &amp; Home Screen App
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-[#2C2420] leading-tight">
                      Add Cotton Nest to Home Screen
                    </h3>
                    <p className="text-xs text-[#7A6458]">
                      Installs as a full-screen app icon on your iPhone / iPad
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHomeScreenGuide(false)}
                  className="p-1.5 rounded-full text-[#7A6458] hover:text-[#2C2420] hover:bg-[#EAE2D5]/60 transition-colors cursor-pointer"
                  aria-label="Close Home Screen guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notice if inside an embedded preview iframe */}
              {isInIframe && appUrl && (
                <div className="mb-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <p className="font-semibold leading-snug">
                    Step 0: Open the direct app link in Safari first so iOS adds the Cotton Nest app icon to your Home Screen:
                  </p>
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#8C2E46] text-white font-bold text-xs shadow-xs hover:bg-[#70252D] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Direct App in Safari</span>
                  </a>
                </div>
              )}

              {/* Visual 3-Step iOS Add to Home Screen Instructions */}
              <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#2C2420] flex items-center gap-1.5 flex-wrap">
                      <span>Tap the iOS</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                        <Share className="w-3.5 h-3.5" /> Share
                      </span>
                      <span>button</span>
                    </p>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      Located at the bottom toolbar in Safari (or top-right in Chrome on iOS).
                    </p>
                  </div>
                </div>

                <div className="h-px bg-[#F4EFE6]" />

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#2C2420] flex items-center gap-1.5 flex-wrap">
                      <span>Scroll down &amp; tap</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                      </span>
                    </p>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      Do not tap &ldquo;Save to Files&rdquo; — choose <strong>Add to Home Screen</strong> so the app icon appears on your screen.
                    </p>
                  </div>
                </div>

                <div className="h-px bg-[#F4EFE6]" />

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-[#FDEAF0] text-[#8C2E46] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#2C2420]">
                      Tap <span className="text-blue-600 font-bold">Add</span> in the top-right corner
                    </p>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      The <strong>Cotton Nest</strong> icon will immediately appear on your iPhone / iPad Home Screen.
                    </p>
                  </div>
                </div>
              </div>

              {shareFeedback && (
                <p className="mt-3 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  {shareFeedback}
                </p>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={handleNativeIOSShare}
                    className="flex-1 rounded-xl bg-[#8C2E46] hover:bg-[#70252D] py-2.5 px-4 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Share className="w-4 h-4" />
                    <span>Open iOS Share Menu</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHomeScreenGuide(false)}
                  className="px-5 rounded-xl bg-white hover:bg-[#EAE2D5]/60 border border-[#DEC89B] py-2.5 text-xs font-bold text-[#2C2420] transition-colors cursor-pointer"
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
 * In-App Install Button Component for Navbar & Mobile Drawer
 */
export const PWAInstallButton: React.FC<{ variant?: 'navbar' | 'mobile' | 'topbar' }> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'fallback') {
        window.dispatchEvent(new CustomEvent('open-ios-homescreen-guide'));
      }
    } else if (isIOS) {
      window.dispatchEvent(new CustomEvent('open-ios-homescreen-guide'));
    } else {
      window.dispatchEvent(new CustomEvent('open-ios-homescreen-guide'));
    }
  };

  if (variant === 'topbar') {
    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        title="Add Cotton Nest App to Home Screen"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#8C2E46] hover:bg-[#70252D] text-white shadow-2xs transition-colors cursor-pointer shrink-0"
      >
        <Download className="w-3 h-3" />
        <span>Install App</span>
      </button>
    );
  }

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#8C2E46] hover:bg-[#70252D] flex items-center justify-between shadow-2xs transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span>{isIOS ? 'Add Cotton Nest to Home Screen' : 'Install Cotton Nest App'}</span>
        </span>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/20 text-white">
          App
        </span>
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={handleTriggerInstall}
      title="Install Cotton Nest on your Home Screen"
      data-testid="navbar-install-app-btn"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#8C2E46] hover:bg-[#70252D] border border-[#DEC89B]/60 rounded-full shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
    >
      <Download className="w-3.5 h-3.5 text-amber-200 shrink-0" />
      <span>Install App</span>
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
