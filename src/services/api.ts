import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from '../firebase';
import {
  BedsheetProduct,
  BEDSHEETS_CATALOG,
  normalizeCustomPrice,
  normalizeSkuCode,
  auditAndEnsureUniqueProductSkus,
  generateUniqueProductSku,
} from '../data/products';
import { Order, INITIAL_ORDERS } from '../data/orders';
import { SiteContent, INITIAL_SITE_CONTENT, normalizeShippingInTerms, normalizeShippingFee } from '../data/siteContent';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { uploadToCloudinary, uploadComplaintPhotoToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from './cloudinary';
import { ProductReview, INITIAL_REVIEWS } from '../data/reviews';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from '../data/seasonal';
import { CouponOffer, INITIAL_COUPONS, evaluateCouponEligibility, CartItemLike, CouponEvaluationResult } from '../data/coupons';
import {
  AppNotification,
  StockSubscription,
  PushSubscriptionData,
  INITIAL_CUSTOMER_NOTIFICATIONS,
  buildComplaintNotificationForCustomer,
  buildComplaintNotificationForAdmin,
  buildOrderStatusNotification,
} from '../data/notifications';
import { triggerLocalPushNotification } from '../utils/pushNotifications';
import { WishlistItem } from '../data/wishlist';
import {
  OrderComplaint,
  ComplaintSubmissionInput,
  ComplaintStatus,
  validateComplaintSubmission,
  applyAdminComplaintUpdate,
  normalizePhoneDigits,
} from '../data/complaints';
import { LOYALTY_MAX_REDEMPTION_POINTS } from '../data/loyalty';

// Re-export Cloudinary & media service helpers
export {
  uploadToCloudinary,
  uploadComplaintPhotoToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
  isVideoMedia,
  getProductGalleryMedia,
  getProductMediaCounts,
  checkCloudinaryConfig,
} from './cloudinary';
import { isVideoMedia } from './cloudinary';

// ---------------- SANITIZATION & LINK STORAGE HELPERS ---------------- //

/**
 * Recursively removes any undefined keys so Firestore never throws
 * "Unsupported field value: undefined" errors.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result;
}

/**
 * Ensures Firestore documents store clean URL links (HTTPS, relative public paths, or safe bounded data URIs),
 * preventing ephemeral blob URLs or oversized >750KB base64 blobs from breaking Firestore's 1MB document limit.
 */
export function cleanLinkOnly(url?: string | null, fallbackId?: string): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return resolveBedsheetImage('', fallbackId);
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:')) {
    return resolveBedsheetImage('', fallbackId);
  }
  if (trimmed.startsWith('data:')) {
    // Retain clean bounded data URLs (<950KB) so JSON backups with embedded photos are never lost
    if (trimmed.length < 950000) {
      return trimmed;
    }
    return resolveBedsheetImage('', fallbackId);
  }
  return trimmed;
}

/**
 * Filters an array of media URLs (additionalImages / videos) so clean HTTP(S), server /uploads/ /images/ links, or bounded data URIs are stored.
 */
export function cleanMediaArray(urls?: string[]): string[] {
  if (!Array.isArray(urls)) return [];
  return Array.from(
    new Set(
      urls
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim())
        .filter((u) => !u.startsWith('blob:') && (!u.startsWith('data:') || u.length < 700000))
    )
  );
}

export function isSubkeyDocumentId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return (
    id.includes('_gallery_') ||
    id.includes('_video_') ||
    id.includes('_variant_') ||
    id.includes('_media_') ||
    id.includes('_angle_')
  );
}

// ---------------- IMAGE & VIDEO UPLOAD & HOSTING ---------------- //
export async function uploadImageApi(imageInput: string | File, productId?: string): Promise<string> {
  let hostedUrl: string;

  // If already hosted on Cloudinary, external HTTPS URL, or local /uploads/ path, it is already a clean link
  if (
    typeof imageInput === 'string' &&
    (isCloudinaryUrl(imageInput) ||
      imageInput.startsWith('https://') ||
      imageInput.startsWith('http://') ||
      imageInput.startsWith('/uploads/') ||
      imageInput.startsWith('/images/'))
  ) {
    hostedUrl = imageInput.trim();
  } else {
    // Upload image or video to Cloudinary (with automatic resilient server fallback)
    const uploadResult = await uploadToCloudinary(imageInput, productId);
    hostedUrl = uploadResult.url;
  }

  // Only update custom_images and products/{productId} if productId is a real product ID (not a gallery/variant/media subkey)
  const isGalleryOrVariantSubkey = isSubkeyDocumentId(productId);

  if (productId && hostedUrl && !isGalleryOrVariantSubkey) {
    try {
      await setDoc(
        doc(db, 'custom_images', productId),
        {
          productId,
          imageUrl: hostedUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not record custom_images in Firestore:', err);
    }

    try {
      const prodRef = doc(db, 'products', productId);
      const existingSnap = await getDoc(prodRef);
      if (existingSnap.exists() && existingSnap.data()?.name) {
        const existingData = existingSnap.data() as BedsheetProduct;
        const isVid = isVideoMedia(hostedUrl) || isVideoMedia(imageInput);
        const nextUpdates: Record<string, any> = {
          image: hostedUrl,
          updatedAt: Date.now(),
        };
        if (isVid) {
          const prevAdd = cleanMediaArray(existingData.additionalImages);
          const prevVids = cleanMediaArray(existingData.videos);
          nextUpdates.additionalImages = Array.from(new Set([...prevAdd, hostedUrl]));
          nextUpdates.videos = Array.from(new Set([...prevVids, hostedUrl]));
          nextUpdates.videoUrl = hostedUrl;
        }
        await setDoc(prodRef, nextUpdates, { merge: true });
      }
    } catch (err) {
      console.warn('Could not update product image in Firestore:', err);
    }
  }

  return hostedUrl;
}

export async function getCustomImagesApi(): Promise<Record<string, string>> {
  const path = 'custom_images';
  try {
    const snap = await getDocs(collection(db, path));
    const images: Record<string, string> = {};
    snap.forEach((d) => {
      if (isSubkeyDocumentId(d.id)) return;
      const data = d.data();
      if (data && data.imageUrl && typeof data.imageUrl === 'string') {
        images[d.id] = data.imageUrl;
      }
    });
    return images;
  } catch (error) {
    console.warn('Could not fetch custom_images from Firestore:', error);
    return {};
  }
}

export async function saveCustomImagesMapApi(
  imagesMap: Record<string, string>,
  replaceAll: boolean = false
): Promise<Record<string, string>> {
  const resolvedMap: Record<string, string> = {};
  const entries = Object.entries(imagesMap || {}).filter(
    ([k, v]) => k && !isSubkeyDocumentId(k) && typeof v === 'string' && v.trim() !== '' && !v.startsWith('blob:')
  );

  await Promise.all(
    entries.map(async ([productId, rawUrl]) => {
      let finalUrl = rawUrl.trim();
      if (finalUrl.startsWith('data:')) {
        try {
          const uploaded = await uploadToCloudinary(finalUrl, productId);
          if (uploaded && uploaded.url) {
            finalUrl = uploaded.url;
          }
        } catch {}
      }
      resolvedMap[productId] = finalUrl;
      try {
        await setDoc(
          doc(db, 'custom_images', productId),
          {
            productId,
            imageUrl: finalUrl,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn(`Failed to save custom_image ${productId} to Firestore:`, err);
      }
    })
  );

  if (replaceAll) {
    try {
      const existingSnap = await getDocs(collection(db, 'custom_images'));
      const validIds = new Set(Object.keys(resolvedMap));
      const deletions: Promise<void>[] = [];
      existingSnap.forEach((d) => {
        if (!isSubkeyDocumentId(d.id) && !validIds.has(d.id)) {
          deletions.push(deleteDoc(doc(db, 'custom_images', d.id)).catch(() => {}));
        }
      });
      await Promise.all(deletions);
    } catch {}
  }

  try {
    localStorage.setItem('cotton_nest_custom_images', JSON.stringify(resolvedMap));
  } catch {}

  return resolvedMap;
}

// ---------------- IMAGE & VIDEO STATS & MEMORY PERSISTENCE ---------------- //

export async function saveUpdatedImagesStatsApi(count: number): Promise<void> {
  try {
    await setDoc(
      doc(db, 'custom_images_stats', 'summary'),
      {
        count,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not record updated images stats in Firestore:', err);
  }
}

export async function getUpdatedImagesStatsApi(): Promise<number | null> {
  try {
    const snap = await getDoc(doc(db, 'custom_images_stats', 'summary'));
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.count === 'number') {
        return data.count;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Computes the total count of custom/updated photos & videos across all bedsheets
 * (including primary images/videos, extra gallery photos/videos, and custom variants).
 */
export function computeUpdatedImagesCount(
  products: BedsheetProduct[],
  customImages: Record<string, string>
): number {
  const countedUrls = new Set<string>();

  // 1. Registered custom_images from Firestore
  Object.entries(customImages || {}).forEach(([k, u]) => {
    if (isSubkeyDocumentId(k)) return;
    if (u && typeof u === 'string' && u.trim() !== '') {
      countedUrls.add(u);
    }
  });

  // 2. Product primary, additional, video, and variant media
  (products || []).forEach((p) => {
    if (!p) return;
    if (
      p.image &&
      (isCloudinaryUrl(p.image) || (!p.image.includes('exact_sheet') && !p.image.startsWith('/images/exact_')))
    ) {
      countedUrls.add(p.image);
    }
    if (p.additionalImages && Array.isArray(p.additionalImages)) {
      p.additionalImages.forEach((img) => {
        if (img && typeof img === 'string' && img.trim() !== '') {
          countedUrls.add(img);
        }
      });
    }
    if (p.videos && Array.isArray(p.videos)) {
      p.videos.forEach((vid) => {
        if (vid && typeof vid === 'string' && vid.trim() !== '') {
          countedUrls.add(vid);
        }
      });
    }
    if (p.videoUrl && typeof p.videoUrl === 'string' && p.videoUrl.trim() !== '') {
      countedUrls.add(p.videoUrl);
    }
    if (p.variants && Array.isArray(p.variants)) {
      p.variants.forEach((v) => {
        if (
          v.image &&
          (isCloudinaryUrl(v.image) || (!v.image.includes('exact_sheet') && !v.image.startsWith('/images/exact_')))
        ) {
          countedUrls.add(v.image);
        }
      });
    }
  });

  return countedUrls.size;
}

/**
 * Adds an additional gallery image or video to an existing product in Firestore & Cloudinary/Server.
 */
export async function addProductGalleryImageApi(
  productId: string,
  mediaInput: File | string,
  currentAdditionalImages: string[] = []
): Promise<string> {
  const isVideo = isVideoMedia(mediaInput);
  const subKey = `${isVideo ? 'video' : 'gallery'}_${Date.now()}`;
  const uploadResult = await uploadToCloudinary(mediaInput, `${productId}_${subKey}`);
  const hostedUrl = uploadResult.url;

  const newAdditional = cleanMediaArray([...currentAdditionalImages, hostedUrl]);
  const videoUrls = newAdditional.filter((u) => isVideoMedia(u) || (u === hostedUrl && isVideo));

  await updateSingleProduct(productId, {
    additionalImages: newAdditional,
    videos: videoUrls,
    videoUrl: videoUrls[0] || '',
    updatedAt: Date.now(),
  });

  return hostedUrl;
}

/**
 * Removes an additional gallery image or video from a product.
 */
export async function removeProductGalleryImageApi(
  productId: string,
  mediaUrlToRemove: string,
  currentAdditionalImages: string[] = []
): Promise<string[]> {
  const updatedAdditional = cleanMediaArray(currentAdditionalImages).filter((u) => u !== mediaUrlToRemove);
  const videoUrls = updatedAdditional.filter((u) => isVideoMedia(u));

  await updateSingleProduct(productId, {
    additionalImages: updatedAdditional,
    videos: videoUrls,
    videoUrl: videoUrls[0] || '',
    updatedAt: Date.now(),
  });
  return updatedAdditional;
}

// ---------------- PRODUCTS CATALOG API (FIRESTORE AUTHORITATIVE) ---------------- //
export async function getProducts(): Promise<BedsheetProduct[]> {
  const path = 'products';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      // If Firestore is completely fresh and unseeded, return catalog
      return BEDSHEETS_CATALOG.map((p, idx) => ({
        ...p,
        order: idx,
        image: cleanLinkOnly(resolveBedsheetImage(p.image, p.id), p.id),
      }));
    }

    const products: BedsheetProduct[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as BedsheetProduct;
      if (isSubkeyDocumentId(docSnap.id) || !data || typeof data.name !== 'string' || !data.name.trim()) {
        return;
      }
      const cleanPrice = normalizeCustomPrice(data.price, 1320);
      const cleanOrigPrice = normalizeCustomPrice(data.originalPrice, cleanPrice);
      products.push({
        ...data,
        id: docSnap.id,
        price: cleanPrice,
        originalPrice: cleanOrigPrice,
        additionalImages: cleanMediaArray(data.additionalImages),
        videos: cleanMediaArray(data.videos),
        videoUrl: data.videoUrl && !data.videoUrl.startsWith('data:') && !data.videoUrl.startsWith('blob:') ? data.videoUrl : '',
        image: cleanLinkOnly(resolveBedsheetImage(data.image, docSnap.id, data.updatedAt), docSnap.id),
      });
    });

    // Stable sort by order property
    products.sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 9999;
      const orderB = typeof b.order === 'number' ? b.order : 9999;
      return orderA - orderB;
    });

    // Controlled one-time SKU uniqueness audit & migration
    const skuAudit = auditAndEnsureUniqueProductSkus(products);
    if (skuAudit.changedProducts.length > 0) {
      try {
        localStorage.setItem('cotton_nest_products', JSON.stringify(skuAudit.products));
      } catch {}

      // Sync corrected SKUs to local Express database
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skuAudit.products),
      }).catch(() => {});

      // One-time Firebase write ONLY for products whose SKUs actually needed correction
      const migrationDoneKey = 'cotton_nest_sku_migration_v1_done';
      let alreadyMigrated = false;
      try {
        alreadyMigrated = localStorage.getItem(migrationDoneKey) === 'true';
      } catch {}

      if (!alreadyMigrated && !isFirestoreWriteQuotaExhausted()) {
        try {
          localStorage.setItem(migrationDoneKey, 'true');
        } catch {}
        Promise.all(
          skuAudit.changedProducts.map((changedProd) =>
            setDoc(
              doc(db, 'products', changedProd.id),
              { sku: changedProd.sku },
              { merge: true }
            ).catch(() => {})
          )
        ).catch(() => {});
      }
    }

    return skuAudit.products;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {}
    try {
      const saved = localStorage.getItem('cotton_nest_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return auditAndEnsureUniqueProductSkus(parsed).products;
        }
      }
    } catch {}
    return auditAndEnsureUniqueProductSkus(BEDSHEETS_CATALOG).products;
  }
}

export async function addProduct(product: BedsheetProduct): Promise<BedsheetProduct> {
  const path = `products/${product.id}`;
  const cleanPrice = normalizeCustomPrice(product.price, 1320);
  const cleanOrigPrice = normalizeCustomPrice(product.originalPrice, cleanPrice);
  const resolvedSku =
    normalizeSkuCode(product.sku) || generateUniqueProductSku(product.name || product.id || 'Bedsheet');
  const cleanProduct: BedsheetProduct = stripUndefined({
    ...product,
    sku: resolvedSku,
    price: cleanPrice,
    originalPrice: cleanOrigPrice,
    updatedAt: Date.now(),
    image: cleanLinkOnly(product.image, product.id),
    additionalImages: cleanMediaArray(product.additionalImages),
    videos: cleanMediaArray(product.videos),
    videoUrl:
      product.videoUrl && !product.videoUrl.startsWith('data:') && !product.videoUrl.startsWith('blob:')
        ? product.videoUrl
        : '',
    variants: product.variants
      ? product.variants.map((v) => ({ ...v, image: cleanLinkOnly(v.image, product.id) }))
      : [],
  });

  // Mirror to server database in background
  fetch(`/api/products/${product.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanProduct),
  }).catch(() => {});

  try {
    await setDoc(doc(db, 'products', product.id), cleanProduct, { merge: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {}
  }

  return cleanProduct;
}

export async function updateSingleProduct(id: string, updates: Partial<BedsheetProduct>): Promise<void> {
  if (isSubkeyDocumentId(id)) return;
  const path = `products/${id}`;
  const sanitized = stripUndefined({ ...updates });
  if (sanitized.price !== undefined) {
    sanitized.price = normalizeCustomPrice(sanitized.price, 0);
  }
  if (sanitized.originalPrice !== undefined) {
    sanitized.originalPrice = normalizeCustomPrice(sanitized.originalPrice, sanitized.price ?? 0);
  }
  if (sanitized.image) {
    sanitized.image = cleanLinkOnly(sanitized.image, id);
  }
  if (sanitized.additionalImages && Array.isArray(sanitized.additionalImages)) {
    sanitized.additionalImages = cleanMediaArray(sanitized.additionalImages);
  }
  if (sanitized.videos && Array.isArray(sanitized.videos)) {
    sanitized.videos = cleanMediaArray(sanitized.videos);
  }
  if (typeof sanitized.videoUrl === 'string' && (sanitized.videoUrl.startsWith('data:') || sanitized.videoUrl.startsWith('blob:'))) {
    sanitized.videoUrl = '';
  }
  if (sanitized.variants && Array.isArray(sanitized.variants)) {
    sanitized.variants = sanitized.variants.map((v) => ({
      ...v,
      image: cleanLinkOnly(v.image, id),
    }));
  }
  const cleanUpdates = {
    ...sanitized,
    updatedAt: Date.now(),
  };

  // Mirror to server in background
  fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanUpdates),
  }).catch(() => {});

  try {
    // Use setDoc with merge: true so it creates or updates safely without failing on missing doc
    await setDoc(doc(db, 'products', id), cleanUpdates, { merge: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {}
  }
}

export async function removeProduct(id: string): Promise<void> {
  const path = `products/${id}`;
  fetch(`/api/products/${id}`, { method: 'DELETE' }).catch(() => {});
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {}
  }
}

/**
 * Atomic batch order update for bedsheets.
 * Updates ONLY the `order` field on each product without overwriting product details.
 */
export async function reorderProductsApi(orderedIds: string[]): Promise<void> {
  const path = 'products';
  try {
    const batch = writeBatch(db);
    orderedIds.forEach((id, index) => {
      if (isSubkeyDocumentId(id)) return;
      const productRef = doc(db, 'products', id);
      batch.set(
        productRef,
        {
          order: index,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {}
  }
}

export async function saveAllProducts(
  products: BedsheetProduct[],
  options?: { replaceAll?: boolean }
): Promise<BedsheetProduct[]> {
  const path = 'products';
  const sanitizedList: BedsheetProduct[] = [];
  const nowTs = Date.now();

  const parsePrice = (val: any, fallback: number = 1320): number => {
    return normalizeCustomPrice(val, fallback);
  };

  for (let idx = 0; idx < (products || []).length; idx++) {
    const p = products[idx] as any;
    if (!p) continue;
    const rawName = String(p.name || p.title || p.productName || p.item_name || p.label || p.id || `bedsheet-${idx}`).trim();
    if (!rawName) continue;

    const safeId = String(
      p.id ||
        `bedsheet-${rawName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}`
    );
    if (isSubkeyDocumentId(safeId)) continue;

    let primaryImage = p.image || p.imageUrl || p.img || p.photo || '';
    if (typeof primaryImage === 'string' && primaryImage.startsWith('data:')) {
      try {
        const up = await uploadToCloudinary(primaryImage, safeId);
        if (up && up.url) {
          primaryImage = up.url;
        }
      } catch {}
    }

    const cleanPrice = parsePrice(p.price ?? p.sale_price ?? p.selling_price, 1320);
    const cleanOrigPrice = parsePrice(p.originalPrice ?? p.mrp ?? p.list_price, cleanPrice);

    const cleanProd: BedsheetProduct = stripUndefined({
      ...p,
      id: safeId,
      name: rawName,
      price: cleanPrice,
      originalPrice: cleanOrigPrice,
      order: typeof p.order === 'number' ? p.order : idx,
      updatedAt: p.updatedAt || nowTs,
      image: cleanLinkOnly(primaryImage, safeId),
      additionalImages: cleanMediaArray(p.additionalImages),
      videos: cleanMediaArray(p.videos),
      videoUrl:
        p.videoUrl && !p.videoUrl.startsWith('blob:')
          ? p.videoUrl
          : '',
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: any) => ({ ...v, image: cleanLinkOnly(v.image, safeId) }))
        : [],
    });
    sanitizedList.push(cleanProd);
  }

  const { products: deduplicatedList } = auditAndEnsureUniqueProductSkus(sanitizedList);

  // 1. Immediately update localStorage cache so refresh never loses data
  try {
    if (deduplicatedList.length > 0) {
      localStorage.setItem('cotton_nest_products', JSON.stringify(deduplicatedList));
    }
  } catch {}

  // 2. Mirror to Express server in background
  fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deduplicatedList),
  }).catch(() => {});

  // 3. Persist each product to Firestore individually so one large document never aborts the entire catalog
  try {
    await Promise.all(
      deduplicatedList.map(async (cleanProd) => {
        try {
          const productRef = doc(db, 'products', cleanProd.id);
          await setDoc(productRef, cleanProd);
        } catch (docErr) {
          console.warn(`Firestore setDoc error for product ${cleanProd.id}:`, docErr);
        }
      })
    );

    // If replacing the entire catalog (e.g. from JSON backup restore), remove old Firestore docs not in the new list
    if (options?.replaceAll && deduplicatedList.length > 0) {
      const keepIds = new Set(deduplicatedList.map((p) => p.id));
      const existingSnap = await getDocs(collection(db, 'products'));
      const deletions: Promise<void>[] = [];
      existingSnap.forEach((docSnap) => {
        if (!keepIds.has(docSnap.id)) {
          deletions.push(deleteDoc(doc(db, 'products', docSnap.id)).catch(() => {}));
        }
      });
      if (deletions.length > 0) {
        await Promise.all(deletions);
      }
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }

  return deduplicatedList;
}

// ---------------- ORDERS API (FIRESTORE & BACKEND AUTHORITATIVE) ---------------- //
export async function getOrders(): Promise<Order[]> {
  const path = 'orders';
  const orderMap = new Map<string, Order>();

  // 1. Fetch from Firestore
  try {
    const snap = await getDocs(collection(db, path));
    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Order;
        if (data && docSnap.id) {
          orderMap.set(docSnap.id, { ...data, id: docSnap.id });
        }
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  // 2. Fetch from Express server backend (/api/orders)
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const serverOrders: Order[] = await res.json();
      if (Array.isArray(serverOrders)) {
        serverOrders.forEach((o) => {
          if (o && o.id) {
            // Keep existing from Firestore or insert
            if (!orderMap.has(o.id)) {
              orderMap.set(o.id, o);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('Backend /api/orders fetch notice:', err);
  }

  // 3. Check local storage cache
  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    if (cached) {
      const localOrders: Order[] = JSON.parse(cached);
      if (Array.isArray(localOrders)) {
        localOrders.forEach((o) => {
          if (o && o.id && !orderMap.has(o.id)) {
            orderMap.set(o.id, o);
          }
        });
      }
    }
  } catch {}

  const merged = Array.from(orderMap.values());
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Cache merged list
  try {
    if (merged.length > 0) {
      localStorage.setItem('cotton_nest_orders', JSON.stringify(merged));
    }
  } catch {}

  return merged.length > 0 ? merged : INITIAL_ORDERS;
}

export async function saveOrder(order: Order): Promise<void> {
  const path = `orders/${order.id}`;

  // Rule 1 & 6: Never generate or send an invoice when an order is placed.
  const safeOrder: Order = stripUndefined({
    ...order,
    status: 'pending',
    invoiceGenerated: false,
    invoiceSent: false,
    invoiceStatus: 'pending_confirmation',
    invoiceMessage: 'Your invoice will be generated and available once your order is confirmed.',
    customerEmail: order.customerEmail?.trim() || undefined,
    customerPhone: order.customerPhone?.trim() || '',
    customerAddress: order.customerAddress?.trim() || '',
    notes: order.notes?.trim() || undefined,
    userId: order.userId?.trim() || undefined,
    timeline: order.timeline && order.timeline.length > 0 ? order.timeline : [
      {
        status: 'pending',
        timestamp: order.createdAt || new Date().toISOString(),
        title: 'Order Placed',
        description: 'Your invoice will be generated and available once your order is confirmed.'
      }
    ],
    trackingNumber: order.trackingNumber || `CN-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
  });

  // Safe Firestore document without ANY undefined properties
  const firestoreDoc: Record<string, any> = {};
  for (const [key, val] of Object.entries(safeOrder)) {
    if (val !== undefined) {
      firestoreDoc[key] = val;
    }
  }

  // 1. Optimistically update local storage
  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    let currentList: Order[] = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(currentList)) currentList = [];
    currentList = [safeOrder, ...currentList.filter((o) => o.id !== safeOrder.id)];
    localStorage.setItem('cotton_nest_orders', JSON.stringify(currentList));
  } catch {}

  // 2. Dual-write to Express server backend (/api/orders)
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeOrder),
    });
  } catch (serverErr) {
    console.warn('Dual-write to /api/orders notice:', serverErr);
  }

  // 3. Write to Firestore
  try {
    await setDoc(doc(db, 'orders', safeOrder.id), firestoreDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    // Don't throw if server or localStorage already has it
    console.warn('Firestore order save error (saved to backend):', error);
  }

  // 3b. If user applied Nest Points at checkout (pointsUsed > 0), calculate deduction and update user's loyalty balance in Firestore
  const pointsToRedeemVal = Math.min(
    LOYALTY_MAX_REDEMPTION_POINTS,
    Math.max(0, Number(safeOrder.pointsUsed) || 0)
  );
  if (pointsToRedeemVal > 0) {
    try {
      const { redeemLoyaltyPointsApi } = await import('./loyaltyApi');
      const rawKeys: string[] = [];
      if (safeOrder.customerPhone) rawKeys.push(safeOrder.customerPhone);
      if (safeOrder.customerEmail) rawKeys.push(safeOrder.customerEmail);
      if (safeOrder.userId) rawKeys.push(safeOrder.userId);
      if (rawKeys.length === 0) rawKeys.push('guest_default_wallet');

      for (const k of Array.from(new Set(rawKeys))) {
        await redeemLoyaltyPointsApi(k, pointsToRedeemVal, safeOrder.id, {
          name: safeOrder.customerName,
          phone: safeOrder.customerPhone,
          email: safeOrder.customerEmail,
          userId: safeOrder.userId,
        }).catch(() => {});
      }
      try {
        window.dispatchEvent(new Event('cotton-nest-loyalty-updated'));
      } catch {}
    } catch (redeemErr) {
      console.warn('Failed to redeem Nest Points in saveOrder:', redeemErr);
    }
  }

  // 4. Create in-app + device notification bar alert for newly placed order
  try {
    const recipient = safeOrder.customerEmail || safeOrder.customerPhone || safeOrder.userId || 'all';
    const orderNotif = buildOrderStatusNotification(
      safeOrder.id,
      safeOrder.customerName || 'Valued Customer',
      recipient,
      safeOrder.status || 'pending'
    );
    await saveNotificationApi(orderNotif);
    triggerLocalPushNotification(orderNotif.title, orderNotif.message, {
      url: '/#orders',
      tag: `cotton-nest-order-${safeOrder.id}-pending`,
    }).catch(() => {});
  } catch (notifErr) {
    console.warn('Order placement notification notice:', notifErr);
  }
}

export async function saveAllOrdersApi(orders: Order[]): Promise<void> {
  if (!Array.isArray(orders)) return;
  const sanitizedOrders = orders
    .filter((o) => o && o.id)
    .map((order) =>
      stripUndefined({
        ...order,
        customerPhone: order.customerPhone?.trim() || '',
        customerAddress: order.customerAddress?.trim() || '',
        status: order.status || 'pending',
        pointsCredited: order.status === 'delivered' ? Boolean(order.pointsCredited ?? true) : false,
        createdAt: order.createdAt || new Date().toISOString(),
      })
    );

  try {
    localStorage.setItem('cotton_nest_orders', JSON.stringify(sanitizedOrders));
  } catch {}

  fetch('/api/orders', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitizedOrders),
  }).catch(() => {});

  await Promise.all(
    sanitizedOrders.map(async (safeOrder) => {
      try {
        await setDoc(doc(db, 'orders', String(safeOrder.id)), safeOrder, { merge: true });
      } catch (err) {
        console.warn(`Firestore order save notice for ${safeOrder.id}:`, err);
      }
    })
  );
}

export async function updateOrderStatus(orderId: string, status: string, orderData?: Partial<Order>): Promise<void> {
  const path = `orders/${orderId}`;
  const nowIso = new Date().toISOString();
  let targetOrder: Order | undefined = orderData as Order | undefined;

  const buildUpdatedTimeline = (existingTimeline?: Order['timeline'], nextStatus?: string) => {
    const base = Array.isArray(existingTimeline) ? [...existingTimeline] : [];
    if (!nextStatus) return base;
    const lastStep = base[base.length - 1];
    if (lastStep && lastStep.status === nextStatus) return base;

    const titles: Record<string, { title: string; description: string }> = {
      pending: {
        title: 'Order Received',
        description: 'Your invoice will be generated and available once your order is confirmed.',
      },
      confirmed: {
        title: 'Order Confirmed & Sale Invoice Generated',
        description: 'Inspected and confirmed by Cotton Nest Atelier. Official sale invoice generated and sent to customer email.',
      },
      dispatched: {
        title: 'Dispatched & In Transit',
        description: 'Handed over to express courier. Out for delivery.',
      },
      delivered: {
        title: 'Delivered Successfully',
        description: 'Package delivered to the customer. 48-hour exchange window is now active.',
      },
      cancelled: {
        title: 'Order Cancelled',
        description: 'This order was cancelled.',
      },
    };

    const stepInfo = titles[nextStatus] || {
      title: `Status: ${nextStatus}`,
      description: 'Order status updated by Cotton Nest Atelier.',
    };

    return [
      ...base,
      {
        status: nextStatus as any,
        timestamp: nowIso,
        title: stepInfo.title,
        description: stepInfo.description,
      },
    ];
  };

  let alreadyHadInvoice = Boolean(
    orderData?.invoiceGenerated ||
      orderData?.invoiceSent ||
      orderData?.invoiceStatus === 'generated'
  );

  // 1. Update local storage & inspect prior invoice state
  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    if (cached) {
      const list: Order[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        const existingLocal = list.find((o) => o && o.id === orderId);
        if (existingLocal) {
          alreadyHadInvoice = Boolean(
            alreadyHadInvoice ||
              existingLocal.invoiceGenerated ||
              existingLocal.invoiceSent ||
              existingLocal.invoiceStatus === 'generated'
          );
        }
        const canonicalId = String(orderId).startsWith('CN-') ? String(orderId) : `CN-${orderId}`;
        const updated = list.map((o) => {
          if (o.id === orderId) {
            const nextTimeline = buildUpdatedTimeline(orderData?.timeline || o.timeline, status);
            const nextDeliveredAt =
              status === 'delivered' ? o.deliveredAt || orderData?.deliveredAt || nowIso : o.deliveredAt;
            const isNowGenerated = alreadyHadInvoice || status === 'confirmed';
            const isCancelledUnconfirmed = status === 'cancelled' && !alreadyHadInvoice;
            targetOrder = {
              ...o,
              ...(orderData || {}),
              status: status as any,
              ...(nextDeliveredAt ? { deliveredAt: nextDeliveredAt } : {}),
              timeline: nextTimeline,
              invoiceNumber: isNowGenerated ? o.invoiceNumber || `INV-${canonicalId}` : undefined,
              invoiceGenerated: isNowGenerated,
              invoiceGeneratedAt: isNowGenerated ? o.invoiceGeneratedAt || nowIso : undefined,
              invoiceSent: isNowGenerated,
              invoiceSentAt: isNowGenerated ? o.invoiceSentAt || nowIso : undefined,
              invoiceStatus: isNowGenerated
                ? 'generated'
                : isCancelledUnconfirmed
                ? 'cancelled_before_confirmation'
                : 'pending_confirmation',
              invoiceMessage: isNowGenerated
                ? o.invoiceMessage || `Official sale invoice (INV-${canonicalId}) generated & sent.`
                : isCancelledUnconfirmed
                ? 'Order was cancelled before confirmation. No invoice was generated.'
                : 'Your invoice will be generated and available once your order is confirmed.',
            };
            return {
              ...targetOrder,
              pointsCredited: status === 'delivered',
            };
          }
          return o;
        });
        localStorage.setItem('cotton_nest_orders', JSON.stringify(updated));
      }
    }
  } catch {}

  // If not found in localStorage, fetch targetOrder from Firestore or server so invoice & loyalty have full order details
  if (!targetOrder) {
    try {
      const snap = await getDoc(doc(db, 'orders', orderId));
      if (snap.exists()) {
        const snapData = snap.data() as Order;
        alreadyHadInvoice = Boolean(
          alreadyHadInvoice ||
            snapData.invoiceGenerated ||
            snapData.invoiceSent ||
            snapData.invoiceStatus === 'generated'
        );
        targetOrder = { ...snapData, id: snap.id };
      }
    } catch {}
  }

  if (!targetOrder) {
    try {
      const oRes = await fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`);
      if (oRes.ok) {
        const oData = await oRes.json();
        if (Array.isArray(oData) && oData.length > 0) {
          alreadyHadInvoice = Boolean(
            alreadyHadInvoice ||
              oData[0].invoiceGenerated ||
              oData[0].invoiceSent ||
              oData[0].invoiceStatus === 'generated'
          );
          targetOrder = oData[0];
        }
      }
    } catch {}
  }

  const canonicalId = String(orderId).startsWith('CN-') ? String(orderId) : `CN-${orderId}`;
  const isNowGenerated = alreadyHadInvoice || status === 'confirmed';
  const isCancelledBeforeConfirmation = status === 'cancelled' && !alreadyHadInvoice;

  const resolvedDeliveredAt =
    status === 'delivered'
      ? targetOrder?.deliveredAt || orderData?.deliveredAt || nowIso
      : targetOrder?.deliveredAt;
  const resolvedTimeline = buildUpdatedTimeline(
    orderData?.timeline || targetOrder?.timeline,
    status
  );
  if (targetOrder) {
    targetOrder = {
      ...targetOrder,
      status: status as any,
      ...(resolvedDeliveredAt ? { deliveredAt: resolvedDeliveredAt } : {}),
      timeline: resolvedTimeline,
      invoiceNumber: isNowGenerated ? targetOrder.invoiceNumber || `INV-${canonicalId}` : undefined,
      invoiceGenerated: isNowGenerated,
      invoiceGeneratedAt: isNowGenerated ? targetOrder.invoiceGeneratedAt || nowIso : undefined,
      invoiceSent: isNowGenerated,
      invoiceSentAt: isNowGenerated ? targetOrder.invoiceSentAt || nowIso : undefined,
      invoiceStatus: isNowGenerated
        ? 'generated'
        : isCancelledBeforeConfirmation
        ? 'cancelled_before_confirmation'
        : 'pending_confirmation',
      invoiceMessage: isNowGenerated
        ? targetOrder.invoiceMessage || `Official sale invoice (INV-${canonicalId}) generated & sent.`
        : isCancelledBeforeConfirmation
        ? 'Order was cancelled before confirmation. No invoice was generated.'
        : 'Your invoice will be generated and available once your order is confirmed.',
    };
  }

  // 2. Update Express server backend (which generates and emails the invoice when transitioning to 'confirmed' for the first time)
  let serverHandledInvoice = false;
  try {
    const putRes = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(resolvedDeliveredAt ? { deliveredAt: resolvedDeliveredAt } : {}),
        timeline: resolvedTimeline,
        order: targetOrder,
      }),
    });
    if (putRes.ok) {
      const contentType = putRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const putData = await putRes.json().catch(() => null);
        if (putData && putData.id && (putData.invoiceSent || putData.invoiceGenerated)) {
          serverHandledInvoice = true;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to update order status on server:', err);
  }

  // 2b. Fallback to /api/send-invoice ONLY if status is 'confirmed', invoice was NOT already generated before, and Express didn't handle it
  if (status === 'confirmed' && !alreadyHadInvoice && targetOrder && !serverHandledInvoice) {
    try {
      const itemsSubtotal = (targetOrder.items || []).reduce(
        (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetOrder.id || orderId,
          status: 'confirmed',
          customerName: targetOrder.customerName || 'Valued Customer',
          customerEmail: targetOrder.customerEmail,
          customerPhone: targetOrder.customerPhone,
          customerAddress: targetOrder.customerAddress,
          shippingMethod: targetOrder.shippingCost ? 'Express Courier Across India' : 'Sector 46 Complimentary Express Delivery',
          subtotal: itemsSubtotal > 0 ? itemsSubtotal : Number(targetOrder.subtotal) || Number(targetOrder.totalAmount) || 0,
          couponCode: targetOrder.couponCode,
          couponDiscount: Number(targetOrder.couponDiscount) || 0,
          pointsUsed: Number(targetOrder.pointsUsed) || 0,
          pointsDiscount: Number(targetOrder.pointsDiscount) || 0,
          shippingCost: Number(targetOrder.shippingCost) || 0,
          finalTotal: Number(targetOrder.totalAmount) || 0,
          pointsEarned: targetOrder.pointsEarned,
          items: (targetOrder.items || []).map((it: any) => ({
            name: it.productName || it.name || 'Pure Cotton Bedsheet',
            variantName: it.variantName,
            dimensions: it.dimensions || '108 x 108 inches',
            quantity: Number(it.quantity) || 1,
            price: Number(it.price) || 0,
            imageUrl: it.productImage || it.imageUrl || '',
          })),
          createdAt: targetOrder.createdAt,
        }),
      });
    } catch (invErr) {
      console.warn('Serverless invoice dispatch fallback notice:', invErr);
    }
  }

  // 3. When order is marked delivered, credit Nest Points across all customer keys (idempotent per orderId + accountId)
  if (status === 'delivered' && targetOrder) {
    const rawKeys: string[] = [];
    if (targetOrder.customerPhone) rawKeys.push(targetOrder.customerPhone);
    if (targetOrder.customerEmail) rawKeys.push(targetOrder.customerEmail);
    if (targetOrder.userId) rawKeys.push(targetOrder.userId);
    if (rawKeys.length === 0) rawKeys.push('guest_default_wallet');

    const shippingCostVal = Number(targetOrder.shippingCost) || 0;
    const eligibleAmount = Math.max(0, (Number(targetOrder.totalAmount) || 0) - shippingCostVal);

    if (eligibleAmount > 0 || (targetOrder.pointsEarned && targetOrder.pointsEarned > 0)) {
      try {
        const { earnLoyaltyPointsApi } = await import('./loyaltyApi');
        for (const k of rawKeys) {
          await earnLoyaltyPointsApi(k, eligibleAmount, orderId, {
            name: targetOrder.customerName,
            phone: targetOrder.customerPhone,
            email: targetOrder.customerEmail,
            userId: targetOrder.userId,
            explicitPoints: targetOrder.pointsEarned,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to credit Nest Points upon delivery:', err);
      }
    }

    // Broadcast loyalty balance update so customer modal & header reflect immediately
    try {
      window.dispatchEvent(
        new CustomEvent('cotton-nest-loyalty-updated', {
          detail: { orderId, status: 'delivered' },
        })
      );
    } catch {}
  } else if ((status === 'cancelled' || status === 'refunded') && targetOrder) {
    const ptsUsed = Number(targetOrder.pointsUsed) || 0;
    if (ptsUsed > 0 && !targetOrder.pointsRefunded) {
      try {
        const { refundLoyaltyPointsApi } = await import('./loyaltyApi');
        const rawKeys: string[] = [];
        if (targetOrder.customerPhone) rawKeys.push(targetOrder.customerPhone);
        if (targetOrder.customerEmail) rawKeys.push(targetOrder.customerEmail);
        if (targetOrder.userId) rawKeys.push(targetOrder.userId);
        if (rawKeys.length === 0) rawKeys.push('guest_default_wallet');

        for (const k of Array.from(new Set(rawKeys))) {
          await refundLoyaltyPointsApi(k, ptsUsed, orderId, {
            name: targetOrder.customerName,
            phone: targetOrder.customerPhone,
            email: targetOrder.customerEmail,
            userId: targetOrder.userId,
          }).catch(() => {});
        }
        targetOrder.pointsRefunded = true;
      } catch (refundErr) {
        console.warn('Failed to refund Nest Points on cancellation:', refundErr);
      }
    }
    try {
      window.dispatchEvent(
        new CustomEvent('cotton-nest-loyalty-updated', {
          detail: { orderId, status },
        })
      );
    } catch {}
  }

  // 4. Update Firestore
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      ...(isNowGenerated
        ? {
            invoiceNumber: targetOrder?.invoiceNumber || `INV-${canonicalId}`,
            invoiceGenerated: true,
            invoiceGeneratedAt: targetOrder?.invoiceGeneratedAt || nowIso,
            invoiceSent: true,
            invoiceSentAt: targetOrder?.invoiceSentAt || nowIso,
            invoiceStatus: 'generated',
            invoiceMessage:
              targetOrder?.invoiceMessage ||
              `Official sale invoice (INV-${canonicalId}) generated & sent.`,
          }
        : isCancelledBeforeConfirmation
        ? {
            invoiceGenerated: false,
            invoiceSent: false,
            invoiceStatus: 'cancelled_before_confirmation',
            invoiceMessage: 'Order was cancelled before confirmation. No invoice was generated.',
          }
        : {
            invoiceGenerated: false,
            invoiceSent: false,
            invoiceStatus: 'pending_confirmation',
            invoiceMessage: 'Your invoice will be generated and available once your order is confirmed.',
          }),
      ...(status === 'delivered'
        ? {
            pointsCredited: true,
            deliveredAt: resolvedDeliveredAt || nowIso,
          }
        : {}),
      ...(resolvedTimeline.length > 0 ? { timeline: resolvedTimeline } : {}),
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  // 5. Notify customer of order status update
  try {
    const recipient = targetOrder?.customerEmail || targetOrder?.customerPhone || targetOrder?.userId || 'all';
    const orderNotif = buildOrderStatusNotification(
      orderId,
      targetOrder?.customerName || 'Valued Customer',
      recipient,
      status
    );
    await saveNotificationApi(orderNotif);
    triggerLocalPushNotification(orderNotif.title, orderNotif.message, { url: '/#orders' }).catch(() => {});
  } catch (notifErr) {
    console.warn('Order status notification dispatch notice:', notifErr);
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;

  // 1. Update local storage
  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    if (cached) {
      const list: Order[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        localStorage.setItem('cotton_nest_orders', JSON.stringify(list.filter((o) => o.id !== orderId)));
      }
    }
  } catch {}

  // 2. Delete from Express server
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Failed to delete order on server:', err);
  }

  // 3. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------- SITE CONTENT & BRANDING API ---------------- //
export async function getSiteContent(): Promise<SiteContent> {
  const path = 'site_content/main';
  try {
    const docSnap = await getDoc(doc(db, 'site_content', 'main'));
    if (docSnap.exists()) {
      const data = docSnap.data() as SiteContent;
      if (data && data.company) {
        const normalizedTc = normalizeShippingInTerms(data.termsAndConditions);
        const normalizedFee = normalizeShippingFee(data.shippingFeeIndia);
        data.termsAndConditions = normalizedTc;
        data.shippingFeeIndia = normalizedFee;
        return data;
      }
    }
    return INITIAL_SITE_CONTENT;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return INITIAL_SITE_CONTENT;
  }
}

export async function saveSiteContentApi(content: SiteContent): Promise<void> {
  const path = 'site_content/main';
  try {
    const cleanContent = stripUndefined({
      ...content,
      shippingFeeIndia: normalizeShippingFee(content.shippingFeeIndia),
      termsAndConditions: normalizeShippingInTerms(content.termsAndConditions),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'site_content', 'main'), cleanContent, { merge: true });

    // Sync to local storage & server backend
    try {
      localStorage.setItem('cotton_nest_site_content', JSON.stringify(cleanContent));
      fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanContent),
      }).catch(() => {});
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ---------------- THEME APPEARANCE API (FIRESTORE) ---------------- //
export async function getPublishedThemeApi(): Promise<any> {
  const path = 'theme/active';
  try {
    const docSnap = await getDoc(doc(db, 'theme', 'active'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.colors) {
        return data;
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function savePublishedThemeApi(config: any): Promise<void> {
  const path = 'theme/active';
  try {
    await setDoc(doc(db, 'theme', 'active'), {
      ...config,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ---------------- CUSTOMER REVIEWS API (FIRESTORE) ---------------- //
export async function getReviewsApi(): Promise<ProductReview[]> {
  const path = 'reviews';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return INITIAL_REVIEWS;
    }
    const reviews: ProductReview[] = [];
    snap.forEach((docSnap) => {
      reviews.push({ ...(docSnap.data() as ProductReview), id: docSnap.id });
    });
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reviews;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return INITIAL_REVIEWS;
  }
}

export async function saveReviewApi(review: ProductReview): Promise<ProductReview> {
  const path = `reviews/${review.id}`;
  try {
    await setDoc(doc(db, 'reviews', review.id), review);
    return review;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function helpfulReviewApi(reviewId: string): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      helpfulCount: increment(1),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteReviewApi(reviewId: string): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// ---------------- SEASONAL PAGE & FESTIVE OFFERS API (FIRESTORE) ---------------- //
export async function getSeasonalConfigApi(): Promise<SeasonalConfig> {
  const path = 'seasonal/active';
  try {
    const docSnap = await getDoc(doc(db, 'seasonal', 'active'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && typeof data === 'object' && typeof data.name === 'string') {
        return data as SeasonalConfig;
      }
    }
    return INITIAL_SEASONAL_CONFIG;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return INITIAL_SEASONAL_CONFIG;
  }
}

export async function saveSeasonalConfigApi(config: SeasonalConfig): Promise<SeasonalConfig> {
  const path = 'seasonal/active';
  const stampedConfig: SeasonalConfig = {
    ...config,
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'seasonal', 'active'), stampedConfig);
    return stampedConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ---------------- COUPONS & PROMOTIONS API (FIRESTORE & BACKEND) ---------------- //

export async function getCouponsApi(): Promise<CouponOffer[]> {
  const path = 'coupons';
  try {
    // 1. Try Firestore first
    const snapshot = await getDocs(collection(db, 'coupons'));
    if (!snapshot.empty) {
      const list: CouponOffer[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data && data.code) {
          list.push({ id: d.id, ...data } as CouponOffer);
        }
      });
      if (list.length > 0) {
        try {
          localStorage.setItem('cotton_nest_coupons', JSON.stringify(list));
        } catch {}
        return list;
      }
    }

    // 2. Fallback to server backend API
    const res = await fetch('/api/coupons');
    if (res.ok) {
      const serverCoupons = await res.json();
      if (Array.isArray(serverCoupons) && serverCoupons.length > 0) {
        try {
          localStorage.setItem('cotton_nest_coupons', JSON.stringify(serverCoupons));
        } catch {}
        return serverCoupons;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  // 3. Fallback to localStorage
  try {
    const cached = localStorage.getItem('cotton_nest_coupons');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // 4. Default seed coupons
  return INITIAL_COUPONS;
}

export async function saveCouponApi(coupon: CouponOffer): Promise<CouponOffer> {
  const rawCode = (coupon.code || `OFFER${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
  const cleanCode = rawCode.replace(/[^A-Z0-9_-]/g, '-') || `OFFER-${Math.floor(100 + Math.random() * 900)}`;

  // Safe document ID for Firestore without slashes, spaces, or URI characters
  const safeId = (
    coupon.id && typeof coupon.id === 'string' && !coupon.id.includes('/')
      ? coupon.id
      : `coupon-${cleanCode.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${Date.now().toString(36)}`
  ).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

  const cleanCoupon: CouponOffer = {
    ...coupon,
    id: safeId,
    code: cleanCode,
    title: (coupon.title || `${cleanCode} Offer`).trim(),
    description: (coupon.description || '').trim(),
    discountType: coupon.discountType || 'percentage',
    discountValue: Number(coupon.discountValue) || 10,
    minOrderValue: Math.max(0, Number(coupon.minOrderValue) || 0),
    maxDiscountAmount: coupon.maxDiscountAmount ? Math.max(0, Number(coupon.maxDiscountAmount)) : 0,
    startDate: (coupon.startDate || new Date().toISOString().split('T')[0]).trim(),
    expiryDate: (coupon.expiryDate || '2030-12-31').trim(),
    isActive: coupon.isActive ?? true,
    isAutomatic: Boolean(coupon.isAutomatic),
    maxUses: coupon.maxUses ? Math.max(0, Number(coupon.maxUses)) : 0,
    usedCount: Math.max(0, Number(coupon.usedCount) || 0),
    oneUsePerCustomer: Boolean(coupon.oneUsePerCustomer),
    usedByCustomers: Array.isArray(coupon.usedByCustomers) ? coupon.usedByCustomers : [],
    scope: coupon.scope || 'all',
    applicableProductIds: Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds : [],
    badgeText: (coupon.badgeText || '').trim(),
    createdAt: coupon.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  // Safe Firestore object strictly without undefined
  const firestoreDoc: Record<string, any> = {};
  for (const [key, value] of Object.entries(cleanCoupon)) {
    if (value !== undefined) {
      firestoreDoc[key] = value;
    }
  }

  // 1. Save to local cache first
  try {
    const cached = localStorage.getItem('cotton_nest_coupons');
    let list: CouponOffer[] = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex((c) => c.id === cleanCoupon.id || c.code === cleanCoupon.code);
    if (idx >= 0) {
      list[idx] = cleanCoupon;
    } else {
      list.unshift(cleanCoupon);
    }
    localStorage.setItem('cotton_nest_coupons', JSON.stringify(list));
  } catch {}

  // 2. Persist to server backend synchronously
  try {
    const serverRes = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanCoupon),
    });
    if (!serverRes.ok) {
      const errData = await serverRes.json().catch(() => ({}));
      console.warn('Backend coupon save notice:', errData);
    }
  } catch (err) {
    console.warn('Backend coupon save fetch offline:', err);
  }

  // 3. Persist to Firestore
  try {
    await setDoc(doc(db, 'coupons', cleanCoupon.id), firestoreDoc, { merge: true });
  } catch (error) {
    console.warn('Firestore setDoc coupon notice (persisted to backend):', error);
  }

  return cleanCoupon;
}

export async function deleteCouponApi(couponId: string): Promise<void> {
  const path = `coupons/${couponId}`;
  try {
    await deleteDoc(doc(db, 'coupons', couponId));
    fetch(`/api/coupons/${couponId}`, { method: 'DELETE' }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Validates a coupon using the secure server backend route /api/coupons/validate.
 * Does not trust the client browser calculation alone.
 */
export async function validateCouponApi(
  code: string,
  items: CartItemLike[],
  subtotal: number,
  customerIdentifier?: string
): Promise<{ valid: boolean; coupon?: CouponOffer; discountAmount: number; error?: string }> {
  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), items, subtotal, customerIdentifier }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return {
          valid: true,
          coupon: data.coupon,
          discountAmount: Number(data.discountAmount) || 0,
        };
      } else {
        return {
          valid: false,
          discountAmount: 0,
          error: data.error || 'Coupon is not eligible for this order.',
        };
      }
    }
  } catch (err) {
    console.warn('Backend coupon validation fallback:', err);
  }

  // Fallback: Validate directly against Firestore coupon docs if backend is unreachable
  try {
    const coupons = await getCouponsApi();
    const cleanCode = code.trim().toUpperCase();
    const matched = coupons.find((c) => c.code.toUpperCase() === cleanCode);
    if (!matched) {
      return { valid: false, discountAmount: 0, error: 'Invalid coupon code. Please verify the spelling.' };
    }
    const evalResult = evaluateCouponEligibility(matched, items, subtotal, customerIdentifier);
    if (!evalResult.isEligible) {
      return { valid: false, discountAmount: 0, error: evalResult.reason || 'Coupon is not eligible.' };
    }
    return {
      valid: true,
      coupon: matched,
      discountAmount: evalResult.discountAmount,
    };
  } catch (fallbackErr) {
    return { valid: false, discountAmount: 0, error: 'Could not validate coupon at this time.' };
  }
}

/**
 * Records coupon usage securely in Firestore and backend
 */
export async function recordCouponUseApi(couponId: string, customerIdentifier?: string): Promise<void> {
  const path = `coupons/${couponId}`;
  try {
    const couponRef = doc(db, 'coupons', couponId);
    const snap = await getDoc(couponRef);
    if (snap.exists()) {
      const data = snap.data() as CouponOffer;
      const currentUsed = (data.usedCount || 0) + 1;
      const currentCustomers = Array.isArray(data.usedByCustomers) ? [...data.usedByCustomers] : [];
      if (customerIdentifier && !currentCustomers.includes(customerIdentifier.trim())) {
        currentCustomers.push(customerIdentifier.trim());
      }
      await updateDoc(couponRef, {
        usedCount: currentUsed,
        usedByCustomers: currentCustomers,
        updatedAt: Date.now(),
      });
    }

    // Also notify backend
    fetch('/api/coupons/record-use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponId, customerIdentifier }),
    }).catch(() => {});
  } catch (error) {
    console.warn('Failed to record coupon use in Firestore:', error);
  }
}

// ---------------- NOTIFICATIONS & WEB PUSH API ---------------- //

function dispatchNotificationsUpdatedEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cotton-nest-notifications-updated'));
  }
}

export async function getNotificationsApi(
  recipientId?: string,
  isOwner?: boolean
): Promise<AppNotification[]> {
  const notifMap = new Map<string, AppNotification>();

  const shouldInclude = (item: AppNotification): boolean => {
    if (!item || !item.id) return false;
    if (isOwner) return true;
    if (item.category === 'admin') return false;
    if (!recipientId || !item.recipientId || item.recipientId === 'all') return true;
    const rClean = recipientId.trim().toLowerCase();
    const itemRecip = item.recipientId.trim().toLowerCase();
    const metaEmail = item.metadata?.customerEmail?.trim().toLowerCase();
    const metaPhone = normalizePhoneDigits(item.metadata?.customerPhone);
    const rDigits = normalizePhoneDigits(recipientId);
    return (
      itemRecip === rClean ||
      Boolean(metaEmail && metaEmail === rClean) ||
      Boolean(rDigits && metaPhone && rDigits === metaPhone) ||
      Boolean(rDigits && normalizePhoneDigits(item.recipientId) === rDigits)
    );
  };

  const upsertNotif = (item: AppNotification) => {
    if (!shouldInclude(item)) return;
    const existing = notifMap.get(item.id);
    if (!existing || (item.timestamp || 0) >= (existing.timestamp || 0)) {
      notifMap.set(item.id, item);
    }
  };

  // 1. Fetch from Express backend (/api/notifications)
  try {
    const qs = new URLSearchParams();
    if (recipientId) qs.set('recipientId', recipientId);
    if (isOwner) qs.set('isOwner', 'true');
    const res = await fetch(`/api/notifications${qs.toString() ? `?${qs.toString()}` : ''}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const serverList: AppNotification[] = await res.json();
      if (Array.isArray(serverList)) {
        serverList.forEach(upsertNotif);
      }
    }
  } catch (err) {
    console.warn('Backend /api/notifications fetch notice:', err);
  }

  // 2. Fetch from Firestore notifications collection
  try {
    const snapshot = await getDocs(collection(db, 'notifications'));
    if (!snapshot.empty) {
      snapshot.forEach((docSnap) => {
        const item = { id: docSnap.id, ...docSnap.data() } as AppNotification;
        upsertNotif(item);
      });
    }
  } catch (err) {
    console.warn('Firestore notifications fetch notice:', err);
  }

  // 3. Merge with localStorage cache
  try {
    const local = localStorage.getItem('cotton_nest_notifications');
    if (local) {
      const parsed: AppNotification[] = JSON.parse(local);
      if (Array.isArray(parsed)) {
        parsed.forEach(upsertNotif);
      }
    }
  } catch {}

  const merged = Array.from(notifMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (merged.length > 0) {
    try {
      localStorage.setItem('cotton_nest_notifications', JSON.stringify(merged));
    } catch {}
    return merged;
  }

  return INITIAL_CUSTOMER_NOTIFICATIONS;
}

export async function saveNotificationApi(notification: AppNotification): Promise<AppNotification> {
  const stamped: AppNotification = stripUndefined({
    ...notification,
    timestamp: notification.timestamp || Date.now(),
  });

  // 1. Sync to local cache first for immediate UI update
  try {
    const current = localStorage.getItem('cotton_nest_notifications');
    let list: AppNotification[] = current ? JSON.parse(current) : [];
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex((n) => n.id === stamped.id);
    if (idx >= 0) {
      list[idx] = stamped;
    } else {
      list.unshift(stamped);
    }
    localStorage.setItem('cotton_nest_notifications', JSON.stringify(list));
  } catch {}

  // 2. Save to Express server (/api/notifications)
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stamped),
    });
  } catch (err) {
    console.warn('Backend /api/notifications save notice:', err);
  }

  // 3. Save to Firestore notifications collection
  const docData: Record<string, any> = {};
  for (const [key, val] of Object.entries(stamped)) {
    if (val !== undefined) docData[key] = val;
  }

  try {
    await setDoc(doc(db, 'notifications', stamped.id), docData, { merge: true });
  } catch (err) {
    console.warn('Firestore notification save notice:', err);
  }

  dispatchNotificationsUpdatedEvent();
  return stamped;
}

export async function markNotificationReadApi(notificationId: string): Promise<void> {
  try {
    const current = localStorage.getItem('cotton_nest_notifications');
    if (current) {
      const list: AppNotification[] = JSON.parse(current);
      const updated = list.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
      localStorage.setItem('cotton_nest_notifications', JSON.stringify(updated));
    }
  } catch {}

  try {
    await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    });
  } catch {}

  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: Date.now(),
    });
  } catch {}

  dispatchNotificationsUpdatedEvent();
}

export async function markAllNotificationsReadApi(recipientId?: string): Promise<void> {
  try {
    const current = localStorage.getItem('cotton_nest_notifications');
    if (current) {
      const list: AppNotification[] = JSON.parse(current);
      const updated = list.map((n) => ({ ...n, isRead: true }));
      localStorage.setItem('cotton_nest_notifications', JSON.stringify(updated));
    }
  } catch {}

  try {
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId }),
    });
  } catch {}

  try {
    const snap = await getDocs(collection(db, 'notifications'));
    snap.forEach((d) => {
      const n = d.data() as AppNotification;
      if (!recipientId || n.recipientId === recipientId || n.recipientId === 'all') {
        updateDoc(doc(db, 'notifications', d.id), { isRead: true }).catch(() => {});
      }
    });
  } catch {}

  dispatchNotificationsUpdatedEvent();
}

export async function clearAllNotificationsApi(recipientId?: string): Promise<void> {
  try {
    localStorage.removeItem('cotton_nest_notifications');
  } catch {}

  try {
    const qs = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    await fetch(`/api/notifications${qs}`, { method: 'DELETE' });
  } catch {}

  try {
    const snap = await getDocs(collection(db, 'notifications'));
    snap.forEach((d) => {
      const n = d.data() as AppNotification;
      if (!recipientId || n.recipientId === recipientId || n.recipientId === 'all') {
        deleteDoc(doc(db, 'notifications', d.id)).catch(() => {});
      }
    });
  } catch {}

  dispatchNotificationsUpdatedEvent();
}

// ---------------- BACK-IN-STOCK SUBSCRIPTIONS ---------------- //

export async function saveStockSubscriptionApi(sub: StockSubscription): Promise<void> {
  const cleanSub: StockSubscription = {
    ...sub,
    createdAt: sub.createdAt || Date.now(),
    notified: false,
  };
  try {
    await setDoc(doc(db, 'stock_subscriptions', cleanSub.id), cleanSub);
  } catch (err) {
    console.warn('Firestore stock subscription notice:', err);
  }

  try {
    const saved = localStorage.getItem('cotton_nest_stock_subs');
    const list: StockSubscription[] = saved ? JSON.parse(saved) : [];
    list.push(cleanSub);
    localStorage.setItem('cotton_nest_stock_subs', JSON.stringify(list));
  } catch {}
}

export async function getStockSubscriptionsApi(productId?: string): Promise<StockSubscription[]> {
  try {
    const snap = await getDocs(collection(db, 'stock_subscriptions'));
    if (!snap.empty) {
      const list: StockSubscription[] = [];
      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as StockSubscription;
        if (!productId || item.productId === productId) {
          list.push(item);
        }
      });
      return list;
    }
  } catch {}
  return [];
}

// ---------------- PUSH SUBSCRIPTIONS ---------------- //

export async function savePushSubscriptionApi(pushSub: PushSubscriptionData): Promise<void> {
  try {
    const subId = `sub_${encodeURIComponent(pushSub.customerIdentifier)}_${Date.now()}`;
    await setDoc(doc(db, 'push_subscriptions', subId), pushSub);
  } catch (err) {
    console.warn('Push subscription persistence notice:', err);
  }
}

// ---------------- CUSTOMER WISHLISTS API ---------------- //

/**
 * Fetch all wishlisted items (for Admin Panel), or filtered by customerId.
 * Resiliently queries Firestore first, then falls back to /api/wishlists Express endpoint.
 */
export async function getWishlistsApi(customerId?: string): Promise<WishlistItem[]> {
  const mergedMap = new Map<string, WishlistItem>();

  // 1. Fetch from Firestore wishlists collection
  try {
    const snap = await getDocs(collection(db, 'wishlists'));
    if (!snap.empty) {
      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as WishlistItem;
        if (item && item.id) {
          if (!customerId || item.customerId === customerId) {
            mergedMap.set(item.id, item);
          }
        }
      });
    }
  } catch {
    // Continue to other sources
  }

  // 2. Fetch from Firestore site_content/wishlists_registry fallback
  try {
    const regSnap = await getDoc(doc(db, 'site_content', 'wishlists_registry'));
    if (regSnap.exists()) {
      const data = regSnap.data();
      if (data && Array.isArray(data.items)) {
        (data.items as WishlistItem[]).forEach((item) => {
          if (item && item.id && (!customerId || item.customerId === customerId)) {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }
        });
      }
    }
  } catch {}

  // 3. Fetch from Express /api/wishlists backend endpoint
  try {
    const url = customerId ? `/api/wishlists?customerId=${encodeURIComponent(customerId)}` : '/api/wishlists';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item: WishlistItem) => {
          if (item && item.id && (!customerId || item.customerId === customerId)) {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }
        });
      }
    }
  } catch {}

  return Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Saves a wishlisted item to both Firestore and local server database.
 */
export async function saveWishlistItemApi(item: WishlistItem): Promise<WishlistItem> {
  const safeItem = stripUndefined(item);

  // 1. Save to Firestore wishlists collection or site_content/wishlists_registry fallback
  try {
    await setDoc(doc(db, 'wishlists', item.id), safeItem);
  } catch {
    try {
      const regRef = doc(db, 'site_content', 'wishlists_registry');
      const regSnap = await getDoc(regRef);
      const currentItems: WishlistItem[] =
        regSnap.exists() && Array.isArray(regSnap.data()?.items) ? regSnap.data().items : [];
      const filtered = currentItems.filter((w) => w.id !== item.id);
      await setDoc(regRef, { items: [safeItem, ...filtered], updatedAt: Date.now() }, { merge: true });
    } catch {}
  }

  // 2. Save to Express server store_db.json
  try {
    await fetch('/api/wishlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeItem),
    });
  } catch {}

  return item;
}

/**
 * Removes a wishlisted item from both Firestore and local server database.
 */
export async function removeWishlistItemApi(id: string): Promise<void> {
  // 1. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'wishlists', id));
  } catch {
    try {
      const regRef = doc(db, 'site_content', 'wishlists_registry');
      const regSnap = await getDoc(regRef);
      if (regSnap.exists() && Array.isArray(regSnap.data()?.items)) {
        const filtered = (regSnap.data().items as WishlistItem[]).filter((w) => w.id !== id);
        await setDoc(regRef, { items: filtered, updatedAt: Date.now() }, { merge: true });
      }
    } catch {}
  }

  // 2. Delete from Express server
  try {
    await fetch(`/api/wishlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}
}

// ---------------- AI BEDSHEET DESCRIPTION GENERATOR API ---------------- //
export interface AiDescriptionPayload {
  name?: string;
  fabric?: string;
  colorTone?: string;
  pattern?: string;
  dimensions?: string;
  threadCount?: string;
  pillowCovers?: string;
  collection?: string;
  features?: string[];
  style?: 'elegant' | 'luxurious' | 'minimal' | 'detailed' | 'playful';
  customNotes?: string;
  imageUrl?: string;
}

export interface AiDescriptionResult {
  success: boolean;
  description: string;
  source: 'gemini' | 'atelier_engine';
  style: string;
  model?: string;
  warnings?: string;
  error?: string;
}

function fallbackClientDescription(payload: AiDescriptionPayload): string {
  const fabric = payload.fabric?.trim() || '100% Pure Combed Cotton';
  const threadCount = payload.threadCount?.trim() || '350 Thread Count';
  const dimensions = payload.dimensions?.trim() || '108 x 108 inches King';
  const pattern = payload.pattern?.trim() || 'Artisanal Motifs';
  const colorTone = payload.colorTone?.trim() || 'Cream & Pastel';
  const style = payload.style || 'elegant';

  const isKids =
    style === 'playful' ||
    ['kid', 'child', 'baby', 'nursery', 'safari', 'animal', 'dino', 'cartoon', 'teddy', 'cute', 'star'].some((w) =>
      `${payload.name || ''} ${payload.pattern || ''} ${payload.collection || ''}`.toLowerCase().includes(w)
    );

  const patternLower = pattern.toLowerCase();
  const colorLower = colorTone.toLowerCase().replace(/palette/i, '').trim();

  const styleAdjMap: Record<string, string> = {
    playful: 'A delightful',
    elegant: 'An elegant',
    luxurious: 'A luxurious',
    minimal: 'A crisp, contemporary',
    detailed: 'A beautifully detailed',
  };
  const leadAdj = isKids ? 'A delightful' : (styleAdjMap[style] || 'An elegant');

  let arrangement = 'arranged in a repeating pattern';
  if (isKids || patternLower.includes('animal') || patternLower.includes('cartoon') || patternLower.includes('star') || patternLower.includes('safari') || patternLower.includes('dino')) {
    arrangement = 'arranged in a cheerful storybook pattern';
  } else if (patternLower.includes('floral') || patternLower.includes('rose') || patternLower.includes('botanical') || patternLower.includes('vine')) {
    arrangement = 'arranged in a graceful trailing floral pattern';
  } else if (patternLower.includes('geometric') || patternLower.includes('stripe') || patternLower.includes('check') || patternLower.includes('trellis')) {
    arrangement = 'arranged in a clean repeating grid';
  } else if (patternLower.includes('elephant') || patternLower.includes('jaipuri') || patternLower.includes('booti') || patternLower.includes('ethnic') || patternLower.includes('heritage')) {
    arrangement = 'arranged in a repeating pattern';
  }

  let borderVibe = 'add a vibrant, elegant touch to the overall design';
  if (isKids) {
    borderVibe = "add a sweet, playful touch to any child's bedroom";
  } else if (patternLower.includes('elephant') || patternLower.includes('heritage') || patternLower.includes('ethnic') || patternLower.includes('jaipuri')) {
    borderVibe = 'add a vibrant, ethnic touch to the overall design';
  } else if (patternLower.includes('floral') || patternLower.includes('rose') || patternLower.includes('botanical')) {
    borderVibe = 'add a serene, romantic garden touch to the overall design';
  } else if (patternLower.includes('geometric') || style === 'minimal') {
    borderVibe = 'add a sophisticated, modern touch to the overall design';
  } else if (style === 'luxurious') {
    borderVibe = 'add an opulent, regal touch to the overall design';
  }

  const motifTerm = patternLower.includes('motif') || patternLower.includes('print') || patternLower.includes('pattern')
    ? pattern
    : `${pattern} motifs`;
  const sentence1 = `${leadAdj} ${colorLower} bedsheet featuring ${motifTerm} ${arrangement}.`;
  const sentence2 = `The rich contrasting borders and matching pillow accents ${borderVibe}.`;
  const sentence3 = isKids
    ? `Tailored from hypoallergenic, ultra-gentle ${fabric} (${threadCount}) for soft, peaceful nights.`
    : `Tailored from breathable ${fabric} in generous ${dimensions} for everyday luxury and effortless drape.`;

  return `${sentence1} ${sentence2} ${sentence3}`;
}

export async function generateProductDescriptionApi(payload: AiDescriptionPayload): Promise<AiDescriptionResult> {
  try {
    const res = await fetch('/api/ai/generate-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data: AiDescriptionResult = await res.json();
      return data;
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('Server AI endpoint notice, using atelier fallback:', errData);
      return {
        success: true,
        description: fallbackClientDescription(payload),
        source: 'atelier_engine',
        style: payload.style || 'elegant',
        warnings: errData.error || `Server notice (${res.status})`,
      };
    }
  } catch (err: any) {
    console.warn('Network issue reaching AI description endpoint, using atelier fallback:', err);
    return {
      success: true,
      description: fallbackClientDescription(payload),
      source: 'atelier_engine',
      style: payload.style || 'elegant',
      warnings: err?.message || 'Generated via Cotton Nest copywriter',
    };
  }
}

// ---------------- GMAIL SMTP EMAIL OTP VERIFICATION API ---------------- //

export interface SendEmailOtpResult {
  success: boolean;
  message?: string;
  verificationToken?: string;
  error?: string;
  authErrorDetails?: {
    senderEmail: string;
    fullSenderEmail: string;
    passLength: number;
    is16Chars: boolean;
    helpUrl: string;
  };
  cooldownSeconds?: number;
  status: number;
}

export interface VerifyEmailOtpResult {
  success: boolean;
  message?: string;
  error?: string;
  status: number;
}

export async function sendEmailOtpApi(email: string): Promise<SendEmailOtpResult> {
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      // If Vercel returned a plain-text or HTML crash page instead of JSON, surface it
      const snippet = rawText ? rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) : '';
      data = {
        error: `Server returned HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`,
      };
    }
    return {
      success: res.ok && data.success !== false,
      message: data.message,
      verificationToken: data.verificationToken,
      error: data.error || (!res.ok ? `Server HTTP ${res.status} error` : undefined),
      authErrorDetails: data.authErrorDetails,
      cooldownSeconds: data.cooldownSeconds,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Unable to reach the email verification server (${err?.message || 'network error'}).`,
      status: 0,
    };
  }
}

export async function verifyEmailOtpApi(
  email: string,
  otp: string,
  verificationToken?: string
): Promise<VerifyEmailOtpResult> {
  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        verificationToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success !== false,
      message: data.message,
      error: data.error,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to verify code with server. Please check your network and try again.',
      status: 0,
    };
  }
}

// ---------------- STORE TRAFFIC & ANALYTICS ---------------- //
import {
  SiteTrafficData,
  getInitialTrafficData,
  getStoredTraffic,
  saveStoredTraffic,
  recordLocalPageView,
} from '../data/analytics';

export async function getSiteAnalyticsApi(): Promise<SiteTrafficData> {
  const local = getStoredTraffic();
  try {
    const ref = doc(db, 'site_content', 'site_traffic');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const remote = snap.data() as Partial<SiteTrafficData>;
      const merged: SiteTrafficData = {
        ...local,
        ...remote,
        pageViewsByDate: { ...local.pageViewsByDate, ...(remote.pageViewsByDate || {}) },
        pageViewsBySection: { ...local.pageViewsBySection, ...(remote.pageViewsBySection || {}) },
        trafficSources: { ...local.trafficSources, ...(remote.trafficSources || {}) },
        deviceBreakdown: { ...local.deviceBreakdown, ...(remote.deviceBreakdown || {}) },
      };
      saveStoredTraffic(merged);
      return merged;
    } else {
      return local;
    }
  } catch {
    return local;
  }
}

export async function recordPageVisitApi(section: string = 'home'): Promise<SiteTrafficData> {
  const updated = recordLocalPageView(section);
  return updated;
}

// ---------------- RETURN / EXCHANGE / COMPLAINTS API ---------------- //

export async function getComplaintsApi(filters?: {
  orderId?: string;
  email?: string;
  phone?: string;
  userId?: string;
}): Promise<OrderComplaint[]> {
  const complaintMap = new Map<string, OrderComplaint>();

  const upsertComplaint = (c: OrderComplaint) => {
    if (!c || !c.id || !c.orderId || !c.productId) return;
    // Ensure photos never contain base64 data URIs
    if (Array.isArray(c.photos)) {
      c.photos = c.photos.filter(
        (p) => p && typeof p.url === 'string' && !p.url.startsWith('data:') && !p.url.startsWith('blob:')
      );
    }
    const existing = complaintMap.get(c.id);
    if (!existing) {
      complaintMap.set(c.id, c);
    } else {
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(c.updatedAt || c.createdAt || 0).getTime();
      if (incomingTime >= existingTime) {
        complaintMap.set(c.id, c);
      }
    }
  };

  // 1. Fetch from Firestore site_content/complaints_registry
  try {
    const regSnap = await getDoc(doc(db, 'site_content', 'complaints_registry'));
    if (regSnap.exists()) {
      const data = regSnap.data();
      if (data && Array.isArray(data.items)) {
        (data.items as OrderComplaint[]).forEach(upsertComplaint);
      }
    }
  } catch (err) {
    console.warn('Firestore complaints_registry fetch notice:', err);
  }

  // 2. Fetch from Express server backend (/api/complaints)
  try {
    const params = new URLSearchParams();
    if (filters?.orderId) params.set('orderId', filters.orderId);
    if (filters?.email) params.set('email', filters.email);
    if (filters?.phone) params.set('phone', filters.phone);
    if (filters?.userId) params.set('userId', filters.userId);
    const qs = params.toString();
    const res = await fetch(`/api/complaints${qs ? `?${qs}` : ''}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const serverList: OrderComplaint[] = await res.json();
      if (Array.isArray(serverList)) {
        serverList.forEach(upsertComplaint);
      }
    }
  } catch (err) {
    console.warn('Backend /api/complaints fetch notice:', err);
  }

  // 3. Check localStorage cache
  try {
    const cached = localStorage.getItem('cotton_nest_complaints');
    if (cached) {
      const localList: OrderComplaint[] = JSON.parse(cached);
      if (Array.isArray(localList)) {
        localList.forEach(upsertComplaint);
      }
    }
  } catch {}

  let all = Array.from(complaintMap.values());
  all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Update local cache with full merged set if unfiltered
  if (!filters?.orderId && !filters?.email && !filters?.phone && !filters?.userId) {
    try {
      localStorage.setItem('cotton_nest_complaints', JSON.stringify(all));
    } catch {}
  }

  // Apply client-side filter if requested
  if (filters?.orderId) {
    const targetOrder = filters.orderId.trim().toLowerCase();
    return all.filter((c) => c.orderId?.toLowerCase() === targetOrder);
  }

  if (filters?.email || filters?.phone || filters?.userId) {
    const cleanEmail = filters.email ? filters.email.trim().toLowerCase() : '';
    const cleanPhone = normalizePhoneDigits(filters.phone);
    const cleanUserId = filters.userId ? filters.userId.trim() : '';

    return all.filter((c) => {
      const cEmail = c.customerEmail ? c.customerEmail.trim().toLowerCase() : '';
      const cPhone = normalizePhoneDigits(c.customerPhone);
      const cUserId = c.userId ? c.userId.trim() : '';

      const matchesEmail = Boolean(cleanEmail && cEmail && cEmail === cleanEmail);
      const matchesPhone = Boolean(cleanPhone && cPhone && cPhone === cleanPhone);
      const matchesUserId = Boolean(cleanUserId && cUserId && cUserId === cleanUserId);

      return matchesEmail || matchesPhone || matchesUserId;
    });
  }

  return all;
}

export async function submitComplaintApi(
  input: ComplaintSubmissionInput,
  order: Order
): Promise<OrderComplaint> {
  // 1. Validate locally first
  const localValidation = validateComplaintSubmission(input, order);
  if (!localValidation.valid || !localValidation.complaint) {
    throw new Error(localValidation.error || 'Complaint validation failed.');
  }

  let savedComplaint: OrderComplaint = stripUndefined(localValidation.complaint);

  // 2. Submit to Express backend (/api/complaints) which verifies order ownership & product membership
  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        id: savedComplaint.id,
        orderSnapshot: stripUndefined(order),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || 'Backend complaint verification failed.');
    }
    if (data && data.id) {
      savedComplaint = stripUndefined(data as OrderComplaint);
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('ownership') || err.message.includes('not part of Order') || err.message.includes('Base64'))) {
      throw err;
    }
    console.warn('Backend /api/complaints submission notice:', err);
  }

  // 3. Persist to localStorage
  try {
    const cached = localStorage.getItem('cotton_nest_complaints');
    const list: OrderComplaint[] = cached ? JSON.parse(cached) : [];
    const filtered = Array.isArray(list) ? list.filter((c) => c.id !== savedComplaint.id) : [];
    localStorage.setItem('cotton_nest_complaints', JSON.stringify([savedComplaint, ...filtered]));
  } catch {}

  // 4. Sync to Firestore site_content/complaints_registry for real-time cross-client updates
  try {
    const regRef = doc(db, 'site_content', 'complaints_registry');
    const regSnap = await getDoc(regRef);
    const currentItems: OrderComplaint[] =
      regSnap.exists() && Array.isArray(regSnap.data()?.items) ? regSnap.data().items : [];
    const filtered = currentItems.filter((c) => c.id !== savedComplaint.id);
    await setDoc(
      regRef,
      stripUndefined({
        id: 'complaints_registry',
        items: [savedComplaint, ...filtered],
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore complaints_registry write notice:', err);
  }

  // 5. Generate and save notifications for the customer & admin
  try {
    const customerNotif = buildComplaintNotificationForCustomer(savedComplaint, 'submitted');
    const adminNotif = buildComplaintNotificationForAdmin(savedComplaint);
    await saveNotificationApi(customerNotif);
    await saveNotificationApi(adminNotif);
  } catch (notifErr) {
    console.warn('Complaint submission notification notice:', notifErr);
  }

  return savedComplaint;
}

export async function updateComplaintStatusApi(
  complaintId: string,
  update: {
    status?: ComplaintStatus;
    adminResponse?: string;
    respondedBy?: string;
  },
  existingComplaint?: OrderComplaint
): Promise<OrderComplaint> {
  let targetComplaint = existingComplaint;
  if (!targetComplaint) {
    const all = await getComplaintsApi();
    targetComplaint = all.find((c) => c.id === complaintId);
  }
  if (!targetComplaint) {
    throw new Error('Complaint record not found.');
  }

  const localRes = applyAdminComplaintUpdate(targetComplaint, update);
  if (!localRes.valid || !localRes.complaint) {
    throw new Error(localRes.error || 'Invalid complaint update.');
  }

  let updatedComplaint: OrderComplaint = stripUndefined(localRes.complaint);

  // 1. Update on Express server (/api/complaints/:id)
  try {
    const res = await fetch(`/api/complaints/${encodeURIComponent(complaintId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...update,
        complaintSnapshot: stripUndefined(targetComplaint),
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && serverData.id) {
        updatedComplaint = stripUndefined(serverData as OrderComplaint);
      }
    }
  } catch (err) {
    console.warn('Backend /api/complaints PATCH notice:', err);
  }

  // 2. Update localStorage
  try {
    const cached = localStorage.getItem('cotton_nest_complaints');
    const list: OrderComplaint[] = cached ? JSON.parse(cached) : [];
    if (Array.isArray(list)) {
      const nextList = list.some((c) => c.id === updatedComplaint.id)
        ? list.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
        : [updatedComplaint, ...list];
      localStorage.setItem('cotton_nest_complaints', JSON.stringify(nextList));
    }
  } catch {}

  // 3. Update Firestore site_content/complaints_registry so customer tracking updates in real time
  try {
    const regRef = doc(db, 'site_content', 'complaints_registry');
    const regSnap = await getDoc(regRef);
    const currentItems: OrderComplaint[] =
      regSnap.exists() && Array.isArray(regSnap.data()?.items) ? regSnap.data().items : [];
    const nextItems = currentItems.some((c) => c.id === updatedComplaint.id)
      ? currentItems.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
      : [updatedComplaint, ...currentItems];
    await setDoc(
      regRef,
      stripUndefined({
        id: 'complaints_registry',
        items: nextItems,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore complaints_registry update notice:', err);
  }

  // 4. Send real-time notification to the customer that Cotton Nest responded or updated status
  try {
    const eventType =
      update.adminResponse && update.adminResponse.trim().length > 0
        ? 'admin_responded'
        : 'status_updated';
    const customerNotif = buildComplaintNotificationForCustomer(updatedComplaint, eventType);
    await saveNotificationApi(customerNotif);
    triggerLocalPushNotification(customerNotif.title, customerNotif.message, { url: '/#orders' }).catch(() => {});
  } catch (notifErr) {
    console.warn('Complaint status update notification notice:', notifErr);
  }

  return updatedComplaint;
}

// ---------------- LOYALTY POINTS & REWARDS ---------------- //
export * from './loyaltyApi';
export * from '../data/loyalty';
export * from '../data/complaints';

// ---------------- ORDER INVOICE EMAIL API ---------------- //
export async function sendInvoiceEmailApi(payload: any): Promise<void> {
  if (!payload || payload.status === 'pending' || payload.status === 'cancelled') {
    return;
  }
  try {
    await fetch('/api/send-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Could not dispatch order invoice email:', err);
  }
}

// ---------------- WISHLIST NOTIFICATION MANAGEMENT API ---------------- //
export interface WishlistNotificationSettings {
  enabled: boolean;
  dailyLimit: number;
  weeklyLimit: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  cooldownHours: number;
}

export async function getWishlistNotificationSettingsApi(): Promise<WishlistNotificationSettings> {
  try {
    const res = await fetch('/api/wishlist-notification-settings');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {
    enabled: true,
    dailyLimit: 1,
    weeklyLimit: 3,
    quietHoursStart: 21,
    quietHoursEnd: 9,
    cooldownHours: 48,
  };
}

export async function saveWishlistNotificationSettingsApi(
  settings: WishlistNotificationSettings
): Promise<WishlistNotificationSettings> {
  const res = await fetch('/api/wishlist-notification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Failed to save wishlist notification settings');
}

export async function getWishlistNotificationHistoryApi(): Promise<Record<string, any>> {
  try {
    const res = await fetch('/api/wishlist-notification-history');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {};
}

export async function saveWishlistNotificationHistoryApi(payload: {
  userId: string;
  [key: string]: any;
}): Promise<any> {
  const res = await fetch('/api/wishlist-notification-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Failed to save wishlist notification history');
}

export async function evaluateWishlistReminderApi(payload: {
  userId: string;
  wishlistItems: any[];
  orders: any[];
}): Promise<any> {
  const res = await fetch('/api/wishlist-reminders/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    return await res.json();
  }
  return { canSend: false, reason: 'Network error evaluating wishlist reminder' };
}
