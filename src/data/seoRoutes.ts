export type AppRouteTab =
  | 'home'
  | 'catalogue'
  | 'seasonal'
  | 'story'
  | 'store'
  | 'orders'
  | 'tc'
  | 'reviews'
  | 'analytics';

export type PublicRouteSlug =
  | 'home'
  | 'catalogue'
  | 'seasonal'
  | 'story'
  | 'store'
  | 'reviews'
  | 'tc';

export interface RouteSeoMetadata {
  tab: AppRouteTab;
  path: string;
  canonical: string;
  title: string;
  description: string;
  preloadHeroImage: boolean;
}

export const SITE_ORIGIN = 'https://cottonnest.in';

export const PUBLIC_SUBROUTES: ReadonlyArray<Exclude<PublicRouteSlug, 'home'>> = [
  'catalogue',
  'seasonal',
  'story',
  'store',
  'reviews',
  'tc',
];

export const ROUTE_SEO_MAP: Record<AppRouteTab, RouteSeoMetadata> = {
  home: {
    tab: 'home',
    path: '/',
    canonical: `${SITE_ORIGIN}/`,
    title: 'Cotton Nest — Luxury Bed Linens',
    description:
      'Shop 100% pure combed cotton king-size bedsheets and luxury bed linens by Cotton Nest in Sector 46, Gurgaon, Haryana. Crafted for breathable everyday comfort.',
    preloadHeroImage: true,
  },
  catalogue: {
    tab: 'catalogue',
    path: '/catalogue',
    canonical: `${SITE_ORIGIN}/catalogue`,
    title: 'Pure Cotton Bedsheets Online | Cotton Nest',
    description:
      'Browse 100% pure combed cotton king-size and super king bedsheets online at Cotton Nest. Explore floral, botanical, and percale cotton designs from Gurgaon.',
    preloadHeroImage: false,
  },
  seasonal: {
    tab: 'seasonal',
    path: '/seasonal',
    canonical: `${SITE_ORIGIN}/seasonal`,
    title: 'Seasonal Pure Cotton Bedsheet Offers | Cotton Nest',
    description:
      'Explore seasonal festive deals on 100% pure combed cotton king-size bedsheets and bedding sets at Cotton Nest. Limited-time curated atelier offers.',
    preloadHeroImage: false,
  },
  story: {
    tab: 'story',
    path: '/story',
    canonical: `${SITE_ORIGIN}/story`,
    title: 'Our Pure Cotton Craftsmanship Story | Cotton Nest',
    description:
      'Discover why Cotton Nest crafts 100% pure cotton 108×108 king-size bedsheets with zero polyester, breathable weaves, and color-fast dyes for Indian homes.',
    preloadHeroImage: false,
  },
  store: {
    tab: 'store',
    path: '/store',
    canonical: `${SITE_ORIGIN}/store`,
    title: 'Visit Cotton Nest Studio — Sector 46, Gurgaon',
    description:
      'Visit Cotton Nest Bedding Studio in Sector 46, Gurgaon, Haryana – 122003. Feel our 100% pure cotton king-size bedsheets in person or order via WhatsApp.',
    preloadHeroImage: false,
  },
  reviews: {
    tab: 'reviews',
    path: '/reviews',
    canonical: `${SITE_ORIGIN}/reviews`,
    title: 'Customer Reviews & Testimonials | Cotton Nest',
    description:
      'Read verified customer reviews and ratings for Cotton Nest 100% pure combed cotton king-size bedsheets from homes across Gurgaon and India.',
    preloadHeroImage: false,
  },
  tc: {
    tab: 'tc',
    path: '/tc',
    canonical: `${SITE_ORIGIN}/tc`,
    title: 'Terms, Shipping & Return Policy | Cotton Nest',
    description:
      'Review Cotton Nest terms and conditions, pan-India shipping details, return and exchange policies, and privacy guidelines for pure cotton bedding orders.',
    preloadHeroImage: false,
  },
  orders: {
    tab: 'orders',
    path: '/orders',
    canonical: `${SITE_ORIGIN}/orders`,
    title: 'Track Your Orders | Cotton Nest',
    description:
      'Track your Cotton Nest pure cotton bedsheet order status and delivery updates.',
    preloadHeroImage: false,
  },
  analytics: {
    tab: 'analytics',
    path: '/analytics',
    canonical: `${SITE_ORIGIN}/analytics`,
    title: 'Store Analytics | Cotton Nest',
    description: 'Cotton Nest Atelier analytics dashboard.',
    preloadHeroImage: false,
  },
};

export function getRoutePath(tab: AppRouteTab): string {
  return ROUTE_SEO_MAP[tab]?.path ?? '/';
}

export function getRouteSeoMetadata(tab: AppRouteTab): RouteSeoMetadata {
  return ROUTE_SEO_MAP[tab] ?? ROUTE_SEO_MAP.home;
}

function setMetaTagContent(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function applyDocumentSeoMetadata(tab: AppRouteTab): void {
  if (typeof document === 'undefined') return;
  const meta = getRouteSeoMetadata(tab);

  if (document.title !== meta.title) {
    document.title = meta.title;
  }

  let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonical);

  setMetaTagContent('meta[name="description"]', 'name', 'description', meta.description);
  setMetaTagContent('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMetaTagContent('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMetaTagContent('meta[property="og:url"]', 'property', 'og:url', meta.canonical);
  setMetaTagContent('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  setMetaTagContent('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
}
