import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Filter,
  Globe,
  Heart,
  History,
  Laptop,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tablet,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { WishlistItem } from '../data/wishlist';
import { getWishlistsApi } from '../services/api';
import {
  CustomerActivityEvent,
  CustomerActivityProfile,
  CustomerDeviceType,
  ProductInterestAnalyticsItem,
  aggregateProductInterestAnalytics,
  computeCustomerInterestScore,
  formatDateOnlyIST,
  formatDurationHuman,
  formatTimeOnlyIST,
  formatTimestampIST
} from '../data/customerActivity';
import {
  reconcileCustomerProfilesWithStoreData,
  subscribeToAllCustomerActivityProfiles
} from '../services/customerActivityTracker';

interface AdminCustomerAnalyticsSectionProps {
  products: BedsheetProduct[];
  orders: Order[];
  onToast?: (msg: string) => void;
}

type DateFilterRange = 'all' | 'today' | '7d' | '30d' | 'custom';
type SortByOption = 'recent' | 'most_active' | 'wishlist_high' | 'most_interested' | 'orders_high';
type AnalyticsSubTab = 'customers' | 'most_interested' | 'product_interest' | 'cohorts';
type ProfileDetailTab = 'overview' | 'timeline' | 'sessions' | 'wishlist_views' | 'cart_search_orders';

export const AdminCustomerAnalyticsSection: React.FC<AdminCustomerAnalyticsSectionProps> = ({
  products,
  orders,
  onToast
}) => {
  const [rawProfiles, setRawProfiles] = useState<CustomerActivityProfile[]>([]);
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sub-navigation & Filters
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateFilterRange>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'All' | CustomerDeviceType>('All');
  const [sortBy, setSortBy] = useState<SortByOption>('recent');

  // Selected customer for Individual Profile Modal
  const [selectedCustomerUid, setSelectedCustomerUid] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileDetailTab>('overview');
  const [timelineFilter, setTimelineFilter] = useState<'all' | CustomerActivityEvent['type']>('all');

  useEffect(() => {
    setIsLoading(true);
    let mounted = true;
    const unsubProfiles = subscribeToAllCustomerActivityProfiles(profilesList => {
      if (mounted) {
        setRawProfiles(profilesList);
        setIsLoading(false);
      }
    });
    getWishlistsApi()
      .then(items => {
        if (mounted && Array.isArray(items)) {
          setWishlists(items);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
      unsubProfiles();
    };
  }, []);

  // Reconciled profiles combining live Firestore customer_activity + signed-in orders/wishlists
  const allProfiles = useMemo(() => {
    return reconcileCustomerProfilesWithStoreData(rawProfiles, orders, wishlists);
  }, [rawProfiles, orders, wishlists]);

  // Apply Search, Date Range, Device Type, and Sort
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return allProfiles
      .filter(profile => {
        // 1. Search by name, email, phone, or UID
        if (q) {
          const matchesName = (profile.customerName || '').toLowerCase().includes(q);
          const matchesEmail = (profile.email || '').toLowerCase().includes(q);
          const matchesPhone = (profile.phone || '').toLowerCase().includes(q);
          const matchesUid = (profile.uid || '').toLowerCase().includes(q);
          if (!matchesName && !matchesEmail && !matchesPhone && !matchesUid) {
            return false;
          }
        }

        // 2. Filter by device type
        if (deviceFilter !== 'All') {
          if ((profile.deviceInfo?.deviceType || 'Desktop') !== deviceFilter) {
            return false;
          }
        }

        // 3. Filter by lastActiveAt date range
        const lastActive = profile.lastActiveAt || profile.lastLoginAt || 0;
        if (dateRange === 'today') {
          if (lastActive < startOfToday.getTime()) return false;
        } else if (dateRange === '7d') {
          if (lastActive < now - 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === '30d') {
          if (lastActive < now - 30 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === 'custom') {
          if (customStartDate) {
            const startTs = new Date(`${customStartDate}T00:00:00`).getTime();
            if (!Number.isNaN(startTs) && lastActive < startTs) return false;
          }
          if (customEndDate) {
            const endTs = new Date(`${customEndDate}T23:59:59`).getTime();
            if (!Number.isNaN(endTs) && lastActive > endTs) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'most_active') {
          return (b.totalTimeSpentSeconds || 0) - (a.totalTimeSpentSeconds || 0);
        }
        if (sortBy === 'wishlist_high') {
          const bCount = Math.max(b.currentWishlist?.length || 0, b.totalAddedToWishlistCount || 0);
          const aCount = Math.max(a.currentWishlist?.length || 0, a.totalAddedToWishlistCount || 0);
          return bCount - aCount;
        }
        if (sortBy === 'most_interested') {
          return computeCustomerInterestScore(b) - computeCustomerInterestScore(a);
        }
        if (sortBy === 'orders_high') {
          if ((b.ordersPlacedCount || 0) !== (a.ordersPlacedCount || 0)) {
            return (b.ordersPlacedCount || 0) - (a.ordersPlacedCount || 0);
          }
          return (b.totalPurchaseValue || 0) - (a.totalPurchaseValue || 0);
        }
        // Default: 'recent' (Most Recently Active)
        return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
      });
  }, [allProfiles, searchQuery, deviceFilter, dateRange, customStartDate, customEndDate, sortBy]);

  // Top-level Summary & Returning vs New Customers Metrics
  const summaryStats = useMemo(() => {
    const totalCustomers = allProfiles.length;
    const returningCustomers = allProfiles.filter(p => (p.totalSessions || 1) > 1);
    const newCustomers = allProfiles.filter(p => (p.totalSessions || 1) <= 1);
    const totalTimeSeconds = allProfiles.reduce((acc, p) => acc + (p.totalTimeSpentSeconds || 0), 0);
    const totalSessionsSum = allProfiles.reduce((acc, p) => acc + Math.max(1, p.totalSessions || 1), 0);
    const avgSessionSeconds = totalSessionsSum > 0 ? Math.round(totalTimeSeconds / totalSessionsSum) : 0;
    const totalProductViews = allProfiles.reduce((acc, p) => acc + (p.totalProductViews || 0), 0);
    const totalWishlistItems = allProfiles.reduce(
      (acc, p) => acc + (p.currentWishlist?.length || 0),
      0
    );
    const returningPct =
      totalCustomers > 0 ? Math.round((returningCustomers.length / totalCustomers) * 100) : 0;
    const newPct = totalCustomers > 0 ? 100 - returningPct : 0;

    return {
      totalCustomers,
      returningCount: returningCustomers.length,
      newCount: newCustomers.length,
      returningPct,
      newPct,
      totalTimeSeconds,
      totalSessionsSum,
      avgSessionSeconds,
      totalProductViews,
      totalWishlistItems
    };
  }, [allProfiles]);

  // Ranked Most Interested Customers
  const mostInterestedCustomers = useMemo(() => {
    return [...allProfiles].sort(
      (a, b) => computeCustomerInterestScore(b) - computeCustomerInterestScore(a)
    );
  }, [allProfiles]);

  // Product Interest Analytics
  const productInterestList = useMemo<ProductInterestAnalyticsItem[]>(() => {
    return aggregateProductInterestAnalytics(allProfiles, products, orders, wishlists);
  }, [allProfiles, products, orders, wishlists]);

  // Selected Customer Profile object
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerUid) return null;
    return allProfiles.find(p => p.uid === selectedCustomerUid) || null;
  }, [allProfiles, selectedCustomerUid]);

  // Orders belonging to the selected customer
  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const cleanEmail = (selectedCustomer.email || '').trim().toLowerCase();
    const cleanPhone = (selectedCustomer.phone || '').replace(/[^0-9]/g, '').slice(-10);

    return (orders || []).filter(o => {
      if (!o) return false;
      if (o.userId && o.userId === selectedCustomer.uid) return true;
      const oEmail = (o.customerEmail || '').trim().toLowerCase();
      const oPhone = (o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
      if (cleanEmail && oEmail && cleanEmail === oEmail) return true;
      if (cleanPhone && cleanPhone.length >= 10 && oPhone && cleanPhone === oPhone) return true;
      return false;
    });
  }, [selectedCustomer, orders]);

  // Export Customer Activity Data to CSV
  const handleExportCSV = () => {
    if (filteredProfiles.length === 0) {
      onToast?.('No customer records match the current filter to export.');
      return;
    }

    const headers = [
      'Customer UID',
      'Customer Name',
      'Email',
      'Phone',
      'Account Created (IST)',
      'Last Login (IST)',
      'Last Active (IST)',
      'Total Visits / Sessions',
      'Customer Type',
      'Total Time Spent (Formatted)',
      'Total Time Spent (Seconds)',
      'Average Session Duration',
      'Pages Visited',
      'Most Visited Page',
      'Products Viewed Count',
      'Current Wishlist Count',
      'Historical Wishlist Additions',
      'Products Added to Cart',
      'Searches Performed',
      'Recent Search Terms',
      'Orders Placed',
      'Total Purchase Value (INR)',
      'Device Type',
      'Operating System',
      'Browser',
      'Screen Resolution',
      'Approximate Region'
    ];

    const escapeCsv = (val: unknown): string => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredProfiles.map(p => [
      p.uid,
      p.customerName || 'Cotton Nest Customer',
      p.email || '—',
      p.phone || '—',
      formatTimestampIST(p.accountCreatedAt),
      formatTimestampIST(p.lastLoginAt),
      formatTimestampIST(p.lastActiveAt),
      p.totalSessions || 1,
      (p.totalSessions || 1) > 1 ? 'Returning Customer' : 'New Customer',
      formatDurationHuman(p.totalTimeSpentSeconds),
      p.totalTimeSpentSeconds || 0,
      formatDurationHuman(p.averageSessionDurationSeconds),
      p.totalPagesVisited || 1,
      p.mostVisitedPage || 'Home Showcase',
      p.totalProductViews || 0,
      p.currentWishlist?.length || 0,
      p.totalAddedToWishlistCount || 0,
      p.totalAddedToCartCount || 0,
      p.totalSearches || 0,
      (p.searchHistory || [])
        .slice(0, 5)
        .map(s => s.term)
        .join('; '),
      p.ordersPlacedCount || 0,
      p.totalPurchaseValue || 0,
      p.deviceInfo?.deviceType || 'Desktop',
      p.deviceInfo?.os || 'Unknown',
      p.deviceInfo?.browser || 'Browser',
      p.deviceInfo?.screenResolution || '—',
      p.deviceInfo?.approximateLocation || 'India (IST)'
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `cotton-nest-customer-analytics-${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast?.(`Exported ${filteredProfiles.length} customer activity profile(s) to CSV.`);
  };

  const renderDeviceIcon = (deviceType?: CustomerDeviceType) => {
    if (deviceType === 'Mobile') return <Smartphone className="w-3.5 h-3.5 text-[#8C2E46]" />;
    if (deviceType === 'Tablet') return <Tablet className="w-3.5 h-3.5 text-[#C29E57]" />;
    return <Laptop className="w-3.5 h-3.5 text-[#4A3B32]" />;
  };

  const renderTimelineIcon = (type: CustomerActivityEvent['type']) => {
    switch (type) {
      case 'login':
        return <LogIn className="w-3.5 h-3.5 text-emerald-700" />;
      case 'logout':
      case 'session_end':
        return <LogOut className="w-3.5 h-3.5 text-[#8C7A70]" />;
      case 'product_view':
        return <Eye className="w-3.5 h-3.5 text-[#8C2E46]" />;
      case 'wishlist_add':
      case 'wishlist_remove':
        return <Heart className="w-3.5 h-3.5 text-rose-600" />;
      case 'cart_add':
        return <ShoppingCart className="w-3.5 h-3.5 text-amber-700" />;
      case 'search':
        return <Search className="w-3.5 h-3.5 text-indigo-700" />;
      case 'order_placed':
        return <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-[#C29E57]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#DEC89B]/60 text-[11px] font-bold uppercase tracking-wider text-[#8C2E46] mb-2">
              <Activity className="w-3.5 h-3.5 text-[#C29E57]" />
              Firebase Live Customer Activity & Engagement Intelligence
            </div>
            <h3 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420]">
              Customer Analytics & Activity Profiles
            </h3>
            <p className="text-xs sm:text-sm text-[#7A6A5E] mt-1 max-w-3xl">
              Real-time session tracking, active time spent (auto-paused after 2 minutes of inactivity), product views, wishlist history, search queries, device telemetry, and chronological IST timelines for signed-in Cotton Nest customers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-[#2C2420] hover:bg-[#8C2E46] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#DEC89B]" />
              Export Activity CSV ({filteredProfiles.length})
            </button>
          </div>
        </div>

        {/* Top KPI Cards with Tabular Numerals */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mt-6">
          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EAE2D5]">
            <div className="flex items-center justify-between text-[#7A6A5E] text-[11px] font-bold uppercase tracking-wider">
              <span>Signed-In Customers</span>
              <Users className="w-4 h-4 text-[#8C2E46]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#2C2420] mt-2 tabular-nums">
              {summaryStats.totalCustomers}
            </p>
            <p className="text-[11px] text-[#7A6A5E] mt-1 tabular-nums">
              {summaryStats.totalSessionsSum} total login sessions
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EAE2D5]">
            <div className="flex items-center justify-between text-[#7A6A5E] text-[11px] font-bold uppercase tracking-wider">
              <span>Returning vs New</span>
              <UserCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex items-baseline gap-2 mt-2 tabular-nums">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-800">
                {summaryStats.returningCount}
              </span>
              <span className="text-xs font-semibold text-[#7A6A5E]">
                Returning ({summaryStats.returningPct}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#EAE2D5] rounded-full overflow-hidden mt-2 flex">
              <div
                className="bg-emerald-700 h-full transition-all"
                style={{ width: `${summaryStats.returningPct}%` }}
              />
              <div
                className="bg-[#C29E57] h-full transition-all"
                style={{ width: `${summaryStats.newPct}%` }}
              />
            </div>
            <p className="text-[10px] text-[#7A6A5E] mt-1 tabular-nums">
              {summaryStats.newCount} First-Time Signed-In ({summaryStats.newPct}%)
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EAE2D5]">
            <div className="flex items-center justify-between text-[#7A6A5E] text-[11px] font-bold uppercase tracking-wider">
              <span>Total Active Time</span>
              <Clock className="w-4 h-4 text-[#C29E57]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#2C2420] mt-2 tabular-nums">
              {formatDurationHuman(summaryStats.totalTimeSeconds)}
            </p>
            <p className="text-[11px] text-[#7A6A5E] mt-1 tabular-nums">
              Avg session: {formatDurationHuman(summaryStats.avgSessionSeconds)}
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EAE2D5]">
            <div className="flex items-center justify-between text-[#7A6A5E] text-[11px] font-bold uppercase tracking-wider">
              <span>Products Viewed</span>
              <Eye className="w-4 h-4 text-[#8C2E46]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#2C2420] mt-2 tabular-nums">
              {summaryStats.totalProductViews}
            </p>
            <p className="text-[11px] text-[#7A6A5E] mt-1 tabular-nums">
              Across {productInterestList.length} active bedsheets
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EAE2D5] col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[#7A6A5E] text-[11px] font-bold uppercase tracking-wider">
              <span>Saved to Wishlist</span>
              <Heart className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#8C2E46] mt-2 tabular-nums">
              {summaryStats.totalWishlistItems}
            </p>
            <p className="text-[11px] text-[#7A6A5E] mt-1">
              Historical & current saved items
            </p>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#EAE2D5]">
          {[
            {
              id: 'customers' as AnalyticsSubTab,
              label: `Customer Activity Table (${filteredProfiles.length})`,
              icon: Users
            },
            {
              id: 'most_interested' as AnalyticsSubTab,
              label: 'Most Interested Customers',
              icon: Award
            },
            {
              id: 'product_interest' as AnalyticsSubTab,
              label: 'Product Interest Analytics',
              icon: TrendingUp
            },
            {
              id: 'cohorts' as AnalyticsSubTab,
              label: 'Returning vs New Customers',
              icon: UserCheck
            }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-[#8C2E46] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-[#5C4A3E] hover:bg-[#F3ECE2] border border-[#EAE2D5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: CUSTOMER ACTIVITY TABLE & FILTERS */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs space-y-5">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search by name, email, or phone */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search customer by name, email, or phone..."
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7A70] hover:text-[#2C2420]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Date Range */}
            <div className="md:col-span-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8C2E46] shrink-0" />
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value as DateFilterRange)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-semibold text-[#2C2420] focus:outline-hidden"
              >
                <option value="all">Date Range: All Time</option>
                <option value="today">Active Today (IST)</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Filter by Device Type */}
            <div className="md:col-span-2 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#C29E57] shrink-0" />
              <select
                value={deviceFilter}
                onChange={e => setDeviceFilter(e.target.value as 'All' | CustomerDeviceType)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-semibold text-[#2C2420] focus:outline-hidden"
              >
                <option value="All">All Devices</option>
                <option value="Mobile">Mobile Only</option>
                <option value="Desktop">Desktop Only</option>
                <option value="Tablet">Tablet Only</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="md:col-span-3">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortByOption)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-semibold text-[#2C2420] focus:outline-hidden"
              >
                <option value="recent">Sort: Most Recently Active</option>
                <option value="most_active">Sort: Most Active (Time Spent)</option>
                <option value="wishlist_high">Sort: Highest Wishlist Count</option>
                <option value="most_interested">Sort: Highest Engagement Score</option>
                <option value="orders_high">Sort: Most Orders Placed</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs">
              <span className="font-bold text-[#5C4A3E]">Custom IST Date Filter:</span>
              <label className="flex items-center gap-1.5">
                <span className="text-[#7A6A5E]">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-[#7A6A5E]">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420]"
                />
              </label>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-[#8C2E46] font-bold hover:underline"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}

          {/* Customer Activity Table */}
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#7A6A5E] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#8C2E46]" />
              Loading signed-in customer activity profiles from Firebase...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-12 text-center bg-[#FAF7F2] rounded-2xl border border-dashed border-[#DEC89B] p-6">
              <Users className="w-8 h-8 text-[#C29E57] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#2C2420]">No matching signed-in customer profiles found</p>
              <p className="text-xs text-[#7A6A5E] mt-1">
                Every customer who signs in automatically gets a live activity profile here. Try clearing your search or filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[920px]">
                <thead>
                  <tr className="border-b border-[#EAE2D5] text-[11px] font-bold uppercase tracking-wider text-[#7A6A5E] bg-[#FAF7F2]">
                    <th className="py-3.5 px-4 rounded-tl-xl">Customer Name</th>
                    <th className="py-3.5 px-4">Email & Contact</th>
                    <th className="py-3.5 px-4">Last Active (IST)</th>
                    <th className="py-3.5 px-3 text-right">Total Visits</th>
                    <th className="py-3.5 px-3 text-right">Total Time Spent</th>
                    <th className="py-3.5 px-3 text-right">Wishlist Count</th>
                    <th className="py-3.5 px-3 text-right">Products Viewed</th>
                    <th className="py-3.5 px-3 text-right">Orders</th>
                    <th className="py-3.5 px-4">Device Used</th>
                    <th className="py-3.5 px-4 text-right rounded-tr-xl">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2D5] text-xs">
                  {filteredProfiles.map(profile => {
                    const isReturning = (profile.totalSessions || 1) > 1;
                    const wishlistCount = profile.currentWishlist?.length || 0;
                    const histWishlistCount = profile.totalAddedToWishlistCount || wishlistCount;

                    return (
                      <tr
                        key={profile.uid}
                        onClick={() => {
                          setSelectedCustomerUid(profile.uid);
                          setProfileTab('overview');
                        }}
                        className="hover:bg-[#FAF7F2]/90 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#8C2E46]/10 border border-[#8C2E46]/25 flex items-center justify-center text-[#8C2E46] font-bold text-xs shrink-0">
                              {(profile.customerName || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[#2C2420] group-hover:text-[#8C2E46] transition-colors flex items-center gap-1.5">
                                <span>{profile.customerName || 'Signed-In Customer'}</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                    isReturning
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {isReturning ? 'Returning' : 'New'}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#8C7A70] font-mono">
                                UID: {profile.uid.slice(0, 16)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[#2C2420] font-medium">{profile.email || '—'}</div>
                          {profile.phone && (
                            <div className="text-[11px] text-[#7A6A5E] tabular-nums">{profile.phone}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 tabular-nums">
                          <div className="font-semibold text-[#2C2420]">
                            {formatTimestampIST(profile.lastActiveAt)}
                          </div>
                          <div className="text-[10px] text-[#7A6A5E]">
                            Top: {profile.mostVisitedPage || 'Home Showcase'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums font-bold text-[#2C2420]">
                          {profile.totalSessions || 1}
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums">
                          <span className="font-bold text-[#8C2E46]">
                            {formatDurationHuman(profile.totalTimeSpentSeconds)}
                          </span>
                          <div className="text-[10px] text-[#7A6A5E]">
                            Avg {formatDurationHuman(profile.averageSessionDurationSeconds)}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums">
                          <span className="font-bold text-rose-700">{wishlistCount}</span>
                          {histWishlistCount > wishlistCount && (
                            <div className="text-[10px] text-[#7A6A5E]">
                              ({histWishlistCount} all-time)
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums font-bold text-[#2C2420]">
                          {profile.totalProductViews || 0}
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums">
                          <div className="font-bold text-emerald-800">
                            {profile.ordersPlacedCount || 0}
                          </div>
                          {(profile.totalPurchaseValue || 0) > 0 && (
                            <div className="text-[10px] text-[#7A6A5E]">
                              ₹{Number(profile.totalPurchaseValue).toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EAE2D5] text-[11px] font-semibold text-[#2C2420]">
                            {renderDeviceIcon(profile.deviceInfo?.deviceType)}
                            <span>{profile.deviceInfo?.deviceType || 'Desktop'}</span>
                          </div>
                          <div className="text-[10px] text-[#7A6A5E] mt-0.5">
                            {profile.deviceInfo?.browser || 'Browser'} · {profile.deviceInfo?.os || 'OS'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedCustomerUid(profile.uid);
                              setProfileTab('overview');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF7F2] group-hover:bg-[#8C2E46] text-[#8C2E46] group-hover:text-white border border-[#DEC89B]/60 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <span>View Log</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MOST INTERESTED CUSTOMERS LEADERBOARD */}
      {activeSubTab === 'most_interested' && (
        <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                Most Interested & High-Intent Customers
              </h4>
              <p className="text-xs text-[#7A6A5E]">
                Ranked by composite engagement score combining active browse duration, bedsheet views, wishlist saves, cart additions, repeat visits, and orders.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mostInterestedCustomers.slice(0, 12).map((cust, index) => {
              const score = computeCustomerInterestScore(cust);
              return (
                <div
                  key={cust.uid}
                  onClick={() => {
                    setSelectedCustomerUid(cust.uid);
                    setProfileTab('overview');
                  }}
                  className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] hover:border-[#8C2E46] transition-all cursor-pointer flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#8C2E46] text-white font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#2C2420] flex items-center gap-2">
                        <span>{cust.customerName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DEC89B] text-[#8C2E46] font-bold tabular-nums">
                          Score: {score}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A6A5E]">{cust.email || cust.phone || cust.uid}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-[#5C4A3E] tabular-nums">
                        <span>
                          <strong>{formatDurationHuman(cust.totalTimeSpentSeconds)}</strong> active
                        </span>
                        <span>·</span>
                        <span>
                          <strong>{cust.totalProductViews || 0}</strong> product views
                        </span>
                        <span>·</span>
                        <span>
                          <strong>{cust.currentWishlist?.length || 0}</strong> wishlisted
                        </span>
                        <span>·</span>
                        <span>
                          <strong>{cust.totalAddedToCartCount || 0}</strong> cart adds
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE2D5] text-[11px] font-bold text-[#8C2E46] shrink-0"
                  >
                    Inspect
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRODUCT INTEREST ANALYTICS */}
      {activeSubTab === 'product_interest' && (
        <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h4 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
              Product Interest Analytics
            </h4>
            <p className="text-xs text-[#7A6A5E]">
              Bedsheets ranked by signed-in customer views, unique interested shoppers, wishlist saves, cart additions, and completed orders.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#EAE2D5] text-[11px] font-bold uppercase tracking-wider text-[#7A6A5E] bg-[#FAF7F2]">
                  <th className="py-3 px-4 rounded-tl-xl">Bedsheet Product</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3 text-right">Total Views</th>
                  <th className="py-3 px-3 text-right">Unique Viewers</th>
                  <th className="py-3 px-3 text-right">Wishlist Saves</th>
                  <th className="py-3 px-3 text-right">Added to Cart</th>
                  <th className="py-3 px-3 text-right">Orders</th>
                  <th className="py-3 px-4 text-right rounded-tr-xl">Interest Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D5] text-xs">
                {productInterestList.map(item => (
                  <tr key={item.productId} className="hover:bg-[#FAF7F2]/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-10 h-10 rounded-lg object-cover border border-[#EAE2D5] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#EAE2D5] flex items-center justify-center">
                            <Package className="w-4 h-4 text-[#C29E57]" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-[#2C2420]">{item.productName}</div>
                          <div className="text-[10px] text-[#7A6A5E]">{item.collection}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#2C2420]">
                      ₹{Number(item.productPrice).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-[#8C2E46]">
                      {item.totalViews}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[#2C2420]">
                      {item.uniqueViewers}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-rose-700">
                      {item.wishlistAdds}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-amber-800">
                      {item.cartAdds}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-800">
                      {item.ordersCount}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#DEC89B] font-bold text-[#8C2E46]">
                        {item.interestScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: RETURNING VS NEW CUSTOMERS COHORT ANALYSIS */}
      {activeSubTab === 'cohorts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Returning Customers Card */}
          <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                    Returning Customers ({summaryStats.returningCount})
                  </h4>
                  <p className="text-xs text-[#7A6A5E]">
                    Signed-in customers with 2 or more sessions ({summaryStats.returningPct}% of base)
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#EAE2D5] max-h-96 overflow-y-auto">
              {allProfiles
                .filter(p => (p.totalSessions || 1) > 1)
                .map(p => (
                  <div
                    key={p.uid}
                    onClick={() => {
                      setSelectedCustomerUid(p.uid);
                      setProfileTab('overview');
                    }}
                    className="py-3 flex items-center justify-between hover:bg-[#FAF7F2] px-2 rounded-xl cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#2C2420]">{p.customerName}</div>
                      <div className="text-[11px] text-[#7A6A5E]">{p.email || p.phone}</div>
                    </div>
                    <div className="text-right tabular-nums text-xs">
                      <div className="font-bold text-emerald-800">{p.totalSessions} sessions</div>
                      <div className="text-[10px] text-[#7A6A5E]">
                        {formatDurationHuman(p.totalTimeSpentSeconds)} spent
                      </div>
                    </div>
                  </div>
                ))}
              {summaryStats.returningCount === 0 && (
                <p className="text-xs text-[#7A6A5E] py-6 text-center">
                  No multi-session returning customers recorded yet.
                </p>
              )}
            </div>
          </div>

          {/* New Customers Card */}
          <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                    First-Time Signed-In Customers ({summaryStats.newCount})
                  </h4>
                  <p className="text-xs text-[#7A6A5E]">
                    Customers on their initial recorded session ({summaryStats.newPct}% of base)
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#EAE2D5] max-h-96 overflow-y-auto">
              {allProfiles
                .filter(p => (p.totalSessions || 1) <= 1)
                .map(p => (
                  <div
                    key={p.uid}
                    onClick={() => {
                      setSelectedCustomerUid(p.uid);
                      setProfileTab('overview');
                    }}
                    className="py-3 flex items-center justify-between hover:bg-[#FAF7F2] px-2 rounded-xl cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#2C2420]">{p.customerName}</div>
                      <div className="text-[11px] text-[#7A6A5E]">{p.email || p.phone}</div>
                    </div>
                    <div className="text-right tabular-nums text-xs">
                      <div className="font-bold text-[#8C2E46]">Joined {formatDateOnlyIST(p.accountCreatedAt)}</div>
                      <div className="text-[10px] text-[#7A6A5E]">
                        {formatDurationHuman(p.totalTimeSpentSeconds)} spent
                      </div>
                    </div>
                  </div>
                ))}
              {summaryStats.newCount === 0 && (
                <p className="text-xs text-[#7A6A5E] py-6 text-center">
                  No single-session customers in current list.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL CUSTOMER PROFILE MODAL */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedCustomerUid(null)}
        >
          <div
            className="bg-[#FAF7F2] border border-[#DEC89B] rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="bg-white border-b border-[#EAE2D5] px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#8C2E46] text-white font-serif-luxury text-xl font-bold flex items-center justify-center shrink-0">
                  {(selectedCustomer.customerName || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
                      {selectedCustomer.customerName}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#FAF7F2] border border-[#DEC89B] text-[#8C2E46]">
                      {(selectedCustomer.totalSessions || 1) > 1 ? 'Returning Member' : 'New Member'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7A6A5E] mt-1">
                    {selectedCustomer.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-[#8C2E46]" />
                        {selectedCustomer.email}
                      </span>
                    )}
                    {selectedCustomer.phone && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
                        {selectedCustomer.phone}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-[#8C7A70]">
                      Firebase UID: {selectedCustomer.uid}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerUid(null)}
                className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#8C2E46] text-[#2C2420] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Detail Navigation Tabs */}
            <div className="bg-white border-b border-[#EAE2D5] px-5 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: 'overview' as ProfileDetailTab, label: 'Overview & Device Specs', icon: ShieldCheck },
                {
                  id: 'timeline' as ProfileDetailTab,
                  label: `Chronological Timeline (${selectedCustomer.timeline?.length || 0})`,
                  icon: Activity
                },
                {
                  id: 'sessions' as ProfileDetailTab,
                  label: `Session History (${selectedCustomer.sessions?.length || 1})`,
                  icon: History
                },
                {
                  id: 'wishlist_views' as ProfileDetailTab,
                  label: `Wishlist & Viewed Products`,
                  icon: Heart
                },
                {
                  id: 'cart_search_orders' as ProfileDetailTab,
                  label: `Cart, Searches & Orders`,
                  icon: ShoppingBag
                }
              ].map(t => {
                const Icon = t.icon;
                const isActive = profileTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProfileTab(t.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#8C2E46] text-white shadow-xs'
                        : 'bg-[#FAF7F2] text-[#5C4A3E] hover:bg-[#F3ECE2]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* TAB 1: OVERVIEW, CUSTOMER INFO, ENGAGEMENT & DEVICE TELEMETRY */}
              {profileTab === 'overview' && (
                <div className="space-y-6">
                  {/* Engagement Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6A5E]">
                        Total Time Spent
                      </span>
                      <p className="text-xl font-bold text-[#8C2E46] mt-1 tabular-nums">
                        {formatDurationHuman(selectedCustomer.totalTimeSpentSeconds)}
                      </p>
                      <p className="text-[11px] text-[#7A6A5E] mt-0.5 tabular-nums">
                        Avg session: {formatDurationHuman(selectedCustomer.averageSessionDurationSeconds)}
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6A5E]">
                        Login Sessions
                      </span>
                      <p className="text-xl font-bold text-[#2C2420] mt-1 tabular-nums">
                        {selectedCustomer.totalSessions || 1} Visits
                      </p>
                      <p className="text-[11px] text-[#7A6A5E] mt-0.5 tabular-nums">
                        {selectedCustomer.totalPagesVisited || 1} pages visited
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6A5E]">
                        Product Engagement
                      </span>
                      <p className="text-xl font-bold text-[#2C2420] mt-1 tabular-nums">
                        {selectedCustomer.totalProductViews || 0} Views
                      </p>
                      <p className="text-[11px] text-rose-700 font-semibold mt-0.5 tabular-nums">
                        {selectedCustomer.currentWishlist?.length || 0} current wishlist ({selectedCustomer.totalAddedToWishlistCount || 0} all-time)
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6A5E]">
                        Orders & Spend
                      </span>
                      <p className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
                        {selectedCustomer.ordersPlacedCount || 0} Orders
                      </p>
                      <p className="text-[11px] text-[#7A6A5E] mt-0.5 tabular-nums">
                        Total: ₹{Number(selectedCustomer.totalPurchaseValue || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Three-Column Detail Grid: Customer Info | Website Engagement | Device & Technical Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* 1. Customer Information */}
                    <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        1. Customer Information
                      </h4>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Customer Name</dt>
                          <dd className="font-bold text-[#2C2420] text-right">{selectedCustomer.customerName}</dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Registered Email</dt>
                          <dd className="font-semibold text-[#2C2420] text-right break-all">
                            {selectedCustomer.email || '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">User ID (UID)</dt>
                          <dd className="font-mono text-[11px] text-[#2C2420] text-right break-all">
                            {selectedCustomer.uid}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Phone Number</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums">
                            {selectedCustomer.phone || 'Not provided'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Account Created</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums text-right">
                            {formatTimestampIST(selectedCustomer.accountCreatedAt)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Last Login (IST)</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums text-right">
                            {formatTimestampIST(selectedCustomer.lastLoginAt)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1">
                          <dt className="text-[#7A6A5E]">Total Login Sessions</dt>
                          <dd className="font-bold text-[#8C2E46] tabular-nums">
                            {selectedCustomer.totalSessions || 1}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* 2. Website Engagement */}
                    <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#C29E57]" />
                        2. Website Engagement
                      </h4>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Last Active (IST)</dt>
                          <dd className="font-bold text-[#2C2420] tabular-nums text-right">
                            {formatTimestampIST(selectedCustomer.lastActiveAt, true)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Most Visited Page</dt>
                          <dd className="font-bold text-[#8C2E46]">
                            {selectedCustomer.mostVisitedPage || 'Home Showcase'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Pages Visited</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums">
                            {selectedCustomer.totalPagesVisited || 1}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Total Product Views</dt>
                          <dd className="font-bold text-[#2C2420] tabular-nums">
                            {selectedCustomer.totalProductViews || 0} ({selectedCustomer.productsViewed?.length || 0} unique)
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Added to Cart</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums">
                            {selectedCustomer.totalAddedToCartCount || 0} items
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Added to Wishlist</dt>
                          <dd className="font-semibold text-rose-700 tabular-nums">
                            {selectedCustomer.totalAddedToWishlistCount || 0} all-time ({selectedCustomer.currentWishlist?.length || 0} current)
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1">
                          <dt className="text-[#7A6A5E]">Searches Performed</dt>
                          <dd className="font-semibold text-[#2C2420] tabular-nums">
                            {selectedCustomer.totalSearches || 0}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* 3. Device & Technical Information */}
                    <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                        <Monitor className="w-4 h-4" />
                        3. Device & Technical Info
                      </h4>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Device Type</dt>
                          <dd className="font-bold text-[#2C2420] flex items-center gap-1">
                            {renderDeviceIcon(selectedCustomer.deviceInfo?.deviceType)}
                            {selectedCustomer.deviceInfo?.deviceType || 'Desktop'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Operating System</dt>
                          <dd className="font-semibold text-[#2C2420]">
                            {selectedCustomer.deviceInfo?.os || 'Unknown OS'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Browser</dt>
                          <dd className="font-semibold text-[#2C2420]">
                            {selectedCustomer.deviceInfo?.browser || 'Browser'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Screen Resolution</dt>
                          <dd className="font-mono text-[11px] font-semibold text-[#2C2420] tabular-nums">
                            {selectedCustomer.deviceInfo?.screenResolution || '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1 border-b border-[#FAF7F2]">
                          <dt className="text-[#7A6A5E]">Device Category</dt>
                          <dd className="font-semibold text-[#2C2420] text-right">
                            {selectedCustomer.deviceInfo?.deviceCategory || 'Standard Device'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 py-1">
                          <dt className="text-[#7A6A5E]">Approx. Location</dt>
                          <dd className="font-semibold text-[#2C2420] text-right">
                            {selectedCustomer.deviceInfo?.approximateLocation || 'India (IST Region)'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CHRONOLOGICAL ACTIVITY TIMELINE */}
              {profileTab === 'timeline' && (
                <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                        Chronological Activity Timeline (IST)
                      </h4>
                      <p className="text-xs text-[#7A6A5E]">
                        Step-by-step log of sign-ins, page visits, bedsheet views, wishlist saves, cart actions, searches, and sign-outs.
                      </p>
                    </div>
                    <select
                      value={timelineFilter}
                      onChange={e => setTimelineFilter(e.target.value as any)}
                      className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-semibold text-[#2C2420]"
                    >
                      <option value="all">All Activity Events</option>
                      <option value="login">Sign-Ins</option>
                      <option value="product_view">Product Views</option>
                      <option value="wishlist_add">Wishlist Additions</option>
                      <option value="cart_add">Cart Additions</option>
                      <option value="search">Searches</option>
                      <option value="order_placed">Orders Placed</option>
                      <option value="logout">Logouts & Exits</option>
                    </select>
                  </div>

                  <div className="relative pl-6 border-l-2 border-[#DEC89B] space-y-4 max-h-[460px] overflow-y-auto pr-2">
                    {(selectedCustomer.timeline || [])
                      .filter(evt => timelineFilter === 'all' || evt.type === timelineFilter)
                      .map(evt => (
                        <div key={evt.id} className="relative bg-[#FAF7F2] rounded-2xl p-3.5 border border-[#EAE2D5]">
                          <div className="absolute -left-[33px] top-4 w-6 h-6 rounded-full bg-white border-2 border-[#C29E57] flex items-center justify-center">
                            {renderTimelineIcon(evt.type)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="text-xs font-bold text-[#2C2420]">
                              <span className="text-[#8C2E46] tabular-nums mr-2">
                                {formatTimeOnlyIST(evt.timestamp)} –
                              </span>
                              <span>{evt.label}</span>
                            </div>
                            <span className="text-[10px] text-[#7A6A5E] tabular-nums">
                              {formatDateOnlyIST(evt.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    {(selectedCustomer.timeline || []).length === 0 && (
                      <p className="text-xs text-[#7A6A5E] py-6">No timeline events recorded yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SESSION-WISE ACTIVITY HISTORY */}
              {profileTab === 'sessions' && (
                <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 space-y-4">
                  <div>
                    <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                      Session-Wise Activity History
                    </h4>
                    <p className="text-xs text-[#7A6A5E]">
                      Each sign-in session with login timestamp, last active / logout time, active duration, device, and pages visited.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#EAE2D5] text-[11px] font-bold uppercase text-[#7A6A5E] bg-[#FAF7F2]">
                          <th className="py-2.5 px-3">Session Login (IST)</th>
                          <th className="py-2.5 px-3">Last Active / Logout (IST)</th>
                          <th className="py-2.5 px-3 text-right">Active Duration</th>
                          <th className="py-2.5 px-3 text-right">Products Viewed</th>
                          <th className="py-2.5 px-3">Pages Visited</th>
                          <th className="py-2.5 px-3">Device & Browser</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAE2D5]">
                        {(selectedCustomer.sessions || []).map(sess => (
                          <tr key={sess.sessionId} className="hover:bg-[#FAF7F2]/60">
                            <td className="py-3 px-3 tabular-nums font-semibold text-[#2C2420]">
                              {formatTimestampIST(sess.loginAt, true)}
                            </td>
                            <td className="py-3 px-3 tabular-nums text-[#5C4A3E]">
                              {sess.logoutAt
                                ? `Logged out: ${formatTimestampIST(sess.logoutAt, true)}`
                                : formatTimestampIST(sess.lastActiveAt, true)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-bold text-[#8C2E46]">
                              {formatDurationHuman(sess.durationSeconds)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold">
                              {sess.productsViewedCount || 0}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(sess.pagesVisited || []).map((pg, idx) => (
                                  <span
                                    key={`${sess.sessionId}_pg_${idx}`}
                                    className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#EAE2D5] text-[10px] font-semibold text-[#5C4A3E]"
                                  >
                                    {pg}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-[#7A6A5E]">
                              {sess.deviceType} · {sess.browser} ({sess.os})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: WISHLIST PRODUCTS (CURRENT & HISTORICAL) + RECENTLY VIEWED PRODUCTS */}
              {profileTab === 'wishlist_views' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Wishlist Products */}
                  <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                          Wishlist Products ({selectedCustomer.historicalWishlist?.length || 0})
                        </h4>
                        <p className="text-xs text-[#7A6A5E]">
                          Includes currently wishlisted items and historical additions even if removed later.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-96 overflow-y-auto">
                      {(selectedCustomer.historicalWishlist || []).map(item => (
                        <div
                          key={`${item.productId}_${item.addedAt}`}
                          className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                className="w-12 h-12 rounded-xl object-cover border border-[#EAE2D5]"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white border border-[#EAE2D5] flex items-center justify-center">
                                <Heart className="w-4 h-4 text-rose-500" />
                              </div>
                            )}
                            <div>
                              <div className="text-xs font-bold text-[#2C2420]">{item.productName}</div>
                              <div className="text-[11px] font-semibold text-[#8C2E46] tabular-nums">
                                ₹{Number(item.productPrice || 0).toLocaleString('en-IN')} · ID: {item.productId}
                              </div>
                              <div className="text-[10px] text-[#7A6A5E] tabular-nums">
                                Added: {formatTimestampIST(item.addedAt)}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.currentlyInWishlist
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-stone-100 text-stone-600 border border-stone-200'
                            }`}
                          >
                            {item.currentlyInWishlist ? 'In Wishlist' : 'Removed Later'}
                          </span>
                        </div>
                      ))}
                      {(selectedCustomer.historicalWishlist || []).length === 0 && (
                        <p className="text-xs text-[#7A6A5E] py-6 text-center">
                          No wishlist items recorded for this customer yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Recently Viewed Products */}
                  <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 space-y-4">
                    <div>
                      <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                        Recently Viewed Products ({selectedCustomer.productsViewed?.length || 0})
                      </h4>
                      <p className="text-xs text-[#7A6A5E]">
                        Products inspected by the customer with view count and last viewed IST timestamp.
                      </p>
                    </div>

                    <div className="space-y-2.5 max-h-96 overflow-y-auto">
                      {(selectedCustomer.productsViewed || []).map(prod => (
                        <div
                          key={prod.productId}
                          className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            {prod.productImage ? (
                              <img
                                src={prod.productImage}
                                alt={prod.productName}
                                className="w-12 h-12 rounded-xl object-cover border border-[#EAE2D5]"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white border border-[#EAE2D5] flex items-center justify-center">
                                <Eye className="w-4 h-4 text-[#8C2E46]" />
                              </div>
                            )}
                            <div>
                              <div className="text-xs font-bold text-[#2C2420]">{prod.productName}</div>
                              <div className="text-[11px] font-semibold text-[#8C2E46] tabular-nums">
                                ₹{Number(prod.productPrice || 0).toLocaleString('en-IN')} · ID: {prod.productId}
                              </div>
                              <div className="text-[10px] text-[#7A6A5E] tabular-nums">
                                Last viewed: {formatTimestampIST(prod.lastViewedAt)}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#DEC89B] text-xs font-bold text-[#8C2E46] tabular-nums shrink-0">
                            {prod.viewCount}x viewed
                          </span>
                        </div>
                      ))}
                      {(selectedCustomer.productsViewed || []).length === 0 && (
                        <p className="text-xs text-[#7A6A5E] py-6 text-center">
                          No individual product views recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CART ACTIVITY, SEARCH HISTORY & ORDER HISTORY */}
              {profileTab === 'cart_search_orders' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Cart Activity */}
                  <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4" />
                      Cart Activity ({selectedCustomer.cartActivity?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {(selectedCustomer.cartActivity || []).map((c, idx) => (
                        <div
                          key={`${c.productId}_${idx}`}
                          className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-center gap-2.5 text-xs"
                        >
                          {c.productImage && (
                            <img
                              src={c.productImage}
                              alt={c.productName}
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[#2C2420] truncate">{c.productName}</div>
                            <div className="text-[10px] text-[#7A6A5E] tabular-nums">
                              Qty: {c.quantity} · ₹{Number(c.productPrice || 0).toLocaleString('en-IN')} · {formatTimeOnlyIST(c.addedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(selectedCustomer.cartActivity || []).length === 0 && (
                        <p className="text-xs text-[#7A6A5E] py-4 text-center">No cart additions logged yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Search History */}
                  <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                      <Search className="w-4 h-4" />
                      Search History ({selectedCustomer.searchHistory?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {(selectedCustomer.searchHistory || []).map((s, idx) => (
                        <div
                          key={`${s.term}_${idx}`}
                          className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-bold text-[#2C2420]">"{s.term}"</span>
                          <span className="text-[10px] text-[#7A6A5E] tabular-nums shrink-0">
                            {formatTimestampIST(s.timestamp)}
                          </span>
                        </div>
                      ))}
                      {(selectedCustomer.searchHistory || []).length === 0 && (
                        <p className="text-xs text-[#7A6A5E] py-4 text-center">No search queries recorded yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Order History */}
                  <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      Order History ({selectedCustomerOrders.length})
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {selectedCustomerOrders.map(ord => (
                        <div
                          key={ord.id}
                          className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-[#2C2420]">
                            <span>Order #{ord.id}</span>
                            <span className="text-emerald-800 tabular-nums">
                              ₹{Number(ord.totalAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#7A6A5E]">
                            <span>Status: {ord.status}</span>
                            <span className="tabular-nums">{formatTimestampIST(ord.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                      {selectedCustomerOrders.length === 0 && (
                        <p className="text-xs text-[#7A6A5E] py-4 text-center">No orders placed yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
