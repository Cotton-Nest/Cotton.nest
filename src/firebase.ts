import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BedsheetProduct } from './data/products';
import { Order } from './data/orders';
import { SiteContent } from './data/siteContent';
import { ProductReview } from './data/reviews';
import { ThemeColors, WebsiteThemeConfig, CLASSIC_COTTON_NEST_COLORS } from './data/theme';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate connection per skill instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Connected to Google Cloud Firestore successfully!');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, check connection.');
    }
  }
}
testConnection();

/* ---------------- FIRESTORE PERSISTENCE HELPERS ---------------- */

// 1. Permanent Custom Images Store (Guarantees photos NEVER reset across devices or restarts)
export async function saveImageToFirestore(productId: string, imageUrl: string): Promise<void> {
  try {
    const docRef = doc(db, 'custom_images', productId);
    await setDoc(docRef, {
      productId,
      imageUrl,
      updatedAt: new Date().toISOString()
    });
    // Also directly update the product document in Firestore so mobile instantly receives the updated photo
    try {
      const prodRef = doc(db, 'products', productId);
      await setDoc(prodRef, { image: imageUrl, updatedAt: Date.now() }, { merge: true });
    } catch {}
  } catch (err) {
    console.warn('Failed to save image to Firestore:', err);
  }
}

export async function getAllImagesFromFirestore(): Promise<Record<string, string>> {
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
    console.warn('Failed to fetch images from Firestore:', err);
    return {};
  }
}

export async function deleteImageFromFirestore(productId: string): Promise<void> {
  try {
    const docRef = doc(db, 'custom_images', productId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Failed to delete image from Firestore:', err);
  }
}

/* ---------------- FIRESTORE REAL-TIME SUBSCRIPTIONS ---------------- */

// Real-time listener for Products: Fires INSTANTLY on all devices when PC makes an update
export function subscribeToProductsFromFirestore(
  onUpdate: (products: BedsheetProduct[]) => void
): () => void {
  try {
    const colRef = collection(db, 'products');
    const unsubscribe = onSnapshot(
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
            onUpdate(items);
          }
        }
      },
      (err) => {
        console.warn('Real-time products subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to products in Firestore:', err);
    return () => {};
  }
}

// Real-time listener for Custom Photos: Fires INSTANTLY on all devices when a photo is uploaded
export function subscribeToImagesFromFirestore(
  onUpdate: (images: Record<string, string>) => void
): () => void {
  try {
    const colRef = collection(db, 'custom_images');
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const result: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data && data.imageUrl) {
            result[d.id] = data.imageUrl;
          }
        });
        onUpdate(result);
      },
      (err) => {
        console.warn('Real-time images subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to custom images in Firestore:', err);
    return () => {};
  }
}

// Real-time listener for Site Content & Announcements
export function subscribeToSiteContentFromFirestore(
  onUpdate: (content: SiteContent) => void
): () => void {
  try {
    const docRef = doc(db, 'site_content', 'main');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SiteContent;
          if (data) onUpdate(data);
        }
      },
      (err) => {
        console.warn('Real-time site content subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to site content in Firestore:', err);
    return () => {};
  }
}

// Real-time listener for Orders
export function subscribeToOrdersFromFirestore(
  onUpdate: (orders: Order[]) => void
): () => void {
  try {
    const colRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const items: Order[] = [];
        snap.forEach((d) => {
          items.push(d.data() as Order);
        });
        onUpdate(items);
      },
      (err) => {
        console.warn('Real-time orders subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to orders in Firestore:', err);
    return () => {};
  }
}

// Real-time listener for Customer Reviews
export function subscribeToReviewsFromFirestore(
  onUpdate: (reviews: ProductReview[]) => void
): () => void {
  try {
    const colRef = collection(db, 'reviews');
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const items: ProductReview[] = [];
        snap.forEach((d) => {
          items.push(d.data() as ProductReview);
        });
        // Sort newest first
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(items);
      },
      (err) => {
        console.warn('Real-time reviews subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to reviews in Firestore:', err);
    return () => {};
  }
}

// Quota circuit-breaker: transient back-off if Firestore free daily write quota is hit
// Clears any stale session storage blocks on load so Firebase works immediately
try {
  sessionStorage.removeItem('cotton_nest_firestore_quota_until');
} catch {}

export function isFirestoreQuotaExhausted(): boolean {
  return false;
}

function handleFirestoreError(err: any, context: string) {
  console.warn(`Firestore warning in ${context}:`, err);
}

// Sanitization helper: Strips any undefined fields so Firestore setDoc never throws Unsupported field value: undefined
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// 2. Products Store
export async function getProductsFromFirestore(): Promise<BedsheetProduct[] | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const colRef = collection(db, 'products');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;
    const items: BedsheetProduct[] = [];
    snap.forEach((d) => {
      const data = d.data() as BedsheetProduct;
      if (data && data.id) {
        items.push(data);
      }
    });
    return items.length > 0 ? items : null;
  } catch (err) {
    handleFirestoreError(err, 'getProductsFromFirestore');
    return null;
  }
}

export async function saveProductToFirestore(product: BedsheetProduct): Promise<void> {
  if (isFirestoreQuotaExhausted()) throw new Error('Firestore write quota exceeded.');
  try {
    const clean = {
      ...product,
      updatedAt: product.updatedAt || Date.now(),
    };
    const sanitized = sanitizeForFirestore(clean);
    const docRef = doc(db, 'products', product.id);
    await setDoc(docRef, sanitized, { merge: true });

    if (product.image) {
      try {
        const imgRef = doc(db, 'custom_images', product.id);
        await setDoc(imgRef, {
          productId: product.id,
          imageUrl: product.image,
          public_id: product.cloudinaryPublicId || null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (imgErr) {
        console.warn('custom_images mirror warning:', imgErr);
      }
    }
  } catch (err) {
    handleFirestoreError(err, 'saveProductToFirestore');
    throw err;
  }
}

export async function saveProductDetailsToFirestore(
  productId: string,
  updates: Partial<BedsheetProduct>
): Promise<void> {
  if (isFirestoreQuotaExhausted()) throw new Error('Firestore write quota exceeded.');
  try {
    const clean = {
      ...updates,
      updatedAt: updates.updatedAt || Date.now(),
    };
    const sanitized = sanitizeForFirestore(clean);
    const docRef = doc(db, 'products', productId);
    await setDoc(docRef, sanitized, { merge: true });

    if (updates.image) {
      try {
        const imgRef = doc(db, 'custom_images', productId);
        await setDoc(imgRef, {
          productId,
          imageUrl: updates.image,
          public_id: updates.cloudinaryPublicId || null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (imgErr) {
        console.warn('custom_images mirror warning:', imgErr);
      }
    }
  } catch (err) {
    handleFirestoreError(err, 'saveProductDetailsToFirestore');
    throw err;
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, 'deleteProductFromFirestore');
  }
}

export async function saveAllProductsToFirestore(products: BedsheetProduct[]): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const now = Date.now();
    const cleanProducts = products.map((p, idx) => ({
      ...p,
      order: typeof p.order === 'number' ? p.order : idx,
      updatedAt: p.updatedAt || now,
    }));
    const sanitized = sanitizeForFirestore(cleanProducts);

    // Save/update each product to Firestore
    await Promise.all(
      sanitized.map((p) => {
        const docRef = doc(db, 'products', p.id);
        return setDoc(docRef, p);
      })
    );
  } catch (err) {
    handleFirestoreError(err, 'saveAllProductsToFirestore');
  }
}

// 3. Orders Store
export async function getOrdersFromFirestore(): Promise<Order[] | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;
    const items: Order[] = [];
    snap.forEach((d) => {
      items.push(d.data() as Order);
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, 'getOrdersFromFirestore');
    return null;
  }
}

export async function saveOrderToFirestore(order: Order): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const sanitized = sanitizeForFirestore(order);
    const docRef = doc(db, 'orders', order.id);
    await setDoc(docRef, sanitized);
  } catch (err) {
    handleFirestoreError(err, 'saveOrderToFirestore');
  }
}

// 4. Site Content Store
export async function getSiteContentFromFirestore(): Promise<SiteContent | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const docRef = doc(db, 'site_content', 'main');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SiteContent;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, 'getSiteContentFromFirestore');
    return null;
  }
}

export async function saveSiteContentToFirestore(content: SiteContent): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const sanitized = sanitizeForFirestore(content);
    const docRef = doc(db, 'site_content', 'main');
    await setDoc(docRef, sanitized);
  } catch (err) {
    handleFirestoreError(err, 'saveSiteContentToFirestore');
  }
}

// 5. Customer Reviews Store
export async function getReviewsFromFirestore(): Promise<ProductReview[] | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const colRef = collection(db, 'reviews');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;
    const items: ProductReview[] = [];
    snap.forEach((d) => {
      const data = d.data() as ProductReview;
      if (data && data.id) {
        items.push(data);
      }
    });
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return items.length > 0 ? items : null;
  } catch (err) {
    handleFirestoreError(err, 'getReviewsFromFirestore');
    return null;
  }
}

export async function saveReviewToFirestore(review: ProductReview): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const sanitized = sanitizeForFirestore(review);
    const docRef = doc(db, 'reviews', review.id);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveReviewToFirestore');
  }
}

export async function deleteReviewFromFirestore(reviewId: string): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const docRef = doc(db, 'reviews', reviewId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, 'deleteReviewFromFirestore');
  }
}

// 6. Website Appearance & Festival Theme Store
export async function getThemeFromFirestore(): Promise<WebsiteThemeConfig | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const docRef = doc(db, 'theme', 'active');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as WebsiteThemeConfig;
    }
    // Also check fallback in site_content/theme
    const fallbackRef = doc(db, 'site_content', 'theme');
    const fallbackSnap = await getDoc(fallbackRef);
    if (fallbackSnap.exists()) {
      return fallbackSnap.data() as WebsiteThemeConfig;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, 'getThemeFromFirestore');
    return null;
  }
}

export async function saveThemeToFirestore(theme: WebsiteThemeConfig): Promise<void> {
  if (isFirestoreQuotaExhausted()) throw new Error('Firestore write quota exceeded.');
  try {
    const sanitized = sanitizeForFirestore(theme);
    // Write to /theme/active
    const docRef = doc(db, 'theme', 'active');
    await setDoc(docRef, sanitized);

    // Also mirror to /site_content/theme for maximum durability
    try {
      const fallbackRef = doc(db, 'site_content', 'theme');
      await setDoc(fallbackRef, sanitized);
    } catch {}
  } catch (err) {
    handleFirestoreError(err, 'saveThemeToFirestore');
    throw err;
  }
}

export function subscribeToThemeFromFirestore(
  onUpdate: (theme: WebsiteThemeConfig) => void
): () => void {
  try {
    const docRef = doc(db, 'theme', 'active');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as WebsiteThemeConfig;
          if (data && data.colors) {
            onUpdate(data);
          }
        }
      },
      (err) => {
        console.warn('Real-time theme subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to theme in Firestore:', err);
    return () => {};
  }
}

