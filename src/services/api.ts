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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BedsheetProduct, BEDSHEETS_CATALOG } from '../data/products';
import { Order, INITIAL_ORDERS } from '../data/orders';
import { SiteContent, INITIAL_SITE_CONTENT, normalizeShippingInTerms, normalizeShippingFee } from '../data/siteContent';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from './cloudinary';
import { ProductReview, INITIAL_REVIEWS } from '../data/reviews';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from '../data/seasonal';
import { CouponOffer, INITIAL_COUPONS, evaluateCouponEligibility, CartItemLike, CouponEvaluationResult } from '../data/coupons';
import { AppNotification, StockSubscription, PushSubscriptionData, INITIAL_CUSTOMER_NOTIFICATIONS } from '../data/notifications';
import { WishlistItem } from '../data/wishlist';

// Re-export Cloudinary & media service helpers
export {
  uploadToCloudinary,
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
 * Ensures Firestore documents only store clean URL links (HTTPS or relative public paths),
 * strictly preventing bloated base64 data URIs or temporary blob URLs from entering database records.
 */
export function cleanLinkOnly(url?: string | null, fallbackId?: string): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return resolveBedsheetImage('', fallbackId);
  }
  const trimmed = url.trim();
  // Never persist raw base64 data blobs or ephemeral object URLs in Firestore
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return resolveBedsheetImage('', fallbackId);
  }
  return trimmed;
}

/**
 * Filters an array of media URLs (additionalImages / videos) so only clean HTTP(S) or server /uploads/ /images/ links are stored.
 */
export function cleanMediaArray(urls?: string[]): string[] {
  if (!Array.isArray(urls)) return [];
  return Array.from(
    new Set(
      urls
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim())
        .filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'))
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
        // Clean up orphaned subkey document in background
        if (isSubkeyDocumentId(docSnap.id) || !data?.name) {
          deleteDoc(doc(db, 'products', docSnap.id)).catch(() => {});
        }
        return;
      }
      products.push({
        ...data,
        id: docSnap.id,
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

    return products;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {}
    return BEDSHEETS_CATALOG;
  }
}

export async function addProduct(product: BedsheetProduct): Promise<BedsheetProduct> {
  const path = `products/${product.id}`;
  const cleanProduct: BedsheetProduct = stripUndefined({
    ...product,
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

export async function saveAllProducts(products: BedsheetProduct[]): Promise<void> {
  const path = 'products';
  const sanitizedList: BedsheetProduct[] = [];

  (products || []).forEach((p, idx) => {
    if (!p || !p.id || isSubkeyDocumentId(p.id) || !p.name) return;
    const cleanProd: BedsheetProduct = stripUndefined({
      ...p,
      order: typeof p.order === 'number' ? p.order : idx,
      updatedAt: Date.now(),
      image: cleanLinkOnly(p.image, p.id),
      additionalImages: cleanMediaArray(p.additionalImages),
      videos: cleanMediaArray(p.videos),
      videoUrl:
        p.videoUrl && !p.videoUrl.startsWith('data:') && !p.videoUrl.startsWith('blob:')
          ? p.videoUrl
          : '',
      variants: p.variants
        ? p.variants.map((v) => ({ ...v, image: cleanLinkOnly(v.image, p.id) }))
        : [],
    });
    sanitizedList.push(cleanProd);
  });

  // Mirror to server in background
  fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitizedList),
  }).catch(() => {});

  try {
    const batch = writeBatch(db);
    sanitizedList.forEach((cleanProd) => {
      const productRef = doc(db, 'products', cleanProd.id);
      batch.set(productRef, cleanProd, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }
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

  // Sanitize strictly: remove all undefined values so Firestore does NOT reject with unsupported undefined field
  const safeOrder: Order = stripUndefined({
    ...order,
    customerEmail: order.customerEmail?.trim() || undefined,
    customerPhone: order.customerPhone?.trim() || '',
    customerAddress: order.customerAddress?.trim() || '',
    notes: order.notes?.trim() || undefined,
    userId: order.userId?.trim() || undefined,
    timeline: order.timeline && order.timeline.length > 0 ? order.timeline : [
      {
        status: order.status || 'pending',
        timestamp: order.createdAt || new Date().toISOString(),
        title: 'Order Placed via WhatsApp',
        description: 'Customer initiated order from Cotton Nest storefront.'
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
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const path = `orders/${orderId}`;
  let targetOrder: Order | undefined;

  // 1. Update local storage
  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    if (cached) {
      const list: Order[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        const updated = list.map((o) => {
          if (o.id === orderId) {
            targetOrder = o;
            return {
              ...o,
              status: status as any,
              pointsCredited: status === 'delivered' ? true : o.pointsCredited,
            };
          }
          return o;
        });
        localStorage.setItem('cotton_nest_orders', JSON.stringify(updated));
      }
    }
  } catch {}

  // 2. Update Express server backend
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(status === 'delivered' ? { pointsCredited: true } : {}),
      }),
    });
  } catch (err) {
    console.warn('Failed to update order status on server:', err);
  }

  // 3. If order is marked delivered and points were not credited yet, credit Nest Points now
  if (status === 'delivered' && targetOrder && !targetOrder.pointsCredited) {
    const rawKey = targetOrder.customerPhone || targetOrder.customerEmail || targetOrder.userId || '';
    const shippingCostVal = Number(targetOrder.shippingCost) || 0;
    const eligibleAmount = Math.max(0, (Number(targetOrder.totalAmount) || 0) - shippingCostVal);
    if (rawKey && (eligibleAmount > 0 || (targetOrder.pointsEarned && targetOrder.pointsEarned > 0))) {
      try {
        const { earnLoyaltyPointsApi } = await import('./loyaltyApi');
        await earnLoyaltyPointsApi(rawKey, eligibleAmount, orderId, {
          name: targetOrder.customerName,
          phone: targetOrder.customerPhone,
          email: targetOrder.customerEmail,
          userId: targetOrder.userId,
          explicitPoints: targetOrder.pointsEarned,
        });
      } catch (err) {
        console.warn('Failed to credit Nest Points upon delivery:', err);
      }
    }
  }

  // 4. Update Firestore
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      ...(status === 'delivered' ? { pointsCredited: true } : {}),
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
        if (normalizedTc !== data.termsAndConditions || data.shippingFeeIndia !== normalizedFee) {
          data.termsAndConditions = normalizedTc;
          data.shippingFeeIndia = normalizedFee;
          setDoc(
            doc(db, 'site_content', 'main'),
            { termsAndConditions: normalizedTc, shippingFeeIndia: normalizedFee, updatedAt: Date.now() },
            { merge: true }
          ).catch(() => {});
        }
        return data;
      }
    }
    // Auto-seed Firestore so document exists
    const initialWithStamp = {
      ...INITIAL_SITE_CONTENT,
      shippingFeeIndia: normalizeShippingFee(INITIAL_SITE_CONTENT.shippingFeeIndia),
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'site_content', 'main'), initialWithStamp, { merge: true });
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
        // Seed into Firestore in background
        serverCoupons.forEach((c) => {
          setDoc(doc(db, 'coupons', c.id), c).catch(() => {});
        });
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

export async function getNotificationsApi(
  recipientId?: string,
  isOwner?: boolean
): Promise<AppNotification[]> {
  try {
    const list: AppNotification[] = [];
    const snapshot = await getDocs(collection(db, 'notifications'));
    if (!snapshot.empty) {
      snapshot.forEach((docSnap) => {
        const item = { id: docSnap.id, ...docSnap.data() } as AppNotification;
        if (isOwner) {
          list.push(item);
        } else {
          // Customers only see 'all' or specifically addressed to their email/phone
          const isTargeted =
            item.recipientId === 'all' ||
            (recipientId && item.recipientId && item.recipientId.toLowerCase() === recipientId.toLowerCase());
          if (isTargeted && item.category !== 'admin') {
            list.push(item);
          }
        }
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      return list;
    }
  } catch (err) {
    console.warn('Firestore notifications fetch notice:', err);
  }

  // Fallback to local storage
  try {
    const local = localStorage.getItem('cotton_nest_notifications');
    if (local) {
      const parsed: AppNotification[] = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((n) => (isOwner ? true : n.category !== 'admin'));
      }
    }
  } catch {}

  return INITIAL_CUSTOMER_NOTIFICATIONS;
}

export async function saveNotificationApi(notification: AppNotification): Promise<AppNotification> {
  const stamped: AppNotification = {
    ...notification,
    timestamp: notification.timestamp || Date.now(),
  };

  const docData: Record<string, any> = {};
  for (const [key, val] of Object.entries(stamped)) {
    if (val !== undefined) docData[key] = val;
  }

  try {
    await setDoc(doc(db, 'notifications', stamped.id), docData, { merge: true });
  } catch (err) {
    console.warn('Firestore notification save notice:', err);
  }

  // Sync to local cache
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

  return stamped;
}

export async function markNotificationReadApi(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: Date.now(),
    });
  } catch {}

  try {
    const current = localStorage.getItem('cotton_nest_notifications');
    if (current) {
      const list: AppNotification[] = JSON.parse(current);
      const updated = list.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
      localStorage.setItem('cotton_nest_notifications', JSON.stringify(updated));
    }
  } catch {}
}

export async function markAllNotificationsReadApi(recipientId?: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'notifications'));
    snap.forEach((d) => {
      const n = d.data() as AppNotification;
      if (!recipientId || n.recipientId === recipientId || n.recipientId === 'all') {
        updateDoc(doc(db, 'notifications', d.id), { isRead: true }).catch(() => {});
      }
    });
  } catch {}

  try {
    const current = localStorage.getItem('cotton_nest_notifications');
    if (current) {
      const list: AppNotification[] = JSON.parse(current);
      const updated = list.map((n) => ({ ...n, isRead: true }));
      localStorage.setItem('cotton_nest_notifications', JSON.stringify(updated));
    }
  } catch {}
}

export async function clearAllNotificationsApi(recipientId?: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'notifications'));
    snap.forEach((d) => {
      const n = d.data() as AppNotification;
      if (!recipientId || n.recipientId === recipientId || n.recipientId === 'all') {
        deleteDoc(doc(db, 'notifications', d.id)).catch(() => {});
      }
    });
  } catch {}

  try {
    localStorage.removeItem('cotton_nest_notifications');
  } catch {}
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
  try {
    const snap = await getDocs(collection(db, 'wishlists'));
    if (!snap.empty) {
      const items: WishlistItem[] = [];
      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as WishlistItem;
        if (!customerId || item.customerId === customerId) {
          items.push(item);
        }
      });
      return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch {
    // Fallback to site_content/wishlists_registry or Express API
  }

  try {
    const regSnap = await getDoc(doc(db, 'site_content', 'wishlists_registry'));
    if (regSnap.exists()) {
      const data = regSnap.data();
      if (data && Array.isArray(data.items)) {
        const items = (data.items as WishlistItem[]).filter(
          (item) => !customerId || item.customerId === customerId
        );
        if (items.length > 0) {
          return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
      }
    }
  } catch {}

  try {
    const url = customerId ? `/api/wishlists?customerId=${encodeURIComponent(customerId)}` : '/api/wishlists';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {}

  return [];
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
    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success !== false,
      message: data.message,
      verificationToken: data.verificationToken,
      error: data.error,
      authErrorDetails: data.authErrorDetails,
      cooldownSeconds: data.cooldownSeconds,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to reach the email verification server. Please check your network and try again.',
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
      // First time initialization in Firestore
      await setDoc(ref, stripUndefined(local), { merge: true });
      return local;
    }
  } catch {
    return local;
  }
}

export async function recordPageVisitApi(section: string = 'home'): Promise<SiteTrafficData> {
  const updated = recordLocalPageView(section);
  try {
    const ref = doc(db, 'site_content', 'site_traffic');
    await setDoc(
      ref,
      stripUndefined({
        id: 'site_traffic',
        totalVisits: updated.totalVisits,
        uniqueVisitors: updated.uniqueVisitors,
        todayVisits: updated.todayVisits,
        lastVisitedAt: updated.lastVisitedAt,
        pageViewsByDate: updated.pageViewsByDate,
        pageViewsBySection: updated.pageViewsBySection,
        trafficSources: updated.trafficSources,
        deviceBreakdown: updated.deviceBreakdown,
      }),
      { merge: true }
    );
  } catch {
    // Non-blocking background firestore sync
  }
  return updated;
}

// ---------------- LOYALTY POINTS & REWARDS ---------------- //
export * from './loyaltyApi';
export * from '../data/loyalty';

