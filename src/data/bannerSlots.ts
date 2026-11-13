export type BannerSlotId =
  | 'welcome'
  | 'festive'
  | 'special_offer'
  | 'new_collection'
  | 'general_announcement';

export type BannerSlotCategory = BannerSlotId;

export type FestivalType =
  | 'diwali'
  | 'holi'
  | 'raksha_bandhan'
  | 'eid'
  | 'christmas'
  | 'new_year'
  | 'navratri'
  | 'ganesh_chaturthi'
  | 'lohri_pongal'
  | 'other_festival';

export type BannerComputedStatus = 'disabled' | 'scheduled' | 'active' | 'expired';

export type BannerCtaTarget = 'catalogue' | 'seasonal' | 'store' | 'none';

export interface BannerBackgroundTemplate {
  id: string;
  name: string;
  category: BannerSlotCategory;
  festivalId?: FestivalType;
  imageUrl: string;
  tone: 'light' | 'dark';
  textColor: string;
  subtextColor: string;
  accentColor: string;
  ctaBgColor: string;
  ctaTextColor: string;
  overlayGradient: string;
  fallbackGradient: string;
  objectPosition: string;
  description: string;
}

export interface FestivalOption {
  id: FestivalType;
  label: string;
  kickerLabel: string;
  defaultTemplateId: string;
  description: string;
}

export interface BannerSlot {
  id: BannerSlotId;
  slotLabel: string;
  category: BannerSlotCategory;
  festivalId?: FestivalType;
  templateId: string;
  heading: string;
  supportingMessage: string;
  ctaText: string;
  ctaTarget: BannerCtaTarget;
  enabled: boolean;
  priority: number;
  validFrom: string | null;
  validUntil: string | null;
  updatedAt?: number;
}

export const FIXED_BANNER_SLOT_ORDER: BannerSlotId[] = [
  'welcome',
  'festive',
  'special_offer',
  'new_collection',
  'general_announcement',
];

export const BANNER_CATEGORY_LABELS: Record<BannerSlotCategory, string> = {
  welcome: 'Welcome Banner',
  festive: 'Festive Banner',
  special_offer: 'Special Offer Banner',
  new_collection: 'New Collection Banner',
  general_announcement: 'General Announcement Banner',
};

export const BANNER_BACKGROUND_TEMPLATES: BannerBackgroundTemplate[] = [
  {
    id: 'welcome-floral',
    name: 'Soft Blush Pink & Floral Cotton',
    category: 'welcome',
    imageUrl: '/images/banners/welcome-floral.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4E3F38',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 247, 242, 0.88) 0%, rgba(250, 247, 242, 0.72) 55%, rgba(250, 247, 242, 0.22) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #FDEAF0 55%, #F5E6D3 100%)',
    objectPosition: 'center center',
    description: 'Delicate watercolor rose petals, ivory cotton drapes & subtle champagne gold lines.',
  },
  {
    id: 'welcome-serene-bedroom',
    name: 'Sunlit Morning Bedroom & Cream Pillows',
    category: 'welcome',
    imageUrl: '/images/banners/welcome-serene-bedroom.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4E3F38',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 247, 242, 0.86) 0%, rgba(250, 247, 242, 0.68) 58%, rgba(250, 247, 242, 0.2) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #F8E8EE 55%, #EFE3D3 100%)',
    objectPosition: 'center center',
    description: 'Airy morning bedroom sunlight illuminating crisp cream and soft blush cotton pillows.',
  },
  {
    id: 'welcome-blush-botanicals',
    name: 'Blush Linen & Pressed Jasmine Roses',
    category: 'welcome',
    imageUrl: '/images/banners/welcome-blush-botanicals.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4E3F38',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 246, 246, 0.86) 0%, rgba(252, 246, 246, 0.68) 56%, rgba(252, 246, 246, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FDF6F7 0%, #FAF2EC 55%, #F7DFE6 100%)',
    objectPosition: 'center center',
    description: 'Fine blush and ivory cotton weave framed delicately with white jasmine and pale pink roses.',
  },
  {
    id: 'festive-diwali',
    name: 'Diwali Diyas & Golden Lights',
    category: 'festive',
    festivalId: 'diwali',
    imageUrl: '/images/banners/festive-diwali.jpg',
    tone: 'dark',
    textColor: '#FFFBF4',
    subtextColor: '#F3E7D3',
    accentColor: '#E9C87B',
    ctaBgColor: '#E9C87B',
    ctaTextColor: '#2C1810',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(32, 12, 16, 0.78) 0%, rgba(32, 12, 16, 0.56) 56%, rgba(32, 12, 16, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #2D0F18 0%, #4A1826 50%, #2B1418 100%)',
    objectPosition: 'center center',
    description: 'Deep burgundy linen framed by glowing brass diyas, marigold petals & warm fairy lights.',
  },
  {
    id: 'festive-holi',
    name: 'Holi Pastel Gulal & Petals',
    category: 'festive',
    festivalId: 'holi',
    imageUrl: '/images/banners/festive-holi.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4A3B34',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 249, 243, 0.88) 0%, rgba(252, 249, 243, 0.7) 58%, rgba(252, 249, 243, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #FDEAF0 48%, #EAF5EE 100%)',
    objectPosition: 'center center',
    description: 'Ivory cotton fabric accented along the borders with pastel gulal & fresh rose petals.',
  },
  {
    id: 'festive-raksha-bandhan',
    name: 'Raksha Bandhan Zari & Marigold',
    category: 'festive',
    festivalId: 'raksha_bandhan',
    imageUrl: '/images/banners/festive-raksha-bandhan.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4D3C34',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(249, 243, 232, 0.88) 0%, rgba(249, 243, 232, 0.72) 56%, rgba(249, 243, 232, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF5EA 0%, #F8E5EA 50%, #F2E2C4 100%)',
    objectPosition: 'center center',
    description: 'Raw silk cream zari weave bordered by artisan rakhi tassels and festive marigolds.',
  },
  {
    id: 'festive-eid',
    name: 'Eid Crescent & Golden Lanterns',
    category: 'festive',
    festivalId: 'eid',
    imageUrl: '/images/banners/festive-eid.jpg',
    tone: 'dark',
    textColor: '#FFFDF7',
    subtextColor: '#E9EFEA',
    accentColor: '#E8C97D',
    ctaBgColor: '#E8C97D',
    ctaTextColor: '#162822',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(16, 36, 31, 0.78) 0%, rgba(16, 36, 31, 0.56) 58%, rgba(16, 36, 31, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #132A24 0%, #1C3A32 50%, #10231E 100%)',
    objectPosition: 'center 28%',
    description: 'Refined emerald-charcoal tone with champagne gold crescent moon, lanterns & geometric lattice.',
  },
  {
    id: 'festive-christmas',
    name: 'Christmas Greenery & Warm Lights',
    category: 'festive',
    festivalId: 'christmas',
    imageUrl: '/images/banners/festive-christmas.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4A3E36',
    accentColor: '#70252D',
    ctaBgColor: '#70252D',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 247, 241, 0.88) 0%, rgba(250, 247, 241, 0.7) 56%, rgba(250, 247, 241, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #EFE8DC 55%, #E7EDE6 100%)',
    objectPosition: 'center center',
    description: 'Cozy winter ivory cotton bed linen framed by soft pine sprigs and warm champagne lights.',
  },
  {
    id: 'festive-new-year',
    name: 'New Year Champagne & Art-Deco Gold',
    category: 'festive',
    festivalId: 'new_year',
    imageUrl: '/images/banners/festive-new-year.jpg',
    tone: 'dark',
    textColor: '#FFFBF3',
    subtextColor: '#F3E5CE',
    accentColor: '#EBD08A',
    ctaBgColor: '#EBD08A',
    ctaTextColor: '#291712',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(35, 19, 16, 0.76) 0%, rgba(35, 19, 16, 0.56) 56%, rgba(35, 19, 16, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #2D1814 0%, #4A2B20 50%, #241310 100%)',
    objectPosition: 'center center',
    description: 'Warm espresso-gold silk with delicate celebratory light sparkles and linear art-deco borders.',
  },
  {
    id: 'festive-navratri',
    name: 'Navratri Bandhani & Temple Bells',
    category: 'festive',
    festivalId: 'navratri',
    imageUrl: '/images/banners/festive-navratri.jpg',
    tone: 'dark',
    textColor: '#FFFBF2',
    subtextColor: '#F6E7CF',
    accentColor: '#F2C96B',
    ctaBgColor: '#F2C96B',
    ctaTextColor: '#3A1215',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(78, 16, 20, 0.8) 0%, rgba(78, 16, 20, 0.6) 56%, rgba(78, 16, 20, 0.18) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #64151B 0%, #8E2428 50%, #521015 100%)',
    objectPosition: 'center center',
    description: 'Heritage crimson & saffron bandhani weave framed by marigold torans and brass bells.',
  },
  {
    id: 'festive-diwali-rangoli',
    name: 'Diwali Golden Lotus Rangoli & Tea-Lights',
    category: 'festive',
    festivalId: 'diwali',
    imageUrl: '/images/banners/festive-diwali-rangoli.jpg',
    tone: 'dark',
    textColor: '#FFFBF4',
    subtextColor: '#F3E7D3',
    accentColor: '#E9C87B',
    ctaBgColor: '#E9C87B',
    ctaTextColor: '#2C1810',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(36, 10, 16, 0.76) 0%, rgba(36, 10, 16, 0.56) 56%, rgba(36, 10, 16, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #2D0F18 0%, #4E1826 50%, #260E14 100%)',
    objectPosition: 'center center',
    description: 'Deep burgundy silk framed by golden lotus rangoli motifs and glowing brass tea-lights.',
  },
  {
    id: 'festive-ganesh-chaturthi',
    name: 'Marigold Toran & Brass Bells Silk',
    category: 'festive',
    festivalId: 'ganesh_chaturthi',
    imageUrl: '/images/banners/festive-ganesh-chaturthi.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4D3C34',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 245, 236, 0.88) 0%, rgba(250, 245, 236, 0.72) 54%, rgba(250, 245, 236, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF3E6 0%, #F8E2D8 52%, #F1DEC0 100%)',
    objectPosition: 'center center',
    description: 'Warm ivory silk framed on the sides with auspicious marigold garlands, jasmine & temple bells.',
  },
  {
    id: 'festive-harvest-pongal',
    name: 'Harvest Golden Wheat & Brass Lanterns',
    category: 'festive',
    festivalId: 'lohri_pongal',
    imageUrl: '/images/banners/festive-harvest-pongal.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4E3E34',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 246, 238, 0.88) 0%, rgba(250, 246, 238, 0.7) 56%, rgba(250, 246, 238, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF6EE 0%, #F4E6CE 55%, #ECD6B6 100%)',
    objectPosition: 'center center',
    description: 'Sunlit cream cotton canvas bordered by golden wheat sheaves, terracotta paisleys & brass lanterns.',
  },
  {
    id: 'special-offer',
    name: 'Champagne Gold Ribbon & Blush Silk',
    category: 'special_offer',
    imageUrl: '/images/banners/special-offer.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#52423A',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(251, 247, 240, 0.88) 0%, rgba(251, 247, 240, 0.68) 58%, rgba(251, 247, 240, 0.18) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #FDEAF0 52%, #F1E1C2 100%)',
    objectPosition: 'center center',
    description: 'Ivory linen texture framed by champagne gold silk ribbons and soft blush drapery.',
  },
  {
    id: 'special-offer-burgundy-gold',
    name: 'Royal Burgundy & Gold Botanical Filigree',
    category: 'special_offer',
    imageUrl: '/images/banners/special-offer-burgundy-gold.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4F3D36',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(251, 247, 240, 0.86) 0%, rgba(251, 247, 240, 0.66) 52%, rgba(251, 247, 240, 0.08) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #F4E6DC 52%, #8C2E46 100%)',
    objectPosition: 'center center',
    description: 'Warm ivory cotton center framed by a signature Cotton Nest burgundy & gold botanical border.',
  },
  {
    id: 'special-offer-blush-gift',
    name: 'Champagne Satin Gift Bow & Blush Silk',
    category: 'special_offer',
    imageUrl: '/images/banners/special-offer-blush-gift.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#52423A',
    accentColor: '#8C2E46',
    ctaBgColor: '#8C2E46',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 247, 243, 0.88) 0%, rgba(252, 247, 243, 0.7) 56%, rgba(252, 247, 243, 0.16) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FCF7F3 0%, #FDEAF0 54%, #F2DEC0 100%)',
    objectPosition: 'center center',
    description: 'Delicate blush silk & cream linen accented with a tailored champagne gold satin gift bow.',
  },
  {
    id: 'new-collection',
    name: 'Sunlit Folded Pure Cotton Collection',
    category: 'new_collection',
    imageUrl: '/images/banners/new-collection.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4A3C35',
    accentColor: '#70252D',
    ctaBgColor: '#70252D',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'linear-gradient(90deg, rgba(250, 247, 242, 0.88) 0%, rgba(250, 247, 242, 0.78) 52%, rgba(250, 247, 242, 0.36) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #EFE6D8 55%, #F8E8EC 100%)',
    objectPosition: 'center center',
    description: 'Crisp folded cream & blush floral cotton sheets illuminated by soft morning bedroom light.',
  },
  {
    id: 'new-collection-flatlay',
    name: 'Curated Pastel Cotton Swatches Flatlay',
    category: 'new_collection',
    imageUrl: '/images/banners/new-collection-flatlay.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4A3C35',
    accentColor: '#70252D',
    ctaBgColor: '#70252D',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(250, 247, 242, 0.88) 0%, rgba(250, 247, 242, 0.7) 55%, rgba(250, 247, 242, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FAF7F2 0%, #F7E8EC 52%, #EBF2EA 100%)',
    objectPosition: 'center center',
    description: 'Ivory, blush floral & sage green combed cotton swatches styled cleanly with olive botanicals.',
  },
  {
    id: 'new-collection-linen-drapes',
    name: 'Flowing Cream & Blush Cotton Drapery',
    category: 'new_collection',
    imageUrl: '/images/banners/new-collection-linen-drapes.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#4E4039',
    accentColor: '#70252D',
    ctaBgColor: '#70252D',
    ctaTextColor: '#FFFFFF',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(251, 248, 244, 0.84) 0%, rgba(251, 248, 244, 0.64) 58%, rgba(251, 248, 244, 0.18) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FBF8F4 0%, #F5E5E0 55%, #EEE2D2 100%)',
    objectPosition: 'center center',
    description: 'Cascading cream, pearl beige and soft blush cotton textiles showcasing breathable softness.',
  },
  {
    id: 'general-announcement',
    name: 'Minimal Cream, White & Blush Weave',
    category: 'general_announcement',
    imageUrl: '/images/banners/general-announcement.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#564740',
    accentColor: '#8C2E46',
    ctaBgColor: '#2C2420',
    ctaTextColor: '#FAF7F2',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 250, 247, 0.82) 0%, rgba(252, 250, 247, 0.58) 65%, rgba(252, 250, 247, 0.2) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FFFFFF 0%, #FAF7F2 55%, #FDEAF0 100%)',
    objectPosition: 'center center',
    description: 'Ultra-clean woven cotton canvas with subtle blush tones and champagne gold accents.',
  },
  {
    id: 'general-ivory-gold-frame',
    name: 'Ivory Cotton Stationery & Double Gold Border',
    category: 'general_announcement',
    imageUrl: '/images/banners/general-ivory-gold-frame.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#564740',
    accentColor: '#8C2E46',
    ctaBgColor: '#2C2420',
    ctaTextColor: '#FAF7F2',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 250, 247, 0.78) 0%, rgba(252, 250, 247, 0.52) 64%, rgba(252, 250, 247, 0.14) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FCF9F4 0%, #FAF1EE 55%, #F2E4CE 100%)',
    objectPosition: 'center center',
    description: 'Minimalist warm ivory cotton texture framed with double champagne gold atelier lines.',
  },
  {
    id: 'general-studio-soft',
    name: 'Sunlit Blush-Cream Atelier Backdrop',
    category: 'general_announcement',
    imageUrl: '/images/banners/general-studio-soft.jpg',
    tone: 'light',
    textColor: '#2C2420',
    subtextColor: '#564740',
    accentColor: '#8C2E46',
    ctaBgColor: '#2C2420',
    ctaTextColor: '#FAF7F2',
    overlayGradient:
      'radial-gradient(ellipse at center, rgba(252, 249, 247, 0.76) 0%, rgba(252, 249, 247, 0.5) 65%, rgba(252, 249, 247, 0.15) 100%)',
    fallbackGradient: 'linear-gradient(135deg, #FCF9F7 0%, #FDEFF3 55%, #FAF4EB 100%)',
    objectPosition: 'center center',
    description: 'Soft studio cream and blush cotton surface kissed by warm diagonal afternoon light.',
  },
];

export const FESTIVAL_OPTIONS: FestivalOption[] = [
  {
    id: 'diwali',
    label: 'Diwali',
    kickerLabel: 'Diwali Festive Collection',
    defaultTemplateId: 'festive-diwali',
    description: 'Glowing brass diyas, golden bokeh lights & deep burgundy accents.',
  },
  {
    id: 'holi',
    label: 'Holi',
    kickerLabel: 'Holi Spring Celebration',
    defaultTemplateId: 'festive-holi',
    description: 'Soft pastel gulal powder clouds & fresh rose petals on pure cotton.',
  },
  {
    id: 'raksha_bandhan',
    label: 'Raksha Bandhan',
    kickerLabel: 'Raksha Bandhan Gifting',
    defaultTemplateId: 'festive-raksha-bandhan',
    description: 'Cream zari silk texture with artisan rakhi tassels & marigolds.',
  },
  {
    id: 'eid',
    label: 'Eid',
    kickerLabel: 'Eid Mubarak Collection',
    defaultTemplateId: 'festive-eid',
    description: 'Refined emerald-charcoal crescent moon, lanterns & geometric motifs.',
  },
  {
    id: 'christmas',
    label: 'Christmas',
    kickerLabel: 'Christmas Winter Comfort',
    defaultTemplateId: 'festive-christmas',
    description: 'Warm ivory cotton bedding with pine greenery & champagne lights.',
  },
  {
    id: 'new_year',
    label: 'New Year',
    kickerLabel: 'New Year Atelier Showcase',
    defaultTemplateId: 'festive-new-year',
    description: 'Warm espresso-champagne silk texture & celebratory art-deco gold borders.',
  },
  {
    id: 'navratri',
    label: 'Navratri',
    kickerLabel: 'Navratri Heritage Edition',
    defaultTemplateId: 'festive-navratri',
    description: 'Traditional crimson-marigold bandhani & temple-bell accents.',
  },
  {
    id: 'ganesh_chaturthi',
    label: 'Ganesh Chaturthi / Dussehra',
    kickerLabel: 'Festive Marigold Celebration',
    defaultTemplateId: 'festive-ganesh-chaturthi',
    description: 'Warm ivory silk framed by marigold garlands, jasmine & temple bells.',
  },
  {
    id: 'lohri_pongal',
    label: 'Pongal / Makar Sankranti / Lohri',
    kickerLabel: 'Harvest Festival Collection',
    defaultTemplateId: 'festive-harvest-pongal',
    description: 'Cream raw cotton bordered by golden wheat sheaves & brass lanterns.',
  },
  {
    id: 'other_festival',
    label: 'Other Indian Festival',
    kickerLabel: 'Festive Atelier Showcase',
    defaultTemplateId: 'special-offer',
    description: 'Versatile champagne gold & blush festive canvas (customize template freely).',
  },
];

export const DEFAULT_BANNER_SLOTS: BannerSlot[] = [
  {
    id: 'welcome',
    slotLabel: 'Welcome Banner',
    category: 'welcome',
    templateId: 'welcome-floral',
    heading: 'Welcome to Cotton Nest — Feel the Softness',
    supportingMessage:
      '100% pure combed long-staple cotton King size bedsheets, woven for breathable luxury and serene mornings.',
    ctaText: 'Explore Catalogue',
    ctaTarget: 'catalogue',
    enabled: false,
    priority: 1,
    validFrom: null,
    validUntil: null,
  },
  {
    id: 'festive',
    slotLabel: 'Festive Banner',
    category: 'festive',
    festivalId: 'diwali',
    templateId: 'festive-diwali',
    heading: 'Celebrate Diwali with Pure Cotton Elegance',
    supportingMessage:
      'Dress your home in luminous floral & heritage cotton weaves curated at our Sector 46 Gurgaon Atelier.',
    ctaText: 'View Festive Offers',
    ctaTarget: 'seasonal',
    enabled: false,
    priority: 2,
    validFrom: null,
    validUntil: null,
  },
  {
    id: 'special_offer',
    slotLabel: 'Special Offer Banner',
    category: 'special_offer',
    templateId: 'special-offer',
    heading: 'Atelier Privilege — Pure Cotton Seasonal Savings',
    supportingMessage:
      'Enjoy thoughtful value on our generous 108×108 King size cotton bedsheet sets with flat ₹29 pan-India shipping.',
    ctaText: 'Shop Offers',
    ctaTarget: 'seasonal',
    enabled: false,
    priority: 3,
    validFrom: null,
    validUntil: null,
  },
  {
    id: 'new_collection',
    slotLabel: 'New Collection Banner',
    category: 'new_collection',
    templateId: 'new-collection',
    heading: 'Fresh Botanical Cotton Weaves Just Arrived',
    supportingMessage:
      'Discover airy pastel florals, sage mints, and timeless trellises tailored with zero-untuck 108×108 proportions.',
    ctaText: 'View New Arrivals',
    ctaTarget: 'catalogue',
    enabled: false,
    priority: 4,
    validFrom: null,
    validUntil: null,
  },
  {
    id: 'general_announcement',
    slotLabel: 'General Announcement Banner',
    category: 'general_announcement',
    templateId: 'general-announcement',
    heading: 'Direct From Our Sector 46 Gurgaon Studio',
    supportingMessage:
      'Complimentary delivery in Sector 46 Gurgaon & flat ₹29 courier dispatch across India on pure cotton bedding.',
    ctaText: 'Visit Studio Details',
    ctaTarget: 'store',
    enabled: false,
    priority: 5,
    validFrom: null,
    validUntil: null,
  },
];

export function getBannerTemplateById(templateId?: string | null): BannerBackgroundTemplate {
  if (templateId) {
    const found = BANNER_BACKGROUND_TEMPLATES.find((t) => t.id === templateId);
    if (found) return found;
  }
  return BANNER_BACKGROUND_TEMPLATES[0];
}

export function getFestivalOptionById(festivalId?: FestivalType | null): FestivalOption {
  if (festivalId) {
    const found = FESTIVAL_OPTIONS.find((f) => f.id === festivalId);
    if (found) return found;
  }
  return FESTIVAL_OPTIONS[0];
}

export function getDefaultTemplateForCategory(
  category: BannerSlotCategory,
  festivalId?: FestivalType
): BannerBackgroundTemplate {
  if (category === 'festive') {
    const fest = getFestivalOptionById(festivalId || 'diwali');
    return getBannerTemplateById(fest.defaultTemplateId);
  }
  const match = BANNER_BACKGROUND_TEMPLATES.find((t) => t.category === category);
  return match || BANNER_BACKGROUND_TEMPLATES[0];
}

export function normalizeBannerSlots(rawSlots?: unknown): BannerSlot[] {
  const inputArray = Array.isArray(rawSlots) ? rawSlots : [];
  const byId = new Map<string, Partial<BannerSlot>>();
  for (const item of inputArray) {
    if (item && typeof item === 'object' && typeof (item as BannerSlot).id === 'string') {
      byId.set((item as BannerSlot).id, item as Partial<BannerSlot>);
    }
  }

  return DEFAULT_BANNER_SLOTS.map((defaultSlot) => {
    const saved = byId.get(defaultSlot.id);
    if (!saved) {
      return { ...defaultSlot };
    }

    const validCategory: BannerSlotCategory =
      saved.category && FIXED_BANNER_SLOT_ORDER.includes(saved.category)
        ? saved.category
        : defaultSlot.category;

    const validFestivalId: FestivalType | undefined =
      validCategory === 'festive'
        ? saved.festivalId && FESTIVAL_OPTIONS.some((f) => f.id === saved.festivalId)
          ? saved.festivalId
          : defaultSlot.festivalId || 'diwali'
        : saved.festivalId && FESTIVAL_OPTIONS.some((f) => f.id === saved.festivalId)
          ? saved.festivalId
          : undefined;

    const validTemplateExists =
      typeof saved.templateId === 'string' &&
      BANNER_BACKGROUND_TEMPLATES.some((t) => t.id === saved.templateId);

    const resolvedTemplateId = validTemplateExists
      ? (saved.templateId as string)
      : getDefaultTemplateForCategory(validCategory, validFestivalId).id;

    const validCtaTarget: BannerCtaTarget =
      saved.ctaTarget === 'catalogue' ||
      saved.ctaTarget === 'seasonal' ||
      saved.ctaTarget === 'store' ||
      saved.ctaTarget === 'none'
        ? saved.ctaTarget
        : defaultSlot.ctaTarget;

    const parsedPriority = Number(saved.priority);
    const priority =
      Number.isFinite(parsedPriority) && parsedPriority >= 1 && parsedPriority <= 99
        ? Math.round(parsedPriority)
        : defaultSlot.priority;

    return {
      id: defaultSlot.id,
      slotLabel: defaultSlot.slotLabel,
      category: validCategory,
      ...(validFestivalId ? { festivalId: validFestivalId } : {}),
      templateId: resolvedTemplateId,
      heading:
        typeof saved.heading === 'string' && saved.heading.trim().length > 0
          ? saved.heading
          : defaultSlot.heading,
      supportingMessage:
        typeof saved.supportingMessage === 'string'
          ? saved.supportingMessage
          : defaultSlot.supportingMessage,
      ctaText: typeof saved.ctaText === 'string' ? saved.ctaText : defaultSlot.ctaText,
      ctaTarget: validCtaTarget,
      enabled: Boolean(saved.enabled),
      priority,
      validFrom: typeof saved.validFrom === 'string' && saved.validFrom.trim() ? saved.validFrom.trim() : null,
      validUntil:
        typeof saved.validUntil === 'string' && saved.validUntil.trim() ? saved.validUntil.trim() : null,
      updatedAt: typeof saved.updatedAt === 'number' ? saved.updatedAt : defaultSlot.updatedAt,
    };
  });
}

/**
 * Parses an IST/ISO timestamp string or Date safely to epoch milliseconds.
 * Naive `YYYY-MM-DDTHH:mm` strings are treated explicitly as IST (+05:30).
 */
export function parseIstTimestampMs(value?: string | Date | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // Match naive YYYY-MM-DDTHH:mm(:ss)? and attach explicit +05:30 IST offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const ms = Date.parse(`${withSeconds}+05:30`);
    return Number.isNaN(ms) ? null : ms;
  }

  // Match YYYY-MM-DD date-only string -> start of day IST
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(`${trimmed}T00:00:00+05:30`);
    return Number.isNaN(ms) ? null : ms;
  }

  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Converts a stored ISO/IST timestamp into `{ date: 'YYYY-MM-DD', time: 'HH:mm' }`
 * strictly formatted in Asia/Kolkata (IST) with 1-minute precision (no rounding).
 */
export function toIstDateTimeParts(value?: string | null): { date: string; time: string } {
  const ms = parseIstTimestampMs(value);
  if (ms === null) {
    return { date: '', time: '' };
  }

  const d = new Date(ms);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}`,
  };
}

/**
 * Builds an exact IST ISO-8601 string (`YYYY-MM-DDTHH:mm:00+05:30`) from date + time inputs.
 * Preserves exact hour and minute (00-59) without any rounding.
 */
export function fromIstDateTimeParts(dateStr: string, timeStr: string): string | null {
  const cleanDate = dateStr.trim();
  if (!cleanDate) return null;
  const cleanTime = timeStr.trim() || '00:00';
  const normalizedTime = /^\d{2}:\d{2}$/.test(cleanTime) ? cleanTime : '00:00';
  const iso = `${cleanDate}T${normalizedTime}:00+05:30`;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : iso;
}

export function formatIstDisplay(value?: string | null): string {
  const ms = parseIstTimestampMs(value);
  if (ms === null) return 'Always (No limit)';
  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
  return `${formatted} IST`;
}

export function validateValidityWindow(
  validFrom?: string | null,
  validUntil?: string | null
): { valid: boolean; error?: string } {
  const startMs = parseIstTimestampMs(validFrom);
  const endMs = parseIstTimestampMs(validUntil);
  if (startMs !== null && endMs !== null && endMs <= startMs) {
    return {
      valid: false,
      error: 'Valid Until date and time must be later than Valid From.',
    };
  }
  return { valid: true };
}

export function computeSlotStatus(
  slot: Pick<BannerSlot, 'enabled' | 'validFrom' | 'validUntil'>,
  now: Date = new Date()
): BannerComputedStatus {
  if (!slot.enabled) {
    return 'disabled';
  }
  const nowMs = now.getTime();
  const startMs = parseIstTimestampMs(slot.validFrom);
  const endMs = parseIstTimestampMs(slot.validUntil);

  if (startMs !== null && nowMs < startMs) {
    return 'scheduled';
  }
  if (endMs !== null && nowMs >= endMs) {
    return 'expired';
  }
  return 'active';
}

export function getActiveStorefrontBanner(
  slots: BannerSlot[],
  now: Date = new Date()
): BannerSlot | null {
  const active = slots.filter((slot) => computeSlotStatus(slot, now) === 'active');
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return FIXED_BANNER_SLOT_ORDER.indexOf(a.id) - FIXED_BANNER_SLOT_ORDER.indexOf(b.id);
  });

  return sorted[0];
}

/**
 * Selects a festival and automatically associates its matching pre-designed background.
 * Preserves existing heading, supportingMessage, validity, and admin enabled state
 * (never auto-publishes without admin approval).
 */
export function applyFestivalSelectionToSlot(slot: BannerSlot, festivalId: FestivalType): BannerSlot {
  const festival = getFestivalOptionById(festivalId);
  return {
    ...slot,
    category: 'festive',
    festivalId,
    templateId: festival.defaultTemplateId,
  };
}

/**
 * Changes a slot's background template independently without modifying heading,
 * supportingMessage, or enabled state.
 */
export function applyTemplateSelectionToSlot(slot: BannerSlot, templateId: string): BannerSlot {
  const template = getBannerTemplateById(templateId);
  return {
    ...slot,
    templateId: template.id,
  };
}
