import {
  LOYALTY_REFERRAL_REWARD_POINTS,
  LoyaltyAccount,
  LoyaltyTransaction,
  calculatePointsDiscount,
  generateReferralCode,
  getTransactionExpiryDate,
  sanitizeLoyaltyKey,
} from './loyalty';
import { Order } from './orders';

export const REFERRAL_REWARD_POINTS = LOYALTY_REFERRAL_REWARD_POINTS; // 100 Nest Points
export const REFERRAL_REWARD_POINTS_EACH = REFERRAL_REWARD_POINTS;
export const REFERRAL_REWARD_RUPEE_VALUE = calculatePointsDiscount(REFERRAL_REWARD_POINTS); // ₹50
export const REFERRAL_REWARD_INR_VALUE_EACH = REFERRAL_REWARD_RUPEE_VALUE;
export const REFERRAL_MIN_ORDER_SUBTOTAL_INR = 1299; // ₹1,299 excluding delivery charges

export const REFERRAL_CARD_DESCRIPTION =
  'Invite your friends to Cotton Nest! When your friend completes their first eligible order of ₹1,299 or more, you both earn 100 Nest Points (worth ₹50 each) after successful delivery and payment.';

export const REFERRAL_APPLY_BUTTON_LABEL = 'Apply Referral Code';

export const REFERRAL_APPLIED_SUCCESS_MESSAGE =
  'Referral code applied! You and your friend will receive 100 Nest Points each after your first eligible order is successfully delivered and paid.';

export type ReferralLifecycleStatus =
  | 'code_applied'
  | 'order_pending'
  | 'reward_earned'
  | 'cancelled'
  | 'expired_ineligible';

export interface ReferralRewardsConfig {
  enabled: boolean;
  rewardPointsReferrer: number;
  rewardPointsReferred: number;
  minOrderSubtotalInr: number;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_REFERRAL_REWARDS_CONFIG: ReferralRewardsConfig = {
  enabled: true,
  rewardPointsReferrer: REFERRAL_REWARD_POINTS,
  rewardPointsReferred: REFERRAL_REWARD_POINTS,
  minOrderSubtotalInr: REFERRAL_MIN_ORDER_SUBTOTAL_INR,
  updatedAt: Date.now(),
};

export interface ReferralRecord {
  id: string; // referredUid (one referral claim per customer UID)
  referredUid: string;
  referredAccountId: string;
  referredEmail?: string;
  referredPhone?: string;
  referredName?: string;
  referralCode: string; // The referrer's code (e.g. NEST-XXXX123)
  referrerUid?: string;
  referrerAccountId: string;
  referrerName?: string;
  referrerEmail?: string;
  referrerPhone?: string;
  status: ReferralLifecycleStatus;
  statusReason?: string;
  ineligibleReason?: string;
  qualifyingOrderId?: string;
  qualifyingOrderSubtotal?: number;
  referrerPointsAwarded: number;
  referredPointsAwarded: number;
  rewardCredited: boolean;
  rewardCreditedAt?: number;
  rewardReversed?: boolean;
  rewardReversedAt?: number;
  rewardReversedOrderId?: string;
  referrerTxId?: string;
  referredTxId?: string;
  appliedAt: number;
  updatedAt: number;
}

export interface ReferralStatusDisplayInfo {
  status: ReferralLifecycleStatus;
  label: 'Code Applied' | 'Order Pending' | 'Reward Earned' | 'Cancelled' | 'Expired/Ineligible';
  description: string;
  tone: 'gold' | 'amber' | 'emerald' | 'rose' | 'stone';
}

export function getReferralStatusDisplayInfo(
  status: ReferralLifecycleStatus,
  customReason?: string
): ReferralStatusDisplayInfo {
  switch (status) {
    case 'code_applied':
      return {
        status,
        label: 'Code Applied',
        description: customReason || 'Referral registered, awaiting qualifying purchase of ₹1,299+.',
        tone: 'gold',
      };
    case 'order_pending':
      return {
        status,
        label: 'Order Pending',
        description: customReason || 'Eligible order placed; points credit after delivery and payment.',
        tone: 'amber',
      };
    case 'reward_earned':
      return {
        status,
        label: 'Reward Earned',
        description: customReason || 'Order delivered and paid; +100 Nest Points credited to both accounts.',
        tone: 'emerald',
      };
    case 'cancelled':
      return {
        status,
        label: 'Cancelled',
        description: customReason || 'Qualifying order cancelled or fully refunded.',
        tone: 'rose',
      };
    case 'expired_ineligible':
    default:
      return {
        status: 'expired_ineligible',
        label: 'Expired/Ineligible',
        description: customReason || 'Referral does not meet first-order eligibility requirements.',
        tone: 'stone',
      };
  }
}

export const getReferralStatusBadgeMeta = getReferralStatusDisplayInfo;

/**
 * Checks whether a string matches the Cotton Nest referral code pattern (e.g. NEST-XXXX123).
 */
export function isReferralCodeFormat(code?: string | null): boolean {
  if (!code) return false;
  const clean = String(code).trim().toUpperCase();
  return /^NEST-[A-Z0-9]{4,12}$/.test(clean);
}

/**
 * Builds the exact WhatsApp referral sharing text from Section 8 with the customer's dynamic referral code.
 */
export function buildWhatsAppReferralShareMessage(referralCode: string): string {
  const cleanCode = String(referralCode || '').trim().toUpperCase() || 'NEST-ROYAL460';
  return `🎁 Join me on Cotton Nest!

Discover beautiful pure cotton bedsheets and earn rewards when you shop.

Use my referral code: ${cleanCode}

Complete your first eligible order of ₹1,299 or more, and we both earn 100 Nest Points worth ₹50 each after delivery and payment!

Shop here: https://cottonnest.in`;
}

/**
 * Builds a WhatsApp share URL (`https://wa.me/?text=...`) for mobile and desktop.
 */
export function buildWhatsAppReferralShareUrl(referralCode: string): string {
  const message = buildWhatsAppReferralShareMessage(referralCode);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Determines whether a customer has any prior completed or active non-cancelled orders
 * that would disqualify them from being a "first eligible order" referred customer.
 */
export function hasPriorNonCancelledOrders(params: {
  uid?: string | null;
  email?: string | null;
  phone?: string | null;
  orders: Order[];
  excludeOrderId?: string | null;
}): boolean {
  const cleanUid = String(params.uid || '').trim().toLowerCase();
  const cleanEmail = String(params.email || '').trim().toLowerCase();
  const cleanPhone = String(params.phone || '').replace(/[^0-9]/g, '').slice(-10);
  const excludeId = String(params.excludeOrderId || '').trim();

  if (!Array.isArray(params.orders) || params.orders.length === 0) {
    return false;
  }

  return params.orders.some((o) => {
    if (!o || o.status === 'cancelled' || o.status === 'refunded') return false;
    if (excludeId && String(o.id) === excludeId) return false;

    const oUid = String(o.userId || '').trim().toLowerCase();
    const oEmail = String(o.customerEmail || '').trim().toLowerCase();
    const oPhone = String(o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);

    if (cleanUid && oUid && cleanUid === oUid) return true;
    if (cleanEmail && oEmail && cleanEmail === oEmail) return true;
    if (cleanPhone && cleanPhone.length === 10 && oPhone === cleanPhone) return true;
    return false;
  });
}

export interface ValidateReferralApplicationInput {
  referralCodeInput: string;
  referredUid: string;
  referredAccountId?: string;
  referredEmail?: string;
  referredPhone?: string;
  referredName?: string;
  referredOwnReferralCode?: string;
  existingReferralForUser?: ReferralRecord | null;
  alreadyReferredByCodeOnAccount?: string | null;
  referrerAccount?: LoyaltyAccount | null;
  customerOrders?: Order[];
  config?: Partial<ReferralRewardsConfig> | null;
  nowMs?: number;
}

export interface ValidateReferralApplicationResult {
  valid: boolean;
  error?: string;
  message?: string;
  record?: ReferralRecord;
}

/**
 * Authoritative validation when a customer clicks "Apply Referral Code".
 * Enforces:
 * 1. Referral program is enabled.
 * 2. Customer is authenticated with a valid Firebase UID.
 * 3. Referral code format is valid and belongs to an existing referrer account.
 * 4. Strict self-referral prevention (UID, accountId, referralCode, email, phone).
 * 5. Single referral code claim per customer (cannot claim multiple codes).
 * 6. Customer must not have already completed a prior order (must be for their first eligible order).
 * 7. NEVER credits points immediately — creates a `code_applied` record awaiting qualifying purchase.
 */
export function validateAndCreateReferralApplication(
  input: ValidateReferralApplicationInput
): ValidateReferralApplicationResult {
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(input.config || {}),
  };
  const nowMs = typeof input.nowMs === 'number' && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();

  if (!config.enabled) {
    return {
      valid: false,
      error: 'Referral Rewards are currently paused by Cotton Nest.',
    };
  }

  const referredUid = String(input.referredUid || '').trim();
  if (!referredUid || referredUid === 'guest_default_wallet') {
    return {
      valid: false,
      error: 'Please sign in to your Cotton Nest account to apply a referral code.',
    };
  }

  const cleanCode = String(input.referralCodeInput || '').trim().toUpperCase();
  if (!cleanCode || !isReferralCodeFormat(cleanCode)) {
    return {
      valid: false,
      error: 'Please enter a valid Cotton Nest referral code (e.g., NEST-XXXX123).',
    };
  }

  const referredAccountId = sanitizeLoyaltyKey(
    input.referredAccountId || input.referredPhone || input.referredEmail || referredUid
  );
  const cleanReferredEmail = String(input.referredEmail || '').trim().toLowerCase();
  const cleanReferredPhone = String(input.referredPhone || '').replace(/[^0-9]/g, '').slice(-10);

  // 1. Check self-referral against customer's own generated codes
  const ownCandidates = new Set<string>();
  if (input.referredOwnReferralCode) ownCandidates.add(input.referredOwnReferralCode.trim().toUpperCase());
  if (input.referredName) ownCandidates.add(generateReferralCode(input.referredName).toUpperCase());
  if (cleanReferredEmail) ownCandidates.add(generateReferralCode(cleanReferredEmail).toUpperCase());
  if (cleanReferredPhone) ownCandidates.add(generateReferralCode(cleanReferredPhone).toUpperCase());
  ownCandidates.add(generateReferralCode(referredAccountId).toUpperCase());
  ownCandidates.add(generateReferralCode(referredUid).toUpperCase());

  if (ownCandidates.has(cleanCode)) {
    return {
      valid: false,
      error: 'You cannot apply your own referral code.',
    };
  }

  // 2. Check if customer has already claimed a referral code
  if (input.existingReferralForUser) {
    return {
      valid: false,
      error: `You have already applied referral code ${input.existingReferralForUser.referralCode}. Each customer can claim only one referral code.`,
    };
  }

  if (input.alreadyReferredByCodeOnAccount) {
    return {
      valid: false,
      error: `You have already applied referral code ${input.alreadyReferredByCodeOnAccount}. Each customer can claim only one referral code.`,
    };
  }

  // 3. Verify referrer account exists and is not the same person
  const referrer = input.referrerAccount;
  if (!referrer) {
    return {
      valid: false,
      error: 'We could not find an active Cotton Nest member with that referral code. Please check the code and try again.',
    };
  }

  const referrerUid = String(referrer.userId || '').trim();
  const referrerEmail = String(referrer.email || '').trim().toLowerCase();
  const referrerPhone = String(referrer.phone || '').replace(/[^0-9]/g, '').slice(-10);

  if (
    (referrerUid && referrerUid === referredUid) ||
    referrer.id === referredAccountId ||
    (cleanReferredEmail && referrerEmail && cleanReferredEmail === referrerEmail) ||
    (cleanReferredPhone && cleanReferredPhone.length === 10 && referrerPhone === cleanReferredPhone)
  ) {
    return {
      valid: false,
      error: 'You cannot apply your own referral code.',
    };
  }

  // 4. Verify referred customer is making their first eligible order (no prior non-cancelled orders)
  if (
    Array.isArray(input.customerOrders) &&
    hasPriorNonCancelledOrders({
      uid: referredUid,
      email: cleanReferredEmail,
      phone: cleanReferredPhone,
      orders: input.customerOrders,
    })
  ) {
    return {
      valid: false,
      error: 'Referral codes are exclusively valid for new customers before placing their first eligible order.',
    };
  }

  const record: ReferralRecord = {
    id: referredUid,
    referredUid,
    referredAccountId,
    referredEmail: cleanReferredEmail || undefined,
    referredPhone: cleanReferredPhone || undefined,
    referredName: input.referredName ? input.referredName.trim() : undefined,
    referralCode: cleanCode,
    referrerUid: referrerUid || undefined,
    referrerAccountId: referrer.id,
    referrerName: referrer.customerName || undefined,
    status: 'code_applied',
    statusReason: 'Referral registered, awaiting qualifying purchase of ₹1,299+.',
    referrerPointsAwarded: 0,
    referredPointsAwarded: 0,
    rewardCredited: false,
    appliedAt: nowMs,
    updatedAt: nowMs,
  };

  return {
    valid: true,
    message: REFERRAL_APPLIED_SUCCESS_MESSAGE,
    record,
  };
}

export interface ReferralCheckoutCompatibilityInput {
  referralRecord: ReferralRecord | null | undefined;
  productSubtotal: number; // Product subtotal excluding delivery charges
  welcomeOfferApplied: boolean;
  pointsRedeemed: number;
  customerOrders?: Order[];
  config?: Partial<ReferralRewardsConfig> | null;
}

export interface ReferralCheckoutCompatibilityResult {
  hasActivePendingReferral: boolean;
  referralCode: string | null;
  qualifiesForThisOrder: boolean;
  hasDiscountConflict: boolean;
  conflictType: 'welcome_offer' | 'nest_points' | null;
  meetsMinSubtotal: boolean;
  shortfallAmount: number;
  isFirstOrder: boolean;
  statusMessage: string;
}

/**
 * Evaluates whether the current checkout bag qualifies for an applied referral code (`code_applied`)
 * and detects conflicts with Welcome Offer or Nest Points redemption without silently removing any discount.
 */
export function evaluateReferralCheckoutCompatibility(
  input: ReferralCheckoutCompatibilityInput
): ReferralCheckoutCompatibilityResult {
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(input.config || {}),
  };
  const record = input.referralRecord;

  if (!record || record.status !== 'code_applied' || !config.enabled) {
    return {
      hasActivePendingReferral: false,
      referralCode: null,
      qualifiesForThisOrder: false,
      hasDiscountConflict: false,
      conflictType: null,
      meetsMinSubtotal: false,
      shortfallAmount: 0,
      isFirstOrder: true,
      statusMessage: '',
    };
  }

  const safeSubtotal = Math.max(0, Math.round((Number(input.productSubtotal) || 0) * 100) / 100);
  const minRequired = config.minOrderSubtotalInr || REFERRAL_MIN_ORDER_SUBTOTAL_INR;
  const meetsMinSubtotal = safeSubtotal >= minRequired;
  const shortfallAmount = meetsMinSubtotal
    ? 0
    : Math.max(0, Math.round((minRequired - safeSubtotal) * 100) / 100);

  const isFirstOrder = !hasPriorNonCancelledOrders({
    uid: record.referredUid,
    email: record.referredEmail,
    phone: record.referredPhone,
    orders: input.customerOrders || [],
  });

  if (!isFirstOrder) {
    return {
      hasActivePendingReferral: true,
      referralCode: record.referralCode,
      qualifiesForThisOrder: false,
      hasDiscountConflict: false,
      conflictType: null,
      meetsMinSubtotal,
      shortfallAmount,
      isFirstOrder: false,
      statusMessage: 'Referral reward applies only to a customer’s first eligible order.',
    };
  }

  if (input.welcomeOfferApplied) {
    return {
      hasActivePendingReferral: true,
      referralCode: record.referralCode,
      qualifiesForThisOrder: false,
      hasDiscountConflict: true,
      conflictType: 'welcome_offer',
      meetsMinSubtotal,
      shortfallAmount,
      isFirstOrder: true,
      statusMessage: `Referral code ${record.referralCode} cannot be combined with the Welcome Offer on the same order. Choose whether to keep your immediate Welcome Offer discount or switch to earn +${config.rewardPointsReferred} Nest Points each after delivery.`,
    };
  }

  if ((Number(input.pointsRedeemed) || 0) > 0) {
    return {
      hasActivePendingReferral: true,
      referralCode: record.referralCode,
      qualifiesForThisOrder: false,
      hasDiscountConflict: true,
      conflictType: 'nest_points',
      meetsMinSubtotal,
      shortfallAmount,
      isFirstOrder: true,
      statusMessage: `Referral code ${record.referralCode} cannot be combined with Nest Points redemption on the same order. Choose whether to redeem Nest Points now or switch to earn +${config.rewardPointsReferred} Nest Points each after delivery.`,
    };
  }

  if (!meetsMinSubtotal) {
    return {
      hasActivePendingReferral: true,
      referralCode: record.referralCode,
      qualifiesForThisOrder: false,
      hasDiscountConflict: false,
      conflictType: null,
      meetsMinSubtotal: false,
      shortfallAmount,
      isFirstOrder: true,
      statusMessage: `Add ₹${shortfallAmount.toLocaleString('en-IN')} more in products (minimum ₹${minRequired.toLocaleString('en-IN')}, excluding delivery) for this order to qualify for your +${config.rewardPointsReferred} Nest Points referral reward.`,
    };
  }

  return {
    hasActivePendingReferral: true,
    referralCode: record.referralCode,
    qualifiesForThisOrder: true,
    hasDiscountConflict: false,
    conflictType: null,
    meetsMinSubtotal: true,
    shortfallAmount: 0,
    isFirstOrder: true,
    statusMessage: `✓ Qualifying First Order for Referral (${record.referralCode}): You and your friend will each earn +${config.rewardPointsReferred} Nest Points (worth ₹${calculatePointsDiscount(config.rewardPointsReferred)}) after successful delivery and payment.`,
  };
}

/**
 * Transitions a `code_applied` ReferralRecord when the referred customer places an order.
 * - If the order meets all qualifying rules (first order, product subtotal >= ₹1,299, no Welcome Offer, no Nest Points redeemed):
 *   transitions status to `'order_pending'` linked to `order.id`.
 * - If the customer placed their first order without meeting referral eligibility (e.g., used Welcome Offer or subtotal < ₹1,299):
 *   transitions status to `'expired_ineligible'` so the referral does not stay stuck indefinitely.
 */
export function evaluateReferralOnOrderPlaced(params: {
  record: ReferralRecord;
  order: Order;
  priorOrders?: Order[];
  config?: Partial<ReferralRewardsConfig> | null;
  nowMs?: number;
}): {
  updatedRecord: ReferralRecord;
  isQualifyingOrder: boolean;
} {
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(params.config || {}),
  };
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
  const { record, order } = params;

  if (record.status !== 'code_applied') {
    return {
      updatedRecord: record,
      isQualifyingOrder: record.status === 'order_pending' && record.qualifyingOrderId === order.id,
    };
  }

  const shippingCost = Math.max(0, Number(order.shippingCost) || 0);
  const rawProductSubtotal =
    typeof order.subtotal === 'number' && order.subtotal > 0
      ? order.subtotal
      : Array.isArray(order.items) && order.items.length > 0
      ? order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * Math.max(1, Number(it.quantity) || 1), 0)
      : Math.max(0, (Number(order.totalAmount) || 0) - shippingCost);

  const productSubtotal = Math.round(rawProductSubtotal * 100) / 100;
  const usedWelcomeOffer = Boolean(
    order.welcomeOfferApplied ||
      order.benefitType === 'welcome_offer' ||
      (Number(order.welcomeDiscount) || 0) > 0
  );
  const usedNestPoints = Boolean(
    order.benefitType === 'nest_points' ||
      (Number(order.pointsUsed) || 0) > 0 ||
      (Number(order.pointsDiscount) || 0) > 0
  );

  const hadPriorOrder = hasPriorNonCancelledOrders({
    uid: record.referredUid,
    email: record.referredEmail || order.customerEmail,
    phone: record.referredPhone || order.customerPhone,
    orders: params.priorOrders || [],
    excludeOrderId: order.id,
  });

  if (hadPriorOrder) {
    return {
      updatedRecord: {
        ...record,
        status: 'expired_ineligible',
        statusReason: 'Ineligible: customer already had a prior order before this purchase.',
        updatedAt: nowMs,
      },
      isQualifyingOrder: false,
    };
  }

  if (usedWelcomeOffer) {
    return {
      updatedRecord: {
        ...record,
        status: 'expired_ineligible',
        qualifyingOrderId: order.id,
        qualifyingOrderSubtotal: productSubtotal,
        statusReason: `Ineligible: first order #${order.id} used the Welcome Offer discount.`,
        updatedAt: nowMs,
      },
      isQualifyingOrder: false,
    };
  }

  if (usedNestPoints) {
    return {
      updatedRecord: {
        ...record,
        status: 'expired_ineligible',
        qualifyingOrderId: order.id,
        qualifyingOrderSubtotal: productSubtotal,
        statusReason: `Ineligible: first order #${order.id} used Nest Points redemption.`,
        updatedAt: nowMs,
      },
      isQualifyingOrder: false,
    };
  }

  if (productSubtotal < (config.minOrderSubtotalInr || REFERRAL_MIN_ORDER_SUBTOTAL_INR)) {
    return {
      updatedRecord: {
        ...record,
        status: 'expired_ineligible',
        qualifyingOrderId: order.id,
        qualifyingOrderSubtotal: productSubtotal,
        statusReason: `Ineligible: first order #${order.id} product subtotal (₹${productSubtotal.toLocaleString('en-IN')}) was below ₹${(config.minOrderSubtotalInr || REFERRAL_MIN_ORDER_SUBTOTAL_INR).toLocaleString('en-IN')}.`,
        updatedAt: nowMs,
      },
      isQualifyingOrder: false,
    };
  }

  return {
    updatedRecord: {
      ...record,
      status: 'order_pending',
      qualifyingOrderId: order.id,
      qualifyingOrderSubtotal: productSubtotal,
      statusReason: `Qualifying Order #${order.id} placed (₹${productSubtotal.toLocaleString('en-IN')}). Points credit after delivery & payment.`,
      updatedAt: nowMs,
    },
    isQualifyingOrder: true,
  };
}

export interface SettleReferralOnDeliveryResult {
  settled: boolean;
  alreadyCredited: boolean;
  updatedRecord: ReferralRecord;
  updatedReferrerAccount?: LoyaltyAccount;
  updatedReferredAccount?: LoyaltyAccount;
  referrerTx?: LoyaltyTransaction;
  referredTx?: LoyaltyTransaction;
}

/**
 * Idempotently credits 100 Nest Points to BOTH the referrer and the referred customer
 * ONLY when the qualifying order is marked `'delivered'` (delivered and fully paid).
 *
 * Guarantees:
 * - Never awards points if `record.rewardCredited` is already true (idempotent across repeated delivery clicks/logins/refreshes).
 * - Never awards points if the order subtotal < ₹1,299 or if Welcome Offer / Nest Points were used on the order.
 * - Uses deterministic transaction IDs (`tx_ref_referrer_${orderId}` and `tx_ref_referred_${orderId}`).
 */
export function settleReferralRewardOnDelivery(params: {
  record: ReferralRecord;
  order: Order;
  referrerAccount: LoyaltyAccount;
  referredAccount: LoyaltyAccount;
  config?: Partial<ReferralRewardsConfig> | null;
  nowMs?: number;
}): SettleReferralOnDeliveryResult {
  const { record, order, referrerAccount, referredAccount } = params;
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(params.config || {}),
  };
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();

  // Idempotency guard: if already credited, return immediately with no duplicate transactions
  if (record.rewardCredited || record.status === 'reward_earned') {
    return {
      settled: false,
      alreadyCredited: true,
      updatedRecord: record,
    };
  }

  if (order.status !== 'delivered') {
    return {
      settled: false,
      alreadyCredited: false,
      updatedRecord: record,
    };
  }

  if (record.qualifyingOrderId && record.qualifyingOrderId !== order.id) {
    return {
      settled: false,
      alreadyCredited: false,
      updatedRecord: record,
    };
  }

  // Re-verify order eligibility server-side (do not trust client flags)
  const shippingCost = Math.max(0, Number(order.shippingCost) || 0);
  const rawProductSubtotal =
    typeof order.subtotal === 'number' && order.subtotal > 0
      ? order.subtotal
      : Array.isArray(order.items) && order.items.length > 0
      ? order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * Math.max(1, Number(it.quantity) || 1), 0)
      : Math.max(0, (Number(order.totalAmount) || 0) - shippingCost);
  const productSubtotal = Math.round(rawProductSubtotal * 100) / 100;

  const usedWelcomeOffer = Boolean(
    order.welcomeOfferApplied ||
      order.benefitType === 'welcome_offer' ||
      (Number(order.welcomeDiscount) || 0) > 0
  );
  const usedNestPoints = Boolean(
    order.benefitType === 'nest_points' ||
      (Number(order.pointsUsed) || 0) > 0 ||
      (Number(order.pointsDiscount) || 0) > 0
  );

  if (
    usedWelcomeOffer ||
    usedNestPoints ||
    productSubtotal < (config.minOrderSubtotalInr || REFERRAL_MIN_ORDER_SUBTOTAL_INR)
  ) {
    return {
      settled: false,
      alreadyCredited: false,
      updatedRecord: {
        ...record,
        status: 'expired_ineligible',
        statusReason: 'Order did not meet referral eligibility requirements upon delivery verification.',
        updatedAt: nowMs,
      },
    };
  }

  const referrerPts = Math.max(1, Number(config.rewardPointsReferrer) || REFERRAL_REWARD_POINTS);
  const referredPts = Math.max(1, Number(config.rewardPointsReferred) || REFERRAL_REWARD_POINTS);
  const expiresAt = getTransactionExpiryDate(nowMs);
  const cleanOrderId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '');

  const referrerTxId = `tx_ref_referrer_${cleanOrderId}`;
  const referredTxId = `tx_ref_referred_${cleanOrderId}`;

  const referrerTx: LoyaltyTransaction = {
    id: referrerTxId,
    accountId: referrerAccount.id,
    orderId: order.id,
    type: 'referral',
    points: referrerPts,
    amountInr: calculatePointsDiscount(referrerPts),
    description: `Referral Reward Earned: Friend completed first eligible Order #${order.id} (Code: ${record.referralCode})`,
    createdAt: nowMs,
    expiresAt,
    status: 'credited',
  };

  const referredTx: LoyaltyTransaction = {
    id: referredTxId,
    accountId: referredAccount.id,
    orderId: order.id,
    type: 'referral',
    points: referredPts,
    amountInr: calculatePointsDiscount(referredPts),
    description: `Referral Reward Earned on your first eligible Order #${order.id} (Code: ${record.referralCode})`,
    createdAt: nowMs,
    expiresAt,
    status: 'credited',
  };

  const updatedReferrerAccount: LoyaltyAccount = {
    ...referrerAccount,
    pointsBalance: (referrerAccount.pointsBalance || 0) + referrerPts,
    lifetimeEarned: (referrerAccount.lifetimeEarned || 0) + referrerPts,
    referralPointsEarned: (referrerAccount.referralPointsEarned || 0) + referrerPts,
    referralCount: (referrerAccount.referralCount || 0) + 1,
    updatedAt: nowMs,
  };

  const updatedReferredAccount: LoyaltyAccount = {
    ...referredAccount,
    pointsBalance: (referredAccount.pointsBalance || 0) + referredPts,
    lifetimeEarned: (referredAccount.lifetimeEarned || 0) + referredPts,
    referralPointsEarned: (referredAccount.referralPointsEarned || 0) + referredPts,
    referredByCode: record.referralCode,
    updatedAt: nowMs,
  };

  const updatedRecord: ReferralRecord = {
    ...record,
    status: 'reward_earned',
    qualifyingOrderId: order.id,
    qualifyingOrderSubtotal: productSubtotal,
    statusReason: `Order #${order.id} delivered and paid; +${referredPts} Nest Points credited to both accounts.`,
    referrerPointsAwarded: referrerPts,
    referredPointsAwarded: referredPts,
    rewardCredited: true,
    rewardCreditedAt: nowMs,
    referrerTxId,
    referredTxId,
    updatedAt: nowMs,
  };

  return {
    settled: true,
    alreadyCredited: false,
    updatedRecord,
    updatedReferrerAccount,
    updatedReferredAccount,
    referrerTx,
    referredTx,
  };
}

export interface ReverseReferralOnCancellationOrRefundResult {
  changed: boolean;
  pointsReversed: boolean;
  updatedRecord: ReferralRecord;
  updatedReferrerAccount?: LoyaltyAccount;
  updatedReferredAccount?: LoyaltyAccount;
  referrerReversalTx?: LoyaltyTransaction;
  referredReversalTx?: LoyaltyTransaction;
}

/**
 * Handles cancellation before delivery OR full refund after delivery:
 * 1. If cancelled before reward issuance (`status === 'order_pending'` and `!record.rewardCredited`):
 *    cancels the pending reward (`status = 'cancelled'`) with 0 points credited.
 * 2. If fully refunded after points were credited (`orderStatus === 'refunded'` and `record.rewardCredited` and `!record.rewardReversed`):
 *    reverses the credited referral points safely from both accounts, clamping `pointsBalance` at 0
 *    so available balances never become negative, and preventing duplicate deductions.
 */
export function reverseReferralOnCancellationOrRefund(params: {
  record: ReferralRecord;
  orderId: string;
  orderStatus: 'cancelled' | 'refunded';
  referrerAccount?: LoyaltyAccount | null;
  referredAccount?: LoyaltyAccount | null;
  nowMs?: number;
}): ReverseReferralOnCancellationOrRefundResult {
  const { record, orderId, orderStatus, referrerAccount, referredAccount } = params;
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();

  if (record.qualifyingOrderId && record.qualifyingOrderId !== orderId) {
    return {
      changed: false,
      pointsReversed: false,
      updatedRecord: record,
    };
  }

  // Case 1: Order cancelled before points were ever credited
  if (!record.rewardCredited) {
    if (record.status === 'cancelled') {
      return {
        changed: false,
        pointsReversed: false,
        updatedRecord: record,
      };
    }
    return {
      changed: true,
      pointsReversed: false,
      updatedRecord: {
        ...record,
        status: 'cancelled',
        statusReason: `Qualifying Order #${orderId} was cancelled before delivery; no referral points were credited.`,
        updatedAt: nowMs,
      },
    };
  }

  // Case 2: Points were already credited; only reverse if the order is refunded (or cancelled after credit) and not yet reversed
  if (record.rewardReversed) {
    return {
      changed: false,
      pointsReversed: false,
      updatedRecord: record,
    };
  }

  if (orderStatus !== 'refunded' && orderStatus !== 'cancelled') {
    return {
      changed: false,
      pointsReversed: false,
      updatedRecord: record,
    };
  }

  const referrerPtsToReverse = Math.max(0, Number(record.referrerPointsAwarded) || REFERRAL_REWARD_POINTS);
  const referredPtsToReverse = Math.max(0, Number(record.referredPointsAwarded) || REFERRAL_REWARD_POINTS);
  const cleanOrderId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');

  let updatedReferrerAccount: LoyaltyAccount | undefined;
  let referrerReversalTx: LoyaltyTransaction | undefined;

  if (referrerAccount && referrerPtsToReverse > 0) {
    const newBalance = Math.max(0, (referrerAccount.pointsBalance || 0) - referrerPtsToReverse);
    const newLifetimeEarned = Math.max(
      referrerAccount.lifetimeSpent || 0,
      Math.max(0, (referrerAccount.lifetimeEarned || 0) - referrerPtsToReverse)
    );
    const newReferralEarned = Math.max(0, (referrerAccount.referralPointsEarned || 0) - referrerPtsToReverse);
    const newReferralCount = Math.max(0, (referrerAccount.referralCount || 1) - 1);

    updatedReferrerAccount = {
      ...referrerAccount,
      pointsBalance: newBalance,
      lifetimeEarned: newLifetimeEarned,
      referralPointsEarned: newReferralEarned,
      referralCount: newReferralCount,
      updatedAt: nowMs,
    };

    referrerReversalTx = {
      id: `tx_ref_rev_referrer_${cleanOrderId}`,
      accountId: referrerAccount.id,
      orderId,
      type: 'adjustment',
      points: -referrerPtsToReverse,
      amountInr: calculatePointsDiscount(referrerPtsToReverse),
      description: `Referral Reward Reversed: Referred Order #${orderId} was refunded/cancelled`,
      createdAt: nowMs,
      status: 'credited',
    };
  }

  let updatedReferredAccount: LoyaltyAccount | undefined;
  let referredReversalTx: LoyaltyTransaction | undefined;

  if (referredAccount && referredPtsToReverse > 0) {
    const newBalance = Math.max(0, (referredAccount.pointsBalance || 0) - referredPtsToReverse);
    const newLifetimeEarned = Math.max(
      referredAccount.lifetimeSpent || 0,
      Math.max(0, (referredAccount.lifetimeEarned || 0) - referredPtsToReverse)
    );
    const newReferralEarned = Math.max(0, (referredAccount.referralPointsEarned || 0) - referredPtsToReverse);

    updatedReferredAccount = {
      ...referredAccount,
      pointsBalance: newBalance,
      lifetimeEarned: newLifetimeEarned,
      referralPointsEarned: newReferralEarned,
      updatedAt: nowMs,
    };

    referredReversalTx = {
      id: `tx_ref_rev_referred_${cleanOrderId}`,
      accountId: referredAccount.id,
      orderId,
      type: 'adjustment',
      points: -referredPtsToReverse,
      amountInr: calculatePointsDiscount(referredPtsToReverse),
      description: `Referral Reward Reversed: Order #${orderId} was refunded/cancelled`,
      createdAt: nowMs,
      status: 'credited',
    };
  }

  const updatedRecord: ReferralRecord = {
    ...record,
    status: 'cancelled',
    statusReason: `Order #${orderId} was ${orderStatus}; credited referral points were reversed.`,
    rewardReversed: true,
    rewardReversedAt: nowMs,
    rewardReversedOrderId: orderId,
    updatedAt: nowMs,
  };

  return {
    changed: true,
    pointsReversed: true,
    updatedRecord,
    updatedReferrerAccount,
    updatedReferredAccount,
    referrerReversalTx,
    referredReversalTx,
  };
}

export interface CustomerReferralSummary {
  config: ReferralRewardsConfig;
  myReferralCode: string;
  appliedReferral: ReferralRecord | null; // The referral code this customer applied as a referred friend
  referralsMadeByMe: ReferralRecord[]; // Friends who applied this customer's referral code
  pendingRewardsPoints: number;
  earnedRewardsPoints: number;
  successfulReferralsCount: number;
}

/**
 * Computes accurate customer-facing referral metrics (Pending Rewards, Earned Rewards, Successful Referrals)
 * while preserving historical `referralPointsEarned` and `referralCount` from the customer's LoyaltyAccount.
 */
export function computeCustomerReferralSummary(params: {
  config?: Partial<ReferralRewardsConfig> | null;
  myReferralCode: string;
  myLoyaltyAccount?: LoyaltyAccount | null;
  appliedReferral?: ReferralRecord | null;
  referralsMadeByMe?: ReferralRecord[];
}): CustomerReferralSummary {
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(params.config || {}),
  };
  const applied = params.appliedReferral || null;
  const madeList = Array.isArray(params.referralsMadeByMe) ? params.referralsMadeByMe : [];

  // Pending rewards:
  // 1. If this customer applied a friend's code and it is in 'code_applied' or 'order_pending' state -> +100 pending pts
  // 2. For each friend who applied this customer's code and is in 'code_applied' or 'order_pending' state -> +100 pending pts
  let pendingRewardsPoints = 0;
  if (applied && (applied.status === 'code_applied' || applied.status === 'order_pending')) {
    pendingRewardsPoints += config.rewardPointsReferred || REFERRAL_REWARD_POINTS;
  }
  madeList.forEach((r) => {
    if (r && (r.status === 'code_applied' || r.status === 'order_pending')) {
      pendingRewardsPoints += config.rewardPointsReferrer || REFERRAL_REWARD_POINTS;
    }
  });

  // Earned rewards & Successful referrals:
  // Combine live ReferralRecord items in 'reward_earned' state with historical LoyaltyAccount counters (preserving existing balances)
  let earnedFromRecords = 0;
  if (applied && applied.status === 'reward_earned' && applied.rewardCredited && !applied.rewardReversed) {
    earnedFromRecords += applied.referredPointsAwarded || REFERRAL_REWARD_POINTS;
  }
  let successfulFromRecords = 0;
  madeList.forEach((r) => {
    if (r && r.status === 'reward_earned' && r.rewardCredited && !r.rewardReversed) {
      earnedFromRecords += r.referrerPointsAwarded || REFERRAL_REWARD_POINTS;
      successfulFromRecords += 1;
    }
  });

  const historicalEarned = Math.max(0, Number(params.myLoyaltyAccount?.referralPointsEarned) || 0);
  const historicalCount = Math.max(0, Number(params.myLoyaltyAccount?.referralCount) || 0);

  return {
    config,
    myReferralCode: params.myReferralCode,
    appliedReferral: applied,
    referralsMadeByMe: madeList,
    pendingRewardsPoints,
    earnedRewardsPoints: Math.max(historicalEarned, earnedFromRecords),
    successfulReferralsCount: Math.max(historicalCount, successfulFromRecords),
  };
}

export interface AdminReferralSummary {
  config: ReferralRewardsConfig;
  stats: {
    totalCodesApplied: number;
    pendingReferralsCount: number;
    successfulReferralsCount: number;
    totalNestPointsAwarded: number;
    cancelledOrIneligibleCount: number;
  };
  records: ReferralRecord[];
}

export function computeAdminReferralSummary(params: {
  config?: Partial<ReferralRewardsConfig> | null;
  records: ReferralRecord[];
}): AdminReferralSummary {
  const config: ReferralRewardsConfig = {
    ...DEFAULT_REFERRAL_REWARDS_CONFIG,
    ...(params.config || {}),
  };
  const list = Array.isArray(params.records)
    ? [...params.records].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    : [];

  let pendingReferralsCount = 0;
  let successfulReferralsCount = 0;
  let totalNestPointsAwarded = 0;
  let cancelledOrIneligibleCount = 0;

  list.forEach((r) => {
    if (!r) return;
    if (r.status === 'code_applied' || r.status === 'order_pending') {
      pendingReferralsCount += 1;
    } else if (r.status === 'reward_earned' && r.rewardCredited && !r.rewardReversed) {
      successfulReferralsCount += 1;
      totalNestPointsAwarded += (Number(r.referrerPointsAwarded) || 0) + (Number(r.referredPointsAwarded) || 0);
    } else if (r.status === 'cancelled' || r.status === 'expired_ineligible') {
      cancelledOrIneligibleCount += 1;
    }
  });

  return {
    config,
    stats: {
      totalCodesApplied: list.length,
      pendingReferralsCount,
      successfulReferralsCount,
      totalNestPointsAwarded,
      cancelledOrIneligibleCount,
    },
    records: list,
  };
}
