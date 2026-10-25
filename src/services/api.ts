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

// ---------------- IMAGE UPLOAD & HOSTING ---------------- //
export async function uploadImageApi(imageInput: string | File, productId?: string): Promise<string> {
  // If already hosted on Cloudinary or external HTTPS URL, save reference and return
  if (typeof imageInput === 'string' && (isCloudinaryUrl(imageInput) || imageInput.startsWith('http'))) {
    if (productId) {
      try {
        await setDoc(doc(db, 'custom_images', productId), {
          productId,
          imageUrl: imageInput,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not record custom_images reference:', err);
      }
    }
    return imageInput;
  }

  // Upload to Cloudinary hosting via signed direct upload
  const uploadResult = await uploadToCloudinary(imageInput, productId);
  const cloudUrl = uploadResult.url;

  if (productId && cloudUrl) {
    try {
      await setDoc(doc(db, 'custom_images', productId), {
        productId,
        imageUrl: cloudUrl,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not record custom_images in Firestore:', err);
    }
  }

  return cloudUrl;
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
        image: resolveBedsheetImage(p.image, p.id),
      }));
    }

    const products: BedsheetProduct[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as BedsheetProduct;
      products.push({
        ...data,
        id: docSnap.id,
        image: resolveBedsheetImage(data.image, docSnap.id, data.updatedAt),
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
    const cleanProduct: BedsheetProduct = {
      ...product,
      updatedAt: Date.now(),
      image: resolveBedsheetImage(product.image, product.id),
    };
    await setDoc(doc(db, 'products', product.id), cleanProduct);
    return cleanProduct;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateSingleProduct(id: string, updates: Partial<BedsheetProduct>): Promise<void> {
  const path = `products/${id}`;
  try {
    const cleanUpdates = {
      ...updates,
      updatedAt: Date.now(),
    };
    await updateDoc(doc(db, 'products', id), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function removeProduct(id: string): Promise<void> {
  const path = `products/${id}`;
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Atomic batch order update for bedsheets.
 * Updates ONLY the `order` field on each product without overwriting product details,
 * fixing the reorder bug where rearranged cards overwrote newer records.
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
    products.forEach((p, idx) => {
      const productRef = doc(db, 'products', p.id);
      batch.set(
        productRef,
        {
          ...p,
          order: typeof p.order === 'number' ? p.order : idx,
          updatedAt: Date.now(),
          image: resolveBedsheetImage(p.image, p.id),
        },
        { merge: true }
      );
    });
    await batch.commit();
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
      return docSnap.data() as SiteContent;
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
    await setDoc(doc(db, 'site_content', 'main'), {
      ...content,
      updatedAt: Date.now(),
    });
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
