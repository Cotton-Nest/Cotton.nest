export interface BedsheetVariant {
  id: string;
  name: string;        // e.g. "Blush Rose", "Mint Sage", "Royal Navy"
  sku?: string;        // Optional variant SKU code
  colorHex?: string;   // e.g. "#E8A598" for color swatch
  image: string;       // Image URL or uploaded data URL
}

export interface BedsheetProduct {
  id: string;
  sku?: string;        // Product SKU code (e.g. CN-ROSE-108K)
  name: string;
  collection: string;
  price: number;
  originalPrice: number;
  dimensions: string;
  pillowCovers: string;
  threadCount: string;
  fabric: string;
  pattern: string;
  colorTone: string;
  description: string;
  image: string;
  additionalImages?: string[]; // Extra gallery/detail photos & videos of this bedsheet
  videos?: string[];           // Dedicated product video URLs (MP4, WebM, MOV, Cloudinary video reels)
  videoUrl?: string;           // Primary featured video URL if any
  variants?: BedsheetVariant[]; // Multiple color variants or extra photos of this bedsheet
  badge?: string;
  inStock: boolean;
  stockQuantity?: number;
  features: string[];
  order?: number;
  updatedAt?: number;
  cloudinaryPublicId?: string;
  size?: string;        // 'Single' | 'Double' | 'Queen' | 'King' | 'Super King' | custom size
  productType?: string; // 'Bedsheet' | 'Blanket' | 'Comforter' | custom type
  brand?: string;       // 'Cotton Nest' | 'Swayam' | 'Spaces' | etc. (Admin & Filter only, never shown on cards/details)
  availabilityType?: 'none' | 'atelier_touch' | 'on_order' | 'standard' | string; // 'none' (Blank) | 'atelier_touch' | 'on_order'
}

export type AvailabilityType = 'none' | 'atelier_touch';

export const AVAILABILITY_OPTIONS: { value: AvailabilityType; label: string; badgeText: string }[] = [
  {
    value: 'none',
    label: '— Blank (No Availability Tag) —',
    badgeText: '',
  },
  {
    value: 'atelier_touch',
    label: 'Available for Touch & Feel in Sector 46 Atelier',
    badgeText: 'Available at Sec 46 Atelier',
  },
];

export function normalizeAvailabilityType(raw?: string | null): AvailabilityType {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'atelier_touch') return 'atelier_touch';
  return 'none';
}

/**
 * Checks whether a product is currently out of stock (inStock === false or stockQuantity <= 0).
 */
export function isProductOutOfStock(product?: { inStock?: boolean; stockQuantity?: number }): boolean {
  if (!product) return false;
  return !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0);
}

/**
 * Sorts products so that In-Stock products always appear before Out-of-Stock products,
 * while maintaining their relative order within each group (In-Stock vs Out-of-Stock).
 */
export function sortProductsByStockAvailability<T extends { inStock?: boolean; stockQuantity?: number }>(
  productsList: T[],
  secondaryComparator?: (a: T, b: T) => number
): T[] {
  if (!Array.isArray(productsList) || productsList.length === 0) return [];

  return [...productsList].sort((a, b) => {
    const isOutA = isProductOutOfStock(a);
    const isOutB = isProductOutOfStock(b);

    if (isOutA !== isOutB) {
      return isOutA ? 1 : -1;
    }

    if (secondaryComparator) {
      return secondaryComparator(a, b);
    }

    return 0;
  });
}

/**
 * Parses and normalizes any custom product price (whole numbers or decimals up to 2 decimal places)
 * without rounding to the nearest ₹50 or nearest whole number.
 */
export function normalizeCustomPrice(val: any, fallback: number = 0): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || isNaN(val)) return fallback;
    return Math.max(0, Number(val.toFixed(2)));
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    const cleaned = trimmed.replace(/[^0-9.]/g, '');
    if (!cleaned) return fallback;
    const parts = cleaned.split('.');
    const normalizedStr = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
    const num = parseFloat(normalizedStr);
    if (!Number.isFinite(num) || isNaN(num)) return fallback;
    return Math.max(0, Number(num.toFixed(2)));
  }
  return fallback;
}

export const STANDARD_SIZES = ['Single', 'Double', 'Queen', 'King (100 × 108)', 'Super King (108 × 108)', 'Other'] as const;
export type StandardSize = (typeof STANDARD_SIZES)[number];

export const STANDARD_PRODUCT_TYPES = [
  'Bedsheet',
  'Winter Bedsheet',
  'Dohar',
  'Bed Cover',
  'Quilt',
  'Blanket',
  'Comforter',
  'Other',
] as const;
export type StandardProductType = (typeof STANDARD_PRODUCT_TYPES)[number];

/**
 * Normalizes a product category / type string to a canonical label
 * so singular/plural variations (e.g. "Winter Bedsheets" -> "Winter Bedsheet")
 * match consistently across Catalogue filters and Admin Panel.
 */
export function normalizeProductCategory(raw?: string): string {
  const val = String(raw || 'Bedsheet').trim();
  if (!val) return 'Bedsheet';
  const lower = val.toLowerCase().replace(/\s+/g, ' ');
  if (
    lower === 'winter bedsheet' ||
    lower === 'winter bedsheets' ||
    lower === 'winter sheet' ||
    lower === 'winter sheets' ||
    lower.includes('winter bedsheet') ||
    lower.includes('winter sheet') ||
    lower.includes('flannel')
  ) {
    return 'Winter Bedsheet';
  }
  if (lower === 'bedsheet' || lower === 'bedsheets') return 'Bedsheet';
  if (lower === 'dohar' || lower === 'dohars' || lower.includes('dohar')) return 'Dohar';
  if (
    lower === 'bed cover' ||
    lower === 'bed covers' ||
    lower === 'bedcover' ||
    lower === 'bedcovers' ||
    lower.includes('bed cover') ||
    lower.includes('bedcover') ||
    lower.includes('bedspread')
  ) {
    return 'Bed Cover';
  }
  if (lower === 'quilt' || lower === 'quilts' || lower === 'razai' || lower.includes('quilt') || lower.includes('razai')) {
    return 'Quilt';
  }
  if (lower === 'blanket' || lower === 'blankets' || lower.includes('blanket')) return 'Blanket';
  if (lower === 'comforter' || lower === 'comforters' || lower.includes('comforter')) return 'Comforter';
  return val;
}

/**
 * Checks whether a product's type matches a selected filter category.
 */
export function matchesProductCategory(productType: string | undefined, selectedType: string): boolean {
  if (!selectedType || selectedType.toLowerCase() === 'all') return true;
  return normalizeProductCategory(productType).toLowerCase() === normalizeProductCategory(selectedType).toLowerCase();
}

/**
 * Authoritative category matcher used by both CatalogueView and AdminPanel
 * so product counts and filter results stay 100% synchronized.
 */
export function doesProductMatchCategory(product: BedsheetProduct | null | undefined, selectedCategory: string): boolean {
  if (!product) return false;
  if (!selectedCategory || selectedCategory.toLowerCase() === 'all') return true;

  const normSelected = normalizeProductCategory(selectedCategory).toLowerCase();
  const normProductType = normalizeProductCategory(product.productType).toLowerCase();

  if (normProductType === normSelected) {
    return true;
  }

  const nameAndColl = `${product.name || ''} ${product.collection || ''}`.toLowerCase();
  if (normSelected === 'winter bedsheet') {
    return nameAndColl.includes('winter bedsheet') || nameAndColl.includes('winter sheet') || nameAndColl.includes('flannel bedsheet') || nameAndColl.includes('warm bedsheet');
  }
  if (normSelected === 'dohar') {
    return nameAndColl.includes('dohar');
  }
  if (normSelected === 'bed cover') {
    return nameAndColl.includes('bed cover') || nameAndColl.includes('bedcover') || nameAndColl.includes('bedspread');
  }
  if (normSelected === 'quilt') {
    return nameAndColl.includes('quilt') || nameAndColl.includes('razai');
  }
  if (normSelected === 'comforter') {
    return nameAndColl.includes('comforter');
  }
  if (normSelected === 'blanket') {
    return nameAndColl.includes('blanket');
  }
  return false;
}

export const POPULAR_BRANDS = [
  'Cotton Nest',
  'Swayam',
  'Spaces',
  'Bombay Dyeing',
  'Portico New York',
  'Trident',
  'Raymond Home',
  'Bella Casa',
] as const;

export const COMPANY_DETAILS = {
  name: "Cotton Nest",
  studioName: "Cotton Nest Bedding Studio",
  tagline: "Pure Cotton Comfort, Everyday Elegance",
  phone: "+91 7838625915",
  rawPhone: "917838625915",
  address: "Cotton Nest Bedding Studio, Sector 46, Gurgaon, Haryana – 122003",
  streetAddress: "Sector 46, Gurgaon, Haryana – 122003",
  city: "Gurgaon, Haryana",
  pincode: "122003",
  whatsappUrl: (message?: string) => {
    const encoded = encodeURIComponent(
      message || "Hello Cotton Nest! I am interested in exploring your 100% cotton bedsheets collection."
    );
    return `https://wa.me/917838625915?text=${encoded}`;
  },
  callUrl: "tel:+917838625915",
};

/* ---------------- UNIQUE SKU MANAGEMENT & DEDUPLICATION SYSTEM ---------------- */

export const HISTORICAL_SKU_STORAGE_KEY = 'cotton_nest_historical_skus_v1';
const inMemoryHistoricalSkus = new Set<string>();

/**
 * Normalizes a SKU string to uppercase trimmed format without leading '#'.
 */
export function normalizeSkuCode(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^#+/, '').trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Generates the base Cotton Nest SKU code from a product name (and optional variant name)
 * following the existing Cotton Nest SKU naming convention (e.g. CN-POPPY-108K).
 */
export function getBaseProductSkuFromName(productName: string, variantName?: string): string {
  const safeName = String(productName || '').trim();
  const pCode = safeName.toLowerCase();
  let base = 'CN-BS';

  if (
    pCode.includes('gulabi') ||
    (pCode.includes('rose') && !pCode.includes('sage') && !pCode.includes('rosemary') && !pCode.includes('blue'))
  ) {
    base = 'CN-ROSE';
  } else if (pCode.includes('dohar') || pCode.includes('jaipuri')) {
    base = 'CN-DOHAR';
  } else if (pCode.includes('comforter') || pCode.includes('cloud-soft')) {
    base = 'CN-COMFORTER';
  } else if (pCode.includes('sage') || pCode.includes('meadow')) {
    base = 'CN-SAGE';
  } else if (pCode.includes('garland') || pCode.includes('cream')) {
    base = 'CN-GARLAND';
  } else if (pCode.includes('petal') || pCode.includes('botanical')) {
    base = 'CN-PETALS';
  } else if (pCode.includes('shivaura') || pCode.includes('trellis')) {
    base = 'CN-TRELLIS';
  } else if (pCode.includes('poppy') || pCode.includes('milky')) {
    base = 'CN-POPPY';
  } else if (pCode.includes('amber') || pCode.includes('orchid')) {
    base = 'CN-ORCHID';
  } else if (pCode.includes('peacock') || pCode.includes('teal')) {
    base = 'CN-PEACOCK';
  } else if (pCode.includes('sapphire') || pCode.includes('blue') || pCode.includes('rosemary')) {
    base = 'CN-BLUE-ROSE';
  } else {
    const cleanWord = safeName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    if (cleanWord) {
      base = `CN-${cleanWord}`;
    }
  }

  const vCode = variantName
    ? `-${variantName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()}`
    : '';

  return `${base}${vCode}-108K`;
}

/**
 * Strips any existing trailing 3+ digit sequential suffix (e.g. -001, -002) from a SKU
 * so sequential suffixes are cleanly appended to the root SKU.
 */
export function stripSequentialSkuSuffix(sku: string): string {
  const norm = normalizeSkuCode(sku);
  return norm.replace(/-\d{3,}$/, '');
}

/**
 * Formats a sequential SKU with a 3-digit zero-padded suffix (e.g. CN-POPPY-108K-001).
 */
export function formatSequentialSku(baseSku: string, sequenceNumber: number): string {
  const root = stripSequentialSkuSuffix(baseSku) || 'CN-BS-108K';
  const padded = String(Math.max(1, Math.floor(sequenceNumber))).padStart(3, '0');
  return `${root}-${padded}`;
}

/**
 * Loads the set of all historically assigned SKUs so no previously assigned SKU is ever reused.
 */
export function getHistoricallyAssignedSkus(): Set<string> {
  const set = new Set<string>(inMemoryHistoricalSkus);
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(HISTORICAL_SKU_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s) => {
            const norm = normalizeSkuCode(s);
            if (norm) {
              set.add(norm);
              inMemoryHistoricalSkus.add(norm);
            }
          });
        }
      }
    } catch {}
  }
  return set;
}

/**
 * Persists newly assigned SKUs to the historical SKU registry so they are never reused.
 */
export function recordHistoricallyAssignedSkus(skus: Iterable<string>): void {
  for (const s of skus) {
    const norm = normalizeSkuCode(s);
    if (norm) inMemoryHistoricalSkus.add(norm);
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const current = getHistoricallyAssignedSkus();
      for (const s of skus) {
        const norm = normalizeSkuCode(s);
        if (norm) current.add(norm);
      }
      window.localStorage.setItem(HISTORICAL_SKU_STORAGE_KEY, JSON.stringify(Array.from(current)));
    } catch {}
  }
}

/**
 * Scans an entire product collection, identifies missing or duplicate SKUs, keeps the original SKU
 * for the first product, and assigns new sequential unique SKUs (-001, -002, -003, ...) to remaining
 * products with duplicate SKUs.
 *
 * Does NOT delete or merge products and does NOT modify product names, images, prices, descriptions,
 * variants, or stock quantities.
 */
export function auditAndEnsureUniqueProductSkus(
  products: BedsheetProduct[],
  historicalSkus?: Iterable<string>
): {
  products: BedsheetProduct[];
  changedProducts: BedsheetProduct[];
  allAssignedSkus: string[];
} {
  if (!Array.isArray(products) || products.length === 0) {
    return { products: [], changedProducts: [], allAssignedSkus: [] };
  }

  const historicalSet = getHistoricallyAssignedSkus();
  if (historicalSkus) {
    for (const s of historicalSkus) {
      const norm = normalizeSkuCode(s);
      if (norm) historicalSet.add(norm);
    }
  }

  const assignedInCatalog = new Set<string>();
  const changedProducts: BedsheetProduct[] = [];

  // Pass 1: Lock the first occurrence of any product that already has an explicit non-empty SKU
  const firstExplicitHolderIndex = new Set<number>();
  products.forEach((p, idx) => {
    if (!p) return;
    const explicit = normalizeSkuCode(p.sku);
    if (explicit && !assignedInCatalog.has(explicit)) {
      assignedInCatalog.add(explicit);
      firstExplicitHolderIndex.add(idx);
    }
  });

  // Pass 2: Assign or deduplicate SKUs while keeping the original SKU for the first product
  const updatedProducts = products.map((p, idx) => {
    if (!p) return p;
    const currentExplicit = normalizeSkuCode(p.sku);

    // If this product already holds a unique explicit SKU from Pass 1, preserve it untouched
    if (firstExplicitHolderIndex.has(idx) && currentExplicit) {
      if (p.sku === currentExplicit) {
        return p;
      }
      const normalizedProd: BedsheetProduct = { ...p, sku: currentExplicit };
      changedProducts.push(normalizedProd);
      return normalizedProd;
    }

    // Determine candidate original SKU
    const baseSku = currentExplicit || getBaseProductSkuFromName(p.name || p.id || 'Bedsheet');
    let assignedSku = '';

    // Keep the original SKU for the first product if not yet assigned in the catalog
    if (!assignedInCatalog.has(baseSku)) {
      assignedSku = baseSku;
    } else {
      // Duplicate SKU detected: generate sequential SKU (-001, -002, -003, ...)
      const rootSku = stripSequentialSkuSuffix(baseSku);
      let seq = 1;
      let candidate = formatSequentialSku(rootSku, seq);
      while (assignedInCatalog.has(candidate) || historicalSet.has(candidate)) {
        seq++;
        candidate = formatSequentialSku(rootSku, seq);
      }
      assignedSku = candidate;
    }

    assignedInCatalog.add(assignedSku);
    historicalSet.add(assignedSku);

    if (p.sku === assignedSku) {
      return p;
    }

    const updatedProd: BedsheetProduct = {
      ...p,
      sku: assignedSku,
    };
    changedProducts.push(updatedProd);
    return updatedProd;
  });

  const allAssignedSkus = Array.from(assignedInCatalog);
  recordHistoricallyAssignedSkus(allAssignedSkus);

  return {
    products: updatedProducts,
    changedProducts,
    allAssignedSkus,
  };
}

/**
 * Generates a guaranteed-unique SKU for a newly added product by checking the entire existing
 * product database and all previously assigned historical SKUs.
 */
export function generateUniqueProductSku(
  productName: string,
  existingProducts: Array<{ id?: string; sku?: string; name?: string }> = [],
  historicalSkus?: Iterable<string>
): string {
  const unavailableSkus = getHistoricallyAssignedSkus();
  if (historicalSkus) {
    for (const s of historicalSkus) {
      const norm = normalizeSkuCode(s);
      if (norm) unavailableSkus.add(norm);
    }
  }

  for (const p of existingProducts) {
    if (!p) continue;
    const explicit = normalizeSkuCode(p.sku);
    if (explicit) {
      unavailableSkus.add(explicit);
    } else if (p.name || p.id) {
      unavailableSkus.add(getBaseProductSkuFromName(p.name || p.id || 'Bedsheet'));
    }
  }

  const baseSku = getBaseProductSkuFromName(productName || 'Bedsheet');
  const rootSku = stripSequentialSkuSuffix(baseSku);

  // Check if rootSku or any sequential variant of rootSku already exists
  let hasRootOrSequentialCollision = unavailableSkus.has(baseSku) || unavailableSkus.has(rootSku);
  if (!hasRootOrSequentialCollision) {
    for (const existing of unavailableSkus) {
      if (stripSequentialSkuSuffix(existing) === rootSku) {
        hasRootOrSequentialCollision = true;
        break;
      }
    }
  }

  let assigned = baseSku;
  if (hasRootOrSequentialCollision) {
    let seq = 1;
    let candidate = formatSequentialSku(rootSku, seq);
    while (unavailableSkus.has(candidate)) {
      seq++;
      candidate = formatSequentialSku(rootSku, seq);
    }
    assigned = candidate;
  }

  recordHistoricallyAssignedSkus([assigned]);
  return assigned;
}

export const BEDSHEETS_CATALOG: BedsheetProduct[] = [
  {
    id: "gulabi-bagh-rose",
    sku: "CN-ROSE-108K",
    name: "Nandini Gulabi Bagh Rose",
    collection: "Floral Heritage",
    size: "King",
    productType: "Bedsheet",
    brand: "Cotton Nest",
    price: 1320,
    originalPrice: 1320,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "300 Thread Count",
    fabric: "100% Pure Glace Percale Cotton",
    pattern: "Vintage Rose Floral",
    colorTone: "Blush Pink & Ivory Cream",
    description: "Classic English vintage rose bouquets bloomed across pristine ivory cotton, styled with signature dusty rose piped pillow shams and matching accent runner.",
    image: "/images/exact_sheet1_pink_rose_1790997736396.jpg",
    badge: "Best Seller",
    inStock: true,
    variants: [
      {
        id: "var-rose-blush",
        name: "Blush English Rose",
        colorHex: "#E8A598",
        image: "/images/exact_sheet1_pink_rose_1790997736396.jpg"
      },
      {
        id: "var-rose-sage",
        name: "Pastel Sage Rose",
        colorHex: "#9BB29B",
        image: "/images/exact_sheet2_sage_mint_rose_1790997747019.jpg"
      },
      {
        id: "var-rose-blue",
        name: "Royal Sapphire Rose",
        colorHex: "#4E6B8A",
        image: "/images/exact_sheet9_rosemary_blue_rose_1791027541188.jpg"
      }
    ],
    features: [
      "Extra Large King 108x108 inch tuck-in drop",
      "Includes 2 matching piped pillow shams",
      "Breathable, cool against the skin",
      "Color-fast reactive dye print"
    ]
  },
  {
    id: "mint-meadow-sage",
    sku: "CN-SAGE-108K",
    name: "Nandini Pastel Sage Rose",
    collection: "Botanical Serenity",
    size: "King",
    productType: "Bedsheet",
    brand: "Cotton Nest",
    price: 1360,
    originalPrice: 1360,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "350 Thread Count",
    fabric: "100% Long-Staple Cotton",
    pattern: "Soft Sage Botanicals",
    colorTone: "Pastel Sage, Mint & Coral Pink",
    description: "Serene pastel seafoam sage backdrop layered with blushing pink, crimson, and golden tea roses, framed with tailored sage striped pillow borders.",
    image: "/images/exact_sheet2_sage_mint_rose_1790997747019.jpg",
    badge: "Customer Favorite",
    inStock: true,
    variants: [
      {
        id: "var-sage-base",
        name: "Pastel Sage & Coral",
        colorHex: "#9BB29B",
        image: "/images/exact_sheet2_sage_mint_rose_1790997747019.jpg"
      },
      {
        id: "var-sage-ivory",
        name: "Ivory Garland Wreath",
        colorHex: "#DFD3C3",
        image: "/images/exact_sheet3_cream_garland_1790997759822.jpg"
      }
    ],
    features: [
      "Subtle matte sateen finish for silk-like drape",
      "Anti-pilling combed cotton weave",
      "Generous side drape for deep mattresses",
      "Oeko-Tex skin friendly certified"
    ]
  },
  {
    id: "ivory-garland-wreath",
    sku: "CN-GARLAND-108K",
    name: "Nandini Ivory Garland",
    collection: "Royal Heritage",
    size: "King",
    productType: "Bedsheet",
    brand: "Swayam",
    price: 1320,
    originalPrice: 1320,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "300 Thread Count",
    fabric: "100% Pure Natural Cotton",
    pattern: "Circular Floral Wreath",
    colorTone: "Warm Cream, Soft Gold & Dusty Pink",
    description: "Ornate circular garland medallions woven with antique pink roses and gentle gold-apricot blossoms over a calming fine pinstripe cream texture.",
    image: "/images/exact_sheet3_cream_garland_1790997759822.jpg",
    badge: "Timeless Classic",
    inStock: true,
    features: [
      "Traditional garland symmetry brings calm energy",
      "Softens with every domestic machine wash",
      "Dual pillow covers with secure flap closure",
      "High breathability for Indian summers"
    ]
  },
  {
    id: "petals-print-marigold",
    sku: "CN-PETALS-108K",
    name: "The Petals Print Golden Sprig",
    collection: "The Petals Print",
    size: "King",
    productType: "Bedsheet",
    brand: "Spaces",
    price: 1220,
    originalPrice: 1220,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "400 Thread Count",
    fabric: "100% Luxury Percale Cotton",
    pattern: "Golden Botanical Vines",
    colorTone: "Crisp White & Muted Ochre Gold",
    description: "Minimalist luxury with cheerful golden-yellow marigold flowerheads creeping along warm dove-gray sprigs, with signature zoom callout inlay.",
    image: "/images/exact_sheet4_petals_print_1790997771702.jpg",
    badge: "The Petals Print",
    inStock: true,
    features: [
      "Crisp, cool percale feel with no synthetic sheen",
      "High thread count tight weave prevents sagging",
      "Tailored 108x108 inch size prevents bed un-tucking",
      "Gentle warm gold highlights"
    ]
  },
  {
    id: "shivaura-trellis-slate",
    sku: "CN-TRELLIS-108K",
    name: "Shivaura Chevron Trellis",
    collection: "Shivaura Collection",
    size: "Super King",
    productType: "Bedsheet",
    brand: "Bombay Dyeing",
    price: 1220,
    originalPrice: 1220,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "400 Thread Count",
    fabric: "100% Premium Egyptian Combed Cotton",
    pattern: "Chevron Trellis & Floral",
    colorTone: "Champagne Gold & Slate Grey",
    description: "Refined geometric chevron trellis drawn in delicate non-shiny golden lines, harmonized with misty slate floral bouquets and Shivaura luxury hallmark.",
    image: "/images/exact_sheet5_shivaura_trellis_1790997781634.jpg",
    badge: "Shivaura Edition",
    inStock: true,
    features: [
      "Subtle matte metallic golden linework",
      "Premium heavyweight pure cotton weave",
      "Contemporary geometric-floral balance",
      "Wrinkle-resistant natural finish"
    ]
  },
  {
    id: "milky-white-poppy",
    sku: "CN-POPPY-108K",
    name: "Milky White Poppy Meadow",
    collection: "Inspired By Nature",
    size: "Queen",
    productType: "Bedsheet",
    brand: "Portico New York",
    price: 1200,
    originalPrice: 1200,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "300 Thread Count",
    fabric: "100% Pure Organic Cotton",
    pattern: "Poppy Meadow & Grid",
    colorTone: "Milky White, Burnt Orange & Sage Green",
    description: "Milky white structured micro-grid background highlighted with hand-sketched orange poppy flowers, flanked by sage green checkered pillow shams (108x108).",
    image: "/images/exact_sheet6_milky_white_poppy_1790997791650.jpg",
    badge: "Milky White 108x108",
    inStock: true,
    features: [
      "Earthy botanical aesthetics for conscious homes",
      "Authentic block-print inspired poppy stems",
      "Coordinating sage checkered pillowcases included",
      "Soft pre-washed hand feel"
    ]
  },
  {
    id: "amber-orchid-medallion",
    sku: "CN-ORCHID-108K",
    name: "Heritage Amber Orchid",
    collection: "108x108 Classic",
    size: "Double",
    productType: "Bedsheet",
    brand: "Trident",
    price: 1000,
    originalPrice: 1000,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "300 Thread Count",
    fabric: "100% Glace Finish Cotton",
    pattern: "Centerpiece Bouquet",
    colorTone: "Ivory, Warm Amber Gold & Ash Grey",
    description: "Original 108x108 pack with commanding artistic centerpiece bouquet of golden amber orchids and soft silver foliage, enclosed with trailing vine borders.",
    image: "/images/exact_sheet7_amber_orchid_1790997801705.jpg",
    badge: "108x108 Label Pack",
    inStock: true,
    features: [
      "Symmetrical focal placement on king size beds",
      "Includes 2 printed matching pillowcovers (45x70 cm)",
      "Zero polyester, 100% breathable pure cotton",
      "Easy wash and iron friendly"
    ]
  },
  {
    id: "peacock-teal-paisley",
    sku: "CN-PEACOCK-108K",
    name: "Batik Royal Peacock Teal",
    collection: "Artisanal Block",
    size: "King",
    productType: "Bedsheet",
    brand: "Cotton Nest",
    price: 1050,
    originalPrice: 1050,
    dimensions: "108 x 108 inches (274 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "350 Thread Count",
    fabric: "100% Sanganeri Weave Cotton",
    pattern: "Royal Paisley Jaal",
    colorTone: "Peacock Blue & Natural Cream",
    description: "Deep regal peacock teal hand-block motif bedsheet framed with traditional intricate paisley daaman border and repeating floral bootis.",
    image: "/images/exact_sheet8_peacock_teal_1790997812944.jpg",
    badge: "Heritage Paisley",
    inStock: true,
    features: [
      "Traditional Indian block print jaal border",
      "Rich indigo-teal palette stays vibrant after wash",
      "Heavyweight drape stays tucked on high mattresses",
      "Breathable comfort for all four seasons"
    ]
  },
  {
    id: "rosemary-blue-rose-100x108",
    sku: "CN-BLUE-ROSE-108K",
    name: "Rosemary Royal Blue Rose",
    collection: "Rosemary Collection",
    size: "Queen",
    productType: "Bedsheet",
    brand: "Raymond Home",
    price: 1100,
    originalPrice: 1100,
    dimensions: "100 x 108 inches (254 x 274 cm)",
    pillowCovers: "2 Pillow Covers (45 x 70 cm)",
    threadCount: "350 Thread Count",
    fabric: "100% Pure Percale Cotton",
    pattern: "Cobalt Blue Rose Print",
    colorTone: "Crisp White & Royal Blue",
    description: "Pristine white cotton canvas richly patterned with deep cobalt and royal blue blooming roses on leafy vines, paired with blue checkered gingham flanged pillow covers (100x108).",
    image: "/images/exact_sheet9_rosemary_blue_rose_1791027541188.jpg",
    badge: "Rosemary 100x108",
    inStock: true,
    features: [
      "Signature Rosemary 100x108 inch King proportion",
      "Includes 2 matching blue gingham checkered pillow shams",
      "Vibrant fade-resistant cobalt blue reactive print",
      "100% breathable natural cotton for summer cooling"
    ]
  },
  {
    id: "jaipuri-cotton-dohar-blanket",
    sku: "CN-DOHAR-108K",
    name: "Jaipuri Artisanal Cotton Dohar Blanket",
    collection: "Heritage Dohar",
    size: "Double",
    productType: "Blanket",
    brand: "Cotton Nest",
    price: 1450,
    originalPrice: 1850,
    dimensions: "90 x 100 inches (228 x 254 cm)",
    pillowCovers: "2 Coordinating Shams (45 x 70 cm)",
    threadCount: "300 Thread Count",
    fabric: "Triple-Layer Pure Mulmul Cotton",
    pattern: "Traditional Hand-Block Floral",
    colorTone: "Ivory, Dusty Rose & Sage",
    description: "Ultra-soft 3-layer pure Indian cotton mulmul dohar blanket with light flannel middle layer for pleasant AC cooling and mild winter comfort.",
    image: "/images/exact_sheet2_sage_mint_rose_1790997747019.jpg",
    badge: "All-Season Dohar",
    inStock: true,
    features: [
      "Triple layered breathable fine mulmul cotton",
      "Lightweight temperature-regulating core",
      "Gentle against sensitive skin, easy machine wash",
      "Generous double bed tuck-in drape"
    ]
  },
  {
    id: "cloud-soft-cotton-comforter",
    sku: "CN-COMFORTER-108K",
    name: "Cloud-Soft All-Season Comforter",
    collection: "Comfort Atelier",
    size: "King",
    productType: "Comforter",
    brand: "Spaces",
    price: 2199,
    originalPrice: 2899,
    dimensions: "100 x 108 inches (254 x 274 cm)",
    pillowCovers: "2 Flanged Pillow Shams (45 x 70 cm)",
    threadCount: "350 Thread Count",
    fabric: "100% Cotton Outer Shell with Cloud-Fill",
    pattern: "Box-Stitched Reversible",
    colorTone: "Blush Pink & Misty Grey",
    description: "Reversible box-stitched all-weather luxury comforter with 100% natural cotton shell and hypoallergenic micro-down fill for blissful Indian bedroom nights.",
    image: "/images/exact_sheet1_pink_rose_1790997736396.jpg",
    badge: "Luxury Comforter",
    inStock: true,
    features: [
      "Hypoallergenic 250 GSM micro-down filling",
      "100% breathable percale cotton exterior shell",
      "Diamond box quilting prevents fill shifting",
      "Corner loops for duvet cover attachment"
    ]
  }
];
