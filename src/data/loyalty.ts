export const LOYALTY_EARNING_RATE_INR = 50; // 1 point for every 50 Rs spent
export const LOYALTY_POINT_VALUE_INR = 1;  // 1 point = 1 Rupee discount at checkout

export interface LoyaltyAccount {
  id: string; // phone number (sanitized) or email or userId
  userId?: string;
  email?: string;
  phone?: string;
  customerName?: string;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: number;
}

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'bonus' | 'adjustment';

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  orderId?: string;
  type: LoyaltyTransactionType;
  points: number; // positive for earned/bonus, negative for redeemed
  amountInr?: number; // total amount paid or discount applied
  description: string;
  createdAt: number;
}

/**
 * Calculates how many points a customer earns based on their purchase amount.
 * Rate: 1 point for every 50 Rs.
 */
export function calculateEarnedPoints(rupeesSpent: number): number {
  if (typeof rupeesSpent !== 'number' || isNaN(rupeesSpent) || rupeesSpent <= 0) {
    return 0;
  }
  return Math.floor(rupeesSpent / LOYALTY_EARNING_RATE_INR);
}

/**
 * Calculates the cash discount value in INR for a given number of points.
 * Rate: 1 point = 1 Rupee.
 */
export function calculatePointsDiscount(points: number): number {
  if (typeof points !== 'number' || isNaN(points) || points <= 0) {
    return 0;
  }
  return Math.floor(points) * LOYALTY_POINT_VALUE_INR;
}

/**
 * Sanitize loyalty account identifier (phone or email or userId).
 */
export function sanitizeLoyaltyKey(rawKey?: string | null): string {
  if (!rawKey) return 'guest_session';
  const trimmed = rawKey.trim().toLowerCase();
  // If phone number, strip non-digits
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 10) {
    return `phone_${digitsOnly.slice(-10)}`;
  }
  // If email
  if (trimmed.includes('@')) {
    return `email_${trimmed.replace(/[^a-z0-9@._-]/g, '_')}`;
  }
  return trimmed.replace(/[^a-z0-9_-]/g, '_');
}
