import React, { useState, useEffect } from 'react';
import { Download, X, CheckCircle2, Smartphone, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

/**
 * Triggers a downloadable standalone Web App launcher (.html app wrapper) when running
 * inside an iframe or browser environment where native `beforeinstallprompt` is restricted,
 * so clicking "Install" in the Chrome pop-out always downloads a working Cotton Nest app.
 */
function downloadWorkingAppLauncher() {
  if (typeof window === 'undefined') return;
  const appOrigin = window.location.origin;
  const appHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <title>Cotton Nest — Luxury Bed Linens</title>
  <meta name="theme-color" content="#8C2E46" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <link rel="icon" type="image/png" href="${appOrigin}/pwa-192x192.png" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #FAF7F2; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: #8C2E46; color: #FAF7F2; padding: 6px 14px; font-size: 12px;
    }
    .top-bar a { color: #FAF7F2; text-decoration: underline; font-weight: 600; }
  </style>
</head>
<body>
  <iframe src="${appOrigin}/?source=pwa_app" allow="clipboard-write; notifications; geolocation; payment"></iframe>
  <script>
    // Automatically redirect to standalone live app if opened directly
    if (window.navigator.onLine) {
      window.location.replace("${appOrigin}/?source=pwa_app");
    }
  </script>
</body>
</html>`;

  const blob = new Blob([appHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Cotton-Nest-App.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Chrome-Style Top-Right "Install app?" Omnibox Pop-out
 * Matches Google Chrome's native PWA installation pop-out bubble.
 */
export const ChromeInstallPopout: React.FC = () => {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

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

  // Allow any button in the app to re-open the Chrome Install Popout
  useEffect(() => {
    const handleOpenInstallPopout = () => {
      setVisible(true);
    };
    window.addEventListener('open-chrome-install-popout', handleOpenInstallPopout);
    return () => window.removeEventListener('open-chrome-install-popout', handleOpenInstallPopout);
  }, []);

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
      if (isIOS) {
        setShowIOSGuide(true);
        return;
      }
      // Download the working Cotton Nest App launcher so the user immediately gets the app file
      downloadWorkingAppLauncher();
      setInstalledSuccess(true);
      setTimeout(() => {
        setVisible(false);
        setInstalledSuccess(false);
      }, 3500);
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
            {/* Chrome Pop-out Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="text-[15px] font-medium leading-snug text-[#202124]">
                {installedSuccess ? 'App Installed' : 'Install app?'}
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
                src="/pwa-192x192.png"
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
                <span>Cotton Nest app downloaded &amp; ready to launch!</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-1.5 rounded-full border border-[#dadce0] text-[#1a73e8] hover:bg-[#f8fbff] text-[13px] font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="px-5 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[13px] font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{installing ? 'Installing...' : 'Install'}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Installation Guide Modal */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#DEC89B]"
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Cotton Nest"
                  className="w-10 h-10 rounded-xl border border-[#EAE2D5] bg-[#FAF7F2] p-1"
                />
                <div>
                  <h3 className="text-base font-bold text-[#2C2420]">Install Cotton Nest App</h3>
                  <p className="text-xs text-[#7A6458]">Add to your iPhone / iPad Home Screen</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-[#2C2420] bg-[#FAF7F2] p-3.5 rounded-xl border border-[#EAE2D5]">
                <p>1. Tap the <strong>Share</strong> button in your browser toolbar.</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                <p>3. Tap <strong>Add</strong> in the top-right corner to launch Cotton Nest as a full app.</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadWorkingAppLauncher();
                    setShowIOSGuide(false);
                  }}
                  className="flex-1 rounded-xl bg-[#70252D] py-2.5 text-xs font-semibold text-white hover:bg-[#8C2E46] cursor-pointer"
                >
                  Download Web App
                </button>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="px-4 rounded-xl bg-gray-100 py-2.5 text-xs font-semibold text-[#2C2420] hover:bg-gray-200 cursor-pointer"
                >
                  Close
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
      await install();
    } else {
      window.dispatchEvent(new CustomEvent('open-chrome-install-popout'));
    }
  };

  if (variant === 'topbar') {
    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        title="Install Cotton Nest App"
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
        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] flex items-center justify-between shadow-2xs transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span>Install Cotton Nest App</span>
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
      title="Install Cotton Nest as an App"
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
