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

/**
 * Parses a date or datetime string into an epoch millisecond timestamp,
 * interpreting timezone-naive strings ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm')
 * strictly in Indian Standard Time (IST, +05:30).
 */
export function parseIstTimestamp(dateStr?: string | number): number | null {
  if (dateStr === undefined || dateStr === null || dateStr === '') return null;
  if (typeof dateStr === 'number') {
    return Number.isFinite(dateStr) ? dateStr : null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}T00:00:00+05:30`;
  } else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed) &&
    !trimmed.includes('Z') &&
    !/[+-]\d{2}:\d{2}$/.test(trimmed)
  ) {
    normalized = trimmed.length === 16 ? `${trimmed}:00+05:30` : `${trimmed}+05:30`;
  }

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Extracts YYYY-MM-DD and HH:mm parts in IST for date and time pickers.
 */
export function splitIstDateTimeParts(dateStr?: string): { date: string; time: string } {
  if (!dateStr || typeof dateStr !== 'string') return { date: '', time: '' };
  const trimmed = dateStr.trim();
  if (!trimmed) return { date: '', time: '' };

  const localMatch = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(trimmed);
  if (localMatch && !trimmed.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return {
      date: localMatch[1] || '',
      time: localMatch[2] || '',
    };
  }

  const ms = parseIstTimestamp(trimmed);
  if (ms === null) return { date: '', time: '' };

  // Convert UTC ms to IST (+5h30m) components deterministically
  const istDate = new Date(ms + 330 * 60 * 1000);
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
  return `${cleanDate}T${cleanTime || defaultTime}`;
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

export function formatValidityDate(dateStr?: string | number): string {
  if (!dateStr) return 'Not Set';

  const ms = parseIstTimestamp(dateStr);
  if (ms === null) return 'Not Set';
  const d = new Date(ms);

  const dateFormatted = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const timeFormatted = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  return `${dateFormatted} · ${timeFormatted} IST`;
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

  if (expTime !== null && currentTime > expTime) {
    return 'expired';
  }

  if (startTime !== null && currentTime < startTime) {
    return 'scheduled';
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
      const delta = startMs - nowMs + 250;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }

    const expMs = parseIstTimestamp(banner.expiryDate);
    if (expMs !== null && expMs >= nowMs) {
      const delta = expMs - nowMs + 250;
      if (minDelay === null || delta < minDelay) {
        minDelay = delta;
      }
    }
  }

  if (minDelay === null) return null;
  return Math.min(minDelay, maxSafeTimeoutMs);
}
