/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Globe,
  Heart,
  Monitor,
  Package,
  Printer,
  RefreshCw,
  Share2,
  ShoppingBag,
  Smartphone,
  Star,
  Tablet,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { ProductReview } from '../data/reviews';
import { WishlistItem } from '../data/wishlist';
import { SiteTrafficData } from '../data/analytics';
import { formatDurationHuman } from '../data/customerActivity';
import {
  ReportingPeriod,
  computeUnifiedAnalyticsSnapshot,
  formatLastUpdatedIST,
} from '../data/unifiedAnalytics';
import { useSyncedAnalyticsData } from '../services/analyticsSync';
import { resolveBedsheetImage } from '../utils/imageUrl';

interface AnalyticsViewProps {
  products: BedsheetProduct[];
  orders: Order[];
  reviews: ProductReview[];
  wishlistItems: WishlistItem[];
  trafficData: SiteTrafficData;
  onSelectProduct?: (product: BedsheetProduct) => void;
  onGoToCatalogue?: () => void;
  onGoToReviews?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  products: fallbackProducts,
  orders: fallbackOrders,
  reviews: fallbackReviews,
  onSelectProduct,
  onGoToCatalogue,
  onGoToReviews,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'reviews' | 'wishlist' | 'matrix'>('overview');
  const [timeframe, setTimeframe] = useState<ReportingPeriod>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Single source of truth: real-time Firestore subscription across all 6 analytics collections
  const synced = useSyncedAnalyticsData({
    enabled: true,
    fallbackProducts,
    fallbackOrders,
    fallbackReviews,
  });

  const snapshot = useMemo(() => {
    return computeUnifiedAnalyticsSnapshot({
      products: synced.products,
      orders: synced.orders,
      reviews: synced.reviews,
      wishlists: synced.wishlists,
      customerProfiles: synced.customerProfiles,
      trafficData: synced.trafficData,
      filter: {
        period: timeframe,
        customStart: customStartDate,
        customEnd: customEndDate,
        includeTestOrders: false,
      },
    });
  }, [
    synced.products,
    synced.orders,
    synced.reviews,
    synced.wishlists,
    synced.customerProfiles,
    synced.trafficData,
    timeframe,
    customStartDate,
    customEndDate,
  ]);

  const {
    orders: orderMetrics,
    bestSellingProducts,
    mostReviewedProducts,
    mostWishlistedProducts,
    customers,
    traffic,
    engagement,
  } = snapshot;

  const topOrdered = bestSellingProducts[0] && bestSellingProducts[0].unitsSold > 0 ? bestSellingProducts[0] : null;
  const topReviewed = mostReviewedProducts[0] && mostReviewedProducts[0].totalReviews > 0 ? mostReviewedProducts[0] : null;
  const topWishlisted = mostWishlistedProducts[0] && mostWishlistedProducts[0].wishlistCount > 0 ? mostWishlistedProducts[0] : null;

  // Device breakdown combines Firestore customer activity + traffic session counts cleanly
  const trafficDeviceTotal =
    traffic.deviceCounts.mobile + traffic.deviceCounts.desktop + traffic.deviceCounts.tablet;
  const devicePercentages =
    trafficDeviceTotal > 0 ? traffic.devicePercentages : customers.devicePercentages;

  const filteredSales = bestSellingProducts.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredReviews = mostReviewedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredWishlists = mostWishlistedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="min-h-screen py-8 sm:py-12 transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {/* Top Header Banner */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#EAE2D5] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#FDEAF0]/40 to-[#F4EFE6]/60 rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDEAF0] text-[#70252D] text-xs font-bold tracking-wider uppercase border border-[#FAD1DC]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      synced.syncError
                        ? 'bg-amber-500'
                        : synced.isLoading || synced.isRefreshing
                        ? 'bg-blue-500 animate-ping'
                        : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span>
                    {synced.isLoading
                      ? 'Syncing Live Firebase Data...'
                      : 'Unified Firebase Analytics · Web & Mobile'}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F2] text-[#6B5D55] text-[11px] font-medium border border-[#EAE2D5] tabular-nums">
                  <Clock className="w-3 h-3 text-[#C29E57]" />
                  Last updated: {formatLastUpdatedIST(synced.lastUpdatedAt)}
                </span>
              </div>

              <h1 className="font-serif-luxury text-2xl sm:text-4xl lg:text-5xl font-bold text-[#2C2420] tracking-tight">
                Store Performance &amp; Customer Insights
              </h1>
              <p className="text-xs sm:text-base text-[#6B5D55] mt-1.5 max-w-2xl leading-relaxed">
                Real-time Firestore analytics across website and mobile app: orders, actual vs pending revenue, registered &amp; active customers, bestsellers, reviews, and wishlist demand (IST).
              </p>
            </div>

            {/* Quick Actions & Refresh */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={synced.refresh}
                disabled={synced.isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#FAF7F2] text-[#2C2420] rounded-xl text-xs font-bold border border-[#DEC89B] transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                title="Fetch latest analytics directly from Firestore server"
              >
                <RefreshCw className={`w-4 h-4 text-[#8C2E46] ${synced.isRefreshing ? 'animate-spin' : ''}`} />
                <span>{synced.isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] rounded-xl text-xs font-semibold border border-[#DEC89B] transition-colors cursor-pointer shadow-2xs"
                title="Print or Save Report as PDF"
              >
                <Printer className="w-4 h-4 text-[#70252D]" />
                <span>Export Report</span>
              </button>

              {onGoToCatalogue && (
                <button
                  type="button"
                  onClick={onGoToCatalogue}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#70252D] hover:bg-[#8C2E46] text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs hover:shadow-md"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>View Catalogue</span>
                </button>
              )}
            </div>
          </div>

          {/* Firebase Sync Error / Loading Banner */}
          {synced.syncError && (
            <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Partial Firebase Sync Warning — Figures Below May Be Incomplete</p>
                  <p className="text-amber-900 mt-0.5">{synced.syncError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={synced.refresh}
                className="px-3 py-1.5 rounded-xl bg-amber-900 text-white text-xs font-bold shrink-0 cursor-pointer hover:bg-amber-800"
              >
                Retry Sync
              </button>
            </div>
          )}

          {/* IST Reporting Period Filter Bar (Mobile & Desktop) */}
          <div className="mt-6 pt-5 border-t border-[#EAE2D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#6B5D55]">
              <Calendar className="w-4 h-4 text-[#8C2E46]" />
              <span className="font-semibold text-[#2C2420]">Reporting Period (IST):</span>
              <span>{snapshot.bounds.label}</span>
              {orderMetrics.excludedTestOrders > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#EAE2D5] text-[10px]">
                  {orderMetrics.excludedTestOrders} test order(s) excluded
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF7F2] p-1 rounded-xl border border-[#EAE2D5] text-xs">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: '7 Days' },
                  { id: '30d', label: '30 Days' },
                  { id: 'all', label: 'All Time' },
                  { id: 'custom', label: 'Custom' },
                ] as Array<{ id: ReportingPeriod; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeframe(opt.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    timeframe === opt.id
                      ? 'bg-[#70252D] text-white shadow-2xs'
                      : 'text-[#6B5D55] hover:text-[#2C2420]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {timeframe === 'custom' && (
            <div className="mt-3 flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs">
              <span className="font-bold text-[#5C4A3E]">Custom IST Range:</span>
              <label className="flex items-center gap-1.5">
                <span className="text-[#7A6A5E]">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-[#7A6A5E]">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420]"
                />
              </label>
            </div>
          )}

          {/* Key KPI Highlights Bar */}
          {synced.isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#EAE2D5]">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] animate-pulse space-y-2">
                  <div className="h-3 w-24 bg-[#EAE2D5] rounded" />
                  <div className="h-7 w-32 bg-[#EAE2D5] rounded" />
                  <div className="h-3 w-28 bg-[#EAE2D5] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#EAE2D5]">
                {/* KPI 1: Website & App Traffic */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between text-[#7A6458] mb-1">
                    <span className="text-xs font-medium">Website &amp; App Visits</span>
                    <Eye className="w-4 h-4 text-[#C29E57]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#2C2420] tabular-nums">
                    {traffic.totalVisits.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-[#6B5D55] font-medium mt-1 tabular-nums">
                    <span className="text-emerald-700 font-semibold">{traffic.todayVisits} visits today</span> ·{' '}
                    {traffic.uniqueVisitors.toLocaleString('en-IN')} unique sessions
                  </div>
                </div>

                {/* KPI 2: Total Orders & AOV */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between text-[#7A6458] mb-1">
                    <span className="text-xs font-medium">Total Orders</span>
                    <ShoppingBag className="w-4 h-4 text-[#70252D]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#70252D] tabular-nums">
                    {orderMetrics.activeOrders.toLocaleString('en-IN')}{' '}
                    <span className="text-sm font-sans font-normal text-[#6B5D55]">
                      active ({orderMetrics.totalUnitsSold} sheets)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B5D55] font-medium mt-1 tabular-nums">
                    AOV: ₹{orderMetrics.averageOrderValue.toLocaleString('en-IN')} · {orderMetrics.cancelledOrders} cancelled
                  </div>
                </div>

                {/* KPI 3: Revenue Breakdown (Actual vs Gross vs Pending) */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between text-[#7A6458] mb-1">
                    <span className="text-xs font-medium">Actual Revenue</span>
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-emerald-800 tabular-nums">
                    ₹{orderMetrics.actualRevenue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-[#6B5D55] font-medium mt-1 tabular-nums">
                    Order Value: ₹{orderMetrics.grossOrderValue.toLocaleString('en-IN')} · Pending:{' '}
                    <span className="text-amber-700 font-semibold">
                      ₹{orderMetrics.pendingPaymentValue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* KPI 4: Customers, Wishlist & Reviews */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between text-[#7A6458] mb-1">
                    <span className="text-xs font-medium">Registered Customers</span>
                    <Users className="w-4 h-4 text-[#8C2E46]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#2C2420] tabular-nums">
                    {customers.totalRegisteredCustomers.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-[#6B5D55] font-medium mt-1 tabular-nums">
                    {customers.activeCustomers} active · {customers.newCustomers} new · {customers.totalWishlistSaves} wishlist saves
                  </div>
                </div>
              </div>

              {/* Order Status & Customer Engagement Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                  <div className="font-bold text-base text-amber-900 tabular-nums mt-0.5">
                    {orderMetrics.pendingOrders}
                  </div>
                  <div className="text-[10px] text-amber-800 tabular-nums">
                    ₹{orderMetrics.pendingPaymentValue.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-indigo-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                  <div className="font-bold text-base text-indigo-900 tabular-nums mt-0.5">
                    {orderMetrics.confirmedOrders}
                  </div>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-blue-800 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Shipped
                  </span>
                  <div className="font-bold text-base text-blue-900 tabular-nums mt-0.5">
                    {orderMetrics.dispatchedOrders}
                  </div>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Delivered
                  </span>
                  <div className="font-bold text-base text-emerald-900 tabular-nums mt-0.5">
                    {orderMetrics.deliveredOrders}
                  </div>
                  <div className="text-[10px] text-emerald-800 tabular-nums">
                    ₹{orderMetrics.deliveredRevenue.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-rose-800 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Cancelled
                  </span>
                  <div className="font-bold text-base text-rose-900 tabular-nums mt-0.5">
                    {orderMetrics.cancelledOrders}
                  </div>
                  <div className="text-[10px] text-rose-800 tabular-nums">
                    ₹{orderMetrics.cancelledOrderValue.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#DEC89B] text-xs">
                  <span className="text-[10px] font-bold uppercase text-[#7A6458] flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Reviews
                  </span>
                  <div className="font-bold text-base text-[#2C2420] tabular-nums mt-0.5">
                    {engagement.totalReviews > 0 ? `${engagement.averageRating} ★` : '0'}
                  </div>
                  <div className="text-[10px] text-[#7A6458] tabular-nums">
                    {engagement.totalReviews} reviews ({engagement.positiveReviewPercentage}% positive)
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between gap-4 border-b border-[#EAE2D5] pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { id: 'overview', label: 'Website & Customer Overview', icon: BarChart3 },
              { id: 'orders', label: 'Best-Selling Bedsheets', icon: ShoppingBag },
              { id: 'reviews', label: 'Customer Reviews', icon: Star },
              { id: 'wishlist', label: 'Wishlist Demand', icon: Heart },
              { id: 'matrix', label: 'Full Comparison Matrix', icon: Award },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#70252D] text-white shadow-xs'
                      : 'bg-white hover:bg-[#FAF7F2] text-[#6B5D55] border border-[#EAE2D5]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#70252D]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW & WEBSITE TRAFFIC + CUSTOMER ENGAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Customer & Engagement Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-[#EAE2D5] shadow-2xs">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#7A6458]">
                  <span>Registered / New / Returning</span>
                  <UserPlus className="w-4 h-4 text-[#8C2E46]" />
                </div>
                <div className="text-xl font-bold text-[#2C2420] mt-1 tabular-nums">
                  {customers.totalRegisteredCustomers} Total
                </div>
                <div className="text-[11px] text-[#6B5D55] mt-0.5 tabular-nums">
                  {customers.newCustomers} New · {customers.returningCustomers} Returning
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#EAE2D5] shadow-2xs">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#7A6458]">
                  <span>User Sessions &amp; Active Time</span>
                  <Activity className="w-4 h-4 text-[#C29E57]" />
                </div>
                <div className="text-xl font-bold text-[#2C2420] mt-1 tabular-nums">
                  {customers.totalSessions} Sessions
                </div>
                <div className="text-[11px] text-[#6B5D55] mt-0.5 tabular-nums">
                  {formatDurationHuman(customers.totalActiveTimeSeconds)} total · avg{' '}
                  {formatDurationHuman(customers.avgSessionDurationSeconds)}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#EAE2D5] shadow-2xs">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#7A6458]">
                  <span>Product Engagement</span>
                  <Eye className="w-4 h-4 text-[#8C2E46]" />
                </div>
                <div className="text-xl font-bold text-[#2C2420] mt-1 tabular-nums">
                  {customers.totalProductViews} Views
                </div>
                <div className="text-[11px] text-[#6B5D55] mt-0.5 tabular-nums">
                  {customers.totalCartAdds} Cart Adds · {customers.totalSearches} Searches
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#EAE2D5] shadow-2xs">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#7A6458]">
                  <span>Wishlist Pipeline</span>
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                </div>
                <div className="text-xl font-bold text-[#8C2E46] mt-1 tabular-nums">
                  {customers.totalWishlistSaves} Saves
                </div>
                <div className="text-[11px] text-[#6B5D55] mt-0.5 tabular-nums">
                  {customers.uniqueWishlistCustomers} customer(s) · ₹
                  {customers.wishlistPipelineValue.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Top 3 Champions Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topOrdered && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold uppercase">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      #1 Best-Selling Sheet
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold tabular-nums">
                      {topOrdered.unitsSold} Units Sold
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <img
                      src={resolveBedsheetImage(topOrdered.image, topOrdered.productId)}
                      alt={topOrdered.name}
                      className="w-20 h-20 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] truncate">
                        {topOrdered.name}
                      </h4>
                      <p className="text-xs text-[#7A6458]">{topOrdered.threadCount} · Pure Cotton</p>
                      <div className="text-sm font-bold text-[#70252D] mt-1 tabular-nums">
                        ₹{topOrdered.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-[#6B5D55] mt-0.5 tabular-nums">
                        Order value ₹{topOrdered.grossSalesRevenue.toLocaleString('en-IN')} (Actual ₹
                        {topOrdered.actualSalesRevenue.toLocaleString('en-IN')})
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {topReviewed && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold uppercase">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      #1 Most Reviewed
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold tabular-nums">
                      {topReviewed.totalReviews} Reviews
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <img
                      src={resolveBedsheetImage(topReviewed.image, topReviewed.productId)}
                      alt={topReviewed.name}
                      className="w-20 h-20 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] truncate">
                        {topReviewed.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-bold text-[#2C2420]">{topReviewed.averageRating} ★</span>
                        <span className="text-[11px] text-[#7A6458]">
                          ({topReviewed.verifiedBuyerCount} verified)
                        </span>
                      </div>
                      {topReviewed.topReviewExcerpt && (
                        <p className="text-[11px] text-[#6B5D55] italic truncate mt-1">
                          &quot;{topReviewed.topReviewExcerpt}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {topWishlisted && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 text-xs font-bold uppercase">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      #1 Most Wishlisted
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold tabular-nums">
                      {topWishlisted.wishlistCount} Wishlists
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <img
                      src={resolveBedsheetImage(topWishlisted.image, topWishlisted.productId)}
                      alt={topWishlisted.name}
                      className="w-20 h-20 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] truncate">
                        {topWishlisted.name}
                      </h4>
                      <p className="text-xs text-[#7A6458]">{topWishlisted.collection}</p>
                      <div className="text-sm font-bold text-[#70252D] mt-1 tabular-nums">
                        ₹{topWishlisted.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 tabular-nums">
                        {topWishlisted.wishlistConversionRate}% converted to orders
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Traffic Visualization Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Traffic Visualizer (2 Cols) */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                      Website &amp; App Traffic Trends ({snapshot.bounds.label})
                    </h3>
                    <p className="text-xs text-[#7A6458] mt-0.5">
                      Real-time IST daily visits synchronized via Firebase Firestore.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B] text-xs font-bold tabular-nums">
                    <UserCheck className="w-3.5 h-3.5" />
                    {traffic.totalVisits.toLocaleString('en-IN')} visits
                  </div>
                </div>

                {/* Bar Chart Visualizer */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-44 sm:h-52 px-2 pb-2 border-b border-[#EAE2D5]">
                    {traffic.dailyTrend.map((item) => (
                      <div key={item.dateKey} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="text-[10px] font-bold text-[#70252D] opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                          {item.visits}
                        </div>
                        <div
                          className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-[#70252D] to-[#B83F60] group-hover:from-amber-600 group-hover:to-amber-500 transition-all cursor-pointer relative shadow-2xs"
                          style={{ height: `${item.visits > 0 ? Math.max(item.percentage, 10) : 4}%` }}
                        >
                          <div className="absolute inset-x-0 -top-7 hidden group-hover:flex items-center justify-center pointer-events-none z-20">
                            <span className="bg-[#2C2420] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                              {item.visits} visits
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-[#7A6458] mt-2 block truncate w-full text-center">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#7A6458] px-2 pt-2">
                    <span>{traffic.dailyTrend[0]?.label || ''}</span>
                    <span className="font-semibold text-[#70252D] tabular-nums">
                      Today IST ({traffic.todayVisits} Visits)
                    </span>
                  </div>
                </div>

                {/* Section Popularity Breakdown */}
                <div className="mt-8 pt-6 border-t border-[#EAE2D5]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-4">
                    Top Visited Sections
                  </h4>
                  {Object.keys(traffic.sectionViews).length === 0 ? (
                    <p className="text-xs text-[#7A6458] py-4">
                      No section page views recorded in Firestore yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(traffic.sectionViews)
                        .sort(([, a], [, b]) => b - a)
                        .map(([section, count]) => {
                          const totalSecViews =
                            Object.values(traffic.sectionViews).reduce((a, b) => a + b, 0) || 1;
                          const pct = Math.round((count / totalSecViews) * 100);
                          return (
                            <div key={section} className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5]">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold capitalize text-[#2C2420]">
                                  {section === 'tc' ? 'Terms (T&C)' : section}
                                </span>
                                <span className="font-bold text-[#70252D] tabular-nums">{pct}%</span>
                              </div>
                              <div className="w-full bg-[#EAE2D5] rounded-full h-1.5 overflow-hidden">
                                <div className="bg-[#70252D] h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="text-[10px] text-[#7A6458] mt-1 tabular-nums">
                                {count.toLocaleString('en-IN')} page views
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Devices & Sources Breakdown (1 Col) */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-[#EAE2D5] shadow-xs">
                  <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420] mb-1">
                    Visitor Device Split
                  </h3>
                  <p className="text-xs text-[#7A6458] mb-4">
                    Real-time device distribution across recorded sessions.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Smartphone className="w-4 h-4 text-[#70252D]" />
                          Mobile Devices
                        </span>
                        <span className="font-bold text-[#70252D] tabular-nums">{devicePercentages.mobile}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#70252D] h-full rounded-full" style={{ width: `${devicePercentages.mobile}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Monitor className="w-4 h-4 text-[#C29E57]" />
                          Desktop &amp; Laptop
                        </span>
                        <span className="font-bold text-[#C29E57] tabular-nums">{devicePercentages.desktop}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#C29E57] h-full rounded-full" style={{ width: `${devicePercentages.desktop}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Tablet className="w-4 h-4 text-[#6B5D55]" />
                          Tablets &amp; iPads
                        </span>
                        <span className="font-bold text-[#6B5D55] tabular-nums">{devicePercentages.tablet}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#6B5D55] h-full rounded-full" style={{ width: `${devicePercentages.tablet}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-[#EAE2D5] shadow-xs">
                  <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420] mb-1">
                    Traffic Sources
                  </h3>
                  <p className="text-xs text-[#7A6458] mb-4">
                    Inbound customer discovery channels.
                  </p>

                  <div className="space-y-3 text-xs tabular-nums">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#70252D]" />
                        Direct &amp; Bookmark
                      </span>
                      <span className="font-bold text-[#70252D]">{traffic.trafficSources.direct}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-[#4285F4] font-bold">G</span>
                        Google Search &amp; Organic Discovery
                      </span>
                      <span className="font-bold text-[#2C2420]">{traffic.trafficSources.google}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">WA</span>
                        WhatsApp Orders &amp; Shares
                      </span>
                      <span className="font-bold text-[#2C2420]">{traffic.trafficSources.whatsapp}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-pink-600 font-bold">IG</span>
                        Instagram &amp; Social Links
                      </span>
                      <span className="font-bold text-[#2C2420]">{traffic.trafficSources.instagram}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5 text-[#C29E57]" />
                        Referral Rewards &amp; Links
                      </span>
                      <span className="font-bold text-[#2C2420]">{traffic.trafficSources.referrals}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: BEST-SELLING BEDSHEETS (PRODUCT-WISE SALES) */}
        {/* ============================================================== */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                  Product-Wise Sales &amp; Best-Selling Bedsheets
                </h3>
                <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                  Ranked by units sold and actual confirmed revenue ({snapshot.bounds.label}), excluding cancelled and test orders.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search bedsheet name..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-[#DEC89B] bg-[#FAF7F2] focus:outline-hidden focus:ring-1 focus:ring-[#70252D] w-full sm:w-60"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE2D5] text-[11px] font-bold text-[#7A6458] uppercase tracking-wider bg-[#FAF7F2]">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Bedsheet Design</th>
                    <th className="py-3 px-4 text-center">Selling Price</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Order Value</th>
                    <th className="py-3 px-4 text-right">Actual Revenue</th>
                    <th className="py-3 px-4 text-center">Inventory</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2D5] text-xs tabular-nums">
                  {filteredSales.map((item, idx) => {
                    const originalProduct = synced.products.find((p) => p.id === item.productId);
                    return (
                      <tr key={item.productId} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-4 px-4 font-bold text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                : idx === 2
                                ? 'bg-amber-50 text-amber-800'
                                : 'text-[#7A6458]'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveBedsheetImage(item.image, item.productId)}
                              alt={item.name}
                              className="w-12 h-12 rounded-lg object-cover border border-[#DEC89B] shrink-0"
                            />
                            <div>
                              <p className="font-bold text-[#2C2420] text-sm">{item.name}</p>
                              <p className="text-[11px] text-[#7A6458]">{item.collection}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-[#2C2420]">
                          ₹{item.price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-[#2C2420]">
                          {item.orderCount}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-[#70252D] bg-[#FDEAF0] px-2 py-0.5 rounded-full">
                            {item.unitsSold} units
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-[#2C2420]">
                          ₹{item.grossSalesRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-800">
                          ₹{item.actualSalesRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {item.inStock ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              In Stock ({item.stockQuantity})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {originalProduct && onSelectProduct && (
                            <button
                              type="button"
                              onClick={() => onSelectProduct(originalProduct)}
                              className="text-[11px] font-bold text-[#70252D] hover:underline cursor-pointer"
                            >
                              Quick View →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: MOST REVIEWED BEDSHEETS */}
        {/* ============================================================== */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                  Most Reviewed Bedsheets &amp; Customer Ratings
                </h3>
                <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                  Real customer ratings and verified buyer reviews from Firestore ({snapshot.bounds.label}).
                </p>
              </div>

              {onGoToReviews && (
                <button
                  type="button"
                  onClick={onGoToReviews}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#70252D] bg-[#FDEAF0] hover:bg-[#F9D3DE] border border-[#FAD1DC] rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Star className="w-3.5 h-3.5 fill-[#70252D]" />
                  <span>View All {engagement.totalReviews} Customer Reviews</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredReviews.map((item, idx) => (
                <div
                  key={item.productId}
                  className="p-5 rounded-2xl border border-[#EAE2D5] bg-[#FAF7F2]/40 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#70252D] bg-[#FDEAF0] px-2.5 py-1 rounded-lg">
                      Rank #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-sm tabular-nums">
                      <Star className="w-4 h-4 fill-amber-500" />
                      <span>{item.totalReviews > 0 ? `${item.averageRating} / 5.0` : 'No reviews yet'}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <img
                      src={resolveBedsheetImage(item.image, item.productId)}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-[#7A6458]">
                        {item.collection} · ₹{item.price.toLocaleString('en-IN')}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6B5D55] tabular-nums">
                        <span className="font-semibold text-[#2C2420]">{item.totalReviews} Reviews</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">{item.verifiedBuyerCount} Verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EAE2D5]/70 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#7A6458] tabular-nums">
                      <span>5 Star Reviews ({item.fiveStarCount})</span>
                      <span>{item.recommendedPercentage}% Positive</span>
                    </div>
                    <div className="w-full bg-[#EAE2D5] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${item.recommendedPercentage}%` }}
                      />
                    </div>
                  </div>

                  {item.topReviewExcerpt && (
                    <div className="p-2.5 bg-white rounded-xl border border-[#EAE2D5] text-xs text-[#2C2420] italic">
                      &quot;{item.topReviewExcerpt}&quot;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MOST WISHLISTED BEDSHEETS */}
        {/* ============================================================== */}
        {activeTab === 'wishlist' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                  Most Wishlisted Bedsheets (Real Customer Demand)
                </h3>
                <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                  Actual wishlist bookmarks saved by Cotton Nest shoppers across website and mobile app ({snapshot.bounds.label}).
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold tabular-nums">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                {customers.totalWishlistSaves} Saved Items ({customers.uniqueWishlistCustomers} Customers)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWishlists.map((item, idx) => (
                <div
                  key={item.productId}
                  className="p-5 rounded-2xl border border-[#EAE2D5] bg-[#FAF7F2]/40 hover:bg-white transition-all space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-lg">
                      #{idx + 1} Wishlist Demand
                    </span>
                    <div className="flex items-center gap-1 text-rose-600 font-bold text-xs tabular-nums">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      <span>{item.wishlistCount} Saves</span>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <img
                      src={resolveBedsheetImage(item.image, item.productId)}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-[#7A6458]">{item.collection}</p>
                      <div className="text-sm font-bold text-[#70252D] mt-1 tabular-nums">
                        ₹{item.price.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EAE2D5] space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#7A6458] tabular-nums">
                      <span>Wishlist to Order Conversion</span>
                      <span className="font-bold text-emerald-700">{item.wishlistConversionRate}%</span>
                    </div>
                    <div className="w-full bg-[#EAE2D5] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, item.wishlistConversionRate)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#8C7A70] pt-1 tabular-nums">
                      <span>{item.unitsSold} Units Purchased</span>
                      <span>{item.inStock ? 'Available to Buy' : 'Out of Stock'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: FULL COMPARISON MATRIX */}
        {/* ============================================================== */}
        {activeTab === 'matrix' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6">
            <div>
              <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                All-in-One Bedsheet Performance Matrix
              </h3>
              <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                Synchronized comparison of Units Sold, Order Value, Actual Revenue, Reviews, Views, and Wishlist Saves ({snapshot.bounds.label}).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE2D5] text-[11px] font-bold text-[#7A6458] uppercase tracking-wider bg-[#FAF7F2]">
                    <th className="py-3 px-4">Bedsheet</th>
                    <th className="py-3 px-4 text-center">Price</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Order Value</th>
                    <th className="py-3 px-4 text-right">Actual Revenue</th>
                    <th className="py-3 px-4 text-center">Views</th>
                    <th className="py-3 px-4 text-center">Reviews</th>
                    <th className="py-3 px-4 text-center">Avg Rating</th>
                    <th className="py-3 px-4 text-center">Wishlists</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2D5] text-xs tabular-nums">
                  {bestSellingProducts.map((item) => (
                    <tr key={item.productId} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveBedsheetImage(item.image, item.productId)}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover border border-[#DEC89B] shrink-0"
                          />
                          <div>
                            <p className="font-bold text-[#2C2420] text-sm">{item.name}</p>
                            <p className="text-[10px] text-[#7A6458]">{item.collection}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-[#2C2420]">
                        ₹{item.price.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-[#70252D]">
                        {item.unitsSold}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-[#2C2420]">
                        ₹{item.grossSalesRevenue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-emerald-800">
                        ₹{item.actualSalesRevenue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-[#2C2420]">
                        {item.totalViews}
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-[#2C2420]">
                        {item.totalReviews}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span>{item.totalReviews > 0 ? item.averageRating : '—'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-xs">
                          {item.wishlistCount}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {item.inStock ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            In Stock
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                            Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Attribution */}
        <div className="text-center text-xs text-[#8C7A70] py-4">
          Cotton Nest Unified Analytics Engine · Single Firestore Source of Truth · Real-time IST Sync Active
        </div>
      </div>
    </div>
  );
};
