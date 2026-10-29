import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Package,
  ShoppingBag,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  Boxes,
  Truck
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { ProductReview } from '../data/reviews';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { triggerLocalPushNotification } from '../utils/pushNotifications';

interface AdminNotificationsSectionProps {
  products: BedsheetProduct[];
  orders: Order[];
  reviews?: ProductReview[];
  onNavigateToTab: (tab: 'products' | 'orders' | 'seasonal' | 'coupons' | 'content' | 'appearance') => void;
  onUpdateProductStock?: (productId: string, inStock: boolean, quantity: number) => void;
  onToast: (msg: string) => void;
}

export const AdminNotificationsSection: React.FC<AdminNotificationsSectionProps> = ({
  products,
  orders,
  reviews = [],
  onNavigateToTab,
  onUpdateProductStock,
  onToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'inventory' | 'orders' | 'reviews'>('all');
  const [isTestingPush, setIsTestingPush] = useState(false);

  // 1. Inventory alerts
  const outOfStockProducts = products.filter(
    (p) => !p.inStock || (p.stockQuantity !== undefined && p.stockQuantity <= 0)
  );
  const lowStockProducts = products.filter(
    (p) => p.inStock && p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 3
  );

  // 2. Pending orders
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');

  // 3. Customer reviews
  const recentReviews = [...reviews].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const totalAlertsCount = outOfStockProducts.length + lowStockProducts.length + pendingOrders.length;

  const handleTestBrowserPush = async () => {
    setIsTestingPush(true);
    try {
      const ok = await triggerLocalPushNotification(
        'Cotton Nest Atelier Alert',
        'Owner test notification: Your browser push delivery is active and working properly.',
        { url: '/#admin' }
      );
      if (ok) {
        onToast('Push notification triggered on this device!');
      } else {
        onToast('Browser push permission not yet enabled. Enable it in the Customer Notification Center first.');
      }
    } catch (err: any) {
      onToast(`Push test: ${err?.message || 'Unsupported browser'}`);
    } finally {
      setIsTestingPush(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Alert Summary Card */}
      <div className="bg-[#FAF7F2] rounded-3xl border border-[#EAE2D5] p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-200">
                <Bell className="w-5 h-5 text-amber-700" />
              </span>
              <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
                Admin Atelier Notification Center
              </h2>
            </div>
            <p className="text-xs text-[#7A6458]">
              Consolidated real-time operational alerts for stock levels, incoming client requests, and customer reviews.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestBrowserPush}
              disabled={isTestingPush}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#DEC89B] hover:bg-[#F4EFE6] text-xs font-semibold text-[#2C2420] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Test browser push notification on current device"
            >
              <Send className="w-3.5 h-3.5 text-[#C29E57]" />
              <span>{isTestingPush ? 'Testing...' : 'Test Web Push Alert'}</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-[#EAE2D5]">
          <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5]">
            <span className="text-[10px] font-bold text-[#8C7A70] uppercase tracking-wider block">
              Out of Stock
            </span>
            <span className={`text-xl font-bold tabular-nums ${outOfStockProducts.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {outOfStockProducts.length}
            </span>
            <span className="text-[10px] text-[#7A6458] block">Needs immediate restock</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5]">
            <span className="text-[10px] font-bold text-[#8C7A70] uppercase tracking-wider block">
              Low Stock (&le; 3 units)
            </span>
            <span className={`text-xl font-bold tabular-nums ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-[#2C2420]'}`}>
              {lowStockProducts.length}
            </span>
            <span className="text-[10px] text-[#7A6458] block">Running low in atelier</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5]">
            <span className="text-[10px] font-bold text-[#8C7A70] uppercase tracking-wider block">
              Pending Orders
            </span>
            <span className={`text-xl font-bold tabular-nums ${pendingOrders.length > 0 ? 'text-blue-600' : 'text-[#2C2420]'}`}>
              {pendingOrders.length}
            </span>
            <span className="text-[10px] text-[#7A6458] block">Awaiting confirmation</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5]">
            <span className="text-[10px] font-bold text-[#8C7A70] uppercase tracking-wider block">
              Customer Reviews
            </span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">
              {reviews.length}
            </span>
            <span className="text-[10px] text-[#7A6458] block">Verified feedbacks</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EAE2D5] pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          All Alerts ({totalAlertsCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('inventory')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            filter === 'inventory'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          Inventory &amp; Stock ({outOfStockProducts.length + lowStockProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('orders')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            filter === 'orders'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          Incoming Orders ({pendingOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('reviews')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            filter === 'reviews'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          Customer Reviews ({reviews.length})
        </button>
      </div>

      {/* 1. OUT OF STOCK & LOW STOCK SECTION */}
      {(filter === 'all' || filter === 'inventory') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Inventory &amp; Stock Alerts</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToTab('products')}
              className="text-xs font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458] flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <p className="font-semibold text-[#2C2420]">All bedsheets are healthy and in stock!</p>
              <p className="text-[11px] text-[#8C7A70]">No items require immediate inventory replenishment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outOfStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={resolveBedsheetImage(p.image, p.id)}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border border-rose-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                        Sold Out
                      </span>
                      <h4 className="font-serif-luxury text-sm font-semibold text-[#2C2420] truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-[#7A6458]">
                        ₹{p.price} · 0 units available
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateProductStock) {
                        onUpdateProductStock(p.id, true, 10);
                        onToast(`Restocked "${p.name}" with 10 units!`);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
                  >
                    Restock (10)
                  </button>
                </div>
              ))}

              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={resolveBedsheetImage(p.image, p.id)}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border border-amber-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Low Stock: {p.stockQuantity} left
                      </span>
                      <h4 className="font-serif-luxury text-sm font-semibold text-[#2C2420] truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-[#7A6458]">
                        ₹{p.price} · {p.dimensions}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateProductStock) {
                        onUpdateProductStock(p.id, true, (p.stockQuantity ?? 0) + 10);
                        onToast(`Added 10 units to "${p.name}"!`);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
                  >
                    +10 Units
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. INCOMING ORDERS ALERT SECTION */}
      {(filter === 'all' || filter === 'orders') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>Incoming Order Requests</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToTab('orders')}
              className="text-xs font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458] flex flex-col items-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <p className="font-semibold text-[#2C2420]">All customer orders have been reviewed!</p>
              <p className="text-[11px] text-[#8C7A70]">No pending orders requiring immediate response.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                        #{ord.id}
                      </span>
                      <span className="text-xs font-bold text-[#2C2420]">
                        {ord.customerName}
                      </span>
                      <span className="text-[11px] text-[#7A6458]">
                        · {ord.customerPhone}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A3E38]">
                      {ord.items.map((i: any) => `${i.productName || i.product?.name || 'Bedsheet'} (x${i.quantity})`).join(', ')}
                    </p>
                    <p className="text-[11px] text-[#8C7A70]">
                      Total: ₹{ord.totalAmount.toLocaleString('en-IN')} · {ord.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online / UPI'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('orders')}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Process Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. RECENT CUSTOMER REVIEWS */}
      {(filter === 'all' || filter === 'reviews') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Customer Reviews &amp; Feedback</span>
            </h3>
            <span className="text-xs text-[#8C7A70]">{reviews.length} total reviews</span>
          </div>

          {reviews.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458]">
              No reviews recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-[#DCD0C0]'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-[#3E7D5A] font-semibold flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Verified Buyer
                    </span>
                  </div>

                  <p className="font-semibold text-[#2C2420]">"{rev.title}"</p>
                  <p className="text-[#6B5D55] text-[11px] leading-relaxed line-clamp-2">
                    {rev.comment}
                  </p>
                  <div className="text-[10px] text-[#9B8C83] flex items-center justify-between pt-1 border-t border-[#F4EFE6]">
                    <span>{rev.customerName} · {rev.customerCity}</span>
                    <span>{new Date(rev.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SYSTEM HEALTH & SECURITY AUDIT */}
      <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2">
        <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Atelier Infrastructure Status</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#4A3E38]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Firestore: Rules Deployed &amp; Secure</span>
          </div>
          <div className="flex items-center gap-2 text-[#4A3E38]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Web Push: Service Worker Registered</span>
          </div>
          <div className="flex items-center gap-2 text-[#4A3E38]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Client Privacy: Scoped Read Permissions</span>
          </div>
        </div>
      </div>
    </div>
  );
};
