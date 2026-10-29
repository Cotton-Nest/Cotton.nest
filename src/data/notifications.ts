export type NotificationCategory = 'orders' | 'promotions' | 'stock' | 'admin' | 'system';

export type NotificationType =
  | 'order_status'
  | 'promotion'
  | 'new_arrival'
  | 'back_in_stock'
  | 'admin_order'
  | 'admin_stock'
  | 'admin_review'
  | 'system';

export interface AppNotification {
  id: string;
  recipientId?: string; // 'all' | 'admin' | user email or phone or anon token
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  linkTarget?: {
    view: 'orders' | 'catalogue' | 'seasonal' | 'product' | 'admin' | 'reviews';
    targetId?: string;
    adminTab?: 'products' | 'orders' | 'coupons' | 'seasonal';
  };
  metadata?: {
    orderId?: string;
    productId?: string;
    productName?: string;
    couponCode?: string;
    stockQuantity?: number;
    reviewId?: string;
    imageUrl?: string;
  };
}

export interface NotificationPreferences {
  orderUpdates: boolean; // Essential order status
  promotionalOffers: boolean; // Discounts, seasonal sales
  stockAlerts: boolean; // Back-in-stock alerts
  pushEnabled: boolean; // Browser Web Push
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  promotionalOffers: true,
  stockAlerts: true,
  pushEnabled: false,
};

export interface StockSubscription {
  id: string;
  productId: string;
  productName: string;
  customerIdentifier: string; // phone or email
  createdAt: number;
  notified: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  customerIdentifier: string;
  updatedAt: number;
}

export const INITIAL_CUSTOMER_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'welcome-atelier-announcement',
    recipientId: 'all',
    type: 'promotion',
    category: 'promotions',
    title: 'Welcome to Cotton Nest Atelier',
    message: 'Explore our 100% natural pure cotton bedsheets crafted for everyday luxury and restful sleep.',
    timestamp: Date.now() - 3600 * 1000 * 24 * 2,
    isRead: false,
    linkTarget: { view: 'catalogue' },
  },
  {
    id: 'diwali-festive-offers-launch',
    recipientId: 'all',
    type: 'promotion',
    category: 'promotions',
    title: 'New Festive Offers & Coupons Live!',
    message: 'Apply code NEST10 at checkout for an instant 10% discount on luxury king-size bedsheets.',
    timestamp: Date.now() - 3600 * 1000 * 6,
    isRead: false,
    linkTarget: { view: 'seasonal' },
    metadata: { couponCode: 'NEST10' },
  },
];

export const DEFAULT_NOTIFICATIONS = INITIAL_CUSTOMER_NOTIFICATIONS;

const PREFS_KEY = 'cotton_nest_notification_prefs';

export function getStoredNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
    }
  } catch {}
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function saveStoredNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}
