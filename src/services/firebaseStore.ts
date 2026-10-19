import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { BedsheetProduct, BEDSHEETS_CATALOG } from '../data/products';
import { Review, INITIAL_REVIEWS } from '../data/reviews';
import { compressImage } from '../utils/imageCompressor';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { savePersistentProducts, savePersistentImage, getAllPersistentImages } from '../utils/persistentStorage';
import { uploadToCloudinary } from './cloudinary';

/**
 * Universal Sanitizer: strips any undefined fields so Firestore setDoc never throws
 * 'Unsupported field value: undefined'.
 */
function sanitize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * 1. FETCH PRODUCTS FROM FIRESTORE (Primary Cloud Source of Truth)
 * Fetches all bedsheets from the Google Cloud Firestore 'products' collection.
 * Falls back to local persistent storage or default catalog only if offline.
 */
export async function fetchProductsFromFirestore(): Promise<BedsheetProduct[]> {
  try {
    const colRef = collection(db, 'products');
    const snap = await getDocs(colRef);

    if (!snap.empty) {
      const items: BedsheetProduct[] = [];
      snap.forEach((d) => {
        const data = d.data() as BedsheetProduct;
        if (data && data.id) {
          items.push(data);
        }
      });

      if (items.length > 0) {
        // Order consistently
        const orderMap = new Map(BEDSHEETS_CATALOG.map((p, idx) => [p.id, idx]));
        items.sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : (orderMap.get(a.id) ?? 999);
          const orderB = typeof b.order === 'number' ? b.order : (orderMap.get(b.id) ?? 999);
          return orderA - orderB;
        });

        // Resolve images cleanly
        const cleanItems = items.map((p) => ({
          ...p,
          image: resolveBedsheetImage(p.image, p.id, p.updatedAt),
        }));

        // Mirror to local cache for fast offline launch
        try {
          const maxTs = Math.max(...cleanItems.map((p) => p.updatedAt || 0), Date.now());
          savePersistentProducts(cleanItems, maxTs).catch(() => {});
          localStorage.setItem('cotton_nest_products', JSON.stringify(cleanItems));
          localStorage.setItem('cotton_nest_products_updated_at', String(maxTs));
        } catch {}

        return cleanItems;
      }
    }
  } catch (err) {
    console.warn('fetchProductsFromFirestore warning (offline or fallback):', err);
  }

  // Fallback to local storage or catalog
  try {
    const saved = localStorage.getItem('cotton_nest_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => ({
          ...p,
          image: resolveBedsheetImage(p.image, p.id, p.updatedAt),
        }));
      }
    }
  } catch {}

  return BEDSHEETS_CATALOG.map((p, idx) => ({
    ...p,
    order: idx,
    image: resolveBedsheetImage(p.image, p.id),
  }));
}

/**
 * 2. FETCH CUSTOM IMAGES FROM FIRESTORE
 * Reads all permanent user-uploaded photos from Firestore 'custom_images' collection.
 */
export async function fetchCustomImagesFromFirestore(): Promise<Record<string, string>> {
  try {
    const colRef = collection(db, 'custom_images');
    const snap = await getDocs(colRef);
    const result: Record<string, string> = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.imageUrl) {
        result[d.id] = data.imageUrl;
      }
    });
    return result;
  } catch (err) {
    console.warn('fetchCustomImagesFromFirestore warning:', err);
    return {};
  }
}

/**
 * 3. UPLOAD & SAVE PRODUCT IMAGE TO FIRESTORE
 * Compresses the image client-side to an ultra-fast high-res JPEG (~60-90KB)
 * and saves it directly to:
 *   a) Firestore 'custom_images/{productId}'
 *   b) Firestore 'products/{productId}'
 *   c) Local IndexedDB storage (so photos are permanently available offline)
 *
 * This ensures the photo is immediately visible on ALL devices (phones, tablets, PCs)
 * without dead links or container file dependencies.
 */
export async function uploadAndSaveProductImage(
  productId: string,
  imageInput: File | string
): Promise<string> {
  // 1. Upload to Cloudinary hosting (signed direct upload)
  const uploadResult = await uploadToCloudinary(imageInput, productId);
  const cloudUrl = uploadResult.url;
  const publicId = uploadResult.public_id;
  const now = Date.now();

  try {
    // 2. Save permanent HTTPS URL into custom_images in Firestore
    const imgDocRef = doc(db, 'custom_images', productId);
    await setDoc(
      imgDocRef,
      {
        productId,
        imageUrl: cloudUrl,
        public_id: publicId || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 3. Directly update the product document in Firestore with Cloudinary URL
    const prodDocRef = doc(db, 'products', productId);
    await setDoc(
      prodDocRef,
      {
        image: cloudUrl,
        cloudinaryPublicId: publicId || null,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore image update warning:', err);
    throw new Error('Image uploaded to Cloudinary, but failed to update Firestore product record.');
  }

  // 4. Mirror to local persistent cache
  savePersistentImage(productId, cloudUrl).catch(() => {});

  return cloudUrl;
}

/**
 * 4. SAVE PRODUCT DETAILS TO FIRESTORE
 * Directly updates product details (Name, Price, MRP, Dimensions, Fabric,
 * Thread Count, Description, Badge, Stock, Variants) in Google Cloud Firestore.
 * Broadcasts instantly to all connected mobile & desktop devices via real-time listeners.
 */
export async function saveProductDetailsToFirestore(
  productId: string,
  updates: Partial<BedsheetProduct>
): Promise<void> {
  const cleanUpdates = sanitize({
    ...updates,
    updatedAt: Date.now(),
  });

  try {
    const docRef = doc(db, 'products', productId);
    await setDoc(docRef, cleanUpdates, { merge: true });

    if (updates.image) {
      try {
        const imgRef = doc(db, 'custom_images', productId);
        await setDoc(imgRef, {
          productId,
          imageUrl: updates.image,
          public_id: updates.cloudinaryPublicId || null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (imgErr) {
        console.warn('custom_images mirror warning:', imgErr);
      }
    }
  } catch (err) {
    console.error('Firestore saveProductDetails error:', err);
    throw err;
  }

  // Also sync to local server API backup
  try {
    fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanUpdates),
    }).catch(() => {});
  } catch {}
}

/**
 * 5. SAVE ALL PRODUCTS TO FIRESTORE
 * Persists the entire catalog into Google Cloud Firestore.
 */
export async function saveAllProductsToFirestoreService(
  products: BedsheetProduct[]
): Promise<void> {
  const now = Date.now();
  const cleanProducts = products.map((p, idx) => ({
    ...p,
    order: typeof p.order === 'number' ? p.order : idx,
    updatedAt: p.updatedAt || now,
  }));
  const sanitized = sanitize(cleanProducts);

  try {
    await Promise.all(
      sanitized.map((p) => {
        const docRef = doc(db, 'products', p.id);
        return setDoc(docRef, p);
      })
    );
  } catch (err) {
    console.warn('Firestore saveAllProducts warning:', err);
  }

  // Mirror to local server & IndexedDB
  try {
    savePersistentProducts(cleanProducts, now).catch(() => {});
    fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanProducts),
    }).catch(() => {});
  } catch {}
}

/**
 * 6. DELETE PRODUCT FROM FIRESTORE
 */
export async function deleteProductFromFirestoreService(productId: string): Promise<void> {
  try {
    await Promise.allSettled([
      deleteDoc(doc(db, 'products', productId)),
      deleteDoc(doc(db, 'custom_images', productId)),
    ]);
  } catch (err) {
    console.warn('Firestore deleteProduct warning:', err);
  }

  try {
    fetch(`/api/products/${productId}`, { method: 'DELETE' }).catch(() => {});
  } catch {}
}

/**
 * 7. REAL-TIME PRODUCT SUBSCRIPTION
 * Listens for real-time changes in Firestore and triggers callback with latest products.
 */
export function subscribeToProductsRealtime(
  onUpdate: (products: BedsheetProduct[]) => void
): () => void {
  try {
    const colRef = collection(db, 'products');
    return onSnapshot(
      colRef,
      (snap) => {
        if (!snap.empty) {
          const items: BedsheetProduct[] = [];
          snap.forEach((d) => {
            const data = d.data() as BedsheetProduct;
            if (data && data.id) {
              items.push(data);
            }
          });

          if (items.length > 0) {
            const orderMap = new Map(BEDSHEETS_CATALOG.map((p, idx) => [p.id, idx]));
            items.sort((a, b) => {
              const orderA = typeof a.order === 'number' ? a.order : (orderMap.get(a.id) ?? 999);
              const orderB = typeof b.order === 'number' ? b.order : (orderMap.get(b.id) ?? 999);
              return orderA - orderB;
            });

            const formatted = items.map((p) => ({
              ...p,
              image: resolveBedsheetImage(p.image, p.id, p.updatedAt),
            }));

            onUpdate(formatted);
          }
        }
      },
      (err) => {
        console.warn('Firestore products real-time listener warning:', err);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to products in Firestore:', err);
    return () => {};
  }
}

/**
 * 8. FETCH REVIEWS FROM FIRESTORE
 * Reads customer reviews from Firestore 'reviews' collection.
 * Seeds initial verified reviews if collection is empty.
 */
export async function fetchReviewsFromFirestore(productId?: string): Promise<Review[]> {
  try {
    const colRef = collection(db, 'reviews');
    const snap = await getDocs(colRef);

    if (!snap.empty) {
      const items: Review[] = [];
      snap.forEach((d) => {
        const data = d.data() as Review;
        if (data && (data.customerName || (data as any).reviewerName)) {
          items.push({ ...data, id: d.id });
        }
      });

      if (items.length > 0) {
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (productId && productId !== 'all') {
          return items.filter((r) => r.productId === productId || r.productId === 'all');
        }
        return items;
      }
    }
  } catch (err) {
    console.warn('fetchReviewsFromFirestore warning:', err);
  }

  // Seed initial reviews into Firestore in background and return them
  try {
    const colRef = collection(db, 'reviews');
    INITIAL_REVIEWS.forEach((rev) => {
      setDoc(doc(colRef, rev.id), sanitize(rev)).catch(() => {});
    });
  } catch {}

  if (productId && productId !== 'all') {
    return INITIAL_REVIEWS.filter((r) => r.productId === productId || r.productId === 'all');
  }
  return INITIAL_REVIEWS;
}

/**
 * 9. ADD CUSTOMER REVIEW TO FIRESTORE
 */
export async function addReviewToFirestore(
  reviewData: Omit<Review, 'id' | 'createdAt'>
): Promise<Review> {
  const id = `rev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const fullReview: Review = {
    ...reviewData,
    id,
    createdAt: Date.now(),
    verifiedPurchase: true,
    helpfulCount: 1,
  };

  const sanitized = sanitize(fullReview);

  try {
    const docRef = doc(db, 'reviews', id);
    await setDoc(docRef, sanitized);
  } catch (err) {
    console.warn('Firestore addReview warning:', err);
  }

  return fullReview;
}

/**
 * 10. DELETE REVIEW FROM FIRESTORE (For Store Owner Moderation)
 */
export async function deleteReviewFromFirestore(reviewId: string): Promise<void> {
  try {
    const docRef = doc(db, 'reviews', reviewId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteReview warning:', err);
  }
}

/**
 * 11. REAL-TIME REVIEWS SUBSCRIPTION
 */
export function subscribeToReviewsRealtime(
  onUpdate: (reviews: Review[]) => void,
  productId?: string
): () => void {
  try {
    const colRef = collection(db, 'reviews');
    return onSnapshot(
      colRef,
      (snap) => {
        if (!snap.empty) {
          const items: Review[] = [];
          snap.forEach((d) => {
            const data = d.data() as Review;
            if (data && (data.customerName || (data as any).reviewerName)) {
              items.push({ ...data, id: d.id });
            }
          });

          if (items.length > 0) {
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            if (productId && productId !== 'all') {
              onUpdate(items.filter((r) => r.productId === productId || r.productId === 'all'));
            } else {
              onUpdate(items);
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore reviews subscription warning:', err);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to reviews in Firestore:', err);
    return () => {};
  }
}

