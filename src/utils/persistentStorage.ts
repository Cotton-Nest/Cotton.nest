/**
 * Persistent Storage using IndexedDB for Cotton Nest
 * Ensures uploaded photos and custom product edits NEVER reset or get lost,
 * even when localStorage quota (5MB) is exceeded or on static Vercel hosting.
 */

const DB_NAME = 'CottonNestStoreDB';
const DB_VERSION = 1;
const STORE_CUSTOM_IMAGES = 'custom_images';
const STORE_PRODUCTS = 'products';
const STORE_SETTINGS = 'settings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CUSTOM_IMAGES)) {
        db.createObjectStore(STORE_CUSTOM_IMAGES);
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS);
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ----------------- CUSTOM IMAGES PERSISTENCE ----------------- //

export async function savePersistentImage(productId: string, dataUrlOrPath: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);
    store.put(dataUrlOrPath, productId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save to IndexedDB, fallback to memory:', err);
  }
}

export async function getAllPersistentImages(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readonly');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);

    return new Promise((resolve) => {
      const result: Record<string, string> = {};
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          result[cursor.key as string] = cursor.value;
          cursor.continue();
        } else {
          resolve(result);
        }
      };

      cursorReq.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

export async function removePersistentImage(productId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);
    store.delete(productId);
  } catch {
    // ignore
  }
}

export async function clearAllPersistentImages(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);
    store.clear();
  } catch {
    // ignore
  }
}

// ----------------- PRODUCTS PERSISTENCE ----------------- //

export async function savePersistentProducts(products: any[], timestamp?: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    store.put(products, 'catalog');
    store.put(timestamp || Date.now(), 'catalog_updated_at');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save products in IndexedDB:', err);
  }
}

export async function getPersistentProducts(): Promise<any[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);

    return new Promise((resolve) => {
      const req = store.get('catalog');
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getPersistentProductsTimestamp(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);

    return new Promise((resolve) => {
      const req = store.get('catalog_updated_at');
      req.onsuccess = () => {
        if (typeof req.result === 'number') {
          resolve(req.result);
        } else {
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// ----------------- SITE CONTENT PERSISTENCE ----------------- //

export async function savePersistentContent(content: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    store.put(content, 'site_content');
    store.put(Date.now(), 'site_content_updated_at');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save content in IndexedDB:', err);
  }
}

export async function getPersistentContent(): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);

    return new Promise((resolve) => {
      const req = store.get('site_content');
      req.onsuccess = () => {
        if (req.result && typeof req.result === 'object') {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ----------------- ORDERS PERSISTENCE ----------------- //

export async function savePersistentOrders(orders: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    store.put(orders, 'orders');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save orders in IndexedDB:', err);
  }
}

export async function getPersistentOrders(): Promise<any[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);

    return new Promise((resolve) => {
      const req = store.get('orders');
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ----------------- BROWSER PERSISTENT STORAGE MANAGER ----------------- //

/**
 * Requests the browser to enable persistent storage mode so IndexedDB data
 * is NEVER automatically evicted by the browser under low disk space conditions.
 */
export async function requestBrowserPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    }
  } catch {}
  return false;
}

// Auto-request persistent storage mode on load
if (typeof window !== 'undefined') {
  requestBrowserPersistentStorage().catch(() => {});
}

/**
 * Returns the browser's available storage quota in MB and GB
 */
export async function getBrowserStorageEstimate(): Promise<{ usedMB: number; quotaGB: number; percentage: number } | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 100) / 100;
      const quotaGB = Math.round(((estimate.quota || 0) / (1024 * 1024 * 1024)) * 100) / 100;
      const percentage = quotaGB > 0 ? Math.round((usedMB / (quotaGB * 1024)) * 10000) / 100 : 0;
      return { usedMB, quotaGB, percentage };
    }
  } catch {}
  return null;
}


