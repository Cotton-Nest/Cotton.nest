import React, { useState } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  ShoppingBag,
  Tag,
  Package,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  ChevronRight,
  Layers
} from 'lucide-react';
import { AppNotification, NotificationPreferences } from '../data/notifications';
import {
  isPushNotificationSupported,
  getPushPermissionStatus,
  requestWebPushPermission,
  disableWebPush,
  saveStoredNotificationPreferences,
  triggerLocalPushNotification,
} from '../utils/pushNotifications';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  preferences: NotificationPreferences;
  onUpdatePreferences: (prefs: NotificationPreferences) => void;
  onNavigate: (view: 'orders' | 'catalogue' | 'seasonal' | 'product', targetId?: string) => void;
  customerIdentifier?: string;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  preferences,
  onUpdatePreferences,
  onNavigate,
  customerIdentifier = 'Valued Customer',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'promotions' | 'stock'>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>(() => getPushPermissionStatus());
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter notifications according to active tab and preferences
  const filteredNotifications = notifications.filter((n) => {
    // If user turned off promotional offers, hide them
    if (n.category === 'promotions' && !preferences.promotionalOffers) return false;
    // If user turned off stock alerts, hide them
    if (n.category === 'stock' && !preferences.stockAlerts) return false;

    if (activeTab === 'all') return true;
    if (activeTab === 'orders') return n.category === 'orders';
    if (activeTab === 'promotions') return n.category === 'promotions';
    if (activeTab === 'stock') return n.category === 'stock';
    return true;
  });

  const unreadCount = filteredNotifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    if (item.linkTarget) {
      onClose();
      if (item.linkTarget.view === 'product' && item.linkTarget.targetId) {
        onNavigate('product', item.linkTarget.targetId);
      } else if (item.linkTarget.view === 'orders') {
        onNavigate('orders', item.linkTarget.targetId);
      } else if (item.linkTarget.view === 'seasonal') {
        onNavigate('seasonal');
      } else {
        onNavigate('catalogue');
      }
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushMessage(null);

    if (preferences.pushEnabled) {
      await disableWebPush();
      const updated = { ...preferences, pushEnabled: false };
      onUpdatePreferences(updated);
      saveStoredNotificationPreferences(updated);
      setPushStatus(getPushPermissionStatus());
      setPushMessage('Browser push notifications disabled.');
    } else {
      const result = await requestWebPushPermission(customerIdentifier);
      setPushStatus(result.status);
      if (result.granted) {
        const updated = { ...preferences, pushEnabled: true };
        onUpdatePreferences(updated);
        saveStoredNotificationPreferences(updated);
        setPushMessage('✓ Browser push notifications enabled successfully!');
      } else {
        if (result.status === 'denied') {
          setPushMessage('⚠️ Notifications are blocked in browser settings. Please allow notifications for this site in your address bar.');
        } else {
          setPushMessage(result.error || 'Push notifications could not be enabled.');
        }
      }
    }
    setPushLoading(false);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        data-testid="notification-center-modal"
        className="relative bg-[#FAF7F2] w-full max-w-lg rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden flex flex-col max-h-[88vh]"
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#EAE2D5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative p-2 rounded-xl bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] shrink-0">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#8C2E46] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-2xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury font-bold text-lg text-[#2C2420] leading-tight">
                  Notification Center
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#7A6458]">
                Atelier updates, order dispatches, and complaint responses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreferences(!showPreferences)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showPreferences
                  ? 'bg-[#70252D] text-white border-[#70252D]'
                  : 'bg-white hover:bg-[#FAF7F2] text-[#6B5D55] border-[#EAE2D5]'
              }`}
              title="Notification preferences"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              data-testid="close-notification-center-btn"
              className="p-2 text-[#7A6458] hover:text-[#2C2420] rounded-xl hover:bg-[#FAF7F2] transition-colors cursor-pointer border border-[#EAE2D5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preferences Drawer View */}
        {showPreferences ? (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE2D5]">
              <div>
                <h4 className="font-serif-luxury font-bold text-sm text-[#2C2420]">
                  Notification Preferences
                </h4>
                <p className="text-[11px] text-[#7A6458]">
                  Manage what notifications you receive from Cotton Nest
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="text-xs font-semibold text-[#8C2E46] hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Preference Item: Essential Order Updates */}
            <div className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-700" />
                  Order &amp; Return/Exchange Updates
                </span>
                <p className="text-[11px] text-[#7A6458] leading-tight">
                  Receipt, verification, courier dispatch tracking, delivery, and complaint responses.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                Essential (Always On)
              </span>
            </div>

            {/* Preference Item: Promotional & Coupon Offers */}
            <label className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF7F2] transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#A8823B]" />
                  Offers &amp; Coupon Announcements
                </span>
                <p className="text-[11px] text-[#7A6458] leading-tight">
                  Early access to festive promo codes, seasonal bundle savings, and new arrivals.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.promotionalOffers}
                onChange={(e) => {
                  const updated = { ...preferences, promotionalOffers: e.target.checked };
                  onUpdatePreferences(updated);
                  saveStoredNotificationPreferences(updated);
                }}
                className="w-4 h-4 text-[#8C2E46] accent-[#8C2E46] rounded cursor-pointer shrink-0"
              />
            </label>

            {/* Preference Item: Back-in-Stock Alerts */}
            <label className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF7F2] transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#B83F60]" />
                  Back-in-Stock Alerts
                </span>
                <p className="text-[11px] text-[#7A6458] leading-tight">
                  Instant notifications when sold-out bedsheets you subscribed to are replenished.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.stockAlerts}
                onChange={(e) => {
                  const updated = { ...preferences, stockAlerts: e.target.checked };
                  onUpdatePreferences(updated);
                  saveStoredNotificationPreferences(updated);
                }}
                className="w-4 h-4 text-[#8C2E46] accent-[#8C2E46] rounded cursor-pointer shrink-0"
              />
            </label>

            {/* Browser Web Push Notifications Section */}
            <div className="p-4 bg-white rounded-2xl border border-[#DEC89B] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                    Browser Web Push Notifications
                  </span>
                  <p className="text-[11px] text-[#7A6458] leading-tight">
                    Receive alerts on your phone or desktop even when the website tab is in background.
                  </p>
                </div>
                <div className="shrink-0">
                  {pushStatus === 'granted' && preferences.pushEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                      ✓ Active
                    </span>
                  ) : pushStatus === 'denied' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800">
                      Blocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-stone-100 text-stone-700">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {isPushNotificationSupported() ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={handleTogglePush}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs ${
                      preferences.pushEnabled
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                        : 'bg-[#70252D] hover:bg-[#5b1e24] text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>
                      {pushLoading
                        ? 'Updating...'
                        : preferences.pushEnabled
                        ? 'Turn Off Device Notification Bar Alerts'
                        : 'Enable Device Notification Bar Alerts'}
                    </span>
                  </button>

                  {pushStatus === 'granted' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await triggerLocalPushNotification(
                          'Cotton Nest Atelier',
                          '✓ Test Alert: Your device notification bar is connected to Cotton Nest!',
                          { url: '/#orders', tag: `test-${Date.now()}` }
                        );
                        setPushMessage(
                          ok
                            ? '✓ Sent! Check the notification bar at the top of your device.'
                            : '⚠️ Could not show notification. Check if Do Not Disturb or OS browser notifications are muted.'
                        );
                      }}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#FAF7F2] hover:bg-[#F3ECE1] text-[#8C2E46] border border-[#DEC89B] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>Send Test Notification to Device Bar</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>This browser does not support background Web Push notifications. In-app alerts will continue to work normally.</span>
                </div>
              )}

              {pushMessage && (
                <p className="text-[11px] text-[#70252D] font-medium leading-relaxed bg-[#FAF7F2] p-2 rounded-lg border border-[#EAE2D5]">
                  {pushMessage}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Top Banner to Enable Device Notification Bar Alerts if not yet granted */}
            {isPushNotificationSupported() && pushStatus !== 'granted' && (
              <div className="mx-4 mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#8C2E46] to-[#6E2236] text-white flex items-center justify-between gap-3 shadow-xs">
                <div className="min-w-0">
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#E6CA65] shrink-0" />
                    <span>Get Alerts in Your Device Notification Bar</span>
                  </p>
                  <p className="text-[11px] text-white/85 mt-0.5 leading-snug">
                    Allow browser notifications so order confirmations &amp; dispatches pop up on your phone or desktop bar.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pushLoading}
                  onClick={handleTogglePush}
                  className="px-3 py-1.5 bg-[#E6CA65] hover:bg-[#d9bc55] text-[#2C2420] font-bold text-xs rounded-xl shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  {pushLoading ? 'Enabling...' : 'Allow Now'}
                </button>
              </div>
            )}

            {isPushNotificationSupported() && pushStatus === 'granted' && (
              <div className="mx-4 mt-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                <span className="font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Device Notification Bar Active</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerLocalPushNotification(
                      'Cotton Nest Atelier',
                      '✓ Live Order & Offer notifications are active on your device bar!',
                      { url: '/#orders', tag: `test-${Date.now()}` }
                    );
                  }}
                  className="font-bold text-[#8C2E46] hover:underline cursor-pointer shrink-0"
                >
                  Test Device Bar
                </button>
              </div>
            )}

            {/* Category Tabs & Quick Action Bar */}
            <div className="px-4 py-2.5 bg-white/70 border-b border-[#EAE2D5] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'orders', label: 'Orders & Support' },
                    { id: 'promotions', label: 'Offers' },
                    { id: 'stock', label: 'In-Stock' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    data-testid={`notification-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-[#70252D] text-white shadow-2xs'
                        : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="text-[11px] font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                {filteredNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-[11px] font-medium text-stone-400 hover:text-stone-700 flex items-center gap-1 cursor-pointer"
                    title="Clear notification list"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5" data-testid="notification-items-list">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-white border border-[#DEC89B] flex items-center justify-center mx-auto text-[#A8823B] shadow-2xs">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-serif-luxury font-bold text-base text-[#2C2420]">
                      All caught up!
                    </p>
                    <p className="text-xs text-[#7A6458] mt-1 max-w-xs mx-auto">
                      No notifications right now. Order updates, complaint responses, exclusive coupons, and restock alerts will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                filteredNotifications.map((item, nIdx) => {
                  let icon = <Bell className="w-4 h-4 text-[#A8823B]" />;
                  let badgeBg = 'bg-[#FAF7F2] border-[#DEC89B] text-[#70252D]';

                  if (item.type === 'complaint_update' || item.type === 'admin_complaint') {
                    icon = <ShieldCheck className="w-4 h-4 text-[#8C2E46]" />;
                    badgeBg = 'bg-[#FDEAF0] border-[#FAD1DC] text-[#8C2E46]';
                  } else if (item.category === 'orders') {
                    icon = <Package className="w-4 h-4 text-emerald-700" />;
                    badgeBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                  } else if (item.category === 'promotions') {
                    icon = <Tag className="w-4 h-4 text-[#A8823B]" />;
                    badgeBg = 'bg-amber-50 border-amber-200 text-amber-800';
                  } else if (item.category === 'stock') {
                    icon = <Sparkles className="w-4 h-4 text-[#B83F60]" />;
                    badgeBg = 'bg-[#FDEAF0] border-[#FAD1DC] text-[#8C2E46]';
                  }

                  return (
                    <div
                      key={item.id ? `notif-${item.id}-${nIdx}` : `notif-${nIdx}`}
                      data-testid={`notification-item-${item.id}`}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative group ${
                        item.isRead
                          ? 'bg-white/70 border-[#EAE2D5] hover:bg-white'
                          : 'bg-white border-[#DEC89B] shadow-xs hover:shadow-md ring-1 ring-[#DEC89B]/30'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`p-2 rounded-xl border shrink-0 ${badgeBg}`}>
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={`text-xs font-bold truncate ${item.isRead ? 'text-[#2C2420]' : 'text-[#70252D]'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-[#A8988D] shrink-0 font-medium">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B5D55] leading-relaxed line-clamp-3">
                          {item.message}
                        </p>

                        {/* Metadata Tag / Action Link */}
                        <div className="mt-2 flex items-center justify-between flex-wrap gap-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.metadata?.complaintId && (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B]">
                                #{item.metadata.complaintId}
                              </span>
                            )}
                            {item.metadata?.complaintStatus && (
                              <span className="inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                {item.metadata.complaintStatus}
                              </span>
                            )}
                            {item.metadata?.couponCode ? (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B]">
                                Code: {item.metadata.couponCode}
                              </span>
                            ) : item.metadata?.orderId ? (
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-[10px] text-emerald-800">
                                Order #{item.metadata.orderId}
                              </span>
                            ) : null}
                          </div>

                          {item.linkTarget && (
                            <span className="text-[#8C2E46] group-hover:underline font-semibold flex items-center gap-0.5 text-[10px]">
                              <span>View details</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unread indicator dot */}
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#8C2E46] shrink-0 mt-1 animate-pulse" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
};
