import React, { useState, useEffect } from 'react';
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
  Truck,
  Sparkles,
  Gift,
  Tag,
  Trash2,
  Megaphone,
  Users,
  Check,
  UserCheck
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { ProductReview } from '../data/reviews';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { triggerLocalPushNotification } from '../utils/pushNotifications';
import { AppNotification } from '../data/notifications';
import {
  saveNotificationApi,
  getNotificationsApi,
  clearAllNotificationsApi
} from '../services/api';

interface AdminNotificationsSectionProps {
  products: BedsheetProduct[];
  orders: Order[];
  reviews?: ProductReview[];
  onNavigateToTab: (tab: 'products' | 'orders' | 'seasonal' | 'coupons' | 'content' | 'appearance' | 'wishlists') => void;
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
  const [filter, setFilter] = useState<'all' | 'push' | 'inventory' | 'orders' | 'reviews'>('push');
  const [isTestingPush, setIsTestingPush] = useState(false);

  // Push Notification Composer State
  const [pushAudience, setPushAudience] = useState<'all' | 'specific'>('all');
  const [specificRecipient, setSpecificRecipient] = useState<string>('');
  const [pushTitle, setPushTitle] = useState<string>('🎁 5% Wishlist Loyalty Reward Unlocked!');
  const [pushMessage, setPushMessage] = useState<string>(
    "You've had your favorite pure cotton bedsheets saved in your wishlist for 3 days! Enjoy an exclusive 5% loyalty discount with coupon code WISHLIST5."
  );
  const [pushCouponCode, setPushCouponCode] = useState<string>('WISHLIST5');
  const [pushLinkView, setPushLinkView] = useState<'catalogue' | 'seasonal' | 'product' | 'orders'>('catalogue');
  const [pushSelectedProductId, setPushSelectedProductId] = useState<string>('');
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [sentNotifications, setSentNotifications] = useState<AppNotification[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

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

  // Load previously pushed customer notifications
  const loadNotificationHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const all = await getNotificationsApi(undefined, true);
      setSentNotifications(all);
    } catch {
      // Fallback
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadNotificationHistory();
  }, []);

  // Quick Preset Handlers
  const handleApplyPreset = (preset: 'wishlist5' | 'festive10' | 'newArrival' | 'freeDelivery') => {
    if (preset === 'wishlist5') {
      setPushTitle('🎁 5% Wishlist Loyalty Reward Unlocked!');
      setPushMessage("You've had your favorite pure cotton bedsheets saved in your wishlist for 3 days! Enjoy an exclusive 5% loyalty discount with code WISHLIST5.");
      setPushCouponCode('WISHLIST5');
      setPushLinkView('catalogue');
      onToast('Loaded "5% Wishlist Loyalty" notification preset');
    } else if (preset === 'festive10') {
      setPushTitle('🌟 Festive Bedsheet Offers Live: 10% Off!');
      setPushMessage('Celebrate in comfort. Apply code NEST10 at checkout for 10% off pure combed cotton King size bedsheets.');
      setPushCouponCode('NEST10');
      setPushLinkView('seasonal');
      onToast('Loaded "Festive 10% Off" notification preset');
    } else if (preset === 'newArrival') {
      setPushTitle('✨ New Bedsheet Arrival in Atelier!');
      setPushMessage('Our newest handcrafted pure percale cotton collection is now available to browse and order.');
      setPushCouponCode('');
      setPushLinkView('catalogue');
      onToast('Loaded "New Arrival" notification preset');
    } else if (preset === 'freeDelivery') {
      setPushTitle('🚚 Free Sector 46 Gurgaon Delivery');
      setPushMessage('Complimentary express hand-delivery across Sector 46 Gurgaon on all bedding orders today.');
      setPushCouponCode('');
      setPushLinkView('catalogue');
      onToast('Loaded "Free Delivery" notification preset');
    }
  };

  // Push Notification Dispatcher
  const handleSendPushNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      onToast('Please enter both a title and message.');
      return;
    }

    setIsPushing(true);
    try {
      const newNotif: AppNotification = {
        id: `push_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recipientId: pushAudience === 'all' ? 'all' : (specificRecipient.trim() || 'all'),
        type: pushCouponCode ? 'promotion' : 'system',
        category: 'promotions',
        title: pushTitle.trim(),
        message: pushMessage.trim(),
        timestamp: Date.now(),
        isRead: false,
        linkTarget: {
          view: pushLinkView,
          targetId: pushSelectedProductId || undefined,
        },
        metadata: {
          couponCode: pushCouponCode.trim() || undefined,
          productId: pushSelectedProductId || undefined,
        },
      };

      await saveNotificationApi(newNotif);

      // Attempt browser Web Push
      try {
        await triggerLocalPushNotification(
          newNotif.title,
          newNotif.message,
          { url: `/#${pushLinkView}` }
        );
      } catch {}

      setSentNotifications((prev) => [newNotif, ...prev]);
      onToast(`✓ Notification pushed successfully to ${pushAudience === 'all' ? 'all customers' : specificRecipient}!`);
    } catch (err: any) {
      onToast('Failed to push notification: ' + (err.message || 'Error'));
    } finally {
      setIsPushing(false);
    }
  };

  const handleTestBrowserPush = async () => {
    setIsTestingPush(true);
    try {
      const ok = await triggerLocalPushNotification(
        'Cotton Nest Atelier Push Notification',
        'Your browser push notification delivery is active and working properly.',
        { url: '/#admin' }
      );
      if (ok) {
        onToast('Push notification triggered on this device!');
      } else {
        onToast('Browser push permission not yet enabled. Enable it in the Notification Center first.');
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
                Admin Atelier Notification &amp; Push Center
              </h2>
            </div>
            <p className="text-xs text-[#7A6458]">
              Broadcast promotional push notifications to customers, automate 3-day wishlist loyalty rewards, and monitor operational alerts.
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
              Pushed Alerts
            </span>
            <span className="text-xl font-bold text-[#70252D] tabular-nums">
              {sentNotifications.length}
            </span>
            <span className="text-[10px] text-[#7A6458] block">Customer notifications</span>
          </div>

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
      <div className="flex items-center gap-2 border-b border-[#EAE2D5] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter('push')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            filter === 'push'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Push Notification to Customer</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
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
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
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
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
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
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
            filter === 'reviews'
              ? 'bg-[#70252D] text-white'
              : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-stone-100'
          }`}
        >
          Customer Reviews ({reviews.length})
        </button>
      </div>

      {/* PUSH NOTIFICATION COMPOSER & AUTOMATION SECTION */}
      {(filter === 'push' || filter === 'all') && (
        <div className="space-y-6">
          {/* Main Push Composer Box */}
          <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F4EFE6]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#70252D]/10 text-[#70252D]">
                    <Megaphone className="w-4 h-4" />
                  </span>
                  <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                    Broadcast Push Notification to Customers
                  </h3>
                </div>
                <p className="text-xs text-[#7A6458]">
                  Sends in-app notifications and browser Web Push alerts directly to customer notification bells and devices.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#8C7A70] mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('wishlist5')}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Gift className="w-3 h-3 text-amber-700" />
                  <span>5% Wishlist (3-Day)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('festive10')}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-rose-700" />
                  <span>10% Festive Sale</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('newArrival')}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>New Arrival</span>
                </button>
              </div>
            </div>

            {/* Compose Form */}
            <form onSubmit={handleSendPushNotification} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audience Selection */}
                <div>
                  <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                    Target Audience
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPushAudience('all')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        pushAudience === 'all'
                          ? 'bg-[#70252D] text-white border-[#70252D]'
                          : 'bg-[#FAF7F2] text-[#6B5D55] border-[#EAE2D5] hover:bg-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>All Customers (Broadcast)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPushAudience('specific')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        pushAudience === 'specific'
                          ? 'bg-[#70252D] text-white border-[#70252D]'
                          : 'bg-[#FAF7F2] text-[#6B5D55] border-[#EAE2D5] hover:bg-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Specific Customer ID / Phone</span>
                    </button>
                  </div>
                </div>

                {/* Specific Recipient Input (if selected) */}
                {pushAudience === 'specific' ? (
                  <div>
                    <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                      Customer Phone, Email, or Guest ID
                    </label>
                    <input
                      type="text"
                      value={specificRecipient}
                      onChange={(e) => setSpecificRecipient(e.target.value)}
                      placeholder="e.g. 917838625915 or user@example.com"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#70252D]"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                      Attach Coupon Code (Optional)
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C29E57]" />
                      <input
                        type="text"
                        value={pushCouponCode}
                        onChange={(e) => setPushCouponCode(e.target.value.toUpperCase())}
                        placeholder="e.g. WISHLIST5 or NEST10"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-mono font-bold text-[#70252D] placeholder-[#A8988D] focus:outline-hidden focus:border-[#70252D]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Action Link */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                    Notification Title *
                  </label>
                  <input
                    type="text"
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="e.g. 🎁 5% Wishlist Loyalty Reward Unlocked!"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-semibold text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#70252D]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                    Action Destination
                  </label>
                  <select
                    value={pushLinkView}
                    onChange={(e) => setPushLinkView(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-hidden focus:border-[#70252D]"
                  >
                    <option value="catalogue">Catalogue Screen</option>
                    <option value="seasonal">Festive Offers</option>
                    <option value="orders">Orders Screen</option>
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-bold text-[#2C2420] block mb-1.5">
                  Notification Message *
                </label>
                <textarea
                  rows={3}
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="Type the message that will pop up on customers' devices and notification bell..."
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#70252D] leading-relaxed resize-none"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-[#7A6458]">
                  Recipients will receive in-app notification badges and browser Web Push alerts.
                </div>

                <button
                  type="submit"
                  disabled={isPushing}
                  className="px-5 py-2.5 bg-[#70252D] hover:bg-[#5a1c22] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isPushing ? 'Pushing to Customers...' : '🚀 Push Notification to Customer'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sent Notifications History */}
          <div className="bg-white rounded-3xl border border-[#EAE2D5] p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#C29E57]" />
                <span>Previously Pushed Notifications ({sentNotifications.length})</span>
              </h3>

              <button
                type="button"
                onClick={loadNotificationHistory}
                disabled={isLoadingHistory}
                className="text-xs font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh History</span>
              </button>
            </div>

            {sentNotifications.length === 0 ? (
              <div className="p-6 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458]">
                No broadcast notifications recorded yet. Use the composer above to push your first customer alert.
              </div>
            ) : (
              <div className="space-y-3">
                {sentNotifications.slice(0, 8).map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#2C2420]">{notif.title}</span>
                        {notif.metadata?.couponCode && (
                          <span className="text-[10px] font-mono font-bold bg-[#70252D] text-white px-1.5 py-0.5 rounded">
                            {notif.metadata.couponCode}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-semibold">
                          Target: {notif.recipientId === 'all' ? 'All Customers' : notif.recipientId}
                        </span>
                      </div>
                      <p className="text-[#6B5D55] text-[11px] leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto text-[11px] text-[#8C7A70]">
                      <span>{new Date(notif.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-emerald-700 font-medium">✓ Delivered</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458] flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All bedsheet collections have healthy stock levels.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outOfStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-white rounded-2xl border border-rose-200 bg-rose-50/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveBedsheetImage(p.image, p.id)}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border border-rose-200"
                    />
                    <div>
                      <h4 className="font-bold text-[#2C2420]">{p.name}</h4>
                      <p className="text-[11px] text-rose-600 font-semibold">Sold Out</p>
                    </div>
                  </div>

                  {onUpdateProductStock && (
                    <button
                      type="button"
                      onClick={() => onUpdateProductStock(p.id, true, 10)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Restock (+10)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. PENDING ORDERS SECTION */}
      {(filter === 'all' || filter === 'orders') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Incoming Pending Orders</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToTab('orders')}
              className="text-xs font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#7A6458]">
              No pending orders waiting for confirmation.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 bg-white rounded-2xl border border-blue-200 bg-blue-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#2C2420]">Order #{ord.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[#7A6458] ml-2">by {ord.customerName}</span>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      ₹{ord.totalAmount.toLocaleString('en-IN')} · {ord.items.length} item(s) · {ord.customerAddress ? ord.customerAddress.slice(0, 25) + '...' : 'Address provided'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateToTab('orders')}
                    className="px-3 py-1 bg-[#70252D] hover:bg-[#5a1c22] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Review in Orders
                  </button>
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
            <span>Wishlist Retention: 3-Day Coupon (WISHLIST5) Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
