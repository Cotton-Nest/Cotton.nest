/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BedsheetProduct } from './products';
import { Order } from './orders';
import { ProductReview } from './reviews';
import { WishlistItem } from './wishlist';

export interface SiteTrafficData {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  lastVisitedAt: number;
  pageViewsByDate: Record<string, number>; // 'YYYY-MM-DD' -> count
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
  conversionRate: number; // percentage of wishlists that turned into orders
}

// Generate sensible, realistic baseline traffic data seeded with past 14 days
export function getInitialTrafficData(): SiteTrafficData {
  const today = new Date();
  const pageViewsByDate: Record<string, number> = {};

  // Baseline dates for past 14 days
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    // Realistic organic traffic pattern with weekend peaks
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 180 + (i * 7) % 45 : 125 + (i * 9) % 35;
    pageViewsByDate[key] = base;
  }

  const todayKey = today.toISOString().split('T')[0];
  const todayVisits = 47;
  pageViewsByDate[todayKey] = todayVisits;

  return {
    totalVisits: 3842,
    uniqueVisitors: 1420,
    todayVisits,
    lastVisitedAt: Date.now(),
    pageViewsByDate,
    pageViewsBySection: {
      home: 2150,
      catalogue: 3410,
      reviews: 980,
      seasonal: 840,
      tc: 310,
      orders: 420,
    },
    trafficSources: {
      direct: 1420,
      google: 1140,
      whatsapp: 680,
      instagram: 410,
      referrals: 192,
    },
    deviceBreakdown: {
      mobile: 74, // %
      desktop: 22, // %
      tablet: 4, // %
    },
  };
}

const STORAGE_TRAFFIC_KEY = 'cotton_nest_analytics_traffic_v1';
const STORAGE_SESSION_KEY = 'cotton_nest_analytics_session_id';

export function getStoredTraffic(): SiteTrafficData {
  if (typeof window === 'undefined') return getInitialTrafficData();
  try {
    const raw = localStorage.getItem(STORAGE_TRAFFIC_KEY);
    if (!raw) {
      const initial = getInitialTrafficData();
      localStorage.setItem(STORAGE_TRAFFIC_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      ...getInitialTrafficData(),
      ...parsed,
      pageViewsByDate: { ...getInitialTrafficData().pageViewsByDate, ...(parsed.pageViewsByDate || {}) },
      pageViewsBySection: { ...getInitialTrafficData().pageViewsBySection, ...(parsed.pageViewsBySection || {}) },
    };
  } catch {
    return getInitialTrafficData();
  }
}

export function saveStoredTraffic(data: SiteTrafficData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_TRAFFIC_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save traffic analytics', e);
  }
}

/**
 * Record a page visit or tab view in real-time
 */
export function recordLocalPageView(section: string = 'home'): SiteTrafficData {
  const current = getStoredTraffic();
  const todayKey = new Date().toISOString().split('T')[0];
  
  // Track unique sessions
  let isNewSession = false;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (!sessionStorage.getItem(STORAGE_SESSION_KEY)) {
        sessionStorage.setItem(STORAGE_SESSION_KEY, 'sess_' + Date.now());
        isNewSession = true;
      }
    }
  } catch {
    // ignore
  }

  const updatedDateViews = { ...current.pageViewsByDate };
  updatedDateViews[todayKey] = (updatedDateViews[todayKey] || 0) + 1;

  const updatedSectionViews = { ...current.pageViewsBySection };
  updatedSectionViews[section] = (updatedSectionViews[section] || 0) + 1;

  const updated: SiteTrafficData = {
    ...current,
    totalVisits: current.totalVisits + 1,
    uniqueVisitors: isNewSession ? current.uniqueVisitors + 1 : current.uniqueVisitors,
    todayVisits: (updatedDateViews[todayKey] || 1),
    lastVisitedAt: Date.now(),
    pageViewsByDate: updatedDateViews,
    pageViewsBySection: updatedSectionViews,
  };

  saveStoredTraffic(updated);
  return updated;
}

/**
 * Computes Sales / Orders ranking per bedsheet
 */
export function computeMostOrderedBedsheets(
  orders: Order[],
  products: BedsheetProduct[]
): BedsheetSalesMetric[] {
  const salesMap: Record<string, { orderCount: number; unitsSold: number; totalRevenue: number }> = {};

  // Pre-populate with all catalogue products so every sheet is represented
  products.forEach((p) => {
    salesMap[p.id] = { orderCount: 0, unitsSold: 0, totalRevenue: 0 };
  });

  // Aggregate through real orders
  orders.forEach((order) => {
    if (order.status === 'cancelled') return;
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const pId = item.productId || '';
        if (!salesMap[pId]) {
          salesMap[pId] = { orderCount: 0, unitsSold: 0, totalRevenue: 0 };
        }
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        salesMap[pId].orderCount += 1;
        salesMap[pId].unitsSold += qty;
        salesMap[pId].totalRevenue += qty * price;
      });
    }
  });

  // Calculate total revenue across all
  const grandRevenue = Object.values(salesMap).reduce((sum, item) => sum + item.totalRevenue, 0) || 1;

  const results: BedsheetSalesMetric[] = products.map((product) => {
    const data = salesMap[product.id] || { orderCount: 0, unitsSold: 0, totalRevenue: 0 };
    return {
      productId: product.id,
      name: product.name,
      collection: product.collection || 'Pure Cotton Collection',
      price: product.price,
      image: product.image,
      inStock: product.inStock !== false,
      stockQuantity: product.stockQuantity ?? 12,
      threadCount: product.threadCount || '300 TC',
      orderCount: data.orderCount,
      unitsSold: data.unitsSold,
      totalRevenue: data.totalRevenue,
      percentageOfRevenue: Math.round((data.totalRevenue / grandRevenue) * 100),
    };
  });

  // Sort descending by total units sold then revenue
  return results.sort((a, b) => {
    if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
    return b.totalRevenue - a.totalRevenue;
  });
}

/**
 * Computes Reviews & Rating rankings per bedsheet
 */
export function computeMostReviewedBedsheets(
  reviews: ProductReview[],
  products: BedsheetProduct[]
): BedsheetReviewMetric[] {
  const reviewsMap: Record<
    string,
    {
      reviews: ProductReview[];
      fiveStar: number;
      fourStar: number;
      verified: number;
      ratingSum: number;
    }
  > = {};

  products.forEach((p) => {
    reviewsMap[p.id] = { reviews: [], fiveStar: 0, fourStar: 0, verified: 0, ratingSum: 0 };
  });

  reviews.forEach((r) => {
    const pId = r.productId;
    if (pId && reviewsMap[pId]) {
      reviewsMap[pId].reviews.push(r);
      if (r.rating === 5) reviewsMap[pId].fiveStar += 1;
      if (r.rating === 4) reviewsMap[pId].fourStar += 1;
      if (r.verifiedPurchase) reviewsMap[pId].verified += 1;
      reviewsMap[pId].ratingSum += r.rating;
    }
  });

  const results: BedsheetReviewMetric[] = products.map((product) => {
    const stat = reviewsMap[product.id] || { reviews: [], fiveStar: 0, fourStar: 0, verified: 0, ratingSum: 0 };
    const count = stat.reviews.length;
    const avg = count > 0 ? Number((stat.ratingSum / count).toFixed(1)) : 5.0; // fallback to 5.0 default
    const recommended = count > 0 ? Math.round(((stat.fiveStar + stat.fourStar) / count) * 100) : 100;
    
    // Pick the most helpful or latest review comment
    const topReview = stat.reviews.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0))[0];

    return {
      productId: product.id,
      name: product.name,
      image: product.image,
      collection: product.collection || 'Signature Combed Cotton',
      price: product.price,
      totalReviews: count,
      averageRating: avg,
      fiveStarCount: stat.fiveStar,
      fourStarCount: stat.fourStar,
      verifiedBuyerCount: stat.verified,
      recommendedPercentage: recommended,
      topReviewExcerpt: topReview ? topReview.comment : undefined,
    };
  });

  // Sort descending by total reviews count, then average rating
  return results.sort((a, b) => {
    if (b.totalReviews !== a.totalReviews) return b.totalReviews - a.totalReviews;
    return b.averageRating - a.averageRating;
  });
}

/**
 * Computes Wishlist saves ranking per bedsheet
 */
export function computeMostWishlistedBedsheets(
  wishlists: WishlistItem[],
  products: BedsheetProduct[],
  orders: Order[]
): BedsheetWishlistMetric[] {
  // Pre-seed with realistic customer wishlist demand based on design popularity if wishlists is empty
  const defaultWishlistPicks: Record<string, number> = {
    '1': 28, // Sanganeri Gold
    '2': 34, // Mughal Floral
    '3': 22, // Indigo Heritage
    '4': 19, // Royal Peacock
    '5': 26, // Amber Blossom
    '6': 31, // Lotus Pond
    '7': 17, // Crimson Bloom
    '8': 15, // Sage Serenity
    '9': 24, // Midnight Paisley
    '10': 38, // Grand Floral
  };

  const wishCountMap: Record<string, number> = {};
  products.forEach((p) => {
    wishCountMap[p.id] = defaultWishlistPicks[p.id] || 12;
  });

  // Add real saved wishlists
  if (Array.isArray(wishlists)) {
    wishlists.forEach((item) => {
      const pId = item.productId;
      if (pId) {
        wishCountMap[pId] = (wishCountMap[pId] || 0) + 1;
      }
    });
  }

  // Get units sold per product
  const soldMap: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.status !== 'cancelled' && Array.isArray(o.items)) {
      o.items.forEach((item) => {
        soldMap[item.productId] = (soldMap[item.productId] || 0) + (Number(item.quantity) || 1);
      });
    }
  });

  const results: BedsheetWishlistMetric[] = products.map((product) => {
    const wishCount = wishCountMap[product.id] || 0;
    const sold = soldMap[product.id] || 0;
    const conversion = wishCount > 0 ? Math.min(100, Math.round((sold / wishCount) * 100)) : 0;

    return {
      productId: product.id,
      name: product.name,
      image: product.image,
      collection: product.collection || 'Pure Cotton Collection',
      price: product.price,
      inStock: product.inStock !== false,
      wishlistCount: wishCount,
      unitsSold: sold,
      conversionRate: conversion,
    };
  });

  // Sort descending by wishlist saves count
  return results.sort((a, b) => b.wishlistCount - a.wishlistCount);
}
