import { formatRupeeAmount } from './welcomeOffer';

export const BIRTHDAY_REWARDS_CLUB_NAME = 'Nest Rewards Club — Birthday Rewards';
export const DEFAULT_BIRTHDAY_DISCOUNT_AMOUNT = 100;
export const DEFAULT_BIRTHDAY_MIN_ORDER_VALUE = 1299;
export const BIRTHDAY_UNLOCK_DAY_OF_MONTH = 15;
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+05:30 (Asia/Kolkata)

export const BIRTHDAY_MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_NAMES = BIRTHDAY_MONTH_NAMES;

export type BirthdayMonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type BirthdayCouponStatus = 'issued' | 'reserved' | 'redeemed' | 'expired';

export type BirthdayRewardUiState =
  | 'not_registered'
  | 'waiting_until_15th'
  | 'waiting_until_next_year'
  | 'active_available'
  | 'redeemed_this_year'
  | 'expired_this_year';

export interface BirthdayRewardsConfig {
  enabled: boolean;
  discountAmount: number;
  minOrderValue: number;
  allowAlreadyIssuedWhenDisabled: boolean;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_BIRTHDAY_REWARDS_CONFIG: BirthdayRewardsConfig = {
  enabled: true,
  discountAmount: DEFAULT_BIRTHDAY_DISCOUNT_AMOUNT,
  minOrderValue: DEFAULT_BIRTHDAY_MIN_ORDER_VALUE,
  allowAlreadyIssuedWhenDisabled: false,
  updatedAt: Date.now(),
};

export interface AnnualBirthdayCouponRecord {
  code: string;
  couponCode: string;
  uid: string;
  year: number;
  month: number;
  discountAmount: number;
  minOrderValue: number;
  issuedAt: number;
  unlocksAt: number;
  validFrom?: number;
  expiresAt: number;
  status: BirthdayCouponStatus;
  reservedOrderId?: string;
  reservedAt?: number;
  redeemedOrderId?: string;
  redeemedAt?: number;
  reversedAt?: number;
  reversedOrderId?: string;
}

export interface BirthdayMonthCorrectionRequest {
  requestedMonth: number;
  previousMonth?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface CustomerBirthdayProfile {
  uid: string;
  email?: string;
  customerName?: string;
  phone?: string;
  birthdayMonth: number; // 1 to 12 ONLY (Never stores birth date or birth year)
  birthdayMonthName?: string;
  consentAccepted: boolean;
  consentTimestamp: number;
  firstRegisteredAt: number; // Immutable timestamp of initial registration
  registeredIstYear: number;
  registeredIstMonth: number;
  registeredIstDay: number;
  eligibleFromYear: number; // Calendar year in which the customer first qualifies
  annualCoupons: Record<string, AnnualBirthdayCouponRecord>;
  correctionRequest?: BirthdayMonthCorrectionRequest | null;
  updatedAt: number;
}

export interface BirthdayRewardTransaction {
  id: string;
  uid: string;
  customerEmail?: string;
  customerName?: string;
  year: number;
  birthdayMonth: number;
  couponCode?: string;
  action:
    | 'registered'
    | 'issued'
    | 'reserved'
    | 'redeemed'
    | 'reversed'
    | 'expired'
    | 'correction_requested'
    | 'correction_approved'
    | 'correction_rejected';
  discountAmount?: number;
  minOrderValue?: number;
  orderId?: string;
  note?: string;
  createdAt: number;
}

/**
 * Converts a month number (1-12) or month name to a validated month number (1-12).
 * Returns null if invalid.
 */
export function parseBirthdayMonth(input: number | string | null | undefined): BirthdayMonthNumber | null {
  if (typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= 12) {
    return input as BirthdayMonthNumber;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const asNum = Number(trimmed);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 12) {
      return asNum as BirthdayMonthNumber;
    }
    const idx = BIRTHDAY_MONTH_NAMES.findIndex((m) => m.toLowerCase() === trimmed.toLowerCase());
    if (idx !== -1) {
      return (idx + 1) as BirthdayMonthNumber;
    }
  }
  return null;
}

/**
 * Returns the full English month name for a 1-12 month number.
 */
export function getBirthdayMonthName(month: number | null | undefined): string {
  const parsed = parseBirthdayMonth(month);
  if (!parsed) return '';
  return BIRTHDAY_MONTH_NAMES[parsed - 1] || '';
}

export const getMonthName = getBirthdayMonthName;

/**
 * Returns whether a given calendar year is a leap year (for February 28 vs 29).
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact last day of a month (1-12) in a given calendar year (handles Feb 28/29).
 */
export function getLastDayOfMonth(year: number, month: number): number {
  const m = parseBirthdayMonth(month) || 1;
  switch (m) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 30;
  }
}

export interface IstDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
  milliseconds: number;
}

/**
 * Extracts exact calendar date & time components in Asia/Kolkata (IST, UTC+05:30).
 * Deterministic across all runtimes regardless of the host machine's local timezone.
 */
export function getIstDateParts(timestampMs: number = Date.now()): IstDateParts {
  const safeTs = Number.isFinite(timestampMs) ? timestampMs : Date.now();
  const istDate = new Date(safeTs + IST_OFFSET_MS);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    milliseconds: istDate.getUTCMilliseconds(),
  };
}

/**
 * Converts an Asia/Kolkata (IST) wall-clock date/time into a UTC epoch timestamp (ms).
 */
export function istWallClockToTimestampMs(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0
): number {
  const utcEquivalent = Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds);
  return utcEquivalent - IST_OFFSET_MS;
}

/**
 * Returns the exact unlock (15th 00:00:00.000 IST) and expiry (last day 23:59:59.999 IST)
 * timestamps for a given year and birthday month.
 */
export function getBirthdayWindowTimestampsIst(
  year: number,
  month: number
): {
  unlocksAtMs: number;
  expiresAtMs: number;
  lastDay: number;
  formattedUnlockDate: string;
  formattedExpiryDate: string;
} {
  const validMonth = parseBirthdayMonth(month) || 1;
  const monthName = getBirthdayMonthName(validMonth);
  const lastDay = getLastDayOfMonth(year, validMonth);

  const unlocksAtMs = istWallClockToTimestampMs(year, validMonth, BIRTHDAY_UNLOCK_DAY_OF_MONTH, 0, 0, 0, 0);
  const expiresAtMs = istWallClockToTimestampMs(year, validMonth, lastDay, 23, 59, 59, 999);

  return {
    unlocksAtMs,
    expiresAtMs,
    lastDay,
    formattedUnlockDate: `15 ${monthName} ${year}`,
    formattedExpiryDate: `${lastDay} ${monthName} ${year}`,
  };
}

/**
 * Generates a deterministic, account-bound unique Birthday Coupon Code for a specific customer UID and calendar year.
 * Format: BDAY-<YEAR>-<6_CHAR_ALPHANUMERIC_UID_HASH>
 * Never generates a generic public code.
 */
export function generateBirthdayCouponCode(uid: string, year: number): string {
  const cleanUid = String(uid || '').trim();
  const safeYear = Math.floor(Number(year) || getIstDateParts().year);

  // Deterministic FNV-1a / dual-seed hash over UID + salt + year
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const input = `CN_BDAY_V1:${cleanUid}:${safeYear}`;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i * 31;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Unambiguous uppercase alphanumeric
  let token = '';
  let combined = ((h1 >>> 0) ^ (h2 >>> 0)) >>> 0;
  let secondary = (h1 >>> 0) + (h2 >>> 0);

  for (let i = 0; i < 6; i++) {
    const idx = ((combined + i * 17 + (secondary & 0xff)) >>> 0) % alphabet.length;
    token += alphabet[idx];
    combined = (combined >>> 5) ^ ((secondary << 3) >>> 0);
    secondary = Math.imul(secondary ^ i, 0x27d4eb2d) >>> 0;
  }

  return `BDAY-${safeYear}-${token}`;
}

/**
 * Checks whether a coupon code follows the account-bound Birthday Coupon pattern (BDAY-YYYY-XXXXXX).
 */
export function isBirthdayCouponCodeFormat(code?: string | null): boolean {
  if (!code) return false;
  const clean = String(code).trim().toUpperCase();
  return /^BDAY-\d{4}-[A-Z0-9]{6}$/.test(clean);
}

/**
 * Determines the first calendar year in which a newly registered customer qualifies for the birthday reward.
 * Rule (Section 3 & 4):
 * - Customers who register their birthday month BEFORE the 15th of that month qualify for that year's reward.
 * - Customers who register their birthday month in an earlier month than their birthday month also qualify for that year's reward.
 * - Customers registering their birthday month ON OR AFTER the 15th of that month must wait until the following year
 *   (or if that month has already passed in the current year, their next birthday month is in the following year).
 */
export function calculateEligibleFromYear(
  birthdayMonth: number,
  registrationTimestampMs: number
): {
  registeredIstYear: number;
  registeredIstMonth: number;
  registeredIstDay: number;
  eligibleFromYear: number;
  qualifiesForRegistrationYear: boolean;
} {
  const validMonth = parseBirthdayMonth(birthdayMonth) || 1;
  const ist = getIstDateParts(registrationTimestampMs);

  let qualifiesForRegistrationYear = false;
  if (ist.month < validMonth) {
    // Registered in an earlier month before their birthday month
    qualifiesForRegistrationYear = true;
  } else if (ist.month === validMonth && ist.day < BIRTHDAY_UNLOCK_DAY_OF_MONTH) {
    // Registered in their birthday month strictly before the 15th (days 1..14)
    qualifiesForRegistrationYear = true;
  } else {
    // Registered on or after the 15th of their birthday month, or after their birthday month ended
    qualifiesForRegistrationYear = false;
  }

  return {
    registeredIstYear: ist.year,
    registeredIstMonth: ist.month,
    registeredIstDay: ist.day,
    eligibleFromYear: qualifiesForRegistrationYear ? ist.year : ist.year + 1,
    qualifiesForRegistrationYear,
  };
}

/**
 * Builds or updates a CustomerBirthdayProfile upon initial registration.
 * Preserves immutable `firstRegisteredAt` if the profile already exists.
 */
export function createCustomerBirthdayProfile(params: {
  uid: string;
  birthdayMonth: number;
  consentAccepted: boolean;
  email?: string;
  customerName?: string;
  phone?: string;
  nowMs?: number;
  existingProfile?: CustomerBirthdayProfile | null;
}): {
  valid: boolean;
  success: boolean;
  profile?: CustomerBirthdayProfile;
  error?: string;
} {
  const uid = String(params.uid || '').trim();
  if (!uid) {
    return { valid: false, success: false, error: 'Please sign in to save your birthday month.' };
  }

  const parsedMonth = parseBirthdayMonth(params.birthdayMonth);
  if (!parsedMonth) {
    return {
      valid: false,
      success: false,
      error: 'Please select a valid birthday month (January to December).',
    };
  }

  if (params.consentAccepted !== true) {
    return {
      valid: false,
      success: false,
      error: 'Please accept the birthday reward terms and consent checkbox before saving.',
    };
  }

  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();

  // Prevent self-service overwriting if a birthday month is already saved
  if (params.existingProfile && parseBirthdayMonth(params.existingProfile.birthdayMonth)) {
    return {
      valid: false,
      success: false,
      error: 'Your birthday month is already registered. To request a correction, please use the support correction request option.',
    };
  }

  const firstRegisteredAt = params.existingProfile?.firstRegisteredAt || nowMs;
  const eligCalc = calculateEligibleFromYear(parsedMonth, firstRegisteredAt);

  const profile: CustomerBirthdayProfile = {
    uid,
    email: params.email || params.existingProfile?.email,
    customerName: params.customerName || params.existingProfile?.customerName,
    phone: params.phone || params.existingProfile?.phone,
    birthdayMonth: parsedMonth,
    birthdayMonthName: getBirthdayMonthName(parsedMonth),
    consentAccepted: true,
    consentTimestamp: params.existingProfile?.consentTimestamp || nowMs,
    firstRegisteredAt,
    registeredIstYear: eligCalc.registeredIstYear,
    registeredIstMonth: eligCalc.registeredIstMonth,
    registeredIstDay: eligCalc.registeredIstDay,
    eligibleFromYear: eligCalc.eligibleFromYear,
    annualCoupons: params.existingProfile?.annualCoupons || {},
    correctionRequest: params.existingProfile?.correctionRequest || null,
    updatedAt: nowMs,
  };

  return { valid: true, success: true, profile };
}

export interface EvaluatedBirthdayRewardStatus {
  uiState: BirthdayRewardUiState;
  programEnabled: boolean;
  isRegistered: boolean;
  birthdayMonth: BirthdayMonthNumber | null;
  birthdayMonthName: string;
  currentIstYear: number;
  nextUnlockYear: number;
  headline: string;
  subheadline: string;
  headlineMessage: string;
  subMessage: string;
  confirmationSummary: string;
  activeCoupon: AnnualBirthdayCouponRecord | null;
  newlyIssuedCoupon: AnnualBirthdayCouponRecord | null;
  nextUnlockDateFormatted: string;
  expiryDateFormatted: string;
  discountAmount: number;
  minOrderValue: number;
}

export type BirthdayRewardEvaluationResult = EvaluatedBirthdayRewardStatus;

/**
 * Evaluates a customer's current Birthday Reward status and performs on-demand annual coupon issuance
 * if the customer is within their eligible birthday reward window (15th 00:00:00 IST to month-end 23:59:59 IST).
 *
 * Key Guarantees:
 * - Uses Asia/Kolkata (IST) for all date calculations.
 * - Prospective config changes do NOT alter `discountAmount` or `minOrderValue` on an already-issued annual coupon.
 * - Customers who registered on/after the 15th of their birthday month in the current year wait until next year.
 * - Customers who log in after the 15th (later in their birthday month) automatically receive their coupon on demand.
 */
export function evaluateBirthdayRewardStatus(params: {
  profile: CustomerBirthdayProfile | null | undefined;
  config?: Partial<BirthdayRewardsConfig> | null;
  nowMs?: number;
}): EvaluatedBirthdayRewardStatus {
  const config: BirthdayRewardsConfig = {
    ...DEFAULT_BIRTHDAY_REWARDS_CONFIG,
    ...(params.config || {}),
  };
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
  const istNow = getIstDateParts(nowMs);
  const profile = params.profile || null;
  const parsedMonth = parseBirthdayMonth(profile?.birthdayMonth);

  if (!profile || !parsedMonth || !profile.consentAccepted) {
    const headline = '🎂 Your Birthday Gift Awaits!';
    const subheadline = `Tell us your birthday month and receive ₹${formatRupeeAmount(config.discountAmount)} OFF on orders of ₹${formatRupeeAmount(config.minOrderValue)} or more. Your exclusive birthday reward unlocks on the 15th of your birthday month, every year!`;
    return {
      uiState: 'not_registered',
      programEnabled: config.enabled,
      isRegistered: false,
      birthdayMonth: null,
      birthdayMonthName: '',
      currentIstYear: istNow.year,
      nextUnlockYear: istNow.year,
      headline,
      subheadline,
      headlineMessage: headline,
      subMessage: subheadline,
      confirmationSummary: '',
      activeCoupon: null,
      newlyIssuedCoupon: null,
      nextUnlockDateFormatted: '',
      expiryDateFormatted: '',
      discountAmount: config.discountAmount,
      minOrderValue: config.minOrderValue,
    };
  }

  const monthName = getBirthdayMonthName(parsedMonth);
  const confirmationSummary = `Your birthday month is ${monthName}. Your ₹${formatRupeeAmount(config.discountAmount)} birthday reward unlocks on 15 ${monthName} every year.`;

  // Recalculate eligibility cutoff from immutable firstRegisteredAt
  const eligCalc = calculateEligibleFromYear(parsedMonth, profile.firstRegisteredAt);
  const effectiveEligibleFromYear = Math.max(profile.eligibleFromYear || 0, eligCalc.eligibleFromYear);

  const currentYearWindow = getBirthdayWindowTimestampsIst(istNow.year, parsedMonth);
  const nextYearWindow = getBirthdayWindowTimestampsIst(istNow.year + 1, parsedMonth);

  const rawExistingCoupon = profile.annualCoupons?.[String(istNow.year)] || null;
  const existingAnnualCoupon: AnnualBirthdayCouponRecord | null = rawExistingCoupon
    ? {
        ...rawExistingCoupon,
        code: rawExistingCoupon.code || rawExistingCoupon.couponCode,
        couponCode: rawExistingCoupon.couponCode || rawExistingCoupon.code,
        validFrom: rawExistingCoupon.validFrom || rawExistingCoupon.unlocksAt,
      }
    : null;

  // Check if customer already redeemed their birthday coupon in the current calendar year
  if (existingAnnualCoupon && existingAnnualCoupon.status === 'redeemed') {
    const headline = 'Birthday Reward Used — See you next year!';
    const subheadline = `You redeemed your ${istNow.year} birthday gift (${existingAnnualCoupon.couponCode}). Your next birthday surprise unlocks on ${nextYearWindow.formattedUnlockDate}!`;
    return {
      uiState: 'redeemed_this_year',
      programEnabled: config.enabled,
      isRegistered: true,
      birthdayMonth: parsedMonth,
      birthdayMonthName: monthName,
      currentIstYear: istNow.year,
      nextUnlockYear: istNow.year + 1,
      headline,
      subheadline,
      headlineMessage: headline,
      subMessage: subheadline,
      confirmationSummary,
      activeCoupon: existingAnnualCoupon,
      newlyIssuedCoupon: null,
      nextUnlockDateFormatted: nextYearWindow.formattedUnlockDate,
      expiryDateFormatted: currentYearWindow.formattedExpiryDate,
      discountAmount: existingAnnualCoupon.discountAmount,
      minOrderValue: existingAnnualCoupon.minOrderValue,
    };
  }

  // Case 1: Customer registered on or after the 15th of their birthday month this year (or after their birthday month this year)
  if (istNow.year < effectiveEligibleFromYear) {
    const isSameMonthLateReg =
      istNow.year === eligCalc.registeredIstYear &&
      istNow.month === parsedMonth &&
      eligCalc.registeredIstDay >= BIRTHDAY_UNLOCK_DAY_OF_MONTH;

    const headline = `Your birthday surprise unlocks on 15 ${monthName}!`;
    const subheadline = isSameMonthLateReg
      ? `Because your birthday month was registered on or after 15 ${monthName} ${istNow.year}, your first annual ₹${formatRupeeAmount(config.discountAmount)} birthday reward unlocks on ${nextYearWindow.formattedUnlockDate}.`
      : `Your next annual ₹${formatRupeeAmount(config.discountAmount)} birthday reward unlocks on ${nextYearWindow.formattedUnlockDate}.`;

    return {
      uiState: 'waiting_until_next_year',
      programEnabled: config.enabled,
      isRegistered: true,
      birthdayMonth: parsedMonth,
      birthdayMonthName: monthName,
      currentIstYear: istNow.year,
      nextUnlockYear: istNow.year + 1,
      headline,
      subheadline,
      headlineMessage: headline,
      subMessage: subheadline,
      confirmationSummary,
      activeCoupon: null,
      newlyIssuedCoupon: null,
      nextUnlockDateFormatted: nextYearWindow.formattedUnlockDate,
      expiryDateFormatted: nextYearWindow.formattedExpiryDate,
      discountAmount: config.discountAmount,
      minOrderValue: config.minOrderValue,
    };
  }

  // Case 2: Current time in IST is BEFORE 15th 00:00:00 IST of the birthday month in the current year
  if (nowMs < currentYearWindow.unlocksAtMs) {
    const headline = `Your birthday surprise unlocks on 15 ${monthName}!`;
    const subheadline = `Your exclusive ₹${formatRupeeAmount(config.discountAmount)} OFF coupon (on orders ₹${formatRupeeAmount(config.minOrderValue)}+) will automatically unlock at 12:00 AM IST on ${currentYearWindow.formattedUnlockDate}.`;
    return {
      uiState: 'waiting_until_15th',
      programEnabled: config.enabled,
      isRegistered: true,
      birthdayMonth: parsedMonth,
      birthdayMonthName: monthName,
      currentIstYear: istNow.year,
      nextUnlockYear: istNow.year,
      headline,
      subheadline,
      headlineMessage: headline,
      subMessage: subheadline,
      confirmationSummary,
      activeCoupon: null,
      newlyIssuedCoupon: null,
      nextUnlockDateFormatted: currentYearWindow.formattedUnlockDate,
      expiryDateFormatted: currentYearWindow.formattedExpiryDate,
      discountAmount: config.discountAmount,
      minOrderValue: config.minOrderValue,
    };
  }

  // Case 3: Current time in IST is WITHIN the active reward window (15th 00:00:00 IST to last day 23:59:59.999 IST)
  if (nowMs >= currentYearWindow.unlocksAtMs && nowMs <= currentYearWindow.expiresAtMs) {
    let couponRecord = existingAnnualCoupon;
    let newlyIssued: AnnualBirthdayCouponRecord | null = null;

    if (!couponRecord && config.enabled) {
      const generatedCode = generateBirthdayCouponCode(profile.uid, istNow.year);
      couponRecord = {
        code: generatedCode,
        couponCode: generatedCode,
        uid: profile.uid,
        year: istNow.year,
        month: parsedMonth,
        discountAmount: config.discountAmount,
        minOrderValue: config.minOrderValue,
        issuedAt: nowMs,
        unlocksAt: currentYearWindow.unlocksAtMs,
        validFrom: currentYearWindow.unlocksAtMs,
        expiresAt: currentYearWindow.expiresAtMs,
        status: 'issued',
      };
      newlyIssued = couponRecord;
    }

    if (couponRecord) {
      const headline = '🎉 Your Birthday Reward is Here!';
      const subheadline = `Enjoy ₹${formatRupeeAmount(couponRecord.discountAmount)} OFF on orders of ₹${formatRupeeAmount(couponRecord.minOrderValue)} or more until ${currentYearWindow.formattedExpiryDate} (11:59 PM IST).`;
      return {
        uiState: 'active_available',
        programEnabled: config.enabled,
        isRegistered: true,
        birthdayMonth: parsedMonth,
        birthdayMonthName: monthName,
        currentIstYear: istNow.year,
        nextUnlockYear: istNow.year,
        headline,
        subheadline,
        headlineMessage: headline,
        subMessage: subheadline,
        confirmationSummary,
        activeCoupon: couponRecord,
        newlyIssuedCoupon: newlyIssued,
        nextUnlockDateFormatted: currentYearWindow.formattedUnlockDate,
        expiryDateFormatted: currentYearWindow.formattedExpiryDate,
        discountAmount: couponRecord.discountAmount,
        minOrderValue: couponRecord.minOrderValue,
      };
    }
  }

  // Case 4: Current time in IST is AFTER the last day of the birthday month in the current year
  const expiredCoupon: AnnualBirthdayCouponRecord | null = existingAnnualCoupon
    ? {
        ...existingAnnualCoupon,
        status: existingAnnualCoupon.status === 'redeemed' ? 'redeemed' : 'expired',
      }
    : null;

  const headline = 'Your birthday reward has expired. Your next gift arrives next year!';
  const subheadline = `Your ${istNow.year} birthday reward window ended on ${currentYearWindow.formattedExpiryDate}. Your next birthday gift unlocks on ${nextYearWindow.formattedUnlockDate}!`;

  return {
    uiState: 'expired_this_year',
    programEnabled: config.enabled,
    isRegistered: true,
    birthdayMonth: parsedMonth,
    birthdayMonthName: monthName,
    currentIstYear: istNow.year,
    nextUnlockYear: istNow.year + 1,
    headline,
    subheadline,
    headlineMessage: headline,
    subMessage: subheadline,
    confirmationSummary,
    activeCoupon: expiredCoupon,
    newlyIssuedCoupon: null,
    nextUnlockDateFormatted: nextYearWindow.formattedUnlockDate,
    expiryDateFormatted: currentYearWindow.formattedExpiryDate,
    discountAmount: config.discountAmount,
    minOrderValue: config.minOrderValue,
  };
}

export interface ValidateBirthdayCouponCheckoutInput {
  couponCode: string;
  uid?: string | null;
  userId?: string | null;
  productSubtotal: number;
  profile?: CustomerBirthdayProfile | null;
  config?: Partial<BirthdayRewardsConfig> | null;
  nowMs?: number;
  welcomeOfferApplied?: boolean;
  hasWelcomeOfferApplied?: boolean;
  pointsRedeemed?: number;
  pointsUsed?: number;
  otherCouponApplied?: boolean;
  hasOtherCouponApplied?: boolean;
  currentOrderId?: string | null;
}

export interface ValidateBirthdayCouponCheckoutResult {
  valid: boolean;
  isBirthdayCoupon: boolean;
  couponCode: string;
  discountAmount: number;
  minOrderValue: number;
  shortfallAmount: number;
  year: number;
  error?: string;
  message?: string;
  couponRecord?: AnnualBirthdayCouponRecord;
}

/**
 * Authoritative Checkout & Server Validation for Account-Bound Birthday Coupons.
 * Enforces:
 * 1. Program enabled policy (disabled program rejects new redemptions unless allowAlreadyIssuedWhenDisabled is true for an already-issued record).
 * 2. Strict Firebase UID ownership (cannot be used by another user account or unauthenticated guest).
 * 3. First-registration cutoff (registered before 15th of birthday month for current year eligibility).
 * 4. Active IST date window (15th 00:00:00 IST through last day of month 23:59:59.999 IST).
 * 5. Single annual redemption (rejects if already redeemed or reserved on another active order).
 * 6. Non-stacking rule (cannot stack with Welcome Offer, Nest Points, or any other coupon).
 * 7. Minimum product subtotal of ₹1,299 (or coupon's issued minOrderValue) before discounts, excluding delivery fees.
 */
export function validateBirthdayCouponForCheckout(
  input: ValidateBirthdayCouponCheckoutInput
): ValidateBirthdayCouponCheckoutResult {
  const cleanCode = String(input.couponCode || '').trim().toUpperCase();
  const isBirthdayFormat = isBirthdayCouponCodeFormat(cleanCode);
  const config: BirthdayRewardsConfig = {
    ...DEFAULT_BIRTHDAY_REWARDS_CONFIG,
    ...(input.config || {}),
  };
  const nowMs = typeof input.nowMs === 'number' && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const istNow = getIstDateParts(nowMs);
  const safeSubtotal = Math.max(0, Math.round((Number(input.productSubtotal) || 0) * 100) / 100);
  const uid = String(input.uid ?? input.userId ?? '').trim();
  const profile = input.profile || null;
  const currentOrderId = input.currentOrderId ? String(input.currentOrderId).trim() : '';

  if (!isBirthdayFormat) {
    return {
      valid: false,
      isBirthdayCoupon: false,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Not a birthday reward coupon code.',
    };
  }

  // 1. Require signed-in customer UID
  if (!uid) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Please sign in to your Cotton Nest account to use your personal Birthday Reward coupon.',
    };
  }

  // 2. Verify profile & strict UID ownership
  if (!profile || profile.uid !== uid) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'This Birthday Reward coupon belongs to another account and cannot be transferred.',
    };
  }

  const parsedMonth = parseBirthdayMonth(profile.birthdayMonth);
  if (!parsedMonth || !profile.consentAccepted) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'No registered birthday month found for this account.',
    };
  }

  // Extract year from coupon code BDAY-YYYY-XXXXXX
  const parts = cleanCode.split('-');
  const codeYear = Number(parts[1]) || istNow.year;
  const expectedCodeForUserAndYear = generateBirthdayCouponCode(uid, codeYear);

  // Verify the code cryptographic hash matches this exact customer UID and year
  if (cleanCode !== expectedCodeForUserAndYear) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: codeYear,
      error: 'This Birthday Reward coupon is strictly bound to another customer account and cannot be used.',
    };
  }

  // Verify calendar year matches current IST year
  if (codeYear !== istNow.year) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: codeYear,
      error: `This Birthday Reward coupon was for ${codeYear} and is no longer valid.`,
    };
  }

  const rawExistingRecord = profile.annualCoupons?.[String(istNow.year)] || null;
  const existingRecord: AnnualBirthdayCouponRecord | null = rawExistingRecord
    ? {
        ...rawExistingRecord,
        code: rawExistingRecord.code || rawExistingRecord.couponCode,
        couponCode: rawExistingRecord.couponCode || rawExistingRecord.code,
        validFrom: rawExistingRecord.validFrom || rawExistingRecord.unlocksAt,
      }
    : null;

  // 3. Check if program is enabled
  if (!config.enabled) {
    const canUseExistingWhileDisabled =
      config.allowAlreadyIssuedWhenDisabled && existingRecord && existingRecord.couponCode === cleanCode;
    if (!canUseExistingWhileDisabled) {
      return {
        valid: false,
        isBirthdayCoupon: true,
        couponCode: cleanCode,
        discountAmount: 0,
        minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
        shortfallAmount: 0,
        year: istNow.year,
        error: 'Birthday Rewards are currently disabled by Cotton Nest.',
      };
    }
  }

  // 4. Verify registration cutoff (must have registered before the 15th of the birthday month for this year)
  const eligCalc = calculateEligibleFromYear(parsedMonth, profile.firstRegisteredAt);
  const effectiveEligibleFromYear = Math.max(profile.eligibleFromYear || 0, eligCalc.eligibleFromYear);
  if (istNow.year < effectiveEligibleFromYear) {
    const monthName = getBirthdayMonthName(parsedMonth);
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: `Because your birthday month was registered on or after 15 ${monthName} ${istNow.year}, your reward unlocks on 15 ${monthName} ${istNow.year + 1}.`,
    };
  }

  // 5. Check single annual redemption & reservation state
  if (
    existingRecord?.status === 'redeemed' &&
    (!currentOrderId || existingRecord.redeemedOrderId !== currentOrderId)
  ) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Birthday Reward Used — You have already redeemed your annual birthday coupon this year.',
    };
  }

  if (
    existingRecord?.status === 'reserved' &&
    existingRecord.reservedOrderId &&
    (!currentOrderId || existingRecord.reservedOrderId !== currentOrderId)
  ) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: `Your Birthday Reward coupon is currently applied to active Order #${existingRecord.reservedOrderId}.`,
    };
  }

  // 6. Verify active IST date window (15th 00:00:00 IST to last day 23:59:59.999 IST)
  const windowIst = getBirthdayWindowTimestampsIst(istNow.year, parsedMonth);
  const monthName = getBirthdayMonthName(parsedMonth);

  if (nowMs < windowIst.unlocksAtMs) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: `Your birthday surprise unlocks on 15 ${monthName}!`,
    };
  }

  if (nowMs > windowIst.expiresAtMs) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Your birthday reward has expired. Your next gift arrives next year!',
    };
  }

  // 7. Enforce Non-Stacking with Welcome Offer, Nest Points, or other coupons
  const welcomeOfferFlag = Boolean(input.welcomeOfferApplied || input.hasWelcomeOfferApplied);
  if (welcomeOfferFlag) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Birthday Reward cannot be combined with the Welcome Offer. Please choose one benefit.',
    };
  }

  const pointsValue = Math.max(Number(input.pointsRedeemed) || 0, Number(input.pointsUsed) || 0);
  if (pointsValue > 0) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Birthday Reward cannot be combined with Nest Points redemption on the same order.',
    };
  }

  const otherCouponFlag = Boolean(input.otherCouponApplied || input.hasOtherCouponApplied);
  if (otherCouponFlag) {
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: existingRecord?.minOrderValue || config.minOrderValue,
      shortfallAmount: 0,
      year: istNow.year,
      error: 'Birthday Reward cannot be stacked with another discount coupon.',
    };
  }

  // Preserve prospective config insulation: use already-issued coupon's discountAmount & minOrderValue if issued
  const effectiveDiscountAmount = existingRecord
    ? Math.max(1, Number(existingRecord.discountAmount) || config.discountAmount)
    : Math.max(1, Number(config.discountAmount) || DEFAULT_BIRTHDAY_DISCOUNT_AMOUNT);

  const effectiveMinOrderValue = existingRecord
    ? Math.max(0, Number(existingRecord.minOrderValue) || config.minOrderValue)
    : Math.max(0, Number(config.minOrderValue) || DEFAULT_BIRTHDAY_MIN_ORDER_VALUE);

  // 8. Check minimum eligible product subtotal (excluding delivery fees)
  if (safeSubtotal < effectiveMinOrderValue) {
    const shortfall = Math.max(0, Math.round((effectiveMinOrderValue - safeSubtotal) * 100) / 100);
    return {
      valid: false,
      isBirthdayCoupon: true,
      couponCode: cleanCode,
      discountAmount: 0,
      minOrderValue: effectiveMinOrderValue,
      shortfallAmount: shortfall,
      year: istNow.year,
      error: `Minimum order subtotal of ₹${formatRupeeAmount(effectiveMinOrderValue)} (excluding delivery) is required for your Birthday Reward. Add ₹${formatRupeeAmount(shortfall)} more to apply.`,
    };
  }

  const finalDiscount = Math.min(safeSubtotal, effectiveDiscountAmount);

  const couponRecord: AnnualBirthdayCouponRecord = existingRecord || {
    code: cleanCode,
    couponCode: cleanCode,
    uid,
    year: istNow.year,
    month: parsedMonth,
    discountAmount: effectiveDiscountAmount,
    minOrderValue: effectiveMinOrderValue,
    issuedAt: nowMs,
    unlocksAt: windowIst.unlocksAtMs,
    validFrom: windowIst.unlocksAtMs,
    expiresAt: windowIst.expiresAtMs,
    status: 'issued',
  };

  return {
    valid: true,
    isBirthdayCoupon: true,
    couponCode: cleanCode,
    discountAmount: finalDiscount,
    minOrderValue: effectiveMinOrderValue,
    shortfallAmount: 0,
    year: istNow.year,
    couponRecord,
    message: `🎂 Birthday Reward (${cleanCode}) applied! ₹${formatRupeeAmount(finalDiscount)} OFF saved.`,
  };
}
