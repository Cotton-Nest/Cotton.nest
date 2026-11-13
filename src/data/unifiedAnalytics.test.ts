/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOrderAnalytics,
  computeUnifiedAnalyticsSnapshot,
  deduplicateOrders,
  getISTDayBoundsMs,
  getReportingPeriodBounds,
  isTestOrder,
  isTimestampInBounds,
  toISTDateKey,
} from './unifiedAnalytics';
import { getEmptyTrafficData, normalizeTrafficData } from './analytics';
import { Order } from './orders';
import { BedsheetProduct } from './products';
import { ProductReview } from './reviews';
import { WishlistItem } from './wishlist';
import { CustomerActivityProfile } from './customerActivity';

const SAMPLE_PRODUCTS: BedsheetProduct[] = [
  {
    id: 'prod-rose',
    name: 'Jaipur Rose Floral King Bedsheet',
    collection: 'Jaipur Florals',
    price: 2000,
    originalPrice: 2800,
    dimensions: '108x108 in',
    pillowCovers: '2 Pillow Covers',
    threadCount: '350 TC',
    fabric: '100% Pure Cotton',
    pattern: 'Floral',
    colorTone: 'Blush Pink',
    description: 'Handblock rose cotton sheet',
    image: '/images/rose.jpg',
    features: ['Pure cotton'],
    inStock: true,
    stockQuantity: 10,
  },
  {
    id: 'prod-gold',
    name: 'Marigold Heritage Cotton Sheet',
    collection: 'Heritage',
    price: 1500,
    originalPrice: 2000,
    dimensions: '108x108 in',
    pillowCovers: '2 Pillow Covers',
    threadCount: '300 TC',
    fabric: '100% Pure Cotton',
    pattern: 'Paisley',
    colorTone: 'Gold',
    description: 'Pure heritage cotton',
    image: '/images/gold.jpg',
    features: ['Pure cotton'],
    inStock: true,
    stockQuantity: 8,
  },
];

function makeOrder(overrides: Partial<Order> & { id: string }): Order {
  const { id, paymentMethod, ...rest } = overrides;
  return {
    id,
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    customerEmail: 'aarav@cottonnest.in',
    customerAddress: '12, MI Road, Jaipur, Rajasthan - 302001',
    items: [
      {
        productId: 'prod-rose',
        productName: 'Jaipur Rose Floral King Bedsheet',
        productImage: '/images/rose.jpg',
        price: 2000,
        quantity: 1,
        dimensions: '108x108 in',
      },
    ],
    totalAmount: 2000,
    totalSavings: 800,
    status: 'confirmed',
    paymentMethod: paymentMethod ?? 'upi',
    createdAt: '2026-05-10T10:00:00.000Z',
    ...rest,
  };
}

test('IST date conversion handles UTC midnight rollover accurately (UTC+05:30)', () => {
  // 2026-05-10 18:29:59.999 UTC === 2026-05-10 23:59:59.999 IST
  const beforeMidnightIST = Date.parse('2026-05-10T18:29:59.999Z');
  assert.equal(toISTDateKey(beforeMidnightIST), '2026-05-10');

  // 2026-05-10 18:30:00.000 UTC === 2026-05-11 00:00:00.000 IST
  const atMidnightIST = Date.parse('2026-05-10T18:30:00.000Z');
  assert.equal(toISTDateKey(atMidnightIST), '2026-05-11');

  const bounds = getISTDayBoundsMs('2026-05-11');
  assert.ok(bounds);
  assert.equal(bounds.startMs, atMidnightIST);
  assert.equal(bounds.endMs, Date.parse('2026-05-11T18:29:59.999Z'));

  const todayPeriod = getReportingPeriodBounds('today', undefined, undefined, atMidnightIST + 60_000);
  assert.equal(todayPeriod.startDateKey, '2026-05-11');
  assert.equal(isTimestampInBounds(beforeMidnightIST, todayPeriod), false);
  assert.equal(isTimestampInBounds(atMidnightIST, todayPeriod), true);
});

test('deduplicateOrders prevents double counting and selects newer/higher-progression record', () => {
  const stalePending = makeOrder({
    id: 'CN-1001',
    status: 'pending',
    totalAmount: 2000,
    createdAt: '2026-05-10T09:00:00.000Z',
  });
  const fresherDelivered = makeOrder({
    id: 'CN-1001',
    status: 'delivered',
    totalAmount: 2000,
    createdAt: '2026-05-10T09:00:00.000Z',
    updatedAt: Date.parse('2026-05-11T12:00:00.000Z'),
  });
  const order2 = makeOrder({
    id: 'CN-1002',
    status: 'confirmed',
    totalAmount: 1500,
    createdAt: '2026-05-10T11:00:00.000Z',
  });

  const deduped = deduplicateOrders([stalePending, order2, fresherDelivered]);
  assert.equal(deduped.length, 2);
  const resolved1001 = deduped.find((o) => o.id === 'CN-1001');
  assert.equal(resolved1001?.status, 'delivered');
});

test('isTestOrder consistently identifies test/synthetic orders and excludes them', () => {
  assert.equal(isTestOrder(makeOrder({ id: 'TEST-123' })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-TEST-999' })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-101', customerEmail: 'qa@example.com' })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-102', customerName: 'Test User' })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-103', notes: '[test] manual smoke check' })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-104', totalAmount: -10 })), true);
  assert.equal(isTestOrder(makeOrder({ id: 'CN-105' })), false);
});

test('computeOrderAnalytics separates Order Value, Actual Revenue, Pending Payments, Cancelled Value & AOV cleanly', () => {
  const orders: Order[] = [
    makeOrder({ id: 'CN-1', status: 'pending', totalAmount: 1000 }),
    makeOrder({ id: 'CN-1', status: 'pending', totalAmount: 1000 }), // Duplicate ID must be ignored
    makeOrder({ id: 'CN-2', status: 'confirmed', totalAmount: 2000 }),
    makeOrder({ id: 'CN-3', status: 'dispatched', totalAmount: 3000 }),
    makeOrder({
      id: 'CN-4',
      status: 'delivered',
      totalAmount: 4000,
      items: [
        {
          productId: 'prod-gold',
          productName: 'Marigold Heritage Cotton Sheet',
          productImage: '/images/gold.jpg',
          price: 1500,
          quantity: 2,
          dimensions: '108x108 in',
        },
      ],
    }),
    makeOrder({ id: 'CN-5', status: 'cancelled', totalAmount: 5000 }),
    makeOrder({ id: 'CN-TEST-1', status: 'delivered', totalAmount: 99999 }), // Excluded test order
  ];

  const { summary } = computeOrderAnalytics(orders, { period: 'all', includeTestOrders: false });

  assert.equal(summary.excludedTestOrders, 1);
  assert.equal(summary.totalOrders, 5); // 4 active + 1 cancelled
  assert.equal(summary.activeOrders, 4);
  assert.equal(summary.pendingOrders, 1);
  assert.equal(summary.confirmedOrders, 1);
  assert.equal(summary.dispatchedOrders, 1);
  assert.equal(summary.deliveredOrders, 1);
  assert.equal(summary.cancelledOrders, 1);
  assert.equal(summary.totalUnitsSold, 5); // 1 + 1 + 1 + 2 (cancelled & test excluded)

  assert.equal(summary.grossOrderValue, 10000); // 1000 + 2000 + 3000 + 4000
  assert.equal(summary.actualRevenue, 9000); // 2000 + 3000 + 4000
  assert.equal(summary.deliveredRevenue, 4000);
  assert.equal(summary.inProgressConfirmedRevenue, 5000);
  assert.equal(summary.pendingPaymentValue, 1000);
  assert.equal(summary.cancelledOrderValue, 5000);
  assert.equal(summary.averageOrderValue, 2500); // 10000 / 4
  assert.equal(summary.confirmedAverageOrderValue, 3000); // 9000 / 3
});

test('getEmptyTrafficData & normalizeTrafficData never fabricate baseline traffic numbers', () => {
  const empty = getEmptyTrafficData();
  assert.equal(empty.totalVisits, 0);
  assert.equal(empty.uniqueVisitors, 0);
  assert.equal(empty.todayVisits, 0);
  assert.deepEqual(empty.pageViewsByDate, {});
  assert.deepEqual(empty.deviceBreakdown, { mobile: 0, desktop: 0, tablet: 0 });

  const normalized = normalizeTrafficData({});
  assert.equal(normalized.totalVisits, 0);
  assert.equal(normalized.uniqueVisitors, 0);
  assert.equal(normalized.todayVisits, 0);
});

test('computeUnifiedAnalyticsSnapshot produces identical metrics with zero synthetic fallbacks', () => {
  const nowMs = Date.parse('2026-05-12T10:00:00.000Z'); // 15:30 IST on 2026-05-12

  const orders: Order[] = [
    makeOrder({
      id: 'CN-TODAY',
      userId: 'uid_ananya',
      customerName: 'Ananya Verma',
      customerEmail: 'ananya@example.org',
      customerPhone: '9876500001',
      status: 'delivered',
      totalAmount: 2000,
      createdAt: '2026-05-12T06:00:00.000Z', // 11:30 IST today
    }),
    makeOrder({
      id: 'CN-OLD',
      userId: 'uid_rohan',
      customerName: 'Rohan Mehta',
      customerEmail: 'rohan@example.org',
      customerPhone: '9123456780',
      status: 'pending',
      totalAmount: 1500,
      createdAt: '2026-04-01T06:00:00.000Z', // 41 days ago
      items: [
        {
          productId: 'prod-gold',
          productName: 'Marigold Heritage Cotton Sheet',
          productImage: '/images/gold.jpg',
          price: 1500,
          quantity: 1,
          dimensions: '108x108 in',
        },
      ],
    }),
  ];

  const reviews: ProductReview[] = [
    {
      id: 'rev-1',
      productId: 'prod-rose',
      productName: 'Jaipur Rose Floral King Bedsheet',
      customerName: 'Ananya Verma',
      customerCity: 'Jaipur',
      rating: 5,
      title: 'Soft pure cotton',
      comment: 'Very breathable',
      verifiedPurchase: true,
      recommended: true,
      createdAt: Date.parse('2026-05-12T07:00:00.000Z'),
      helpfulCount: 2,
    },
  ];

  const wishlists: WishlistItem[] = [
    {
      id: 'w-1',
      customerId: 'uid_ananya',
      customerName: 'Ananya Verma',
      customerEmail: 'ananya@example.org',
      productId: 'prod-gold',
      productName: 'Marigold Heritage Cotton Sheet',
      productPrice: 1500,
      productOriginalPrice: 2000,
      productImage: '/images/gold.jpg',
      createdAt: Date.parse('2026-05-12T05:00:00.000Z'),
    },
  ];

  const profiles: CustomerActivityProfile[] = [
    {
      uid: 'uid_ananya',
      customerName: 'Ananya Verma',
      email: 'ananya@example.org',
      accountCreatedAt: Date.parse('2026-05-12T04:00:00.000Z'),
      lastLoginAt: Date.parse('2026-05-12T04:30:00.000Z'),
      lastActiveAt: Date.parse('2026-05-12T07:30:00.000Z'),
      totalSessions: 2,
      totalTimeSpentSeconds: 300,
      averageSessionDurationSeconds: 150,
      totalPagesVisited: 4,
      pageVisitCounts: { home: 2, catalogue: 2 },
      mostVisitedPage: 'Bedsheet Catalogue',
      totalProductViews: 3,
      productsViewed: [
        {
          productId: 'prod-rose',
          productName: 'Jaipur Rose Floral King Bedsheet',
          productImage: '/images/rose.jpg',
          productPrice: 2000,
          viewCount: 3,
          firstViewedAt: Date.parse('2026-05-12T04:35:00.000Z'),
          lastViewedAt: Date.parse('2026-05-12T05:00:00.000Z'),
        },
      ],
      totalAddedToCartCount: 1,
      cartActivity: [],
      totalAddedToWishlistCount: 1,
      currentWishlist: [],
      historicalWishlist: [],
      totalSearches: 1,
      searchHistory: [],
      ordersPlacedCount: 1,
      totalPurchaseValue: 2000,
      deviceInfo: {
        deviceType: 'Mobile',
        os: 'Android',
        browser: 'Chrome',
        screenResolution: '390x844',
        deviceCategory: 'Android Smartphone',
        approximateLocation: 'India (IST Region)',
        language: 'en-IN',
      },
      sessions: [],
      timeline: [],
      updatedAt: Date.parse('2026-05-12T07:30:00.000Z'),
    },
  ];

  const allTimeSnapshot = computeUnifiedAnalyticsSnapshot({
    products: SAMPLE_PRODUCTS,
    orders,
    reviews,
    wishlists,
    customerProfiles: profiles,
    trafficData: getEmptyTrafficData(),
    filter: { period: 'all', nowMs },
  });

  assert.equal(allTimeSnapshot.orders.activeOrders, 2);
  assert.equal(allTimeSnapshot.orders.grossOrderValue, 3500);
  assert.equal(allTimeSnapshot.orders.actualRevenue, 2000);
  assert.equal(allTimeSnapshot.orders.pendingPaymentValue, 1500);
  assert.equal(allTimeSnapshot.customers.totalRegisteredCustomers, 2); // Ananya + reconciled Rohan
  assert.equal(allTimeSnapshot.customers.returningCustomers, 1);
  assert.equal(allTimeSnapshot.customers.newCustomers, 1);
  assert.equal(allTimeSnapshot.customers.totalWishlistSaves, 1);
  assert.equal(allTimeSnapshot.engagement.averageRating, 5);

  const roseMetric = allTimeSnapshot.products.find((p) => p.productId === 'prod-rose')!;
  const goldMetric = allTimeSnapshot.products.find((p) => p.productId === 'prod-gold')!;
  assert.equal(roseMetric.unitsSold, 1);
  assert.equal(roseMetric.actualSalesRevenue, 2000);
  assert.equal(goldMetric.wishlistCount, 1);
  assert.equal(goldMetric.averageRating, 0); // Zero reviews => 0 (no fake 5.0 fallback)

  // Today (IST) filter matches identically across dashboards
  const todaySnapshot = computeUnifiedAnalyticsSnapshot({
    products: SAMPLE_PRODUCTS,
    orders,
    reviews,
    wishlists,
    customerProfiles: profiles,
    trafficData: getEmptyTrafficData(),
    filter: { period: 'today', nowMs },
  });

  assert.equal(todaySnapshot.orders.activeOrders, 1);
  assert.equal(todaySnapshot.orders.actualRevenue, 2000);
  assert.equal(todaySnapshot.orders.pendingPaymentValue, 0);
  assert.equal(todaySnapshot.customers.activeCustomers, 1); // Only Ananya active today
  assert.equal(todaySnapshot.customers.totalRegisteredCustomers, 2);
});
