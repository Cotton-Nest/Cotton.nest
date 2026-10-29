import React, { useEffect, useState } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, MapPin, Package, Truck, Tag, Sparkles, Check, Gift, Percent } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { Order } from '../data/orders';
import { saveOrder, getCouponsApi, validateCouponApi, recordCouponUseApi } from '../services/api';
import { sendWhatsAppCartOrder } from '../utils/whatsappOrder';
import { useAuth } from '../context/AuthContext';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { CouponOffer, evaluateCouponEligibility } from '../data/coupons';

export interface CartItem {
  product: BedsheetProduct;
  quantity: number;
  selectedVariant?: BedsheetVariant;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOrderPlaced?: (order: Order) => void;
  onViewLiveOrders?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  onViewLiveOrders,
}) => {
  const { user } = useAuth();
  const [checkoutStep, setCheckoutStep] = React.useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerAddress, setCustomerAddress] = React.useState('');
  const [customerNotes, setCustomerNotes] = React.useState('');
  const [shippingOption, setShippingOption] = React.useState<'india' | 'sector46' | 'gurgaon'>('india');
  const [lastOrderDetails, setLastOrderDetails] = React.useState<{
    orderId: string;
    total: number;
    summary: string;
    whatsappUrl: string;
  } | null>(null);

  // Coupon & Offer State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponOffer | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<CouponOffer[]>([]);
  const [showOffersList, setShowOffersList] = useState(false);

  // Auto-fill from authenticated Google or Phone session
  useEffect(() => {
    if (user) {
      if (user.name && !customerName) setCustomerName(user.name);
      if (user.phone && !customerPhone) setCustomerPhone(user.phone);
    }
  }, [user]);

  // Load available coupons on drawer open
  useEffect(() => {
    let isMounted = true;
    getCouponsApi().then((data) => {
      if (isMounted && Array.isArray(data)) {
        setAvailableCoupons(data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const validItems = (items || []).filter(
    (item) => item && item.product && typeof item.product === 'object' && item.product.id
  );

  const subtotal = validItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const price = typeof item.product?.price === 'number' && !isNaN(item.product.price) ? item.product.price : 0;
    return sum + price * qty;
  }, 0);

  const originalSubtotal = validItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const orig = typeof item.product?.originalPrice === 'number' && !isNaN(item.product.originalPrice)
      ? item.product.originalPrice
      : (typeof item.product?.price === 'number' && !isNaN(item.product.price) ? item.product.price : 0);
    return sum + orig * qty;
  }, 0);

  const catalogSavings = Math.max(0, originalSubtotal - subtotal);
  const effectiveCouponDiscount = couponDiscount || 0;
  const totalSavings = catalogSavings + effectiveCouponDiscount;
  const shippingCost = shippingOption === 'india' ? 100 : 0;
  const finalTotal = Math.max(0, subtotal - effectiveCouponDiscount) + shippingCost;

  // Auto-apply or re-validate coupons when bag items or subtotal change
  useEffect(() => {
    if (validItems.length === 0) {
      if (appliedCoupon) {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponSuccessMessage(null);
        setCouponError(null);
      }
      return;
    }

    // If an explicit manual coupon is already applied, re-validate it against current cart
    if (appliedCoupon && !appliedCoupon.isAutomatic) {
      const evalRes = evaluateCouponEligibility(appliedCoupon, validItems, subtotal, customerPhone.trim() || user?.email);
      if (evalRes.isEligible) {
        if (couponDiscount !== evalRes.discountAmount) {
          setCouponDiscount(evalRes.discountAmount);
        }
        setCouponError(null);
      } else {
        setCouponError(evalRes.reason || 'Coupon no longer qualifies for this updated bag.');
        setCouponDiscount(0);
      }
      return;
    }

    // Check for automatic offers if no manual coupon is active
    if (!appliedCoupon || appliedCoupon.isAutomatic) {
      const autoCoupons = availableCoupons.filter((c) => c && c.isActive && c.isAutomatic);
      let bestAuto: { coupon: CouponOffer; discount: number } | null = null;

      for (const ac of autoCoupons) {
        const res = evaluateCouponEligibility(ac, validItems, subtotal, customerPhone.trim() || user?.email);
        if (res.isEligible && res.discountAmount > (bestAuto?.discount || 0)) {
          bestAuto = { coupon: ac, discount: res.discountAmount };
        }
      }

      if (bestAuto) {
        if (appliedCoupon?.id !== bestAuto.coupon.id || couponDiscount !== bestAuto.discount) {
          setAppliedCoupon(bestAuto.coupon);
          setCouponDiscount(bestAuto.discount);
          setCouponSuccessMessage(`🎁 Auto-applied: ${bestAuto.coupon.title}`);
          setCouponError(null);
        }
      } else if (appliedCoupon?.isAutomatic) {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponSuccessMessage(null);
      }
    }
  }, [validItems.length, subtotal, availableCoupons.length, customerPhone, user?.email]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply || couponCodeInput).trim().toUpperCase();
    if (!targetCode) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const result = await validateCouponApi(
        targetCode,
        items,
        subtotal,
        customerPhone.trim() || user?.email
      );

      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponDiscount(result.discountAmount);
        setCouponSuccessMessage(`✓ Coupon ${result.coupon.code} applied! ₹${result.discountAmount.toLocaleString('en-IN')} saved.`);
        setCouponError(null);
        setCouponCodeInput('');
      } else {
        setCouponError(result.error || 'This coupon code could not be applied.');
      }
    } catch {
      setCouponError('Failed to validate coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponSuccessMessage(null);
    setCouponError(null);
    setCouponCodeInput('');
  };

  const shippingLabel =
    shippingOption === 'india'
      ? 'Across India (₹100)'
      : shippingOption === 'sector46'
      ? 'Sector 46, Gurgaon (Complimentary)'
      : 'Rest of Gurgaon (Self Pickup / On Actuals)';

  const [formError, setFormError] = useState<string | null>(null);

  const handlePlaceWhatsAppOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      setFormError('Please enter your Name, WhatsApp Mobile Number, and Delivery Address.');
      return;
    }
    setFormError(null);

    const orderId = `CN-${Math.floor(100000 + Math.random() * 900000)}`;

    const fullMessage = await sendWhatsAppCartOrder({
      orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerNotes: customerNotes.trim() || undefined,
      subtotal,
      totalSavings,
      couponCode: appliedCoupon?.code,
      couponDiscount: effectiveCouponDiscount,
      shippingMethod: shippingLabel,
      shippingCost,
      items: items.map((i) => ({
        name: i.product.name,
        variantName: i.selectedVariant?.name,
        dimensions: i.product.dimensions,
        quantity: i.quantity,
        price: i.product.price,
        imageUrl: i.selectedVariant?.image || i.product.image,
      })),
    });

    const waUrl = COMPANY_DETAILS.whatsappUrl(fullMessage);

    const createdOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: user?.email || undefined,
      userId: user?.id || undefined,
      customerAddress: customerAddress.trim(),
      paymentMethod: 'whatsapp',
      status: 'pending',
      totalAmount: finalTotal,
      totalSavings,
      couponCode: appliedCoupon?.code,
      couponDiscount: effectiveCouponDiscount,
      notes: customerNotes.trim() || undefined,
      items: items.map((i) => ({
        productId: i.product.id,
        productName: i.selectedVariant ? `${i.product.name} - ${i.selectedVariant.name}` : i.product.name,
        productImage: i.selectedVariant?.image || i.product.image,
        dimensions: i.product.dimensions,
        price: i.product.price,
        quantity: i.quantity,
      })),
    };

    // Save to server backend & local storage / Firestore
    saveOrder(createdOrder);

    // Record coupon usage in Firestore/backend if coupon was applied
    if (appliedCoupon) {
      recordCouponUseApi(appliedCoupon.id, customerPhone.trim() || user?.email).catch(() => {});
    }

    if (onOrderPlaced) {
      onOrderPlaced(createdOrder);
    }

    setLastOrderDetails({
      orderId,
      total: subtotal,
      summary: fullMessage,
      whatsappUrl: waUrl,
    });

    setCheckoutStep('success');
  };

  const handleDone = () => {
    onClearCart();
    setCheckoutStep('cart');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#2C2420]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[var(--color-surface,#FFFFFF)] h-full shadow-2xl flex flex-col z-10 border-l border-[var(--color-border,#EAE2D5)] text-[var(--color-text,#2C2420)]">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAE2D5] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#8C2E46]" />
            <h2 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
              {checkoutStep === 'cart' && `Shopping Bag (${items.length})`}
              {checkoutStep === 'checkout' && 'Complete Order on WhatsApp'}
              {checkoutStep === 'success' && 'Order Placed via WhatsApp'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#6B5D55] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* STEP 1: CART ITEMS LIST */}
          {checkoutStep === 'cart' && (
            <>
              {validItems.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[#F4EFE6] flex items-center justify-center mx-auto text-[#8C7A70]">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-[#2C2420]">Your bag is currently empty</p>
                  <p className="text-xs text-[#7A6458]">
                    Explore our 100% natural cotton bedsheets to add to your order.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validItems.map((item) => {
                    const displayImg = resolveBedsheetImage(item.selectedVariant?.image || item.product.image);
                    const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : 1;
                    const itemPrice = typeof item.product.price === 'number' && !isNaN(item.product.price) ? item.product.price : 0;
                    return (
                      <div
                        key={`${item.product.id}-${item.selectedVariant?.id || 'base'}`}
                        className="flex gap-3 p-3 bg-white rounded-2xl border border-[#EAE2D5] shadow-xs"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4EFE6] shrink-0 border border-[#EAE2D5]">
                          <img
                            src={displayImg}
                            alt={item.product.name}
                            onError={handleImageFallback}
                            className="w-full h-full object-cover object-center"
                          />
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h3 className="font-serif-luxury text-sm font-bold text-[#2C2420] leading-snug">
                                {item.product.name}
                              </h3>
                              <button
                                onClick={() => onRemoveItem(item.product.id)}
                                className="text-[#8C7A70] hover:text-red-600 p-0.5 cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {item.selectedVariant && (
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-[#8C2E46]">
                                {item.selectedVariant.colorHex && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block"
                                    style={{ backgroundColor: item.selectedVariant.colorHex }}
                                  />
                                )}
                                <span>Color: {item.selectedVariant.name}</span>
                              </div>
                            )}

                            <p className="text-[11px] text-[#7A6458] mt-0.5">
                              {item.product.dimensions}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center border border-[#EAE2D5] rounded-lg bg-[#FAF7F2]">
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, Math.max(1, qty - 1))}
                                className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-semibold text-[#2C2420]">
                                {qty}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, qty + 1)}
                                className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-sm font-bold text-[#2C2420] tabular-nums">
                              ₹{(itemPrice * qty).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* STEP 2: CHECKOUT DETAILS & WHATSAPP LINK */}
          {checkoutStep === 'checkout' && (
            <form id="whatsapp-order-form" onSubmit={handlePlaceWhatsAppOrder} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}
              <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] text-xs space-y-1">
                <p className="font-semibold text-[#2C2420]">Order Summary</p>
                <p className="text-[#6B5D55]">
                  {items.length} bedsheet{items.length > 1 ? 's' : ''} (Total: ₹{subtotal.toLocaleString('en-IN')})
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Radhika Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    WhatsApp Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                {/* Shipping & Delivery Option Selector */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#2C2420]">
                      Shipping &amp; Delivery Option *
                    </label>
                    <span className="text-[11px] text-[#8C2E46] font-medium">As per T&amp;C</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <label
                      onClick={() => setShippingOption('india')}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'india'
                          ? 'border-[#8C2E46] bg-[#FDEAF0]/40 ring-1 ring-[#8C2E46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingOption === 'india'}
                          onChange={() => setShippingOption('india')}
                          className="accent-[#8C2E46]"
                        />
                        <div>
                          <p className="font-semibold text-[#2C2420]">Across India</p>
                          <p className="text-[11px] text-[#7A6458]">Standard Courier Delivery</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#8C2E46]">+₹100</span>
                    </label>

                    <label
                      onClick={() => setShippingOption('sector46')}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'sector46'
                          ? 'border-[#2E7D46] bg-[#EAF7EE]/60 ring-1 ring-[#2E7D46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingOption === 'sector46'}
                          onChange={() => setShippingOption('sector46')}
                          className="accent-[#2E7D46]"
                        />
                        <div>
                          <p className="font-semibold text-[#2C2420]">Sector 46, Gurgaon</p>
                          <p className="text-[11px] text-[#7A6458]">Complimentary Local Delivery</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#2E7D46] uppercase text-[11px]">Free</span>
                    </label>

                    <label
                      onClick={() => setShippingOption('gurgaon')}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'gurgaon'
                          ? 'border-[#8C2E46] bg-[#FDEAF0]/40 ring-1 ring-[#8C2E46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingOption === 'gurgaon'}
                          onChange={() => setShippingOption('gurgaon')}
                          className="accent-[#8C2E46]"
                        />
                        <div>
                          <p className="font-semibold text-[#2C2420]">Rest of Gurgaon</p>
                          <p className="text-[11px] text-[#7A6458]">Self Pickup / On Actuals</p>
                        </div>
                      </div>
                      <span className="font-medium text-[#7A6458] text-[11px]">On Actuals / Pickup</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Complete Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="House/Flat No., Tower/Apartment, Sector/Area, City, Pincode"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Special Request or Question (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Please send video of fabric texture / evening delivery"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                {/* Direct WhatsApp Ordering Reassurance (No COD/UPI) */}
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-emerald-950">
                    <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Direct WhatsApp Order &amp; Dispatch</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Clicking the button below directly opens WhatsApp with your bedsheets list and address pre-filled. Our founder confirms your order, answers any queries, and arranges prompt delivery from our Sector 46 Gurgaon Atelier.
                  </p>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: ORDER SUCCESS */}
          {checkoutStep === 'success' && lastOrderDetails && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  WhatsApp Order Created!
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Order Ref: <strong>#{lastOrderDetails.orderId}</strong>
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-[#EAE2D5] pb-1.5 font-semibold text-[#2C2420]">
                  <span>Total Amount</span>
                  <span>₹{lastOrderDetails.total.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-[#6B5D55] leading-relaxed">
                  Your order has been recorded in our store management system. A WhatsApp chat with full item specifications has been prepared for you.
                </p>
              </div>

              <a
                href={lastOrderDetails.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Open WhatsApp Chat Now</span>
              </a>

              {onViewLiveOrders && (
                <button
                  type="button"
                  onClick={() => {
                    handleDone();
                    onViewLiveOrders();
                  }}
                  className="w-full py-3 px-4 bg-[#2C2420] hover:bg-[#3D332D] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4 text-[#C29E57]" />
                  <span>Track Live Order &amp; Delivery Status</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDone}
                className="w-full py-2 text-xs text-[#7A6458] hover:text-[#2C2420] font-semibold cursor-pointer"
              >
                Continue Browsing
              </button>
            </div>
          )}

        </div>

        {/* Drawer Footer Actions */}
        {checkoutStep === 'cart' && items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-white space-y-3.5">
            {/* Promo Code & Offers Module */}
            <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Coupons &amp; Offers</span>
                </span>
                {availableCoupons.filter((c) => c.isActive).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOffersList(!showOffersList)}
                    className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Gift className="w-3 h-3" />
                    <span>{showOffersList ? 'Hide Offers' : `View Offers (${availableCoupons.filter((c) => c.isActive).length})`}</span>
                  </button>
                )}
              </div>

              {/* Applied Coupon Pill */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-emerald-300 text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                      %
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold tracking-wider text-[#2C2420]">{appliedCoupon.code}</span>
                        {appliedCoupon.isAutomatic && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        Saving ₹{effectiveCouponDiscount.toLocaleString('en-IN')} on this order
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 text-[#8C7A70] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove coupon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyCoupon();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => {
                      setCouponCodeInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    placeholder="Enter Coupon Code"
                    className="flex-1 px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs font-semibold text-[#2C2420] tracking-wider uppercase placeholder:normal-case placeholder:font-normal placeholder:text-[#9B8C83] focus:outline-none focus:border-[#8C2E46]"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCodeInput.trim()}
                    className="px-4 py-2 bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {couponLoading ? 'Checking...' : 'Apply'}
                  </button>
                </form>
              )}

              {/* Status alerts */}
              {couponSuccessMessage && (
                <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{couponSuccessMessage}</span>
                </p>
              )}
              {couponError && (
                <p className="text-[11px] font-medium text-rose-600">
                  {couponError}
                </p>
              )}

              {/* Expandable Offers Picker Drawer */}
              {showOffersList && (
                <div className="pt-2 border-t border-[#EAE2D5] space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableCoupons
                    .filter((c) => c.isActive)
                    .map((coupon) => {
                      const isCurrent = appliedCoupon?.code === coupon.code;
                      return (
                        <div
                          key={coupon.id}
                          className="p-2 bg-white rounded-xl border border-[#EAE2D5] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold tracking-wider text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded text-[10px]">
                              {coupon.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isCurrent) {
                                  handleRemoveCoupon();
                                } else {
                                  handleApplyCoupon(coupon.code);
                                }
                              }}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-[#FAF7F2] text-[#8C2E46] border border-[#FAD1DC] hover:bg-[#8C2E46] hover:text-white'
                              }`}
                            >
                              {isCurrent ? 'Applied ✓' : 'Apply Code'}
                            </button>
                          </div>
                          <p className="text-[11px] text-[#2C2420] font-medium">{coupon.title}</p>
                          {coupon.description && (
                            <p className="text-[10px] text-[#7A6458] leading-tight">{coupon.description}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#7A6458]">
                <span>Items Subtotal</span>
                <span className="font-semibold text-[#2C2420]">₹{originalSubtotal.toLocaleString('en-IN')}</span>
              </div>
              {catalogSavings > 0 && (
                <div className="flex justify-between text-[#8C7A70]">
                  <span>Catalog Discount</span>
                  <span className="font-medium">-₹{catalogSavings.toLocaleString('en-IN')}</span>
                </div>
              )}
              {effectiveCouponDiscount > 0 && (
                <div className="flex justify-between text-[#8C2E46] font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Coupon ({appliedCoupon?.code || 'Offer'})</span>
                  </span>
                  <span>-₹{effectiveCouponDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-[#7A6458]">
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3 text-[#B83F60]" />
                  <span>Shipping ({shippingOption === 'india' ? 'Across India' : shippingOption === 'sector46' ? 'Sec 46' : 'Gurgaon'})</span>
                </span>
                <span className="font-semibold text-[#2C2420]">
                  {shippingCost > 0 ? `+₹${shippingCost}` : shippingOption === 'sector46' ? 'FREE' : 'On Actuals / Pickup'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#2C2420] pt-1.5 border-t border-[#EAE2D5]">
                <span>Order Total</span>
                <span className="text-base text-[#8C2E46]">₹{finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button
              onClick={() => setCheckoutStep('checkout')}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Proceed to WhatsApp Checkout (₹{finalTotal.toLocaleString('en-IN')})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {checkoutStep === 'checkout' && (
          <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-white flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCheckoutStep('cart')}
              className="py-3 px-4 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] border border-[#EAE2D5] rounded-xl hover:bg-[#FAF7F2] transition-colors"
            >
              Back
            </button>

            <button
              type="submit"
              form="whatsapp-order-form"
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send Order on WhatsApp (₹{finalTotal.toLocaleString('en-IN')})</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
