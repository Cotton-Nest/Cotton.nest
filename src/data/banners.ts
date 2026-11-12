export interface HomepageBanner {
  id: string;
  campaignName: string;
  category: string;
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
  textAlignment: 'left' | 'center' | 'right';
  festiveEffect?: 'none' | 'diwali_diyas' | 'gold_sparks' | 'festive_confetti' | 'winter_snow' | 'floral_petals' | 'champagne_shimmer';
  startDate?: string;
  expiryDate?: string;
  priority: number;
  status: 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled';
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

export const CAMPAIGN_CATEGORIES = [
  'Diwali',
  'Holi',
  'Christmas',
  'New Year',
  'Independence Day',
  'Wedding Season',
  'Summer Collection',
  'Winter Collection',
  'New Arrivals',
  'Special Discounts',
  'Custom',
];

export const INITIAL_BANNERS: HomepageBanner[] = [
  {
    id: 'banner-diwali-2026',
    campaignName: 'Diwali Grand Festivities',
    category: 'Diwali',
    heading: 'HAPPY DIWALI',
    subtitle: 'Celebrate the Festival of Lights with Cotton Nest 100% Pure Combed Cotton Bedsheets.',
    description: 'Elevate your festive bedroom with handcrafted long-staple cotton sheets, subtle golden floral motifs, and 350 Thread Count silk-soft comfort.',
    ctaText: 'SHOP FESTIVE COLLECTION',
    ctaDestination: 'catalogue',
    secondaryCtaText: 'VISIT GURGAON STUDIO',
    secondaryCtaDestination: 'store',
    desktopImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1600',
    mobileImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800',
    backgroundColor: '#FAF6F0',
    textColor: '#2C2420',
    textAlignment: 'center',
    festiveEffect: 'gold_sparks',
    startDate: '2026-11-15T10:00',
    expiryDate: '2026-11-30T23:59',
    priority: 1,
    status: 'active',
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function formatValidityDate(dateStr?: string | number): string {
  if (!dateStr) return 'Not Set';
  
  let parseable = dateStr;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr) && !dateStr.includes('Z') && !dateStr.includes('+')) {
    parseable = dateStr.length === 16 ? `${dateStr}:00+05:30` : `${dateStr}+05:30`;
  }

  const d = new Date(parseable);
  if (isNaN(d.getTime())) return 'Not Set';

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

export function computeBannerStatus(banner: HomepageBanner, now: Date = new Date()): 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' {
  if (!banner.isEnabled || banner.status === 'disabled') return 'disabled';
  if (banner.status === 'draft') return 'draft';

  const currentTime = now.getTime();

  if (banner.expiryDate) {
    const expTime = new Date(banner.expiryDate).getTime();
    if (!isNaN(expTime) && currentTime > expTime) {
      return 'expired';
    }
  }

  if (banner.startDate) {
    const startTime = new Date(banner.startDate).getTime();
    if (!isNaN(startTime) && currentTime < startTime) {
      return 'scheduled';
    }
  }

  return 'active';
}

export function getActiveEligibleBanners(banners: HomepageBanner[], now: Date = new Date()): HomepageBanner[] {
  return banners
    .filter((b) => computeBannerStatus(b, now) === 'active')
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
}

