import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, MapPin, Package, Truck, Tag, Sparkles, Check, Gift, Percent, AlertCircle, Award, Plus, Home, Briefcase, Bookmark, CheckSquare, Square, Mail, FileText } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { Order } from '../data/orders';
import { saveOrder, getCouponsApi, validateCouponApi, recordCouponUseApi, isVideoMedia } from '../services/api';
import { sendWhatsAppCartOrder } from '../utils/whatsappOrder';
import { useAuth } from '../context/AuthContext';
import { useLoyalty } from '../context/LoyaltyContext';
import {
  calculateEarnedPoints,
  calculatePointsDiscount,
  calculatePointsForRupeeDiscount,
  canRedeemPoints,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_POINTS_PER_100_INR,
} from '../data/loyalty';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { CouponOffer, evaluateCouponEligibility } from '../data/coupons';
import { SavedAddress, getSavedAddresses, saveAddressToBook, formatFullAddress } from '../data/addresses';
import { CustomerProfile, saveCurrentCustomerProfile } from '../data/wishlist';
import { InvoiceModal, buildOrderGmailUrl } from './InvoiceModal';

interface SwipeableCartItemProps {
  onRemove: () => void;
  children: React.ReactNode;
}

const SwipeableCartItem: React.FC<SwipeableCartItemProps> = ({ onRemove, children }) => {
  const [isSnapOpen, setIsSnapOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const x = useMotionValue(0);
  const iconScale = useTransform(x, [-120, -50, 0], [1.2, 1, 0.75]);
  const bgOpacity = useTransform(x, [-90, -15, 0], [1, 0.9, 0]);

  const triggerRemove = () => {
    if (isRemoving) return;
    setIsRemoving(true);
    setTimeout(() => {
      onRemove();
    }, 180);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;

    // Full swipe left or fast flick left -> remove item immediately
    if (offsetX < -115 || (offsetX < -55 && velocityX < -450)) {
      triggerRemove();
      return;
    }

    // Partial swipe left -> snap open to reveal the Remove button
    if (offsetX < -45 && !isSnapOpen) {
      setIsSnapOpen(true);
    } else if (offsetX > 25 && isSnapOpen) {
      setIsSnapOpen(false);
    } else if (offsetX >= -45 && !isSnapOpen) {
      setIsSnapOpen(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={isRemoving ? { opacity: 0, x: -320, height: 0, marginBottom: 0 } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -300, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-2xl select-none"
    >
      {/* Background Destructive Action Track */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-gradient-to-l from-rose-600 to-[#8C2E46] rounded-2xl flex items-center justify-end pr-4"
      >
        <button
          type="button"
          onClick={triggerRemove}
          className="flex flex-col items-center justify-center text-white font-semibold text-[11px] gap-1 px-2 py-1.5 cursor-pointer"
          aria-label="Confirm remove item"
        >
          <motion.div style={{ scale: iconScale }}>
            <Trash2 className="w-4 h-4 text-white" />
          </motion.div>
          <span>Remove</span>
        </button>
      </motion.div>

      {/* Foreground Draggable Item Card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={{ left: 0.45, right: 0.05 }}
        animate={{ x: isRemoving ? -340 : isSnapOpen ? -84 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isSnapOpen) setIsSnapOpen(false);
        }}
        className="relative z-10 touch-pan-y"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

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
  shippingFee?: number;
  customerProfile?: CustomerProfile | null;
  orders?: Order[];
  onOpenAuthModal?: () => void;
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
  shippingFee = 29,
  customerProfile,
  orders = [],
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const {
    pointsBalance,
    earnPoints,
    redeemPoints,
    openLoyaltyModal,
    preferRedeemAtCheckout,
    setPreferRedeemAtCheckout,
  } = useLoyalty();
  const [checkoutStep, setCheckoutStep] = React.useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [customerAddress, setCustomerAddress] = React.useState('');
  const [shippingOption, setShippingOption] = React.useState<'india' | 'sector46' | 'gurgaon'>('india');
  const [lastOrderDetails, setLastOrderDetails] = React.useState<{
    orderId: string;
    total: number;
    summary: string;
    whatsappUrl: string;
    pointsEarned?: number;
    pointsUsed?: number;
    pointsDiscount?: number;
    order?: Order;
    gmailComposeUrl?: string;
  } | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  // Loyalty Points State synced with Customer Account preference
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState<boolean>(false);

  useEffect(() => {
    if (preferRedeemAtCheckout && canRedeemPoints(pointsBalance)) {
      setUseLoyaltyPoints(true);
    } else if (!canRedeemPoints(pointsBalance)) {
      setUseLoyaltyPoints(false);
    }
  }, [preferRedeemAtCheckout, pointsBalance]);

  // Coupon & Offer State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponOffer | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<CouponOffer[]>([]);
  const [showOffersList, setShowOffersList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const userKey = user?.email || user?.id || customerProfile?.id || null;

  // Saved Addresses State strictly scoped to the individual customer
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() =>
    getSavedAddresses(customerProfile, userKey)
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [saveToAddressBook, setSaveToAddressBook] = useState<boolean>(true);
  const [newAddressLabel, setNewAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

  // Structured New Address States
  const [newAddressName, setNewAddressName] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [newAddressHouse, setNewAddressHouse] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('Gurgaon, Haryana');
  const [newAddressPincode, setNewAddressPincode] = useState('122003');

  const handleSaveNewAddress = () => {
    const house = newAddressHouse.trim();
    const street = newAddressStreet.trim();
    const city = newAddressCity.trim() || 'Gurgaon, Haryana';
    const pincode = newAddressPincode.trim() || '122003';
    const name = newAddressName.trim() || customerName || 'Cotton Nest';
    const phone = newAddressPhone.trim() || customerPhone;

    if (!house || !street || !pincode) {
      setFormError('Please fill in House/Flat No., Street/Area, and Pincode.');
      return;
    }

    const addressLine = `${house}, ${street}`;
    const formatted = formatFullAddress({ addressLine, city, pincode });

    setCustomerAddress(formatted);
    if (name) setCustomerName(name);
    if (phone) setCustomerPhone(phone);

    if (saveToAddressBook) {
      try {
        const updatedList = saveAddressToBook({
          label: newAddressLabel,
          name,
          phone,
          addressLine,
          city,
          pincode,
          isDefault: savedAddresses.length === 0,
        }, userKey);
        setSavedAddresses(updatedList);
        const added = updatedList[0];
        if (added) setSelectedAddressId(added.id);
      } catch (err) {
        console.warn('Error saving new address:', err);
      }
    }

    setIsAddingNewAddress(false);
    setFormError(null);
  };

  // Sync saved addresses on open strictly for the individual customer
  useEffect(() => {
    if (isOpen) {
      const addrs = getSavedAddresses(customerProfile, userKey);
      setSavedAddresses(addrs);
      setSelectedAddressId(null);
      setCustomerAddress('');
      if (addrs.length === 0) {
        setIsAddingNewAddress(true);
      } else {
        setIsAddingNewAddress(false);
      }
    }
  }, [isOpen, customerProfile, userKey]);

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setIsAddingNewAddress(false);
    const formatted = formatFullAddress(addr);
    setCustomerAddress(formatted);
    if (addr.name) setCustomerName(addr.name);
    if (addr.phone) setCustomerPhone(addr.phone);

    // Auto-zone detection for user convenience
    const lower = formatted.toLowerCase();
    if (lower.includes('sector 46') || lower.includes('sec 46') || lower.includes('sec-46')) {
      setShippingOption('sector46');
    } else if (lower.includes('gurgaon') || lower.includes('gurugram')) {
      if (shippingOption === 'india') {
        setShippingOption('gurgaon');
      }
    }
  };

  const handleStartNewAddress = () => {
    setSelectedAddressId(null);
    setIsAddingNewAddress(true);
    setCustomerAddress('');
  };

  // Auto-fill from authenticated Google or Phone session
  useEffect(() => {
    if (user) {
      if (user.name && !customerName) setCustomerName(user.name);
      if (user.phone && !customerPhone) setCustomerPhone(user.phone);
      if (user.email && !customerEmail) setCustomerEmail(user.email);
    } else if (customerProfile) {
      if (customerProfile.email && !customerEmail) setCustomerEmail(customerProfile.email);
    }
  }, [user, customerProfile]);

  // Load available coupons on drawer open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    getCouponsApi().then((data) => {
      if (isMounted && Array.isArray(data)) {
        setAvailableCoupons(data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [isOpen]);

  // Strict guard clause for complete product metadata
  const isCompleteProduct = (product: any): boolean => {
    return Boolean(
      product &&
      typeof product === 'object' &&
      typeof product.id === 'string' &&
      product.id.trim() !== '' &&
      typeof product.name === 'string' &&
      product.name.trim() !== '' &&
      typeof product.price === 'number' &&
      !isNaN(product.price) &&
      product.price >= 0
    );
  };

  const validItems = React.useMemo(() => {
    return (items || [])
      .filter((item): item is CartItem =>
        Boolean(item && typeof item === 'object' && isCompleteProduct(item?.product))
      )
      .map((item) => {
        let cleanVariant: BedsheetVariant | undefined = undefined;
        if (
          item?.selectedVariant &&
          typeof item.selectedVariant === 'object' &&
          typeof item.selectedVariant.name === 'string' &&
          item.selectedVariant.name.trim() !== ''
        ) {
          cleanVariant = {
            id: String(item.selectedVariant.id || 'variant-default'),
            name: item.selectedVariant.name.trim(),
            image:
              typeof item.selectedVariant.image === 'string' && item.selectedVariant.image.trim() !== ''
                ? item.selectedVariant.image.trim()
                : typeof item.product?.image === 'string'
                ? item.product.image
                : '',
            colorHex:
              typeof item.selectedVariant.colorHex === 'string' && item.selectedVariant.colorHex.trim() !== ''
                ? item.selectedVariant.colorHex.trim()
                : undefined,
          };
        }
        const rawQty = typeof item?.quantity === 'number' ? item.quantity : Number(item?.quantity);
        const qty = !isNaN(rawQty) && rawQty > 0 ? Math.round(rawQty) : 1;
        return {
          ...item,
          quantity: qty,
          selectedVariant: cleanVariant,
        };
      });
  }, [items]);

  const subtotal = React.useMemo(() => {
    return validItems.reduce((sum, item) => {
      const qty = typeof item?.quantity === 'number' && !isNaN(item?.quantity) && item?.quantity > 0 ? item.quantity : 1;
      const price = typeof item?.product?.price === 'number' && !isNaN(item?.product?.price) ? item.product.price : 0;
      return sum + price * qty;
    }, 0);
  }, [validItems]);

  const originalSubtotal = React.useMemo(() => {
    return validItems.reduce((sum, item) => {
      const qty = typeof item?.quantity === 'number' && !isNaN(item?.quantity) && item?.quantity > 0 ? item.quantity : 1;
      const price = typeof item?.product?.price === 'number' && !isNaN(item?.product?.price) ? item.product.price : 0;
      const orig = typeof item?.product?.originalPrice === 'number' && !isNaN(item?.product?.originalPrice) && item.product.originalPrice >= price
        ? item.product.originalPrice
        : price;
      return sum + orig * qty;
    }, 0);
  }, [validItems]);

  const catalogSavings = Math.max(0, originalSubtotal - subtotal);
  const effectiveCouponDiscount = couponDiscount || 0;

  // Nest Points discount calculation: 100 points = ₹50 (₹0.50 per point), minimum 200 points required for redemption
  const netSubtotalAfterCoupon = Math.max(0, subtotal - effectiveCouponDiscount);
  const maxRedeemablePoints = canRedeemPoints(pointsBalance)
    ? Math.min(Math.max(0, pointsBalance), calculatePointsForRupeeDiscount(netSubtotalAfterCoupon))
    : 0;
  const canRedeemForThisOrder = maxRedeemablePoints >= LOYALTY_MIN_REDEMPTION_POINTS;
  const pointsToRedeem = useLoyaltyPoints && canRedeemForThisOrder ? maxRedeemablePoints : 0;
  const effectivePointsDiscount = calculatePointsDiscount(pointsToRedeem);

  const acrossIndiaFee =
    typeof shippingFee === 'number' && !isNaN(shippingFee) && shippingFee >= 0 && shippingFee !== 100
      ? Math.round(shippingFee)
      : 29;
  const totalSavings = catalogSavings + effectiveCouponDiscount + effectivePointsDiscount;
  const shippingCost = shippingOption === 'india' ? acrossIndiaFee : 0;
  // Net merchandise amount strictly excludes delivery charges (No points on delivery charges)
  const netMerchandiseAmount = Math.max(0, subtotal - effectiveCouponDiscount - effectivePointsDiscount);
  const finalTotal = netMerchandiseAmount + shippingCost;
  const pointsToEarn = calculateEarnedPoints(netMerchandiseAmount); // 5 points per ₹100 spent (excluding delivery charges)

  // Auto-apply or re-validate coupons when bag items or subtotal change
  useEffect(() => {
    if (!isOpen) return;
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
        validItems,
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
      ? `Across India (₹${acrossIndiaFee})`
      : shippingOption === 'sector46'
      ? 'Sector 46, Gurgaon (Complimentary)'
      : 'Rest of Gurgaon (Self Pickup / On Actuals)';

  const handlePlaceWhatsAppOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setFormError('Mandatory login required. Please log in before placing your order.');
      onOpenAuthModal?.();
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      setFormError('Please enter your Name, WhatsApp Mobile Number, and choose a Delivery Address.');
      return;
    }
    setFormError(null);

    const orderId = `CN-${Math.floor(100000 + Math.random() * 900000)}`;

    const fullMessage = await sendWhatsAppCartOrder({
      orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || user?.email || customerProfile?.email || undefined,
      customerAddress: customerAddress.trim(),
      subtotal,
      totalSavings,
      couponCode: appliedCoupon?.code,
      couponDiscount: effectiveCouponDiscount,
      pointsUsed: pointsToRedeem,
      pointsDiscount: effectivePointsDiscount,
      pointsEarned: pointsToEarn,
      shippingMethod: shippingLabel,
      shippingCost,
      items: validItems.map((i) => ({
        name: i?.product?.name || 'Handcrafted Bedsheet',
        variantName: i?.selectedVariant?.name,
        dimensions: i?.product?.dimensions || '108 x 108 inches',
        quantity: typeof i?.quantity === 'number' && !isNaN(i?.quantity) && i?.quantity > 0 ? i.quantity : 1,
        price: typeof i?.product?.price === 'number' && !isNaN(i?.product?.price) ? i.product.price : 0,
        imageUrl: i?.selectedVariant?.image || i?.product?.image || '',
      })),
    });

    const waUrl = COMPANY_DETAILS.whatsappUrl(fullMessage);

    const createdOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || user?.email || customerProfile?.email || undefined,
      userId: user?.id || undefined,
      customerAddress: customerAddress.trim(),
      paymentMethod: 'whatsapp',
      status: 'pending',
      invoiceSent: false,
      invoiceStatus: 'pending_confirmation',
      totalAmount: finalTotal,
      shippingCost,
      totalSavings,
      couponCode: appliedCoupon?.code,
      couponDiscount: effectiveCouponDiscount,
      pointsUsed: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      pointsDiscount: effectivePointsDiscount > 0 ? effectivePointsDiscount : undefined,
      pointsEarned: pointsToEarn > 0 ? pointsToEarn : undefined,
      pointsCredited: true,
      items: validItems.map((i) => {
        const pName = i?.product?.name || 'Handcrafted Bedsheet';
        const vName = i?.selectedVariant?.name;
        return {
          productId: i?.product?.id || `item-${Date.now()}`,
          productName: vName ? `${pName} - ${vName}` : pName,
          productImage: i?.selectedVariant?.image || i?.product?.image || '',
          dimensions: i?.product?.dimensions || '108 x 108 inches',
          size: i?.product?.size || 'King',
          variantId: i?.selectedVariant?.id,
          variantName: vName,
          price: typeof i?.product?.price === 'number' && !isNaN(i?.product?.price) ? i.product.price : 0,
          quantity: typeof i?.quantity === 'number' && !isNaN(i?.quantity) && i?.quantity > 0 ? i.quantity : 1,
        };
      }),
    };

    // Save to server backend & local storage / Firestore
    try {
      await saveOrder(createdOrder);
    } catch (err) {
      console.warn('saveOrder notice:', err);
    }

    // Save address to saved addresses book for future instant checkout
    if (saveToAddressBook && customerAddress.trim()) {
      try {
        const updatedList = saveAddressToBook({
          label: newAddressLabel,
          name: customerName.trim(),
          phone: customerPhone.trim(),
          addressLine: customerAddress.trim(),
        }, userKey);
        setSavedAddresses(updatedList);
        saveCurrentCustomerProfile({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
        });
      } catch (err) {
        console.warn('Address saving notice:', err);
      }
    }

    // Process loyalty points redemption if applied (minimum 200 points enforced)
    if (pointsToRedeem >= LOYALTY_MIN_REDEMPTION_POINTS) {
      try {
        await redeemPoints(pointsToRedeem, orderId, customerPhone.trim());
      } catch (err) {
        console.warn('Loyalty points redeem notice:', err);
      }
    }

    // Immediately credit earned loyalty points (5 pts / ₹100 spent, excluding delivery)
    if (pointsToEarn > 0) {
      try {
        await earnPoints(
          netMerchandiseAmount,
          orderId,
          customerPhone.trim() || user?.phone || user?.email,
          pointsToEarn
        );
        window.dispatchEvent(new Event('cotton-nest-loyalty-updated'));
      } catch (err) {
        console.warn('Loyalty points earn notice:', err);
      }
    }

    // Record coupon usage in Firestore/backend if coupon was applied
    if (appliedCoupon) {
      recordCouponUseApi(appliedCoupon.id, customerPhone.trim() || user?.email).catch(() => {});
    }

    if (onOrderPlaced) {
      onOrderPlaced(createdOrder);
    }

    setLastOrderDetails({
      orderId,
      total: finalTotal,
      summary: fullMessage,
      whatsappUrl: waUrl,
      pointsEarned: pointsToEarn,
      pointsUsed: pointsToRedeem,
      pointsDiscount: effectivePointsDiscount,
      order: createdOrder,
    });

    onClearCart();
    setCheckoutStep('success');
  };

  const handleDone = () => {
    onClearCart();
    setCheckoutStep('cart');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-[#2C2420]/60 backdrop-blur-xs will-change-[opacity]"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%', opacity: 0.92 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.92 }}
            transition={{
              type: 'spring',
              stiffness: 440,
              damping: 38,
              mass: 0.8,
              restDelta: 0.001,
            }}
            className="relative w-full max-w-md liquid-glass-modal h-full flex flex-col z-10 text-[var(--color-text,#2C2420)] will-change-transform"
          >
            {/* Drawer Header */}
            <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-white/75 flex items-center justify-between bg-white/60 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#8C2E46]" />
                <h2 className="font-serif-luxury text-base sm:text-lg font-bold text-[#2C2420]">
                  {checkoutStep === 'cart' && `Shopping Bag (${(items || []).length})`}
                  {checkoutStep === 'checkout' && 'Complete Order on WhatsApp'}
                  {checkoutStep === 'success' && 'Order Placed via WhatsApp'}
                </h2>
              </div>

              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                onClick={onClose}
                aria-label="Close shopping bag"
                className="p-1.5 text-[#6B5D55] hover:text-[#2C2420] rounded-full liquid-glass-badge transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-2.5 sm:px-4 sm:py-3 space-y-2.5">
              <AnimatePresence mode="wait" initial={false}>
                {/* STEP 1: CART ITEMS LIST */}
                {checkoutStep === 'cart' && (
                  <motion.div
                    key="step-cart"
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ type: 'spring', stiffness: 440, damping: 36, mass: 0.75 }}
                    className="space-y-2.5"
                  >
                    {(items || []).length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="text-center py-14 space-y-3"
                      >
                        <div className="w-16 h-16 rounded-full bg-[#F4EFE6] flex items-center justify-center mx-auto text-[#8C7A70]">
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-semibold text-[#2C2420]">Your bag is currently empty</p>
                        <p className="text-xs text-[#7A6458]">
                          Explore our 100% natural cotton bedsheets to add to your order.
                        </p>
                      </motion.div>
                    ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 text-[11px] text-[#8C7A70]">
                    <span>{items.length} {items.length === 1 ? 'item' : 'items'} in bag</span>
                    <span className="flex items-center gap-1 text-[10px] italic">
                      ← Swipe item left to remove
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                  {(items || []).map((item, idx) => {
                    const isMetadataValid = isCompleteProduct(item?.product);

                    if (!isMetadataValid) {
                      const fallbackId =
                        item?.product && typeof item.product === 'object' && typeof item.product.id === 'string'
                          ? item.product.id
                          : '';
                      const partialName =
                        item?.product && typeof item.product === 'object' && typeof item.product.name === 'string' && item.product.name.trim() !== ''
                          ? item.product.name.trim()
                          : null;

                      return (
                        <SwipeableCartItem
                          key={`unavailable-item-${fallbackId || idx}`}
                          onRemove={() => onRemoveItem(fallbackId)}
                        >
                          <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-amber-200/90 text-[#2C2420] shadow-xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-100/90 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                                <AlertCircle className="w-5 h-5 text-amber-700" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                    Notice
                                  </span>
                                  <h3 className="font-serif-luxury font-bold text-xs text-[#2C2420] truncate">
                                    Item Unavailable
                                  </h3>
                                </div>
                                <p className="text-[11px] text-[#7A6458] mt-0.5 leading-tight truncate">
                                  {partialName ? `${partialName} (Metadata Incomplete)` : 'Product metadata is missing or incomplete.'}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveItem(fallbackId)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                              title="Remove unavailable item from bag"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </SwipeableCartItem>
                      );
                    }

                    const prod = item?.product;
                    const prodId = typeof prod?.id === 'string' ? prod.id : '';
                    const prodName = typeof prod?.name === 'string' && prod.name.trim() !== '' ? prod.name.trim() : 'Handcrafted Bedsheet';
                    const prodDimensions = typeof prod?.dimensions === 'string' && prod.dimensions.trim() !== '' ? prod.dimensions.trim() : '108 x 108 inches (274 x 274 cm)';
                    const itemPrice = typeof prod?.price === 'number' && !isNaN(prod.price) && prod.price >= 0 ? prod.price : 0;
                    
                    const variant = (
                      item?.selectedVariant &&
                      typeof item.selectedVariant === 'object' &&
                      typeof item.selectedVariant.name === 'string' &&
                      item.selectedVariant.name.trim() !== ''
                    ) ? item.selectedVariant : undefined;

                    const variantName = variant?.name?.trim() || null;
                    const variantColorHex = (
                      variant?.colorHex &&
                      typeof variant.colorHex === 'string' &&
                      variant.colorHex.trim().startsWith('#')
                    ) ? variant.colorHex.trim() : null;
                    const variantImage = (
                      variant?.image &&
                      typeof variant.image === 'string' &&
                      variant.image.trim() !== ''
                    ) ? variant.image.trim() : null;

                    const rawImg = variantImage || (typeof prod?.image === 'string' ? prod.image : '');
                    const displayImg = resolveBedsheetImage(rawImg, prodId);
                    
                    const rawQty = typeof item?.quantity === 'number' ? item.quantity : Number(item?.quantity);
                    const qty = !isNaN(rawQty) && rawQty > 0 ? Math.round(rawQty) : 1;
                    const itemKey = `${prodId || 'item'}-${variant?.id || 'base'}`;

                    return (
                      <SwipeableCartItem
                        key={itemKey}
                        onRemove={() => prodId && onRemoveItem(prodId)}
                      >
                        <div className="flex gap-2.5 p-2.5 liquid-glass-surface rounded-2xl">
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F4EFE6] shrink-0 border border-white/80 flex items-center justify-center relative">
                            {displayImg ? (
                              isVideoMedia(displayImg) ? (
                                <video
                                  src={displayImg}
                                  muted
                                  loop
                                  playsInline
                                  autoPlay
                                  className="w-full h-full object-cover object-center"
                                />
                              ) : (
                                <img
                                  src={displayImg}
                                  alt={prodName}
                                  onError={handleImageFallback}
                                  draggable={false}
                                  className="w-full h-full object-cover object-center"
                                />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center text-[#8C7A70] p-1 text-center">
                                <Package className="w-5 h-5 opacity-40 mb-0.5" />
                                <span className="text-[9px] uppercase tracking-wider">No Photo</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h3 className="font-serif-luxury text-sm font-bold text-[#2C2420] leading-tight truncate">
                                  {prodName}
                                </h3>
                                <button
                                  onClick={() => prodId && onRemoveItem(prodId)}
                                  className="text-[#8C7A70] hover:text-red-600 p-0.5 cursor-pointer shrink-0"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {variantName ? (
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-[#8C2E46]">
                                  {variantColorHex ? (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shrink-0"
                                      style={{ backgroundColor: variantColorHex }}
                                    />
                                  ) : null}
                                  <span className="truncate">Color: {variantName}</span>
                                </div>
                              ) : null}

                              <p className="text-[10px] text-[#7A6458] truncate">
                                {prodDimensions}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center border border-[#EAE2D5] rounded-lg bg-[#FAF7F2]">
                                <button
                                  type="button"
                                  onClick={() => prodId && onUpdateQuantity(prodId, Math.max(1, qty - 1))}
                                  className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold cursor-pointer transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className="px-2 text-xs font-semibold text-[#2C2420] tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => prodId && onUpdateQuantity(prodId, qty + 1)}
                                  className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold cursor-pointer transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <span className="text-sm font-bold text-[#2C2420] tabular-nums">
                                {typeof itemPrice === 'number' && !isNaN(itemPrice) && itemPrice >= 0 ? (
                                  `₹${(itemPrice * qty).toLocaleString('en-IN')}`
                                ) : (
                                  <span className="text-xs text-amber-700 italic">Price Unavailable</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </SwipeableCartItem>
                    );
                  })}
                  </AnimatePresence>
                </div>
              )}

              {/* Shipping & Delivery Option Selector Directly in Cart / Shopping Bag */}
              {validItems.length > 0 && (
                <div className="pt-2 pb-0.5 space-y-1.5 border-t border-[#EAE2D5]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Delivery Option</span>
                    </label>
                    <span className="text-[10px] text-[#8C2E46] font-semibold bg-[#FDEAF0] px-2 py-0.5 rounded-full">
                      {shippingOption === 'india' ? `Standard Courier (+₹${acrossIndiaFee})` : shippingOption === 'sector46' ? 'Complimentary Free' : 'Pickup / Actuals'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label
                      onClick={() => setShippingOption('india')}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'india'
                          ? 'border-[#8C2E46] bg-[#FDEAF0]/50 ring-1 ring-[#8C2E46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="radio"
                          name="bag_shipping"
                          checked={shippingOption === 'india'}
                          onChange={() => setShippingOption('india')}
                          className="accent-[#8C2E46] shrink-0"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
                          <p className="font-semibold text-[#2C2420]">Across India</p>
                          <p className="text-[11px] text-[#7A6458]">Standard Courier Delivery</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#8C2E46] shrink-0 ml-2">+₹{acrossIndiaFee}</span>
                    </label>

                    <label
                      onClick={() => setShippingOption('sector46')}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'sector46'
                          ? 'border-[#2E7D46] bg-[#EAF7EE]/70 ring-1 ring-[#2E7D46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="radio"
                          name="bag_shipping"
                          checked={shippingOption === 'sector46'}
                          onChange={() => setShippingOption('sector46')}
                          className="accent-[#2E7D46] shrink-0"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
                          <p className="font-semibold text-[#2C2420]">Sector 46, Gurgaon</p>
                          <p className="text-[11px] text-[#7A6458]">Complimentary Local Delivery</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#2E7D46] uppercase text-[11px] shrink-0 ml-2">Free</span>
                    </label>

                    <label
                      onClick={() => setShippingOption('gurgaon')}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        shippingOption === 'gurgaon'
                          ? 'border-[#8C2E46] bg-[#FDEAF0]/50 ring-1 ring-[#8C2E46]'
                          : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="radio"
                          name="bag_shipping"
                          checked={shippingOption === 'gurgaon'}
                          onChange={() => setShippingOption('gurgaon')}
                          className="accent-[#8C2E46] shrink-0"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
                          <p className="font-semibold text-[#2C2420]">Rest of Gurgaon</p>
                          <p className="text-[11px] text-[#7A6458]">Self Pickup / On Actuals</p>
                        </div>
                      </div>
                      <span className="font-medium text-[#7A6458] text-[11px] shrink-0 ml-2">On Actuals / Pickup</span>
                    </label>
                  </div>
                </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 2: CHECKOUT DETAILS & WHATSAPP LINK */}
                {checkoutStep === 'checkout' && (
                  <motion.form
                    key="step-checkout"
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ type: 'spring', stiffness: 440, damping: 36, mass: 0.75 }}
                    id="whatsapp-order-form"
                    onSubmit={handlePlaceWhatsAppOrder}
                    className="space-y-4"
                  >
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}
              <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#2C2420]">Order Summary</p>
                  <span className="font-bold text-[#8C2E46]">Payable: ₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[#6B5D55]">
                  {validItems.length} bedsheet{validItems.length > 1 ? 's' : ''} (Items Subtotal: ₹{subtotal.toLocaleString('en-IN')})
                </p>

                {/* Redeem Nest Points Option directly in Checkout Step */}
                <div className="pt-2 border-t border-[#EAE2D5] flex items-center justify-between gap-2 text-[11px]">
                  <div>
                    <span className="font-semibold text-[#2C2420] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>Nest Points Available: <strong className="text-amber-900">{pointsBalance} pts</strong> (₹{calculatePointsDiscount(pointsBalance)})</span>
                    </span>
                    <span className="text-[10px] text-[#7A6458] block">
                      {canRedeemForThisOrder
                        ? `100 pts = ₹50 · Earn +${pointsToEarn} pts after delivery & full payment`
                        : `Min. ${LOYALTY_MIN_REDEMPTION_POINTS} pts (₹100) required to redeem · Earn +${pointsToEarn} pts on delivery`}
                    </span>
                  </div>

                  {canRedeemForThisOrder ? (
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={useLoyaltyPoints}
                        onChange={(e) => {
                          setUseLoyaltyPoints(e.target.checked);
                          setPreferRedeemAtCheckout(e.target.checked);
                        }}
                        className="accent-[#70252D] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-[#70252D]">
                        {useLoyaltyPoints ? `Applied (-₹${effectivePointsDiscount})` : 'Redeem Points'}
                      </span>
                    </label>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                      Min {LOYALTY_MIN_REDEMPTION_POINTS} pts
                    </span>
                  )}
                </div>
              </div>

              {!user && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Mandatory Login Required</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Please sign in or create an account before placing your order.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal?.()}
                    className="w-full py-2 bg-[#8C2E46] text-white rounded-xl text-xs font-semibold hover:bg-[#722338] transition-colors cursor-pointer shadow-xs"
                  >
                    Log In / Sign Up Now
                  </button>
                </div>
              )}

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

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Email Address (for Instant Invoice &amp; Receipt)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. radhika@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                  />
                  <p className="text-[10px] text-[#7A6458] mt-1">
                    Order invoice receipt with product images and itemized billing will be sent to this email.
                  </p>
                </div>

                {/* Selected Delivery Option Summary (Chosen in Bag) */}
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#EAE2D5] flex items-center justify-center text-[#8C2E46] shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#7A6458] block font-medium">Delivery Method (Selected in Bag)</span>
                      <span className="font-semibold text-[#2C2420]">
                        {shippingOption === 'india' && `Across India (Standard Courier +₹${acrossIndiaFee})`}
                        {shippingOption === 'sector46' && 'Sector 46, Gurgaon (Free Local Delivery)'}
                        {shippingOption === 'gurgaon' && 'Rest of Gurgaon (Self Pickup / On Actuals)'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('cart')}
                    className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer ml-2 shrink-0"
                  >
                    Change in Bag
                  </button>
                </div>

                {/* Delivery Address Section with Saved Addresses Support */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Delivery Address *</span>
                    </label>
                    {savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isAddingNewAddress) {
                            setIsAddingNewAddress(false);
                            const sel = savedAddresses.find((a) => a.id === selectedAddressId) || savedAddresses[0];
                            if (sel) handleSelectSavedAddress(sel);
                          } else {
                            handleStartNewAddress();
                          }
                        }}
                        className="text-[11px] font-bold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        {isAddingNewAddress ? (
                          <>
                            <Bookmark className="w-3 h-3" />
                            <span>Saved Addresses ({savedAddresses.length})</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>+ New Address</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* List of Saved Addresses to Select From */}
                  {!isAddingNewAddress && savedAddresses.length > 0 && (
                    <div className="space-y-2">
                      {!customerAddress && (
                        <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Please select a saved address below:</span>
                        </div>
                      )}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => handleSelectSavedAddress(addr)}
                              className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#FFFDF9] border-[#C29E57] ring-1.5 ring-[#C29E57] shadow-xs'
                                  : 'bg-white border-[#EAE2D5] hover:border-[#DEC89B] hover:bg-[#FAF7F2]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'border-[#8C2E46] bg-[#8C2E46]'
                                        : 'border-[#DEC89B] bg-white'
                                    }`}
                                  >
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                  <span className="font-bold text-[#2C2420] text-xs">{addr.name}</span>
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-[#FAF7F2] text-[#8C7A70] border border-[#DEC89B]/60 flex items-center gap-1">
                                    {addr.label === 'Work' ? <Briefcase className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
                                    <span>{addr.label || 'Home'}</span>
                                  </span>
                                  {addr.isDefault && (
                                    <span className="text-[10px] font-semibold text-[#8C2E46] bg-[#FDEAF0] px-1.5 py-0.5 rounded border border-[#FAD1DC]">
                                      Default
                                    </span>
                                  )}
                                </div>
                                {addr.phone && (
                                  <span className="text-[11px] text-[#7A6458] font-medium shrink-0">
                                    {addr.phone}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[#6B5D55] text-xs leading-relaxed pl-6">
                                {formatFullAddress(addr)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Deliver to different address button */}
                      <button
                        type="button"
                        onClick={handleStartNewAddress}
                        className="w-full py-2 px-3 border border-dashed border-[#DEC89B] hover:border-[#8C2E46] rounded-xl text-xs font-semibold text-[#8C2E46] bg-white hover:bg-[#FAF7F2] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Deliver to a Different / New Address</span>
                      </button>
                    </div>
                  )}

                  {/* Manual / New Address Entry Form with all options */}
                  {(isAddingNewAddress || savedAddresses.length === 0) && (
                    <div className="space-y-3 bg-[#FAF7F2]/80 p-3.5 rounded-2xl border border-[#DEC89B]">
                      {savedAddresses.length > 0 && (
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] font-bold text-[#2C2420] uppercase tracking-wider">
                            Add New Address Details
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewAddress(false);
                              if (savedAddresses.length > 0) {
                                handleSelectSavedAddress(savedAddresses[0]);
                              }
                            }}
                            className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer"
                          >
                            ← Use Saved Address
                          </button>
                        </div>
                      )}

                      {/* Address Label Pills */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#8C7A70] font-medium">Save as:</span>
                        {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setNewAddressLabel(lbl)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                              newAddressLabel === lbl
                                ? 'bg-[#8C2E46] text-white border-[#8C2E46] shadow-2xs'
                                : 'bg-white text-[#6B5D55] border-[#EAE2D5] hover:bg-[#FAF7F2]'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">Recipient Name *</label>
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={newAddressName}
                            onChange={(e) => setNewAddressName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">Mobile Number *</label>
                          <input
                            type="tel"
                            placeholder="10-digit mobile"
                            value={newAddressPhone}
                            onChange={(e) => setNewAddressPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">House / Flat No. / Building *</label>
                        <input
                          type="text"
                          placeholder="e.g. House Number 2508, Ground Floor"
                          value={newAddressHouse}
                          onChange={(e) => setNewAddressHouse(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">Area / Street / Sector *</label>
                        <input
                          type="text"
                          placeholder="e.g. Sector 46"
                          value={newAddressStreet}
                          onChange={(e) => {
                            setNewAddressStreet(e.target.value);
                            const lower = e.target.value.toLowerCase();
                            if (lower.includes('sector 46') || lower.includes('sec 46')) {
                              setShippingOption('sector46');
                            } else if (lower.includes('gurgaon') || lower.includes('gurugram')) {
                              if (shippingOption === 'india') setShippingOption('gurgaon');
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">City / State *</label>
                          <input
                            type="text"
                            placeholder="e.g. Gurgaon, Haryana"
                            value={newAddressCity}
                            onChange={(e) => setNewAddressCity(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">Pincode *</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="122003"
                            value={newAddressPincode}
                            onChange={(e) => setNewAddressPincode(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-[#2C2420]">
                          <input
                            type="checkbox"
                            checked={saveToAddressBook}
                            onChange={(e) => setSaveToAddressBook(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#8C2E46] rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-medium text-[#4A3B32]">
                            Save to address book
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={handleSaveNewAddress}
                          className="px-4 py-2 bg-[#8C2E46] text-white rounded-xl text-xs font-semibold hover:bg-[#722338] transition-colors cursor-pointer shadow-xs"
                        >
                          Use This Address
                        </button>
                      </div>
                    </div>
                  )}
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
            </motion.form>
          )}

          {/* STEP 3: ORDER SUCCESS */}
          {checkoutStep === 'success' && lastOrderDetails && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
              className="text-center py-6 space-y-4"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.05 }}
                className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200"
              >
                <CheckCircle2 className="w-9 h-9" />
              </motion.div>

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

              {/* Loyalty Points Earned / Redeemed Feedback */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-[#FAF7F2] rounded-2xl border border-amber-200 text-left text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C29E57]" />
                    <span>Nest Points Loyalty Rewards</span>
                  </span>
                  <button
                    type="button"
                    onClick={openLoyaltyModal}
                    className="text-[11px] font-bold text-[#8C2E46] underline cursor-pointer"
                  >
                    View Wallet ({pointsBalance} pts)
                  </button>
                </div>
                {Boolean(lastOrderDetails.pointsEarned && lastOrderDetails.pointsEarned > 0) && (
                  <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>🎁 +{lastOrderDetails.pointsEarned} Nest Points credited to your account! Available balance: <strong className="text-amber-950 font-bold">{pointsBalance} pts</strong> (₹{calculatePointsDiscount(pointsBalance)})</span>
                  </p>
                )}
                {Boolean(lastOrderDetails.pointsUsed && lastOrderDetails.pointsUsed > 0) && (
                  <p className="text-[11px] text-emerald-800 font-medium">
                    ✨ {lastOrderDetails.pointsUsed} Nest Points redeemed for ₹{lastOrderDetails.pointsDiscount} discount (100 pts = ₹50).
                  </p>
                )}
              </div>

              {/* Sale Invoice Section: Hidden until order is confirmed */}
              {(() => {
                const liveOrder =
                  (orders || []).find((o) => o.id === lastOrderDetails.orderId) ||
                  lastOrderDetails.order;
                const isOrderConfirmed =
                  liveOrder?.status === 'confirmed' ||
                  liveOrder?.status === 'dispatched' ||
                  liveOrder?.status === 'delivered';

                if (!isOrderConfirmed) {
                  return (
                    <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-left text-xs flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-[#C29E57] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[#2C2420]">Official Sale Invoice</p>
                        <p className="text-[11px] text-[#7A6458] mt-0.5 leading-relaxed">
                          Your invoice will be published and emailed once your order is confirmed.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {liveOrder && (
                      <button
                        type="button"
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="py-2.5 px-3 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#8C2E46]" />
                        <span>View Sale Invoice</span>
                      </button>
                    )}
                    {liveOrder && (
                      <a
                        href={buildOrderGmailUrl(liveOrder)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F3ECE0] text-[#8C2E46] border border-[#DEC89B] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open in Gmail</span>
                      </a>
                    )}
                  </div>
                );
              })()}

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
            </motion.div>
          )}
              </AnimatePresence>
            </div>

        {/* Drawer Footer Actions */}
        {checkoutStep === 'cart' && (items || []).length > 0 && validItems.length === 0 && (
          <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-white space-y-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Items in your bag are currently unavailable</p>
                <p className="text-[11px] text-amber-800 mt-0.5">Please remove unavailable items to continue browsing our collection.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemoveItem('')}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Unavailable Items</span>
            </button>
          </div>
        )}

        {checkoutStep === 'cart' && validItems.length > 0 && (
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-t border-[#EAE2D5] bg-white space-y-2 shrink-0">
            {/* Notice if any items in bag are unavailable */}
            {(items || []).some((it) => !isCompleteProduct(it?.product)) && (
              <div className="p-2 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] truncate">Unavailable items will not be included in checkout.</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem('')}
                  className="text-[11px] font-bold text-amber-900 hover:text-red-700 underline cursor-pointer shrink-0"
                >
                  Clear Unavailable
                </button>
              </div>
            )}
            {/* Promo Code & Offers Module */}
            <div className="p-2 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#2C2420] flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#C29E57]" />
                  <span>Coupons &amp; Offers</span>
                </span>
                {availableCoupons.filter((c) => c.isActive).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOffersList(!showOffersList)}
                    className="text-[10px] font-semibold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Gift className="w-3 h-3" />
                    <span>{showOffersList ? 'Hide Offers' : `View Offers (${availableCoupons.filter((c) => c.isActive).length})`}</span>
                  </button>
                )}
              </div>

              {/* Applied Coupon Pill */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-emerald-300 text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[9px]">
                      %
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold tracking-wider text-[#2C2420] text-[11px]">{appliedCoupon.code}</span>
                        {appliedCoupon.isAutomatic && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald-700 font-medium leading-tight">
                        Saving ₹{effectiveCouponDiscount.toLocaleString('en-IN')} on this order
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-0.5 text-[#8C7A70] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove coupon"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyCoupon();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => {
                      setCouponCodeInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    placeholder="Enter Coupon Code"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs font-semibold text-[#2C2420] tracking-wider uppercase placeholder:normal-case placeholder:font-normal placeholder:text-[#9B8C83] focus:outline-none focus:border-[#8C2E46]"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCodeInput.trim()}
                    className="px-3 py-1.5 bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </form>
              )}

              {/* Status alerts */}
              {couponSuccessMessage && (
                <p className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{couponSuccessMessage}</span>
                </p>
              )}
              {couponError && (
                <p className="text-[10px] font-medium text-rose-600">
                  {couponError}
                </p>
              )}

              {/* Expandable Offers Picker Drawer */}
              {showOffersList && (
                <div className="pt-1.5 border-t border-[#EAE2D5] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {availableCoupons
                    .filter((c) => c.isActive)
                    .map((coupon) => {
                      const isCurrent = appliedCoupon?.code === coupon.code;
                      return (
                        <div
                          key={coupon.id}
                          className="p-2 bg-white rounded-lg border border-[#EAE2D5] text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold tracking-wider text-[#8C2E46] bg-[#FDEAF0] px-1.5 py-0.5 rounded text-[10px]">
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
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Compact Nest Points Rewards & Checkout Redemption Bar */}
            <div className="px-2.5 py-1.5 bg-gradient-to-r from-amber-50/90 to-[#FAF7F2] rounded-xl border border-amber-200/80 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#2C2420] flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Nest Points: <strong className="text-amber-900">+{pointsToEarn} pts</strong> (5 pts/₹100 · on delivery)</span>
                </span>
                <button
                  type="button"
                  onClick={openLoyaltyModal}
                  className="text-[10px] font-semibold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                >
                  <Sparkles className="w-3 h-3 text-[#C29E57]" />
                  <span>Wallet ({pointsBalance} pts)</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[11px]">
                <span className="text-[#6B5D55]">
                  Available: <strong className="text-amber-900">{pointsBalance} pts</strong> (₹{calculatePointsDiscount(pointsBalance)})
                </span>
                {canRedeemForThisOrder ? (
                  <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-amber-300 hover:bg-amber-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={useLoyaltyPoints}
                      onChange={(e) => {
                        setUseLoyaltyPoints(e.target.checked);
                        setPreferRedeemAtCheckout(e.target.checked);
                      }}
                      className="accent-[#70252D] w-3 h-3 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-[#70252D]">
                      {useLoyaltyPoints ? `Applied (-₹${effectivePointsDiscount})` : 'Redeem Points'}
                    </span>
                  </label>
                ) : (
                  <span className="text-[10px] text-amber-900 font-medium">
                    Min. {LOYALTY_MIN_REDEMPTION_POINTS} pts to redeem
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-0.5 text-[11px]">
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
              {effectivePointsDiscount > 0 && (
                <div className="flex justify-between text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-[#A8823B]" />
                    <span>Loyalty Points ({pointsToRedeem} pts)</span>
                  </span>
                  <span>-₹{effectivePointsDiscount.toLocaleString('en-IN')}</span>
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
              <div className="flex justify-between text-xs font-bold text-[#2C2420] pt-1 border-t border-[#EAE2D5]">
                <span>Order Total</span>
                <span className="text-sm text-[#8C2E46]">₹{finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCheckoutStep('checkout')}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Proceed to WhatsApp Checkout (₹{finalTotal.toLocaleString('en-IN')})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        )}

        {checkoutStep === 'checkout' && (
          <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-white flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setCheckoutStep('cart')}
              className="py-3 px-4 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] border border-[#EAE2D5] rounded-xl hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              Back
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              form="whatsapp-order-form"
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send Order on WhatsApp (₹{finalTotal.toLocaleString('en-IN')})</span>
            </motion.button>
          </div>
        )}

          </motion.div>
        </div>
      )}
      <InvoiceModal
        order={(orders || []).find((o) => o.id === lastOrderDetails?.orderId) || lastOrderDetails?.order || null}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />
    </AnimatePresence>
  );
};
