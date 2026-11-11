import React, { useEffect, useState } from 'react';
import {
  Gift,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Save,
  Search,
  Award,
  ShoppingBag,
  Percent,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Order } from '../data/orders';
import {
  WelcomeOfferConfig,
  WelcomeOfferCustomerRecord,
  DEFAULT_WELCOME_OFFER_CONFIG,
  formatRupeeAmount,
} from '../data/welcomeOffer';
import {
  getWelcomeOfferAdminDataApi,
  saveWelcomeOfferConfigApi,
} from '../services/api';

interface AdminWelcomeOfferSectionProps {
  orders: Order[];
  onToast?: (msg: string) => void;
}

export const AdminWelcomeOfferSection: React.FC<AdminWelcomeOfferSectionProps> = ({
  orders,
  onToast,
}) => {
  const [config, setConfig] = useState<WelcomeOfferConfig>(DEFAULT_WELCOME_OFFER_CONFIG);
  const [redemptions, setRedemptions] = useState<WelcomeOfferCustomerRecord[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>(orders);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'reserved' | 'redeemed'>('all');
  const [benefitFilter, setBenefitFilter] = useState<'all' | 'welcome_offer' | 'nest_points' | 'coupon' | 'none'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAdminData = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getWelcomeOfferAdminDataApi();
      if (data.config) setConfig(data.config);
      if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
      if (Array.isArray(data.orders) && data.orders.length > 0) {
        setAdminOrders(data.orders);
      } else {
        setAdminOrders(orders);
      }
    } catch (err) {
      console.warn('Could not load Welcome Offer admin data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData(false);
  }, [orders.length]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const discPct = Math.max(1, Math.min(90, Number(config.discountPercent ?? config.discountPercentage) || 10));
      const maxDisc = Math.max(1, Number(config.maxDiscount ?? config.maxDiscountAmount) || 200);
      const sanitized: WelcomeOfferConfig = {
        ...config,
        offerName: (config.offerName || 'Welcome to Cotton Nest').trim(),
        discountPercentage: discPct,
        discountPercent: discPct,
        minOrderValue: Math.max(0, Number(config.minOrderValue) || 1299),
        maxDiscountAmount: maxDisc,
        maxDiscount: maxDisc,
        updatedAt: Date.now(),
      };
      const saved = await saveWelcomeOfferConfigApi(sanitized);
      setConfig(saved);
      window.dispatchEvent(new Event('cotton-nest-welcome-offer-updated'));
      onToast?.('🎁 Welcome Offer settings saved and synced across Website & Firestore!');
    } catch (err) {
      console.warn('Failed to save Welcome Offer config:', err);
      onToast?.('Failed to save Welcome Offer settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Merge customer records from redemptions + orders so admin sees all eligible, reserved, and redeemed customers
  const combinedCustomerRecords = React.useMemo(() => {
    const map = new Map<string, WelcomeOfferCustomerRecord>();

    for (const rec of redemptions) {
      const key = rec?.uid || rec?.userId;
      if (rec && key) {
        map.set(key, {
          ...rec,
          uid: key,
          userId: key,
          name: rec.name || rec.customerName,
          customerName: rec.customerName || rec.name,
        });
      }
    }

    for (const order of adminOrders) {
      const uid = order.userId || order.customerEmail || order.customerPhone || `order-user-${order.id}`;
      const existing = map.get(uid);
      const isWelcome = Boolean(
        order.welcomeOfferApplied ||
        order.benefitType === 'welcome_offer' ||
        (Number(order.welcomeDiscount) || 0) > 0
      );

      if (isWelcome) {
        const computedStatus =
          order.status === 'delivered'
            ? 'redeemed'
            : order.status === 'cancelled'
            ? 'eligible'
            : 'reserved';
        if (!existing || existing.status === 'eligible' || computedStatus === 'redeemed') {
          map.set(uid, {
            uid,
            userId: uid,
            email: order.customerEmail || existing?.email,
            phone: order.customerPhone || existing?.phone,
            name: order.customerName || existing?.name || existing?.customerName,
            customerName: order.customerName || existing?.customerName || existing?.name,
            authProvider: existing?.authProvider || 'google',
            status: computedStatus,
            reservedOrderId: computedStatus === 'reserved' ? order.id : existing?.reservedOrderId,
            redeemedOrderId: computedStatus === 'redeemed' ? order.id : existing?.redeemedOrderId,
            discountAmount: Number(order.welcomeDiscount) || existing?.discountAmount || 0,
            orderSubtotal: Number(order.subtotal) || existing?.orderSubtotal || 0,
            updatedAt: Date.now(),
          });
        }
      } else if (!existing && order.status !== 'delivered') {
        map.set(uid, {
          uid,
          userId: uid,
          email: order.customerEmail,
          phone: order.customerPhone,
          name: order.customerName,
          customerName: order.customerName,
          authProvider: 'google',
          status: 'eligible',
          updatedAt: Date.now(),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [redemptions, adminOrders]);

  const filteredCustomerRecords = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedCustomerRecords.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (!q) return true;
      const recUid = rec.uid || rec.userId || '';
      const recName = rec.name || rec.customerName || '';
      return (
        recUid.toLowerCase().includes(q) ||
        recName.toLowerCase().includes(q) ||
        (rec.email || '').toLowerCase().includes(q) ||
        (rec.phone || '').toLowerCase().includes(q) ||
        (rec.reservedOrderId || '').toLowerCase().includes(q) ||
        (rec.redeemedOrderId || '').toLowerCase().includes(q)
      );
    });
  }, [combinedCustomerRecords, statusFilter, searchQuery]);

  const resolveOrderBenefit = (order: Order): 'welcome_offer' | 'nest_points' | 'coupon' | 'none' => {
    if (order.welcomeOfferApplied || order.benefitType === 'welcome_offer' || (Number(order.welcomeDiscount) || 0) > 0) {
      return 'welcome_offer';
    }
    if (order.benefitType === 'nest_points' || (Number(order.pointsUsed) || 0) > 0) {
      return 'nest_points';
    }
    if (order.benefitType === 'coupon' || (Number(order.couponDiscount) || 0) > 0) {
      return 'coupon';
    }
    return 'none';
  };

  const filteredOrders = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return adminOrders.filter((o) => {
      const bType = resolveOrderBenefit(o);
      if (benefitFilter !== 'all' && bType !== benefitFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.userId || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerEmail || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').toLowerCase().includes(q)
      );
    });
  }, [adminOrders, benefitFilter, searchQuery]);

  const stats = React.useMemo(() => {
    const eligibleCount = combinedCustomerRecords.filter((r) => r.status === 'eligible').length;
    const reservedCount = combinedCustomerRecords.filter((r) => r.status === 'reserved').length;
    const redeemedCount = combinedCustomerRecords.filter((r) => r.status === 'redeemed').length;
    const totalWelcomeSavings = combinedCustomerRecords
      .filter((r) => r.status === 'reserved' || r.status === 'redeemed')
      .reduce((sum, r) => sum + (Number(r.discountAmount) || 0), 0);
    return { eligibleCount, reservedCount, redeemedCount, totalWelcomeSavings };
  }, [combinedCustomerRecords]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#5E1924] via-[#70252D] to-[#4A121B] text-[#FAF6F0] rounded-3xl p-6 sm:p-8 border border-[#C5A059]/40 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-[#C5A059]/40 text-xs font-semibold text-[#EAD09A]">
            <Gift className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>NEW CUSTOMER WELCOME OFFER MANAGEMENT</span>
          </div>
          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
            {config.offerName || 'Welcome to Cotton Nest'} ({config.discountPercent}% OFF)
          </h2>
          <p className="text-xs sm:text-sm text-[#FAF6F0]/85 max-w-2xl">
            Manage the one-time Welcome Offer for new Google-authenticated customers. Strictly mutually exclusive with Nest Points (0 Nest Points earned or redeemed when Welcome Offer is applied).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAdminData(false)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const nextEnabled = !config.enabled;
              const updated = { ...config, enabled: nextEnabled, updatedAt: Date.now() };
              setConfig(updated);
              await saveWelcomeOfferConfigApi(updated);
              window.dispatchEvent(new Event('cotton-nest-welcome-offer-updated'));
              onToast?.(
                nextEnabled
                  ? '✅ Welcome Offer Enabled on Storefront!'
                  : '⏸️ Welcome Offer Disabled.'
              );
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm ${
              config.enabled
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-stone-200 hover:bg-stone-300 text-stone-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{config.enabled ? 'Offer Active (Click to Disable)' : 'Offer Disabled (Click to Enable)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#7A6458] font-semibold">
            <span>Eligible Customers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#2C2420] mt-1">{stats.eligibleCount}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Ready for 1st order benefit</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#7A6458] font-semibold">
            <span>Reserved (Active Orders)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-1">{stats.reservedCount}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Locked pending delivery</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#7A6458] font-semibold">
            <span>Redeemed (Delivered)</span>
            <ShieldCheck className="w-4 h-4 text-[#70252D]" />
          </div>
          <p className="text-2xl font-bold text-[#70252D] mt-1">{stats.redeemedCount}</p>
          <p className="text-[11px] text-[#7A6458] mt-0.5">Permanently completed</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE2D5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#7A6458] font-semibold">
            <span>Total Welcome Savings</span>
            <Percent className="w-4 h-4 text-[#C5A059]" />
          </div>
          <p className="text-2xl font-bold text-[#2C2420] mt-1">
            ₹{formatRupeeAmount(stats.totalWelcomeSavings)}
          </p>
          <p className="text-[11px] text-[#7A6458] mt-0.5">Max ₹{config.maxDiscount} per order</p>
        </div>
      </div>

      {/* Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-white rounded-3xl border border-[#EAE2D5] p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE2D5] pb-4">
          <div>
            <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
              1. Welcome Offer Parameters &amp; Calculation Rules
            </h3>
            <p className="text-xs text-[#7A6458]">
              Formula: Discount = MIN(ROUND(Product Subtotal × {config.discountPercent}%, 2), ₹{config.maxDiscount}) for Product Subtotal ≥ ₹{config.minOrderValue.toLocaleString('en-IN')}.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#70252D] hover:bg-[#591B22] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Offer Settings'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#2C2420] mb-1">
              Offer Name
            </label>
            <input
              type="text"
              value={config.offerName}
              onChange={(e) => setConfig({ ...config, offerName: e.target.value })}
              className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-semibold text-[#2C2420]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2C2420] mb-1">
              Discount Percentage (%)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              step={1}
              value={config.discountPercent}
              onChange={(e) => setConfig({ ...config, discountPercent: Number(e.target.value) })}
              className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-bold text-[#70252D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2C2420] mb-1">
              Minimum Order Value (₹ · Excl. Delivery)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={config.minOrderValue}
              onChange={(e) => setConfig({ ...config, minOrderValue: Number(e.target.value) })}
              className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-bold text-[#2C2420]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2C2420] mb-1">
              Maximum Discount Cap (₹)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={config.maxDiscount}
              onChange={(e) => setConfig({ ...config, maxDiscount: Number(e.target.value) })}
              className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-bold text-emerald-800"
            />
          </div>
        </div>

        {/* Live Calculation Reference Preview */}
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] block">
            Live Discount Calculation Preview (2-Decimal Precision · Delivery Excluded)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
            {[999, 1299, 1500, 1999, 2000, 3500].map((sampleSubtotal) => {
              const isElig = sampleSubtotal >= (config.minOrderValue || 1299);
              const rawDisc = Math.round(((sampleSubtotal * (config.discountPercent || 10)) / 100) * 100) / 100;
              const disc = isElig ? Math.min(rawDisc, config.maxDiscount || 200) : 0;
              const finalAmt = Math.round((sampleSubtotal - disc) * 100) / 100;
              return (
                <div key={sampleSubtotal} className="p-2 rounded-xl bg-white border border-[#EAE2D5]">
                  <p className="font-bold text-[#2C2420]">Subtotal: ₹{sampleSubtotal.toLocaleString('en-IN')}</p>
                  {isElig ? (
                    <>
                      <p className="text-emerald-700 font-semibold">Discount: -₹{formatRupeeAmount(disc)}</p>
                      <p className="text-[#7A6458]">Payable: ₹{formatRupeeAmount(finalAmt)}</p>
                    </>
                  ) : (
                    <p className="text-rose-600 font-medium">Not Eligible (&lt; ₹{config.minOrderValue})</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </form>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EAE2D5]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Customer UID, Name, Email, Phone, or Order ID..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'eligible', 'reserved', 'redeemed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-[#70252D] text-white'
                  : 'bg-[#FAF7F2] text-[#6B5D55] hover:text-[#2C2420] border border-[#EAE2D5]'
              }`}
            >
              {st === 'all' ? 'All Customers' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Eligibility, Reservation & Redemption Table */}
      <div className="bg-white rounded-3xl border border-[#EAE2D5] overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[#EAE2D5] bg-[#FAF7F2] flex items-center justify-between">
          <div>
            <h3 className="font-serif-luxury text-base font-bold text-[#2C2420]">
              2. Customer Welcome Offer Status &amp; UID Ledger ({filteredCustomerRecords.length})
            </h3>
            <p className="text-[11px] text-[#7A6458]">
              Tracks Firebase UID, order ID, discount amount, and one-time redemption lifecycle (Eligible → Reserved → Redeemed on Delivery).
            </p>
          </div>
        </div>

        {filteredCustomerRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#7A6458]">
            No customer Welcome Offer records match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EAE2D5] bg-[#FAF7F2]/60 text-[10px] uppercase tracking-wider text-[#7A6458]">
                  <th className="py-3 px-4">Customer &amp; Firebase UID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Redemption Status</th>
                  <th className="py-3 px-4">Linked Order ID</th>
                  <th className="py-3 px-4 text-right">Welcome Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D5]">
                {filteredCustomerRecords.map((rec) => {
                  const orderId = rec.redeemedOrderId || rec.reservedOrderId || '—';
                  const recUid = rec.uid || rec.userId || 'unknown';
                  const recName = rec.name || rec.customerName || 'Cotton Nest Customer';
                  return (
                    <tr key={recUid} className="hover:bg-[#FAF7F2]/50">
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#2C2420]">{recName}</p>
                        <p className="font-mono text-[10px] text-[#7A6458]">UID: {recUid}</p>
                      </td>
                      <td className="py-3 px-4 text-[#6B5D55]">
                        {rec.email && <p>{rec.email}</p>}
                        {rec.phone && <p>+91 {rec.phone}</p>}
                      </td>
                      <td className="py-3 px-4">
                        {rec.status === 'redeemed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Redeemed (Delivered)
                          </span>
                        )}
                        {rec.status === 'reserved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Reserved (In Progress)
                          </span>
                        )}
                        {rec.status === 'eligible' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <Gift className="w-3 h-3 text-blue-700" />
                            Eligible (New Customer)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#2C2420]">
                        {orderId !== '—' ? `#${orderId}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#70252D]">
                        {rec.discountAmount && rec.discountAmount > 0
                          ? `-₹${formatRupeeAmount(rec.discountAmount)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders Benefit & Nest Points Audit Table */}
      <div className="bg-white rounded-3xl border border-[#EAE2D5] overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[#EAE2D5] bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif-luxury text-base font-bold text-[#2C2420]">
              3. Orders Benefit Selection &amp; Nest Points Audit ({filteredOrders.length})
            </h3>
            <p className="text-[11px] text-[#7A6458]">
              Verifies which benefit was selected on each order (`Welcome Offer` vs `Nest Points`) and confirms 0 Nest Points earned/redeemed on Welcome Offer orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'welcome_offer', 'nest_points', 'coupon', 'none'] as const).map((bf) => (
              <button
                key={bf}
                type="button"
                onClick={() => setBenefitFilter(bf)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  benefitFilter === bf
                    ? 'bg-[#2C2420] text-[#DEC89B]'
                    : 'bg-white text-[#6B5D55] border border-[#EAE2D5]'
                }`}
              >
                {bf === 'all'
                  ? 'All Orders'
                  : bf === 'welcome_offer'
                  ? 'Welcome Offer'
                  : bf === 'nest_points'
                  ? 'Nest Points'
                  : bf === 'coupon'
                  ? 'Coupon'
                  : 'No Discount'}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#7A6458]">
            No orders match the selected benefit filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EAE2D5] bg-[#FAF7F2]/60 text-[10px] uppercase tracking-wider text-[#7A6458]">
                  <th className="py-3 px-4">Order ID &amp; Status</th>
                  <th className="py-3 px-4">Customer &amp; UID</th>
                  <th className="py-3 px-4">Benefit Selected</th>
                  <th className="py-3 px-4 text-right">Discount Applied</th>
                  <th className="py-3 px-4 text-right">Nest Points Redeemed</th>
                  <th className="py-3 px-4 text-right">Nest Points Earned</th>
                  <th className="py-3 px-4 text-right">Final Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D5]">
                {filteredOrders.map((order) => {
                  const bType = resolveOrderBenefit(order);
                  const isWelcome = bType === 'welcome_offer';
                  const welcomeDisc = isWelcome ? Number(order.welcomeDiscount) || 0 : 0;
                  const ptsUsed = isWelcome ? 0 : Number(order.pointsUsed) || 0;
                  const ptsDisc = isWelcome ? 0 : Number(order.pointsDiscount) || 0;
                  const ptsEarned = isWelcome ? 0 : Number(order.pointsEarned) || 0;

                  return (
                    <tr key={order.id} className="hover:bg-[#FAF7F2]/50">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#2C2420]">#{order.id}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-[#FAF7F2] border border-[#EAE2D5] text-[#6B5D55]">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#2C2420]">{order.customerName}</p>
                        <p className="font-mono text-[10px] text-[#7A6458]">
                          UID: {order.userId || order.customerEmail || order.customerPhone || 'guest'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {bType === 'welcome_offer' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDEAF0] text-[#70252D] border border-[#FAD1DC]">
                            <Gift className="w-3 h-3" />
                            Welcome Offer (10% OFF)
                          </span>
                        )}
                        {bType === 'nest_points' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Award className="w-3 h-3" />
                            Nest Points
                          </span>
                        )}
                        {bType === 'coupon' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Coupon ({order.couponCode || 'Promo'})
                          </span>
                        )}
                        {bType === 'none' && (
                          <span className="text-[11px] text-[#8C7A70]">Standard (No Discount)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#70252D]">
                        {isWelcome && welcomeDisc > 0
                          ? `-₹${formatRupeeAmount(welcomeDisc)}`
                          : ptsDisc > 0
                          ? `-₹${formatRupeeAmount(ptsDisc)}`
                          : Number(order.couponDiscount) > 0
                          ? `-₹${formatRupeeAmount(Number(order.couponDiscount))}`
                          : '₹0'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[#2C2420]">
                        {ptsUsed > 0 ? `${ptsUsed} pts (-₹${formatRupeeAmount(ptsDisc)})` : '0 pts'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {isWelcome ? (
                          <span className="text-[#7A6458]">0 pts (Welcome Offer)</span>
                        ) : (
                          <span className="text-emerald-800">+{ptsEarned} pts</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#2C2420]">
                        ₹{formatRupeeAmount(Number(order.totalAmount) || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
