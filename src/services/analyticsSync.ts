/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  increment,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isFirestoreWriteQuotaExhausted,
  markFirestoreWriteQuotaExhausted,
  OperationType,
} from '../firebase';
import { BedsheetProduct, BEDSHEETS_CATALOG } from '../data/products';
import { Order } from '../data/orders';
import { ProductReview } from '../data/reviews';
import { WishlistItem } from '../data/wishlist';
import { CustomerActivityProfile } from '../data/customerActivity';
import {
  SiteTrafficData,
  getEmptyTrafficData,
  normalizeTrafficData,
} from '../data/analytics';
import {
  deduplicateOrders,
  deduplicateReviews,
  deduplicateWishlists,
  getISTTodayKey,
} from '../data/unifiedAnalytics';

export const ANALYTICS_COLLECTION = 'analytics';
export const SITE_TRAFFIC_DOC_ID = 'site_traffic';

const SESSION_ID_KEY = 'cn_analytics_session_id_v2';
const SESSION_REGISTERED_KEY = 'cn_analytics_session_registered_v2';
const LAST_SECTION_HIT_KEY = 'cn_analytics_last_section_hit_v2';

type TrafficSourceKey = keyof SiteTrafficData['trafficSources'];
type DeviceBreakdownKey = keyof SiteTrafficData['deviceBreakdown'];

function detectTrafficSourceClient(): TrafficSourceKey {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'direct';
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = (params.get('utm_source') || params.get('source') || '').toLowerCase();
    const ref = (document.referrer || '').toLowerCase();
    const combined = `${utm} ${ref}`;
    if (combined.includes('whatsapp') || combined.includes('wa.me')) return 'whatsapp';
    if (combined.includes('instagram') || combined.includes('ig.me') || combined.includes('fb')) {
      return 'instagram';
    }
    if (combined.includes('google')) return 'google';
    if (params.get('ref') || ref) return 'referrals';
  } catch {}
  return 'direct';
}

function detectTrafficDeviceClient(): DeviceBreakdownKey {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const width = window.screen?.width || window.innerWidth || 1280;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || width < 768) {
    return 'mobile';
  }
  return 'desktop';
}

function getOrCreateAnalyticsSession(): { sessionId: string; isNewSession: boolean } {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return { sessionId: 'ssr', isNewSession: false };
  }
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    let isNewSession = false;
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
      isNewSession = true;
    } else if (!sessionStorage.getItem(SESSION_REGISTERED_KEY)) {
      isNewSession = true;
    }
    return { sessionId, isNewSession };
  } catch {
    return { sessionId: 'mem', isNewSession: false };
  }
}

/**
 * Fetches live site traffic metrics strictly from Firestore `/analytics/site_traffic`.
 */
export async function fetchSiteTrafficFromFirestore(fromServer = false): Promise<SiteTrafficData> {
  const ref = doc(db, ANALYTICS_COLLECTION, SITE_TRAFFIC_DOC_ID);
  const snap = fromServer ? await getDocFromServer(ref) : await getDoc(ref);
  if (snap.exists()) {
    return normalizeTrafficData(snap.data() as Partial<SiteTrafficData>);
  }
  return getEmptyTrafficData();
}

/**
 * Records a storefront visit / tab view atomically into Firestore `/analytics/site_traffic`.
 * Excludes internal admin views ('analytics') and deduplicates rapid repeats within 2 seconds.
 */
export async function recordSitePageVisitToFirestore(section: string = 'home'): Promise<void> {
  const cleanSection = String(section || 'home').trim().toLowerCase() || 'home';
  if (cleanSection === 'analytics') return;
  if (isFirestoreWriteQuotaExhausted()) return;

  // Guard against duplicate back-to-back writes on React StrictMode mount/re-render
  try {
    if (typeof sessionStorage !== 'undefined') {
      const rawLast = sessionStorage.getItem(LAST_SECTION_HIT_KEY);
      if (rawLast) {
        const parsed = JSON.parse(rawLast) as { section?: string; ts?: number };
        if (parsed.section === cleanSection && parsed.ts && Date.now() - parsed.ts < 2500) {
          return;
        }
      }
      sessionStorage.setItem(
        LAST_SECTION_HIT_KEY,
        JSON.stringify({ section: cleanSection, ts: Date.now() })
      );
    }
  } catch {}

  const { isNewSession } = getOrCreateAnalyticsSession();
  const todayKey = getISTTodayKey();
  const source = detectTrafficSourceClient();
  const device = detectTrafficDeviceClient();

  const payload: Record<string, unknown> = {
    id: SITE_TRAFFIC_DOC_ID,
    totalVisits: increment(1),
    lastVisitedAt: Date.now(),
    pageViewsByDate: {
      [todayKey]: increment(1),
    },
    pageViewsBySection: {
      [cleanSection]: increment(1),
    },
  };

  if (isNewSession) {
    payload.uniqueVisitors = increment(1);
    payload.trafficSources = { [source]: increment(1) };
    payload.deviceBreakdown = { [device]: increment(1) };
  }

  try {
    await setDoc(doc(db, ANALYTICS_COLLECTION, SITE_TRAFFIC_DOC_ID), payload, { merge: true });
    if (isNewSession && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(SESSION_REGISTERED_KEY, '1');
      } catch {}
    }
  } catch (error) {
    markFirestoreWriteQuotaExhausted(error);
    try {
      handleFirestoreError(error, OperationType.WRITE, `${ANALYTICS_COLLECTION}/${SITE_TRAFFIC_DOC_ID}`);
    } catch {}
  }
}

/**
 * Real-time listener for all store orders (Owner/Admin use).
 */
export function subscribeAdminOrders(
  onUpdate: (orders: Order[]) => void,
  onError?: (message: string, code?: string) => void
): () => void {
  let active = true;

  const unsub = onSnapshot(
    collection(db, 'orders'),
    (snapshot) => {
      if (!active) return;
      const list: Order[] = [];
      snapshot.forEach((d) => {
        const raw = d.data() as Order;
        if (raw && d.id) {
          list.push({ ...raw, id: d.id });
        }
      });
      onUpdate(deduplicateOrders(list));
    },
    (err: any) => {
      if (!active) return;
      const code = String(err?.code || '');
      const msg = err instanceof Error ? err.message : String(err || 'Failed to sync orders');
      try {
        handleFirestoreError(err, OperationType.LIST, 'orders');
      } catch {}
      onError?.(msg, code);
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

export type AnalyticsSourceName =
  | 'orders'
  | 'products'
  | 'reviews'
  | 'wishlists'
  | 'customer_activity'
  | 'traffic';

export interface SyncedAnalyticsState {
  orders: Order[];
  products: BedsheetProduct[];
  reviews: ProductReview[];
  wishlists: WishlistItem[];
  customerProfiles: CustomerActivityProfile[];
  trafficData: SiteTrafficData;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  sourceErrors: Partial<Record<AnalyticsSourceName, string>>;
  syncError: string | null;
  refresh: () => Promise<void>;
}

function formatFirestoreErrorReason(source: string, err: unknown): string {
  const code = String((err as any)?.code || '');
  const message = err instanceof Error ? err.message : String(err || 'Unknown error');
  if (code === 'permission-denied' || message.toLowerCase().includes('permission')) {
    return `${source}: Permission restricted — sign in with an authorized Cotton Nest Owner Google account.`;
  }
  return `${source}: ${message}`;
}

/**
 * Single real-time Firestore analytics synchronization hook shared across Website & Mobile views.
 * Subscribes live to `orders`, `products`, `reviews`, `wishlists`, `customer_activity`, and
 * `analytics/site_traffic` in the unified Firebase project without stale cache overrides.
 */
export function useSyncedAnalyticsData(options?: {
  enabled?: boolean;
  fallbackProducts?: BedsheetProduct[];
  fallbackOrders?: Order[];
  fallbackReviews?: ProductReview[];
}): SyncedAnalyticsState {
  const enabled = options?.enabled !== false;
  const fallbackProductsRef = useRef(options?.fallbackProducts);
  fallbackProductsRef.current = options?.fallbackProducts;

  const [orders, setOrders] = useState<Order[]>(() =>
    deduplicateOrders(options?.fallbackOrders || [])
  );
  const [products, setProducts] = useState<BedsheetProduct[]>(() =>
    options?.fallbackProducts && options.fallbackProducts.length > 0
      ? options.fallbackProducts
      : BEDSHEETS_CATALOG
  );
  const [reviews, setReviews] = useState<ProductReview[]>(() =>
    deduplicateReviews(options?.fallbackReviews || [])
  );
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerActivityProfile[]>([]);
  const [trafficData, setTrafficData] = useState<SiteTrafficData>(() => getEmptyTrafficData());

  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<AnalyticsSourceName, string>>>({});

  const settledRef = useRef<Set<AnalyticsSourceName>>(new Set());

  const markSettled = useCallback((source: AnalyticsSourceName) => {
    settledRef.current.add(source);
    if (settledRef.current.size >= 5) {
      setIsLoading(false);
    }
  }, []);

  const clearSourceError = useCallback((source: AnalyticsSourceName) => {
    setSourceErrors((prev) => {
      if (!prev[source]) return prev;
      const next = { ...prev };
      delete next[source];
      return next;
    });
  }, []);

  const setSourceError = useCallback((source: AnalyticsSourceName, message: string) => {
    setSourceErrors((prev) => {
      if (prev[source] === message) return prev;
      return { ...prev, [source]: message };
    });
  }, []);

  const fetchServerVerifiedAll = useCallback(
    async (isManualRefresh: boolean) => {
      if (!enabled) return;
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      const fetchDocs = async (colName: string) => {
        try {
          return await getDocsFromServer(collection(db, colName));
        } catch {
          return await getDocs(collection(db, colName));
        }
      };

      const fetchTraffic = async () => {
        const ref = doc(db, ANALYTICS_COLLECTION, SITE_TRAFFIC_DOC_ID);
        try {
          return await getDocFromServer(ref);
        } catch {
          return await getDoc(ref);
        }
      };

      const results = await Promise.allSettled([
        fetchDocs('orders'),
        fetchDocs('products'),
        fetchDocs('reviews'),
        fetchDocs('wishlists'),
        fetchDocs('customer_activity'),
        fetchTraffic(),
      ]);

      // 1. Orders
      if (results[0].status === 'fulfilled') {
        const list: Order[] = [];
        results[0].value.forEach((d) => {
          const raw = d.data() as Order;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setOrders(deduplicateOrders(list));
        clearSourceError('orders');
      } else {
        setSourceError('orders', formatFirestoreErrorReason('Orders', results[0].reason));
      }

      // 2. Products
      if (results[1].status === 'fulfilled') {
        const list: BedsheetProduct[] = [];
        results[1].value.forEach((d) => {
          const raw = d.data() as BedsheetProduct;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        if (list.length > 0) {
          list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          setProducts(list);
        } else if (fallbackProductsRef.current && fallbackProductsRef.current.length > 0) {
          setProducts(fallbackProductsRef.current);
        }
        clearSourceError('products');
      } else {
        setSourceError('products', formatFirestoreErrorReason('Products', results[1].reason));
      }

      // 3. Reviews
      if (results[2].status === 'fulfilled') {
        const list: ProductReview[] = [];
        results[2].value.forEach((d) => {
          const raw = d.data() as ProductReview;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setReviews(deduplicateReviews(list));
        clearSourceError('reviews');
      } else {
        setSourceError('reviews', formatFirestoreErrorReason('Reviews', results[2].reason));
      }

      // 4. Wishlists
      if (results[3].status === 'fulfilled') {
        const list: WishlistItem[] = [];
        results[3].value.forEach((d) => {
          const raw = d.data() as WishlistItem;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setWishlists(deduplicateWishlists(list));
        clearSourceError('wishlists');
      } else {
        setSourceError('wishlists', formatFirestoreErrorReason('Wishlists', results[3].reason));
      }

      // 5. Customer Activity
      if (results[4].status === 'fulfilled') {
        const list: CustomerActivityProfile[] = [];
        results[4].value.forEach((d) => {
          const raw = d.data() as CustomerActivityProfile;
          if (raw) list.push({ ...raw, uid: raw.uid || d.id });
        });
        setCustomerProfiles(list);
        clearSourceError('customer_activity');
      } else {
        setSourceError(
          'customer_activity',
          formatFirestoreErrorReason('Customer Activity', results[4].reason)
        );
      }

      // 6. Traffic
      if (results[5].status === 'fulfilled') {
        const snap = results[5].value;
        setTrafficData(
          snap.exists()
            ? normalizeTrafficData(snap.data() as Partial<SiteTrafficData>)
            : getEmptyTrafficData()
        );
        clearSourceError('traffic');
      } else {
        setSourceError('traffic', formatFirestoreErrorReason('Site Traffic', results[5].reason));
      }

      setLastUpdatedAt(Date.now());
      setIsLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    },
    [enabled, clearSourceError, setSourceError]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    settledRef.current = new Set();
    setIsLoading(true);

    // 1. Live Orders listener
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => {
          const raw = d.data() as Order;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setOrders(deduplicateOrders(list));
        clearSourceError('orders');
        setLastUpdatedAt(Date.now());
        markSettled('orders');
      },
      (err) => {
        setSourceError('orders', formatFirestoreErrorReason('Orders', err));
        markSettled('orders');
      }
    );

    // 2. Live Products listener
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: BedsheetProduct[] = [];
        snap.forEach((d) => {
          const raw = d.data() as BedsheetProduct;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        if (list.length > 0) {
          list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          setProducts(list);
        }
        clearSourceError('products');
        setLastUpdatedAt(Date.now());
        markSettled('products');
      },
      (err) => {
        setSourceError('products', formatFirestoreErrorReason('Products', err));
        markSettled('products');
      }
    );

    // 3. Live Reviews listener
    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const list: ProductReview[] = [];
        snap.forEach((d) => {
          const raw = d.data() as ProductReview;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setReviews(deduplicateReviews(list));
        clearSourceError('reviews');
        setLastUpdatedAt(Date.now());
        markSettled('reviews');
      },
      (err) => {
        setSourceError('reviews', formatFirestoreErrorReason('Reviews', err));
        markSettled('reviews');
      }
    );

    // 4. Live Wishlists listener
    const unsubWishlists = onSnapshot(
      collection(db, 'wishlists'),
      (snap) => {
        const list: WishlistItem[] = [];
        snap.forEach((d) => {
          const raw = d.data() as WishlistItem;
          if (raw && d.id) list.push({ ...raw, id: d.id });
        });
        setWishlists(deduplicateWishlists(list));
        clearSourceError('wishlists');
        setLastUpdatedAt(Date.now());
        markSettled('wishlists');
      },
      (err) => {
        setSourceError('wishlists', formatFirestoreErrorReason('Wishlists', err));
        markSettled('wishlists');
      }
    );

    // 5. Live Customer Activity listener
    const unsubProfiles = onSnapshot(
      collection(db, 'customer_activity'),
      (snap) => {
        const list: CustomerActivityProfile[] = [];
        snap.forEach((d) => {
          const raw = d.data() as CustomerActivityProfile;
          if (raw) list.push({ ...raw, uid: raw.uid || d.id });
        });
        setCustomerProfiles(list);
        clearSourceError('customer_activity');
        setLastUpdatedAt(Date.now());
        markSettled('customer_activity');
      },
      (err) => {
        setSourceError('customer_activity', formatFirestoreErrorReason('Customer Activity', err));
        markSettled('customer_activity');
      }
    );

    // 6. Live Site Traffic listener
    const unsubTraffic = onSnapshot(
      doc(db, ANALYTICS_COLLECTION, SITE_TRAFFIC_DOC_ID),
      (snap) => {
        setTrafficData(
          snap.exists()
            ? normalizeTrafficData(snap.data() as Partial<SiteTrafficData>)
            : getEmptyTrafficData()
        );
        clearSourceError('traffic');
        setLastUpdatedAt(Date.now());
        markSettled('traffic');
      },
      (err) => {
        setSourceError('traffic', formatFirestoreErrorReason('Site Traffic', err));
        markSettled('traffic');
      }
    );

    return () => {
      unsubOrders();
      unsubProducts();
      unsubReviews();
      unsubWishlists();
      unsubProfiles();
      unsubTraffic();
    };
  }, [enabled, clearSourceError, markSettled, setSourceError]);

  const errorMessages = Object.values(sourceErrors).filter(Boolean) as string[];
  const syncError = errorMessages.length > 0 ? errorMessages.join(' | ') : null;

  const refresh = useCallback(async () => {
    await fetchServerVerifiedAll(true);
  }, [fetchServerVerifiedAll]);

  return {
    orders,
    products,
    reviews,
    wishlists,
    customerProfiles,
    trafficData,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    sourceErrors,
    syncError,
    refresh,
  };
}
