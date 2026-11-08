export const LOYALTY_POINTS_PER_100_INR = 5; // 5 Nest Points per ₹100 spent (excluding delivery charges)
export const LOYALTY_EARNING_SPEND_UNIT_INR = 100;
export const LOYALTY_EARNING_RATE_INR = 20; // Equivalent to 5 points per ₹100
export const LOYALTY_POINTS_REDEMPTION_BLOCK = 100; // 100 points = ₹50
export const LOYALTY_REDEMPTION_VALUE_PER_100_PTS = 50; // ₹50 for 100 points
export const LOYALTY_POINT_VALUE_INR = 0.5; // 1 Nest Point = ₹0.50 (100 points = ₹50)
export const LOYALTY_MIN_REDEMPTION_POINTS = 200; // Minimum 200 Nest Points (₹100) required for redemption
export const LOYALTY_EXPIRY_MONTHS = 12; // Nest Points expire 12 months after credit date
export const LOYALTY_REFERRAL_REWARD_POINTS = 100; // 100 Nest Points (₹50) per referral reward

export interface LoyaltyAccount {
  id: string; // phone number (sanitized) or email or userId
  userId?: string;
  email?: string;
  phone?: string;
  customerName?: string;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  referralPointsEarned?: number;
  referralCode?: string;
  referredByCode?: string;
  referralCount?: number;
  updatedAt: number;
}

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'bonus' | 'referral' | 'adjustment';

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  orderId?: string;
  type: LoyaltyTransactionType;
  points: number; // positive for earned/bonus/referral, negative for redeemed
  amountInr?: number; // eligible order value (excluding delivery) or discount applied
  description: string;
  createdAt: number;
  expiresAt?: number; // 12 months from createdAt for positive point credits
  status?: 'credited' | 'pending_delivery' | 'expired';
}

/**
 * Computes the 12-month expiry timestamp from a credit timestamp.
 */
export function getTransactionExpiryDate(createdAt: number, explicitExpiresAt?: number): number {
  if (typeof explicitExpiresAt === 'number' && !isNaN(explicitExpiresAt) && explicitExpiresAt > 0) {
    return explicitExpiresAt;
  }
  const base = typeof createdAt === 'number' && !isNaN(createdAt) && createdAt > 0 ? createdAt : Date.now();
  const date = new Date(base);
  date.setFullYear(date.getFullYear() + 1); // 12 months validity
  return date.getTime();
}

/**
 * Checks if an earned point credit has passed its 12-month expiry date.
 */
export function isTransactionExpired(createdAt: number, explicitExpiresAt?: number, now = Date.now()): boolean {
  return getTransactionExpiryDate(createdAt, explicitExpiresAt) <= now;
}

/**
 * Calculates how many Nest Points a customer earns based on eligible purchase amount (excluding delivery charges).
 * Rule: 5 points per ₹100 spent. No points on delivery charges.
 */
export function calculateEarnedPoints(eligibleRupeesExcludingDelivery: number): number {
  if (
    typeof eligibleRupeesExcludingDelivery !== 'number' ||
    isNaN(eligibleRupeesExcludingDelivery) ||
    eligibleRupeesExcludingDelivery <= 0
  ) {
    return 0;
  }
  return Math.floor((eligibleRupeesExcludingDelivery / LOYALTY_EARNING_SPEND_UNIT_INR) * LOYALTY_POINTS_PER_100_INR);
}

/**
 * Calculates the rupee value / discount in INR for a given number of Nest Points.
 * Rule: 100 points = ₹50 (1 point = ₹0.50).
 */
export function calculatePointsDiscount(points: number): number {
  if (typeof points !== 'number' || isNaN(points) || points <= 0) {
    return 0;
  }
  return Math.floor(points * LOYALTY_POINT_VALUE_INR);
}

/**
 * Calculates how many Nest Points are needed to cover a given rupee discount amount.
 * Since 100 points = ₹50 (2 points = ₹1), 1 Rupee requires 2 points.
 */
export function calculatePointsForRupeeDiscount(rupeesDiscount: number): number {
  if (typeof rupeesDiscount !== 'number' || isNaN(rupeesDiscount) || rupeesDiscount <= 0) {
    return 0;
  }
  return Math.floor(rupeesDiscount / LOYALTY_POINT_VALUE_INR);
}

/**
 * Checks whether a customer's balance meets the minimum 200 Nest Points requirement for redemption.
 */
export function canRedeemPoints(pointsBalance: number): boolean {
  return typeof pointsBalance === 'number' && !isNaN(pointsBalance) && pointsBalance >= LOYALTY_MIN_REDEMPTION_POINTS;
}

/**
 * Generates a deterministic referral code for a customer account.
 */
export function generateReferralCode(seed?: string | null): string {
  const raw = (seed || 'ROYAL').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = raw.slice(0, 4).padEnd(4, 'N');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 900 + 100;
  }
  const num = hash >= 100 ? hash : 460;
  return `NEST-${prefix}${num}`;
}

/**
 * Sanitize loyalty account identifier (phone or email or userId).
 */
export function sanitizeLoyaltyKey(rawKey?: string | null): string {
  if (!rawKey) return 'guest_default_wallet';
  let trimmed = rawKey.trim().toLowerCase();

  // Strip any repeated prefixes
  trimmed = trimmed.replace(/^(email_|phone_)+/, '');

  if (trimmed.includes('@')) {
    const cleanEmail = trimmed.replace(/^email_+/, '');
    return `email_${cleanEmail.replace(/[^a-z0-9@._-]/g, '_')}`;
  }

  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 10) {
    return `phone_${digitsOnly.slice(-10)}`;
  }

  return trimmed.replace(/[^a-z0-9_-]/g, '_');
}
