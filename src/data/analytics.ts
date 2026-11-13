/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BedsheetProduct } from './products';
import { Order } from './orders';
import { ProductReview } from './reviews';
import { WishlistItem } from './wishlist';
import {
  computeUnifiedAnalyticsSnapshot,
  getISTTodayKey,
} from './unifiedAnalytics';

export interface SiteTrafficData {
  id?: string;
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  lastVisitedAt: number;
  pageViewsByDate: Record<string, number>; // 'YYYY-MM-DD' in IST -> count
  pageViewsBySection: Record<string, number>; // 'home' | 'catalogue' | 'reviews' | etc.
  trafficSources: {
    direct: number;
    google: number;
    whatsapp: number;
    instagram: number;
    referrals: number;
  };
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
}

export interface BedsheetSalesMetric {
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
  totalRevenue: number;
  actualRevenue?: number;
  percentageOfRevenue: number;
}

export interface BedsheetReviewMetric {
  productId: string;
  name: string;
  image: string;
  collection: string;
  price: number;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  verifiedBuyerCount: number;
  recommendedPercentage: number;
  topReviewExcerpt?: string;
}

export interface BedsheetWishlistMetric {
  productId: string;
  name: string;
  image: string;
  collection: string;
  price: number;
  inStock: boolean;
  wishlistCount: number;
  unitsSold: number;
  conversionRate: number;
}

/**
 * Clean empty baseline for real-time Firestore analytics (no hardcoded/fake seed numbers).
 */
export function getEmptyTrafficData(): SiteTrafficData {
  return {
    id: 'site_traffic',
    totalVisits: 0,
    uniqueVisitors: 0,
    todayVisits: 0,
    lastVisitedAt: 0,
    pageViewsByDate: {},
    pageViewsBySection: {},
    trafficSources: {
      direct: 0,
      google: 0,
      whatsapp: 0,
      instagram: 0,
      referrals: 0,
    },
    deviceBreakdown: {
      mobile: 0,
      desktop: 0,
      tablet: 0,
    },
  };
}

export function getInitialTrafficData(): SiteTrafficData {
  return getEmptyTrafficData();
}

export function normalizeTrafficData(raw?: Partial<SiteTrafficData> | null): SiteTrafficData {
  const empty = getEmptyTrafficData();
  if (!raw || typeof raw !== 'object') return empty;
  const pageViewsByDate: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.pageViewsByDate || {})) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n >= 0) {
      pageViewsByDate[k] = n;
    }
  }
  const pageViewsBySection: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.pageViewsBySection || {})) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n >= 0) {
      pageViewsBySection[k] = n;
    }
  }
  const todayKey = getISTTodayKey();
  const todayVisits = Math.max(0, Number(pageViewsByDate[todayKey]) || 0);

  return {
    id: 'site_traffic',
    totalVisits: Math.max(0, Number(raw.totalVisits) || 0),
    uniqueVisitors: Math.max(0, Number(raw.uniqueVisitors) || 0),
    todayVisits,
    lastVisitedAt: Math.max(0, Number(raw.lastVisitedAt) || 0),
    pageViewsByDate,
    pageViewsBySection,
    trafficSources: {
      direct: Math.max(0, Number(raw.trafficSources?.direct) || 0),
      google: Math.max(0, Number(raw.trafficSources?.google) || 0),
      whatsapp: Math.max(0, Number(raw.trafficSources?.whatsapp) || 0),
      instagram: Math.max(0, Number(raw.trafficSources?.instagram) || 0),
      referrals: Math.max(0, Number(raw.trafficSources?.referrals) || 0),
    },
    deviceBreakdown: {
      mobile: Math.max(0, Number(raw.deviceBreakdown?.mobile) || 0),
      desktop: Math.max(0, Number(raw.deviceBreakdown?.desktop) || 0),
      tablet: Math.max(0, Number(raw.deviceBreakdown?.tablet) || 0),
    },
  };
}

export function getStoredTraffic(): SiteTrafficData {
  return getEmptyTrafficData();
}

export function saveStoredTraffic(_data: SiteTrafficData): void {
  // Traffic is synchronized through Firestore `/analytics/site_traffic`; no stale local cache overrides.
}

export function recordLocalPageView(_section: string = 'home'): SiteTrafficData {
  return getEmptyTrafficData();
}

/**
 * Computes Sales / Orders ranking per bedsheet via the unified analytics engine.
 */
export function computeMostOrderedBedsheets(
  orders: Order[],
  products: BedsheetProduct[]
): BedsheetSalesMetric[] {
  const snap = computeUnifiedAnalyticsSnapshot({
    products,
    orders,
    reviews: [],
    wishlists: [],
    customerProfiles: [],
  });
  return snap.bestSellingProducts.map((p) => ({
    productId: p.productId,
    name: p.name,
    collection: p.collection,
    price: p.price,
    image: p.image,
    inStock: p.inStock,
    stockQuantity: p.stockQuantity,
    threadCount: p.threadCount,
    orderCount: p.orderCount,
    unitsSold: p.unitsSold,
    totalRevenue: p.grossSalesRevenue,
    actualRevenue: p.actualSalesRevenue,
    percentageOfRevenue: p.percentageOfRevenue,
  }));
}

/**
 * Computes Reviews & Rating rankings per bedsheet via the unified analytics engine.
 */
export function computeMostReviewedBedsheets(
  reviews: ProductReview[],
  products: BedsheetProduct[]
): BedsheetReviewMetric[] {
  const snap = computeUnifiedAnalyticsSnapshot({
    products,
    orders: [],
    reviews,
    wishlists: [],
    customerProfiles: [],
  });
  return snap.mostReviewedProducts.map((p) => ({
    productId: p.productId,
    name: p.name,
    image: p.image,
    collection: p.collection,
    price: p.price,
    totalReviews: p.totalReviews,
    averageRating: p.averageRating,
    fiveStarCount: p.fiveStarCount,
    fourStarCount: p.fourStarCount,
    verifiedBuyerCount: p.verifiedBuyerCount,
    recommendedPercentage: p.recommendedPercentage,
    topReviewExcerpt: p.topReviewExcerpt,
  }));
}

/**
 * Computes Wishlist saves ranking per bedsheet via the unified analytics engine (real saves only).
 */
export function computeMostWishlistedBedsheets(
  wishlists: WishlistItem[],
  products: BedsheetProduct[],
  orders: Order[]
): BedsheetWishlistMetric[] {
  const snap = computeUnifiedAnalyticsSnapshot({
    products,
    orders,
    reviews: [],
    wishlists,
    customerProfiles: [],
  });
  return snap.mostWishlistedProducts.map((p) => ({
    productId: p.productId,
    name: p.name,
    image: p.image,
    collection: p.collection,
    price: p.price,
    inStock: p.inStock,
    wishlistCount: p.wishlistCount,
    unitsSold: p.unitsSold,
    conversionRate: p.wishlistConversionRate,
  }));
}
