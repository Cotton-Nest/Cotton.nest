import { BedsheetProduct } from '../data/products';

/**
 * Detects whether a media URL, data URI, or File represents a video
 */
export function isVideoMedia(urlOrFile?: string | File | null): boolean {
  if (!urlOrFile) return false;
  if (typeof File !== 'undefined' && urlOrFile instanceof File) {
    return (
      urlOrFile.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i.test(urlOrFile.name)
    );
  }
  if (typeof urlOrFile === 'string') {
    const trimmed = urlOrFile.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:video/')) return true;
    if (trimmed.includes('/video/upload/')) return true;
    return /\.(mp4|webm|mov|m4v|ogg|ogv)($|\?|#)/i.test(trimmed);
  }
  return false;
}

/**
 * Returns a deduplicated list of all additional gallery media (photos + videos) for a product
 */
export function getProductGalleryMedia(product?: Partial<BedsheetProduct> | null): string[] {
  if (!product) return [];
  const combined: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u?: string) => {
    if (u && typeof u === 'string') {
      const clean = u.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        combined.push(clean);
      }
    }
  };

  if (Array.isArray(product.additionalImages)) {
    product.additionalImages.forEach(addUrl);
  }
  if (Array.isArray(product.videos)) {
    product.videos.forEach(addUrl);
  }
  if (product.videoUrl && typeof product.videoUrl === 'string') {
    addUrl(product.videoUrl);
  }

  return combined;
}

/**
 * Computes photo and video counts for a product (cover + gallery angles + variants)
 */
export function getProductMediaCounts(product?: Partial<BedsheetProduct> | null): {
  totalCount: number;
  photoCount: number;
  imageCount: number;
  videoCount: number;
  hasVideo: boolean;
  firstVideoUrl: string | null;
} {
  if (!product) {
    return { totalCount: 0, photoCount: 0, imageCount: 0, videoCount: 0, hasVideo: false, firstVideoUrl: null };
  }

  let photoCount = 0;
  let videoCount = 0;
  let firstVideoUrl: string | null = null;

  const inspectUrl = (url?: string | null) => {
    if (!url || typeof url !== 'string' || !url.trim()) return;
    if (isVideoMedia(url)) {
      videoCount++;
      if (!firstVideoUrl) firstVideoUrl = url.trim();
    } else {
      photoCount++;
    }
  };

  // 1. Primary cover media
  inspectUrl(product.image || '/images/exact_sheet1_pink_rose_1790997736396.jpg');

  // 2. Additional gallery images & videos
  const gallery = getProductGalleryMedia(product);
  gallery.forEach(inspectUrl);

  // 3. Variant media
  if (Array.isArray(product.variants)) {
    product.variants.forEach((v) => {
      if (v && v.image) {
        inspectUrl(v.image);
      }
    });
  }

  return {
    totalCount: photoCount + videoCount,
    photoCount,
    imageCount: photoCount,
    videoCount,
    hasVideo: videoCount > 0,
    firstVideoUrl,
  };
}
