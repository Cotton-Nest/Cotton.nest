export type DiscountType = 'percentage' | 'fixed';
export type DiscountScope = 'all' | 'products' | 'collections';

export interface CouponOffer {
  id: string;
  code: string; // e.g. "NEST10", "COTTON250"
  title: string; // e.g. "10% Off Signature Bedsheets"
  description?: string; // e.g. "Get 10% off on all King size cotton sheets above ₹1,500"
  discountType: DiscountType; // 'percentage' | 'fixed'
  discountValue: number; // e.g. 10 (for 10%) or 250 (for ₹250)
  minOrderValue: number; // e.g. 1500 (0 for no minimum)
  maxDiscountAmount?: number; // e.g. 500 (cap for percentage discounts)
  startDate: string; // e.g. "2026-01-01"
  expiryDate: string; // e.g. "2026-12-31"
  isActive: boolean;
  isAutomatic: boolean; // if true, applies automatically if eligible without code
  maxUses?: number; // total global uses limit (optional)
  usedCount: number; // how many times this coupon has been redeemed
  oneUsePerCustomer: boolean; // allow only 1 use per customer email/phone
  usedByCustomers?: string[]; // list of emails/phones that redeemed this coupon
  scope: DiscountScope; // 'all' | 'products' | 'collections'
  applicableProductIds?: string[]; // array of productId
  applicableCollections?: string[]; // array of collection names
  badgeText?: string; // e.g. "POPULAR", "EXCLUSIVE", "LIMITED"
  createdAt: number;
  updatedAt: number;
}

export const INITIAL_COUPONS: CouponOffer[] = [
  {
    id: 'coupon-nest10',
    code: 'NEST10',
    title: '10% Welcome Discount',
    description: 'Get 10% off on all pure cotton bedsheets for orders above ₹1,500 (Max discount ₹400).',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 1500,
    maxDiscountAmount: 400,
    startDate: '2026-01-01',
    expiryDate: '2027-12-31',
    isActive: true,
    isAutomatic: false,
    maxUses: 500,
    usedCount: 0,
    oneUsePerCustomer: true,
    usedByCustomers: [],
    scope: 'all',
    badgeText: 'POPULAR',
    createdAt: 1768000000000,
    updatedAt: 1768000000000,
  },
  {
    id: 'coupon-cotton250',
    code: 'COTTON250',
    title: 'Flat ₹250 Off On Orders Above ₹2,500',
    description: 'Enjoy a flat ₹250 instant reduction on festive bedding bundles of ₹2,500 or more.',
    discountType: 'fixed',
    discountValue: 250,
    minOrderValue: 2500,
    startDate: '2026-01-01',
    expiryDate: '2027-12-31',
    isActive: true,
    isAutomatic: false,
    maxUses: 200,
    usedCount: 0,
    oneUsePerCustomer: false,
    usedByCustomers: [],
    scope: 'all',
    badgeText: 'FESTIVE',
    createdAt: 1768000000000,
    updatedAt: 1768000000000,
  },
  {
    id: 'coupon-gurgaon15',
    code: 'GURGAON15',
    title: '15% Off Atelier Special',
    description: 'Special 15% discount for Gurgaon residents and flagship atelier visitors on orders above ₹2,000.',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 2000,
    maxDiscountAmount: 600,
    startDate: '2026-01-01',
    expiryDate: '2027-12-31',
    isActive: true,
    isAutomatic: false,
    maxUses: 100,
    usedCount: 0,
    oneUsePerCustomer: true,
    usedByCustomers: [],
    scope: 'all',
    badgeText: 'ATELIER EXCLUSIVE',
    createdAt: 1768000000000,
    updatedAt: 1768000000000,
  },
  {
    id: 'coupon-auto-save5',
    code: 'PURECOTTON5',
    title: 'Automatic 5% Everyday Atelier Savings',
    description: 'Automatically applied 5% discount on all bedsheets when your cart reaches ₹1,200.',
    discountType: 'percentage',
    discountValue: 5,
    minOrderValue: 1200,
    maxDiscountAmount: 250,
    startDate: '2026-01-01',
    expiryDate: '2027-12-31',
    isActive: true,
    isAutomatic: true,
    usedCount: 0,
    oneUsePerCustomer: false,
    usedByCustomers: [],
    scope: 'all',
    badgeText: 'AUTO OFFER',
    createdAt: 1768000000000,
    updatedAt: 1768000000000,
  },
];

export interface CartItemLike {
  product: {
    id: string;
    price: number;
    collection?: string;
    name?: string;
  };
  quantity: number;
}

export interface CouponEvaluationResult {
  isEligible: boolean;
  reason?: string;
  discountAmount: number;
  eligibleSubtotal: number;
}

/**
 * Validates a coupon's eligibility against given cart items and subtotal.
 */
export function evaluateCouponEligibility(
  coupon: CouponOffer,
  items: CartItemLike[],
  subtotal: number,
  customerIdentifier?: string
): CouponEvaluationResult {
  // 1. Active status check
  if (!coupon.isActive) {
    return { isEligible: false, reason: 'This coupon code is currently inactive.', discountAmount: 0, eligibleSubtotal: 0 };
  }

  // 2. Date window check
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (coupon.startDate && todayStr < coupon.startDate) {
    return { isEligible: false, reason: `This coupon is not active yet (starts on ${coupon.startDate}).`, discountAmount: 0, eligibleSubtotal: 0 };
  }
  if (coupon.expiryDate && todayStr > coupon.expiryDate) {
    return { isEligible: false, reason: `This coupon code expired on ${coupon.expiryDate}.`, discountAmount: 0, eligibleSubtotal: 0 };
  }

  // 3. Usage limits check
  if (typeof coupon.maxUses === 'number' && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { isEligible: false, reason: 'This coupon has reached its maximum redemption limit.', discountAmount: 0, eligibleSubtotal: 0 };
  }

  // 4. One use per customer check
  if (coupon.oneUsePerCustomer && customerIdentifier && Array.isArray(coupon.usedByCustomers)) {
    const cleanId = customerIdentifier.trim().toLowerCase();
    const alreadyUsed = coupon.usedByCustomers.some((c) => c.trim().toLowerCase() === cleanId);
    if (alreadyUsed) {
      return { isEligible: false, reason: 'You have already redeemed this coupon on a prior order.', discountAmount: 0, eligibleSubtotal: 0 };
    }
  }

  // 5. Calculate eligible subtotal based on scope
  let eligibleSubtotal = 0;
  if (!coupon.scope || coupon.scope === 'all') {
    eligibleSubtotal = subtotal;
  } else if (coupon.scope === 'products' && Array.isArray(coupon.applicableProductIds)) {
    eligibleSubtotal = items.reduce((sum, item) => {
      if (coupon.applicableProductIds!.includes(item.product.id)) {
        return sum + item.product.price * item.quantity;
      }
      return sum;
    }, 0);
    if (eligibleSubtotal === 0) {
      return { isEligible: false, reason: 'This coupon is only valid for selected bedsheets not in your bag.', discountAmount: 0, eligibleSubtotal: 0 };
    }
  } else if (coupon.scope === 'collections' && Array.isArray(coupon.applicableCollections)) {
    const collSet = new Set(coupon.applicableCollections.map((c) => c.toLowerCase()));
    eligibleSubtotal = items.reduce((sum, item) => {
      const coll = (item.product.collection || '').toLowerCase();
      if (collSet.has(coll)) {
        return sum + item.product.price * item.quantity;
      }
      return sum;
    }, 0);
    if (eligibleSubtotal === 0) {
      return { isEligible: false, reason: 'This coupon is only applicable for specific bedding collections.', discountAmount: 0, eligibleSubtotal: 0 };
    }
  }

  // 6. Minimum order value check
  if (coupon.minOrderValue && eligibleSubtotal < coupon.minOrderValue) {
    const diff = coupon.minOrderValue - eligibleSubtotal;
    return {
      isEligible: false,
      reason: `Minimum order value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required. Add ₹${diff.toLocaleString('en-IN')} more to qualify.`,
      discountAmount: 0,
      eligibleSubtotal,
    };
  }

  // 7. Calculate discount amount
  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((eligibleSubtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else {
    // Fixed amount discount
    discountAmount = Math.min(eligibleSubtotal, Math.round(coupon.discountValue));
  }

  // Ensure discount does not exceed total subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return {
    isEligible: true,
    discountAmount,
    eligibleSubtotal,
  };
}
