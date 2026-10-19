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
  updatedAt: number;
  updatedBy?: string;
  version?: number;
}

// 1. Classic Cotton Nest (Original signature palette)
export const CLASSIC_COTTON_NEST_COLORS: ThemeColors = {
  primary: '#70252D',          // Signature Cotton Nest deep burgundy
  primaryContrast: '#FFFFFF',
  secondary: '#8C3A44',        // Warm rosewood
  secondaryContrast: '#FFFFFF',
  background: '#FAF7F2',       // Luminous warm cream
  surface: '#FFFFFF',          // Crisp pure white card surface
  text: '#2C2420',             // Deep espresso charcoal
  textSecondary: '#6B5D55',    // Refined warm taupe
  accent: '#C29E57',           // Muted artisan gold
  header: '#FAF7F2',           // Matching cream header
  headerText: '#2C2420',
  footer: '#2C2420',           // Deep espresso luxury footer
  footerText: '#FAF7F2',
  border: '#EAE2D5',
};

// 2. Festival Theme Presets (All 6 standard presets)
export const FESTIVAL_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    name: 'Classic Cotton Nest',
    description: 'Timeless signature palette with warm cream, deep burgundy and muted gold.',
    festivalTag: 'Signature',
    badge: 'Everyday Luxury',
    colors: CLASSIC_COTTON_NEST_COLORS,
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

/* ---------------- DOM THEME APPLICATION ---------------- */

/**
 * Applies the given theme colors to the document's root CSS custom variables.
 * This updates all buttons, navbar, cards, texts, and accents immediately.
 */
export function applyThemeToDom(colors: ThemeColors): void {
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
        return parsed;
      }
    }
  } catch {}
  return {
    activeThemeId: 'classic',
    themeName: 'Classic Cotton Nest',
    colors: CLASSIC_COTTON_NEST_COLORS,
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
