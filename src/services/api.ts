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
import { SiteContent, INITIAL_SITE_CONTENT } from '../data/siteContent';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from './cloudinary';
import { ProductReview, INITIAL_REVIEWS } from '../data/reviews';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from '../data/seasonal';
import { CouponOffer, INITIAL_COUPONS, evaluateCouponEligibility, CartItemLike, CouponEvaluationResult } from '../data/coupons';
import { AppNotification, StockSubscription, PushSubscriptionData, INITIAL_CUSTOMER_NOTIFICATIONS } from '../data/notifications';
import { WishlistItem } from '../data/wishlist';

// Re-export Cloudinary service helpers
export {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
  checkCloudinaryConfig,
} from './cloudinary';

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
 * strictly preventing bloated base64 data URIs from entering database records.
 */
export function cleanLinkOnly(url?: string | null, fallbackId?: string): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return resolveBedsheetImage('', fallbackId);
  }
  const trimmed = url.trim();
  // Never persist raw base64 data blobs in Firestore
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return resolveBedsheetImage('', fallbackId);
  }
  return trimmed;
}

// ---------------- IMAGE UPLOAD & HOSTING ---------------- //
export async function uploadImageApi(imageInput: string | File, productId?: string): Promise<string> {
  let hostedUrl: string;

  // If already hosted on Cloudinary or external HTTPS URL, it is already a clean link
  if (
    typeof imageInput === 'string' &&
    (isCloudinaryUrl(imageInput) || imageInput.startsWith('https://') || imageInput.startsWith('http://'))
  ) {
    hostedUrl = imageInput;
  } else {
    // Upload image to Cloudinary (with automatic resilient server fallback)
    const uploadResult = await uploadToCloudinary(imageInput, productId);
    hostedUrl = uploadResult.url;
  }

  // Strictly store link only in Firestore
  if (productId && hostedUrl) {
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
      await setDoc(
        doc(db, 'products', productId),
        {
          image: hostedUrl,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
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

// ---------------- IMAGE STATS & MEMORY PERSISTENCE ---------------- //

export async function saveUpdatedImagesStatsApi(count: number): Promise<void> {
  const path = 'custom_images_stats/summary';
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
  const path = 'custom_images_stats/summary';
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
 * Computes the total count of custom/updated photos across all bedsheets
 * (including primary images, extra gallery photos, and custom variants).
 */
export function computeUpdatedImagesCount(
  products: BedsheetProduct[],
  customImages: Record<string, string>
): number {
  const countedUrls = new Set<string>();

  // 1. Registered custom_images from Firestore
  Object.values(customImages).forEach((u) => {
    if (u && typeof u === 'string' && u.trim() !== '') {
      countedUrls.add(u);
    }
  });

  // 2. Product primary, additional, and variant images
  products.forEach((p) => {
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
 * Adds an additional gallery image to an existing product in Firestore & Cloudinary.
 */
export async function addProductGalleryImageApi(
  productId: string,
  imageInput: File | string,
  currentAdditionalImages: string[] = []
): Promise<string> {
  // 1. Upload to Cloudinary to get hosted link
  const subKey = `gallery_${Date.now()}`;
  const hostedUrl = await uploadImageApi(imageInput, `${productId}_${subKey}`);

  // 2. Append to product additionalImages and save in Firestore
  const newAdditional = [...currentAdditionalImages, hostedUrl];
  await updateSingleProduct(productId, {
    additionalImages: newAdditional,
    updatedAt: Date.now(),
  });

  return hostedUrl;
}

/**
 * Removes an additional gallery image from a product.
 */
export async function removeProductGalleryImageApi(
  productId: string,
  imageUrlToRemove: string,
  currentAdditionalImages: string[] = []
): Promise<string[]> {
  const updatedAdditional = currentAdditionalImages.filter((u) => u !== imageUrlToRemove);
  await updateSingleProduct(productId, {
    additionalImages: updatedAdditional,
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
      products.push({
        ...data,
        id: docSnap.id,
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
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addProduct(product: BedsheetProduct): Promise<BedsheetProduct> {
  const path = `products/${product.id}`;
  try {
    const cleanProduct: BedsheetProduct = stripUndefined({
      ...product,
      updatedAt: Date.now(),
      image: cleanLinkOnly(product.image, product.id),
      variants: product.variants
        ? product.variants.map((v) => ({ ...v, image: cleanLinkOnly(v.image, product.id) }))
        : [],
    });
    await setDoc(doc(db, 'products', product.id), cleanProduct, { merge: true });

    // Mirror to server database in background
    fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanProduct),
    }).catch(() => {});

    return cleanProduct;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateSingleProduct(id: string, updates: Partial<BedsheetProduct>): Promise<void> {
  const path = `products/${id}`;
  try {
    const sanitized = stripUndefined(updates);
    if (sanitized.image) {
      sanitized.image = cleanLinkOnly(sanitized.image, id);
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
    // Use setDoc with merge: true so it creates or updates safely without failing on missing doc
    await setDoc(doc(db, 'products', id), cleanUpdates, { merge: true });

    // Mirror to server in background
    fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanUpdates),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function removeProduct(id: string): Promise<void> {
  const path = `products/${id}`;
  try {
    await deleteDoc(doc(db, 'products', id));
    fetch(`/api/products/${id}`, { method: 'DELETE' }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
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
      const productRef = doc(db, 'products', id);
      batch.update(productRef, {
        order: index,
        updatedAt: Date.now(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function saveAllProducts(products: BedsheetProduct[]): Promise<void> {
  const path = 'products';
  try {
    const batch = writeBatch(db);
    const sanitizedList: BedsheetProduct[] = [];

    products.forEach((p, idx) => {
      const productRef = doc(db, 'products', p.id);
      const cleanProd: BedsheetProduct = stripUndefined({
        ...p,
        order: typeof p.order === 'number' ? p.order : idx,
        updatedAt: Date.now(),
        image: cleanLinkOnly(p.image, p.id),
        variants: p.variants
          ? p.variants.map((v) => ({ ...v, image: cleanLinkOnly(v.image, p.id) }))
          : [],
      });
      sanitizedList.push(cleanProd);
      batch.set(productRef, cleanProd, { merge: true });
    });

    await batch.commit();

    // Mirror to server in background
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizedList),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ---------------- ORDERS API (FIRESTORE) ---------------- //
export async function getOrders(): Promise<Order[]> {
  const path = 'orders';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return INITIAL_ORDERS;
    }
    const orders: Order[] = [];
    snap.forEach((docSnap) => {
      orders.push({ ...(docSnap.data() as Order), id: docSnap.id });
    });
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return orders;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return INITIAL_ORDERS;
  }
}

export async function saveOrder(order: Order): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
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
        return data;
      }
    }
    // Auto-seed Firestore so document exists
    const initialWithStamp = {
      ...INITIAL_SITE_CONTENT,
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
  } catch (err) {
    console.warn('Firestore wishlists fetch notice, trying local API:', err);
  }

  try {
    const url = customerId ? `/api/wishlists?customerId=${encodeURIComponent(customerId)}` : '/api/wishlists';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Server wishlists fetch notice:', err);
  }

  return [];
}

/**
 * Saves a wishlisted item to both Firestore and local server database.
 */
export async function saveWishlistItemApi(item: WishlistItem): Promise<WishlistItem> {
  const safeItem = stripUndefined(item);

  // 1. Save to Firestore
  try {
    await setDoc(doc(db, 'wishlists', item.id), safeItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `wishlists/${item.id}`);
  }

  // 2. Save to Express server store_db.json
  try {
    await fetch('/api/wishlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeItem),
    });
  } catch (err) {
    console.warn('Server wishlist POST notice:', err);
  }

  return item;
}

/**
 * Removes a wishlisted item from both Firestore and local server database.
 */
export async function removeWishlistItemApi(id: string): Promise<void> {
  // 1. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'wishlists', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `wishlists/${id}`);
  }

  // 2. Delete from Express server
  try {
    await fetch(`/api/wishlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Server wishlist DELETE notice:', err);
  }
}



