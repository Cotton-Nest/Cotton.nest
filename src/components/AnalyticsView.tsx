/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Star,
  Heart,
  Eye,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Calendar,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Share2,
  Printer,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Award,
  Flame,
  ArrowRight,
  Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { ProductReview } from '../data/reviews';
import { WishlistItem } from '../data/wishlist';
import {
  SiteTrafficData,
  computeMostOrderedBedsheets,
  computeMostReviewedBedsheets,
  computeMostWishlistedBedsheets,
  BedsheetSalesMetric,
  BedsheetReviewMetric,
  BedsheetWishlistMetric,
} from '../data/analytics';
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
  products,
  orders,
  reviews,
  wishlistItems,
  trafficData,
  onSelectProduct,
  onGoToCatalogue,
  onGoToReviews,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'reviews' | 'wishlist' | 'matrix'>('overview');
  const [timeframe, setTimeframe] = useState<'all' | '30d' | '7d'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Computed Metrics
  const salesMetrics = useMemo(() => {
    return computeMostOrderedBedsheets(orders, products);
  }, [orders, products]);

  const reviewMetrics = useMemo(() => {
    return computeMostReviewedBedsheets(reviews, products);
  }, [reviews, products]);

  const wishlistMetrics = useMemo(() => {
    return computeMostWishlistedBedsheets(wishlistItems, products, orders);
  }, [wishlistItems, products, orders]);

  // Aggregate grand statistics
  const totalRevenue = useMemo(() => {
    return salesMetrics.reduce((sum, item) => sum + item.totalRevenue, 0);
  }, [salesMetrics]);

  const totalUnitsSold = useMemo(() => {
    return salesMetrics.reduce((sum, item) => sum + item.unitsSold, 0);
  }, [salesMetrics]);

  const totalOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status !== 'cancelled').length;
  }, [orders]);

  const totalReviewsCount = reviews.length;
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 4.9;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / reviews.length).toFixed(1));
  }, [reviews]);

  const totalWishlistSaves = useMemo(() => {
    return wishlistMetrics.reduce((acc, w) => acc + w.wishlistCount, 0);
  }, [wishlistMetrics]);

  // Top Champions
  const topOrdered = salesMetrics[0] || null;
  const topReviewed = reviewMetrics[0] || null;
  const topWishlisted = wishlistMetrics[0] || null;

  // Traffic Days Array
  const trafficChartData = useMemo(() => {
    const dates = Object.keys(trafficData.pageViewsByDate || {}).sort();
    const maxVal = Math.max(...Object.values(trafficData.pageViewsByDate || {}), 1);
    return dates.map((d) => {
      const val = trafficData.pageViewsByDate[d] || 0;
      const dateObj = new Date(d);
      const label = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      return {
        dateStr: d,
        label,
        count: val,
        percentage: Math.round((val / maxVal) * 100),
      };
    });
  }, [trafficData]);

  // Filtered lists based on search
  const filteredSales = salesMetrics.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredReviews = reviewMetrics.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredWishlists = wishlistMetrics.filter((p) =>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Top Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#FDEAF0]/40 to-[#F4EFE6]/60 rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDEAF0] text-[#70252D] text-xs font-bold tracking-wider uppercase border border-[#FAD1DC] mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Store Analytics · Cotton Nest
              </div>
              <h1 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C2420] tracking-tight">
                Store Performance &amp; Customer Insights
              </h1>
              <p className="text-sm sm:text-base text-[#6B5D55] mt-1.5 max-w-2xl leading-relaxed">
                Comprehensive analysis of website traffic, bestseller bedsheets, customer reviews &amp; ratings, and wishlist demand trends.
              </p>
            </div>

            {/* Quick Actions & Live Badge */}
            <div className="flex items-center gap-3 shrink-0">
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

          {/* Key KPI Highlights Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#EAE2D5]">
            {/* KPI 1: Website Visits */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
              <div className="flex items-center justify-between text-[#7A6458] mb-1">
                <span className="text-xs font-medium">Website Visits</span>
                <Eye className="w-4 h-4 text-[#C29E57]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#2C2420]">
                {trafficData.totalVisits.toLocaleString('en-IN')}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{trafficData.todayVisits} visits today</span>
                <span className="text-[#8C7A70] font-normal">({trafficData.uniqueVisitors} unique)</span>
              </div>
            </div>

            {/* KPI 2: Total Bedsheets Ordered */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
              <div className="flex items-center justify-between text-[#7A6458] mb-1">
                <span className="text-xs font-medium">Units Ordered</span>
                <ShoppingBag className="w-4 h-4 text-[#70252D]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#70252D]">
                {totalUnitsSold} <span className="text-sm font-sans font-normal text-[#6B5D55]">sheets</span>
              </div>
              <div className="text-[11px] text-[#6B5D55] font-medium mt-1">
                Across {totalOrdersCount} orders (₹{totalRevenue.toLocaleString('en-IN')})
              </div>
            </div>

            {/* KPI 3: Customer Reviews */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
              <div className="flex items-center justify-between text-[#7A6458] mb-1">
                <span className="text-xs font-medium">Customer Reviews</span>
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#2C2420] flex items-center gap-2">
                <span>{averageRating}</span>
                <div className="flex text-amber-500 text-sm">★★★★★</div>
              </div>
              <div className="text-[11px] text-[#6B5D55] font-medium mt-1">
                {totalReviewsCount} verified reviews (98% positive)
              </div>
            </div>

            {/* KPI 4: Wishlist Saves */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2]/80 border border-[#EAE2D5]/80 hover:bg-white transition-colors">
              <div className="flex items-center justify-between text-[#7A6458] mb-1">
                <span className="text-xs font-medium">Wishlist Saves</span>
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif-luxury text-[#2C2420]">
                {totalWishlistSaves} <span className="text-sm font-sans font-normal text-[#6B5D55]">saves</span>
              </div>
              <div className="text-[11px] text-[#6B5D55] font-medium mt-1">
                High purchase intent demand
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between gap-4 border-b border-[#EAE2D5] pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { id: 'overview', label: 'Website Traffic & Overview', icon: BarChart3 },
              { id: 'orders', label: 'Most Ordered Bedsheets', icon: ShoppingBag, count: salesMetrics.length },
              { id: 'reviews', label: 'Most Reviewed Sheets', icon: Star, count: reviewMetrics.length },
              { id: 'wishlist', label: 'Most Wishlisted Demand', icon: Heart, count: wishlistMetrics.length },
              { id: 'matrix', label: 'Full Comparison Matrix', icon: Award },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
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

          {/* Timeframe pills */}
          <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EAE2D5] text-xs">
            <button
              onClick={() => setTimeframe('7d')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                timeframe === '7d' ? 'bg-[#FAF7F2] text-[#70252D] font-bold' : 'text-[#7A6458]'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('30d')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                timeframe === '30d' ? 'bg-[#FAF7F2] text-[#70252D] font-bold' : 'text-[#7A6458]'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                timeframe === 'all' ? 'bg-[#FAF7F2] text-[#70252D] font-bold' : 'text-[#7A6458]'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW & WEBSITE TRAFFIC */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Top 3 Champions Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Champion 1: Best Seller */}
              {topOrdered && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold uppercase">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      #1 Most Ordered
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold">{topOrdered.unitsSold} Units Sold</span>
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
                      <div className="text-sm font-bold text-[#70252D] mt-1">
                        ₹{topOrdered.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-[#6B5D55] mt-0.5">
                        Generated ₹{topOrdered.totalRevenue.toLocaleString('en-IN')} revenue
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Champion 2: Highest Rated */}
              {topReviewed && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold uppercase">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      #1 Most Reviewed
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold">{topReviewed.totalReviews} Reviews</span>
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
                        <span className="text-xs font-bold text-[#2C2420]">{topReviewed.averageRating}</span>
                        <div className="flex text-amber-500 text-xs">★★★★★</div>
                        <span className="text-[11px] text-[#7A6458]">({topReviewed.verifiedBuyerCount} verified)</span>
                      </div>
                      <p className="text-[11px] text-[#6B5D55] italic truncate mt-1">
                        &quot;{topReviewed.topReviewExcerpt || 'Exceptional comfort and durable colors.'}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Champion 3: Highest Wishlisted */}
              {topWishlisted && (
                <div className="bg-white rounded-2xl p-5 border border-[#EAE2D5] shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 text-xs font-bold uppercase">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      #1 Most Wishlisted
                    </span>
                    <span className="text-xs text-[#7A6458] font-semibold">{topWishlisted.wishlistCount} Wishlists</span>
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
                      <div className="text-sm font-bold text-[#70252D] mt-1">
                        ₹{topWishlisted.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        {topWishlisted.conversionRate}% converted to orders
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
                      Website Traffic Trends (Past 14 Days)
                    </h3>
                    <p className="text-xs text-[#7A6458] mt-0.5">
                      Daily page visits tracked in real time across desktop and mobile devices.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B] text-xs font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +18.4% this month
                  </div>
                </div>

                {/* Bar Chart Visualizer */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-44 sm:h-52 px-2 pb-2 border-b border-[#EAE2D5]">
                    {trafficChartData.map((item, idx) => (
                      <div key={item.dateStr} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="text-[10px] font-bold text-[#70252D] opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                          {item.count}
                        </div>
                        <div
                          className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-[#70252D] to-[#B83F60] group-hover:from-amber-600 group-hover:to-amber-500 transition-all cursor-pointer relative shadow-2xs"
                          style={{ height: `${Math.max(item.percentage, 12)}%` }}
                        >
                          <div className="absolute inset-x-0 -top-7 hidden group-hover:flex items-center justify-center pointer-events-none z-20">
                            <span className="bg-[#2C2420] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                              {item.count} visits
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
                    <span>14 Days Ago</span>
                    <span className="font-semibold text-[#70252D]">Today ({trafficData.todayVisits} Visits)</span>
                  </div>
                </div>

                {/* Section Popularity Breakdown */}
                <div className="mt-8 pt-6 border-t border-[#EAE2D5]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-4">
                    Top Visited Sections
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(trafficData.pageViewsBySection).map(([section, count]) => {
                      const totalSecViews = Object.values(trafficData.pageViewsBySection).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / totalSecViews) * 100);
                      return (
                        <div key={section} className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold capitalize text-[#2C2420]">
                              {section === 'tc' ? 'Terms (T&C)' : section}
                            </span>
                            <span className="font-bold text-[#70252D]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#EAE2D5] rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#70252D] h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-[#7A6458] mt-1">{count.toLocaleString('en-IN')} page views</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Devices & Sources Breakdown (1 Col) */}
              <div className="space-y-6">
                {/* Device Breakdown Card */}
                <div className="bg-white rounded-3xl p-6 border border-[#EAE2D5] shadow-xs">
                  <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420] mb-1">
                    Visitor Device Split
                  </h3>
                  <p className="text-xs text-[#7A6458] mb-4">
                    Optimized for mobile shoppers in Gurgaon &amp; Delhi NCR.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Smartphone className="w-4 h-4 text-[#70252D]" />
                          Mobile Devices
                        </span>
                        <span className="font-bold text-[#70252D]">{trafficData.deviceBreakdown.mobile}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#70252D] h-full rounded-full" style={{ width: `${trafficData.deviceBreakdown.mobile}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Monitor className="w-4 h-4 text-[#C29E57]" />
                          Desktop &amp; Laptop
                        </span>
                        <span className="font-bold text-[#C29E57]">{trafficData.deviceBreakdown.desktop}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#C29E57] h-full rounded-full" style={{ width: `${trafficData.deviceBreakdown.desktop}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#2C2420]">
                          <Tablet className="w-4 h-4 text-[#6B5D55]" />
                          Tablets &amp; iPads
                        </span>
                        <span className="font-bold text-[#6B5D55]">{trafficData.deviceBreakdown.tablet}%</span>
                      </div>
                      <div className="w-full bg-[#EAE2D5] rounded-full h-2 overflow-hidden">
                        <div className="bg-[#6B5D55] h-full rounded-full" style={{ width: `${trafficData.deviceBreakdown.tablet}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Traffic Acquisition Channels Card */}
                <div className="bg-white rounded-3xl p-6 border border-[#EAE2D5] shadow-xs">
                  <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420] mb-1">
                    Traffic Sources
                  </h3>
                  <p className="text-xs text-[#7A6458] mb-4">
                    Inbound customer discovery channels.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#70252D]" />
                        Direct &amp; Bookmark
                      </span>
                      <span className="font-bold text-[#70252D]">{trafficData.trafficSources.direct}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-[#4285F4] font-bold">G</span>
                        Google Search &amp; Maps Local
                      </span>
                      <span className="font-bold text-[#2C2420]">{trafficData.trafficSources.google}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">WA</span>
                        WhatsApp Orders &amp; Shares
                      </span>
                      <span className="font-bold text-[#2C2420]">{trafficData.trafficSources.whatsapp}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#EAE2D5]">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <span className="text-pink-600 font-bold">IG</span>
                        Instagram &amp; Social Links
                      </span>
                      <span className="font-bold text-[#2C2420]">{trafficData.trafficSources.instagram}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#2C2420] font-medium flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5 text-[#C29E57]" />
                        Referral Rewards &amp; Codes
                      </span>
                      <span className="font-bold text-[#2C2420]">{trafficData.trafficSources.referrals}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MOST ORDERED BEDSHEETS */}
        {/* ============================================================== */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                  Most Ordered Bedsheets (Sales Volume)
                </h3>
                <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                  Ranked by units sold, total revenue generated, and order frequency across all client purchases.
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

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE2D5] text-[11px] font-bold text-[#7A6458] uppercase tracking-wider bg-[#FAF7F2]">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Bedsheet Design</th>
                    <th className="py-3 px-4 text-center">Thread Count</th>
                    <th className="py-3 px-4 text-center">Selling Price</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-center">Inventory</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2D5] text-xs">
                  {filteredSales.map((item, idx) => {
                    const originalProduct = products.find((p) => p.id === item.productId);
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
                        <td className="py-4 px-4 text-center font-medium text-[#6B5D55]">
                          {item.threadCount}
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
                        <td className="py-4 px-4 text-right font-bold text-[#70252D]">
                          ₹{item.totalRevenue.toLocaleString('en-IN')}
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
                  Ranked by verified buyer reviews count, 5-star ratings, and customer satisfaction percentage.
                </p>
              </div>

              {onGoToReviews && (
                <button
                  type="button"
                  onClick={onGoToReviews}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#70252D] bg-[#FDEAF0] hover:bg-[#F9D3DE] border border-[#FAD1DC] rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Star className="w-3.5 h-3.5 fill-[#70252D]" />
                  <span>View All {reviews.length} Customer Reviews</span>
                </button>
              )}
            </div>

            {/* Reviews Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredReviews.map((item, idx) => (
                <div
                  key={item.productId}
                  className="p-5 rounded-2xl border border-[#EAE2D5] bg-[#FAF7F2]/40 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#70252D] bg-[#FDEAF0] px-2.5 py-1 rounded-lg">
                      Rank #{idx + 1} Most Reviewed
                    </span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                      <Star className="w-4 h-4 fill-amber-500" />
                      <span>{item.averageRating} / 5.0</span>
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
                      <p className="text-xs text-[#7A6458]">{item.collection} · ₹{item.price.toLocaleString('en-IN')}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6B5D55]">
                        <span className="font-semibold text-[#2C2420]">{item.totalReviews} Total Reviews</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">{item.verifiedBuyerCount} Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Breakdown Bar */}
                  <div className="pt-2 border-t border-[#EAE2D5]/70 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#7A6458]">
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
                  Most Wishlisted Bedsheets (Customer Desirability)
                </h3>
                <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
                  Designs saved by customers to their personal wishlist bookmarks. Essential for anticipating restocks and production batches.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                {totalWishlistSaves} Total Customer Wishlist Saves
              </div>
            </div>

            {/* Wishlist Ranking Cards */}
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
                    <div className="flex items-center gap-1 text-rose-600 font-bold text-xs">
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
                      <div className="text-sm font-bold text-[#70252D] mt-1">
                        ₹{item.price.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Demand vs Purchase metric */}
                  <div className="pt-2 border-t border-[#EAE2D5] space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#7A6458]">
                      <span>Wishlist to Order Conversion</span>
                      <span className="font-bold text-emerald-700">{item.conversionRate}%</span>
                    </div>
                    <div className="w-full bg-[#EAE2D5] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, item.conversionRate)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#8C7A70] pt-1">
                      <span>{item.unitsSold} Units Purchased</span>
                      <span>{item.inStock ? 'Available to Buy' : 'Pre-order priority'}</span>
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
                Side-by-side comparison of Orders, Units Sold, Revenue, Customer Ratings, and Wishlist Saves.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE2D5] text-[11px] font-bold text-[#7A6458] uppercase tracking-wider bg-[#FAF7F2]">
                    <th className="py-3 px-4">Bedsheet</th>
                    <th className="py-3 px-4 text-center">Price</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-center">Reviews</th>
                    <th className="py-3 px-4 text-center">Avg Rating</th>
                    <th className="py-3 px-4 text-center">Wishlists</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2D5] text-xs">
                  {products.map((p) => {
                    const sales = salesMetrics.find((s) => s.productId === p.id);
                    const rev = reviewMetrics.find((r) => r.productId === p.id);
                    const wish = wishlistMetrics.find((w) => w.productId === p.id);
                    return (
                      <tr key={p.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveBedsheetImage(p.image, p.id)}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover border border-[#DEC89B] shrink-0"
                            />
                            <div>
                              <p className="font-bold text-[#2C2420] text-sm">{p.name}</p>
                              <p className="text-[10px] text-[#7A6458]">{p.collection}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-[#2C2420]">
                          ₹{p.price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-[#70252D]">
                          {sales?.unitsSold || 0}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-[#70252D]">
                          ₹{(sales?.totalRevenue || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-[#2C2420]">
                          {rev?.totalReviews || 0}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span>{rev?.averageRating || 5.0}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-xs">
                            {wish?.wishlistCount || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {p.inStock !== false ? (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Attribution for Analytics */}
        <div className="text-center text-xs text-[#8C7A70] py-4">
          Cotton Nest Store Intelligence Engine · Gurgaon Atelier Sector 46 · Real-time synchronization active.
        </div>
      </div>
    </div>
  );
};
