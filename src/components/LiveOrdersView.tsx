import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  MapPin, 
  MessageCircle, 
  ExternalLink, 
  Search, 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  ShoppingBag, 
  User, 
  LogOut,
  Calendar,
  CreditCard,
  Phone,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Mail
} from 'lucide-react';
import { Order, OrderStatus } from '../data/orders';
import { COMPANY_DETAILS } from '../data/products';
import { useAuth } from '../context/AuthContext';
import { getOrders } from '../services/api';
import { normalizePhoneDigits } from '../data/complaints';
import { OrderComplaintSection } from './OrderComplaintSection';
import { InvoiceModal, buildOrderGmailUrl } from './InvoiceModal';

interface LiveOrdersViewProps {
  onExploreCatalogue: () => void;
  onOpenAuthModal: () => void;
  onOpenGoogleChooser?: () => void;
}

export const LiveOrdersView: React.FC<LiveOrdersViewProps> = ({
  onExploreCatalogue,
  onOpenAuthModal,
}) => {
  const { user, isAuthenticated, logout, loginWithGoogle } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);
  selectedOrderIdRef.current = selectedOrderId;

  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [isSearchingDirect, setIsSearchingDirect] = useState<boolean>(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);
  const [emailSendFeedback, setEmailSendFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<string | null>(null);

  const handleConfirmOrder = async (order: Order) => {
    setIsConfirmingOrder(order.id);
    setEmailSendFeedback(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      const data = await res.json();
      if (data && data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: 'confirmed' as const, invoiceSent: true } : o
          )
        );
        if (searchedOrder && searchedOrder.id === order.id) {
          setSearchedOrder({ ...searchedOrder, status: 'confirmed', invoiceSent: true });
        }
        setEmailSendFeedback({
          id: order.id,
          success: true,
          message: '✓ Order confirmed & official sale invoice dispatched from adityaa.22082011@gmail.com!',
        });
      } else {
        setEmailSendFeedback({
          id: order.id,
          success: false,
          message: data?.error || 'Could not confirm order.',
        });
      }
    } catch (err: any) {
      setEmailSendFeedback({
        id: order.id,
        success: false,
        message: 'Network error confirming order.',
      });
    } finally {
      setIsConfirmingOrder(null);
    }
  };

  // Handle user explicitly clicking an order to view its details
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    selectedOrderIdRef.current = orderId;
    setSearchedOrder(null);

    // On mobile devices, smoothly scroll down to the active order tracker details
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        const el = document.getElementById('live-order-details-card');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  const handleSendOrderEmail = async (order: Order) => {
    setIsSendingEmail(order.id);
    setEmailSendFeedback(null);
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          shippingMethod: order.shippingCost ? 'Standard Delivery' : 'Sector 46 Complimentary',
          subtotal: Number(order.totalAmount) || 0,
          couponCode: order.couponCode,
          couponDiscount: Number(order.couponDiscount) || 0,
          pointsUsed: Number(order.pointsUsed) || 0,
          pointsDiscount: Number(order.pointsDiscount) || 0,
          shippingCost: Number(order.shippingCost) || 0,
          finalTotal: Number(order.totalAmount) || 0,
          items: (order.items || []).map((it) => ({
            name: it.productName,
            variantName: it.variantName,
            dimensions: it.dimensions || '108 x 108 inches',
            quantity: Number(it.quantity) || 1,
            price: Number(it.price) || 0,
            imageUrl: it.productImage || '',
          })),
          createdAt: order.createdAt,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setEmailSendFeedback({
          id: order.id,
          success: true,
          message: data.sentViaSmtp
            ? `Receipt delivered via Gmail SMTP to ${data.recipients?.join(', ') || 'customer and admin'}.`
            : `Invoice generated successfully. Use "Open in Gmail" button to dispatch.`,
        });
      } else {
        setEmailSendFeedback({
          id: order.id,
          success: false,
          message: data.error || 'Failed to dispatch email. Please use the Gmail compose link.',
        });
      }
    } catch (err: any) {
      setEmailSendFeedback({
        id: order.id,
        success: false,
        message: err.message || 'Network error while sending email.',
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  // Fetch orders for current authenticated user
  const fetchUserOrders = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    setIsAutoSyncing(true);

    try {
      let url = '/api/orders';
      const params = new URLSearchParams();

      if (user?.email) params.append('email', user.email);
      if (user?.phone) params.append('phone', user.phone);
      if (user?.id) params.append('userId', user.id);

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const res = await fetch(url);
      let serverOrders: Order[] = [];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) serverOrders = data;
      }

      // Also merge matching orders from Firestore/local cache so orders are never missed
      const allKnown = await getOrders().catch(() => [] as Order[]);
      const cleanEmail = user?.email ? user.email.trim().toLowerCase() : '';
      const cleanPhone = normalizePhoneDigits(user?.phone);
      const cleanUserId = user?.id ? user.id.trim() : '';

      const matchingFirestoreOrders = allKnown.filter((o) => {
        if (!cleanEmail && !cleanPhone && !cleanUserId) return false;
        const oEmail = o.customerEmail ? o.customerEmail.trim().toLowerCase() : '';
        const oPhone = normalizePhoneDigits(o.customerPhone);
        const oUserId = o.userId ? o.userId.trim() : '';
        return (
          Boolean(cleanEmail && oEmail && oEmail === cleanEmail) ||
          Boolean(cleanPhone && oPhone && oPhone === cleanPhone) ||
          Boolean(cleanUserId && oUserId && oUserId === cleanUserId)
        );
      });

      const mergedMap = new Map<string, Order>();
      [...serverOrders, ...matchingFirestoreOrders].forEach((o) => {
        if (o && o.id) mergedMap.set(o.id, o);
      });
      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setOrders(mergedList);
      setLastSyncedTime(new Date());

      // Pin and preserve the customer's selected order; do NOT reset to mergedList[0].id on background sync
      setSelectedOrderId((prevSelected) => {
        const currentTarget = prevSelected || selectedOrderIdRef.current;
        if (currentTarget && mergedList.some((o) => o.id === currentTarget)) {
          return currentTarget;
        }
        return mergedList.length > 0 ? mergedList[0].id : null;
      });
    } catch (err) {
      console.warn('Could not fetch user live orders:', err);
    } finally {
      if (!silent) setIsLoading(false);
      setIsAutoSyncing(false);
    }
  };

  // Initial fetch and automatic live sync interval every 4 seconds
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserOrders(false);

      const interval = setInterval(() => {
        fetchUserOrders(true);
      }, 4000);

      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
      setOrders([]);
    }
  }, [user?.email, user?.phone, isAuthenticated]);

  // Handle direct manual Order ID search (for guests or quick tracking)
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderId.trim()) return;

    setIsSearchingDirect(true);
    setSearchError('');
    setSearchedOrder(null);

    try {
      const targetId = manualOrderId.trim();
      const res = await fetch(`/api/orders?orderId=${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSearchedOrder(data[0]);
          setSelectedOrderId(data[0].id);
          return;
        }
      }
      const allKnown = await getOrders().catch(() => [] as Order[]);
      const found = allKnown.find((o) => o.id?.toLowerCase() === targetId.toLowerCase());
      if (found) {
        setSearchedOrder(found);
        setSelectedOrderId(found.id);
      } else {
        setSearchError(`No order found matching "${manualOrderId}". Please check your order ID.`);
      }
    } catch {
      setSearchError('Network error while searching for order.');
    } finally {
      setIsSearchingDirect(false);
    }
  };

  // Filtered orders list
  const activeOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'dispatched'
  );
  const completedOrders = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled'
  );

  const displayedOrders =
    filterTab === 'active'
      ? activeOrders
      : filterTab === 'completed'
      ? completedOrders
      : orders;

  const currentSelectedOrder =
    searchedOrder ||
    orders.find((o) => o.id === selectedOrderId) ||
    displayedOrders[0] ||
    null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
            Order Confirmation Pending
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Order Confirmed
          </span>
        );
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200">
            <Truck className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
            Dispatched · In Transit
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered Successfully
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-200 text-neutral-800">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getStepProgressNumber = (status: OrderStatus): number => {
    switch (status) {
      case 'pending':
        return 1;
      case 'confirmed':
        return 2;
      case 'dispatched':
        return 3;
      case 'delivered':
        return 4;
      case 'cancelled':
        return 0;
      default:
        return 1;
    }
  };

  const currentStep = currentSelectedOrder
    ? getStepProgressNumber(currentSelectedOrder.status)
    : 0;

  // Open WhatsApp support with specific order context
  const handleContactAtelierForOrder = (order: Order) => {
    const message = [
      `*ORDER INQUIRY - COTTON NEST* 🪷`,
      `Order Ref: #${order.id}`,
      `Customer: ${order.customerName}`,
      `Status: ${order.status.toUpperCase()}`,
      ``,
      `Hello Cotton Nest! I would like an update regarding my order #${order.id}.`,
    ].join('\n');

    const waUrl = COMPANY_DETAILS.whatsappUrl(message);
    window.open(waUrl, '_blank');
  };

  // Helper to normalize image paths so images always render correctly
  const fixImagePath = (src: string) => {
    if (!src) return '/images/exact_sheet1_pink_rose_1790997736396.jpg';
    if (src.startsWith('/src/assets/images/')) {
      return src.replace('/src/assets/images/', '/images/');
    }
    return src;
  };

  return (
    <div
      className="min-h-screen pb-24 transition-colors duration-300"
      style={{
        backgroundColor: 'var(--color-background, #FAF7F2)',
        color: 'var(--color-text, #2C2420)',
      }}
    >
      
      {/* Editorial Header Banner */}
      <section
        className="border-b pt-8 pb-10 px-4 sm:px-6 lg:px-8"
        style={{
          borderColor: 'var(--color-border, #EAE2D5)',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-accent, #A8823B)' }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
              <span>Live Atelier Orders & Dispatch Tracking</span>
            </div>
            <h1
              className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight"
              style={{ color: 'var(--color-text, #2C2420)' }}
            >
              My Bedsheet Orders
            </h1>
            <p
              className="text-sm sm:text-base max-w-xl"
              style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
            >
              Track live quality verification, packaging at our Sector 46 Gurgaon Atelier, and express dispatch right to your doorstep.
            </p>
          </div>

          {/* User Account / Auth Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-[#DEC89B] shadow-xs">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#DEC89B]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#2C2420] text-[#DEC89B] flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs font-bold text-[#2C2420] leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-[#7A6458] truncate max-w-[160px]">
                    {user.email || user.phone}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 text-[#7A6458] hover:text-[#B83F60] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                  } catch {
                    onOpenAuthModal();
                  }
                }}
                className="px-5 py-3 bg-[#2C2420] hover:bg-[#3D332D] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                {/* Google Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In with Google</span>
              </button>
            )}

            {isAuthenticated && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[#7A6458] bg-[#EAE2D5]/40 px-3 py-2 rounded-xl">
                <span className={`w-2 h-2 rounded-full ${isAutoSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span>Live Admin Sync Active</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* NOT LOGGED IN GUEST VIEW */}
        {!isAuthenticated && !searchedOrder && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#DEC89B] p-8 sm:p-10 shadow-lg text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF7F2] border border-[#DEC89B] flex items-center justify-center text-[#B83F60]">
              <Package className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420]">
                Sign In to View Your Orders
              </h2>
              <p className="text-sm text-[#7A6458] max-w-md mx-auto">
                Each client's orders are kept strictly private. Sign in with your Google account to view real-time status and delivery updates synced from our atelier.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                  } catch {
                    onOpenAuthModal();
                  }
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#B83F60] hover:bg-[#A33452] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {/* Google Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                onClick={onExploreCatalogue}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#EAE2D5] font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Browse Bedsheets
              </button>
            </div>

            {/* Quick Guest Order Lookup Box */}
            <div className="pt-6 border-t border-[#EAE2D5]">
              <p className="text-xs font-semibold text-[#7A6458] uppercase tracking-wider mb-3">
                Or Track a Specific Order with Reference ID
              </p>
              <form onSubmit={handleManualSearch} className="flex gap-2 max-w-md mx-auto">
                <input
                  type="text"
                  value={manualOrderId}
                  onChange={(e) => setManualOrderId(e.target.value)}
                  placeholder="e.g. CN-920415 or CN-783921"
                  className="grow px-4 py-2.5 rounded-xl border border-[#DEC89B] bg-[#FAF7F2] text-xs font-mono uppercase text-[#2C2420] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57]"
                />
                <button
                  type="submit"
                  disabled={isSearchingDirect}
                  className="px-5 py-2.5 bg-[#2C2420] hover:bg-[#3D332D] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  {isSearchingDirect ? 'Searching...' : 'Track'}
                </button>
              </form>
              {searchError && (
                <p className="text-xs text-rose-600 mt-2 font-medium">
                  {searchError}
                </p>
              )}
            </div>

            {/* Privacy Promise */}
            <div className="inline-flex items-center gap-2 text-xs text-[#7A6458]">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero-leak privacy: only orders associated with your account are visible to you.</span>
            </div>
          </div>
        )}

        {/* LOGGED IN VIEW OR GUEST WITH FOUND ORDER */}
        {(isAuthenticated || searchedOrder) && (
          <div className="space-y-6">

            {/* If searched order mode, banner with clear button */}
            {searchedOrder && !isAuthenticated && (
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Showing results for Order <strong>#{searchedOrder.id}</strong></span>
                </div>
                <button
                  onClick={() => setSearchedOrder(null)}
                  className="font-semibold text-emerald-800 hover:underline cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* Order Filter Tabs */}
            {isAuthenticated && orders.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAE2D5] pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterTab('active')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'active'
                        ? 'bg-[#2C2420] text-[#DEC89B]'
                        : 'bg-white text-[#7A6458] hover:text-[#2C2420] border border-[#EAE2D5]'
                    }`}
                  >
                    Active Orders ({activeOrders.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('completed')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'completed'
                        ? 'bg-[#2C2420] text-[#DEC89B]'
                        : 'bg-white text-[#7A6458] hover:text-[#2C2420] border border-[#EAE2D5]'
                    }`}
                  >
                    Delivered / Past ({completedOrders.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-[#2C2420] text-[#DEC89B]'
                        : 'bg-white text-[#7A6458] hover:text-[#2C2420] border border-[#EAE2D5]'
                    }`}
                  >
                    All ({orders.length})
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#7A6458]">
                  <span>Last live update: {lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <button
                    onClick={() => fetchUserOrders(false)}
                    title="Refresh Now"
                    className="p-1 hover:text-[#2C2420] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}

            {/* EMPTY STATE FOR AUTHENTICATED USER */}
            {isAuthenticated && orders.length === 0 && !isLoading && (
              <div className="bg-white rounded-3xl border border-[#DEC89B] p-12 text-center space-y-4 max-w-xl mx-auto shadow-xs">
                <ShoppingBag className="w-12 h-12 text-[#C29E57] mx-auto" />
                <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                  No Orders Found Yet
                </h3>
                <p className="text-xs text-[#7A6458] leading-relaxed">
                  You haven't placed any orders with this account ({user?.email || user?.phone}) yet.
                  When you order via WhatsApp or checkout, your live status will appear here immediately.
                </p>
                <div className="pt-2">
                  <button
                    onClick={onExploreCatalogue}
                    className="px-6 py-3 bg-[#B83F60] hover:bg-[#A33452] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Explore Bedsheets Catalogue
                  </button>
                </div>
              </div>
            )}

            {/* MAIN DASHBOARD */}
            {currentSelectedOrder && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Mobile Order Switcher Ribbon (clean horizontal scrolling pills on phones) */}
                {orders.length > 1 && (
                  <div className="lg:hidden col-span-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#7A6458] uppercase tracking-wider">
                        My Orders ({displayedOrders.length})
                      </p>
                      <span className="text-[10px] text-[#8C2E46] font-semibold">Tap to switch order</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {displayedOrders.map((order) => {
                        const isSelected = order.id === currentSelectedOrder.id;
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => handleSelectOrder(order.id)}
                            className={`shrink-0 px-3.5 py-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#5E1924] text-white border-[#C5A059] shadow-sm ring-1 ring-[#C5A059]'
                                : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:bg-[#FAF7F2]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold">
                                #{order.id}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                                  isSelected
                                    ? 'bg-white/20 text-[#FAF6F0]'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <p
                              className={`text-[10px] mt-0.5 max-w-[170px] truncate ${
                                isSelected ? 'text-white/80' : 'text-[#7A6458]'
                              }`}
                            >
                              ₹{order.totalAmount} · {order.items[0]?.productName || 'Bedsheet'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DESKTOP LEFT COLUMN: Order List Cards (hidden on mobile, shown on lg screens) */}
                {orders.length > 1 && (
                  <div className="hidden lg:block lg:col-span-4 space-y-3">
                    <p className="text-xs font-bold text-[#7A6458] uppercase tracking-wider">
                      Select Order ({displayedOrders.length})
                    </p>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                      {displayedOrders.map((order) => {
                        const isSelected = order.id === currentSelectedOrder.id;
                        return (
                          <div
                            key={order.id}
                            onClick={() => handleSelectOrder(order.id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white border-[#B83F60] shadow-md ring-1 ring-[#B83F60]'
                                : 'bg-white/70 hover:bg-white border-[#EAE2D5]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-xs font-mono font-bold text-[#2C2420]">
                                  #{order.id}
                                </span>
                                <p className="text-[11px] text-[#7A6458]">
                                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                              {getStatusBadge(order.status)}
                            </div>

                            <p className="text-xs font-semibold text-[#2C2420] truncate">
                              {order.items.map((i) => i.productName).join(', ')}
                            </p>
                            <p className="text-xs font-bold text-[#B83F60] mt-1">
                              ₹{order.totalAmount.toLocaleString('en-IN')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* RIGHT COLUMN (OR FULL WIDTH): Detailed Live Order Tracker */}
                <div className={`${orders.length > 1 ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6 w-full`}>
                  
                  {/* Order Overview Card */}
                  <div
                    id="live-order-details-card"
                    className="bg-white rounded-3xl border border-[#DEC89B] p-6 sm:p-8 shadow-md space-y-6 scroll-mt-24"
                  >
                    
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EAE2D5]">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-mono font-bold text-[#2C2420]">
                            Order #{currentSelectedOrder.id}
                          </span>
                          {getStatusBadge(currentSelectedOrder.status)}
                        </div>
                        <p className="text-xs text-[#7A6458] mt-1">
                          Placed on {new Date(currentSelectedOrder.createdAt).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleContactAtelierForOrder(currentSelectedOrder)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>WhatsApp Atelier</span>
                        </button>
                      </div>
                    </div>

                    {/* LIVE INTERACTIVE DELIVERY STEPPER */}
                    <div className="py-4">
                      <p className="text-xs font-bold text-[#7A6458] uppercase tracking-wider mb-6">
                        Live Order Progress · Synced with Gurgaon Atelier
                      </p>

                      <div className="relative">
                        {/* Connecting Line */}
                        <div className="absolute top-5 left-6 right-6 h-1 bg-[#EAE2D5] -z-0 hidden sm:block">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-700"
                            style={{
                              width:
                                currentStep === 1
                                  ? '15%'
                                  : currentStep === 2
                                  ? '50%'
                                  : currentStep === 3
                                  ? '85%'
                                  : currentStep === 4
                                  ? '100%'
                                  : '0%',
                            }}
                          />
                        </div>

                        {/* 4 Steps */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-2 relative z-10">
                          
                          {/* Step 1: Placed */}
                          <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                currentStep >= 1
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'bg-[#FAF7F2] border border-[#DEC89B] text-[#7A6458]'
                              }`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#2C2420]">Order Placed</p>
                              <p className="text-[11px] text-[#7A6458]">Received at Atelier</p>
                            </div>
                          </div>

                          {/* Step 2: Order Confirmation Pending / Confirmed */}
                          <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                currentStep >= 2
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : currentStep === 1
                                  ? 'bg-amber-100 border-2 border-amber-500 text-amber-900 animate-pulse'
                                  : 'bg-[#FAF7F2] border border-[#DEC89B] text-[#7A6458]'
                              }`}
                            >
                              {currentStep >= 2 ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <Clock className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#2C2420]">
                                {currentStep >= 2 ? 'Order Confirmed' : 'Order Confirmation Pending'}
                              </p>
                              <p className="text-[11px] text-[#7A6458]">
                                {currentStep >= 2 ? 'Confirmed at Atelier' : 'Sector 46 Store'}
                              </p>
                            </div>
                          </div>

                          {/* Step 3: Dispatched & In Transit */}
                          <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                currentStep >= 3
                                  ? 'bg-purple-600 text-white shadow-md'
                                  : currentStep === 2
                                  ? 'bg-purple-100 border-2 border-purple-500 text-purple-900 animate-pulse'
                                  : 'bg-[#FAF7F2] border border-[#DEC89B] text-[#7A6458]'
                              }`}
                            >
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#2C2420]">In Transit</p>
                              <p className="text-[11px] text-[#7A6458]">Express Courier</p>
                            </div>
                          </div>

                          {/* Step 4: Delivered */}
                          <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                currentStep >= 4
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'bg-[#FAF7F2] border border-[#DEC89B] text-[#7A6458]'
                              }`}
                            >
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#2C2420]">Delivered</p>
                              <p className="text-[11px] text-[#7A6458]">Handed to You</p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Live Tracking Status Callout */}
                      <div className="mt-6 p-4 rounded-2xl bg-[#F5EFEB] border border-[#DEC89B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-[#C29E57] shrink-0" />
                          <div>
                            <span className="font-bold text-[#2C2420]">
                              {currentSelectedOrder.status === 'delivered'
                                ? 'Package safely delivered!'
                                : currentSelectedOrder.status === 'dispatched'
                                ? 'Package on the way with courier partner'
                                : currentSelectedOrder.status === 'confirmed'
                                ? 'Order confirmed & bedsheet packed at Sector 46 Gurgaon Atelier'
                                : 'Order confirmation pending from Sector 46 Atelier'}
                            </span>
                            {currentSelectedOrder.trackingNumber && (
                              <p className="text-[11px] text-[#7A6458] mt-0.5">
                                Tracking Ref: <strong className="font-mono">{currentSelectedOrder.trackingNumber}</strong> · Estimated: {currentSelectedOrder.estimatedDelivery || '1-2 Days'}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2.5 py-1 rounded-md shrink-0 self-start sm:self-auto">
                          100% Pure Cotton Guarantee
                        </span>
                      </div>

                    </div>

                    {/* INVOICE & EMAIL RECEIPT ACTION BAR */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAF7F2] to-white border border-[#DEC89B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-[#2C2420]">
                          <FileText className="w-4 h-4 text-[#8C2E46]" />
                          <span>Official Sale Invoice</span>
                        </div>
                        <p className="text-[11px] text-[#7A6458] mt-0.5">
                          {currentSelectedOrder.status === 'pending'
                            ? `Sale invoice will be generated and emailed once your order is confirmed by our atelier.`
                            : `Itemized printable sale invoice with bedsheet photos. Sent to ${currentSelectedOrder.customerEmail || 'buyer'}.`}
                        </p>
                        {emailSendFeedback && emailSendFeedback.id === currentSelectedOrder.id && (
                          <p
                            className={`text-[11px] font-semibold mt-1 ${
                              emailSendFeedback.success ? 'text-emerald-700' : 'text-amber-800'
                            }`}
                          >
                            {emailSendFeedback.message}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {currentSelectedOrder.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleConfirmOrder(currentSelectedOrder)}
                            disabled={isConfirmingOrder === currentSelectedOrder.id}
                            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Confirm this order and automatically dispatch the official sale invoice via Gmail SMTP"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                            <span>{isConfirmingOrder === currentSelectedOrder.id ? 'Confirming...' : 'Confirm Order & Send Invoice'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setInvoiceModalOrder(currentSelectedOrder)}
                          className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8C2E46]" />
                          <span>View Invoice</span>
                        </button>

                        <a
                          href={buildOrderGmailUrl(currentSelectedOrder)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-[#8C2E46] hover:bg-[#722338] text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Open in Gmail</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleSendOrderEmail(currentSelectedOrder)}
                          disabled={isSendingEmail === currentSelectedOrder.id}
                          className="p-2 bg-white hover:bg-[#FAF7F2] text-[#7A6458] hover:text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                          title="Resend email receipt via server"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSendingEmail === currentSelectedOrder.id ? 'animate-spin text-[#8C2E46]' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div className="space-y-4 pt-4 border-t border-[#EAE2D5]">
                      <p className="text-xs font-bold text-[#7A6458] uppercase tracking-wider">
                        Ordered Items ({currentSelectedOrder.items.length})
                      </p>

                      <div className="space-y-3">
                        {currentSelectedOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-4 p-3 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5]"
                          >
                            <img
                              src={fixImagePath(item.productImage)}
                              alt={item.productName}
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover object-center rounded-xl border border-[#DEC89B] shrink-0"
                            />
                            <div className="grow min-w-0">
                              <h4 className="font-serif-luxury text-sm font-bold text-[#2C2420] truncate">
                                {item.productName}
                              </h4>
                              <p className="text-xs text-[#7A6458]">
                                Size: {item.dimensions} · Includes 2 Pillow Shams
                              </p>
                              <p className="text-xs font-semibold text-[#2C2420] mt-1">
                                Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-[#B83F60]">
                                ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* DELIVERY ADDRESS & PAYMENT SUMMARY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#EAE2D5] text-xs">
                      
                      {/* Left: Delivery details */}
                      <div className="space-y-2">
                        <p className="font-bold text-[#7A6458] uppercase tracking-wider">
                          Delivery Destination
                        </p>
                        <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-1">
                          <p className="font-bold text-[#2C2420]">{currentSelectedOrder.customerName}</p>
                          <p className="text-[#6B5D55]">{currentSelectedOrder.customerAddress}</p>
                          <p className="text-[#7A6458]">Phone: +91 {currentSelectedOrder.customerPhone}</p>
                          {currentSelectedOrder.customerEmail && (
                            <p className="text-[#7A6458]">Email: {currentSelectedOrder.customerEmail}</p>
                          )}
                          {currentSelectedOrder.notes && (
                            <p className="text-amber-800 text-[11px] pt-1">
                              Note: "{currentSelectedOrder.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Payment details */}
                      <div className="space-y-2">
                        <p className="font-bold text-[#7A6458] uppercase tracking-wider">
                          Payment Breakdown
                        </p>
                        <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-1.5">
                          <div className="flex justify-between text-[#6B5D55]">
                            <span>Payment Method</span>
                            <span className="font-semibold uppercase text-[#2C2420]">
                              {currentSelectedOrder.paymentMethod === 'whatsapp'
                                ? 'WhatsApp Confirmation'
                                : currentSelectedOrder.paymentMethod.toUpperCase()}
                            </span>
                          </div>
                          {currentSelectedOrder.totalSavings > 0 && (
                            <div className="flex justify-between text-emerald-700 font-medium">
                              <span>Atelier Savings</span>
                              <span>-₹{currentSelectedOrder.totalSavings.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {Boolean(currentSelectedOrder.pointsUsed && currentSelectedOrder.pointsUsed > 0) && (
                            <div className="flex justify-between text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <span>Loyalty Points Redeemed ({currentSelectedOrder.pointsUsed} pts)</span>
                              <span>-₹{currentSelectedOrder.pointsDiscount || currentSelectedOrder.pointsUsed}</span>
                            </div>
                          )}
                          {Boolean(currentSelectedOrder.pointsEarned && currentSelectedOrder.pointsEarned > 0) && (
                            <div className="flex justify-between text-amber-900 font-semibold text-[11px]">
                              <span>Nest Points ({currentSelectedOrder.status === 'delivered' ? 'Credited' : 'Credited on Delivery'})</span>
                              <span className="font-bold text-amber-950">+{currentSelectedOrder.pointsEarned} pts (5 pts / ₹100)</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[#6B5D55]">
                            <span>Delivery (Gurgaon / NCR)</span>
                            <span className="text-emerald-700 font-semibold">FREE</span>
                          </div>
                          <div className="border-t border-[#EAE2D5] pt-1.5 flex justify-between text-sm font-bold text-[#2C2420]">
                            <span>Total Paid / Payable</span>
                            <span className="text-[#B83F60]">
                              ₹{currentSelectedOrder.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* TIMELINE AUDIT HISTORY */}
                    {currentSelectedOrder.timeline && currentSelectedOrder.timeline.length > 0 && (
                      <div className="pt-4 border-t border-[#EAE2D5]">
                        <p className="text-xs font-bold text-[#7A6458] uppercase tracking-wider mb-3">
                          Live Status Timeline
                        </p>
                        <div className="space-y-2">
                          {currentSelectedOrder.timeline.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-xs">
                              <span className="w-2 h-2 rounded-full bg-[#B83F60] mt-1.5 shrink-0" />
                              <div className="grow">
                                <span className="font-bold text-[#2C2420]">{step.title}</span>
                                <span className="text-[#7A6458] ml-2 text-[11px]">
                                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <p className="text-[#6B5D55] text-[11px]">{step.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* RETURN / EXCHANGE / COMPLAINT OPTION & CUSTOMER TRACKING */}
                    <OrderComplaintSection
                      key={currentSelectedOrder.id}
                      order={currentSelectedOrder}
                    />

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </div>

      <InvoiceModal
        order={invoiceModalOrder}
        isOpen={Boolean(invoiceModalOrder)}
        onClose={() => setInvoiceModalOrder(null)}
      />

    </div>
  );
};
