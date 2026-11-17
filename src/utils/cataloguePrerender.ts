import {
  isProductOutOfStock,
  normalizeCustomPrice,
  sortProductsByStockAvailability,
} from '../data/products.ts';
import { ROUTE_SEO_MAP, SITE_ORIGIN } from '../data/seoRoutes.ts';
import { getCloudinarySrcSet, isCloudinaryImageUploadUrl } from './imageUrl.ts';

export interface FirebasePublicConfig {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
}

export interface PublicCatalogueProduct {
  id: string;
  sku?: string;
  name: string;
  collection: string;
  productType: string;
  size: string;
  price: number;
  originalPrice: number;
  dimensions: string;
  pillowCovers: string;
  threadCount: string;
  fabric: string;
  pattern: string;
  colorTone: string;
  description: string;
  image: string;
  inStock: boolean;
  order: number;
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string | number;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

interface FirestoreRunQueryRow {
  document?: {
    name?: string;
    fields?: Record<string, FirestoreValue>;
  };
}

function decodeFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return Array.isArray(val.arrayValue?.values)
      ? val.arrayValue.values.map(decodeFirestoreValue)
      : [];
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

function isSubkeyId(id: string): boolean {
  return (
    id.includes('_gallery_') ||
    id.includes('_video_') ||
    id.includes('_variant_') ||
    id.includes('_media_') ||
    id.includes('_angle_')
  );
}

function sanitizePublicImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return '';
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('/images/')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://')) {
    return trimmed;
  }
  return '';
}

function sanitizeText(raw: unknown, fallback: string = ''): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeJsonLdSerialize(data: unknown): string {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function formatInrPrice(price: number): string {
  return Number(price || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

async function runFirestoreCollectionQuery(
  config: FirebasePublicConfig,
  collectionId: string,
  timeoutMs: number = 15000
): Promise<FirestoreRunQueryRow[]> {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    config.projectId
  )}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents:runQuery?key=${encodeURIComponent(
    config.apiKey
  )}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[catalogue-prerender] Failed to query Firestore collection "${collectionId}": ${reason}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `[catalogue-prerender] Firestore "${collectionId}" query failed with HTTP ${response.status}: ${errText.slice(
        0,
        300
      )}`
    );
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error(
      `[catalogue-prerender] Unexpected non-array Firestore runQuery response for "${collectionId}".`
    );
  }
  return parsed as FirestoreRunQueryRow[];
}

export async function fetchAuthoritativePublicCatalogue(
  config: FirebasePublicConfig
): Promise<PublicCatalogueProduct[]> {
  if (!config?.projectId || !config?.firestoreDatabaseId || !config?.apiKey) {
    throw new Error(
      '[catalogue-prerender] Missing projectId, firestoreDatabaseId, or apiKey in firebase-applet-config.json.'
    );
  }

  const productRows = await runFirestoreCollectionQuery(config, 'products');
  const rawDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const row of productRows) {
    const docObj = row?.document;
    if (!docObj?.name || !docObj.fields) continue;
    const id = docObj.name.split('/').pop() || '';
    if (!id || isSubkeyId(id)) continue;

    const decoded: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(docObj.fields)) {
      decoded[k] = decodeFirestoreValue(v);
    }

    if (typeof decoded.name !== 'string' || !decoded.name.trim()) continue;
    rawDocs.push({ id, data: decoded });
  }

  if (rawDocs.length === 0) {
    throw new Error(
      '[catalogue-prerender] Firestore returned 0 valid public products. Aborting build rather than publishing stale fallback data.'
    );
  }

  const needsCustomImagesFallback = rawDocs.some(
    ({ data }) => !sanitizePublicImageUrl(data.image)
  );
  const customImageMap: Record<string, string> = {};

  if (needsCustomImagesFallback) {
    const customImgRows = await runFirestoreCollectionQuery(config, 'custom_images');
    for (const row of customImgRows) {
      const docObj = row?.document;
      if (!docObj?.name || !docObj.fields) continue;
      const docId = docObj.name.split('/').pop() || '';
      if (!docId || isSubkeyId(docId)) continue;
      const imageUrl = sanitizePublicImageUrl(decodeFirestoreValue(docObj.fields.imageUrl));
      if (imageUrl) {
        customImageMap[docId] = imageUrl;
      }
    }
  }

  const publicProducts: PublicCatalogueProduct[] = [];

  for (const { id, data } of rawDocs) {
    const name = sanitizeText(data.name);
    if (!name) continue;

    const price = normalizeCustomPrice(data.price, 0);
    if (!(price > 0)) continue;

    const rawOriginalPrice = normalizeCustomPrice(data.originalPrice, price);
    const originalPrice = rawOriginalPrice >= price ? rawOriginalPrice : price;

    const image = sanitizePublicImageUrl(data.image) || customImageMap[id] || '';
    if (!image) continue;

    const stockQty =
      typeof data.stockQuantity === 'number' && Number.isFinite(data.stockQuantity)
        ? data.stockQuantity
        : undefined;
    const rawInStock = data.inStock !== false;
    const isOut = isProductOutOfStock({ inStock: rawInStock, stockQuantity: stockQty });

    const sku = sanitizeText(data.sku);
    const orderVal =
      typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 9999;

    publicProducts.push({
      id,
      ...(sku ? { sku } : {}),
      name,
      collection: sanitizeText(data.collection, 'Signature Collection'),
      productType: sanitizeText(data.productType, 'Bedsheet'),
      size: sanitizeText(data.size, 'King'),
      price,
      originalPrice,
      dimensions: sanitizeText(data.dimensions, '108 x 108 inches (274 x 274 cm)'),
      pillowCovers: sanitizeText(data.pillowCovers, '2 Pillow Covers (45 x 70 cm)'),
      threadCount: sanitizeText(data.threadCount, '350 Thread Count'),
      fabric: sanitizeText(data.fabric, '100% Pure Percale Cotton'),
      pattern: sanitizeText(data.pattern, 'Botanical Print'),
      colorTone: sanitizeText(data.colorTone, 'Ivory & Pastels'),
      description: sanitizeText(data.description, '100% pure combed cotton bedsheet.'),
      image,
      inStock: !isOut,
      order: orderVal,
    });
  }

  if (publicProducts.length === 0) {
    throw new Error(
      '[catalogue-prerender] No valid public products remained after sanitization. Aborting build.'
    );
  }

  return sortProductsByStockAvailability(publicProducts, (a, b) => a.order - b.order);
}

export function buildCatalogueJsonLd(products: PublicCatalogueProduct[]): Record<string, unknown> {
  const catalogueUrl = ROUTE_SEO_MAP.catalogue.canonical;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${catalogueUrl}#collection`,
    name: ROUTE_SEO_MAP.catalogue.title,
    description: ROUTE_SEO_MAP.catalogue.description,
    url: catalogueUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Cotton Nest',
      url: `${SITE_ORIGIN}/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: products.map((product, index) => {
        const productSchema: Record<string, unknown> = {
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.image,
          category: product.productType,
          material: product.fabric,
          size: product.size,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: String(product.price),
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            url: catalogueUrl,
          },
        };

        if (product.sku) {
          productSchema.sku = product.sku;
        }

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: productSchema,
        };
      }),
    },
  };
}

export function buildCataloguePrerenderBodyHtml(products: PublicCatalogueProduct[]): string {
  const inStockCount = products.filter((p) => p.inStock).length;

  const cardsHtml = products
    .map((product, idx) => {
      const cloudinarySrcSet = isCloudinaryImageUploadUrl(product.image)
        ? getCloudinarySrcSet(product.image, [400, 650, 960])
        : undefined;
      const srcsetAttr = cloudinarySrcSet ? ` srcset="${escapeHtml(cloudinarySrcSet)}"` : '';
      const hasDiscount = product.originalPrice > product.price;
      const availabilityLabel = product.inStock ? 'In Stock' : 'Out of Stock';
      const availabilityClass = product.inStock
        ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
        : 'text-amber-800 bg-amber-50 border-amber-200';

      return [
        `          <article data-product-id="${escapeHtml(product.id)}" class="bg-white rounded-2xl border border-[#EAE2D5] overflow-hidden flex flex-col">`,
        `            <div class="relative bg-[#F4EFE6] aspect-[4/3] overflow-hidden">`,
        `              <img src="${escapeHtml(product.image)}"${srcsetAttr} sizes="(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 390px" alt="${escapeHtml(product.name)} — ${escapeHtml(product.fabric)}" width="800" height="600" loading="${idx < 3 ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer" class="w-full h-full object-cover object-center" />`,
        `            </div>`,
        `            <div class="p-4 flex-1 flex flex-col gap-2">`,
        `              <div class="flex items-center justify-between gap-2 text-xs">`,
        `                <span class="font-medium text-[#7A6458]">${escapeHtml(product.collection)}</span>`,
        `                <span class="px-2 py-0.5 rounded-full border font-semibold ${availabilityClass}">${availabilityLabel}</span>`,
        `              </div>`,
        `              <h2 class="text-lg font-semibold text-[#2C2420]">${escapeHtml(product.name)}</h2>`,
        `              <p class="text-base font-bold text-[#8C2E46]">₹${escapeHtml(formatInrPrice(product.price))}${
          hasDiscount
            ? ` <del class="text-xs font-normal text-[#7A6458] ml-1">₹${escapeHtml(
                formatInrPrice(product.originalPrice)
              )}</del>`
            : ''
        }</p>`,
        `              <p class="text-xs text-[#6B5D55]">${escapeHtml(product.productType)} · ${escapeHtml(product.size)} · ${escapeHtml(product.dimensions)} · ${escapeHtml(product.fabric)} · ${escapeHtml(product.threadCount)}</p>`,
        `              <p class="text-xs text-[#4F433D] leading-relaxed">${escapeHtml(product.description)}</p>`,
        `            </div>`,
        `          </article>`,
      ].join('\n');
    })
    .join('\n');

  return [
    `      <nav aria-label="Cotton Nest Primary Navigation" class="sr-only">`,
    `        <a href="https://cottonnest.in/">Cotton Nest — Luxury Bed Linens Home</a>`,
    `        <a href="https://cottonnest.in/catalogue">King-Size Pure Combed Cotton Bedsheet Catalogue</a>`,
    `        <a href="https://cottonnest.in/seasonal">Seasonal Festive Collection &amp; Offers</a>`,
    `        <a href="https://cottonnest.in/story">Our Heritage &amp; Craftsmanship Story</a>`,
    `        <a href="https://cottonnest.in/store">Gurgaon Boutique Store — Sector 46, Gurgaon, Haryana</a>`,
    `        <a href="https://cottonnest.in/reviews">Customer Reviews</a>`,
    `        <a href="https://cottonnest.in/orders">Track Your Order</a>`,
    `        <a href="https://cottonnest.in/tc">Terms, Shipping &amp; Privacy Policy</a>`,
    `      </nav>`,
    `      <main id="cotton-nest-static-catalogue" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-[#2C2420]">`,
    `        <header class="mb-8 space-y-2">`,
    `          <h1 class="text-3xl sm:text-4xl font-semibold text-[#2C2420]">Pure Cotton Bedsheets Online — Cotton Nest Catalogue</h1>`,
    `          <p class="text-sm text-[#6B5D55]">Explore ${products.length} curated 100% pure cotton bedsheets and bed linens (${inStockCount} currently in stock) from Cotton Nest Bedding Studio, Sector 46, Gurgaon.</p>`,
    `        </header>`,
    `        <section aria-label="Bedsheets Catalogue Grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">`,
    cardsHtml,
    `        </section>`,
    `      </main>`,
  ].join('\n');
}

export function injectCataloguePrerenderIntoHtml(
  routeHtml: string,
  products: PublicCatalogueProduct[]
): string {
  const jsonLdScript = `    <script id="catalogue-jsonld" type="application/ld+json">\n${safeJsonLdSerialize(
    buildCatalogueJsonLd(products)
  )}\n    </script>`;

  if (!/<\/head>/i.test(routeHtml)) {
    throw new Error('[catalogue-prerender] Target catalogue HTML is missing </head>.');
  }
  const withJsonLd = routeHtml.replace(/<\/head>/i, `${jsonLdScript}\n  </head>`);

  const rootRegex = /(<div\s+id="root"\s*>)[\s\S]*?(<\/div>\s*(?=<script\b|<\/body>))/i;
  if (!rootRegex.test(withJsonLd)) {
    throw new Error(
      '[catalogue-prerender] Target catalogue HTML is missing expected <div id="root"> container.'
    );
  }

  const prerenderBody = buildCataloguePrerenderBodyHtml(products);
  return withJsonLd.replace(rootRegex, `$1\n${prerenderBody}\n    $2`);
}
