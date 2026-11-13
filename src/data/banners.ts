export type BannerCategory = 'Welcome' | 'Festive' | 'Offer' | 'Seasonal' | 'Announcement';

export type BannerTargetAudience = 'all' | 'new_users' | 'registered_users';

export type BannerTextStyle = 'editorial_serif' | 'modern_sans' | 'bold_display';

export type ComputedBannerStatus = 'scheduled' | 'active' | 'expired' | 'disabled';

export interface HomepageBanner {
  id: string;
  campaignName: string;
  category: BannerCategory | string;
  heading: string;
  subtitle: string;
  description?: string;
  ctaText: string;
  ctaDestination: string;
  secondaryCtaText?: string;
  secondaryCtaDestination?: string;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  backgroundColor: string;
  textColor: string;
  accentColor?: string;
  textStyle?: BannerTextStyle;
  textAlignment: 'left' | 'center' | 'right';
  festiveEffect?:
    | 'none'
    | 'diwali_diyas'
    | 'gold_sparks'
    | 'festive_confetti'
    | 'winter_snow'
    | 'floral_petals'
    | 'champagne_shimmer';
  targetAudience?: BannerTargetAudience;
  startDate?: Date | string | number;
  expiryDate?: Date | string | number;
  priority: number;
  status: 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled';
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface BannerAudienceContext {
  isAuthenticated: boolean;
  isNewUser: boolean;
}

export interface BannerPalettePreset {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

export const COTTON_NEST_BANNER_PALETTES: BannerPalettePreset[] = [
  {
    id: 'cream_burgundy',
    name: 'Warm Cream & Burgundy',
    backgroundColor: '#FAF7F2',
    textColor: '#2C2420',
    accentColor: '#8C2E46',
  },
  {
    id: 'blush_rose',
    name: 'Blush Rose & Gold',
    backgroundColor: '#FDEAF0',
    textColor: '#70252D',
    accentColor: '#C29E57',
  },
  {
    id: 'burgundy_gold',
    name: 'Royal Burgundy & Gold',
    backgroundColor: '#70252D',
    textColor: '#FFFFFF',
    accentColor: '#DEC89B',
  },
  {
    id: 'ivory_gold',
    name: 'Pure Ivory & Antique Gold',
    backgroundColor: '#FFFFFF',
    textColor: '#2C2420',
    accentColor: '#A8823B',
  },
  {
    id: 'espresso_champagne',
    name: 'Atelier Espresso & Gold',
    backgroundColor: '#2C2420',
    textColor: '#FAF7F2',
    accentColor: '#C29E57',
  },
];

export const BANNER_CATEGORIES: BannerCategory[] = [
  'Welcome',
  'Festive',
  'Offer',
  'Seasonal',
  'Announcement',
];

export const CAMPAIGN_CATEGORIES: string[] = [...BANNER_CATEGORIES];

export const TARGET_AUDIENCE_OPTIONS: Array<{ value: BannerTargetAudience; label: string; hint: string }> = [
  {
    value: 'all',
    label: 'All visitors',
    hint: 'Visible to everyone visiting Cotton Nest',
  },
  {
    value: 'new_users',
    label: 'New users',
    hint: 'First-time visitors & customers with zero prior orders',
  },
  {
    value: 'registered_users',
    label: 'Registered users',
    hint: 'Signed-in Cotton Nest members',
  },
];

export const INITIAL_BANNERS: HomepageBanner[] = [
  {
    id: 'banner-diwali-2026',
    campaignName: 'Diwali Grand Festivities',
    category: 'Festive',
    heading: 'HAPPY DIWALI',
    subtitle: 'Celebrate the Festival of Lights with Cotton Nest 100% Pure Combed Cotton Bedsheets.',
    description:
      'Elevate your festive bedroom with handcrafted long-staple cotton sheets, subtle golden floral motifs, and silk-soft comfort.',
    ctaText: 'Shop Festive Collection',
    ctaDestination: 'catalogue',
    secondaryCtaText: 'Visit Gurgaon Studio',
    secondaryCtaDestination: 'store',
    backgroundColor: '#FAF7F2',
    textColor: '#2C2420',
    accentColor: '#8C2E46',
    textStyle: 'editorial_serif',
    textAlignment: 'center',
    festiveEffect: 'gold_sparks',
    targetAudience: 'all',
    startDate: new Date('2026-11-15T10:00:00.000+05:30'),
    expiryDate: new Date('2026-11-30T23:59:00.000+05:30'),
    priority: 1,
    status: 'scheduled',
    isEnabled: true,
    createdAt: 1763000000000,
    updatedAt: 1763000000000,
  },
];

export interface Time12HourParts {
  hour12: number; // 1..12
  minute: number; // 0..59
  period: 'AM' | 'PM';
}

const IST_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const IST_OFFSET_MS = 330 * 60 * 1000;

function extractTimestampObjectMs(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as {
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  if (typeof maybe.toDate === 'function') {
    const d = maybe.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  const sec =
    typeof maybe.seconds === 'number' && Number.isFinite(maybe.seconds)
      ? maybe.seconds
      : typeof maybe._seconds === 'number' && Number.isFinite(maybe._seconds)
      ? maybe._seconds
      : null;
  if (sec !== null) {
    const nanosRaw =
      typeof maybe.nanoseconds === 'number' && Number.isFinite(maybe.nanoseconds)
        ? maybe.nanoseconds
        : typeof maybe._nanoseconds === 'number' && Number.isFinite(maybe._nanoseconds)
        ? maybe._nanoseconds
        : 0;
    return sec * 1000 + Math.floor(nanosRaw / 1_000_000);
  }
  return null;
}

/**
 * Converts a Date, Firestore Timestamp, epoch ms, or IST/ISO string into a high-precision Date object.
 * Interpreting timezone-naive strings ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm') strictly in IST (+05:30).
 */
export function toBannerDate(value?: Date | string | number | unknown): Date | undefined {
  const ms = parseIstTimestamp(value);
  if (ms === null) return undefined;
  return new Date(ms);
}

/**
 * Combines IST date (YYYY-MM-DD) and time (HH:mm) inputs into a full Date object
 * preserving exact hour, minute, milliseconds (.000), and IST (+05:30) timezone offset.
 */
export function istDateTimePartsToDate(
  date: string,
  time: string,
  defaultTime: string = '00:00'
): Date | undefined {
  const isoLocal = combineIstDateTimeParts(date, time, defaultTime);
  if (!isoLocal) return undefined;
  const ms = Date.parse(`${isoLocal}:00.000+05:30`);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
}

/**
 * Hydrates a HomepageBanner's startDate and expiryDate fields into real Date objects
 * (converting strings, epochs, or Firestore Timestamps cleanly).
 */
export function normalizeBannerDates(banner: HomepageBanner): HomepageBanner {
  return {
    ...banner,
    startDate: toBannerDate(banner.startDate),
    expiryDate: toBannerDate(banner.expiryDate),
  };
}

/**
 * Parses a date, Firestore Timestamp, or datetime string into an epoch millisecond timestamp,
 * interpreting timezone-naive strings ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm')
 * strictly in Indian Standard Time (IST, +05:30) with exact precision.
 */
export function parseIstTimestamp(dateStr?: Date | string | number | unknown): number | null {
  if (dateStr === undefined || dateStr === null || dateStr === '') return null;
  if (typeof dateStr === 'number') {
    return Number.isFinite(dateStr) ? dateStr : null;
  }
  if (dateStr instanceof Date) {
    return Number.isFinite(dateStr.getTime()) ? dateStr.getTime() : null;
  }
  const objMs = extractTimestampObjectMs(dateStr);
  if (objMs !== null) return objMs;
  if (typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const naiveMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/.exec(trimmed);
  if (naiveMatch) {
    const year = Number(naiveMatch[1]);
    const month = Number(naiveMatch[2]);
    const day = Number(naiveMatch[3]);
    const hour = naiveMatch[4] !== undefined ? Number(naiveMatch[4]) : 0;
    const minute = naiveMatch[5] !== undefined ? Number(naiveMatch[5]) : 0;
    const second = naiveMatch[6] !== undefined ? Number(naiveMatch[6]) : 0;
    const milli = naiveMatch[7] !== undefined ? Number(naiveMatch[7].padEnd(3, '0')) : 0;

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }

    const padded = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(
      2,
      '0'
    )}.${String(milli).padStart(3, '0')}+05:30`;
    const ms = Date.parse(padded);
    return Number.isFinite(ms) ? ms : null;
  }

  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Converts an epoch ms value to exact IST YYYY-MM-DD and HH:mm parts.
 */
export function epochMsToIstParts(ms: number): { date: string; time: string } {
  const istDate = new Date(ms + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const mins = String(istDate.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}`,
  };
}

/**
 * Extracts YYYY-MM-DD and HH:mm parts in IST for date and time pickers without rounding.
 */
export function splitIstDateTimeParts(dateStr?: Date | string | number | unknown): { date: string; time: string } {
  if (dateStr === undefined || dateStr === null || dateStr === '') return { date: '', time: '' };

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed) return { date: '', time: '' };

    const naiveMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::\d{1,2}(?:\.\d{1,3})?)?)?$/.exec(trimmed);
    if (naiveMatch) {
      const year = String(Number(naiveMatch[1])).padStart(4, '0');
      const month = String(Number(naiveMatch[2])).padStart(2, '0');
      const day = String(Number(naiveMatch[3])).padStart(2, '0');
      const hasTime = naiveMatch[4] !== undefined && naiveMatch[5] !== undefined;
      const hours = hasTime ? String(Math.min(23, Math.max(0, Number(naiveMatch[4])))).padStart(2, '0') : '';
      const mins = hasTime ? String(Math.min(59, Math.max(0, Number(naiveMatch[5])))).padStart(2, '0') : '';
      return {
        date: `${year}-${month}-${day}`,
        time: hasTime ? `${hours}:${mins}` : '',
      };
    }
  }

  const ms = parseIstTimestamp(dateStr);
  if (ms === null) return { date: '', time: '' };
  return epochMsToIstParts(ms);
}

/**
 * Converts canonical 24-hour 'HH:mm' (or 'HH:mm:ss') string into 12-hour AM/PM selector values (hour 1-12, minute 0-59).
 */
export function to12HourTimeParts(time24?: string, fallback: string = '00:00'): Time12HourParts {
  const trimmed = (time24 || '').trim();
  const match = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/.exec(trimmed);
  const source = match ? `${match[1]}:${match[2]}` : fallback.trim();
  const [hRaw, mRaw] = source.split(':');
  const h24 = Math.min(23, Math.max(0, Number(hRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(mRaw) || 0));
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
}

/**
 * Converts 12-hour AM/PM selector values (hour 1-12, minute 0-59, AM/PM) into exact 24-hour 'HH:mm' string.
 */
export function from12HourTimeParts(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const clampedHour12 = Math.min(12, Math.max(1, Math.trunc(hour12) || 12));
  const clampedMinute = Math.min(59, Math.max(0, Math.trunc(minute) || 0));
  let h24 = clampedHour12 % 12;
  if (period === 'PM') {
    h24 += 12;
  }
  return `${String(h24).padStart(2, '0')}:${String(clampedMinute).padStart(2, '0')}`;
}

/**
 * Combines separate date (YYYY-MM-DD) and time (HH:mm or HH:mm:ss) inputs into canonical YYYY-MM-DDTHH:mm IST string.
 */
export function combineIstDateTimeParts(
  date: string,
  time: string,
  defaultTime: string = '00:00'
): string {
  const cleanDate = (date || '').trim();
  const cleanTime = (time || '').trim();
  if (!cleanDate) return '';
  const match = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/.exec(cleanTime);
  const effectiveTime = match ? `${match[1]}:${match[2]}` : defaultTime;
  const [hRaw, mRaw] = effectiveTime.split(':');
  const normalizedTime = `${String(Math.min(23, Math.max(0, Number(hRaw) || 0))).padStart(2, '0')}:${String(
    Math.min(59, Math.max(0, Number(mRaw) || 0))
  ).padStart(2, '0')}`;
  return `${cleanDate}T${normalizedTime}`;
}

/**
 * Validates that Start & End validity dates/times are complete and End >= Start in IST.
 */
export function validateBannerValidityPeriod(
  startDate?: Date | string | number,
  expiryDate?: Date | string | number,
  parts?: {
    startDatePart?: string;
    startTimePart?: string;
    endDatePart?: string;
    endTimePart?: string;
  }
): { valid: boolean; error?: string } {
  if (parts) {
    if (parts.startTimePart && !parts.startDatePart) {
      return {
        valid: false,
        error: 'Please select a Valid From start date along with the start time.',
      };
    }
    if (parts.endTimePart && !parts.endDatePart) {
      return {
        valid: false,
        error: 'Please select a Valid Until end date along with the end time.',
      };
    }
  }

  const hasStartInput =
    startDate instanceof Date ||
    typeof startDate === 'number' ||
    (typeof startDate === 'string' && startDate.trim() !== '');
  const hasEndInput =
    expiryDate instanceof Date ||
    typeof expiryDate === 'number' ||
    (typeof expiryDate === 'string' && expiryDate.trim() !== '');

  const startObj = toBannerDate(startDate);
  const endObj = toBannerDate(expiryDate);

  if (hasStartInput && !startObj) {
    return { valid: false, error: 'Valid From date/time format is invalid.' };
  }
  if (hasEndInput && !endObj) {
    return { valid: false, error: 'Valid Until date/time format is invalid.' };
  }

  if (startObj && endObj && endObj.getTime() < startObj.getTime()) {
    return {
      valid: false,
      error: 'Valid Until date and time cannot be earlier than Valid From date and time.',
    };
  }

  return { valid: true };
}

export function formatValidityDate(dateStr?: Date | string | number | unknown): string {
  if (!dateStr) return 'Not Set';

  const dateObj = toBannerDate(dateStr);
  if (!dateObj) return 'Not Set';

  const istDate = new Date(dateObj.getTime() + IST_OFFSET_MS);
  const day = istDate.getUTCDate();
  const monthName = IST_MONTH_NAMES[istDate.getUTCMonth()] || 'Jan';
  const year = istDate.getUTCFullYear();
  const hours24 = istDate.getUTCHours();
  const mins = String(istDate.getUTCMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${day} ${monthName} ${year} · ${hours12}:${mins} ${period} IST`;
}

export function getTargetAudienceLabel(audience?: BannerTargetAudience): string {
  if (audience === 'new_users') return 'New users';
  if (audience === 'registered_users') return 'Registered users';
  return 'All visitors';
}

export function computeBannerStatus(
  banner: HomepageBanner,
  now: Date = new Date()
): ComputedBannerStatus {
  // Master admin OFF toggle overrides validity windows and everything else
  if (!banner.isEnabled || banner.status === 'disabled') {
    return 'disabled';
  }

  const currentMs = now.getTime();
  const startDateObj = toBannerDate(banner.startDate);
  const expiryDateObj = toBannerDate(banner.expiryDate);

  if (startDateObj && currentMs < startDateObj.getTime()) {
    return 'scheduled';
  }

  if (expiryDateObj && currentMs >= expiryDateObj.getTime()) {
    return 'expired';
  }

  return 'active';
}

export function doesBannerMatchAudience(
  banner: HomepageBanner,
  context: BannerAudienceContext = { isAuthenticated: false, isNewUser: true }
): boolean {
  const audience = banner.targetAudience || 'all';
  if (audience === 'all') return true;
  if (audience === 'registered_users') {
    return Boolean(context.isAuthenticated);
  }
  if (audience === 'new_users') {
    return Boolean(context.isNewUser);
  }
  return true;
}

export function getActiveEligibleBanners(
  banners: HomepageBanner[],
  now: Date = new Date(),
  context?: BannerAudienceContext
): HomepageBanner[] {
  return [...banners]
    .filter((b) => {
      if (computeBannerStatus(b, now) !== 'active') return false;
      if (context && !doesBannerMatchAudience(b, context)) return false;
      return true;
    })
    .sort((a, b) => {
      const pDiff = (a.priority || 999) - (b.priority || 999);
      if (pDiff !== 0) return pDiff;
      const uDiff = (b.updatedAt || 0) - (a.updatedAt || 0);
      if (uDiff !== 0) return uDiff;
      return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Returns strictly the single highest-priority qualifying banner for customer display.
 */
export function getTopEligibleCustomerBanner(
  banners: HomepageBanner[],
  now: Date = new Date(),
  context: BannerAudienceContext = { isAuthenticated: false, isNewUser: true }
): HomepageBanner | null {
  const eligible = getActiveEligibleBanners(banners, now, context);
  return eligible.length > 0 ? eligible[0] : null;
}

/**
 * Computes milliseconds until the next local IST schedule boundary (start or expiry)
 * across all admin-enabled banners using exact Date comparison without polling Firebase.
 */
export function getNextBannerTransitionDelayMs(
  banners: HomepageBanner[],
  nowMs: number = Date.now()
): number | null {
  let minDelay: number | null = null;
  const maxSafeTimeoutMs = 24 * 60 * 60 * 1000;

  for (const banner of banners) {
    if (!banner.isEnabled || banner.status === 'disabled') continue;

    const startDateObj = toBannerDate(banner.startDate);
    if (startDateObj && startDateObj.getTime() > nowMs) {
      const delta = startDateObj.getTime() - nowMs + 50;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }

    const expDateObj = toBannerDate(banner.expiryDate);
    if (expDateObj && expDateObj.getTime() > nowMs) {
      const delta = expDateObj.getTime() - nowMs + 50;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }
  }

  if (minDelay === null) return null;
  return Math.min(minDelay, maxSafeTimeoutMs);
}
