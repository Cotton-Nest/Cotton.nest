export type NotificationCategory = 'orders' | 'promotions' | 'stock' | 'admin' | 'system';

export type NotificationType =
  | 'order_status'
  | 'complaint_update'
  | 'promotion'
  | 'new_arrival'
  | 'back_in_stock'
  | 'admin_order'
  | 'admin_complaint'
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
    complaintId?: string;
    requestType?: string;
    complaintStatus?: string;
    adminResponse?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  };
}

export interface ComplaintNotificationSource {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSize?: string;
  variantName?: string;
  requestType: string;
  status: string;
  adminResponse?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  photos?: Array<{ url: string; publicId: string }>;
}

/**
 * Builds a customer-facing notification whenever a complaint/return/exchange
 * is submitted, its status is updated, or the admin sends a response.
 */
export function buildComplaintNotificationForCustomer(
  complaint: ComplaintNotificationSource,
  eventType: 'submitted' | 'admin_update' | 'admin_responded' | 'status_updated'
): AppNotification {
  const now = Date.now();
  const hasResponse = Boolean(complaint.adminResponse && complaint.adminResponse.trim().length > 0);
  const trimmedResponse = complaint.adminResponse ? complaint.adminResponse.trim() : '';

  let title: string;
  let message: string;

  if (eventType === 'submitted') {
    title = `${complaint.requestType} Request #${complaint.id} Submitted`;
    message = `Your ${complaint.requestType.toLowerCase()} request for ${complaint.productName} (Order #${complaint.orderId}) has been received. Status: ${complaint.status}.`;
  } else if (hasResponse) {
    title = `Cotton Nest Responded to Your ${complaint.requestType} (#${complaint.id})`;
    message = `Status: ${complaint.status} — "${trimmedResponse}" (Order #${complaint.orderId} · ${complaint.productName})`;
  } else {
    title = `${complaint.requestType} Status Updated: ${complaint.status} (#${complaint.id})`;
    message = `Your ${complaint.requestType.toLowerCase()} request for ${complaint.productName} (Order #${complaint.orderId}) has been updated to "${complaint.status}".`;
  }

  return {
    id: `notif-cmp-${complaint.id}-${eventType}-${now}`,
    recipientId: complaint.customerEmail || complaint.customerPhone || 'all',
    type: 'complaint_update',
    category: 'orders',
    title,
    message,
    timestamp: now,
    isRead: false,
    linkTarget: {
      view: 'orders',
      targetId: complaint.orderId,
    },
    metadata: {
      orderId: complaint.orderId,
      productId: complaint.productId,
      productName: complaint.productName,
      complaintId: complaint.id,
      requestType: complaint.requestType,
      complaintStatus: complaint.status,
      adminResponse: trimmedResponse || undefined,
      customerName: complaint.customerName,
      customerPhone: complaint.customerPhone,
      customerEmail: complaint.customerEmail,
      imageUrl: complaint.photos?.[0]?.url,
    },
  };
}

/**
 * Builds an admin notification when a customer submits a new return/exchange/complaint.
 */
export function buildComplaintNotificationForAdmin(
  complaint: ComplaintNotificationSource
): AppNotification {
  const now = Date.now();
  return {
    id: `notif-admin-cmp-${complaint.id}-${now}`,
    recipientId: 'admin',
    type: 'admin_complaint',
    category: 'admin',
    title: `New ${complaint.requestType}: #${complaint.id} (Order #${complaint.orderId})`,
    message: `${complaint.customerName || 'Customer'} submitted a ${complaint.requestType.toLowerCase()} for ${complaint.productName} with ${complaint.photos?.length || 1} defect photo(s).`,
    timestamp: now,
    isRead: false,
    linkTarget: {
      view: 'admin',
      targetId: complaint.id,
      adminTab: 'orders',
    },
    metadata: {
      orderId: complaint.orderId,
      productId: complaint.productId,
      productName: complaint.productName,
      complaintId: complaint.id,
      requestType: complaint.requestType,
      complaintStatus: complaint.status,
      customerName: complaint.customerName,
      customerPhone: complaint.customerPhone,
      customerEmail: complaint.customerEmail,
      imageUrl: complaint.photos?.[0]?.url,
    },
  };
}

/**
 * Builds a customer notification when an order's delivery/fulfillment status is updated.
 */
export function buildOrderStatusNotification(
  orderId: string,
  customerName: string,
  recipientId: string,
  status: string
): AppNotification {
  const now = Date.now();
  const normalized = (status || '').toLowerCase();
  let title = `Order #${orderId} Update`;
  let message = `Hi ${customerName || 'Valued Customer'}, your Cotton Nest order #${orderId} status has been updated.`;

  if (normalized === 'pending') {
    title = `Order #${orderId} Received — Order Confirmation Pending`;
    message = `Hi ${customerName || 'Valued Customer'}, we received your order #${orderId}. Order confirmation is pending — your Sale Invoice will be emailed once confirmed.`;
  } else if (normalized === 'confirmed') {
    title = `Order #${orderId} Confirmed — Sale Invoice Sent`;
    message = `Hi ${customerName || 'Valued Customer'}, your Cotton Nest order #${orderId} is confirmed! Your official Sale Invoice has been generated and sent to your email.`;
  } else if (normalized === 'dispatched') {
    title = `Order #${orderId} Dispatched — Out for Delivery`;
    message = `Hi ${customerName || 'Valued Customer'}, your Cotton Nest order #${orderId} has been dispatched via Express Courier.`;
  } else if (normalized === 'delivered') {
    title = `Order #${orderId} Delivered — Enjoy Your Cotton Nest!`;
    message = `Hi ${customerName || 'Valued Customer'}, your Cotton Nest order #${orderId} has been delivered. Thank you for shopping with us!`;
  } else if (normalized === 'cancelled') {
    title = `Order #${orderId} Cancelled`;
    message = `Hi ${customerName || 'Valued Customer'}, your Cotton Nest order #${orderId} has been cancelled.`;
  }

  return {
    id: `notif-ord-${orderId}-${status}-${now}`,
    recipientId: recipientId || 'all',
    type: 'order_status',
    category: 'orders',
    title,
    message,
    timestamp: now,
    isRead: false,
    linkTarget: {
      view: 'orders',
      targetId: orderId,
    },
    metadata: {
      orderId,
      customerName,
    },
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
  pushEnabled: true,
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
