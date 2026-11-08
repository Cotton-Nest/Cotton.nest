import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, PushSubscriptionData } from '../data/notifications';
import { savePushSubscriptionApi } from '../services/api';

const PREFS_STORAGE_KEY = 'cotton_nest_notification_prefs';
export const COTTON_NEST_NOTIF_ICON = 'https://res.cloudinary.com/ys2sgydi/image/upload/w_192,h_192,c_pad,b_rgb:FAF7F2/logo-removebg-preview.png';

/**
 * Checks if Notification API is supported in the current browser
 */
export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current notification permission status ('granted', 'denied', or 'default')
 */
export function getPushPermissionStatus(): NotificationPermission {
  if (!isPushNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Gets stored customer notification preferences
 */
export function getStoredNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
    }
  } catch {}
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

/**
 * Saves customer notification preferences to localStorage
 */
export function saveStoredNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

/**
 * Registers the Service Worker if supported and returns the active registration with a short timeout
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration notice:', err);
    return null;
  }
}

export const initPushNotifications = registerServiceWorker;

/**
 * Helper to show a native OS notification immediately (in the device's system notification bar)
 * using ServiceWorkerRegistration first (required on mobile Android/iOS), with a fast fallback
 * to `new Notification()` on desktop browsers.
 */
async function showSystemNotification(
  title: string,
  body: string,
  targetUrl: string = '/',
  tag?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const notifTag = tag || `cotton-nest-${Date.now()}`;

  // 1. Try Service Worker registration (with a 1500ms timeout so it never hangs)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.getRegistration('/'),
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);

      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: COTTON_NEST_NOTIF_ICON,
          badge: COTTON_NEST_NOTIF_ICON,
          tag: notifTag,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: targetUrl },
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn('SW showNotification fallback to native Notification:', swErr);
    }
  }

  // 2. Fallback to standard Desktop Notification API
  try {
    const n = new Notification(title, {
      body,
      icon: COTTON_NEST_NOTIF_ICON,
      tag: notifTag,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {}
      n.close();
    };
    return true;
  } catch (err) {
    console.warn('Native Notification error:', err);
    return false;
  }
}

/**
 * Request Web Push permission from the customer and trigger an immediate test notification on the device notification bar
 */
export async function requestWebPushPermission(customerIdentifier: string = 'guest'): Promise<{
  granted: boolean;
  status: NotificationPermission;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      granted: false,
      status: 'denied',
      error: 'System notifications are not supported in this browser.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await registerServiceWorker();

      const currentPrefs = getStoredNotificationPreferences();
      saveStoredNotificationPreferences({ ...currentPrefs, pushEnabled: true });

      // Show immediate welcome notification in the device's actual notification bar
      await showSystemNotification(
        'Cotton Nest Atelier',
        '✓ Device Notifications Active: Live order updates & atelier offers will appear in your notification bar.',
        '/',
        `cn-welcome-${Date.now()}`
      );

      // Try subscribing to pushManager if available
      try {
        if (registration && 'pushManager' in registration) {
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            const rawSub = sub.toJSON();
            const subData: PushSubscriptionData = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: rawSub.keys?.p256dh || '',
                auth: rawSub.keys?.auth || '',
              },
              customerIdentifier,
              updatedAt: Date.now(),
            };
            savePushSubscriptionApi(subData).catch(() => {});
          }
        }
      } catch {}

      return { granted: true, status: 'granted' };
    } else {
      const currentPrefs = getStoredNotificationPreferences();
      saveStoredNotificationPreferences({ ...currentPrefs, pushEnabled: false });
      return { granted: false, status: permission };
    }
  } catch (err: any) {
    return {
      granted: false,
      status: 'denied',
      error: err.message || 'Permission request failed',
    };
  }
}

/**
 * Disables Web Push notifications
 */
export async function disableWebPush(): Promise<void> {
  const currentPrefs = getStoredNotificationPreferences();
  saveStoredNotificationPreferences({ ...currentPrefs, pushEnabled: false });

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
    } catch {}
  }
}

/**
 * Triggers a native device/OS notification in the device's notification bar.
 * If permission is still 'default', automatically prompts once if triggered by a user action.
 */
export async function triggerLocalPushNotification(
  title: string,
  body: string,
  categoryOrOptions?: 'orders' | 'promotions' | 'stock' | { url?: string; tag?: string },
  dataUrl?: string
): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  let category: 'orders' | 'promotions' | 'stock' = 'orders';
  let targetUrl = dataUrl || '/';
  let customTag: string | undefined;

  if (typeof categoryOrOptions === 'string') {
    category = categoryOrOptions;
  } else if (categoryOrOptions && typeof categoryOrOptions === 'object') {
    targetUrl = categoryOrOptions.url || targetUrl;
    customTag = categoryOrOptions.tag;
  }

  const prefs = getStoredNotificationPreferences();
  if (category === 'promotions' && !prefs.promotionalOffers) return false;
  if (category === 'stock' && !prefs.stockAlerts) return false;
  if (category === 'orders' && !prefs.orderUpdates) return false;

  // If permission has not been requested yet ('default'), try requesting it
  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        saveStoredNotificationPreferences({ ...prefs, pushEnabled: true });
      }
    } catch {}
  }

  if (Notification.permission !== 'granted') return false;

  return showSystemNotification(title, body, targetUrl, customTag);
}
