/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BedsheetProduct } from './products';
import { Order, OrderStatus } from './orders';
import { ProductReview } from './reviews';
import { WishlistItem } from './wishlist';
import { SiteTrafficData } from './analytics';
import {
  CustomerActivityProfile,
  CustomerDeviceType,
  sanitizeCustomerUid,
} from './customerActivity';

export type ReportingPeriod = 'today' | '7d' | '30d' | 'all' | 'custom';

export interface ReportingPeriodFilter {
  period: ReportingPeriod;
  customStart?: string; // 'YYYY-MM-DD' in IST
  customEnd?: string;   // 'YYYY-MM-DD' in IST
  includeTestOrders?: boolean;
  nowMs?: number;
}

export interface ReportingPeriodBounds {
  period: ReportingPeriod;
  startMs: number | null;
  endMs: number | null;
  startDateKey: string | null;
  endDateKey: string | null;
  label: string;
}

export interface OrderAnalyticsSummary {
  totalOrders: number;           // All non-test orders in period (including cancelled)
  activeOrders: number;          // Non-cancelled, non-test orders (pending + confirmed + dispatched + delivered)
  pendingOrders: number;
  confirmedOrders: number;
  dispatchedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  excludedTestOrders: number;
  totalUnitsSold: number;        // Units across active (non-cancelled, non-test) orders
  grossOrderValue: number;       // Sum of order.totalAmount across active (non-cancelled) orders
  actualRevenue: number;         // Confirmed + Dispatched + Delivered order totalAmount
  deliveredRevenue: number;      // Delivered order totalAmount only
  inProgressConfirmedRevenue: number; // Confirmed + Dispatched order totalAmount
  pendingPaymentValue: number;   // Pending order totalAmount awaiting confirmation/payment
  cancelledOrderValue: number;   // Total value of cancelled orders (not counted in revenue)
  averageOrderValue: number;     // grossOrderValue / activeOrders (0 when activeOrders === 0)
  confirmedAverageOrderValue: number; // actualRevenue / confirmedOrBeyondOrders
}

export interface UnifiedProductMetric {
  productId: string;
  name: string;
  collection: string;
  price: number;
  image: string;
  inStock: boolean;
  stockQuantity: number;
  threadCount: string;
  orderCount: number;
  unitsSold: number;
  grossSalesRevenue: number;
  actualSalesRevenue: number;
  percentageOfRevenue: number;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  verifiedBuyerCount: number;
  recommendedPercentage: number;
  topReviewExcerpt?: string;
  wishlistCount: number;
  uniqueWishlistCustomers: number;
  wishlistConversionRate: number;
  totalViews: number;
  uniqueViewers: number;
  cartAdds: number;
  interestScore: number;
}

export interface UnifiedCustomerSummary {
  totalRegisteredCustomers: number;
  registeredInPeriod: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  returningPercentage: number;
  newPercentage: number;
  totalSessions: number;
  totalActiveTimeSeconds: number;
  avgSessionDurationSeconds: number;
  totalProductViews: number;
  totalCartAdds: number;
  totalSearches: number;
  totalWishlistSaves: number;
  uniqueWishlistCustomers: number;
  wishlistPipelineValue: number;
  deviceCounts: {
    mobile: number;
    desktop: number;
    tablet: number;
    unknown: number;
  };
  devicePercentages: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
}

export interface UnifiedTrafficSummary {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  dailyTrend: Array<{
    dateKey: string;
    label: string;
    visits: number;
    percentage: number;
  }>;
  sectionViews: Record<string, number>;
  trafficSources: {
    direct: number;
    google: number;
    whatsapp: number;
    instagram: number;
    referrals: number;
  };
  deviceCounts: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  devicePercentages: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
}

export interface UnifiedEngagementSummary {
  totalReviews: number;
  averageRating: number;
  positiveReviewPercentage: number;
  verifiedBuyerReviews: number;
}

export interface UnifiedAnalyticsSnapshot {
  bounds: ReportingPeriodBounds;
  orders: OrderAnalyticsSummary;
  filteredOrders: Order[];
  activeOrders: Order[];
  products: UnifiedProductMetric[];
  bestSellingProducts: UnifiedProductMetric[];
  mostReviewedProducts: UnifiedProductMetric[];
  mostWishlistedProducts: UnifiedProductMetric[];
  customers: UnifiedCustomerSummary;
  reconciledProfiles: CustomerActivityProfile[];
  periodProfiles: CustomerActivityProfile[];
  traffic: UnifiedTrafficSummary;
  engagement: UnifiedEngagementSummary;
}

// India Standard Time is fixed UTC+05:30 with no daylight saving transitions
export const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parses epoch ms, ISO string, or Firestore Timestamp-like object into epoch milliseconds.
 */
export function parseTimestampMs(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    // Handle accidental Unix seconds timestamps (< 1e11)
    return input < 1e11 ? input * 1000 : input;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(trimmed)) {
      return numeric < 1e11 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof input === 'object') {
    const maybe = input as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') {
      const ms = maybe.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof maybe.seconds === 'number') {
      return maybe.seconds * 1000;
    }
  }
  return null;
}

/**
 * Converts any timestamp into YYYY-MM-DD in Indian Standard Time (Asia/Kolkata).
 */
export function toISTDateKey(ts: number | string | Date = Date.now()): string {
  const ms = ts instanceof Date ? ts.getTime() : parseTimestampMs(ts);
  if (ms === null || !Number.isFinite(ms)) return '';
  const ist = new Date(ms + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getISTTodayKey(nowMs: number = Date.now()): string {
  return toISTDateKey(nowMs);
}

/**
 * Parses 'YYYY-MM-DD' into exact IST start (00:00:00.000 IST) & end (23:59:59.999 IST) UTC epoch ms.
 */
export function getISTDayBoundsMs(dateKey: string): { startMs: number; endMs: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const utcMidnightOfDate = Date.UTC(year, month, day, 0, 0, 0, 0);
  if (Number.isNaN(utcMidnightOfDate)) return null;
  const startMs = utcMidnightOfDate - IST_OFFSET_MS;
  const endMs = startMs + DAY_MS - 1;
  return { startMs, endMs };
}

/**
 * Generates ordered IST 'YYYY-MM-DD' keys for the trailing `days` calendar days ending today.
 */
export function getISTDateKeyRange(days: number, nowMs: number = Date.now()): string[] {
  const safeDays = Math.max(1, Math.floor(days));
  const todayKey = getISTTodayKey(nowMs);
  const todayBounds = getISTDayBoundsMs(todayKey);
  if (!todayBounds) return [todayKey];
  const keys: string[] = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    keys.push(toISTDateKey(todayBounds.startMs - i * DAY_MS));
  }
  return keys;
}

/**
 * Computes consistent IST reporting period boundaries used across all Cotton Nest dashboards.
 */
export function getReportingPeriodBounds(
  period: ReportingPeriod = 'all',
  customStart?: string,
  customEnd?: string,
  nowMs: number = Date.now()
): ReportingPeriodBounds {
  const todayKey = getISTTodayKey(nowMs);
  const todayBounds = getISTDayBoundsMs(todayKey)!;

  if (period === 'today') {
    return {
      period,
      startMs: todayBounds.startMs,
      endMs: todayBounds.endMs,
      startDateKey: todayKey,
      endDateKey: todayKey,
      label: 'Today (IST)',
    };
  }

  if (period === '7d') {
    const startMs = todayBounds.startMs - 6 * DAY_MS;
    return {
      period,
      startMs,
      endMs: todayBounds.endMs,
      startDateKey: toISTDateKey(startMs),
      endDateKey: todayKey,
      label: 'Last 7 Days (IST)',
    };
  }

  if (period === '30d') {
    const startMs = todayBounds.startMs - 29 * DAY_MS;
    return {
      period,
      startMs,
      endMs: todayBounds.endMs,
      startDateKey: toISTDateKey(startMs),
      endDateKey: todayKey,
      label: 'Last 30 Days (IST)',
    };
  }

  if (period === 'custom') {
    const startBounds = customStart ? getISTDayBoundsMs(customStart) : null;
    const endBounds = customEnd ? getISTDayBoundsMs(customEnd) : null;
    let startMs = startBounds ? startBounds.startMs : null;
    let endMs = endBounds ? endBounds.endMs : null;
    if (startMs !== null && endMs !== null && startMs > endMs) {
      const swappedStart = getISTDayBoundsMs(customEnd!)!.startMs;
      const swappedEnd = getISTDayBoundsMs(customStart!)!.endMs;
      startMs = swappedStart;
      endMs = swappedEnd;
    }
    return {
      period,
      startMs,
      endMs,
      startDateKey: startMs !== null ? toISTDateKey(startMs) : null,
      endDateKey: endMs !== null ? toISTDateKey(endMs) : null,
      label:
        customStart || customEnd
          ? `${customStart || 'Start'} to ${customEnd || 'Present'} (IST)`
          : 'Custom Range (IST)',
    };
  }

  return {
    period: 'all',
    startMs: null,
    endMs: null,
    startDateKey: null,
    endDateKey: null,
    label: 'All Time',
  };
}

export function isTimestampInBounds(ts: unknown, bounds: ReportingPeriodBounds): boolean {
  if (bounds.period === 'all' && bounds.startMs === null && bounds.endMs === null) {
    return true;
  }
  const ms = parseTimestampMs(ts);
  if (ms === null) return false;
  if (bounds.startMs !== null && ms < bounds.startMs) return false;
  if (bounds.endMs !== null && ms > bounds.endMs) return false;
  return true;
}

export function isDateKeyInBounds(dateKey: string, bounds: ReportingPeriodBounds): boolean {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  if (bounds.period === 'all' && !bounds.startDateKey && !bounds.endDateKey) return true;
  if (bounds.startDateKey && dateKey < bounds.startDateKey) return false;
  if (bounds.endDateKey && dateKey > bounds.endDateKey) return false;
  return true;
}

export function formatDateKeyShortIST(dateKey: string): string {
  const bounds = getISTDayBoundsMs(dateKey);
  if (!bounds) return dateKey;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
    }).format(new Date(bounds.startMs + IST_OFFSET_MS));
  } catch {
    return dateKey;
  }
}

export function formatLastUpdatedIST(ts?: number | Date | null): string {
  if (!ts) return 'Not synced yet';
  const ms = ts instanceof Date ? ts.getTime() : ts;
  if (!Number.isFinite(ms)) return 'Not synced yet';
  try {
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(ms)) + ' IST'
    );
  } catch {
    return new Date(ms).toLocaleString('en-IN') + ' IST';
  }
}

const ORDER_STATUS_PROGRESSION: Record<OrderStatus, number> = {
  pending: 1,
  confirmed: 2,
  dispatched: 3,
  delivered: 4,
  cancelled: 5,
};

/**
 * Deterministically deduplicates orders by normalized ID so the same order is never counted twice
 * across Firestore, server cache, or local state.
 */
export function deduplicateOrders(orders: Order[]): Order[] {
  const map = new Map<string, Order>();

  for (const raw of orders || []) {
    if (!raw || !raw.id) continue;
    const normalizedId = String(raw.id).trim();
    if (!normalizedId) continue;

    const candidate: Order = {
      ...raw,
      id: normalizedId,
      customerName: String(raw.customerName || 'Atelier Customer').trim(),
      customerPhone: String(raw.customerPhone || '').trim(),
      customerAddress: String(raw.customerAddress || '').trim(),
      items: Array.isArray(raw.items) ? raw.items : [],
      totalAmount: Math.max(0, Number(raw.totalAmount) || 0),
      totalSavings: Math.max(0, Number(raw.totalSavings) || 0),
      status: raw.status || 'pending',
      createdAt: raw.createdAt || new Date(0).toISOString(),
    };

    const existing = map.get(normalizedId);
    if (!existing) {
      map.set(normalizedId, candidate);
      continue;
    }

    const existingUpdated = parseTimestampMs(existing.updatedAt) ?? parseTimestampMs(existing.createdAt) ?? 0;
    const candidateUpdated = parseTimestampMs(candidate.updatedAt) ?? parseTimestampMs(candidate.createdAt) ?? 0;

    if (candidateUpdated > existingUpdated) {
      map.set(normalizedId, candidate);
    } else if (candidateUpdated === existingUpdated) {
      const existingRank = ORDER_STATUS_PROGRESSION[existing.status] || 0;
      const candidateRank = ORDER_STATUS_PROGRESSION[candidate.status] || 0;
      const existingScore = existingRank * 10 + (existing.timeline?.length || 0) + (existing.invoiceGenerated ? 5 : 0);
      const candidateScore = candidateRank * 10 + (candidate.timeline?.length || 0) + (candidate.invoiceGenerated ? 5 : 0);
      if (candidateScore >= existingScore) {
        map.set(normalizedId, candidate);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const tA = parseTimestampMs(a.createdAt) ?? 0;
    const tB = parseTimestampMs(b.createdAt) ?? 0;
    return tB - tA;
  });
}

/**
 * Consistently classifies synthetic/test orders so all dashboards treat them identically.
 */
export function isTestOrder(order: Order): boolean {
  if (!order) return true;
  if ((order as unknown as { isTestOrder?: boolean }).isTestOrder === true) return true;

  const idUpper = String(order.id || '').trim().toUpperCase();
  if (idUpper.startsWith('TEST-') || idUpper.startsWith('CN-TEST-') || idUpper.includes('_TEST_')) {
    return true;
  }

  const emailLower = String(order.customerEmail || '').trim().toLowerCase();
  if (
    emailLower.endsWith('@example.com') ||
    emailLower.endsWith('@test.com') ||
    emailLower.startsWith('test+')
  ) {
    return true;
  }

  const nameLower = String(order.customerName || '').trim().toLowerCase();
  if (/^test(\s+(user|order|customer|account))?$/i.test(nameLower) || /\btest\s*order\b/i.test(nameLower)) {
    return true;
  }

  const notesLower = String(order.notes || '').trim().toLowerCase();
  if (notesLower.includes('[test]') || /\btest\s+order\b/i.test(notesLower)) {
    return true;
  }

  if ((Number(order.totalAmount) || 0) < 0) {
    return true;
  }

  return false;
}

/**
 * Computes unified order counts, status breakdown, revenue vs pending payment distinction, and AOV.
 */
export function computeOrderAnalytics(
  rawOrders: Order[],
  filter: ReportingPeriodFilter = { period: 'all' }
): {
  summary: OrderAnalyticsSummary;
  filteredOrders: Order[];
  activeOrders: Order[];
  bounds: ReportingPeriodBounds;
} {
  const bounds = getReportingPeriodBounds(
    filter.period,
    filter.customStart,
    filter.customEnd,
    filter.nowMs
  );
  const deduped = deduplicateOrders(rawOrders);

  let excludedTestOrders = 0;
  const filteredOrders: Order[] = [];

  for (const order of deduped) {
    if (!isTimestampInBounds(order.createdAt, bounds)) continue;
    if (!filter.includeTestOrders && isTestOrder(order)) {
      excludedTestOrders += 1;
      continue;
    }
    filteredOrders.push(order);
  }

  let pendingOrders = 0;
  let confirmedOrders = 0;
  let dispatchedOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;

  let grossOrderValue = 0;
  let actualRevenue = 0;
  let deliveredRevenue = 0;
  let inProgressConfirmedRevenue = 0;
  let pendingPaymentValue = 0;
  let cancelledOrderValue = 0;
  let totalUnitsSold = 0;

  const activeOrders: Order[] = [];

  for (const order of filteredOrders) {
    const amount = Math.max(0, Number(order.totalAmount) || 0);
    const status = (order.status || 'pending') as OrderStatus;

    if (status === 'cancelled') {
      cancelledOrders += 1;
      cancelledOrderValue += amount;
      continue;
    }

    activeOrders.push(order);
    grossOrderValue += amount;

    for (const item of order.items || []) {
      totalUnitsSold += Math.max(1, Number(item.quantity) || 1);
    }

    if (status === 'pending') {
      pendingOrders += 1;
      pendingPaymentValue += amount;
    } else if (status === 'confirmed') {
      confirmedOrders += 1;
      actualRevenue += amount;
      inProgressConfirmedRevenue += amount;
    } else if (status === 'dispatched') {
      dispatchedOrders += 1;
      actualRevenue += amount;
      inProgressConfirmedRevenue += amount;
    } else if (status === 'delivered') {
      deliveredOrders += 1;
      actualRevenue += amount;
      deliveredRevenue += amount;
    }
  }

  const activeCount = activeOrders.length;
  const confirmedOrBeyondCount = confirmedOrders + dispatchedOrders + deliveredOrders;

  return {
    bounds,
    filteredOrders,
    activeOrders,
    summary: {
      totalOrders: filteredOrders.length,
      activeOrders: activeCount,
      pendingOrders,
      confirmedOrders,
      dispatchedOrders,
      deliveredOrders,
      cancelledOrders,
      excludedTestOrders,
      totalUnitsSold,
      grossOrderValue: Math.round(grossOrderValue),
      actualRevenue: Math.round(actualRevenue),
      deliveredRevenue: Math.round(deliveredRevenue),
      inProgressConfirmedRevenue: Math.round(inProgressConfirmedRevenue),
      pendingPaymentValue: Math.round(pendingPaymentValue),
      cancelledOrderValue: Math.round(cancelledOrderValue),
      averageOrderValue: activeCount > 0 ? Math.round(grossOrderValue / activeCount) : 0,
      confirmedAverageOrderValue:
        confirmedOrBeyondCount > 0 ? Math.round(actualRevenue / confirmedOrBeyondCount) : 0,
    },
  };
}

/**
 * Deduplicates wishlist entries cleanly by ID or canonical (customer, product) pair.
 */
export function deduplicateWishlists(wishlists: WishlistItem[]): WishlistItem[] {
  const byKey = new Map<string, WishlistItem>();
  for (const item of wishlists || []) {
    if (!item || !item.productId) continue;
    const customerKey = (
      item.customerId ||
      item.customerEmail ||
      item.customerPhone ||
      item.id ||
      'unknown'
    )
      .trim()
      .toLowerCase();
    const key = `${customerKey}__${String(item.productId).trim()}`;
    const existing = byKey.get(key);
    if (!existing || (Number(item.createdAt) || 0) >= (Number(existing.createdAt) || 0)) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );
}

/**
 * Deduplicates reviews by ID and ensures valid ratings (1..5).
 */
export function deduplicateReviews(reviews: ProductReview[]): ProductReview[] {
  const byId = new Map<string, ProductReview>();
  for (const r of reviews || []) {
    if (!r || !r.id) continue;
    byId.set(r.id, r);
  }
  return Array.from(byId.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );
}

/**
 * Reconciles signed-in customer activity profiles with real Firestore orders and wishlists
 * WITHOUT inventing fake synthetic sessions or fake active durations.
 */
export function reconcileAnalyticsCustomerProfiles(
  rawProfiles: CustomerActivityProfile[],
  rawOrders: Order[],
  rawWishlists: WishlistItem[]
): CustomerActivityProfile[] {
  const byUid = new Map<string, CustomerActivityProfile>();
  const orders = deduplicateOrders(rawOrders).filter((o) => !isTestOrder(o));
  const wishlists = deduplicateWishlists(rawWishlists);

  for (const prof of rawProfiles || []) {
    if (!prof || !prof.uid) continue;
    const uid = sanitizeCustomerUid(prof.uid);
    const existing = byUid.get(uid);
    if (!existing || (Number(prof.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
      byUid.set(uid, {
        ...prof,
        uid,
        productsViewed: Array.isArray(prof.productsViewed) ? prof.productsViewed : [],
        currentWishlist: Array.isArray(prof.currentWishlist) ? prof.currentWishlist : [],
        historicalWishlist: Array.isArray(prof.historicalWishlist) ? prof.historicalWishlist : [],
        cartActivity: Array.isArray(prof.cartActivity) ? prof.cartActivity : [],
        searchHistory: Array.isArray(prof.searchHistory) ? prof.searchHistory : [],
        sessions: Array.isArray(prof.sessions) ? prof.sessions : [],
        timeline: Array.isArray(prof.timeline) ? prof.timeline : [],
        pageVisitCounts: prof.pageVisitCounts || {},
      });
    }
  }

  const findMatchingProfile = (
    userId?: string,
    email?: string,
    phone?: string
  ): CustomerActivityProfile | undefined => {
    if (userId) {
      const cleanId = sanitizeCustomerUid(userId);
      if (byUid.has(cleanId)) return byUid.get(cleanId);
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '').slice(-10);

    for (const p of byUid.values()) {
      if (cleanEmail && p.email && p.email.trim().toLowerCase() === cleanEmail) return p;
      if (
        cleanPhone &&
        cleanPhone.length >= 10 &&
        p.phone &&
        p.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone
      ) {
        return p;
      }
    }
    return undefined;
  };

  // Reconcile registered/identified wishlist owners
  for (const w of wishlists) {
    const isGuestId =
      !w.customerEmail && (!w.customerId || String(w.customerId).startsWith('guest_'));
    let profile = findMatchingProfile(w.customerId, w.customerEmail, w.customerPhone);

    if (!profile && !isGuestId) {
      const uid = sanitizeCustomerUid(w.customerId || w.customerEmail || '');
      const addedTs = parseTimestampMs(w.createdAt) ?? 0;
      profile = {
        uid,
        customerName: w.customerName || 'Signed-In Customer',
        email: w.customerEmail || '',
        phone: w.customerPhone || '',
        accountCreatedAt: addedTs,
        lastLoginAt: addedTs,
        lastActiveAt: addedTs,
        totalSessions: 1,
        totalTimeSpentSeconds: 0,
        averageSessionDurationSeconds: 0,
        totalPagesVisited: 0,
        pageVisitCounts: {},
        mostVisitedPage: 'Bedsheet Catalogue',
        totalProductViews: 0,
        productsViewed: [],
        totalAddedToCartCount: 0,
        cartActivity: [],
        totalAddedToWishlistCount: 0,
        currentWishlist: [],
        historicalWishlist: [],
        totalSearches: 0,
        searchHistory: [],
        ordersPlacedCount: 0,
        totalPurchaseValue: 0,
        deviceInfo: {
          deviceType: 'Desktop',
          os: 'Not recorded',
          browser: 'Not recorded',
          screenResolution: '—',
          deviceCategory: 'Web / App Customer',
          approximateLocation: 'India (IST Region)',
          language: 'en-IN',
        },
        sessions: [],
        timeline: [],
        updatedAt: addedTs,
      };
      byUid.set(uid, profile);
    }

    if (profile) {
      const addedTs = parseTimestampMs(w.createdAt) ?? 0;
      if (!profile.currentWishlist.some((item) => item.productId === w.productId)) {
        profile.currentWishlist.push({
          productId: w.productId,
          productName: w.productName,
          productImage: w.productImage,
          productPrice: w.productPrice,
          addedAt: addedTs,
          currentlyInWishlist: true,
        });
      }
      if (!profile.historicalWishlist.some((item) => item.productId === w.productId)) {
        profile.historicalWishlist.push({
          productId: w.productId,
          productName: w.productName,
          productImage: w.productImage,
          productPrice: w.productPrice,
          addedAt: addedTs,
          currentlyInWishlist: true,
        });
      }
      profile.totalAddedToWishlistCount = Math.max(
        profile.totalAddedToWishlistCount || 0,
        profile.historicalWishlist.length,
        profile.currentWishlist.length
      );
      if (addedTs > (profile.lastActiveAt || 0)) {
        profile.lastActiveAt = addedTs;
      }
    }
  }

  // Reconcile customer records from non-cancelled orders without inventing synthetic session durations
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    let profile = findMatchingProfile(o.userId, o.customerEmail, o.customerPhone);
    const orderTs = parseTimestampMs(o.createdAt) ?? 0;

    if (!profile) {
      const isAnonymousGuest =
        !o.customerEmail &&
        !o.customerPhone &&
        (!o.userId || String(o.userId).startsWith('guest_'));
      if (!isAnonymousGuest) {
        const uid = sanitizeCustomerUid(
          o.userId || o.customerEmail || o.customerPhone || `cust_ord_${o.id}`
        );
        profile = {
          uid,
          customerName: o.customerName || 'Cotton Nest Customer',
          email: o.customerEmail || '',
          phone: o.customerPhone || '',
          accountCreatedAt: orderTs,
          lastLoginAt: orderTs,
          lastActiveAt: orderTs,
          totalSessions: 1,
          totalTimeSpentSeconds: 0,
          averageSessionDurationSeconds: 0,
          totalPagesVisited: 0,
          pageVisitCounts: {},
          mostVisitedPage: 'Orders',
          totalProductViews: 0,
          productsViewed: [],
          totalAddedToCartCount: 0,
          cartActivity: [],
          totalAddedToWishlistCount: 0,
          currentWishlist: [],
          historicalWishlist: [],
          totalSearches: 0,
          searchHistory: [],
          ordersPlacedCount: 0,
          totalPurchaseValue: 0,
          deviceInfo: {
            deviceType: 'Desktop',
            os: 'Not recorded',
            browser: 'Not recorded',
            screenResolution: '—',
            deviceCategory: 'Web / App Customer',
            approximateLocation: 'India (IST Region)',
            language: 'en-IN',
          },
          sessions: [],
          timeline: [],
          updatedAt: orderTs,
        };
        byUid.set(uid, profile);
      }
    } else {
      if (o.customerPhone && !profile.phone) profile.phone = o.customerPhone;
      if (o.customerEmail && !profile.email) profile.email = o.customerEmail;
      if (
        o.customerName &&
        (!profile.customerName ||
          profile.customerName === 'Cotton Nest Customer' ||
          profile.customerName === 'Signed-In Customer')
      ) {
        profile.customerName = o.customerName;
      }
      if (orderTs > (profile.lastActiveAt || 0)) {
        profile.lastActiveAt = orderTs;
      }
    }
  }

  // Recompute exact order counts & spend per profile from deduplicated active orders
  for (const profile of byUid.values()) {
    const cleanEmail = (profile.email || '').trim().toLowerCase();
    const cleanPhone = (profile.phone || '').replace(/[^0-9]/g, '').slice(-10);

    const matchedOrders = orders.filter((o) => {
      if (o.status === 'cancelled') return false;
      if (o.userId && sanitizeCustomerUid(o.userId) === profile.uid) return true;
      const oEmail = (o.customerEmail || '').trim().toLowerCase();
      const oPhone = (o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
      if (cleanEmail && oEmail && cleanEmail === oEmail) return true;
      if (cleanPhone && cleanPhone.length >= 10 && oPhone && cleanPhone === oPhone) return true;
      return false;
    });

    if (matchedOrders.length > 0) {
      profile.ordersPlacedCount = matchedOrders.length;
      profile.totalPurchaseValue = Math.round(
        matchedOrders.reduce((acc, ord) => acc + (Number(ord.totalAmount) || 0), 0)
      );
    }
  }

  return Array.from(byUid.values()).sort(
    (a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0)
  );
}

/**
 * Computes site traffic summary filtered cleanly by IST reporting period.
 */
export function computePeriodTrafficSummary(
  trafficData: SiteTrafficData | null | undefined,
  bounds: ReportingPeriodBounds
): UnifiedTrafficSummary {
  const safeData: SiteTrafficData = trafficData || {
    totalVisits: 0,
    uniqueVisitors: 0,
    todayVisits: 0,
    lastVisitedAt: 0,
    pageViewsByDate: {},
    pageViewsBySection: {},
    trafficSources: { direct: 0, google: 0, whatsapp: 0, instagram: 0, referrals: 0 },
    deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
  };

  const todayKey = getISTTodayKey();
  const pageViewsByDate = safeData.pageViewsByDate || {};

  // Build ordered daily trend chart for either the reporting window or past 14 days when 'all'
  const chartKeys: string[] = (() => {
    if (bounds.period === 'today') return [todayKey];
    if (bounds.period === '7d') return getISTDateKeyRange(7);
    if (bounds.period === '30d') return getISTDateKeyRange(30);
    if (bounds.period === 'custom' && bounds.startDateKey && bounds.endDateKey) {
      const startB = getISTDayBoundsMs(bounds.startDateKey);
      const endB = getISTDayBoundsMs(bounds.endDateKey);
      if (startB && endB) {
        const diffDays = Math.min(90, Math.max(1, Math.round((endB.startMs - startB.startMs) / DAY_MS) + 1));
        const keys: string[] = [];
        for (let i = 0; i < diffDays; i++) {
          keys.push(toISTDateKey(startB.startMs + i * DAY_MS));
        }
        return keys;
      }
    }
    return getISTDateKeyRange(14);
  })();

  const dailyRaw = chartKeys.map((dateKey) => ({
    dateKey,
    label: formatDateKeyShortIST(dateKey),
    visits: Math.max(0, Number(pageViewsByDate[dateKey]) || 0),
  }));
  const maxDaily = Math.max(...dailyRaw.map((d) => d.visits), 1);
  const dailyTrend = dailyRaw.map((d) => ({
    ...d,
    percentage: d.visits > 0 ? Math.round((d.visits / maxDaily) * 100) : 0,
  }));

  const periodVisitsFromDates = Object.entries(pageViewsByDate).reduce((sum, [dateKey, count]) => {
    if (!isDateKeyInBounds(dateKey, bounds)) return sum;
    return sum + Math.max(0, Number(count) || 0);
  }, 0);

  const totalAllTimeVisits = Math.max(
    Number(safeData.totalVisits) || 0,
    Object.values(pageViewsByDate).reduce((s, c) => s + Math.max(0, Number(c) || 0), 0)
  );

  const totalVisits =
    bounds.period === 'all' ? totalAllTimeVisits : periodVisitsFromDates;

  const todayVisits = Math.max(
    0,
    Number(pageViewsByDate[todayKey]) ?? Number(safeData.todayVisits) ?? 0
  );

  // Device counts (note: support both raw count docs and legacy percentage-only docs)
  const rawDev = safeData.deviceBreakdown || { mobile: 0, desktop: 0, tablet: 0 };
  const devMobile = Math.max(0, Number(rawDev.mobile) || 0);
  const devDesktop = Math.max(0, Number(rawDev.desktop) || 0);
  const devTablet = Math.max(0, Number(rawDev.tablet) || 0);
  const devTotal = devMobile + devDesktop + devTablet;

  const devicePercentages =
    devTotal > 0
      ? {
          mobile: Math.round((devMobile / devTotal) * 100),
          desktop: Math.round((devDesktop / devTotal) * 100),
          tablet: Math.max(0, 100 - Math.round((devMobile / devTotal) * 100) - Math.round((devDesktop / devTotal) * 100)),
        }
      : { mobile: 0, desktop: 0, tablet: 0 };

  return {
    totalVisits,
    uniqueVisitors: Math.max(0, Number(safeData.uniqueVisitors) || 0),
    todayVisits,
    dailyTrend,
    sectionViews: safeData.pageViewsBySection || {},
    trafficSources: {
      direct: Math.max(0, Number(safeData.trafficSources?.direct) || 0),
      google: Math.max(0, Number(safeData.trafficSources?.google) || 0),
      whatsapp: Math.max(0, Number(safeData.trafficSources?.whatsapp) || 0),
      instagram: Math.max(0, Number(safeData.trafficSources?.instagram) || 0),
      referrals: Math.max(0, Number(safeData.trafficSources?.referrals) || 0),
    },
    deviceCounts: {
      mobile: devMobile,
      desktop: devDesktop,
      tablet: devTablet,
    },
    devicePercentages,
  };
}

/**
 * Computes ALL Cotton Nest analytics metrics through a single deterministic pipeline.
 * Every view (Store AnalyticsView, Admin Customer Analytics, Admin Orders/Overview, Mobile & Desktop)
 * uses this exact function so figures are always 100% identical across platforms.
 */
export function computeUnifiedAnalyticsSnapshot(input: {
  products: BedsheetProduct[];
  orders: Order[];
  reviews: ProductReview[];
  wishlists: WishlistItem[];
  customerProfiles: CustomerActivityProfile[];
  trafficData?: SiteTrafficData | null;
  filter?: ReportingPeriodFilter;
}): UnifiedAnalyticsSnapshot {
  const filter: ReportingPeriodFilter = input.filter || { period: 'all' };
  const products = Array.isArray(input.products) ? input.products : [];
  const { summary: orderSummary, filteredOrders, activeOrders, bounds } = computeOrderAnalytics(
    input.orders || [],
    filter
  );

  const allReviews = deduplicateReviews(input.reviews || []);
  const periodReviews = allReviews.filter((r) => isTimestampInBounds(r.createdAt, bounds));

  const allWishlists = deduplicateWishlists(input.wishlists || []);
  const periodWishlists = allWishlists.filter((w) => isTimestampInBounds(w.createdAt, bounds));

  const reconciledProfiles = reconcileAnalyticsCustomerProfiles(
    input.customerProfiles || [],
    input.orders || [],
    allWishlists
  );

  // Profiles active within reporting period
  const periodProfiles = reconciledProfiles.filter((p) => {
    if (bounds.period === 'all' && bounds.startMs === null && bounds.endMs === null) return true;
    const lastActive = parseTimestampMs(p.lastActiveAt) ?? parseTimestampMs(p.lastLoginAt) ?? parseTimestampMs(p.accountCreatedAt);
    const createdAt = parseTimestampMs(p.accountCreatedAt);
    return (
      (lastActive !== null && isTimestampInBounds(lastActive, bounds)) ||
      (createdAt !== null && isTimestampInBounds(createdAt, bounds))
    );
  });

  // Build product lookup helpers (by ID and normalized name)
  const productById = new Map<string, BedsheetProduct>();
  const productByName = new Map<string, BedsheetProduct>();
  for (const p of products) {
    if (!p || !p.id) continue;
    productById.set(p.id, p);
    if (p.name) {
      productByName.set(p.name.trim().toLowerCase(), p);
    }
  }

  const resolveCatalogId = (productId?: string, productName?: string): string => {
    const cleanId = String(productId || '').trim();
    if (cleanId && productById.has(cleanId)) return cleanId;
    const cleanName = String(productName || '').trim().toLowerCase();
    if (cleanName && productByName.has(cleanName)) {
      return productByName.get(cleanName)!.id;
    }
    return cleanId;
  };

  interface ProductAccumulator {
    productId: string;
    name: string;
    collection: string;
    price: number;
    image: string;
    inStock: boolean;
    stockQuantity: number;
    threadCount: string;
    orderIds: Set<string>;
    unitsSold: number;
    grossSalesRevenue: number;
    actualSalesRevenue: number;
    reviews: ProductReview[];
    fiveStarCount: number;
    fourStarCount: number;
    verifiedBuyerCount: number;
    ratingSum: number;
    wishlistCustomerKeys: Set<string>;
    totalViews: number;
    viewerUids: Set<string>;
    cartAdds: number;
  }

  const productMap = new Map<string, ProductAccumulator>();

  const ensureProductAcc = (
    rawId: string,
    fallback?: {
      name?: string;
      image?: string;
      price?: number;
      collection?: string;
    }
  ): ProductAccumulator | null => {
    const cleanId = resolveCatalogId(rawId, fallback?.name);
    if (!cleanId) return null;
    let acc = productMap.get(cleanId);
    if (!acc) {
      const cat = productById.get(cleanId);
      acc = {
        productId: cleanId,
        name: cat?.name || fallback?.name || cleanId,
        collection: cat?.collection || fallback?.collection || 'Pure Cotton Collection',
        price: cat?.price ?? fallback?.price ?? 0,
        image: cat?.image || fallback?.image || '',
        inStock: cat ? cat.inStock !== false : true,
        stockQuantity: cat?.stockQuantity ?? 0,
        threadCount: cat?.threadCount || '300 TC',
        orderIds: new Set<string>(),
        unitsSold: 0,
        grossSalesRevenue: 0,
        actualSalesRevenue: 0,
        reviews: [],
        fiveStarCount: 0,
        fourStarCount: 0,
        verifiedBuyerCount: 0,
        ratingSum: 0,
        wishlistCustomerKeys: new Set<string>(),
        totalViews: 0,
        viewerUids: new Set<string>(),
        cartAdds: 0,
      };
      productMap.set(cleanId, acc);
    }
    return acc;
  };

  for (const p of products) {
    ensureProductAcc(p.id);
  }

  // 1. Aggregate product-wise sales across activeOrders (deduplicated, non-cancelled, non-test, in period)
  for (const order of activeOrders) {
    const isConfirmedOrBeyond =
      order.status === 'confirmed' ||
      order.status === 'dispatched' ||
      order.status === 'delivered';
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsRawSubtotal = items.reduce(
      (s, it) => s + Math.max(0, Number(it.price) || 0) * Math.max(1, Number(it.quantity) || 1),
      0
    );
    const orderTotal = Math.max(0, Number(order.totalAmount) || 0);

    for (const item of items) {
      const acc = ensureProductAcc(item.productId, {
        name: item.productName,
        image: item.productImage,
        price: item.price,
      });
      if (!acc) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const lineRaw = Math.max(0, Number(item.price) || 0) * qty;
      // Allocate order total proportionally so product revenue sums accurately reconcile with net order amounts
      const lineAllocated =
        itemsRawSubtotal > 0
          ? (lineRaw / itemsRawSubtotal) * orderTotal
          : items.length > 0
          ? orderTotal / items.length
          : 0;

      acc.orderIds.add(order.id);
      acc.unitsSold += qty;
      acc.grossSalesRevenue += lineAllocated;
      if (isConfirmedOrBeyond) {
        acc.actualSalesRevenue += lineAllocated;
      }
    }
  }

  // 2. Aggregate real customer reviews (within period)
  for (const r of periodReviews) {
    const acc = ensureProductAcc(r.productId, { name: r.productName });
    if (!acc) continue;
    acc.reviews.push(r);
    if (r.rating === 5) acc.fiveStarCount += 1;
    if (r.rating === 4) acc.fourStarCount += 1;
    if (r.verifiedPurchase) acc.verifiedBuyerCount += 1;
    acc.ratingSum += Number(r.rating) || 0;
  }

  // 3. Aggregate real wishlists (from Firestore wishlists + customer profile historical/current saves within period)
  for (const w of periodWishlists) {
    const acc = ensureProductAcc(w.productId, {
      name: w.productName,
      image: w.productImage,
      price: w.productPrice,
      collection: w.collection,
    });
    if (!acc) continue;
    const customerKey = (w.customerId || w.customerEmail || w.customerPhone || w.id).trim().toLowerCase();
    acc.wishlistCustomerKeys.add(customerKey);
  }

  for (const profile of reconciledProfiles) {
    // Viewed products within period
    for (const viewed of profile.productsViewed || []) {
      const viewTs = viewed.lastViewedAt || viewed.firstViewedAt || profile.lastActiveAt;
      if (bounds.period !== 'all' && !isTimestampInBounds(viewTs, bounds)) continue;
      const acc = ensureProductAcc(viewed.productId, {
        name: viewed.productName,
        image: viewed.productImage,
        price: viewed.productPrice,
        collection: viewed.collection,
      });
      if (acc) {
        acc.totalViews += Math.max(1, Number(viewed.viewCount) || 1);
        acc.viewerUids.add(profile.uid);
      }
    }

    // Current/Historical wishlist items within period
    for (const w of profile.currentWishlist || []) {
      if (bounds.period !== 'all' && !isTimestampInBounds(w.addedAt || profile.lastActiveAt, bounds)) {
        continue;
      }
      const acc = ensureProductAcc(w.productId, {
        name: w.productName,
        image: w.productImage,
        price: w.productPrice,
      });
      if (acc) {
        acc.wishlistCustomerKeys.add(profile.uid.toLowerCase());
      }
    }

    // Cart activity within period
    for (const c of profile.cartActivity || []) {
      if (bounds.period !== 'all' && !isTimestampInBounds(c.addedAt || profile.lastActiveAt, bounds)) {
        continue;
      }
      const acc = ensureProductAcc(c.productId, {
        name: c.productName,
        image: c.productImage,
        price: c.productPrice,
      });
      if (acc) {
        acc.cartAdds += Math.max(1, Number(c.quantity) || 1);
      }
    }
  }

  const grandGrossProductRevenue =
    Array.from(productMap.values()).reduce((s, p) => s + p.grossSalesRevenue, 0) || 1;

  const unifiedProducts: UnifiedProductMetric[] = Array.from(productMap.values()).map((acc) => {
    const revCount = acc.reviews.length;
    const avgRating = revCount > 0 ? Number((acc.ratingSum / revCount).toFixed(1)) : 0;
    const recommendedPct =
      revCount > 0
        ? Math.round(((acc.fiveStarCount + acc.fourStarCount) / revCount) * 100)
        : 0;
    const topReview = [...acc.reviews].sort(
      (a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0)
    )[0];

    const wishlistCount = acc.wishlistCustomerKeys.size;
    const conversion =
      wishlistCount > 0
        ? Math.min(100, Math.round((acc.unitsSold / wishlistCount) * 100))
        : 0;
    const uniqueViewers = acc.viewerUids.size;
    const interestScore =
      acc.totalViews * 5 +
      uniqueViewers * 10 +
      wishlistCount * 18 +
      acc.cartAdds * 22 +
      acc.unitsSold * 35;

    return {
      productId: acc.productId,
      name: acc.name,
      collection: acc.collection,
      price: acc.price,
      image: acc.image,
      inStock: acc.inStock,
      stockQuantity: acc.stockQuantity,
      threadCount: acc.threadCount,
      orderCount: acc.orderIds.size,
      unitsSold: acc.unitsSold,
      grossSalesRevenue: Math.round(acc.grossSalesRevenue),
      actualSalesRevenue: Math.round(acc.actualSalesRevenue),
      percentageOfRevenue:
        acc.grossSalesRevenue > 0
          ? Math.round((acc.grossSalesRevenue / grandGrossProductRevenue) * 100)
          : 0,
      totalReviews: revCount,
      averageRating: avgRating,
      fiveStarCount: acc.fiveStarCount,
      fourStarCount: acc.fourStarCount,
      verifiedBuyerCount: acc.verifiedBuyerCount,
      recommendedPercentage: recommendedPct,
      topReviewExcerpt: topReview?.comment,
      wishlistCount,
      uniqueWishlistCustomers: wishlistCount,
      wishlistConversionRate: conversion,
      totalViews: acc.totalViews,
      uniqueViewers,
      cartAdds: acc.cartAdds,
      interestScore,
    };
  });

  const bestSellingProducts = [...unifiedProducts].sort((a, b) => {
    if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
    if (b.actualSalesRevenue !== a.actualSalesRevenue) return b.actualSalesRevenue - a.actualSalesRevenue;
    return b.grossSalesRevenue - a.grossSalesRevenue;
  });

  const mostReviewedProducts = [...unifiedProducts].sort((a, b) => {
    if (b.totalReviews !== a.totalReviews) return b.totalReviews - a.totalReviews;
    return b.averageRating - a.averageRating;
  });

  const mostWishlistedProducts = [...unifiedProducts].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    return b.unitsSold - a.unitsSold;
  });

  // 4. Customer & Engagement Metrics
  const returningInPeriod = periodProfiles.filter((p) => (p.totalSessions || 1) > 1);
  const newInPeriod = periodProfiles.filter((p) => (p.totalSessions || 1) <= 1);
  const registeredInPeriod = reconciledProfiles.filter((p) =>
    isTimestampInBounds(p.accountCreatedAt || p.lastLoginAt || p.lastActiveAt, bounds)
  );

  let totalSessions = 0;
  let totalActiveTimeSeconds = 0;
  let totalProductViews = 0;
  let totalCartAdds = 0;
  let totalSearches = 0;
  const deviceCounts = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };

  for (const p of periodProfiles) {
    totalSessions += Math.max(1, Number(p.totalSessions) || 1);
    totalActiveTimeSeconds += Math.max(0, Number(p.totalTimeSpentSeconds) || 0);
    totalProductViews += Math.max(0, Number(p.totalProductViews) || 0);
    totalCartAdds += Math.max(0, Number(p.totalAddedToCartCount) || 0);
    totalSearches += Math.max(0, Number(p.totalSearches) || 0);

    const dtype: CustomerDeviceType | string = p.deviceInfo?.deviceType || '';
    if (dtype === 'Mobile') deviceCounts.mobile += 1;
    else if (dtype === 'Desktop') deviceCounts.desktop += 1;
    else if (dtype === 'Tablet') deviceCounts.tablet += 1;
    else deviceCounts.unknown += 1;
  }

  const knownDevTotal = deviceCounts.mobile + deviceCounts.desktop + deviceCounts.tablet;
  const profileDevPcts =
    knownDevTotal > 0
      ? {
          mobile: Math.round((deviceCounts.mobile / knownDevTotal) * 100),
          desktop: Math.round((deviceCounts.desktop / knownDevTotal) * 100),
          tablet: Math.max(
            0,
            100 -
              Math.round((deviceCounts.mobile / knownDevTotal) * 100) -
              Math.round((deviceCounts.desktop / knownDevTotal) * 100)
          ),
        }
      : { mobile: 0, desktop: 0, tablet: 0 };

  const uniqueWishlistCustomersSet = new Set<string>();
  let wishlistPipelineValue = 0;
  for (const w of periodWishlists) {
    const key = (w.customerId || w.customerEmail || w.customerPhone || w.id).trim().toLowerCase();
    uniqueWishlistCustomersSet.add(key);
    wishlistPipelineValue += Math.max(0, Number(w.productPrice) || 0);
  }

  const totalCustomersInPeriod = periodProfiles.length;
  const returningPct =
    totalCustomersInPeriod > 0
      ? Math.round((returningInPeriod.length / totalCustomersInPeriod) * 100)
      : 0;
  const newPct = totalCustomersInPeriod > 0 ? 100 - returningPct : 0;

  const customersSummary: UnifiedCustomerSummary = {
    totalRegisteredCustomers: reconciledProfiles.length,
    registeredInPeriod: registeredInPeriod.length,
    newCustomers: newInPeriod.length,
    returningCustomers: returningInPeriod.length,
    activeCustomers: periodProfiles.length,
    returningPercentage: returningPct,
    newPercentage: newPct,
    totalSessions,
    totalActiveTimeSeconds,
    avgSessionDurationSeconds:
      totalSessions > 0 ? Math.round(totalActiveTimeSeconds / totalSessions) : 0,
    totalProductViews,
    totalCartAdds,
    totalSearches,
    totalWishlistSaves: periodWishlists.length,
    uniqueWishlistCustomers: uniqueWishlistCustomersSet.size,
    wishlistPipelineValue: Math.round(wishlistPipelineValue),
    deviceCounts,
    devicePercentages: profileDevPcts,
  };

  // 5. Reviews & Engagement Summary
  const reviewCount = periodReviews.length;
  const reviewRatingSum = periodReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const positiveReviews = periodReviews.filter((r) => (r.rating || 0) >= 4).length;
  const verifiedBuyerReviews = periodReviews.filter((r) => Boolean(r.verifiedPurchase)).length;

  const engagement: UnifiedEngagementSummary = {
    totalReviews: reviewCount,
    averageRating: reviewCount > 0 ? Number((reviewRatingSum / reviewCount).toFixed(1)) : 0,
    positiveReviewPercentage:
      reviewCount > 0 ? Math.round((positiveReviews / reviewCount) * 100) : 0,
    verifiedBuyerReviews,
  };

  // 6. Traffic Summary
  const traffic = computePeriodTrafficSummary(input.trafficData, bounds);

  return {
    bounds,
    orders: orderSummary,
    filteredOrders,
    activeOrders,
    products: unifiedProducts,
    bestSellingProducts,
    mostReviewedProducts,
    mostWishlistedProducts,
    customers: customersSummary,
    reconciledProfiles,
    periodProfiles,
    traffic,
    engagement,
  };
}
