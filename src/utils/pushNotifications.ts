import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, PushSubscriptionData } from '../data/notifications';
import { savePushSubscriptionApi } from '../services/api';

const PREFS_STORAGE_KEY = 'cotton_nest_notification_prefs';

/**
 * Checks if Notification API and Service Worker are supported in current browser
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
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
 * Registers the Service Worker if supported
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
 * Request Web Push permission from the customer only on deliberate user action
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
      error: 'Push notifications are not supported in this browser.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await registerServiceWorker();

      // Show welcome notification
      if (registration && 'showNotification' in registration) {
        registration.showNotification('Cotton Nest Atelier', {
          body: '✓ Web Push Enabled: You will receive live order updates & atelier offers.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      } else {
        new Notification('Cotton Nest Atelier', {
          body: '✓ Notifications Enabled: Live updates will appear here.',
          icon: '/favicon.ico',
        });
      }

      // Try subscribing to push manager if PushManager available
      try {
        if (registration && 'pushManager' in registration) {
          let sub = await registration.pushManager.getSubscription();
          if (!sub) {
            // Note: In development/self-hosted environments without VAPID keys,
            // local service worker showNotification acts as the instantaneous push mechanism.
            // When custom VAPID public key is configured on server, it will bind pushManager.
          }
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
      } catch (pushErr) {
        console.info('Push manager notice (local browser notifications active):', pushErr);
      }

      const currentPrefs = getStoredNotificationPreferences();
      saveStoredNotificationPreferences({ ...currentPrefs, pushEnabled: true });

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
 * Triggers a local browser notification if permitted and enabled by preferences
 */
export async function triggerLocalPushNotification(
  title: string,
  body: string,
  categoryOrOptions?: 'orders' | 'promotions' | 'stock' | { url?: string },
  dataUrl?: string
): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  let category: 'orders' | 'promotions' | 'stock' = 'orders';
  let targetUrl = dataUrl;

  if (typeof categoryOrOptions === 'string') {
    category = categoryOrOptions;
  } else if (categoryOrOptions && typeof categoryOrOptions === 'object') {
    targetUrl = categoryOrOptions.url;
  }

  const prefs = getStoredNotificationPreferences();
  if (category === 'promotions' && !prefs.promotionalOffers) return false;
  if (category === 'stock' && !prefs.stockAlerts) return false;
  if (category === 'orders' && !prefs.orderUpdates) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: targetUrl || '/' },
      });
      return true;
    }
  } catch {}

  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });
    return true;
  } catch {
    return false;
  }
}
