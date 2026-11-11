import {
  calculateEarnedPoints,
  calculatePointsDiscount,
  calculatePointsForRupeeDiscount,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_MAX_REDEMPTION_POINTS,
} from './loyalty';
import { evaluateCouponEligibility, CouponOffer, INITIAL_COUPONS } from './coupons';
import type { Order } from './orders';

export const WELCOME_OFFER_NAME = 'Welcome to Cotton Nest';
export const DEFAULT_WELCOME_DISCOUNT_PERCENTAGE = 10;
export const DEFAULT_WELCOME_MIN_ORDER_VALUE = 1299;
export const DEFAULT_WELCOME_MAX_DISCOUNT = 200;

export type BenefitOptionType = 'welcome_offer' | 'nest_points' | 'coupon' | 'none';
export type WelcomeOfferStatus =
  | 'eligible'
  | 'reserved'
  | 'redeemed'
  | 'ineligible_existing_customer'
  | 'ineligible_not_google_auth';

export interface WelcomeOfferConfig {
  enabled: boolean;
  offerName: string;
  discountPercentage: number;
  discountPercent: number;
  minOrderValue: number;
  maxDiscountAmount: number;
  maxDiscount: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface WelcomeOfferCustomerRecord {
  uid: string;
  userId?: string;
  email?: string;
  customerName?: string;
  name?: string;
  phone?: string;
  authProvider?: string;
  status: WelcomeOfferStatus;
  reservedOrderId?: string;
  reservedAt?: number;
  redeemedOrderId?: string;
  redeemedAt?: number;
  discountAmount?: number;
  orderSubtotal?: number;
  popupShownAt?: number;
  updatedAt: number;
}

export const DEFAULT_WELCOME_OFFER_CONFIG: WelcomeOfferConfig = {
  enabled: true,
  offerName: WELCOME_OFFER_NAME,
  discountPercentage: DEFAULT_WELCOME_DISCOUNT_PERCENTAGE,
  discountPercent: DEFAULT_WELCOME_DISCOUNT_PERCENTAGE,
  minOrderValue: DEFAULT_WELCOME_MIN_ORDER_VALUE,
  maxDiscountAmount: DEFAULT_WELCOME_MAX_DISCOUNT,
  maxDiscount: DEFAULT_WELCOME_MAX_DISCOUNT,
  updatedAt: Date.now(),
};

/**
 * Formats a currency value cleanly: preserves up to 2 decimal places when fractional
 * (e.g., 129.9 -> "129.90", 199.9 -> "199.90", 62.5 -> "62.50") and integer format when whole (e.g., 150 -> "150").
 */
export function formatRupeeAmount(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  if (Math.abs(safe - Math.round(safe)) > 0.001) {
    return safe.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return Math.round(safe).toLocaleString('en-IN');
}

/**
 * Normalize phone number to last 10 digits for reliable customer matching
 */
export function normalizePhoneKey(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

/**
 * Normalize email for reliable customer matching
 */
export function normalizeEmailKey(email?: string | null): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Calculates the exact 10% (or configured %) Welcome Offer discount on eligible product subtotal:
 * Discount = MIN(ROUND(Product Subtotal × Discount%, 2), MaxDiscount)
 * - Minimum order value (excluding delivery) must be met (default ₹1,299).
 * - Maximum discount is capped at ₹200 (default).
 * - Maintains 2 decimal precision (never rounds to nearest ₹50).
 */
export function calculateWelcomeOfferDiscount(
  productSubtotal: number,
  config: Partial<WelcomeOfferConfig> = DEFAULT_WELCOME_OFFER_CONFIG
): {
  meetsMinOrder: boolean;
  discountAmount: number;
  shortfallAmount: number;
  effectivePercentage: number;
  minOrderValue: number;
  maxDiscountAmount: number;
} {
  const safeSubtotal = Math.max(0, Math.round((Number(productSubtotal) || 0) * 100) / 100);
  const minOrderValue = Math.max(0, Number(config?.minOrderValue ?? DEFAULT_WELCOME_MIN_ORDER_VALUE));
  const maxDiscountAmount = Math.max(
    0,
    Number(config?.maxDiscountAmount ?? config?.maxDiscount ?? DEFAULT_WELCOME_MAX_DISCOUNT)
  );
  const discountPercentage = Math.max(
    0,
    Math.min(
      100,
      Number(config?.discountPercentage ?? config?.discountPercent ?? DEFAULT_WELCOME_DISCOUNT_PERCENTAGE)
    )
  );

  if (config?.enabled === false) {
    return {
      meetsMinOrder: false,
      discountAmount: 0,
      shortfallAmount: 0,
      effectivePercentage: discountPercentage,
      minOrderValue,
      maxDiscountAmount,
    };
  }

  if (safeSubtotal < minOrderValue) {
    const shortfallAmount = Math.max(0, Math.round((minOrderValue - safeSubtotal) * 100) / 100);
    return {
      meetsMinOrder: false,
      discountAmount: 0,
      shortfallAmount,
      effectivePercentage: discountPercentage,
      minOrderValue,
      maxDiscountAmount,
    };
  }

  const rawDiscount = Math.round(((safeSubtotal * discountPercentage) / 100) * 100) / 100;
  const cappedDiscount = Math.min(rawDiscount, maxDiscountAmount, safeSubtotal);
  const discountAmount = Math.round(cappedDiscount * 100) / 100;

  return {
    meetsMinOrder: true,
    discountAmount,
    shortfallAmount: 0,
    effectivePercentage: discountPercentage,
    minOrderValue,
    maxDiscountAmount,
  };
}

export interface CustomerEligibilityInput {
  userId?: string | null;
  authProvider?: string | null;
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
  user?: {
    id?: string | null;
    email?: string | null;
    phone?: string | null;
    authProvider?: string | null;
  } | null;
  existingRecord?: WelcomeOfferCustomerRecord | null;
  redemptionRecord?: WelcomeOfferCustomerRecord | null;
  orders?: Order[];
  config?: Partial<WelcomeOfferConfig>;
  /** Optional orderId being updated/confirmed so its own reservation does not block itself */
  currentOrderId?: string | null;
}

export interface CustomerEligibilityResult {
  eligible: boolean;
  status: WelcomeOfferStatus;
  reason: string;
  reservedOrderId?: string;
  redeemedOrderId?: string;
  hasDeliveredOrder: boolean;
  hasActiveReservedOrder: boolean;
}

/**
 * Evaluates whether a customer is eligible for the Welcome Offer.
 * Rules:
 * 1. Welcome Offer must be enabled in config.
 * 2. Customer must be signed in via Google authentication (authProvider === 'google' and valid userId).
 * 3. Customer must NOT have any previously delivered order (status === 'delivered').
 * 4. Customer must NOT have already redeemed the Welcome Offer.
 * 5. Customer must NOT have another active (non-cancelled) order that has reserved the Welcome Offer.
 */
export function evaluateCustomerWelcomeEligibility(
  input: CustomerEligibilityInput
): CustomerEligibilityResult {
  const config = { ...DEFAULT_WELCOME_OFFER_CONFIG, ...(input.config || {}) };
  const uid = String(input.userId ?? input.user?.id ?? '').trim();
  const authProvider = String(input.authProvider ?? input.user?.authProvider ?? '')
    .trim()
    .toLowerCase();
  const normEmail = normalizeEmailKey(input.email ?? input.user?.email);
  const normPhone = normalizePhoneKey(input.phone ?? input.user?.phone);
  const orders = Array.isArray(input.orders) ? input.orders : [];
  const record = input.existingRecord ?? input.redemptionRecord ?? null;
  const currentOrderId = input.currentOrderId ? String(input.currentOrderId).trim() : '';

  if (!config.enabled) {
    return {
      eligible: false,
      status: record?.status || 'ineligible_existing_customer',
      reason: 'The Welcome Offer is currently disabled.',
      hasDeliveredOrder: false,
      hasActiveReservedOrder: false,
    };
  }

  if (!uid || authProvider !== 'google') {
    return {
      eligible: false,
      status: 'ineligible_not_google_auth',
      reason: 'Sign in with Google to check eligibility and unlock your 10% Welcome Offer.',
      hasDeliveredOrder: false,
      hasActiveReservedOrder: false,
    };
  }

  // Check if customer matches an order by UID, email, or 10-digit phone
  const matchesCustomer = (order: Order): boolean => {
    if (order.userId && String(order.userId).trim() === uid) return true;
    const orderEmail = normalizeEmailKey(order.customerEmail || (order as any).email);
    if (normEmail && orderEmail && normEmail === orderEmail) return true;
    const orderPhone = normalizePhoneKey(order.customerPhone || (order as any).phone);
    if (normPhone && orderPhone.length >= 10 && orderPhone === normPhone) return true;
    return false;
  };

  // 1. Check if customer already has a permanently redeemed record or any delivered order
  const deliveredOrders = orders.filter(
    (o) => o && o.status === 'delivered' && (!currentOrderId || o.id !== currentOrderId) && matchesCustomer(o)
  );

  const deliveredWelcomeOrder = deliveredOrders.find(
    (o) => o.welcomeOfferApplied || o.benefitType === 'welcome_offer' || (o.welcomeDiscount ?? 0) > 0
  );

  if (record?.status === 'redeemed' && (!currentOrderId || record.redeemedOrderId !== currentOrderId)) {
    return {
      eligible: false,
      status: 'redeemed',
      reason: 'You have already redeemed your one-time Welcome Offer.',
      redeemedOrderId: record.redeemedOrderId,
      hasDeliveredOrder: deliveredOrders.length > 0,
      hasActiveReservedOrder: false,
    };
  }

  if (deliveredWelcomeOrder) {
    return {
      eligible: false,
      status: 'redeemed',
      reason: 'You have already redeemed your one-time Welcome Offer.',
      redeemedOrderId: deliveredWelcomeOrder.id,
      hasDeliveredOrder: true,
      hasActiveReservedOrder: false,
    };
  }

  if (deliveredOrders.length > 0 || record?.status === 'ineligible_existing_customer') {
    return {
      eligible: false,
      status: 'ineligible_existing_customer',
      reason: 'The Welcome Offer is exclusively for first-time Cotton Nest customers.',
      hasDeliveredOrder: true,
      hasActiveReservedOrder: false,
    };
  }

  // 2. Check if customer has an active (non-cancelled) order that already reserved the Welcome Offer
  const activeReservedOrder = orders.find(
    (o) =>
      o &&
      o.status !== 'cancelled' &&
      (!currentOrderId || o.id !== currentOrderId) &&
      (o.welcomeOfferApplied || o.benefitType === 'welcome_offer' || (o.welcomeDiscount ?? 0) > 0) &&
      matchesCustomer(o)
  );

  if (activeReservedOrder) {
    return {
      eligible: false,
      status: 'reserved',
      reason: `Your Welcome Offer is currently reserved on active order #${activeReservedOrder.id}.`,
      reservedOrderId: activeReservedOrder.id,
      hasDeliveredOrder: false,
      hasActiveReservedOrder: true,
    };
  }

  if (
    record?.status === 'reserved' &&
    record.reservedOrderId &&
    (!currentOrderId || record.reservedOrderId !== currentOrderId)
  ) {
    // Check if the referenced reserved order was cancelled in orders list
    const linkedOrder = orders.find((o) => o.id === record.reservedOrderId);
    if (!linkedOrder || linkedOrder.status !== 'cancelled') {
      return {
        eligible: false,
        status: 'reserved',
        reason: `Your Welcome Offer is currently reserved on order #${record.reservedOrderId}.`,
        reservedOrderId: record.reservedOrderId,
        hasDeliveredOrder: false,
        hasActiveReservedOrder: true,
      };
    }
  }

  return {
    eligible: true,
    status: 'eligible',
    reason: 'You are eligible for the 10% Welcome Offer!',
    hasDeliveredOrder: false,
    hasActiveReservedOrder: false,
  };
}

export interface CentralizedCheckoutInput {
  productSubtotal: number;
  shippingCost?: number;
  deliveryCharge?: number;
  eligibility?: CustomerEligibilityResult;
  isCustomerEligibleForWelcome?: boolean;
  config?: Partial<WelcomeOfferConfig>;
  availableNestPoints: number;
  selectedBenefit: BenefitOptionType;
  requestedPointsToRedeem?: number;
  couponCode?: string;
  couponDiscountAmount?: number;
  couponsCatalog?: CouponOffer[];
}

export interface BenefitComparisonSummary {
  welcomeOfferEligible: boolean;
  welcomeOfferMeetsMinSubtotal: boolean;
  welcomeOfferShortfall: number;
  welcomeOfferDiscount: number;
  nestPointsEligible: boolean;
  maxRedeemablePoints: number;
  maxNestPointsDiscount: number;
  potentialPointsEarnedWithNestPoints: number;
  recommendedBenefit: 'welcome_offer' | 'nest_points' | 'equal' | 'none';
  recommendedOption: 'welcome_offer' | 'nest_points' | 'equal' | 'none';
  savingsDifference: number;
  recommendationHeadline: string;
  recommendationText: string;
  recommendationSubtext: string;
  subtext: string;
  welcomeOption: {
    eligible: boolean;
    meetsMinOrder: boolean;
    discountAmount: number;
    shortfallAmount: number;
  };
  nestPointsOption: {
    eligible: boolean;
    pointsToRedeem: number;
    discountAmount: number;
    pointsToEarn: number;
  };
}

export interface CentralizedCheckoutBreakdown {
  productSubtotal: number;
  shippingCost: number;
  selectedBenefit: BenefitOptionType;
  welcomeOfferApplied: boolean;
  welcomeDiscount: number;
  pointsUsed: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  couponCode?: string;
  couponDiscount: number;
  totalDiscount: number;
  netMerchandiseAmount: number;
  finalTotal: number;
  finalPayableAmount: number;
  pointsEarned: number;
  comparison: BenefitComparisonSummary;
  validationError?: string;
}

/**
 * Single Source of Truth for Checkout Benefit Comparison, Mutual Exclusivity,
 * Welcome Offer Calculation, and Nest Points Earning/Redemption Rules.
 */
export function calculateCentralizedCheckoutBreakdown(
  input: CentralizedCheckoutInput
): CentralizedCheckoutBreakdown {
  const config: WelcomeOfferConfig = {
    ...DEFAULT_WELCOME_OFFER_CONFIG,
    ...(input.config || {}),
    discountPercentage: Number(
      input.config?.discountPercentage ?? input.config?.discountPercent ?? DEFAULT_WELCOME_DISCOUNT_PERCENTAGE
    ),
    discountPercent: Number(
      input.config?.discountPercent ?? input.config?.discountPercentage ?? DEFAULT_WELCOME_DISCOUNT_PERCENTAGE
    ),
    maxDiscountAmount: Number(
      input.config?.maxDiscountAmount ?? input.config?.maxDiscount ?? DEFAULT_WELCOME_MAX_DISCOUNT
    ),
    maxDiscount: Number(
      input.config?.maxDiscount ?? input.config?.maxDiscountAmount ?? DEFAULT_WELCOME_MAX_DISCOUNT
    ),
  };

  const productSubtotal = Math.max(0, Math.round((Number(input.productSubtotal) || 0) * 100) / 100);
  const rawShipping = input.shippingCost ?? input.deliveryCharge ?? 0;
  const shippingCost = Math.max(0, Math.round((Number(rawShipping) || 0) * 100) / 100);
  const availableNestPoints = Math.max(0, Math.floor(Number(input.availableNestPoints) || 0));

  // 1. Evaluate Option A: Welcome Offer
  const welcomeCalc = calculateWelcomeOfferDiscount(productSubtotal, config);
  const isCustEligible = Boolean(
    input.eligibility ? input.eligibility.eligible : input.isCustomerEligibleForWelcome
  );
  const welcomeOfferEligible = Boolean(isCustEligible && config.enabled);
  const welcomeOfferMeetsMinSubtotal = welcomeOfferEligible && welcomeCalc.meetsMinOrder;
  const welcomeOfferDiscount = welcomeOfferMeetsMinSubtotal ? welcomeCalc.discountAmount : 0;

  // 2. Evaluate Option B: Nest Points
  const maxPointsForSubtotal = calculatePointsForRupeeDiscount(productSubtotal);
  const maxRedeemablePoints =
    availableNestPoints >= LOYALTY_MIN_REDEMPTION_POINTS
      ? Math.min(LOYALTY_MAX_REDEMPTION_POINTS, availableNestPoints, maxPointsForSubtotal)
      : 0;
  const nestPointsEligible = maxRedeemablePoints >= LOYALTY_MIN_REDEMPTION_POINTS;
  const maxNestPointsDiscount = nestPointsEligible
    ? Math.round(calculatePointsDiscount(maxRedeemablePoints) * 100) / 100
    : 0;
  const potentialPointsEarnedWithNestPoints = calculateEarnedPoints(
    Math.max(0, productSubtotal - maxNestPointsDiscount)
  );

  // 3. Automatic Savings Comparison
  let recommendedBenefit: 'welcome_offer' | 'nest_points' | 'equal' | 'none' = 'none';
  let savingsDifference = 0;
  let recommendationHeadline = '';
  let recommendationSubtext = 'Choose the offer that gives you the best savings!';

  if (welcomeOfferDiscount > 0 && maxNestPointsDiscount > 0) {
    const diff = Math.round(Math.abs(welcomeOfferDiscount - maxNestPointsDiscount) * 100) / 100;
    savingsDifference = diff;
    if (welcomeOfferDiscount > maxNestPointsDiscount) {
      recommendedBenefit = 'welcome_offer';
      recommendationHeadline = `Recommendation: Welcome Offer saves ₹${formatRupeeAmount(diff)} more.`;
    } else if (maxNestPointsDiscount > welcomeOfferDiscount) {
      recommendedBenefit = 'nest_points';
      recommendationHeadline = `Recommendation: Nest Points saves ₹${formatRupeeAmount(diff)} more.`;
    } else {
      recommendedBenefit = 'equal';
      recommendationHeadline = 'Both options offer equal immediate discount!';
      recommendationSubtext = 'Select either Welcome Offer or Nest Points below.';
    }
  } else if (welcomeOfferDiscount > 0) {
    recommendedBenefit = 'welcome_offer';
    savingsDifference = welcomeOfferDiscount;
    recommendationHeadline = `Recommendation: Welcome Offer saves you ₹${formatRupeeAmount(welcomeOfferDiscount)} on your first order.`;
  } else if (maxNestPointsDiscount > 0) {
    recommendedBenefit = 'nest_points';
    savingsDifference = maxNestPointsDiscount;
    recommendationHeadline = `Recommendation: Redeem Nest Points to save ₹${formatRupeeAmount(maxNestPointsDiscount)}.`;
  }

  const comparison: BenefitComparisonSummary = {
    welcomeOfferEligible,
    welcomeOfferMeetsMinSubtotal,
    welcomeOfferShortfall: welcomeCalc.shortfallAmount,
    welcomeOfferDiscount,
    nestPointsEligible,
    maxRedeemablePoints,
    maxNestPointsDiscount,
    potentialPointsEarnedWithNestPoints,
    recommendedBenefit,
    recommendedOption: recommendedBenefit,
    savingsDifference,
    recommendationHeadline,
    recommendationText: recommendationHeadline,
    recommendationSubtext,
    subtext: recommendationSubtext,
    welcomeOption: {
      eligible: welcomeOfferMeetsMinSubtotal,
      meetsMinOrder: welcomeCalc.meetsMinOrder,
      discountAmount: welcomeOfferDiscount,
      shortfallAmount: welcomeCalc.shortfallAmount,
    },
    nestPointsOption: {
      eligible: nestPointsEligible,
      pointsToRedeem: maxRedeemablePoints,
      discountAmount: maxNestPointsDiscount,
      pointsToEarn: potentialPointsEarnedWithNestPoints,
    },
  };

  // 4. Apply strictly mutually exclusive selected benefit
  let effectiveBenefit: BenefitOptionType = input.selectedBenefit || 'none';
  let welcomeOfferApplied = false;
  let welcomeDiscount = 0;
  let pointsUsed = 0;
  let pointsDiscount = 0;
  let couponCode: string | undefined = undefined;
  let couponDiscount = 0;
  let validationError: string | undefined = undefined;

  if (effectiveBenefit === 'welcome_offer') {
    if (!welcomeOfferEligible) {
      validationError = input.eligibility?.reason || 'Customer is not eligible for the Welcome Offer.';
      effectiveBenefit = 'none';
    } else if (!welcomeCalc.meetsMinOrder) {
      validationError = `Minimum order value for the Welcome Offer is ₹${formatRupeeAmount(welcomeCalc.minOrderValue)} (excluding delivery). Add ₹${formatRupeeAmount(welcomeCalc.shortfallAmount)} more to apply it.`;
      effectiveBenefit = 'none';
    } else {
      welcomeOfferApplied = true;
      welcomeDiscount = welcomeOfferDiscount;
      // MANDATORY RULE 6A & 6B: Zero Nest Points redeemed and Zero Nest Points earned when Welcome Offer is applied
      pointsUsed = 0;
      pointsDiscount = 0;
      couponCode = undefined;
      couponDiscount = 0;
    }
  } else if (effectiveBenefit === 'nest_points') {
    const requestedPoints =
      typeof input.requestedPointsToRedeem === 'number' && input.requestedPointsToRedeem > 0
        ? Math.floor(input.requestedPointsToRedeem)
        : maxRedeemablePoints;

    if (!nestPointsEligible || requestedPoints < LOYALTY_MIN_REDEMPTION_POINTS) {
      validationError = `Minimum ${LOYALTY_MIN_REDEMPTION_POINTS} Nest Points required to redeem.`;
      effectiveBenefit = 'none';
    } else {
      const clampedPoints = Math.min(requestedPoints, maxRedeemablePoints);
      pointsUsed = clampedPoints;
      pointsDiscount = Math.min(
        productSubtotal,
        Math.round(calculatePointsDiscount(clampedPoints) * 100) / 100
      );
      welcomeOfferApplied = false;
      welcomeDiscount = 0;
      couponCode = undefined;
      couponDiscount = 0;
    }
  } else if (effectiveBenefit === 'coupon') {
    const code = String(input.couponCode || '').trim().toUpperCase();
    if (typeof input.couponDiscountAmount === 'number' && input.couponDiscountAmount > 0) {
      couponCode = code || 'PROMO';
      couponDiscount = Math.min(productSubtotal, Math.round(input.couponDiscountAmount * 100) / 100);
      welcomeOfferApplied = false;
      welcomeDiscount = 0;
      pointsUsed = 0;
      pointsDiscount = 0;
    } else if (!code) {
      effectiveBenefit = 'none';
    } else {
      const couponsList = input.couponsCatalog || INITIAL_COUPONS;
      const matched = couponsList.find((c) => c.code.toUpperCase() === code);
      if (!matched) {
        validationError = 'Invalid coupon code.';
        effectiveBenefit = 'none';
      } else {
        const couponRes = evaluateCouponEligibility(matched, [], productSubtotal);
        if (!couponRes.isEligible || couponRes.discountAmount <= 0) {
          validationError = couponRes.reason || 'Coupon is not eligible for this order.';
          effectiveBenefit = 'none';
        } else {
          couponCode = matched.code;
          couponDiscount = Math.min(
            productSubtotal,
            Math.round(couponRes.discountAmount * 100) / 100
          );
          welcomeOfferApplied = false;
          welcomeDiscount = 0;
          pointsUsed = 0;
          pointsDiscount = 0;
        }
      }
    }
  }

  const totalDiscount = Math.min(
    productSubtotal,
    Math.round((welcomeDiscount + pointsDiscount + couponDiscount) * 100) / 100
  );
  const netMerchandiseAmount = Math.max(
    0,
    Math.round((productSubtotal - totalDiscount) * 100) / 100
  );
  const finalTotal = Math.max(0, Math.round((netMerchandiseAmount + shippingCost) * 100) / 100);

  // MANDATORY RULE 6A: If customer uses Welcome Offer, they earn ZERO Nest Points on that order.
  const pointsEarned = welcomeOfferApplied ? 0 : calculateEarnedPoints(netMerchandiseAmount);

  return {
    productSubtotal,
    shippingCost,
    selectedBenefit: effectiveBenefit,
    welcomeOfferApplied,
    welcomeDiscount,
    pointsUsed,
    pointsRedeemed: pointsUsed,
    pointsDiscount,
    couponCode,
    couponDiscount,
    totalDiscount,
    netMerchandiseAmount,
    finalTotal,
    finalPayableAmount: finalTotal,
    pointsEarned,
    comparison,
    validationError,
  };
}
