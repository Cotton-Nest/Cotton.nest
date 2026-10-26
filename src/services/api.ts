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
