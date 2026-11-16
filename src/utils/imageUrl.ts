import type React from 'react';

export const DEFAULT_SHEET_IMAGE = '/images/exact_sheet1_pink_rose_1790997736396.jpg';

export const CLOUDINARY_LOGO_PUBLIC_PATH = 'logo-removebg-preview.png';
export const CLOUDINARY_CLOUD_BASE = 'https://res.cloudinary.com/ys2sgydi/image/upload';

export const STORY_ATELIER_SEAL_JPG = '/images/atelier-seal-128.jpg';
export const STORY_ATELIER_SEAL_WEBP = '/images/atelier-seal-128.webp';

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
 * Returns an optimised Cloudinary logo URL sized accurately for navbar/footer/invoice badges
 * while preserving full alpha transparency via f_auto,q_auto,c_limit,w_{width}.
 */
export function getCloudinaryLogoUrl(width: number = 128): string {
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 128;
  return `${CLOUDINARY_CLOUD_BASE}/f_auto,q_auto,c_limit,w_${safeWidth}/${CLOUDINARY_LOGO_PUBLIC_PATH}`;
}

/**
 * Responsive srcset for the Cotton Nest transparent logo (64w & 128w).
 */
export function getCloudinaryLogoSrcSet(): string {
  return `${getCloudinaryLogoUrl(64)} 64w, ${getCloudinaryLogoUrl(128)} 128w`;
}

/**
 * Checks whether a URL is a Cloudinary /image/upload/ URL eligible for delivery transformations.
 * Explicitly skips video, raw assets, and non-Cloudinary URLs.
 */
export function isCloudinaryImageUploadUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(url.trim());
}

/**
 * Injects Cloudinary automatic format/quality and width constraint (f_auto,q_auto,c_limit,w_...)
 * at render time without mutating stored Firestore product URLs.
 */
export function optimizeCloudinaryImageUrl(url: string, width: number = 650): string {
  if (!isCloudinaryImageUploadUrl(url)) return url;

  const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 650;
  const trimmed = url.trim();
  const marker = '/image/upload/';
  const idx = trimmed.toLowerCase().indexOf(marker);
  if (idx === -1) return trimmed;

  const prefix = trimmed.slice(0, idx + marker.length);
  const rest = trimmed.slice(idx + marker.length);
  const segments = rest.split('/');

  // Preserve custom transforms (other than f_auto / q_auto / c_limit / w_*) and keep v123/folder/file intact
  const cleanedSegments: string[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    // Stop inspecting once we hit version (v123456) or likely public path with extension
    if (/^v\d+$/i.test(seg) || seg.includes('.')) {
      break;
    }

    // Check if segment looks like a Cloudinary transformation list (comma-separated tokens or f_/q_/c_/w_)
    const isTransformSeg = seg
      .split(',')
      .every((token) => /^(f_|q_|c_|w_|h_|dpr_|g_|ar_|e_|fl_|b_|bo_|r_|t_)/i.test(token));

    if (!isTransformSeg) {
      break;
    }

    const retainedTokens = seg
      .split(',')
      .filter((t) => !/^(f_auto|q_auto|c_limit|w_\d+)$/i.test(t.trim()));

    if (retainedTokens.length > 0) {
      cleanedSegments.push(retainedTokens.join(','));
    }
    i += 1;
  }

  const remainingPath = segments.slice(i).join('/');
  const optimizationTransform = `f_auto,q_auto,c_limit,w_${safeWidth}`;
  const allSegments = [optimizationTransform, ...cleanedSegments, remainingPath].filter(Boolean);
  return `${prefix}${allSegments.join('/')}`;
}

/**
 * Generates responsive srcset strings for Cloudinary-hosted images.
 */
export function getCloudinarySrcSet(
  url?: string | null,
  widths: number[] = [400, 650, 960]
): string | undefined {
  if (!url || !isCloudinaryImageUploadUrl(url)) return undefined;
  const validWidths = widths.filter((w) => Number.isFinite(w) && w > 0);
  if (validWidths.length === 0) return undefined;
  return validWidths.map((w) => `${optimizeCloudinaryImageUrl(url, w)} ${Math.round(w)}w`).join(', ');
}

export interface LocalImageVariantSet {
  isKnownLocalAsset: boolean;
  webpSrcSet?: string;
  webpPrimary?: string;
  fallbackSrc: string;
}

/**
 * Normalizes a local /images/... path (stripping optional https://cottonnest.in origin and ?query/#hash).
 */
export function normalizeLocalImagePath(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\/(?:www\.)?cottonnest\.in(\/images\/.+)$/i.test(trimmed)) {
    const match = trimmed.match(/^https?:\/\/(?:www\.)?cottonnest\.in(\/images\/[^?#]+)/i);
    return match ? match[1] : trimmed;
  }
  if (trimmed.startsWith('/images/')) {
    return trimmed.split(/[?#]/)[0];
  }
  return trimmed;
}

/**
 * Maps known Cotton Nest local /images/*.jpg or *.webp assets to their responsive WebP srcsets
 * while retaining their clean .jpg fallback URLs.
 */
export function getLocalImageVariants(url?: string | null): LocalImageVariantSet {
  if (!url || typeof url !== 'string') {
    return { isKnownLocalAsset: false, fallbackSrc: DEFAULT_SHEET_IMAGE };
  }

  const normalized = normalizeLocalImagePath(url);

  // Known Hero banner image (1376x768 full, plus 480w and 768w WebP variants)
  if (/^\/images\/hero_cotton_nest_bedding_[^/]+\.(jpg|jpeg|webp)$/i.test(normalized)) {
    const base = normalized.replace(/\.(jpg|jpeg|webp)$/i, '');
    return {
      isKnownLocalAsset: true,
      webpSrcSet: `${base}-480w.webp 480w, ${base}-768w.webp 768w, ${base}.webp 1376w`,
      webpPrimary: `${base}.webp`,
      fallbackSrc: `${base}.jpg`,
    };
  }

  // Known catalog sheets exact_sheet1..9 (1200x896 full, plus 480w and 768w WebP variants)
  if (/^\/images\/exact_sheet[^/]+\.(jpg|jpeg|webp)$/i.test(normalized)) {
    const base = normalized.replace(/\.(jpg|jpeg|webp)$/i, '');
    return {
      isKnownLocalAsset: true,
      webpSrcSet: `${base}-480w.webp 480w, ${base}-768w.webp 768w, ${base}.webp 1200w`,
      webpPrimary: `${base}.webp`,
      fallbackSrc: `${base}.jpg`,
    };
  }

  // Known prebuilt banners in /images/banners/*.jpg (1376x768 full, plus 640w WebP variant)
  if (/^\/images\/banners\/[^/]+\.(jpg|jpeg|webp)$/i.test(normalized)) {
    const base = normalized.replace(/\.(jpg|jpeg|webp)$/i, '').replace(/-(?:640w)$/i, '');
    return {
      isKnownLocalAsset: true,
      webpSrcSet: `${base}-640w.webp 640w, ${base}.webp 1376w`,
      webpPrimary: `${base}.webp`,
      fallbackSrc: `${base}.jpg`,
    };
  }

  // Story Atelier Seal 128x128 badge (and redirect legacy WA0032 path if referenced)
  if (
    /^\/images\/atelier-seal-128\.(jpg|jpeg|webp)$/i.test(normalized) ||
    normalized.includes('IMG-20261106-WA0032_3f856e9c')
  ) {
    return {
      isKnownLocalAsset: true,
      webpSrcSet: `${STORY_ATELIER_SEAL_WEBP} 128w`,
      webpPrimary: STORY_ATELIER_SEAL_WEBP,
      fallbackSrc: STORY_ATELIER_SEAL_JPG,
    };
  }

  return {
    isKnownLocalAsset: false,
    fallbackSrc: url,
  };
}

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
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
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

  // Clear <picture> <source> siblings if a WebP variant fails so the <img> fallback actually loads
  const parent = target.parentElement;
  if (parent && parent.tagName === 'PICTURE') {
    parent.querySelectorAll('source').forEach((s) => s.remove());
  }

  if (target.src !== fallback && !target.src.endsWith(fallback)) {
    target.src = fallback;
  }
}

export { isVideoMedia } from './mediaHelpers';
