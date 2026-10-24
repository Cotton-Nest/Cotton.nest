export const DEFAULT_SHEET_IMAGE = '/images/exact_sheet1_pink_rose_1790997736396.jpg';

export const PRODUCT_DEFAULT_IMAGES: Record<string, string> = {
  'gulabi-bagh-rose': '/images/exact_sheet1_pink_rose_1790997736396.jpg',
  'mint-meadow-sage': '/images/exact_sheet2_sage_mint_rose_1790997747019.jpg',
  'ivory-garland-wreath': '/images/exact_sheet3_cream_garland_1790997759822.jpg',
  'petals-print-marigold': '/images/exact_sheet4_petals_print_1790997771702.jpg',
  'shivaura-trellis-slate': '/images/exact_sheet5_shivaura_trellis_1790997781634.jpg',
  'milky-white-poppy': '/images/exact_sheet6_milky_white_poppy_1790997791650.jpg',
  'amber-orchid-medallion': '/images/exact_sheet7_amber_orchid_1790997801705.jpg',
  'peacock-teal-paisley': '/images/exact_sheet8_peacock_teal_1790997812944.jpg',
  'rosemary-blue-rose-100x108': '/images/exact_sheet9_rosemary_blue_rose_1791027541188.jpg',
  'bedsheet-mvg72tgo': '/images/exact_sheet1_pink_rose_1790997736396.jpg',
};

/**
 * Resolves any bedsheet image path to a valid, working URL or data URL.
 * Automatically recovers missing or dead /uploads/ paths to each product's specific catalog photography.
 */
export function resolveBedsheetImage(src?: string | null, productId?: string, updatedAt?: number): string {
  const fallback = (productId && PRODUCT_DEFAULT_IMAGES[productId]) || DEFAULT_SHEET_IMAGE;

  if (!src || typeof src !== 'string' || src.trim() === '') {
    return fallback;
  }

  const trimmed = src.trim();

  // Self-contained data URLs and remote URLs
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Discard dead temporary session uploads
  if (trimmed.includes('/uploads/sheet_') || trimmed.includes('uploads/sheet_')) {
    return fallback;
  }

  let finalUrl = trimmed;
  if (trimmed.startsWith('/uploads/')) {
    finalUrl = trimmed;
  } else if (trimmed.startsWith('uploads/')) {
    finalUrl = `/${trimmed}`;
  } else if (trimmed.startsWith('/src/assets/images/')) {
    finalUrl = trimmed.replace('/src/assets/images/', '/images/');
  } else if (trimmed.startsWith('images/')) {
    finalUrl = `/${trimmed}`;
  } else if (!trimmed.startsWith('/') && !trimmed.startsWith('http')) {
    finalUrl = `/images/${trimmed}`;
  }

  // If updatedAt timestamp is provided and it is a relative static asset, add cache buster query
  if (updatedAt && (finalUrl.startsWith('/uploads/') || finalUrl.startsWith('/photo/'))) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${separator}v=${updatedAt}`;
  }

  return finalUrl;
}

export function handleImageFallback(e: React.SyntheticEvent<HTMLImageElement, Event>, productId?: string) {
  const target = e.currentTarget;
  const fallback = (productId && PRODUCT_DEFAULT_IMAGES[productId]) || DEFAULT_SHEET_IMAGE;
  if (target.src !== fallback && !target.src.endsWith(fallback)) {
    target.src = fallback;
  }
}
