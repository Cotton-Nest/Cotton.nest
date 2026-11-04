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
  Bookmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { WishlistItem, CustomerProfile, saveCurrentCustomerProfile } from '../data/wishlist';
import { Order } from '../data/orders';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { GoogleSignInButton } from './GoogleSignInButton';
import { SavedAddress, getSavedAddresses, saveAddressToBook, deleteSavedAddress, setDefaultAddress, formatFullAddress } from '../data/addresses';

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
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { pointsBalance, pointsRupeesValue, transactions } = useLoyalty();

  // Active view tab inside account modal: 'overview' | 'loyalty' | 'wishlist' | 'orders' | 'profile'
  const [activeTab, setActiveTab] = useState<'overview' | 'loyalty' | 'wishlist' | 'orders' | 'profile'>('overview');
  
  // Edit profile state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState({
    name: customerProfile?.name || user?.name || 'Customer',
    phone: customerProfile?.phone || user?.phone || '+91 7838625915',
    email: customerProfile?.email || user?.email || '',
    address: customerProfile?.address || 'House number 2508 Ground floor, Sector 46',
    city: customerProfile?.city || 'Gurgaon, Haryana',
    pincode: customerProfile?.pincode || '122003',
  });

  // Saved Addresses book state
  const [addressBook, setAddressBook] = useState<SavedAddress[]>(() => getSavedAddresses(customerProfile, orders));
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

  useEffect(() => {
    if (isOpen) {
      setAddressBook(getSavedAddresses(customerProfile, orders));
    }
  }, [isOpen, customerProfile, orders]);

  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
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
      });
      setAddressBook(updatedBook);
    }
    onUpdateProfile(updated);
    setIsEditingAddress(false);
  };

  const handleSetDefaultAddress = (id: string) => {
    const updated = setDefaultAddress(id);
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
    const updated = deleteSavedAddress(id);
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
    });
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

  // Filter orders relevant to this user/phone/email
  const customerOrders = orders.filter((o) => {
    if (user?.email && o.customerEmail?.toLowerCase() === user.email.toLowerCase()) return true;
    if (customerProfile?.phone && o.customerPhone === customerProfile.phone) return true;
    return true; // fallback to show recent store orders
  }).slice(0, 10);

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
            { id: 'loyalty', label: 'Points & Rewards', count: `${pointsBalance} pts`, icon: Award },
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
              
              {/* Royal Club Loyalty Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-[#FAF7F2] to-amber-100/60 border border-amber-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#C29E57]" />
                    <span className="font-serif-luxury font-bold text-sm text-[#70252D]">
                      Royal Club Loyalty Points Wallet
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    Earn 1 pt / ₹50
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-3xl font-extrabold font-mono text-[#70252D]">
                      {pointsBalance}
                    </span>
                    <span className="text-xs font-semibold text-amber-900 ml-1.5">Points Balance</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    ≈ ₹{pointsRupeesValue} off at checkout
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('loyalty')}
                    className="text-[#8C2E46] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>View Points History &amp; How to Redeem</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

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

              {/* Delivery Address Preview Card */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#8C2E46]" />
                    <span>Gurgaon Delivery Address</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="text-[11px] font-bold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Address</span>
                  </button>
                </div>
                <p className="text-xs text-[#2C2420] font-medium leading-relaxed">
                  {customerProfile?.address || 'House number 2508 Ground floor, Sector 46'}, {customerProfile?.city || 'Gurgaon, Haryana'} – {customerProfile?.pincode || '122003'}
                </p>
                <p className="text-[11px] text-[#7A6458]">
                  Contact: {customerProfile?.phone || user?.phone || '+91 7838625915'} · Same-day delivery in Sector 46
                </p>
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

          {/* TAB 2: LOYALTY & REWARDS */}
          {activeTab === 'loyalty' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-[#FAF7F2] border border-amber-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#C29E57]" />
                    Royal Club Points Wallet
                  </span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    1 pt = ₹1 discount
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-[#70252D]">{pointsBalance}</span>
                  <span className="text-sm font-semibold text-amber-900">Total Points Available</span>
                </div>
                <p className="text-xs text-[#7A6458] leading-relaxed">
                  Earn 1 loyalty point for every ₹50 spent across the entire Cotton Nest store. Points can be directly toggled at checkout to deduct ₹{pointsRupeesValue} from your order total!
                </p>
                {onOpenCart && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCart();
                    }}
                    className="px-4 py-2 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    Apply Points at Checkout →
                  </button>
                )}
              </div>

              {/* Transactions History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider">
                  Points History
                </h4>
                {transactions && transactions.length > 0 ? (
                  <div className="divide-y divide-[#EAE2D5] bg-white rounded-2xl border border-[#EAE2D5]">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#2C2420]">{tx.description}</p>
                          <p className="text-[10px] text-[#8C7A70]">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`font-mono font-bold text-sm ${
                          tx.type === 'earned' || tx.type === 'bonus' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {tx.type === 'earned' || tx.type === 'bonus' ? `+${tx.points}` : `-${tx.points}`} pts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-white rounded-2xl border border-[#EAE2D5] text-center text-xs text-[#8C7A70]">
                    No point transactions yet. Purchase any bedsheet to begin earning points!
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
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full capitalize bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {order.status}
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
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#EAE2D5] text-xs">
                        <span className="text-[#7A6458]">Total Paid: <strong className="text-[#2C2420]">₹{order.totalAmount}</strong></span>
                        <a
                          href={COMPANY_DETAILS.whatsappUrl(`Hello Cotton Nest, I would like an update on my order #${order.id}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8C2E46] font-semibold hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>WhatsApp Order Support</span>
                        </a>
                      </div>
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

          {/* TAB 5: PROFILE & ADDRESS */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-2">
                  <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#8C2E46]" />
                    <span>Customer Details &amp; Shipping Address</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(!isEditingAddress)}
                    className="text-xs text-[#8C2E46] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingAddress ? 'Cancel' : 'Edit'}</span>
                  </button>
                </div>

                {isEditingAddress ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={addressDraft.name}
                          onChange={(e) => setAddressDraft({ ...addressDraft, name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={addressDraft.phone}
                          onChange={(e) => setAddressDraft({ ...addressDraft, phone: e.target.value })}
                          className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">Delivery Address</label>
                      <input
                        type="text"
                        value={addressDraft.address}
                        onChange={(e) => setAddressDraft({ ...addressDraft, address: e.target.value })}
                        placeholder="House / Flat No, Street, Landmark"
                        className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">City / Region</label>
                        <input
                          type="text"
                          value={addressDraft.city}
                          onChange={(e) => setAddressDraft({ ...addressDraft, city: e.target.value })}
                          className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">Pincode</label>
                        <input
                          type="text"
                          value={addressDraft.pincode}
                          onChange={(e) => setAddressDraft({ ...addressDraft, pincode: e.target.value })}
                          className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-[#8C2E46] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Address Changes</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <p><strong>Name:</strong> {customerProfile?.name || addressDraft.name}</p>
                    <p><strong>Phone:</strong> {customerProfile?.phone || addressDraft.phone}</p>
                    <p><strong>Address:</strong> {customerProfile?.address || addressDraft.address}, {customerProfile?.city || addressDraft.city} – {customerProfile?.pincode || addressDraft.pincode}</p>
                  </div>
                )}
              </div>

              {/* SAVED ADDRESS BOOK */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-2">
                  <div>
                    <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-4 h-4 text-[#8C2E46]" />
                      <span>Saved Delivery Addresses ({addressBook.length})</span>
                    </span>
                    <p className="text-[11px] text-[#7A6458] mt-0.5">
                      Usable directly in your shopping bag during checkout.
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
                      {/* Label selector */}
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
                    No addresses saved yet. They will automatically be saved as you place orders or add them here.
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
                                      DEFAULT
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
                              {addressBook.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAddress(addr.id)}
                                  title="Delete address"
                                  className="p-1 text-[#8C7A70] hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
    </div>
  );
};
