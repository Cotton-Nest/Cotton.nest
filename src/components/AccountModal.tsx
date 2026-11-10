import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Sparkles,
  Package,
  MapPin,
  Phone,
  Mail,
  Award,
  ChevronRight,
  X,
  ShoppingBag,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  Tag,
  Copy,
  Check,
  Edit2,
  Save,
  LogOut,
  ShieldCheck,
  Gift,
  Plus,
  Home,
  Briefcase,
  Bookmark,
  Download,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLoyalty } from '../context/LoyaltyContext';
import {
  LOYALTY_POINTS_PER_100_INR,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_MAX_REDEMPTION_POINTS,
  LOYALTY_EXPIRY_MONTHS,
  LOYALTY_REFERRAL_REWARD_POINTS,
  calculateEarnedPoints,
  calculatePointsDiscount,
  canRedeemPoints,
  getTransactionExpiryDate,
  isTransactionExpired,
  sanitizeLoyaltyKey,
} from '../data/loyalty';
import { WishlistItem, CustomerProfile, saveCurrentCustomerProfile } from '../data/wishlist';
import { Order } from '../data/orders';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { GoogleSignInButton } from './GoogleSignInButton';
import { SavedAddress, getSavedAddresses, saveAddressToBook, deleteSavedAddress, setDefaultAddress, formatFullAddress } from '../data/addresses';
import { OrderComplaintSection } from './OrderComplaintSection';
import { getOrders } from '../services/api';
import { InvoiceModal, buildOrderGmailUrl } from './InvoiceModal';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerProfile: CustomerProfile | null;
  onUpdateProfile: (profile: CustomerProfile) => void;
  wishlistItems: WishlistItem[];
  onRemoveWishlistItem: (productId: string) => void;
  onMoveToCartFromWishlist: (item: WishlistItem) => void;
  orders: Order[];
  onTrackOrderDirect?: (orderId: string) => void;
  onOpenCart?: () => void;
  onShopCatalogue?: () => void;
  isOwnerMode?: boolean;
  onOpenAdmin?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  customerProfile,
  onUpdateProfile,
  wishlistItems,
  onRemoveWishlistItem,
  onMoveToCartFromWishlist,
  orders,
  onTrackOrderDirect,
  onOpenCart,
  onShopCatalogue,
  isOwnerMode = false,
  onOpenAdmin,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const {
    pointsBalance,
    pointsRupeesValue,
    pointsEarnedFromPurchases,
    pointsUsed,
    referralPointsEarned,
    referralCode,
    referredByCode,
    nextExpiryTimestamp,
    preferRedeemAtCheckout,
    setPreferRedeemAtCheckout,
    claimReferralReward,
    transactions,
    refreshLoyalty,
    loadTransactions,
  } = useLoyalty();

  // Active view tab inside account modal: 'overview' | 'loyalty' | 'wishlist' | 'orders' | 'profile'
  const [activeTab, setActiveTab] = useState<'overview' | 'loyalty' | 'wishlist' | 'orders' | 'profile'>('overview');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [friendReferralInput, setFriendReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [claimingReferral, setClaimingReferral] = useState(false);
  
  // Edit profile state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState({
    name: customerProfile?.name || user?.name || '',
    phone: customerProfile?.phone || user?.phone || '',
    email: customerProfile?.email || user?.email || '',
    address: customerProfile?.address || '',
    city: customerProfile?.city || 'Gurgaon, Haryana',
    pincode: customerProfile?.pincode || '122003',
  });

  const userKey = user?.email || user?.id || customerProfile?.id || null;

  // Saved Addresses book state strictly scoped to customer
  const [addressBook, setAddressBook] = useState<SavedAddress[]>(() => getSavedAddresses(customerProfile, userKey));
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    name: customerProfile?.name || user?.name || '',
    phone: customerProfile?.phone || user?.phone || '',
    addressLine: '',
    city: 'Gurgaon, Haryana',
    pincode: '122003',
    label: 'Home' as 'Home' | 'Work' | 'Other',
    isDefault: false,
  });

  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const activeCustomerPhone = customerProfile?.phone || user?.phone;
    const explicitAccKey = activeCustomerPhone
      ? sanitizeLoyaltyKey(activeCustomerPhone)
      : (user?.email ? sanitizeLoyaltyKey(user.email) : undefined);

    getOrders()
      .then((res) => {
        if (Array.isArray(res)) {
          setFetchedOrders(res);
          try {
            localStorage.setItem('cotton_nest_orders', JSON.stringify(res));
          } catch {}
        }
        refreshLoyalty(explicitAccKey);
        loadTransactions(explicitAccKey);
      })
      .catch(() => {
        refreshLoyalty(explicitAccKey);
        loadTransactions(explicitAccKey);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userKey, activeTab, customerProfile?.phone, user?.phone]);

  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendReferralInput.trim()) return;
    setClaimingReferral(true);
    setReferralStatus(null);
    const res = await claimReferralReward(friendReferralInput.trim(), customerProfile?.phone || user?.phone);
    setClaimingReferral(false);
    setReferralStatus({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });
    if (res.success) {
      setFriendReferralInput('');
    }
  };

  const handleDownloadCsvHistory = () => {
    if (!transactions || transactions.length === 0) return;

    const headers = ['Transaction ID', 'Date & Time', 'Type', 'Points Delta', 'INR Value (INR)', 'Order ID', 'Description'];
    
    const sortedTxs = [...transactions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const rows = sortedTxs.map((t) => {
      const isEarned = t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0;
      const ptsDelta = isEarned ? `+${Math.abs(t.points)}` : `-${Math.abs(t.points)}`;
      const typeLabel = t.type ? t.type.toUpperCase() : isEarned ? 'EARNED' : 'REDEEMED';
      const dateStr = new Date(t.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const inrVal = calculatePointsDiscount(Math.abs(t.points));
      const orderRef = t.orderId || '';
      const desc = t.description || '';

      return [
        t.id,
        dateStr,
        typeLabel,
        ptsDelta,
        `₹${inrVal}`,
        orderRef,
        desc,
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const userIdentifier = user?.phone || user?.email || customerProfile?.phone || 'customer';
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `cotton_nest_nest_points_history_${userIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = () => {
    const updated = saveCurrentCustomerProfile({
      name: addressDraft.name.trim() || 'Customer',
      phone: addressDraft.phone.trim() || '',
      email: addressDraft.email.trim() || '',
      address: addressDraft.address.trim() || '',
      city: addressDraft.city.trim() || '',
      pincode: addressDraft.pincode.trim() || '',
    });
    if (addressDraft.address.trim()) {
      const updatedBook = saveAddressToBook({
        name: addressDraft.name.trim() || 'Customer',
        phone: addressDraft.phone.trim() || '',
        addressLine: addressDraft.address.trim(),
        city: addressDraft.city.trim() || 'Gurgaon, Haryana',
        pincode: addressDraft.pincode.trim() || '122003',
        label: 'Home',
        isDefault: true,
      }, userKey);
      setAddressBook(updatedBook);
    }
    onUpdateProfile(updated);
    setIsEditingAddress(false);
  };

  const handleSetDefaultAddress = (id: string) => {
    const updated = setDefaultAddress(id, userKey);
    setAddressBook(updated);
    const def = updated.find((a) => a.id === id);
    if (def) {
      const newProfile = saveCurrentCustomerProfile({
        name: def.name || customerProfile?.name || 'Customer',
        phone: def.phone || customerProfile?.phone || '',
        email: customerProfile?.email || '',
        address: def.addressLine,
        city: def.city,
        pincode: def.pincode,
      });
      onUpdateProfile(newProfile);
    }
  };

  const handleDeleteAddress = (id: string) => {
    const updated = deleteSavedAddress(id, userKey);
    setAddressBook(updated);
  };

  const handleAddNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressForm.addressLine.trim()) return;
    const updated = saveAddressToBook({
      name: newAddressForm.name.trim() || customerProfile?.name || 'Customer',
      phone: newAddressForm.phone.trim() || customerProfile?.phone || '',
      addressLine: newAddressForm.addressLine.trim(),
      city: newAddressForm.city.trim() || 'Gurgaon, Haryana',
      pincode: newAddressForm.pincode.trim() || '122003',
      label: newAddressForm.label,
      isDefault: newAddressForm.isDefault || addressBook.length === 0,
    }, userKey);
    setAddressBook(updated);
    if (newAddressForm.isDefault || addressBook.length === 0) {
      const newProfile = saveCurrentCustomerProfile({
        name: newAddressForm.name.trim() || customerProfile?.name || 'Customer',
        phone: newAddressForm.phone.trim() || customerProfile?.phone || '',
        email: customerProfile?.email || '',
        address: newAddressForm.addressLine.trim(),
        city: newAddressForm.city.trim() || 'Gurgaon, Haryana',
        pincode: newAddressForm.pincode.trim() || '122003',
      });
      onUpdateProfile(newProfile);
    }
    setNewAddressForm({
      name: customerProfile?.name || user?.name || '',
      phone: customerProfile?.phone || user?.phone || '',
      addressLine: '',
      city: 'Gurgaon, Haryana',
      pincode: '122003',
      label: 'Home',
      isDefault: false,
    });
    setIsAddingNewAddress(false);
  };

  // Merge props.orders and fetchedOrders
  const mergedOrdersMap = new Map<string, Order>();
  for (const o of fetchedOrders) {
    if (o && o.id) mergedOrdersMap.set(o.id, o);
  }
  for (const o of orders) {
    if (o && o.id && !mergedOrdersMap.has(o.id)) mergedOrdersMap.set(o.id, o);
  }
  const allMergedOrders = Array.from(mergedOrdersMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  // Filter orders relevant to this user/phone/email
  const customerOrders = allMergedOrders.filter((o) => {
    if (user?.email && o.customerEmail?.toLowerCase() === user.email.toLowerCase()) return true;
    if (customerProfile?.phone && o.customerPhone === customerProfile.phone) return true;
    return true; // fallback to show recent store orders
  }).slice(0, 10);

  // Delivered orders for this customer with calculated earned points
  const deliveredCustomerOrders = customerOrders
    .filter((o) => o.status === 'delivered')
    .map((o) => {
      const net = Math.max(0, (o.totalAmount || 0) - (o.shippingCost || 0));
      const pts = typeof o.pointsEarned === 'number' && o.pointsEarned > 0 ? o.pointsEarned : calculateEarnedPoints(net);
      return {
        ...o,
        computedEarnedPoints: pts,
      };
    });

  // Calculate purchase points from delivered orders as fallback/supplement
  const deliveredOrdersEarned = deliveredCustomerOrders.reduce(
    (sum, o) => sum + o.computedEarnedPoints,
    0
  );

  const pendingDeliveryPoints = customerOrders
    .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
    .reduce((sum, o) => {
      if (typeof o.pointsEarned === 'number' && o.pointsEarned > 0) return sum + o.pointsEarned;
      const net = Math.max(0, (o.totalAmount || 0) - (o.shippingCost || 0));
      return sum + calculateEarnedPoints(net);
    }, 0);

  // Authoritative earned credits and debits directly from ledger transactions
  const totalEarnedFromTxs = transactions
    .filter((t) => {
      const type = (t.type || '').toLowerCase();
      const pts = Number(t.points) || 0;
      return pts > 0 && (type === 'earned' || type === 'credit' || type === 'bonus' || type === 'referral' || type === 'adjustment' || !type);
    })
    .reduce((sum, t) => sum + Math.max(0, Number(t.points) || 0), 0);

  const totalUsedFromTxs = transactions
    .filter((t) => {
      const type = (t.type || '').toLowerCase();
      const pts = Number(t.points) || 0;
      return pts < 0 || type === 'redeemed' || type === 'debit';
    })
    .reduce((sum, t) => sum + Math.abs(Number(t.points) || 0), 0);

  const netFromTxs = Math.max(0, totalEarnedFromTxs - totalUsedFromTxs);

  const displayPointsFromPurchases = Math.max(
    pointsEarnedFromPurchases,
    deliveredOrdersEarned,
    totalEarnedFromTxs
  );
  const displayPointsUsed = Math.max(pointsUsed, totalUsedFromTxs);

  const activeAvailablePoints = Math.max(
    pointsBalance,
    netFromTxs,
    Math.max(0, displayPointsFromPurchases + referralPointsEarned - displayPointsUsed)
  );
  const activeRupeesValue = calculatePointsDiscount(activeAvailablePoints);
  const formattedNextExpiry = nextExpiryTimestamp
    ? new Date(nextExpiryTimestamp).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '12 months from credit date';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-2xl max-h-[92vh] rounded-3xl border border-[#DEC89B] shadow-2xl z-10 flex flex-col overflow-hidden text-[#2C2420]">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE2D5] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FDEAF0] text-[#8C2E46] flex items-center justify-center font-bold">
              {user?.avatar ? (
                <img src={user.avatar} alt="User" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <User className="w-5 h-5 text-[#8C2E46]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                  {customerProfile?.name || user?.name || 'Customer Account'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Royal Member
                </span>
              </div>
              <p className="text-[11px] text-[#7A6458]">
                {customerProfile?.phone || user?.email || COMPANY_DETAILS.phone} · Sector 46, Gurgaon
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-[#EAE2D5] overflow-x-auto no-scrollbar shrink-0 text-xs">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'loyalty', label: 'Nest Points & Rewards', count: `${activeAvailablePoints} pts`, icon: Award },
            { id: 'wishlist', label: 'Wishlist', count: wishlistItems.length, icon: Heart },
            { id: 'orders', label: 'My Orders', count: customerOrders.length, icon: Package },
            { id: 'profile', label: 'Address & Profile', icon: MapPin },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`account-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-[#8C2E46] text-white border-[#8C2E46] font-bold shadow-2xs'
                    : 'bg-[#FAF7F2] text-[#6B5D55] border-[#EAE2D5] hover:bg-[#F4EFE6]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#8C7A70]'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Nest Points Complete Account Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-[#FAF7F2] to-amber-100/60 border border-amber-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#C29E57]" />
                    <span className="font-serif-luxury font-bold text-sm text-[#70252D]">
                      Nest Points Loyalty Wallet
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    {LOYALTY_POINTS_PER_100_INR} pts / ₹100 · 100 pts = ₹50
                  </span>
                </div>

                {/* Primary Balance & Equivalent Rupee Value */}
                <div className="flex items-baseline justify-between pt-1 flex-wrap gap-2">
                  <div>
                    <span className="text-3xl font-extrabold font-mono text-[#70252D]">
                      {pointsBalance}
                    </span>
                    <span className="text-xs font-semibold text-amber-900 ml-1.5">Available Nest Points</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    Equivalent Rupee Value: ₹{pointsRupeesValue} (100 pts = ₹50)
                  </span>
                </div>

                {/* 4-Grid Breakdown inside Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="p-2 bg-white/90 rounded-xl border border-amber-200/80">
                    <span className="text-[10px] text-[#7A6458] block">Earned (Purchases)</span>
                    <span className="font-bold text-[#2C2420]">{displayPointsFromPurchases} pts</span>
                    {pendingDeliveryPoints > 0 && (
                      <span className="text-[9px] text-amber-800 block">+{pendingDeliveryPoints} pts on delivery</span>
                    )}
                  </div>
                  <div className="p-2 bg-white/90 rounded-xl border border-amber-200/80">
                    <span className="text-[10px] text-[#7A6458] block">Points Used</span>
                    <span className="font-bold text-rose-800">{pointsUsed} pts (₹{calculatePointsDiscount(pointsUsed)})</span>
                  </div>
                  <div className="p-2 bg-white/90 rounded-xl border border-amber-200/80">
                    <span className="text-[10px] text-[#7A6458] block">Expiry Date</span>
                    <span className="font-bold text-[#2C2420] truncate block" title={`${LOYALTY_EXPIRY_MONTHS} months validity`}>
                      {formattedNextExpiry}
                    </span>
                  </div>
                  <div className="p-2 bg-white/90 rounded-xl border border-amber-200/80">
                    <span className="text-[10px] text-[#7A6458] block">Referral Rewards</span>
                    <span className="font-bold text-emerald-800">+{referralPointsEarned} pts ({referralCode})</span>
                  </div>
                </div>

                {/* Brief History of Points Earned from Delivered Orders */}
                <div className="pt-2.5 border-t border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#70252D] flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>Points Earned from Delivered Orders</span>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {deliveredCustomerOrders.length} Delivered Order{deliveredCustomerOrders.length === 1 ? '' : 's'} · +{displayPointsFromPurchases} pts
                    </span>
                  </div>

                  {deliveredCustomerOrders.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {deliveredCustomerOrders.slice(0, 4).map((ord) => (
                        <div
                          key={ord.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/95 border border-amber-200/80 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[#2C2420]">
                                Order #{ord.id.slice(-8)}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                Delivered
                              </span>
                            </div>
                            <p className="text-[10px] text-[#7A6458] truncate">
                              {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })} · Paid ₹{ord.totalAmount}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-extrabold text-emerald-700 text-xs block">
                              +{ord.computedEarnedPoints} pts
                            </span>
                            <span className="text-[10px] text-[#7A6458] block">
                              ≈ ₹{calculatePointsDiscount(ord.computedEarnedPoints)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-white/80 border border-amber-200/60 text-[11px] text-[#7A6458]">
                      Points are credited automatically once your order is marked <strong className="text-[#2C2420]">Delivered</strong> (5 Nest Points per ₹100 spent).
                      {pendingDeliveryPoints > 0 && (
                        <span className="block text-amber-900 font-semibold mt-0.5">
                          +{pendingDeliveryPoints} Nest Points will be credited upon delivery of your active order(s).
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Redeem Points at Checkout Toggle & Action */}
                <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferRedeemAtCheckout}
                      onChange={(e) => setPreferRedeemAtCheckout(e.target.checked)}
                      disabled={!canRedeemPoints(pointsBalance)}
                      className="accent-[#8C2E46] w-3.5 h-3.5 rounded cursor-pointer disabled:opacity-50"
                    />
                    <span className="font-semibold text-[#2C2420]">
                      Redeem Nest Points at Checkout
                      {!canRedeemPoints(pointsBalance) && (
                        <span className="text-[10px] text-amber-900 font-normal ml-1">
                          (Min. {LOYALTY_MIN_REDEMPTION_POINTS} pts required · need {Math.max(0, LOYALTY_MIN_REDEMPTION_POINTS - pointsBalance)} more)
                        </span>
                      )}
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    {onOpenCart && (
                      <button
                        type="button"
                        onClick={() => {
                          if (canRedeemPoints(pointsBalance)) {
                            setPreferRedeemAtCheckout(true);
                          }
                          onClose();
                          onOpenCart();
                        }}
                        className="px-2.5 py-1 bg-[#8C2E46] hover:bg-[#742438] text-white text-[11px] font-semibold rounded-lg cursor-pointer transition-colors"
                      >
                        Redeem at Checkout →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('loyalty')}
                      className="text-[#8C2E46] font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Full Details &amp; Referrals</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Owner Controls Quick Action (Only for authorized owner) */}
              {(isOwnerMode || user?.isOwner) && onOpenAdmin && (
                <div className="p-3.5 rounded-2xl bg-[#2C2420] text-white border border-[#DEC89B]/40 shadow-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#EAE2D5]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Atelier Store Owner Controls</span>
                    </div>
                    <p className="text-[11px] text-[#A8988D]">
                      Update prices, stock, discounts, orders &amp; photos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="shrink-0 px-3 py-1.5 bg-[#8C2E46] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    ⚙️ Open Admin
                  </button>
                </div>
              )}

              {/* Quick 2-Column Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Wishlist Quick Card */}
                <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      <span>My Wishlist ({wishlistItems.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('wishlist')}
                      className="text-[11px] font-bold text-[#8C2E46] hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  {wishlistItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {wishlistItems.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-1.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5]">
                          <img
                            src={resolveBedsheetImage(item.productImage, item.productId)}
                            alt={item.productName}
                            className="w-10 h-10 rounded-lg object-cover border border-[#EAE2D5]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#2C2420] truncate">{item.productName}</p>
                            <p className="text-[10px] text-[#7A6458]">₹{item.productPrice} · {item.productDimensions?.split('(')[0]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8C7A70] italic">No sheets saved yet.</p>
                  )}
                </div>

                {/* Orders Quick Card */}
                <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[#C29E57]" />
                      <span>My Orders ({customerOrders.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-[11px] font-bold text-[#8C2E46] hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  {customerOrders.length > 0 ? (
                    <div className="space-y-1.5">
                      {customerOrders.slice(0, 2).map((o) => (
                        <div key={o.id} className="p-2 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#2C2420] truncate">Order #{o.id.slice(-6)}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded capitalize bg-emerald-100 text-emerald-800">
                              {o.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#7A6458] mt-0.5">₹{o.totalAmount} · {o.items?.length || 1} sheet(s)</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8C7A70] italic">No previous orders yet.</p>
                  )}
                </div>

              </div>

              {/* Saved Delivery Address Preview Card */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#8C2E46]" />
                    <span>Saved Delivery Address</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="text-[11px] font-bold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{addressBook.length > 0 ? 'Manage Addresses' : 'Add Address'}</span>
                  </button>
                </div>
                {addressBook.length > 0 ? (
                  (() => {
                    const primaryAddr = addressBook.find((a) => a.isDefault) || addressBook[0];
                    return (
                      <>
                        <p className="text-xs text-[#2C2420] font-medium leading-relaxed">
                          <span className="font-bold">{primaryAddr.name}</span> · {formatFullAddress(primaryAddr)}
                        </p>
                        {primaryAddr.phone && (
                          <p className="text-[11px] text-[#7A6458]">
                            Contact: {primaryAddr.phone}
                          </p>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <p className="text-xs text-[#8C7A70] italic">
                    No saved delivery address yet. Click &ldquo;Add Address&rdquo; to save your delivery location.
                  </p>
                )}
              </div>

              {/* Active Coupons Banner */}
              <div className="p-3.5 bg-[#FDEAF0] rounded-2xl border border-[#FAD1DC] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#8C2E46]" />
                  <div>
                    <span className="font-bold text-[#8C2E46]">WISHLIST5</span>
                    <span className="text-[#7A6458] ml-2">Extra 5% off on your wishlisted bedsheets</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCoupon('WISHLIST5')}
                  className="px-2.5 py-1 bg-white hover:bg-[#FAF7F2] text-[#8C2E46] font-bold text-[11px] rounded-lg border border-[#FAD1DC] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedCoupon === 'WISHLIST5' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: NEST POINTS & REWARDS */}
          {activeTab === 'loyalty' && (
            <div className="space-y-4">
              {/* Primary Nest Points Balance & Equivalent Rupee Value */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-[#FAF7F2] to-amber-100/70 border border-amber-300 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#C29E57]" />
                    Customer Nest Points Account
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                      {LOYALTY_POINTS_PER_100_INR} Points per ₹100
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      100 Points = ₹50
                    </span>
                  </div>
                </div>

                {/* 1. Available Nest Points & 2. Equivalent Rupee Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-white rounded-2xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      1. Available Nest Points
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold font-mono text-[#70252D]">
                        {activeAvailablePoints}
                      </span>
                      <span className="text-xs font-semibold text-amber-900">Nest Points</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      2. Equivalent Rupee Value
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold font-mono text-emerald-800">
                        ₹{activeRupeesValue}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">(₹0.50 / pt · 100 pts = ₹50)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Points Earned from Previous Purchases, 4. Points Used, 5. Expiry Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      3. Earned from Purchases
                    </span>
                    <span className="text-lg font-extrabold font-mono text-emerald-800 mt-0.5 block">
                      +{displayPointsFromPurchases} pts
                    </span>
                    <span className="text-[10px] text-[#7A6458] block">
                      {pendingDeliveryPoints > 0
                        ? `+${pendingDeliveryPoints} pts pending delivery`
                        : 'Credited after delivery & full payment'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      4. Points Used
                    </span>
                    <span className="text-lg font-extrabold font-mono text-rose-700 mt-0.5 block">
                      {displayPointsUsed} pts
                    </span>
                    <span className="text-[10px] text-[#7A6458] block">
                      Saved ₹{calculatePointsDiscount(displayPointsUsed)} on orders
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      5. Expiry Dates
                    </span>
                    <span className="text-sm font-bold text-[#2C2420] mt-1 block">
                      {formattedNextExpiry}
                    </span>
                    <span className="text-[10px] text-[#7A6458] block">
                      Valid for {LOYALTY_EXPIRY_MONTHS} months from credit
                    </span>
                  </div>
                </div>

                {/* 7. Redeem Points Option at Checkout */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#DEC89B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2C2420]">
                        7. Redeem Points Option at Checkout
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        canRedeemPoints(pointsBalance)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {canRedeemPoints(pointsBalance)
                          ? `Max ${LOYALTY_MAX_REDEMPTION_POINTS} pts/order (-₹${calculatePointsDiscount(Math.min(pointsBalance, LOYALTY_MAX_REDEMPTION_POINTS))})`
                          : `Min. ${LOYALTY_MIN_REDEMPTION_POINTS} pts required`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A6458]">
                      {canRedeemPoints(pointsBalance)
                        ? `Redeem up to ${Math.min(pointsBalance, LOYALTY_MAX_REDEMPTION_POINTS)} Nest Points (₹${calculatePointsDiscount(Math.min(pointsBalance, LOYALTY_MAX_REDEMPTION_POINTS))} off, max ${LOYALTY_MAX_REDEMPTION_POINTS} pts per order) at checkout.`
                        : `You have ${pointsBalance} pts. Collect ${Math.max(0, LOYALTY_MIN_REDEMPTION_POINTS - pointsBalance)} more Nest Points to unlock checkout redemption (max ${LOYALTY_MAX_REDEMPTION_POINTS} pts = ₹${calculatePointsDiscount(LOYALTY_MAX_REDEMPTION_POINTS)} per order).`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferRedeemAtCheckout}
                        onChange={(e) => setPreferRedeemAtCheckout(e.target.checked)}
                        disabled={!canRedeemPoints(pointsBalance)}
                        className="accent-[#8C2E46] w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                      />
                      <span>Redeem at Checkout</span>
                    </label>
                    {onOpenCart && (
                      <button
                        type="button"
                        onClick={() => {
                          if (canRedeemPoints(pointsBalance)) {
                            setPreferRedeemAtCheckout(true);
                          }
                          onClose();
                          onOpenCart();
                        }}
                        className="px-3.5 py-1.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
                      >
                        Go to Checkout →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 6. Referral Rewards Card */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-[#8C2E46]" />
                    <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider">
                      6. Referral Rewards (+{LOYALTY_REFERRAL_REWARD_POINTS} Nest Points)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyReferralCode}
                      className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-amber-50 text-[#8C2E46] border border-[#DEC89B] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy referral code to clipboard"
                    >
                      {copiedReferral ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedReferral ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Earned: {referralPointsEarned} pts
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#6B5D55]">
                  Share your personal referral code with friends &amp; family. When they claim your code or place their first Cotton Nest order, you earn <strong>+{LOYALTY_REFERRAL_REWARD_POINTS} Nest Points (worth ₹{calculatePointsDiscount(LOYALTY_REFERRAL_REWARD_POINTS)})</strong>!
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#FAF7F2] rounded-xl border border-[#DEC89B]">
                  <div>
                    <span className="text-[10px] text-[#7A6458] uppercase font-semibold block">Your Personal Referral Code</span>
                    <span className="font-mono text-base font-extrabold text-[#70252D] tracking-wider">{referralCode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyReferralCode}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 text-[#2C2420] border border-[#DEC89B] rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedReferral ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedReferral ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <a
                      href={COMPANY_DETAILS.whatsappUrl(`Use my Cotton Nest Referral Code *${referralCode}* to claim +${LOYALTY_REFERRAL_REWARD_POINTS} Nest Points (worth ₹${calculatePointsDiscount(LOYALTY_REFERRAL_REWARD_POINTS)}) on luxury 100% pure cotton bedsheets!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Share on WhatsApp</span>
                    </a>
                  </div>
                </div>

                {!referredByCode ? (
                  <form onSubmit={handleClaimReferral} className="pt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={friendReferralInput}
                      onChange={(e) => setFriendReferralInput(e.target.value.toUpperCase())}
                      placeholder="Have a friend's referral code? Enter here"
                      className="flex-1 px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs uppercase font-semibold placeholder:normal-case placeholder:font-normal"
                    />
                    <button
                      type="submit"
                      disabled={claimingReferral || !friendReferralInput.trim()}
                      className="px-3.5 py-1.5 bg-[#8C2E46] hover:bg-[#742438] text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {claimingReferral ? 'Applying...' : 'Claim +100 Pts'}
                    </button>
                  </form>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    ✓ Referred by code: {referredByCode} (+{LOYALTY_REFERRAL_REWARD_POINTS} Nest Points credited)
                  </p>
                )}

                {referralStatus && (
                  <p className={`text-[11px] font-semibold ${referralStatus.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {referralStatus.message}
                  </p>
                )}
              </div>

              {/* Official Nest Points Terms & Conditions Box */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2 text-xs">
                <h4 className="font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#8C2E46]" />
                  <span>Nest Points Terms &amp; Conditions</span>
                </h4>
                <ul className="space-y-1 text-[11px] text-[#6B5D55] list-disc pl-4">
                  <li><strong>Earning Rate:</strong> Earn <strong>5 Nest Points per ₹100</strong> spent on eligible bedsheets.</li>
                  <li><strong>Redemption Value:</strong> <strong>100 Nest Points = ₹50</strong> (1 Nest Point = ₹0.50).</li>
                  <li><strong>Maximum Redemption Limit:</strong> Redeem up to <strong>{LOYALTY_MAX_REDEMPTION_POINTS} Nest Points</strong> (₹{calculatePointsDiscount(LOYALTY_MAX_REDEMPTION_POINTS)} discount) per order.</li>
                  <li><strong>Minimum Redemption:</strong> Minimum <strong>{LOYALTY_MIN_REDEMPTION_POINTS} Nest Points</strong> required for redemption at checkout.</li>
                  <li><strong>Credit Policy:</strong> Points are credited <strong>only after successful delivery and full payment</strong>.</li>
                  <li><strong>Delivery Charges Excluded:</strong> No points are earned on delivery / shipping charges.</li>
                  <li><strong>Expiry Policy:</strong> Nest Points expire after <strong>12 months</strong> from the date of credit.</li>
                  <li><strong>Non-Encashable:</strong> Nest Points cannot be exchanged or redeemed for cash.</li>
                </ul>

                {/* Additional Terms & Conditions for Nest Points Redemption */}
                <div className="pt-2.5 mt-2.5 border-t border-[#EAE2D5] space-y-1.5">
                  <h5 className="font-bold text-[#8C2E46] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Additional Terms &amp; Conditions for Nest Points Redemption</span>
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#6B5D55]">
                    <li>Nest Points are account-specific and non-transferable. They can only be redeemed by the registered customer to whom they were credited.</li>
                    <li>Nest Points cannot be exchanged for cash or transferred to another account.</li>
                    <li>Redemption is permitted only on eligible purchases.</li>
                    <li>Maximum redemption is capped at 125 Nest Points per order.</li>
                    <li>Customers must have sufficient available points at checkout to redeem them.</li>
                    <li>Once an order is successfully placed using Nest Points, the redeemed points must be deducted from the available balance.</li>
                    <li>If an order is cancelled or refunded, redeemed points must be reinstated after verification, according to the applicable refund process.</li>
                    <li>Cotton Nest reserves the right to reverse points credited incorrectly or obtained through fraudulent transactions.</li>
                    <li>Nest Points have no independent cash value and cannot be redeemed outside the Cotton Nest website.</li>
                    <li>Cotton Nest reserves the right to modify or discontinue the loyalty programme with reasonable notice.</li>
                  </ol>
                </div>
              </div>

              {/* Points History with Chronological Log & Expiry Dates */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-[#70252D] uppercase tracking-wider flex items-center gap-1.5 font-serif-luxury">
                    <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                    <span>Points History &amp; Expiry Ledger</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {transactions && transactions.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        {transactions.length} record(s)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadCsvHistory}
                      disabled={!transactions || transactions.length === 0}
                      className="px-2.5 py-1 bg-[#8C2E46] hover:bg-[#742438] disabled:opacity-40 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Download points history as CSV file"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {transactions && transactions.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-amber-200">
                    {[...transactions]
                      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                      .map((tx) => {
                        const isPositive =
                          tx.type === 'earned' || tx.type === 'bonus' || tx.type === 'referral' || tx.points > 0;
                        const pts = Math.abs(tx.points);
                        const expiryDate = isPositive
                          ? new Date(getTransactionExpiryDate(tx.createdAt, tx.expiresAt))
                          : null;
                        const expired = isTransactionExpired(tx.createdAt, tx.expiresAt);

                        // Formatted log title: e.g. "+50 points: Order #1234"
                        let title = isPositive
                          ? tx.type === 'referral'
                            ? `+${pts} points: Referral Bonus${tx.orderId ? ` (${tx.orderId})` : ''}`
                            : tx.orderId
                            ? `+${pts} points: Order #${tx.orderId}`
                            : `+${pts} points: Delivered Order`
                          : tx.orderId
                          ? `-${pts} points: Redeemed on Order #${tx.orderId}`
                          : `-${pts} points: Redeemed at Checkout`;

                        return (
                          <div
                            key={tx.id}
                            className={`p-3 rounded-xl border bg-white flex items-center justify-between text-xs gap-3 shadow-2xs ${
                              isPositive ? 'border-[#EAE2D5] hover:border-emerald-300' : 'border-[#EAE2D5] hover:border-rose-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5
                                  className={`font-bold font-sans tracking-tight text-xs ${
                                    isPositive ? 'text-emerald-900' : 'text-rose-900'
                                  }`}
                                >
                                  {title}
                                </h5>
                                {tx.type === 'referral' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                    Referral
                                  </span>
                                )}
                                {tx.orderId && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                    #{tx.orderId}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#6B5D55] mt-0.5 leading-normal truncate max-w-sm">
                                {tx.description}
                              </p>
                              <div className="flex items-center gap-2.5 text-[10px] text-[#8C7A70] mt-1 flex-wrap">
                                <span>Credited: {new Date(tx.createdAt).toLocaleDateString('en-IN')}</span>
                                {expiryDate && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded ${
                                      expired
                                        ? 'bg-rose-50 text-rose-700 font-semibold'
                                        : 'bg-amber-50 text-amber-900 font-medium'
                                    }`}
                                  >
                                    {expired
                                      ? `Expired on ${expiryDate.toLocaleDateString('en-IN')}`
                                      : `Expires: ${expiryDate.toLocaleDateString('en-IN')} (12 mos)`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono font-bold text-sm block ${
                                  isPositive ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {isPositive ? `+${pts}` : `-${pts}`} pts
                              </span>
                              <span className="text-[10px] text-[#8C7A70] block">
                                ≈ ₹{calculatePointsDiscount(pts)} value
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-6 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#8C7A70] space-y-1">
                    <p className="font-semibold text-[#2C2420]">No points transactions yet</p>
                    <p>
                      Purchase any bedsheet to earn 5 Nest Points per ₹100 (credited upon delivery &amp; full payment)!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WISHLIST */}
          {activeTab === 'wishlist' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider">
                  Saved Bedsheets ({wishlistItems.length})
                </span>
                {wishlistItems.length > 0 && onShopCatalogue && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onShopCatalogue();
                    }}
                    className="text-xs text-[#8C2E46] font-semibold hover:underline cursor-pointer"
                  >
                    + Add More Bedsheets
                  </button>
                )}
              </div>

              {wishlistItems.length > 0 ? (
                <div className="divide-y divide-[#EAE2D5] bg-white rounded-2xl border border-[#EAE2D5] overflow-hidden">
                  {wishlistItems.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center gap-3 hover:bg-[#FAF7F2] transition-colors">
                      <img
                        src={resolveBedsheetImage(item.productImage, item.productId)}
                        alt={item.productName}
                        className="w-14 h-14 rounded-xl object-cover border border-[#EAE2D5] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#2C2420] truncate">{item.productName}</h4>
                        <p className="text-[11px] text-[#7A6458]">
                          {item.productDimensions?.split('(')[0]} {item.selectedVariantName ? `· ${item.selectedVariantName}` : ''}
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-[#8C2E46]">₹{item.productPrice}</span>
                          {item.productOriginalPrice > item.productPrice && (
                            <span className="text-[10px] text-[#8C7A70] line-through">₹{item.productOriginalPrice}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onMoveToCartFromWishlist(item)}
                          className="px-3 py-1.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Move to Bag</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveWishlistItem(item.id)}
                          className="p-1.5 text-[#8C7A70] hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-3xl border border-[#EAE2D5] text-center space-y-3">
                  <Heart className="w-10 h-10 text-rose-300 mx-auto" />
                  <p className="text-xs text-[#7A6458]">Your wishlist is currently empty.</p>
                  {onShopCatalogue && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onShopCatalogue();
                      }}
                      className="px-4 py-2 bg-[#8C2E46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Explore Full Bedsheet Catalogue
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider block">
                My Recent Orders &amp; Live Tracking
              </span>

              {customerOrders.length > 0 ? (
                <div className="space-y-3">
                  {customerOrders.map((order) => (
                    <div key={order.id} className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#2C2420]">
                            Order #{order.id.slice(-8)}
                          </span>
                          <span className="text-[10px] text-[#8C7A70] block">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            order.status === 'pending'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : order.status === 'confirmed'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : order.status === 'dispatched'
                              ? 'bg-purple-100 text-purple-900 border-purple-300'
                              : order.status === 'cancelled'
                              ? 'bg-neutral-200 text-neutral-800 border-neutral-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {order.status === 'pending'
                            ? 'Order Confirmation Pending'
                            : order.status === 'confirmed'
                            ? 'Order Confirmed'
                            : order.status === 'dispatched'
                            ? 'In Transit'
                            : order.status === 'delivered'
                            ? 'Delivered'
                            : order.status}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-[#2C2420] truncate max-w-[200px]">
                              {it.quantity}x {it.productName}
                            </span>
                            <span className="font-semibold text-[#8C2E46]">₹{it.price * it.quantity}</span>
                          </div>
                        ))}
                        {Boolean(order.pointsUsed && order.pointsUsed > 0) && (
                          <div className="flex items-center justify-between text-xs py-1 px-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-semibold mt-1">
                            <span className="flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-[#C29E57]" />
                              <span>Loyalty Points Redeemed ({order.pointsUsed} pts)</span>
                            </span>
                            <span>-₹{order.pointsDiscount || calculatePointsDiscount(Number(order.pointsUsed) || 0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EAE2D5] text-xs">
                        <span className="text-[#7A6458]">Total Paid: <strong className="text-[#2C2420]">₹{order.totalAmount}</strong></span>
                        <div className="flex items-center gap-3">
                          {onTrackOrderDirect && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onTrackOrderDirect(order.id);
                              }}
                              className="text-[#8C2E46] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Live Tracker</span>
                            </button>
                          )}
                          <a
                            href={COMPANY_DETAILS.whatsappUrl(`Hello Cotton Nest, I would like an update on my order #${order.id}.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#7A6458] hover:text-[#8C2E46] font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>

                      {/* Official Sale Invoice Section (Only generated & displayed after Admin confirmation) */}
                      {(order.status === 'confirmed' || order.status === 'dispatched' || order.status === 'delivered') ? (
                        <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-emerald-900">
                            <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                            <div>
                              <span className="font-bold block">
                                Official Sale Invoice ({order.invoiceNumber || `INV-${order.id}`})
                              </span>
                              <span className="text-[11px] text-emerald-700">
                                {order.customerEmail ? `Emailed to ${order.customerEmail}` : 'Ready to view & download'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInvoiceModalOrder(order)}
                              className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-[#2C2420] border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#8C2E46]" />
                              <span>View / Print Invoice</span>
                            </button>
                            <a
                              href={buildOrderGmailUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-[#8C2E46] hover:bg-[#732236] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email Copy</span>
                            </a>
                          </div>
                        </div>
                      ) : order.status === 'cancelled' ? (
                        <div className="p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 flex items-center gap-2 text-xs text-neutral-600">
                          <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span>
                            {order.invoiceGenerated || order.invoiceSent
                              ? `Order cancelled. Previously generated invoice: ${order.invoiceNumber || `INV-${order.id}`}`
                              : 'Order was cancelled before confirmation. No invoice was generated.'}
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Your invoice will be generated and available once your order is confirmed.</span>
                        </div>
                      )}

                      {/* Defect Exchange & Quality Complaint under every order card */}
                      <OrderComplaintSection order={order} compact />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-3xl border border-[#EAE2D5] text-center space-y-3">
                  <Package className="w-10 h-10 text-[#C29E57] mx-auto" />
                  <p className="text-xs text-[#7A6458]">No orders found for this account.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SAVED ADDRESS BOOK & PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* SAVED ADDRESS BOOK (Only Saved Addresses Visible) */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-2">
                  <div>
                    <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-4 h-4 text-[#8C2E46]" />
                      <span>Saved Delivery Addresses ({addressBook.length})</span>
                    </span>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      Your saved addresses are automatically selected at checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(!isAddingNewAddress)}
                    className="text-xs text-[#8C2E46] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingNewAddress ? 'Cancel' : 'Add New'}</span>
                  </button>
                </div>

                {isAddingNewAddress && (
                  <form onSubmit={handleAddNewAddress} className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#2C2420] uppercase">Add New Address</span>
                      <div className="flex gap-1">
                        {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setNewAddressForm({ ...newAddressForm, label: lbl })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition-all cursor-pointer ${
                              newAddressForm.label === lbl
                                ? 'bg-[#8C2E46] text-white border-[#8C2E46]'
                                : 'bg-white text-[#7A6458] border-[#EAE2D5]'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Recipient Name"
                        value={newAddressForm.name}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, name: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={newAddressForm.phone}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Street address, house / apartment / unit number"
                      value={newAddressForm.addressLine}
                      onChange={(e) => setNewAddressForm({ ...newAddressForm, addressLine: e.target.value })}
                      required
                      className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City / Region"
                        value={newAddressForm.city}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={newAddressForm.pincode}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, pincode: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-[11px] text-[#7A6458] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAddressForm.isDefault}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, isDefault: e.target.checked })}
                          className="rounded text-[#8C2E46] focus:ring-0"
                        />
                        <span>Set as default address</span>
                      </label>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#8C2E46] text-white text-xs font-semibold rounded-lg hover:bg-[#732236] cursor-pointer"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}

                {addressBook.length === 0 ? (
                  <p className="text-xs text-[#7A6458] italic py-2">
                    No saved addresses yet. Add a delivery address above or save one during checkout.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {addressBook.map((addr) => {
                      const AddressIcon = addr.label === 'Home' ? Home : addr.label === 'Work' ? Briefcase : MapPin;
                      return (
                        <div
                          key={addr.id}
                          className={`p-3 rounded-xl border transition-all ${
                            addr.isDefault
                              ? 'border-[#C29E57] bg-[#FCFBF8]'
                              : 'border-[#EAE2D5] bg-white hover:border-[#D6CAB8]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="p-1 rounded-md bg-[#FAF7F2] text-[#8C2E46] mt-0.5">
                                <AddressIcon className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-[#2C2420]">
                                    {addr.name || 'Recipient'}
                                  </span>
                                  {addr.label && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-[#FAF7F2] text-[#7A6458] rounded border border-[#EAE2D5] font-medium">
                                      {addr.label}
                                    </span>
                                  )}
                                  {addr.isDefault && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded border border-amber-200 font-bold">
                                      SAVED DEFAULT
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#5C4C42] mt-0.5 leading-relaxed">
                                  {formatFullAddress(addr)}
                                </p>
                                {addr.phone && (
                                  <p className="text-[11px] text-[#7A6458] mt-0.5 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{addr.phone}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!addr.isDefault && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                  className="text-[10px] px-2 py-1 rounded bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#8C2E46] font-semibold border border-[#EAE2D5] cursor-pointer"
                                >
                                  Make Default
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAddress(addr.id)}
                                title="Delete address"
                                className="p-1 text-[#8C7A70] hover:text-rose-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Authentication Status */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3">
                <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider block">
                  Account Sign-In &amp; Sync
                </span>
                {isAuthenticated && user ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#2C2420]">{user.name}</p>
                      <p className="text-[11px] text-[#7A6458]">{user.email || user.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-[#7A6458]">
                      Sign in with Google to sync your points, wishlist, and orders across all devices.
                    </p>
                    <GoogleSignInButton variant="navbar" customText="Sign In with Google" />
                  </div>
                )}
                <p className="text-[10px] text-[#8C7A70] leading-relaxed pt-2 border-t border-[#FAF7F2]">
                  <strong>Privacy Notice:</strong> For signed-in accounts, Cotton Nest records website activity (including session duration, viewed products, wishlist saves, and search terms) to personalize your experience and improve store service. We never collect passwords, payment credentials, or precise GPS coordinates.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 border-t border-[#EAE2D5] bg-white flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-[#7A6458]">
            Cotton Nest Atelier · 100% Pure Cotton Guarantee
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] font-semibold rounded-xl border border-[#EAE2D5] cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

      <InvoiceModal
        order={invoiceModalOrder}
        isOpen={Boolean(invoiceModalOrder)}
        onClose={() => setInvoiceModalOrder(null)}
      />
    </div>
  );
};
