export interface ThemeColors {
  primary: string;           // Buttons, links, active navigation items, badges
  primaryContrast?: string;  // Auto-calculated high-contrast text color for primary buttons
  secondary: string;         // Supporting interface elements and secondary buttons
  secondaryContrast?: string;// Auto-calculated contrast text for secondary elements
  background: string;        // Page background color
  surface: string;           // Surface/card background color
  text: string;              // Main text color
  textSecondary: string;     // Secondary text color
  accent: string;            // Decorative highlights, borders, stars and premium details
  header: string;            // Header/navbar background color
  headerText?: string;       // Header text and link color
  footer: string;            // Footer background color
  footerText?: string;       // Footer text and link color
  border?: string;           // Subtle card and divider borders
  glassOpacity?: number;     // Adjustable Apple Liquid Glass opacity (0.10 to 0.95, default 0.45)
  glassBlur?: number;        // Adjustable Apple Liquid Glass backdrop blur in px (8 to 44, default 28)
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  festivalTag?: string;
  badge?: string;
  colors: ThemeColors;
  isCustom?: boolean;
}

export interface WebsiteThemeConfig {
  activeThemeId: string;
  themeName: string;
  colors: ThemeColors;
  glassOpacity?: number;     // Global Liquid Glass opacity (0.10 to 0.95)
  glassBlur?: number;        // Global Liquid Glass blur in px (8 to 44)
  updatedAt: number;
  updatedBy?: string;
  version?: number;
}

export const DEFAULT_GLASS_OPACITY = 0.45; // 45% translucent Apple Liquid Glass
export const DEFAULT_GLASS_BLUR = 28;      // 28px optical refraction blur

// 1. Royal Luxury Atelier (Signature Imperial Velvet & 24K Champagne Gold palette)
export const ROYAL_LUXURY_ATELIER_COLORS: ThemeColors = {
  primary: '#5E1924',          // Imperial Velvet Bordeaux
  primaryContrast: '#FFFFFF',
  secondary: '#7A2332',        // Royal Maroon Silk
  secondaryContrast: '#FFFFFF',
  background: '#FAF6F0',       // Warm Alabaster Silk
  surface: '#FFFFFF',          // Crisp Ivory Linen card surface
  text: '#1E1612',             // Deep Obsidian Espresso
  textSecondary: '#5C4E46',    // Warm Umber
  accent: '#C5A059',           // Burnished 24K Champagne Gold
  header: '#FDFBF7',           // Luminous Silk Ivory header
  headerText: '#1E1612',
  footer: '#19120F',           // Deep Velvet Espresso footer
  footerText: '#FAF6F0',
  border: '#E2D4C0',           // Gilded Champagne Hairline
  glassOpacity: DEFAULT_GLASS_OPACITY,
  glassBlur: DEFAULT_GLASS_BLUR,
};

// Classic Cotton Nest (Original signature palette)
export const CLASSIC_COTTON_NEST_COLORS: ThemeColors = ROYAL_LUXURY_ATELIER_COLORS;

// 2. Luxury & Festival Theme Presets
export const FESTIVAL_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'luxury',
    name: 'Royal Luxury Atelier',
    description: 'Imperial velvet bordeaux, burnished 24K champagne gold, and warm alabaster silk.',
    festivalTag: 'Luxury Edition',
    badge: 'Signature Luxury',
    colors: ROYAL_LUXURY_ATELIER_COLORS,
  },
  {
    id: 'maharaja_palace',
    name: 'Udaipur Palace Gold & Ivory',
    description: 'Regal antique gold, palace sandstone ivory, and deep heritage bronze.',
    festivalTag: 'Royal Heritage',
    badge: 'Palace Luxury',
    colors: {
      primary: '#8C6520',          // Regal Antique Gold
      primaryContrast: '#FFFFFF',
      secondary: '#5E1924',        // Royal Velvet Crimson
      secondaryContrast: '#FFFFFF',
      background: '#FBF8F1',       // Palace Sandstone Ivory
      surface: '#FFFFFF',
      text: '#221912',             // Deep Heritage Bronze
      textSecondary: '#635243',    // Warm Sandstone Umber
      accent: '#C99B3B',           // Burnished Sovereign Gold
      header: '#FDFBF5',           // Alabaster Gold Wash
      headerText: '#221912',
      footer: '#1A130D',           // Dark Imperial Teak
      footerText: '#FBF8F1',
      border: '#E5D5B5',
    },
  },
  {
    id: 'luxury_noir',
    name: 'Midnight Onyx & 24K Gold',
    description: 'Opulent dark obsidian velvet paired with luminous champagne gold and warm ivory.',
    festivalTag: 'Noir Luxury',
    badge: 'Boutique Evening',
    colors: {
      primary: '#C5A059',          // Luminous 24K Champagne Gold
      primaryContrast: '#14110F',
      secondary: '#8C2E46',        // Deep Ruby Velvet
      secondaryContrast: '#FFFFFF',
      background: '#FAF5EC',       // Warm Champagne Parchment
      surface: '#FFFFFF',
      text: '#181310',             // Obsidian Espresso
      textSecondary: '#574A42',    // Muted Truffle
      accent: '#B88933',           // Rich Sovereign Gold
      header: '#191310',           // Midnight Obsidian Header
      headerText: '#FAF5EC',
      footer: '#120E0C',           // Deepest Onyx Footer
      footerText: '#FAF5EC',
      border: '#DFC9A3',
    },
  },
  {
    id: 'classic',
    name: 'Classic Cotton Nest',
    description: 'Timeless signature palette with warm cream, deep burgundy and muted gold.',
    festivalTag: 'Signature',
    badge: 'Everyday Luxury',
    colors: {
      primary: '#70252D',
      primaryContrast: '#FFFFFF',
      secondary: '#8C3A44',
      secondaryContrast: '#FFFFFF',
      background: '#FAF7F2',
      surface: '#FFFFFF',
      text: '#2C2420',
      textSecondary: '#6B5D55',
      accent: '#C29E57',
      header: '#FAF7F2',
      headerText: '#2C2420',
      footer: '#2C2420',
      footerText: '#FAF7F2',
      border: '#EAE2D5',
    },
  },
  {
    id: 'diwali',
    name: 'Diwali Festival of Lights',
    description: 'Festive warm saffron, celebratory deep burgundy, and radiant diya gold.',
    festivalTag: 'Diwali',
    badge: 'Festival of Lights',
    colors: {
      primary: '#D9531E',          // Warm saffron / terracotta flame
      primaryContrast: '#FFFFFF',
      secondary: '#701A24',        // Deep celebratory burgundy
      secondaryContrast: '#FFFFFF',
      background: '#FFFDF7',       // Warm golden ivory
      surface: '#FFFFFF',
      text: '#281C13',             // Dark mahogany
      textSecondary: '#6E5542',    // Warm earth
      accent: '#D49A24',           // Radiant diya gold
      header: '#FFF9ED',           // Warm golden sunrise
      headerText: '#281C13',
      footer: '#2E1410',           // Deep festive bronze
      footerText: '#FFFDF7',
      border: '#F2E4CB',
    },
  },
  {
    id: 'holi',
    name: 'Holi Colors of Joy',
    description: 'Tasteful gulal rose pink, festive violet and colourful golden marigold accents.',
    festivalTag: 'Holi',
    badge: 'Festival of Colors',
    colors: {
      primary: '#D93B78',          // Gulal rose pink
      primaryContrast: '#FFFFFF',
      secondary: '#793FA3',        // Festive gulal purple
      secondaryContrast: '#FFFFFF',
      background: '#FAF5F8',       // Soft celebratory mist
      surface: '#FFFFFF',
      text: '#2B1D28',             // Deep plum charcoal
      textSecondary: '#6B5665',    // Muted berry slate
      accent: '#E88024',           // Sunshine marigold accent
      header: '#FDF6FA',           // Clean gulal blush
      headerText: '#2B1D28',
      footer: '#2B1728',           // Rich royal plum
      footerText: '#FAF5F8',
      border: '#EEDCE7',
    },
  },
  {
    id: 'christmas',
    name: 'Christmas & Winter Joy',
    description: 'Pine forest green, warm winter cream and cheerful festive cranberry red.',
    festivalTag: 'Christmas',
    badge: 'Winter Holiday',
    colors: {
      primary: '#B22234',          // Festive cranberry red
      primaryContrast: '#FFFFFF',
      secondary: '#1E4D36',        // Deep pine forest green
      secondaryContrast: '#FFFFFF',
      background: '#FBF9F5',       // Warm winter cream
      surface: '#FFFFFF',
      text: '#1E2822',             // Deep evergreen charcoal
      textSecondary: '#4E5E54',    // Sage pine slate
      accent: '#D1A142',           // Warm golden star
      header: '#F5F8F5',           // Crisp mist pine cream
      headerText: '#1E2822',
      footer: '#162E21',           // Rich midnight pine
      footerText: '#FBF9F5',
      border: '#DCE8DE',
    },
  },
  {
    id: 'eid',
    name: 'Eid Mubarak Celebration',
    description: 'Regal emerald green, luminous ivory and radiant crescent gold.',
    festivalTag: 'Eid',
    badge: 'Regal Festive',
    colors: {
      primary: '#0F5B38',          // Regal emerald green
      primaryContrast: '#FFFFFF',
      secondary: '#1E7A4E',        // Crescent jade
      secondaryContrast: '#FFFFFF',
      background: '#F9FAF7',       // Luminous ivory
      surface: '#FFFFFF',
      text: '#172A20',             // Deep palm charcoal
      textSecondary: '#4D6054',    // Mineral olive slate
      accent: '#D4AF37',           // Radiant crescent gold
      header: '#F3F8F5',           // Pristine ivory-green wash
      headerText: '#172A20',
      footer: '#0E2C1D',           // Regal dark emerald
      footerText: '#F9FAF7',
      border: '#D9E6DD',
    },
  },
  {
    id: 'independence',
    name: 'Independence Day',
    description: 'Tiranga saffron, pristine white, India green and Ashoka navy accents.',
    festivalTag: 'National',
    badge: 'Tiranga Tribute',
    colors: {
      primary: '#FF671F',          // Tiranga kesaria saffron
      primaryContrast: '#FFFFFF',
      secondary: '#046A38',        // India green
      secondaryContrast: '#FFFFFF',
      background: '#FAFAF9',       // Pure Ashoka ivory-white
      surface: '#FFFFFF',
      text: '#1A202C',             // Refined deep slate
      textSecondary: '#4A5568',    // Cool stone
      accent: '#06038D',           // Ashoka Chakra navy
      header: '#FFFFFF',           // Clean Tiranga white
      headerText: '#1A202C',
      footer: '#04321B',           // Regal deep India green
      footerText: '#FAFAF9',
      border: '#E2E8F0',
    },
  },
];

/* ---------------- HEX COLOR UTILITIES & VALIDATION ---------------- */

const HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * Validates whether a given string is a valid 3-digit or 6-digit HEX color code
 */
export function isValidHex(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  return HEX_REGEX.test(hex.trim());
}

/**
 * Normalizes 3-character hex (#RGB) to 6-character hex (#RRGGBB)
 */
export function normalizeHex(hex: string): string {
  if (!hex) return '#000000';
  const clean = hex.trim().toUpperCase();
  if (clean.length === 4 && clean.startsWith('#')) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean.startsWith('#') ? clean : `#${clean}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHex(hex)) return null;
  const fullHex = normalizeHex(hex);
  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Calculate relative luminance according to WCAG 2.1
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  if (!isValidHex(hex1) || !isValidHex(hex2)) return 1;
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Returns either high-contrast pure white (#FFFFFF) or charcoal dark (#1A202C)
 * to guarantee readable text on top of the given background hex color.
 */
export function getContrastTextColor(bgHex: string): string {
  if (!isValidHex(bgHex)) return '#FFFFFF';
  const whiteRatio = getContrastRatio(bgHex, '#FFFFFF');
  const darkRatio = getContrastRatio(bgHex, '#1A202C');
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#1A202C';
}

/* ---------------- DOM THEME & LIQUID GLASS APPLICATION ---------------- */

/**
 * Applies Apple Liquid Glass opacity (0.10 to 0.95) and blur (8px to 44px)
 * directly to the root CSS custom properties for instant 60fps updates.
 */
export function applyGlassVariablesToDom(glassOpacity?: number, glassBlur?: number): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const rawOpacity = typeof glassOpacity === 'number' && !isNaN(glassOpacity)
    ? glassOpacity
    : DEFAULT_GLASS_OPACITY;
  const opacity = Math.min(0.95, Math.max(0.10, Number(rawOpacity.toFixed(2))));

  const rawBlur = typeof glassBlur === 'number' && !isNaN(glassBlur)
    ? glassBlur
    : DEFAULT_GLASS_BLUR;
  const blur = Math.min(48, Math.max(6, Math.round(rawBlur)));

  const opacityHigh = Math.min(0.97, Number((opacity + 0.13).toFixed(2)));
  const opacityLow = Math.max(0.06, Number((opacity - 0.13).toFixed(2)));
  const cardOpacity = Math.max(0.08, Number((opacity * 0.92).toFixed(2)));
  const borderOpacity = Math.min(0.98, Math.max(0.48, Number((opacity + 0.38).toFixed(2))));

  root.style.setProperty('--glass-opacity', String(opacity));
  root.style.setProperty('--glass-opacity-high', String(opacityHigh));
  root.style.setProperty('--glass-opacity-low', String(opacityLow));
  root.style.setProperty('--glass-card-opacity', String(cardOpacity));
  root.style.setProperty('--glass-border-opacity', String(borderOpacity));
  root.style.setProperty('--glass-blur', `${blur}px`);
}

/**
 * Applies the given theme colors and Liquid Glass settings to the document's root CSS custom variables.
 * This updates all buttons, navbar, cards, texts, glass refraction, and accents immediately.
 */
export function applyThemeToDom(colors: ThemeColors, explicitGlassOpacity?: number, explicitGlassBlur?: number): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const primaryContrast = colors.primaryContrast || getContrastTextColor(colors.primary);
  const secondaryContrast = colors.secondaryContrast || getContrastTextColor(colors.secondary);
  const headerText = colors.headerText || getContrastTextColor(colors.header);
  const footerText = colors.footerText || getContrastTextColor(colors.footer);
  const border = colors.border || '#EAE2D5';

  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-contrast', primaryContrast);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-secondary-contrast', secondaryContrast);
  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-secondary', colors.textSecondary);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-header', colors.header);
  root.style.setProperty('--color-header-text', headerText);
  root.style.setProperty('--color-footer', colors.footer);
  root.style.setProperty('--color-footer-text', footerText);
  root.style.setProperty('--color-border', border);

  // Apply Apple Liquid Glass opacity & blur
  const glassOp = explicitGlassOpacity ?? colors.glassOpacity ?? DEFAULT_GLASS_OPACITY;
  const glassBl = explicitGlassBlur ?? colors.glassBlur ?? DEFAULT_GLASS_BLUR;
  applyGlassVariablesToDom(glassOp, glassBl);

  // Directly set body background & text to prevent any FOUC
  document.body.style.backgroundColor = colors.background;
  document.body.style.color = colors.text;
}

/* ---------------- STORAGE & PERSISTENCE KEYS ---------------- */

const PUBLISHED_THEME_KEY = 'cotton_nest_published_theme';
const DRAFT_THEME_KEY = 'cotton_nest_draft_theme';
const CUSTOM_PRESETS_KEY = 'cotton_nest_custom_theme_presets';

export function getStoredPublishedTheme(): WebsiteThemeConfig {
  try {
    const raw = localStorage.getItem(PUBLISHED_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.colors && isValidHex(parsed.colors.primary)) {
        // Automatically upgrade default 'classic' seed to the new Royal Luxury Atelier theme
        if (parsed.activeThemeId === 'classic') {
          return {
            activeThemeId: 'luxury',
            themeName: 'Royal Luxury Atelier',
            colors: ROYAL_LUXURY_ATELIER_COLORS,
            glassOpacity: DEFAULT_GLASS_OPACITY,
            glassBlur: DEFAULT_GLASS_BLUR,
            updatedAt: Date.now(),
          };
        }
        const glassOpacity = parsed.glassOpacity ?? parsed.colors.glassOpacity ?? DEFAULT_GLASS_OPACITY;
        const glassBlur = parsed.glassBlur ?? parsed.colors.glassBlur ?? DEFAULT_GLASS_BLUR;
        return {
          ...parsed,
          glassOpacity,
          glassBlur,
          colors: {
            ...parsed.colors,
            glassOpacity,
            glassBlur,
          },
        };
      }
    }
  } catch {}
  return {
    activeThemeId: 'luxury',
    themeName: 'Royal Luxury Atelier',
    colors: ROYAL_LUXURY_ATELIER_COLORS,
    glassOpacity: DEFAULT_GLASS_OPACITY,
    glassBlur: DEFAULT_GLASS_BLUR,
    updatedAt: Date.now(),
  };
}

export function saveStoredPublishedTheme(config: WebsiteThemeConfig): void {
  try {
    localStorage.setItem(PUBLISHED_THEME_KEY, JSON.stringify(config));
  } catch {}
}

export function getStoredDraftTheme(): ThemeColors | null {
  try {
    const raw = localStorage.getItem(DRAFT_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && isValidHex(parsed.primary)) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function saveStoredDraftTheme(colors: ThemeColors): void {
  try {
    localStorage.setItem(DRAFT_THEME_KEY, JSON.stringify(colors));
  } catch {}
}

export function clearStoredDraftTheme(): void {
  try {
    localStorage.removeItem(DRAFT_THEME_KEY);
  } catch {}
}

export function getStoredCustomPresets(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredCustomPreset(preset: ThemePreset): ThemePreset[] {
  try {
    const existing = getStoredCustomPresets();
    const updated = [preset, ...existing.filter((p) => p.id !== preset.id)];
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteStoredCustomPreset(presetId: string): ThemePreset[] {
  try {
    const existing = getStoredCustomPresets();
    const updated = existing.filter((p) => p.id !== presetId);
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
