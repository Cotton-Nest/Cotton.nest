import { BedsheetProduct, BEDSHEETS_CATALOG } from '../data/products';
import { Order, INITIAL_ORDERS } from '../data/orders';
import { SiteContent, INITIAL_SITE_CONTENT } from '../data/siteContent';
import {
  savePersistentProducts,
  getPersistentProducts,
  getPersistentProductsTimestamp,
  savePersistentContent,
  getPersistentContent,
  savePersistentOrders,
  getPersistentOrders,
  getAllPersistentImages,
  savePersistentImage
} from '../utils/persistentStorage';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from './cloudinary';
import { ProductReview, INITIAL_REVIEWS } from '../data/reviews';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from '../data/seasonal';

// Cloudinary service exports
export {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
  checkCloudinaryConfig
} from './cloudinary';

// Upload Image API: Uploads image to Cloudinary (or local server) and saves to persistent storage
export async function uploadImageApi(imageInput: string | File, productId?: string): Promise<string> {
  // 1. If already hosted on Cloudinary or absolute URL, save to persistent storage and return
  if (typeof imageInput === 'string' && (isCloudinaryUrl(imageInput) || imageInput.startsWith('http'))) {
    if (productId) {
      savePersistentImage(productId, imageInput).catch(() => {});
    }
    return imageInput;
  }

  // 2. Upload to Cloudinary hosting via signed direct upload (or server fallback)
  try {
    const uploadResult = await uploadToCloudinary(imageInput, productId);
    const cloudUrl = uploadResult.url;

    if (productId && cloudUrl) {
      savePersistentImage(productId, cloudUrl).catch(() => {});
    }
    return cloudUrl;
  } catch (err) {
    console.warn('Cloudinary upload error, checking fallback:', err);
    // If string data URL, persist locally
    if (typeof imageInput === 'string' && productId) {
      savePersistentImage(productId, imageInput).catch(() => {});
      return imageInput;
    }
    throw err;
  }
}

// Products API: Loads products from server JSON database, IndexedDB, or embedded catalog
export async function getProducts(): Promise<BedsheetProduct[]> {
  // 1. Fetch from Backend Server API first (authoritative single source of truth)
  let serverProducts: BedsheetProduct[] | null = null;
  try {
    const res = await fetch(`/api/products?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        serverProducts = data;
      }
    }
  } catch {}

  // 2. Fallback to local storage only if server is unreachable
  let localProducts: BedsheetProduct[] | null = null;
  if (!serverProducts) {
    try {
      const localSaved = localStorage.getItem('cotton_nest_products');
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localProducts = parsed;
        }
      }
    } catch {}

    if (!localProducts) {
      try {
        const idbData = await getPersistentProducts().catch(() => null);
        if (Array.isArray(idbData) && idbData.length > 0) {
          localProducts = idbData;
        }
      } catch {}
    }
  }

  const authoritativeRemote = serverProducts || localProducts;

  if (authoritativeRemote && authoritativeRemote.length > 0) {
    const orderMap = new Map(BEDSHEETS_CATALOG.map((p, idx) => [p.id, idx]));
    authoritativeRemote.sort((a, b) => {
      const orderA = typeof (a as any).order === 'number' ? (a as any).order : (orderMap.get(a.id) ?? 999);
      const orderB = typeof (b as any).order === 'number' ? (b as any).order : (orderMap.get(b.id) ?? 999);
      return orderA - orderB;
    });

    const cleanMerged = authoritativeRemote.map((p) => {
      return {
        ...p,
        image: resolveBedsheetImage(p.image, p.id, p.updatedAt),
      };
    });

    try {
      localStorage.setItem('cotton_nest_products', JSON.stringify(cleanMerged));
      const serverTime = Math.max(...cleanMerged.map((p) => p.updatedAt || 0), 0);
      localStorage.setItem('cotton_nest_products_updated_at', String(serverTime));
    } catch {}

    savePersistentProducts(cleanMerged, Date.now()).catch(() => {});

    return cleanMerged;
  }

  // 5. Fallback: embedded catalog with any locally stored images
  return BEDSHEETS_CATALOG.map((p, idx) => ({
    ...p,
    order: idx,
    image: resolveBedsheetImage(p.image, p.id),
    updatedAt: 1,
  }));
}

export async function saveAllProducts(products: BedsheetProduct[]): Promise<void> {
  const saveTimestamp = Date.now();
  const orderedProducts = products.map((p, idx) => ({
    ...p,
    order: typeof p.order === 'number' ? p.order : idx,
    updatedAt: saveTimestamp,
  }));

  // 1. Synchronous localStorage save
  try {
    localStorage.setItem('cotton_nest_products', JSON.stringify(orderedProducts));
    localStorage.setItem('cotton_nest_products_updated_at', String(saveTimestamp));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }

  // 2. Save to IndexedDB and backend server API (store_db.json file)
  await Promise.allSettled([
    savePersistentProducts(orderedProducts, saveTimestamp),
    fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderedProducts),
    }).catch((err) => {
      console.warn('Server PUT /api/products failed:', err);
    }),
  ]);
}

export async function addProduct(product: BedsheetProduct): Promise<BedsheetProduct> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to post product to server, saving locally:', err);
  }
  return product;
}

export async function updateSingleProduct(id: string, product: Partial<BedsheetProduct>): Promise<void> {
  try {
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
  } catch (err) {
    console.warn('Failed to update product on server:', err);
  }
}

export async function removeProduct(id: string): Promise<void> {
  try {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Failed to delete product on server:', err);
  }
}

// Orders API
export async function getOrders(): Promise<Order[]> {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem('cotton_nest_orders', JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend orders fetch failed, falling back to local storage:', err);
  }

  try {
    const cached = localStorage.getItem('cotton_nest_orders');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return INITIAL_ORDERS;
}

export async function saveOrder(order: Order): Promise<void> {
  try {
    const cached = JSON.parse(localStorage.getItem('cotton_nest_orders') || '[]');
    localStorage.setItem('cotton_nest_orders', JSON.stringify([order, ...cached]));
  } catch {}

  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  } catch (err) {
    console.warn('Failed to post order to server:', err);
  }
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    console.warn('Failed to update order status on server:', err);
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  try {
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Failed to delete order on server:', err);
  }
}

// Site Content API
export async function getSiteContent(): Promise<SiteContent> {
  const localSaved = localStorage.getItem('cotton_nest_site_content');
  let localTimestamp = Number(localStorage.getItem('cotton_nest_site_content_updated_at') || 0);
  let localContent: SiteContent | null = null;
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      if (parsed && parsed.company) {
        localContent = parsed;
      }
    } catch {}
  }

  try {
    const idbContent = await getPersistentContent();
    if (idbContent && idbContent.company) {
      if (!localContent || (idbContent.updatedAt && idbContent.updatedAt >= localTimestamp)) {
        localContent = idbContent;
      }
    }
  } catch {}

  if (localContent) {
    return localContent;
  }

  try {
    const res = await fetch('/api/content');
    if (res.ok) {
      const data = await res.json();
      if (data && data.company) {
        try {
          localStorage.setItem('cotton_nest_site_content', JSON.stringify(data));
          localStorage.setItem('cotton_nest_site_content_updated_at', String(Date.now()));
        } catch {}
        savePersistentContent(data).catch(() => {});
        return data;
      }
    }
  } catch {}

  return INITIAL_SITE_CONTENT;
}

export async function saveSiteContentApi(content: SiteContent): Promise<void> {
  const saveTimestamp = Date.now();
  const stampedContent = {
    ...content,
    updatedAt: saveTimestamp,
  };

  try {
    localStorage.setItem('cotton_nest_site_content', JSON.stringify(stampedContent));
    localStorage.setItem('cotton_nest_site_content_updated_at', String(saveTimestamp));
  } catch {}

  savePersistentContent(stampedContent).catch(() => {});

  await fetch('/api/content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stampedContent),
  }).catch(() => {});
}

// ---------------- THEME APPEARANCE API ---------------- //
export async function getPublishedThemeApi(): Promise<any> {
  try {
    const res = await fetch('/api/theme');
    if (res.ok) {
      const data = await res.json();
      if (data && data.colors) {
        return data;
      }
    }
  } catch {}
  return null;
}

export async function savePublishedThemeApi(config: any): Promise<void> {
  try {
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch {}
}

// ---------------- CUSTOMER REVIEWS API ---------------- //
export async function getReviewsApi(): Promise<ProductReview[]> {
  try {
    const res = await fetch('/api/reviews');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem('cotton_nest_reviews', JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch {}
  try {
    const cached = localStorage.getItem('cotton_nest_reviews');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_REVIEWS;
}

export async function saveReviewApi(review: ProductReview): Promise<ProductReview> {
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to post review to server:', err);
  }
  return review;
}

export async function helpfulReviewApi(reviewId: string): Promise<void> {
  try {
    await fetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' });
  } catch {}
}

export async function deleteReviewApi(reviewId: string): Promise<void> {
  try {
    await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  } catch {}
}

// ---------------- SEASONAL PAGE & FESTIVE OFFERS API ---------------- //
export async function getSeasonalConfigApi(): Promise<SeasonalConfig> {
  try {
    const res = await fetch(`/api/seasonal?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && typeof data.name === 'string') {
        try {
          localStorage.setItem('cotton_nest_seasonal', JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch {}

  try {
    const cached = localStorage.getItem('cotton_nest_seasonal');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.name === 'string') return parsed;
    }
  } catch {}

  return INITIAL_SEASONAL_CONFIG;
}

export async function saveSeasonalConfigApi(config: SeasonalConfig): Promise<SeasonalConfig> {
  const stampedConfig: SeasonalConfig = {
    ...config,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem('cotton_nest_seasonal', JSON.stringify(stampedConfig));
  } catch {}

  try {
    const res = await fetch('/api/seasonal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stampedConfig),
    });
    if (res.ok) {
      const saved = await res.json();
      return saved;
    }
  } catch (err) {
    console.warn('Failed to save seasonal config to server:', err);
  }

  return stampedConfig;
}


