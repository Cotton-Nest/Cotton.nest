export interface BedsheetVariant {
  id: string;
  name: string;        // e.g. "Blush Rose", "Mint Sage", "Royal Navy"
  colorHex?: string;   // e.g. "#E8A598" for color swatch
  image: string;       // Image URL or uploaded data URL
}

export interface BedsheetProduct {
  id: string;
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
  tagline: "Pure Cotton Comfort, Everyday Elegance",
  phone: "+91 7838625915",
  rawPhone: "917838625915",
  address: "House Number 2508, Ground Floor, Sector 46, Gurgaon, Haryana",
  city: "Gurgaon, Haryana",
  pincode: "122003",
  whatsappUrl: (message?: string) => {
    const encoded = encodeURIComponent(
      message || "Hello Cotton Nest! I am interested in exploring your 100% cotton bedsheets collection."
    );
    return `https://wa.me/917838625915?text=${encoded}`;
  },
  callUrl: "tel:+917838625915",
  mapQuery: "House+Number+2508+Ground+Floor+Sector+46+Gurgaon+Haryana",
};

export const BEDSHEETS_CATALOG: BedsheetProduct[] = [
  {
    id: "gulabi-bagh-rose",
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
