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
  startDate?: string;
  expiryDate?: string;
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
    startDate: '2026-11-15T10:00',
    expiryDate: '2026-11-30T23:59',
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
  const maybe = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof maybe.toDate === 'function') {
    const d = maybe.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  if (typeof maybe.seconds === 'number' && Number.isFinite(maybe.seconds)) {
    const nanos = typeof maybe.nanoseconds === 'number' && Number.isFinite(maybe.nanoseconds) ? maybe.nanoseconds : 0;
    return maybe.seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  return null;
}

/**
 * Parses a date or datetime string into an epoch millisecond timestamp,
 * interpreting timezone-naive strings ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm')
 * strictly in Indian Standard Time (IST, +05:30) with exact 1-minute precision.
 */
export function parseIstTimestamp(dateStr?: string | number | unknown): number | null {
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

  const naiveMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(trimmed);
  if (naiveMatch) {
    const year = Number(naiveMatch[1]);
    const month = Number(naiveMatch[2]);
    const day = Number(naiveMatch[3]);
    const hour = naiveMatch[4] !== undefined ? Number(naiveMatch[4]) : 0;
    const minute = naiveMatch[5] !== undefined ? Number(naiveMatch[5]) : 0;
    const second = naiveMatch[6] !== undefined ? Number(naiveMatch[6]) : 0;

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
    )}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`;
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
export function splitIstDateTimeParts(dateStr?: string | number | unknown): { date: string; time: string } {
  if (dateStr === undefined || dateStr === null || dateStr === '') return { date: '', time: '' };

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed) return { date: '', time: '' };

    const naiveMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::\d{1,2})?)?$/.exec(trimmed);
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
 * Converts canonical 24-hour 'HH:mm' string into 12-hour AM/PM selector values (hour 1-12, minute 0-59).
 */
export function to12HourTimeParts(time24?: string, fallback: string = '00:00'): Time12HourParts {
  const source = (time24 && /^\d{1,2}:\d{1,2}$/.test(time24.trim()) ? time24.trim() : fallback).trim();
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
 * Combines separate date (YYYY-MM-DD) and time (HH:mm) inputs into canonical YYYY-MM-DDTHH:mm IST string.
 */
export function combineIstDateTimeParts(
  date: string,
  time: string,
  defaultTime: string = '00:00'
): string {
  const cleanDate = (date || '').trim();
  const cleanTime = (time || '').trim();
  if (!cleanDate) return '';
  const effectiveTime = /^\d{1,2}:\d{1,2}$/.test(cleanTime) ? cleanTime : defaultTime;
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
  startDate?: string,
  expiryDate?: string,
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

  const startMs = parseIstTimestamp(startDate);
  const endMs = parseIstTimestamp(expiryDate);

  if (startDate && startDate.trim() !== '' && startMs === null) {
    return { valid: false, error: 'Valid From date/time format is invalid.' };
  }
  if (expiryDate && expiryDate.trim() !== '' && endMs === null) {
    return { valid: false, error: 'Valid Until date/time format is invalid.' };
  }

  if (startMs !== null && endMs !== null && endMs < startMs) {
    return {
      valid: false,
      error: 'Valid Until date and time cannot be earlier than Valid From date and time.',
    };
  }

  return { valid: true };
}

export function formatValidityDate(dateStr?: string | number | unknown): string {
  if (!dateStr) return 'Not Set';

  const ms = parseIstTimestamp(dateStr);
  if (ms === null) return 'Not Set';

  const istDate = new Date(ms + IST_OFFSET_MS);
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

  const currentTime = now.getTime();
  const expTime = parseIstTimestamp(banner.expiryDate);
  const startTime = parseIstTimestamp(banner.startDate);

  if (startTime !== null && currentTime < startTime) {
    return 'scheduled';
  }

  if (expTime !== null && currentTime >= expTime) {
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
 * across all admin-enabled banners so customer/admin views transition automatically
 * without polling Firebase.
 */
export function getNextBannerTransitionDelayMs(
  banners: HomepageBanner[],
  nowMs: number = Date.now()
): number | null {
  let minDelay: number | null = null;
  const maxSafeTimeoutMs = 24 * 60 * 60 * 1000;

  for (const banner of banners) {
    if (!banner.isEnabled || banner.status === 'disabled') continue;

    const startMs = parseIstTimestamp(banner.startDate);
    if (startMs !== null && startMs > nowMs) {
      const delta = startMs - nowMs + 50;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }

    const expMs = parseIstTimestamp(banner.expiryDate);
    if (expMs !== null && expMs > nowMs) {
      const delta = expMs - nowMs + 50;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }
  }

  if (minDelay === null) return null;
  return Math.min(minDelay, maxSafeTimeoutMs);
}
