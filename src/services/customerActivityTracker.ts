import { useEffect, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../context/AuthContext';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import { WishlistItem } from '../data/wishlist';
import {
  CustomerActivityEvent,
  CustomerActivityProfile,
  CustomerSessionLog,
  CustomerWishlistSnapshotItem,
  detectCustomerDeviceInfo,
  getReadablePageLabel,
  sanitizeCustomerUid
} from '../data/customerActivity';

const COLLECTION_NAME = 'customer_activity';
const LOCAL_PROFILES_CACHE_KEY = 'cotton_nest_customer_activity_profiles_v1';
const ACTIVE_SESSION_STORAGE_PREFIX = 'cotton_nest_active_session_v1_';
const INACTIVITY_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes without interaction pauses active tracking
const PERIODIC_FLUSH_INTERVAL_MS = 30 * 1000; // Flush every 30 seconds (never every second)
const MAX_TIMELINE_EVENTS = 120;
const MAX_SESSIONS_HISTORY = 40;
const MAX_SEARCH_HISTORY = 50;
const MAX_CART_HISTORY = 50;

interface ActiveRuntimeState {
  uid: string;
  sessionId: string;
  profile: CustomerActivityProfile;
  lastInteractionAt: number;
  isIdle: boolean;
  dirty: boolean;
  isFlushing: boolean;
  lastFlushedAt: number;
  currentPage: string;
}

let runtime: ActiveRuntimeState | null = null;

function readLocalProfilesMap(): Record<string, CustomerActivityProfile> {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalProfileToCache(profile: CustomerActivityProfile): void {
  try {
    const map = readLocalProfilesMap();
    map[profile.uid] = profile;
    localStorage.setItem(LOCAL_PROFILES_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function computeMostVisitedPage(counts: Record<string, number>): string {
  let topKey = 'Home Showcase';
  let topCount = -1;
  for (const [key, count] of Object.entries(counts || {})) {
    if (count > topCount) {
      topCount = count;
      topKey = getReadablePageLabel(key);
    }
  }
  return topKey;
}

function appendTimelineEvent(
  profile: CustomerActivityProfile,
  event: Omit<CustomerActivityEvent, 'id' | 'timestamp'> & { timestamp?: number }
): void {
  const ts = event.timestamp || Date.now();
  const newEvent: CustomerActivityEvent = {
    ...event,
    id: `evt_${ts}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts
  };
  const existing = Array.isArray(profile.timeline) ? profile.timeline : [];
  // Deduplicate identical consecutive page_view or search events within 3 seconds
  if (
    existing.length > 0 &&
    existing[0].type === newEvent.type &&
    existing[0].label === newEvent.label &&
    Math.abs(ts - existing[0].timestamp) < 3000
  ) {
    return;
  }
  profile.timeline = [newEvent, ...existing].slice(0, MAX_TIMELINE_EVENTS);
}

function updateCurrentSessionInProfile(
  profile: CustomerActivityProfile,
  sessionId: string,
  updater: (session: CustomerSessionLog) => void
): void {
  if (!Array.isArray(profile.sessions)) {
    profile.sessions = [];
  }
  let session = profile.sessions.find(s => s.sessionId === sessionId);
  if (!session) {
    const now = Date.now();
    session = {
      sessionId,
      loginAt: now,
      lastActiveAt: now,
      durationSeconds: 0,
      pagesVisited: [],
      productsViewedCount: 0,
      deviceType: profile.deviceInfo.deviceType,
      os: profile.deviceInfo.os,
      browser: profile.deviceInfo.browser,
      screenResolution: profile.deviceInfo.screenResolution
    };
    profile.sessions = [session, ...profile.sessions].slice(0, MAX_SESSIONS_HISTORY);
  }
  updater(session);

  // Recompute averageSessionDurationSeconds
  const totalSessions = Math.max(1, profile.totalSessions || profile.sessions.length || 1);
  profile.averageSessionDurationSeconds = Math.round(
    (profile.totalTimeSpentSeconds || 0) / totalSessions
  );
}

/**
 * Persists the current profile to Firestore (`customer_activity/{uid}`) and backend API (`/api/customer-activity`).
 * Controlled and batched so we never spam Firestore writes.
 */
export async function flushCustomerActivityProfile(force = false): Promise<void> {
  if (!runtime) return;
  if (!force && !runtime.dirty) return;
  if (runtime.isFlushing && !force) return;

  runtime.isFlushing = true;
  runtime.dirty = false;
  const snapshotProfile: CustomerActivityProfile = {
    ...runtime.profile,
    updatedAt: Date.now()
  };
  runtime.profile.updatedAt = snapshotProfile.updatedAt;
  runtime.lastFlushedAt = snapshotProfile.updatedAt;

  writeLocalProfileToCache(snapshotProfile);

  try {
    await setDoc(doc(db, COLLECTION_NAME, snapshotProfile.uid), snapshotProfile, { merge: true });
  } catch {
    // Fallback to local/server persistence if offline or permission blocked
  }

  try {
    await fetch('/api/customer-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshotProfile),
      keepalive: true
    });
  } catch {
    // ignore network errors
  } finally {
    if (runtime) {
      runtime.isFlushing = false;
    }
  }
}

/**
 * Initializes or resumes a session for a signed-in user.
 * Reuses the active browser tab session across refreshes to avoid duplicate session inflation.
 */
export async function initOrResumeCustomerSession(
  user: UserProfile,
  initialPage = 'home',
  consentedLocationHint?: string
): Promise<CustomerActivityProfile | null> {
  if (!user || !user.id) return null;

  const uid = sanitizeCustomerUid(user.id);
  const now = Date.now();
  const deviceInfo = detectCustomerDeviceInfo(consentedLocationHint);

  // Check if this browser tab already has an active session for this UID (handles page refreshes gracefully)
  let existingTabSessionId: string | null = null;
  try {
    existingTabSessionId = sessionStorage.getItem(`${ACTIVE_SESSION_STORAGE_PREFIX}${uid}`);
  } catch {
    existingTabSessionId = null;
  }

  // Load existing profile from local cache or Firestore
  let existingProfile: CustomerActivityProfile | null = readLocalProfilesMap()[uid] || null;
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, uid));
    if (snap.exists()) {
      const remoteData = snap.data() as CustomerActivityProfile;
      if (
        !existingProfile ||
        (remoteData.totalTimeSpentSeconds || 0) >= (existingProfile.totalTimeSpentSeconds || 0)
      ) {
        existingProfile = { ...existingProfile, ...remoteData, uid };
      }
    }
  } catch {
    // fallback to local cache
  }

  const isNewSession = !existingTabSessionId;
  const sessionId = existingTabSessionId || `sess_${now}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    sessionStorage.setItem(`${ACTIVE_SESSION_STORAGE_PREFIX}${uid}`, sessionId);
  } catch {
    // ignore
  }

  const pageLabel = getReadablePageLabel(initialPage);

  if (!existingProfile) {
    const firstSession: CustomerSessionLog = {
      sessionId,
      loginAt: now,
      lastActiveAt: now,
      durationSeconds: 0,
      pagesVisited: [pageLabel],
      productsViewedCount: 0,
      deviceType: deviceInfo.deviceType,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      screenResolution: deviceInfo.screenResolution
    };

    const pageCounts: Record<string, number> = { [pageLabel]: 1 };

    existingProfile = {
      uid,
      customerName: user.name || 'Cotton Nest Customer',
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
      authProvider: user.authProvider || 'google',
      accountCreatedAt: now,
      lastLoginAt: now,
      lastActiveAt: now,
      totalSessions: 1,
      totalTimeSpentSeconds: 0,
      averageSessionDurationSeconds: 0,
      totalPagesVisited: 1,
      pageVisitCounts: pageCounts,
      mostVisitedPage: pageLabel,
      totalProductViews: 0,
      productsViewed: [],
      totalAddedToCartCount: 0,
      cartActivity: [],
      totalAddedToWishlistCount: 0,
      currentWishlist: [],
      historicalWishlist: [],
      totalSearches: 0,
      searchHistory: [],
      ordersPlacedCount: 0,
      totalPurchaseValue: 0,
      deviceInfo,
      sessions: [firstSession],
      timeline: [],
      updatedAt: now
    };

    appendTimelineEvent(existingProfile, {
      type: 'login',
      label: `User signed in (${deviceInfo.browser} on ${deviceInfo.os})`,
      sessionId,
      timestamp: now
    });
    appendTimelineEvent(existingProfile, {
      type: 'page_view',
      label: `Visited ${pageLabel}`,
      page: pageLabel,
      sessionId,
      timestamp: now + 10
    });
  } else {
    existingProfile.customerName = user.name || existingProfile.customerName || 'Cotton Nest Customer';
    if (user.email) existingProfile.email = user.email;
    if (user.phone) existingProfile.phone = user.phone;
    if (user.avatar) existingProfile.avatar = user.avatar;
    if (user.authProvider) existingProfile.authProvider = user.authProvider;
    existingProfile.deviceInfo = deviceInfo;
    existingProfile.lastActiveAt = now;

    if (isNewSession) {
      existingProfile.totalSessions = Math.max(1, (existingProfile.totalSessions || 0) + 1);
      existingProfile.lastLoginAt = now;

      const newSession: CustomerSessionLog = {
        sessionId,
        loginAt: now,
        lastActiveAt: now,
        durationSeconds: 0,
        pagesVisited: [pageLabel],
        productsViewedCount: 0,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        screenResolution: deviceInfo.screenResolution
      };
      existingProfile.sessions = [
        newSession,
        ...(Array.isArray(existingProfile.sessions) ? existingProfile.sessions : [])
      ].slice(0, MAX_SESSIONS_HISTORY);

      existingProfile.totalPagesVisited = (existingProfile.totalPagesVisited || 0) + 1;
      existingProfile.pageVisitCounts = {
        ...(existingProfile.pageVisitCounts || {}),
        [pageLabel]: ((existingProfile.pageVisitCounts || {})[pageLabel] || 0) + 1
      };
      existingProfile.mostVisitedPage = computeMostVisitedPage(existingProfile.pageVisitCounts);

      appendTimelineEvent(existingProfile, {
        type: 'login',
        label: `User signed in (${deviceInfo.browser} on ${deviceInfo.os})`,
        sessionId,
        timestamp: now
      });
    } else {
      updateCurrentSessionInProfile(existingProfile, sessionId, s => {
        s.lastActiveAt = now;
        if (!s.pagesVisited.includes(pageLabel)) {
          s.pagesVisited.push(pageLabel);
        }
      });
    }
  }

  runtime = {
    uid,
    sessionId,
    profile: existingProfile,
    lastInteractionAt: now,
    isIdle: false,
    dirty: true,
    isFlushing: false,
    lastFlushedAt: 0,
    currentPage: pageLabel
  };

  await flushCustomerActivityProfile(true);
  return existingProfile;
}

/**
 * Records a page / tab change for the signed-in customer and flushes activity
 */
export function trackCustomerPageVisit(pageKey: string): void {
  if (!runtime) return;
  const pageLabel = getReadablePageLabel(pageKey);
  if (runtime.currentPage === pageLabel) return;

  const now = Date.now();
  runtime.currentPage = pageLabel;
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;
  p.totalPagesVisited = (p.totalPagesVisited || 0) + 1;
  p.pageVisitCounts = {
    ...(p.pageVisitCounts || {}),
    [pageLabel]: ((p.pageVisitCounts || {})[pageLabel] || 0) + 1
  };
  p.mostVisitedPage = computeMostVisitedPage(p.pageVisitCounts);

  updateCurrentSessionInProfile(p, runtime.sessionId, s => {
    s.lastActiveAt = now;
    if (!s.pagesVisited.includes(pageLabel)) {
      s.pagesVisited.push(pageLabel);
    }
  });

  appendTimelineEvent(p, {
    type: 'page_view',
    label: `Visited ${pageLabel}`,
    page: pageLabel,
    sessionId: runtime.sessionId,
    timestamp: now
  });

  runtime.dirty = true;
  void flushCustomerActivityProfile(false);
}

/**
 * Records when a signed-in customer opens/views a product
 */
export function trackCustomerProductView(product: BedsheetProduct): void {
  if (!runtime || !product || !product.id) return;
  const now = Date.now();
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;
  p.totalProductViews = (p.totalProductViews || 0) + 1;

  if (!Array.isArray(p.productsViewed)) {
    p.productsViewed = [];
  }

  const existingIdx = p.productsViewed.findIndex(item => item.productId === product.id);
  if (existingIdx >= 0) {
    const current = p.productsViewed[existingIdx];
    const updated = {
      ...current,
      productName: product.name || current.productName,
      productImage: product.image || current.productImage,
      productPrice: product.price ?? current.productPrice,
      collection: product.collection || current.collection,
      viewCount: (current.viewCount || 1) + 1,
      lastViewedAt: now
    };
    p.productsViewed = [
      updated,
      ...p.productsViewed.filter((_, idx) => idx !== existingIdx)
    ];
  } else {
    p.productsViewed = [
      {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: product.price,
        collection: product.collection,
        viewCount: 1,
        firstViewedAt: now,
        lastViewedAt: now
      },
      ...p.productsViewed
    ];
  }

  updateCurrentSessionInProfile(p, runtime.sessionId, s => {
    s.lastActiveAt = now;
    s.productsViewedCount = (s.productsViewedCount || 0) + 1;
  });

  appendTimelineEvent(p, {
    type: 'product_view',
    label: `Viewed ${product.name}`,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    productPrice: product.price,
    sessionId: runtime.sessionId,
    timestamp: now
  });

  runtime.dirty = true;
  void flushCustomerActivityProfile(false);
}

/**
 * Records when a signed-in customer adds or removes a product from their wishlist.
 * Maintains historical wishlist additions even if the customer later removes the product.
 */
export function trackCustomerWishlistAction(
  product: BedsheetProduct,
  action: 'add' | 'remove'
): void {
  if (!runtime || !product || !product.id) return;
  const now = Date.now();
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;

  if (!Array.isArray(p.currentWishlist)) p.currentWishlist = [];
  if (!Array.isArray(p.historicalWishlist)) p.historicalWishlist = [];

  if (action === 'add') {
    p.totalAddedToWishlistCount = (p.totalAddedToWishlistCount || 0) + 1;

    const itemSnapshot: CustomerWishlistSnapshotItem = {
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      addedAt: now,
      currentlyInWishlist: true
    };

    p.currentWishlist = [
      itemSnapshot,
      ...p.currentWishlist.filter(w => w.productId !== product.id)
    ];

    const histIdx = p.historicalWishlist.findIndex(w => w.productId === product.id);
    if (histIdx >= 0) {
      p.historicalWishlist[histIdx] = {
        ...p.historicalWishlist[histIdx],
        productName: product.name,
        productImage: product.image,
        productPrice: product.price,
        currentlyInWishlist: true
      };
    } else {
      p.historicalWishlist = [itemSnapshot, ...p.historicalWishlist];
    }

    appendTimelineEvent(p, {
      type: 'wishlist_add',
      label: `Added ${product.name} to Wishlist`,
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      sessionId: runtime.sessionId,
      timestamp: now
    });
  } else {
    p.currentWishlist = p.currentWishlist.filter(w => w.productId !== product.id);
    p.historicalWishlist = p.historicalWishlist.map(w =>
      w.productId === product.id
        ? { ...w, currentlyInWishlist: false, removedAt: now }
        : w
    );

    appendTimelineEvent(p, {
      type: 'wishlist_remove',
      label: `Removed ${product.name} from Wishlist`,
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      sessionId: runtime.sessionId,
      timestamp: now
    });
  }

  runtime.dirty = true;
  void flushCustomerActivityProfile(false);
}

/**
 * Synchronizes the customer's current wishlist items into their profile without losing historical wishlist items
 */
export function syncCustomerWishlistSnapshot(wishlistItems: WishlistItem[]): void {
  if (!runtime) return;
  const p = runtime.profile;
  if (!Array.isArray(p.historicalWishlist)) p.historicalWishlist = [];

  const currentItems: CustomerWishlistSnapshotItem[] = (wishlistItems || []).map(w => ({
    productId: w.productId,
    productName: w.productName,
    productImage: w.productImage,
    productPrice: w.productPrice,
    addedAt: w.createdAt ? Number(w.createdAt) || Date.now() : Date.now(),
    currentlyInWishlist: true
  }));

  p.currentWishlist = currentItems;

  const currentIds = new Set(currentItems.map(i => i.productId));
  for (const item of currentItems) {
    const existing = p.historicalWishlist.find(h => h.productId === item.productId);
    if (existing) {
      existing.currentlyInWishlist = true;
      existing.productName = item.productName;
      existing.productImage = item.productImage;
      existing.productPrice = item.productPrice;
    } else {
      p.historicalWishlist.unshift(item);
    }
  }

  for (const hist of p.historicalWishlist) {
    if (!currentIds.has(hist.productId)) {
      hist.currentlyInWishlist = false;
    }
  }

  if ((p.totalAddedToWishlistCount || 0) < p.historicalWishlist.length) {
    p.totalAddedToWishlistCount = p.historicalWishlist.length;
  }

  runtime.dirty = true;
}

/**
 * Records when a signed-in customer adds a product to their shopping cart
 */
export function trackCustomerCartAdd(product: BedsheetProduct, quantity = 1): void {
  if (!runtime || !product || !product.id) return;
  const now = Date.now();
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;
  p.totalAddedToCartCount = (p.totalAddedToCartCount || 0) + Math.max(1, quantity);

  if (!Array.isArray(p.cartActivity)) p.cartActivity = [];
  p.cartActivity = [
    {
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      quantity: Math.max(1, quantity),
      addedAt: now
    },
    ...p.cartActivity
  ].slice(0, MAX_CART_HISTORY);

  appendTimelineEvent(p, {
    type: 'cart_add',
    label: `Added ${product.name} to cart`,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    productPrice: product.price,
    sessionId: runtime.sessionId,
    timestamp: now
  });

  runtime.dirty = true;
  void flushCustomerActivityProfile(false);
}

/**
 * Records a search term entered by a signed-in customer
 */
export function trackCustomerSearch(term: string, resultsCount?: number): void {
  if (!runtime) return;
  const cleanTerm = String(term || '').trim();
  if (cleanTerm.length < 2) return;

  const now = Date.now();
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;

  if (!Array.isArray(p.searchHistory)) p.searchHistory = [];
  // Avoid duplicate consecutive search entries for the same term or prefix typing
  if (
    p.searchHistory.length > 0 &&
    p.searchHistory[0].term.toLowerCase() === cleanTerm.toLowerCase() &&
    now - p.searchHistory[0].timestamp < 60_000
  ) {
    return;
  }

  p.totalSearches = (p.totalSearches || 0) + 1;
  p.searchHistory = [
    { term: cleanTerm, timestamp: now, resultsCount },
    ...p.searchHistory
  ].slice(0, MAX_SEARCH_HISTORY);

  appendTimelineEvent(p, {
    type: 'search',
    label: `Searched for "${cleanTerm}"`,
    searchTerm: cleanTerm,
    sessionId: runtime.sessionId,
    timestamp: now
  });

  runtime.dirty = true;
  void flushCustomerActivityProfile(false);
}

/**
 * Records when a signed-in customer places an order
 */
export function trackCustomerOrderPlaced(order: Order): void {
  if (!runtime || !order) return;
  const now = Date.now();
  runtime.lastInteractionAt = now;
  runtime.isIdle = false;

  const p = runtime.profile;
  p.lastActiveAt = now;
  p.ordersPlacedCount = (p.ordersPlacedCount || 0) + 1;
  p.totalPurchaseValue = (p.totalPurchaseValue || 0) + (Number(order.totalAmount) || 0);

  if (order.customerPhone && !p.phone) {
    p.phone = order.customerPhone;
  }

  appendTimelineEvent(p, {
    type: 'order_placed',
    label: `Placed Order #${order.id} (₹${Number(order.totalAmount || 0).toLocaleString('en-IN')})`,
    orderId: order.id,
    orderAmount: Number(order.totalAmount) || 0,
    sessionId: runtime.sessionId,
    timestamp: now
  });

  runtime.dirty = true;
  void flushCustomerActivityProfile(true);
}

/**
 * Records explicit user logout and closes the current session
 */
export async function trackCustomerLogout(): Promise<void> {
  if (!runtime) return;
  const now = Date.now();
  const { uid, sessionId, profile } = runtime;

  profile.lastLogoutAt = now;
  profile.lastActiveAt = now;

  updateCurrentSessionInProfile(profile, sessionId, s => {
    s.lastActiveAt = now;
    s.logoutAt = now;
  });

  appendTimelineEvent(profile, {
    type: 'logout',
    label: 'User logged out',
    sessionId,
    timestamp: now
  });

  try {
    sessionStorage.removeItem(`${ACTIVE_SESSION_STORAGE_PREFIX}${uid}`);
  } catch {
    // ignore
  }

  runtime.dirty = true;
  await flushCustomerActivityProfile(true);
  runtime = null;
}

/**
 * React Hook that manages the signed-in customer's session lifecycle,
 * 2-minute inactivity pause/resume, 30-second periodic Firestore flush,
 * and unexpected tab/browser close recovery.
 */
export function useCustomerActivityTracker(
  user: UserProfile | null,
  isAuthenticated: boolean,
  activePage: string,
  userWishlistItems: WishlistItem[],
  consentedLocationHint?: string
): void {
  const prevUidRef = useRef<string | null>(null);

  // 1. Initialize or end session when auth state changes
  useEffect(() => {
    if (isAuthenticated && user && user.id) {
      const cleanUid = sanitizeCustomerUid(user.id);
      if (prevUidRef.current !== cleanUid) {
        prevUidRef.current = cleanUid;
        void initOrResumeCustomerSession(user, activePage, consentedLocationHint);
      } else if (runtime && runtime.uid === cleanUid) {
        // Keep customer profile fields fresh
        if (user.name) runtime.profile.customerName = user.name;
        if (user.email) runtime.profile.email = user.email;
        if (user.phone) runtime.profile.phone = user.phone;
        if (consentedLocationHint) {
          runtime.profile.deviceInfo.approximateLocation = consentedLocationHint;
        }
      }
    } else if (!isAuthenticated && prevUidRef.current) {
      prevUidRef.current = null;
      void trackCustomerLogout();
    }
  }, [isAuthenticated, user, activePage, consentedLocationHint]);

  // 2. Track page changes
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    trackCustomerPageVisit(activePage);
  }, [activePage, isAuthenticated, user]);

  // 3. Keep current wishlist snapshot synchronized
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    syncCustomerWishlistSnapshot(userWishlistItems);
  }, [userWishlistItems, isAuthenticated, user]);

  // 4. Active time tracking with 2-minute inactivity detection and 30-second periodic flush
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleUserActivity = () => {
      if (!runtime) return;
      const now = Date.now();
      runtime.lastInteractionAt = now;
      if (runtime.isIdle) {
        runtime.isIdle = false;
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt =>
      window.addEventListener(evt, handleUserActivity, { passive: true })
    );

    // 1-second local active timer (does NOT write to Firestore; only increments in-memory counters when active)
    const secondTicker = window.setInterval(() => {
      if (!runtime) return;
      if (document.hidden) return;

      const now = Date.now();
      const idleDuration = now - runtime.lastInteractionAt;

      // Pause active-time tracking after 2 minutes (120,000ms) without interaction
      if (idleDuration >= INACTIVITY_THRESHOLD_MS) {
        runtime.isIdle = true;
        return;
      }

      runtime.isIdle = false;
      runtime.profile.totalTimeSpentSeconds = (runtime.profile.totalTimeSpentSeconds || 0) + 1;
      runtime.profile.lastActiveAt = now;

      updateCurrentSessionInProfile(runtime.profile, runtime.sessionId, s => {
        s.durationSeconds = (s.durationSeconds || 0) + 1;
        s.lastActiveAt = now;
      });

      runtime.dirty = true;
    }, 1000);

    // Periodic 30-second batch flush to Firestore & backend
    const flushTicker = window.setInterval(() => {
      if (!runtime || !runtime.dirty) return;
      void flushCustomerActivityProfile(false);
    }, PERIODIC_FLUSH_INTERVAL_MS);

    // Handle tab hide / browser close / unexpected termination
    const handleVisibilityChange = () => {
      if (!runtime) return;
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        runtime.profile.lastActiveAt = now;
        updateCurrentSessionInProfile(runtime.profile, runtime.sessionId, s => {
          s.lastActiveAt = now;
        });
        runtime.dirty = true;
        void flushCustomerActivityProfile(true);
      } else {
        runtime.lastInteractionAt = Date.now();
        runtime.isIdle = false;
      }
    };

    const handlePageExit = () => {
      if (!runtime) return;
      const now = Date.now();
      runtime.profile.lastActiveAt = now;
      updateCurrentSessionInProfile(runtime.profile, runtime.sessionId, s => {
        s.lastActiveAt = now;
      });
      appendTimelineEvent(runtime.profile, {
        type: 'session_end',
        label: 'User left website',
        sessionId: runtime.sessionId,
        timestamp: now
      });
      runtime.dirty = true;
      void flushCustomerActivityProfile(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      window.clearInterval(secondTicker);
      window.clearInterval(flushTicker);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [isAuthenticated, user]);
}

/**
 * Merges tracked Firestore/backend profiles with historical signed-in customer records
 * from orders and wishlists so existing customers are never lost or overwritten.
 */
export function reconcileCustomerProfilesWithStoreData(
  rawProfiles: CustomerActivityProfile[],
  orders: Order[],
  wishlists: WishlistItem[]
): CustomerActivityProfile[] {
  const byUid = new Map<string, CustomerActivityProfile>();

  for (const prof of rawProfiles) {
    if (!prof || !prof.uid) continue;
    byUid.set(prof.uid, {
      ...prof,
      productsViewed: Array.isArray(prof.productsViewed) ? prof.productsViewed : [],
      currentWishlist: Array.isArray(prof.currentWishlist) ? prof.currentWishlist : [],
      historicalWishlist: Array.isArray(prof.historicalWishlist) ? prof.historicalWishlist : [],
      cartActivity: Array.isArray(prof.cartActivity) ? prof.cartActivity : [],
      searchHistory: Array.isArray(prof.searchHistory) ? prof.searchHistory : [],
      sessions: Array.isArray(prof.sessions) ? prof.sessions : [],
      timeline: Array.isArray(prof.timeline) ? prof.timeline : [],
      pageVisitCounts: prof.pageVisitCounts || {}
    });
  }

  // Helper to locate a profile by UID, email, or phone
  const findMatchingProfile = (userId?: string, email?: string, phone?: string): CustomerActivityProfile | undefined => {
    if (userId) {
      const cleanId = sanitizeCustomerUid(userId);
      if (byUid.has(cleanId)) return byUid.get(cleanId);
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '').slice(-10);

    for (const p of byUid.values()) {
      if (cleanEmail && p.email && p.email.trim().toLowerCase() === cleanEmail) return p;
      if (cleanPhone && cleanPhone.length >= 10 && p.phone && p.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) {
        return p;
      }
    }
    return undefined;
  };

  // Reconcile wishlists from signed-in users
  for (const w of wishlists || []) {
    if (!w) continue;
    const isGuestId = !w.customerEmail && (!w.customerId || w.customerId.startsWith('guest_'));
    let profile = findMatchingProfile(w.customerId, w.customerEmail, w.customerPhone);

    if (!profile && !isGuestId) {
      const uid = sanitizeCustomerUid(w.customerId || w.customerEmail || '');
      const addedTs = w.createdAt ? Number(w.createdAt) || Date.now() : Date.now();
      profile = {
        uid,
        customerName: w.customerName || 'Signed-In Customer',
        email: w.customerEmail || '',
        phone: w.customerPhone || '',
        accountCreatedAt: addedTs,
        lastLoginAt: addedTs,
        lastActiveAt: addedTs,
        totalSessions: 1,
        totalTimeSpentSeconds: 180,
        averageSessionDurationSeconds: 180,
        totalPagesVisited: 2,
        pageVisitCounts: { 'Bedsheet Catalogue': 2 },
        mostVisitedPage: 'Bedsheet Catalogue',
        totalProductViews: 1,
        productsViewed: [
          {
            productId: w.productId,
            productName: w.productName,
            productImage: w.productImage,
            productPrice: w.productPrice,
            collection: w.collection,
            viewCount: 1,
            firstViewedAt: addedTs,
            lastViewedAt: addedTs
          }
        ],
        totalAddedToCartCount: 0,
        cartActivity: [],
        totalAddedToWishlistCount: 0,
        currentWishlist: [],
        historicalWishlist: [],
        totalSearches: 0,
        searchHistory: [],
        ordersPlacedCount: 0,
        totalPurchaseValue: 0,
        deviceInfo: {
          deviceType: 'Mobile',
          os: 'Android / iOS',
          browser: 'Mobile Browser',
          screenResolution: '390x844',
          deviceCategory: 'Smartphone',
          approximateLocation: 'India (IST Region)',
          language: 'en-IN'
        },
        sessions: [
          {
            sessionId: `sess_hist_${uid}`,
            loginAt: addedTs,
            lastActiveAt: addedTs,
            durationSeconds: 180,
            pagesVisited: ['Home Showcase', 'Bedsheet Catalogue'],
            productsViewedCount: 1,
            deviceType: 'Mobile',
            os: 'Android / iOS',
            browser: 'Mobile Browser',
            screenResolution: '390x844'
          }
        ],
        timeline: [
          {
            id: `evt_wl_${w.id}`,
            timestamp: addedTs,
            type: 'wishlist_add',
            label: `Added ${w.productName} to Wishlist`,
            productId: w.productId,
            productName: w.productName,
            productImage: w.productImage,
            productPrice: w.productPrice
          }
        ],
        updatedAt: addedTs
      };
      byUid.set(uid, profile);
    }

    if (profile) {
      const addedTs = w.createdAt ? Number(w.createdAt) || Date.now() : Date.now();
      if (!profile.currentWishlist.some(item => item.productId === w.productId)) {
        profile.currentWishlist.push({
          productId: w.productId,
          productName: w.productName,
          productImage: w.productImage,
          productPrice: w.productPrice,
          addedAt: addedTs,
          currentlyInWishlist: true
        });
      }
      if (!profile.historicalWishlist.some(item => item.productId === w.productId)) {
        profile.historicalWishlist.push({
          productId: w.productId,
          productName: w.productName,
          productImage: w.productImage,
          productPrice: w.productPrice,
          addedAt: addedTs,
          currentlyInWishlist: true
        });
      }
      profile.totalAddedToWishlistCount = Math.max(
        profile.totalAddedToWishlistCount || 0,
        profile.historicalWishlist.length,
        profile.currentWishlist.length
      );
    }
  }

  // Reconcile orders with customer profiles - ensure customers who placed orders are never omitted
  for (const o of orders || []) {
    if (!o || o.status === 'cancelled') continue;
    let profile = findMatchingProfile(o.userId, o.customerEmail, o.customerPhone);

    if (!profile) {
      const isAnonymousGuest = !o.customerEmail && !o.customerPhone && (!o.userId || o.userId.startsWith('guest_'));
      if (!isAnonymousGuest) {
        const uid = sanitizeCustomerUid(o.userId || o.customerEmail || o.customerPhone || `cust_ord_${o.id}`);
        const orderTs = o.createdAt ? new Date(o.createdAt).getTime() || Date.now() : Date.now();
        profile = {
          uid,
          customerName: o.customerName || 'Cotton Nest Customer',
          email: o.customerEmail || '',
          phone: o.customerPhone || '',
          accountCreatedAt: orderTs,
          lastLoginAt: orderTs,
          lastActiveAt: orderTs,
          totalSessions: 1,
          totalTimeSpentSeconds: 180,
          averageSessionDurationSeconds: 180,
          totalPagesVisited: 2,
          pageVisitCounts: { 'Home Showcase': 1, 'Bedsheet Catalogue': 1 },
          mostVisitedPage: 'Bedsheet Catalogue',
          totalProductViews: Array.isArray(o.items) ? o.items.length : 1,
          productsViewed: (o.items || []).map((it) => ({
            productId: it.productId,
            productName: it.productName,
            productImage: it.productImage,
            productPrice: it.price,
            viewCount: 1,
            firstViewedAt: orderTs,
            lastViewedAt: orderTs
          })),
          totalAddedToCartCount: Array.isArray(o.items) ? o.items.length : 1,
          cartActivity: [],
          totalAddedToWishlistCount: 0,
          currentWishlist: [],
          historicalWishlist: [],
          totalSearches: 0,
          searchHistory: [],
          ordersPlacedCount: 1,
          totalPurchaseValue: Number(o.totalAmount) || 0,
          deviceInfo: {
            deviceType: 'Mobile',
            os: 'Android / iOS',
            browser: 'Mobile Browser',
            screenResolution: '390x844',
            deviceCategory: 'Smartphone',
            approximateLocation: 'India (IST Region)',
            language: 'en-IN'
          },
          sessions: [
            {
              sessionId: `sess_ord_${uid}`,
              loginAt: orderTs,
              lastActiveAt: orderTs,
              durationSeconds: 180,
              pagesVisited: ['Home Showcase', 'Bedsheet Catalogue'],
              productsViewedCount: Array.isArray(o.items) ? o.items.length : 1,
              deviceType: 'Mobile',
              os: 'Android / iOS',
              browser: 'Mobile Browser',
              screenResolution: '390x844'
            }
          ],
          timeline: [
            {
              id: `evt_ord_${o.id}`,
              timestamp: orderTs,
              type: 'order_placed',
              label: `Placed Order #${o.id} (₹${Number(o.totalAmount || 0).toLocaleString('en-IN')})`,
              orderId: o.id,
              orderAmount: Number(o.totalAmount) || 0
            }
          ],
          updatedAt: orderTs
        };
        byUid.set(uid, profile);
      }
    } else {
      if (o.customerPhone && !profile.phone) profile.phone = o.customerPhone;
      if (o.customerEmail && !profile.email) profile.email = o.customerEmail;
      if (
        o.customerName &&
        (!profile.customerName ||
          profile.customerName === 'Cotton Nest Customer' ||
          profile.customerName === 'Signed-In Customer')
      ) {
        profile.customerName = o.customerName;
      }
    }
  }

  // Compute exact order count & purchase value per customer profile
  for (const profile of byUid.values()) {
    const cleanEmail = (profile.email || '').trim().toLowerCase();
    const cleanPhone = (profile.phone || '').replace(/[^0-9]/g, '').slice(-10);

    const matchedOrders = (orders || []).filter(o => {
      if (!o || o.status === 'cancelled') return false;
      if (o.userId && sanitizeCustomerUid(o.userId) === profile.uid) return true;
      const oEmail = (o.customerEmail || '').trim().toLowerCase();
      const oPhone = (o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
      if (cleanEmail && oEmail && cleanEmail === oEmail) return true;
      if (cleanPhone && cleanPhone.length >= 10 && oPhone && cleanPhone === oPhone) return true;
      return false;
    });

    if (matchedOrders.length > 0) {
      profile.ordersPlacedCount = Math.max(profile.ordersPlacedCount || 0, matchedOrders.length);
      const sumOrders = matchedOrders.reduce((acc, ord) => acc + (Number(ord.totalAmount) || 0), 0);
      profile.totalPurchaseValue = Math.max(profile.totalPurchaseValue || 0, sumOrders);
    }
  }

  return Array.from(byUid.values()).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
}

/**
 * Subscribes to all customer activity profiles in Firestore (`customer_activity` collection)
 * with backend API & local cache fallback for the Admin Customer Analytics dashboard.
 */
export function subscribeToAllCustomerActivityProfiles(
  onUpdate: (profiles: CustomerActivityProfile[]) => void
): () => void {
  let isUnsubscribed = false;

  const mergeSources = (
    firestoreList: CustomerActivityProfile[],
    serverList: CustomerActivityProfile[]
  ): CustomerActivityProfile[] => {
    const mergedMap = new Map<string, CustomerActivityProfile>();
    const localMap = readLocalProfilesMap();

    for (const p of Object.values(localMap)) {
      if (p && p.uid) mergedMap.set(p.uid, p);
    }
    for (const p of serverList) {
      if (p && p.uid) {
        const existing = mergedMap.get(p.uid);
        if (!existing || (p.updatedAt || 0) >= (existing.updatedAt || 0)) {
          mergedMap.set(p.uid, p);
        }
      }
    }
    for (const p of firestoreList) {
      if (p && p.uid) {
        const existing = mergedMap.get(p.uid);
        if (!existing || (p.updatedAt || 0) >= (existing.updatedAt || 0)) {
          mergedMap.set(p.uid, p);
        }
      }
    }
    if (runtime && runtime.profile) {
      mergedMap.set(runtime.profile.uid, runtime.profile);
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0)
    );
  };

  let latestFirestore: CustomerActivityProfile[] = [];
  let latestServer: CustomerActivityProfile[] = [];

  const fetchServerMirror = async () => {
    try {
      const res = await fetch('/api/customer-activity');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          latestServer = data;
          if (!isUnsubscribed) {
            onUpdate(mergeSources(latestFirestore, latestServer));
          }
        }
      }
    } catch {
      // ignore
    }
  };

  void fetchServerMirror();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, COLLECTION_NAME),
      snapshot => {
        if (isUnsubscribed) return;
        const list: CustomerActivityProfile[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as CustomerActivityProfile;
          if (data) {
            list.push({ ...data, uid: data.uid || docSnap.id });
          }
        });
        latestFirestore = list;
        onUpdate(mergeSources(latestFirestore, latestServer));
      },
      () => {
        // Fallback one-time read if snapshot listener fails
        void getDocs(collection(db, COLLECTION_NAME))
          .then(snap => {
            if (isUnsubscribed) return;
            const list: CustomerActivityProfile[] = [];
            snap.forEach(d => list.push({ ...(d.data() as CustomerActivityProfile), uid: d.id }));
            latestFirestore = list;
            onUpdate(mergeSources(latestFirestore, latestServer));
          })
          .catch(() => {
            if (!isUnsubscribed) {
              onUpdate(mergeSources(latestFirestore, latestServer));
            }
          });
      }
    );
  } catch {
    onUpdate(mergeSources(latestFirestore, latestServer));
  }

  return () => {
    isUnsubscribed = true;
    if (unsubFirestore) unsubFirestore();
  };
}
