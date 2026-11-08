import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPwaPrompt) {
      return window.__deferredPwaPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed as a working app)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('cotton_nest_pwa_installed') === 'true';
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Check if index.html already captured the prompt
    if (window.__deferredPwaPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleCustomInstallAvailable = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      try {
        localStorage.setItem('cotton_nest_pwa_installed', 'true');
      } catch {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-install-available', handleCustomInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handleCustomInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'fallback'> => {
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPwaPrompt : null);
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const { outcome } = await activePrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          try {
            localStorage.setItem('cotton_nest_pwa_installed', 'true');
          } catch {}
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('Native PWA install prompt error:', err);
      }
    }
    return 'fallback';
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
