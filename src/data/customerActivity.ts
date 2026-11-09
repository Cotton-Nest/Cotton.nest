import { BedsheetProduct } from './products';
import { Order } from './orders';
import { WishlistItem } from './wishlist';

export type CustomerDeviceType = 'Mobile' | 'Desktop' | 'Tablet';

export interface CustomerDeviceInfo {
  deviceType: CustomerDeviceType;
  os: string;
  browser: string;
  screenResolution: string;
  deviceCategory: string;
  approximateLocation: string;
  language: string;
  userAgentSummary?: string;
}

export type CustomerActivityEventType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'product_view'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'cart_add'
  | 'search'
  | 'order_placed'
  | 'session_end';

export interface CustomerActivityEvent {
  id: string;
  timestamp: number;
  type: CustomerActivityEventType;
  label: string;
  page?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  searchTerm?: string;
  orderId?: string;
  orderAmount?: number;
  sessionId?: string;
}

export interface CustomerSessionLog {
  sessionId: string;
  loginAt: number;
  lastActiveAt: number;
  logoutAt?: number;
  durationSeconds: number;
  pagesVisited: string[];
  productsViewedCount: number;
  deviceType: CustomerDeviceType;
  os: string;
  browser: string;
  screenResolution: string;
}

export interface CustomerViewedProduct {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  collection?: string;
  viewCount: number;
  firstViewedAt: number;
  lastViewedAt: number;
}

export interface CustomerWishlistSnapshotItem {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  addedAt: number;
  removedAt?: number;
  currentlyInWishlist: boolean;
}

export interface CustomerCartActivityItem {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  quantity: number;
  addedAt: number;
}

export interface CustomerSearchEntry {
  term: string;
  timestamp: number;
  resultsCount?: number;
}

export interface CustomerActivityProfile {
  /** Firebase UID or sanitized canonical customer identifier */
  uid: string;
  customerName: string;
  email: string;
  phone?: string;
  avatar?: string;
  authProvider?: string;
  accountCreatedAt: number;
  lastLoginAt: number;
  lastLogoutAt?: number;
  lastActiveAt: number;
  totalSessions: number;
  totalTimeSpentSeconds: number;
  averageSessionDurationSeconds: number;
  totalPagesVisited: number;
  pageVisitCounts: Record<string, number>;
  mostVisitedPage: string;
  totalProductViews: number;
  productsViewed: CustomerViewedProduct[];
  totalAddedToCartCount: number;
  cartActivity: CustomerCartActivityItem[];
  /** Cumulative count of wishlist additions (never decremented when removed) */
  totalAddedToWishlistCount: number;
  currentWishlist: CustomerWishlistSnapshotItem[];
  historicalWishlist: CustomerWishlistSnapshotItem[];
  totalSearches: number;
  searchHistory: CustomerSearchEntry[];
  ordersPlacedCount: number;
  totalPurchaseValue: number;
  deviceInfo: CustomerDeviceInfo;
  sessions: CustomerSessionLog[];
  timeline: CustomerActivityEvent[];
  updatedAt: number;
}

export interface ProductInterestAnalyticsItem {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  collection: string;
  totalViews: number;
  uniqueViewers: number;
  wishlistAdds: number;
  currentWishlistCount: number;
  cartAdds: number;
  ordersCount: number;
  interestScore: number;
}

const PAGE_LABELS: Record<string, string> = {
  home: 'Home Showcase',
  catalogue: 'Bedsheet Catalogue',
  seasonal: 'Seasonal Vault',
  story: 'Our Heritage Story',
  store: 'Boutique Store Locator',
  orders: 'My Orders & Tracking',
  tc: 'Terms & Privacy Policy',
  reviews: 'Customer Reviews',
  analytics: 'Admin Analytics'
};

export function getReadablePageLabel(pageKey: string): string {
  if (!pageKey) return 'Home Showcase';
  return PAGE_LABELS[pageKey] || pageKey.charAt(0).toUpperCase() + pageKey.slice(1);
}

/**
 * Sanitizes a user ID / Firebase UID so it is always a valid Firestore document ID
 */
export function sanitizeCustomerUid(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[/.#$[\]]/g, '_');
  return cleaned || 'anonymous_signed_in';
}

/**
 * Formats any epoch ms or ISO timestamp into Indian Standard Time (IST - Asia/Kolkata)
 */
export function formatTimestampIST(
  ts?: number | string | null,
  includeSeconds = false
): string {
  if (!ts) return '—';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: true
    }).format(date) + ' IST';
  } catch {
    return date.toLocaleString('en-IN') + ' IST';
  }
}

/**
 * Formats only the time portion in IST (e.g. "10:30 AM") for timeline entries
 */
export function formatTimeOnlyIST(ts?: number | string | null): string {
  if (!ts) return '—';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
      .format(date)
      .toUpperCase();
  } catch {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}

/**
 * Formats only the date portion in IST (e.g. "14 May 2025")
 */
export function formatDateOnlyIST(ts?: number | string | null): string {
  if (!ts) return '—';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-IN');
  }
}

/**
 * Formats seconds into human-readable duration (e.g., "1h 14m", "18m 42s", "45s")
 */
export function formatDurationHuman(totalSeconds?: number): string {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec === 0) return '0s';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Detects device type, operating system, browser, screen resolution, and non-GPS approximate location/timezone
 */
export function detectCustomerDeviceInfo(consentedLocationHint?: string): CustomerDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'Desktop',
      os: 'Unknown OS',
      browser: 'Unknown Browser',
      screenResolution: '1920x1080',
      deviceCategory: 'Standard Desktop',
      approximateLocation: consentedLocationHint || 'India (IST)',
      language: 'en-IN'
    };
  }

  const ua = navigator.userAgent || '';
  const width = window.screen?.width || window.innerWidth || 1280;
  const height = window.screen?.height || window.innerHeight || 800;
  const screenResolution = `${width}x${height}`;

  // Device Type detection
  let deviceType: CustomerDeviceType = 'Desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'Tablet';
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || width < 768) {
    deviceType = 'Mobile';
  }

  // Operating System detection
  let os = 'Unknown OS';
  if (/Windows NT 10|Windows NT 11/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS/i.test(ua)) browser = 'Chrome (iOS)';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';

  const deviceCategory =
    deviceType === 'Mobile'
      ? `${os} Smartphone`
      : deviceType === 'Tablet'
      ? `${os} Tablet`
      : `${os} Workstation / Desktop`;

  // Approximate region from timezone / profile without GPS
  let approximateLocation = consentedLocationHint?.trim() || '';
  if (!approximateLocation) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') {
        approximateLocation = 'India (IST Region)';
      } else {
        approximateLocation = tz.replace(/_/g, ' ');
      }
    } catch {
      approximateLocation = 'India (IST Region)';
    }
  }

  return {
    deviceType,
    os,
    browser,
    screenResolution,
    deviceCategory,
    approximateLocation,
    language: navigator.language || 'en-IN',
    userAgentSummary: `${browser} on ${os} (${deviceType})`
  };
}

/**
 * Computes a weighted customer engagement & purchase-intent score for ranking "Most Interested Customers"
 */
export function computeCustomerInterestScore(profile: CustomerActivityProfile): number {
  const activeMinutes = Math.min(300, Math.round((profile.totalTimeSpentSeconds || 0) / 60));
  const viewsScore = (profile.totalProductViews || 0) * 8;
  const wishlistScore = (profile.totalAddedToWishlistCount || (profile.currentWishlist?.length || 0)) * 18;
  const cartScore = (profile.totalAddedToCartCount || 0) * 25;
  const sessionScore = (profile.totalSessions || 1) * 12;
  const searchScore = (profile.totalSearches || 0) * 6;
  const orderScore = (profile.ordersPlacedCount || 0) * 45;
  return activeMinutes * 3 + viewsScore + wishlistScore + cartScore + sessionScore + searchScore + orderScore;
}

/**
 * Computes Product Interest Analytics across all customer activity profiles, wishlists, and orders
 */
export function aggregateProductInterestAnalytics(
  profiles: CustomerActivityProfile[],
  products: BedsheetProduct[],
  orders: Order[],
  wishlists: WishlistItem[]
): ProductInterestAnalyticsItem[] {
  const map = new Map<string, {
    productId: string;
    productName: string;
    productImage: string;
    productPrice: number;
    collection: string;
    totalViews: number;
    viewerUids: Set<string>;
    wishlistAdds: number;
    currentWishlistUids: Set<string>;
    cartAdds: number;
    ordersCount: number;
  }>();

  const ensureEntry = (
    productId: string,
    fallbackName?: string,
    fallbackImage?: string,
    fallbackPrice?: number,
    fallbackCollection?: string
  ) => {
    const cleanId = String(productId || '').trim();
    if (!cleanId) return null;
    let entry = map.get(cleanId);
    if (!entry) {
      const catalogMatch = products.find(p => p.id === cleanId);
      entry = {
        productId: cleanId,
        productName: catalogMatch?.name || fallbackName || cleanId,
        productImage: catalogMatch?.image || fallbackImage || '',
        productPrice: catalogMatch?.price ?? fallbackPrice ?? 0,
        collection: catalogMatch?.collection || fallbackCollection || 'Signature Cotton',
        totalViews: 0,
        viewerUids: new Set<string>(),
        wishlistAdds: 0,
        currentWishlistUids: new Set<string>(),
        cartAdds: 0,
        ordersCount: 0
      };
      map.set(cleanId, entry);
    }
    return entry;
  };

  // Seed with catalog products so all active products can be compared
  for (const p of products) {
    ensureEntry(p.id, p.name, p.image, p.price, p.collection);
  }

  for (const profile of profiles) {
    for (const viewed of profile.productsViewed || []) {
      const entry = ensureEntry(
        viewed.productId,
        viewed.productName,
        viewed.productImage,
        viewed.productPrice,
        viewed.collection
      );
      if (entry) {
        entry.totalViews += Math.max(1, Number(viewed.viewCount) || 1);
        entry.viewerUids.add(profile.uid);
      }
    }

    for (const w of profile.historicalWishlist || []) {
      const entry = ensureEntry(w.productId, w.productName, w.productImage, w.productPrice);
      if (entry) {
        entry.wishlistAdds += 1;
        if (w.currentlyInWishlist) {
          entry.currentWishlistUids.add(profile.uid);
        }
      }
    }

    for (const c of profile.cartActivity || []) {
      const entry = ensureEntry(c.productId, c.productName, c.productImage, c.productPrice);
      if (entry) {
        entry.cartAdds += Math.max(1, Number(c.quantity) || 1);
      }
    }
  }

  // Reconcile with global wishlists collection
  for (const w of wishlists || []) {
    const entry = ensureEntry(w.productId, w.productName, w.productImage, w.productPrice, w.collection);
    if (entry) {
      entry.currentWishlistUids.add(w.customerId || w.customerEmail || w.id);
      if (entry.wishlistAdds < entry.currentWishlistUids.size) {
        entry.wishlistAdds = entry.currentWishlistUids.size;
      }
    }
  }

  // Reconcile with non-cancelled orders
  for (const order of orders || []) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items || []) {
      const matchedProduct = products.find(
        p => p.id === item.productId || p.name.toLowerCase() === (item.productName || '').toLowerCase()
      );
      const entry = ensureEntry(
        matchedProduct?.id || item.productId,
        item.productName,
        item.productImage || matchedProduct?.image,
        item.price,
        matchedProduct?.collection
      );
      if (entry) {
        entry.ordersCount += Math.max(1, Number(item.quantity) || 1);
      }
    }
  }

  return Array.from(map.values())
    .map(item => {
      const uniqueViewers = item.viewerUids.size;
      const currentWishlistCount = item.currentWishlistUids.size;
      const wishlistAdds = Math.max(item.wishlistAdds, currentWishlistCount);
      const interestScore =
        item.totalViews * 5 +
        uniqueViewers * 10 +
        wishlistAdds * 18 +
        item.cartAdds * 22 +
        item.ordersCount * 35;

      return {
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        productPrice: item.productPrice,
        collection: item.collection,
        totalViews: item.totalViews,
        uniqueViewers,
        wishlistAdds,
        currentWishlistCount,
        cartAdds: item.cartAdds,
        ordersCount: item.ordersCount,
        interestScore
      };
    })
    .filter(
      item =>
        item.totalViews > 0 ||
        item.wishlistAdds > 0 ||
        item.cartAdds > 0 ||
        item.ordersCount > 0
    )
    .sort((a, b) => b.interestScore - a.interestScore);
}
