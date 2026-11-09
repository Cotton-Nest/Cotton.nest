/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BedsheetProduct, BedsheetVariant, BEDSHEETS_CATALOG, COMPANY_DETAILS, normalizeCustomPrice } from './data/products';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CatalogueView } from './components/CatalogueView';
import { CartDrawer, CartItem } from './components/CartDrawer';
import { StoreLocation } from './components/StoreLocation';
import { StoryAndFeatures } from './components/StoryAndFeatures';
import { Footer } from './components/Footer';
import { OfferBanner } from './components/OfferBanner';
import { MobileBottomBar } from './components/MobileBottomBar';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OwnerAuthModal } from './components/OwnerAuthModal';
import { LiveOrdersView } from './components/LiveOrdersView';
import { TermsAndConditionsView } from './components/TermsAndConditionsView';
import { SeasonalView } from './components/SeasonalView';
import { AuthModal } from './components/AuthModal';
import { AccountModal } from './components/AccountModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { ProductCompareModal } from './components/ProductCompareModal';
import { ProductCompareBar } from './components/ProductCompareBar';
import { StockAlertModal } from './components/StockAlertModal';
import { CartToastNotification, CartToastInfo } from './components/CartToastNotification';
import { ChromeInstallPopout, OfflineIndicator } from './components/PWAInstallPrompt';
import {
  AppNotification,
  DEFAULT_NOTIFICATIONS,
  NotificationPreferences,
  getStoredNotificationPreferences,
  saveStoredNotificationPreferences,
} from './data/notifications';
import {
  initPushNotifications,
  triggerLocalPushNotification,
  requestWebPushPermission,
  isPushNotificationSupported,
  getPushPermissionStatus,
} from './utils/pushNotifications';
import { useAuth, isOwnerEmail } from './context/AuthContext';
import { useLoyalty } from './context/LoyaltyContext';
import { LoyaltyRewardsModal } from './components/LoyaltyRewardsModal';
import { Order, INITIAL_ORDERS } from './data/orders';
import { SiteContent, INITIAL_SITE_CONTENT, normalizeShippingInTerms, normalizeShippingFee } from './data/siteContent';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from './data/seasonal';
import {
  getProducts,
  saveAllProducts,
  updateSingleProduct,
  getOrders,
  saveOrder,
  saveAllOrdersApi,
  updateOrderStatus,
  deleteOrder,
  getSiteContent,
  saveSiteContentApi,
  uploadImageApi,
  saveCustomImagesMapApi,
  addProductGalleryImageApi,
  getPublishedThemeApi,
  savePublishedThemeApi,
  getReviewsApi,
  saveReviewApi,
  helpfulReviewApi,
  getSeasonalConfigApi,
  saveSeasonalConfigApi,
  computeUpdatedImagesCount,
  saveUpdatedImagesStatsApi,
  getNotificationsApi,
  saveNotificationApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  clearAllNotificationsApi,
  getWishlistsApi,
  saveWishlistItemApi,
  removeWishlistItemApi,
  getSiteAnalyticsApi,
  recordPageVisitApi,
} from './services/api';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerWishlistModal } from './components/CustomerWishlistModal';
import { AnalyticsView } from './components/AnalyticsView';
import { SiteTrafficData, getStoredTraffic } from './data/analytics';
import {
  useCustomerActivityTracker,
  trackCustomerProductView,
  trackCustomerWishlistAction,
  trackCustomerCartAdd,
  trackCustomerOrderPlaced,
} from './services/customerActivityTracker';
import {
  WishlistItem,
  CustomerProfile,
  getCurrentCustomerProfile,
  saveCurrentCustomerProfile,
  getLocalWishlist,
  saveLocalWishlist,
} from './data/wishlist';
import { collection, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testConnection } from './firebase';
import { ReviewsSection } from './components/ReviewsSection';
import { WriteReviewModal } from './components/WriteReviewModal';
import { ProductReview, INITIAL_REVIEWS } from './data/reviews';
import {
  WebsiteThemeConfig,
  CLASSIC_COTTON_NEST_COLORS,
  getStoredPublishedTheme,
  saveStoredPublishedTheme,
  applyThemeToDom,
  isValidHex,
} from './data/theme';
import { resolveBedsheetImage, isVideoMedia } from './utils/imageUrl';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, HeartHandshake, Phone, MessageCircle, Lock, Unlock, KeyRound, Cloud, ChevronUp, ChevronDown, Star, Bell, X, Wrench, MapPin } from 'lucide-react';
import { motion, useScroll, useSpring, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics'>('home');
  const [trafficData, setTrafficData] = useState<SiteTrafficData>(() => getStoredTraffic());
  const [selectedProduct, setSelectedProduct] = useState<BedsheetProduct | null>(null);
  const [isProductModalEditMode, setIsProductModalEditMode] = useState<boolean>(false);

  const handleOpenProductModal = (product: BedsheetProduct, editMode: boolean = false) => {
    setSelectedProduct(product);
    setIsProductModalEditMode(editMode);
    if (!editMode && product) {
      trackCustomerProductView(product);
    }
  };

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartToast, setCartToast] = useState<CartToastInfo | null>(null);
  const [isPhotoManagerOpen, setIsPhotoManagerOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const isAdminOpenRef = React.useRef(isAdminOpen);
  React.useEffect(() => {
    isAdminOpenRef.current = isAdminOpen;
  }, [isAdminOpen]);
  const lastAdminSaveRef = React.useRef<number>(0);

  // Smooth scroll progress indicator for luxury feel
  const { scrollYProgress } = useScroll();
  const scrollProgressX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const { user, isOwner } = useAuth();
  const { isLoyaltyModalOpen, closeLoyaltyModal } = useLoyalty();
  const [isOwnerAuthOpen, setIsOwnerAuthOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [pendingCartItem, setPendingCartItem] = useState<{
    product: BedsheetProduct;
    quantityOrVariant?: number | BedsheetVariant;
    variantOrCustomPrice?: any;
    optionalCustomPrice?: number;
  } | null>(null);

  // Customer Wishlist State with local caching and backend sync
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(() => {
    return getCurrentCustomerProfile();
  });

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => {
    return getLocalWishlist();
  });

  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [pendingWishlistProduct, setPendingWishlistProduct] = useState<{
    product: BedsheetProduct;
    variant?: BedsheetVariant;
  } | null>(null);

  // Sync profile when authenticated user logs in
  useEffect(() => {
    if (user && user.name) {
      setCustomerProfile((prev) => {
        const updated = saveCurrentCustomerProfile({
          ...prev,
          name: user.name,
          email: user.email || prev.email,
          phone: user.phone || prev.phone,
          isGuest: false,
        });
        return updated;
      });
    }
  }, [user]);

  // Automatically maintain signed-in customer activity profile & session analytics in Firebase
  useCustomerActivityTracker(
    user,
    Boolean(user),
    activeTab,
    wishlistItems,
    customerProfile?.city
  );

  // Initial fetch of wishlist items for this customer from Firestore/server
  useEffect(() => {
    let isMounted = true;
    getWishlistsApi(customerProfile.id)
      .then((items) => {
        if (isMounted && Array.isArray(items) && items.length > 0) {
          setWishlistItems(items);
          saveLocalWishlist(items);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [customerProfile.id]);

  // Initial fetch of site traffic analytics
  useEffect(() => {
    let isMounted = true;
    getSiteAnalyticsApi()
      .then((data) => {
        if (isMounted && data) {
          setTrafficData(data);
        }
      })
      .catch((err) => {
        console.debug('Traffic fetch note:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Record page visit on tab navigation
  useEffect(() => {
    recordPageVisitApi(activeTab)
      .then((updated) => {
        if (updated) {
          setTrafficData(updated);
        }
      })
      .catch((err) => {
        console.debug('Page visit record note:', err);
      });
  }, [activeTab]);

  // Automated 3-Day Wishlist Retention: Send 5% Coupon
  useEffect(() => {
    if (!wishlistItems || wishlistItems.length === 0) return;

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    wishlistItems.forEach(async (item) => {
      const age = now - (item.createdAt || now);
      if (age >= threeDaysMs) {
        const sentKey = `cotton_nest_wishlist_coupon_sent_${item.productId}`;
        if (!localStorage.getItem(sentKey)) {
          localStorage.setItem(sentKey, String(now));
          const notif: AppNotification = {
            id: `wishlist-5pct-${item.productId}-${Date.now()}`,
            recipientId: customerProfile.id || 'all',
            type: 'promotion',
            category: 'promotions',
            title: '🎁 5% Wishlist Loyalty Reward Unlocked!',
            message: `You've had "${item.productName}" saved in your wishlist for 3 days! Use code WISHLIST5 at checkout for an instant 5% loyalty discount.`,
            timestamp: Date.now(),
            isRead: false,
            linkTarget: {
              view: 'catalogue',
              targetId: item.productId,
            },
            metadata: {
              couponCode: 'WISHLIST5',
              productId: item.productId,
              productName: item.productName,
            },
          };
          try {
            await saveNotificationApi(notif);
            triggerLocalPushNotification(
              '🎁 5% Off Your Wishlisted Bedsheet!',
              `Use code WISHLIST5 to get 5% off ${item.productName}.`,
              { url: '/#catalogue' }
            ).catch(() => {});
          } catch (e) {
            console.warn('Wishlist retention coupon dispatch notice:', e);
          }
        }
      }
    });
  }, [wishlistItems, customerProfile.id]);

  const isProductWishlisted = (productId: string, variantId?: string) => {
    return wishlistItems.some(
      (item) => item.productId === productId && (!variantId || item.selectedVariantId === variantId)
    );
  };

  const handleToggleWishlist = (product: BedsheetProduct, variant?: BedsheetVariant) => {
    const existing = wishlistItems.find(
      (item) => item.productId === product.id && (!variant || item.selectedVariantId === variant.id)
    );

    if (existing) {
      // Remove from wishlist
      const updated = wishlistItems.filter((item) => item.id !== existing.id);
      setWishlistItems(updated);
      saveLocalWishlist(updated);
      removeWishlistItemApi(existing.id).catch(() => {});
      trackCustomerWishlistAction(product, 'remove');
      return;
    }

    // If customer profile is completely empty/anonymous, open CustomerWishlistModal to prompt
    if (customerProfile.isGuest && !customerProfile.phone && !customerProfile.email && customerProfile.name === 'Atelier Guest') {
      setPendingWishlistProduct({ product, variant });
      setIsCustomerModalOpen(true);
      return;
    }

    // Add directly to wishlist
    const newItem: WishlistItem = {
      id: `${customerProfile.id}_${product.id}${variant ? `_${variant.id}` : ''}`,
      customerId: customerProfile.id,
      customerName: customerProfile.name || 'Atelier Guest',
      customerPhone: customerProfile.phone,
      customerEmail: customerProfile.email,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productOriginalPrice: product.originalPrice,
      productImage: resolveBedsheetImage(variant?.image || product.image, product.id),
      productDimensions: product.dimensions,
      collection: product.collection,
      threadCount: product.threadCount,
      fabric: product.fabric,
      selectedVariantId: variant?.id,
      selectedVariantName: variant?.name,
      createdAt: Date.now(),
    };

    const updated = [newItem, ...wishlistItems.filter((it) => it.id !== newItem.id)];
    setWishlistItems(updated);
    saveLocalWishlist(updated);
    saveWishlistItemApi(newItem).catch(() => {});
    trackCustomerWishlistAction(product, 'add');
  };

  const handleCustomerProfileConfirmed = (profile: CustomerProfile) => {
    setCustomerProfile(profile);
    if (pendingWishlistProduct) {
      const { product, variant } = pendingWishlistProduct;
      const newItem: WishlistItem = {
        id: `${profile.id}_${product.id}${variant ? `_${variant.id}` : ''}`,
        customerId: profile.id,
        customerName: profile.name || 'Atelier Guest',
        customerPhone: profile.phone,
        customerEmail: profile.email,
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productOriginalPrice: product.originalPrice,
        productImage: resolveBedsheetImage(variant?.image || product.image, product.id),
        productDimensions: product.dimensions,
        collection: product.collection,
        threadCount: product.threadCount,
        fabric: product.fabric,
        selectedVariantId: variant?.id,
        selectedVariantName: variant?.name,
        createdAt: Date.now(),
      };

      const updated = [newItem, ...wishlistItems.filter((it) => it.id !== newItem.id)];
      setWishlistItems(updated);
      saveLocalWishlist(updated);
      saveWishlistItemApi(newItem).catch(() => {});
      trackCustomerWishlistAction(product, 'add');
      setPendingWishlistProduct(null);
    }
  };

  const handleRemoveWishlistItem = (id: string) => {
    const targetItem = wishlistItems.find((item) => item.id === id);
    const updated = wishlistItems.filter((item) => item.id !== id);
    setWishlistItems(updated);
    saveLocalWishlist(updated);
    removeWishlistItemApi(id).catch(() => {});
    if (targetItem) {
      const matchedProd = products.find((p) => p.id === targetItem.productId);
      if (matchedProd) {
        trackCustomerWishlistAction(matchedProd, 'remove');
      }
    }
  };

  const handleMoveToCartFromWishlist = (item: WishlistItem) => {
    const prod = products.find((p) => p.id === item.productId);
    if (prod) {
      const variant = item.selectedVariantId
        ? prod.variants?.find((v) => v.id === item.selectedVariantId)
        : undefined;
      handleAddToCart(prod, 1, variant);
      handleRemoveWishlistItem(item.id);
      setIsWishlistOpen(false);
      setIsCartOpen(true);
    }
  };

  // Store Owner Authentication Mode — strictly locked by default; unlocked via Owner Security PIN or authorized Owner Google Account
  const [isOwnerPinUnlocked, setIsOwnerPinUnlocked] = useState<boolean>(false);

  const isOwnerMode = Boolean(isOwnerPinUnlocked || isOwner || (user?.email && isOwnerEmail(user.email)));

  // State to track scroll position for Home scroll-to-top button
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleWindowScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  // Website Appearance & Festival Theme Manager state
  const [themeConfig, setThemeConfig] = useState<WebsiteThemeConfig>(() => {
    return getStoredPublishedTheme();
  });

  // Apply theme & Liquid Glass variables to DOM on initial mount
  useEffect(() => {
    applyThemeToDom(themeConfig.colors, themeConfig.glassOpacity, themeConfig.glassBlur);
  }, []);

  // Fetch published theme from server API on initial load
  useEffect(() => {
    let isMounted = true;
    getPublishedThemeApi()
      .then((remoteTheme) => {
        if (isMounted && remoteTheme && remoteTheme.colors && isValidHex(remoteTheme.colors.primary)) {
          setThemeConfig(remoteTheme);
          saveStoredPublishedTheme(remoteTheme);
          applyThemeToDom(remoteTheme.colors, remoteTheme.glassOpacity, remoteTheme.glassBlur);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleThemePublished = async (newTheme: WebsiteThemeConfig) => {
    setThemeConfig(newTheme);
    saveStoredPublishedTheme(newTheme);
    applyThemeToDom(newTheme.colors, newTheme.glassOpacity, newTheme.glassBlur);
    try {
      await savePublishedThemeApi(newTheme);
    } catch (err) {
      console.warn('Failed to publish theme to Firestore:', err);
    }
  };

  // Dynamic products state with local storage persistence
  const [products, setProducts] = useState<BedsheetProduct[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return BEDSHEETS_CATALOG;
  });

  const productsRef = React.useRef(products);
  React.useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Dynamic Orders state with local storage persistence
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_ORDERS;
  });

  // Dynamic Site Content & Story with local storage persistence
  const [siteContent, setSiteContent] = useState<SiteContent>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_site_content');
      if (saved) {
        const parsed = JSON.parse(saved) as SiteContent;
        if (parsed) {
          if (typeof parsed.termsAndConditions === 'string') {
            parsed.termsAndConditions = normalizeShippingInTerms(parsed.termsAndConditions);
          }
          parsed.shippingFeeIndia = normalizeShippingFee(parsed.shippingFeeIndia);
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_SITE_CONTENT;
  });

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Clean up and heal any corrupt cart item structure
      return parsed
        .filter((item: any) => Boolean(item && item.product && typeof item.product === 'object' && item.product.id))
        .map((item: any) => {
          let qty = 1;
          let variant: BedsheetVariant | undefined = undefined;

          // Safe variant extraction
          if (item.selectedVariant && typeof item.selectedVariant === 'object' && item.selectedVariant.name) {
            variant = {
              id: String(item.selectedVariant.id || 'variant-default'),
              name: String(item.selectedVariant.name),
              image: item.selectedVariant.image ? String(item.selectedVariant.image) : String(item.product?.image || ''),
              colorHex: item.selectedVariant.colorHex ? String(item.selectedVariant.colorHex) : undefined,
            };
          }

          if (typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0) {
            qty = Math.round(item.quantity);
          } else if (typeof item.quantity === 'object' && item.quantity !== null) {
            // Heals legacy format where variant object was stored in place of quantity
            if (!variant && item.quantity.name) {
              variant = {
                id: String(item.quantity.id || 'variant-default'),
                name: String(item.quantity.name),
                image: item.quantity.image ? String(item.quantity.image) : String(item.product?.image || ''),
                colorHex: item.quantity.colorHex ? String(item.quantity.colorHex) : undefined,
              };
            }
            qty = 1;
          }

          return {
            product: item.product,
            quantity: qty,
            selectedVariant: variant,
          };
        });
    } catch {
      return [];
    }
  });
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());

  // Customer Reviews & Feedback with local cache persistence
  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_REVIEWS;
  });
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [writeReviewProductId, setWriteReviewProductId] = useState<string | undefined>();

  // Store user-uploaded custom photos with automatic corrupt-cache purge
  const [customImages, setCustomImages] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_custom_images');
      if (saved) {
        const parsed = JSON.parse(saved);
        const vals = Object.values(parsed).filter((v) => typeof v === 'string' && v.trim() !== '');
        // If all items share the exact same photo (corrupted mass-override), purge immediately!
        if (vals.length >= 3 && vals.every((v) => v === vals[0])) {
          localStorage.removeItem('cotton_nest_custom_images');
          return {};
        }
        // Discard any dead temporary /uploads/ container paths
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && !v.startsWith('/uploads/sheet_') && !v.startsWith('uploads/sheet_')) {
            clean[k] = v;
          }
        }
        return clean;
      }
      return {};
    } catch {
      return {};
    }
  });

  // Reference for last server sync timestamp
  const lastServerTimestampRef = useRef<number>(0);
  const lastThemeTimestampRef = useRef<number>(0);
  const lastSeasonalTimestampRef = useRef<number>(0);

  // Authoritative count of updated/custom images remembered across sessions
  const updatedImagesCount = computeUpdatedImagesCount(products, customImages);

  // Persist updated images count to Firestore metadata
  useEffect(() => {
    saveUpdatedImagesStatsApi(updatedImagesCount).catch(() => {});
  }, [updatedImagesCount]);

  // Seasonal Page State
  const [seasonalConfig, setSeasonalConfig] = useState<SeasonalConfig>(() => {
    try {
      const cached = localStorage.getItem('cotton_nest_seasonal');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.name === 'string') return parsed;
      }
    } catch {}
    return INITIAL_SEASONAL_CONFIG;
  });

  const handleUpdateSeasonalConfig = async (updated: SeasonalConfig) => {
    setSeasonalConfig(updated);
    try {
      localStorage.setItem('cotton_nest_seasonal', JSON.stringify(updated));
    } catch {}
    try {
      await saveSeasonalConfigApi(updated);
    } catch (err) {
      console.warn('Failed to save seasonal config to server:', err);
    }
  };

  // Customer & Atelier Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_NOTIFICATIONS;
  });
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    return getStoredNotificationPreferences();
  });

  const handleUpdateNotificationPreferences = (newPrefs: NotificationPreferences) => {
    setNotificationPreferences(newPrefs);
    try {
      saveStoredNotificationPreferences(newPrefs);
    } catch {}
  };

  // Bedsheet Comparison State (up to 3 bedsheets)
  const [comparedProductIds, setComparedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_compared');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 3);
      }
    } catch {}
    return [];
  });
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Stock Alert Target Product Modal
  const [stockAlertProduct, setStockAlertProduct] = useState<BedsheetProduct | null>(null);

  const handleToggleCompare = (product: BedsheetProduct) => {
    setComparedProductIds((prev) => {
      let next: string[];
      if (prev.includes(product.id)) {
        next = prev.filter((id) => id !== product.id);
      } else {
        if (prev.length >= 3) {
          next = [...prev.slice(1), product.id];
        } else {
          next = [...prev, product.id];
        }
      }
      try {
        localStorage.setItem('cotton_nest_compared', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleRemoveFromCompare = (productId: string) => {
    setComparedProductIds((prev) => {
      const next = prev.filter((id) => id !== productId);
      try {
        localStorage.setItem('cotton_nest_compared', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearCompare = () => {
    setComparedProductIds([]);
    try {
      localStorage.removeItem('cotton_nest_compared');
    } catch {}
  };

  const handleNotifyStock = (product: BedsheetProduct) => {
    setStockAlertProduct(product);
  };

  const refreshNotifications = React.useCallback(async () => {
    try {
      const recipientKey = user?.email || user?.phone || customerProfile.email || customerProfile.phone || undefined;
      const merged = await getNotificationsApi(recipientKey, isOwnerMode);
      if (Array.isArray(merged) && merged.length > 0) {
        setNotifications(merged);
      }
    } catch {}
  }, [user?.email, user?.phone, customerProfile.email, customerProfile.phone, isOwnerMode]);

  useEffect(() => {
    refreshNotifications();
    const handleNotifEvent = () => {
      refreshNotifications();
    };
    window.addEventListener('cotton-nest-notifications-updated', handleNotifEvent);
    return () => {
      window.removeEventListener('cotton-nest-notifications-updated', handleNotifEvent);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (isNotificationCenterOpen) {
      refreshNotifications();
    }
  }, [isNotificationCenterOpen, refreshNotifications]);

  const handleMarkNotificationAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationReadApi(id);
    } catch {}
  };

  const handleMarkAllNotificationsAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsReadApi();
    } catch {}
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);
    try {
      await clearAllNotificationsApi();
    } catch {}
  };

  const handleNotificationNavigate = (view: 'orders' | 'catalogue' | 'seasonal' | 'product', targetId?: string) => {
    setIsNotificationCenterOpen(false);
    if (view === 'product' && targetId) {
      const found = products.find((p) => p.id === targetId);
      if (found) {
        handleOpenProductModal(found);
        return;
      }
    }
    setActiveTab(view as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Chrome-style "Allow Notifications" prompt state
  const [showChromePushPrompt, setShowChromePushPrompt] = useState<boolean>(false);

  // Initialize service worker & automatic Chrome notification permission prompt on mount
  useEffect(() => {
    initPushNotifications().catch(() => {});

    if (isPushNotificationSupported() && getPushPermissionStatus() === 'default') {
      const dismissed = sessionStorage.getItem('cn_push_prompt_dismissed');
      if (!dismissed) {
        const t = setTimeout(() => {
          if (getPushPermissionStatus() === 'default') {
            setShowChromePushPrompt(true);
          }
        }, 600);
        return () => clearTimeout(t);
      }
    }
  }, []);

  useEffect(() => {
    const handlePermChange = () => {
      if (getPushPermissionStatus() !== 'default') {
        setShowChromePushPrompt(false);
      }
    };
    window.addEventListener('cotton-nest-push-permission-changed', handlePermChange);
    return () => window.removeEventListener('cotton-nest-push-permission-changed', handlePermChange);
  }, []);

  const handleAllowChromeNotifications = async () => {
    setShowChromePushPrompt(false);
    const res = await requestWebPushPermission(user?.email || user?.phone || customerProfile.email || customerProfile.phone || 'guest');
    if (res.granted) {
      setNotificationPreferences((prev) => ({ ...prev, pushEnabled: true }));
    }
  };

  const handleDismissChromeNotifications = () => {
    setShowChromePushPrompt(false);
    try {
      sessionStorage.setItem('cn_push_prompt_dismissed', '1');
    } catch {}
  };

  // Real-time authoritative subscriptions to Cloud Firestore
  useEffect(() => {
    testConnection();

    // 1. Authoritative Products listener from Firestore
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        // Do not overwrite local/admin state while an active Admin or JSON restore save is in flight
        if (Date.now() - lastAdminSaveRef.current < 4500) {
          return;
        }
        if (!snapshot.empty) {
          const loadedProducts: BedsheetProduct[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as BedsheetProduct;
            // Clean up any orphaned gallery/video/variant/media/angle sub-documents or incomplete records missing a product name
            const isSubkey =
              docSnap.id.includes('_gallery_') ||
              docSnap.id.includes('_video_') ||
              docSnap.id.includes('_variant_') ||
              docSnap.id.includes('_media_') ||
              docSnap.id.includes('_angle_');
            if (
              isSubkey ||
              !data ||
              typeof data.name !== 'string' ||
              !data.name.trim()
            ) {
              if (isSubkey || !data?.name) {
                deleteDoc(doc(db, 'products', docSnap.id)).catch(() => {});
              }
              return;
            }
            const cleanPrice = normalizeCustomPrice(data.price, 1320);
            const cleanOrigPrice = normalizeCustomPrice(data.originalPrice, cleanPrice);
            const safeAdditional = Array.isArray(data.additionalImages)
              ? data.additionalImages.filter(
                  (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('blob:')
                )
              : [];
            const safeVideos = Array.isArray(data.videos)
              ? data.videos.filter(
                  (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('blob:')
                )
              : [];
            loadedProducts.push({
              ...data,
              id: docSnap.id,
              name: String(data.name).trim(),
              collection: String(data.collection || 'Signature Collection'),
              size: data.size || 'King',
              productType: data.productType || 'Bedsheet',
              brand: data.brand || 'Cotton Nest',
              price: cleanPrice,
              originalPrice: cleanOrigPrice,
              dimensions: String(data.dimensions || '108 x 108 inches (274 x 274 cm)'),
              pillowCovers: String(data.pillowCovers || '2 Pillow Covers (45 x 70 cm)'),
              threadCount: String(data.threadCount || '350 Thread Count'),
              fabric: String(data.fabric || '100% Pure Percale Cotton'),
              pattern: String(data.pattern || 'Botanical Print'),
              colorTone: String(data.colorTone || 'Ivory & Pastels'),
              description: String(data.description || '100% pure combed cotton bedsheet.'),
              features: Array.isArray(data.features) ? data.features : [],
              variants: Array.isArray(data.variants) ? data.variants : [],
              additionalImages: safeAdditional,
              videos: safeVideos,
              videoUrl:
                typeof data.videoUrl === 'string' && !data.videoUrl.startsWith('blob:')
                  ? data.videoUrl
                  : safeVideos[0] || '',
              inStock: data.inStock !== false,
              stockQuantity: typeof data.stockQuantity === 'number' ? data.stockQuantity : 10,
              image: resolveBedsheetImage(data.image, docSnap.id, data.updatedAt),
            });
          });
          if (loadedProducts.length > 0) {
            loadedProducts.sort((a, b) => {
              const orderA = typeof a.order === 'number' ? a.order : 9999;
              const orderB = typeof b.order === 'number' ? b.order : 9999;
              return orderA - orderB;
            });
            setProducts(loadedProducts);
            try {
              localStorage.setItem('cotton_nest_products', JSON.stringify(loadedProducts));
            } catch {}
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'products');
        } catch {}
      }
    );

    // Also run a direct one-shot fetch of products on mount as an immediate guarantee
    getProducts()
      .then((fetched) => {
        if (Date.now() - lastAdminSaveRef.current < 4500) return;
        if (Array.isArray(fetched) && fetched.length > 0) {
          setProducts(fetched);
          try {
            localStorage.setItem('cotton_nest_products', JSON.stringify(fetched));
          } catch {}
        }
      })
      .catch(() => {});

    // 2. Authoritative Theme listener from Firestore
    const unsubTheme = onSnapshot(
      doc(db, 'theme', 'active'),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteTheme = docSnap.data() as WebsiteThemeConfig;
          if (remoteTheme && remoteTheme.colors && isValidHex(remoteTheme.colors.primary)) {
            setThemeConfig(remoteTheme);
            saveStoredPublishedTheme(remoteTheme);
            applyThemeToDom(remoteTheme.colors, remoteTheme.glassOpacity, remoteTheme.glassBlur);
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'theme/active');
        } catch {}
      }
    );

    // 3. Authoritative Seasonal Config listener from Firestore
    const unsubSeasonal = onSnapshot(
      doc(db, 'seasonal', 'active'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SeasonalConfig;
          if (data && typeof data === 'object' && typeof data.name === 'string') {
            setSeasonalConfig({
              ...INITIAL_SEASONAL_CONFIG,
              ...data,
              items: Array.isArray(data.items) ? data.items : [],
            });
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'seasonal/active');
        } catch {}
      }
    );

    // Initial fetch from merged Express + Firestore + local orders
    getOrders()
      .then((merged) => {
        if (Array.isArray(merged) && merged.length > 0) {
          setOrders((prev) => {
            const byId = new Map<string, Order>();
            for (const o of merged) {
              if (o && o.id) byId.set(o.id, o);
            }
            for (const o of prev) {
              if (o && o.id && !byId.has(o.id)) byId.set(o.id, o);
            }
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
          });
        }
      })
      .catch(() => {});

    // 4. Authoritative Orders listener from Firestore (merged with Express /api/orders)
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedOrders: Order[] = [];
          snapshot.forEach((d) => {
            const raw = d.data() as Order;
            if (!raw) return;
            loadedOrders.push({
              ...raw,
              id: d.id,
              customerName: String(raw.customerName || 'Atelier Customer'),
              customerPhone: String(raw.customerPhone || ''),
              customerAddress: String(raw.customerAddress || ''),
              items: Array.isArray(raw.items) ? raw.items : [],
              totalAmount: Number(raw.totalAmount) || 0,
              status: raw.status || 'pending',
              createdAt: raw.createdAt || new Date().toISOString(),
            });
          });
          getOrders()
            .then((apiMerged) => {
              const byId = new Map<string, Order>();
              for (const o of loadedOrders) {
                if (o && o.id) byId.set(o.id, o);
              }
              for (const o of apiMerged) {
                if (o && o.id && !byId.has(o.id)) byId.set(o.id, o);
              }
              const combined = Array.from(byId.values()).sort(
                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              );
              setOrders(combined);
            })
            .catch(() => {
              loadedOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
              setOrders(loadedOrders);
            });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'orders');
        } catch {}
      }
    );

    // 5. Authoritative Reviews listener from Firestore
    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedReviews: ProductReview[] = [];
          snapshot.forEach((d) => {
            const raw = d.data() as ProductReview;
            if (!raw) return;
            loadedReviews.push({
              ...raw,
              id: d.id,
              productId: String(raw.productId || ''),
              productName: String(raw.productName || 'Cotton Nest Pure Cotton Bedsheet'),
              customerName: String(raw.customerName || 'Verified Buyer'),
              customerCity: String(raw.customerCity || 'Gurgaon'),
              rating: Number(raw.rating) || 5,
              title: String(raw.title || 'Verified Review'),
              comment: String(raw.comment || ''),
              createdAt: raw.createdAt || Date.now(),
            });
          });
          loadedReviews.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setReviews(loadedReviews);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'reviews');
        } catch {}
      }
    );

    // 6. Authoritative Site Content listener from Firestore + initial API sync
    getSiteContent()
      .then((content) => {
        if (content && content.company) {
          const rawTc = String(content.termsAndConditions || INITIAL_SITE_CONTENT.termsAndConditions);
          const normalizedTc = normalizeShippingInTerms(rawTc);
          const normalizedFee = normalizeShippingFee(content.shippingFeeIndia);
          const mergedContent: SiteContent = {
            ...INITIAL_SITE_CONTENT,
            ...content,
            isMaintenanceMode: Boolean(content.isMaintenanceMode),
            maintenanceNotice: content.maintenanceNotice || INITIAL_SITE_CONTENT.maintenanceNotice,
            shippingFeeIndia: normalizedFee,
            company: { ...INITIAL_SITE_CONTENT.company, ...(content.company || {}) },
            announcement: { ...INITIAL_SITE_CONTENT.announcement, ...(content.announcement || {}) },
            hero: { ...INITIAL_SITE_CONTENT.hero, ...(content.hero || {}) },
            story: { ...INITIAL_SITE_CONTENT.story, ...(content.story || {}) },
            termsAndConditions: normalizedTc,
          };
          setSiteContent(mergedContent);
          try {
            localStorage.setItem('cotton_nest_site_content', JSON.stringify(mergedContent));
          } catch {}
        }
      })
      .catch(() => {});

    const unsubContent = onSnapshot(
      doc(db, 'site_content', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          const content = docSnap.data() as SiteContent;
          if (content && content.company) {
            const rawTc = String(content.termsAndConditions || INITIAL_SITE_CONTENT.termsAndConditions);
            const normalizedTc = normalizeShippingInTerms(rawTc);
            const normalizedFee = normalizeShippingFee(content.shippingFeeIndia);
            const mergedContent: SiteContent = {
              ...INITIAL_SITE_CONTENT,
              ...content,
              isMaintenanceMode: Boolean(content.isMaintenanceMode),
              maintenanceNotice: content.maintenanceNotice || INITIAL_SITE_CONTENT.maintenanceNotice,
              shippingFeeIndia: normalizedFee,
              company: { ...INITIAL_SITE_CONTENT.company, ...(content.company || {}) },
              announcement: { ...INITIAL_SITE_CONTENT.announcement, ...(content.announcement || {}) },
              hero: { ...INITIAL_SITE_CONTENT.hero, ...(content.hero || {}) },
              story: { ...INITIAL_SITE_CONTENT.story, ...(content.story || {}) },
              termsAndConditions: normalizedTc,
            };
            setSiteContent(mergedContent);
            if (normalizedTc !== rawTc || content.shippingFeeIndia !== normalizedFee) {
              saveSiteContentApi(mergedContent).catch(() => {});
            }
            try {
              localStorage.setItem('cotton_nest_site_content', JSON.stringify(mergedContent));
            } catch {}
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'site_content/main');
        } catch {}
      }
    );

    // 7. Authoritative Custom Image Links listener from Firestore
    const unsubCustomImages = onSnapshot(
      collection(db, 'custom_images'),
      (snapshot) => {
        if (Date.now() - lastAdminSaveRef.current < 4500) {
          return;
        }
        if (!snapshot.empty) {
          const imageMap: Record<string, string> = {};
          snapshot.forEach((d) => {
            if (
              d.id.includes('_gallery_') ||
              d.id.includes('_video_') ||
              d.id.includes('_variant_') ||
              d.id.includes('_media_') ||
              d.id.includes('_angle_')
            ) {
              return;
            }
            const data = d.data();
            if (
              data &&
              data.imageUrl &&
              typeof data.imageUrl === 'string' &&
              !data.imageUrl.startsWith('blob:')
            ) {
              imageMap[d.id] = data.imageUrl;
            }
          });
          setCustomImages((prev) => {
            const merged = { ...prev, ...imageMap };
            try {
              localStorage.setItem('cotton_nest_custom_images', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      },
      (error) => {
        console.warn('Could not subscribe to custom_images:', error);
      }
    );

    // 8. Authoritative Notifications listener from Firestore (also triggers real OS notification bar alerts for new notifications)
    let isFirstNotifSnapshot = true;
    const seenNotifIds = new Set<string>();
    try {
      const existingRaw = localStorage.getItem('cotton_nest_notifications');
      if (existingRaw) {
        const parsed: AppNotification[] = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((n) => {
            if (n && n.id) seenNotifIds.add(n.id);
          });
        }
      }
    } catch {}

    const unsubNotifications = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: AppNotification[] = [];
          snapshot.forEach((d) => {
            const item = { ...(d.data() as AppNotification), id: d.id };
            loaded.push(item);

            // If this is a newly arrived notification after initial load (and created within the last 2 minutes), show in device OS notification bar
            if (!isFirstNotifSnapshot && !seenNotifIds.has(item.id)) {
              seenNotifIds.add(item.id);
              const ageMs = Date.now() - (item.timestamp || 0);
              if (ageMs < 120000) {
                triggerLocalPushNotification(item.title, item.message, {
                  url: item.linkTarget?.view === 'orders' ? '/#orders' : '/',
                  tag: item.id,
                }).catch(() => {});
              }
            } else {
              seenNotifIds.add(item.id);
            }
          });
          isFirstNotifSnapshot = false;
          loaded.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setNotifications(loaded);
          try {
            localStorage.setItem('cotton_nest_notifications', JSON.stringify(loaded));
          } catch {}
        } else {
          isFirstNotifSnapshot = false;
        }
      },
      (error) => {
        console.warn('Could not subscribe to notifications:', error);
      }
    );

    return () => {
      unsubProducts();
      unsubTheme();
      unsubSeasonal();
      unsubOrders();
      unsubReviews();
      unsubContent();
      unsubCustomImages();
      unsubNotifications();
    };
  }, []);

  // Secret Owner Access Listeners: ?admin=true in URL & Ctrl+Shift+A shortcut (always requires PIN page first)
  useEffect(() => {
    try {
      localStorage.removeItem('cotton_nest_owner_mode');
    } catch {
      // ignore
    }

    // 1. Check URL parameters: ?admin=true or #admin -> open Owner PIN modal
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true' || window.location.hash === '#admin') {
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {
          // ignore
        }
        setIsOwnerAuthOpen(true);
      }
    };
    checkUrl();

    // 2. Keyboard shortcut: Ctrl + Shift + A (or Cmd + Shift + A) -> show PIN modal before opening Admin Panel
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setIsAdminOpen((currentlyOpen) => {
          if (currentlyOpen) {
            return false;
          }
          setIsOwnerAuthOpen(true);
          return false;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('cotton_nest_cart', JSON.stringify(cartItems));
    } catch {
      // Ignore local storage errors
    }
  }, [cartItems]);

  // Admin: Update all products & persist to Firestore
  const handleUpdateProducts = async (
    updatedProducts: BedsheetProduct[],
    options?: { replaceAll?: boolean }
  ) => {
    lastAdminSaveRef.current = Date.now();
    setProducts(updatedProducts);
    // Keep cart items and active product modal synchronized with latest Admin prices
    setCartItems((prevCart) =>
      prevCart.map((item) => {
        const match = updatedProducts.find((p) => p.id === item.product?.id);
        return match ? { ...item, product: match } : item;
      })
    );
    setSelectedProduct((prevSel) => {
      if (!prevSel) return null;
      const match = updatedProducts.find((p) => p.id === prevSel.id);
      return match || prevSel;
    });
    try {
      localStorage.setItem('cotton_nest_products', JSON.stringify(updatedProducts));
    } catch {}
    try {
      const savedList = await saveAllProducts(updatedProducts, options);
      lastAdminSaveRef.current = Date.now();
      if (Array.isArray(savedList) && savedList.length > 0) {
        setProducts(savedList);
      }
    } catch (err) {
      console.warn('Failed to persist all products to Firestore:', err);
    }
  };

  // Admin: Update custom images map & persist to Firestore
  const handleUpdateCustomImages = async (
    nextCustomImages: Record<string, string>,
    replaceAll: boolean = false
  ) => {
    lastAdminSaveRef.current = Date.now();
    setCustomImages((prev) => (replaceAll ? nextCustomImages : { ...prev, ...nextCustomImages }));
    try {
      const resolved = await saveCustomImagesMapApi(nextCustomImages, replaceAll);
      lastAdminSaveRef.current = Date.now();
      setCustomImages((prev) => (replaceAll ? resolved : { ...prev, ...resolved }));
    } catch (err) {
      console.warn('Failed to persist custom images map to Firestore:', err);
    }
  };

  const handleUpdateSingleProduct = async (updatedProduct: BedsheetProduct) => {
    lastAdminSaveRef.current = Date.now();
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === updatedProduct.id);
      const next = exists
        ? prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
        : [updatedProduct, ...prev];
      try {
        localStorage.setItem('cotton_nest_products', JSON.stringify(next));
      } catch {}
      return next;
    });
    setCartItems((prevCart) =>
      prevCart.map((item) =>
        item.product?.id === updatedProduct.id ? { ...item, product: updatedProduct } : item
      )
    );
    if (selectedProduct && selectedProduct.id === updatedProduct.id) {
      setSelectedProduct(updatedProduct);
    }
    try {
      await updateSingleProduct(updatedProduct.id, updatedProduct);
      lastAdminSaveRef.current = Date.now();
    } catch (err) {
      console.warn('Failed to persist single product edit to Firestore:', err);
    }
  };

  // Admin: Update Orders & persist to Firestore
  const handleUpdateOrders = async (updatedOrders: Order[]) => {
    lastAdminSaveRef.current = Date.now();
    setOrders(updatedOrders);
    try {
      await saveAllOrdersApi(updatedOrders);
      lastAdminSaveRef.current = Date.now();
    } catch (err) {
      console.warn('Failed to persist orders to Firestore:', err);
    }
  };

  // Admin: Update Site Content & persist to Firestore
  const handleUpdateSiteContent = async (updatedContent: SiteContent) => {
    lastAdminSaveRef.current = Date.now();
    setSiteContent(updatedContent);
    try {
      localStorage.setItem('cotton_nest_site_content', JSON.stringify(updatedContent));
    } catch {}
    try {
      await saveSiteContentApi(updatedContent);
    } catch (err) {
      console.warn('Failed to persist site content to Firestore:', err);
    }
  };

  const handleGlobalToggleMaintenanceMode = async () => {
    const nextMode = !siteContent?.isMaintenanceMode;
    if (nextMode) {
      const confirmed = window.confirm("Are you sure you want to put Cotton Nest under maintenance?");
      if (!confirmed) return;
    }

    const updated = {
      ...(siteContent || INITIAL_SITE_CONTENT),
      isMaintenanceMode: nextMode,
      maintenanceNotice: siteContent?.maintenanceNotice || "We're making some improvements! Cotton Nest will be back shortly. Thank you for your patience.",
    };
    await handleUpdateSiteContent(updated);
  };

  // Admin: Reset products back to factory defaults on server & local
  const handleResetProducts = async () => {
    setProducts(BEDSHEETS_CATALOG);
    setCustomImages({});
    try {
      localStorage.removeItem('cotton_nest_products');
      localStorage.removeItem('cotton_nest_custom_images');
    } catch {
      // ignore
    }
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (err) {
      console.error('Failed to reset on server:', err);
    }
  };

  // Customer Reviews & Feedback Handlers
  const handleOpenWriteReview = (productId?: string) => {
    setWriteReviewProductId(productId);
    setIsWriteReviewOpen(true);
  };

  const handleSubmitReview = async (newReview: ProductReview) => {
    setReviews((prev) => [newReview, ...prev]);
    try {
      localStorage.setItem('cotton_nest_reviews', JSON.stringify([newReview, ...reviews]));
    } catch {}
    try {
      await saveReviewApi(newReview);
    } catch (err) {
      console.warn('Failed to save review to server:', err);
    }
  };

  const handleHelpfulClick = async (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const updated = { ...r, helpfulCount: (r.helpfulCount || 0) + 1 };
          helpfulReviewApi(reviewId).catch(() => {});
          return updated;
        }
        return r;
      })
    );
  };

  // Owner Authentication Handlers
  const handleOwnerAuthenticate = (openAdmin: boolean = false) => {
    setIsOwnerPinUnlocked(true);
    if (openAdmin) {
      setIsAdminOpen(true);
    }
  };

  const handleLockOwnerMode = () => {
    setIsOwnerPinUnlocked(false);
    setIsAdminOpen(false);
    setIsPhotoManagerOpen(false);
    try {
      localStorage.removeItem('cotton_nest_owner_mode');
    } catch {
      // ignore
    }
  };

  const handleOpenAdminSafely = () => {
    // Always show the Owner Security PIN page before entering the Admin Panel
    setIsOwnerAuthOpen(true);
  };

  const handleOpenPhotoManagerSafely = () => {
    if (isOwnerMode) {
      setIsPhotoManagerOpen(true);
    } else {
      setIsOwnerAuthOpen(true);
    }
  };

  // Save custom images or videos to Cloudinary & Firestore so media persists across all devices without breaking product state
  const handleUploadImage = async (productId: string, fileOrDataUrl: string | File) => {
    try {
      const isVidFile =
        typeof fileOrDataUrl !== 'string'
          ? fileOrDataUrl.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(fileOrDataUrl.name)
          : isVideoMedia(fileOrDataUrl);

      if (isVidFile) {
        const finalUrl = await addProductGalleryImageApi(productId, fileOrDataUrl);
        if (!finalUrl) return;
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            const currentAdditional = Array.isArray(p.additionalImages) ? p.additionalImages : [];
            const currentVideos = Array.isArray(p.videos) ? p.videos : [];
            return {
              ...p,
              additionalImages: currentAdditional.includes(finalUrl) ? currentAdditional : [...currentAdditional, finalUrl],
              videos: currentVideos.includes(finalUrl) ? currentVideos : [...currentVideos, finalUrl],
              videoUrl: p.videoUrl || finalUrl,
              updatedAt: Date.now(),
            };
          })
        );
        return;
      }

      const finalUrl = await uploadImageApi(fileOrDataUrl, productId);
      if (!finalUrl) return;

      // Update state
      setCustomImages((prev) => ({ ...prev, [productId]: finalUrl }));

      // Update product directly in Firestore
      await updateSingleProduct(productId, { image: finalUrl });

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image: finalUrl, updatedAt: Date.now() } : p))
      );
    } catch (err) {
      console.error('Failed to upload media:', err);
    }
  };

  const handleResetImage = async (productId: string) => {
    setCustomImages((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });

    const defaultP = BEDSHEETS_CATALOG.find((p) => p.id === productId);
    if (defaultP) {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image: defaultP.image } : p))
      );
      try {
        await updateSingleProduct(productId, { image: defaultP.image });
      } catch (err) {
        console.warn('Failed to reset image in Firestore:', err);
      }
    }
  };

  const handleResetAllPhotos = async () => {
    setCustomImages({});
    const updated = products.map((p) => {
      const cat = BEDSHEETS_CATALOG.find((c) => c.id === p.id);
      return cat ? { ...p, image: cat.image } : p;
    });
    setProducts(updated);
    try {
      await saveAllProducts(updated);
    } catch (err) {
      console.warn('Failed to reset all photos in Firestore:', err);
    }
  };

  const totalCartCount = (cartItems || []).reduce((acc, item) => {
    if (!item || !item.product) return acc;
    const q = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    return acc + q;
  }, 0);

  const handleAddToCart = (
    product: BedsheetProduct,
    quantityOrVariant?: number | BedsheetVariant,
    variantOrCustomPrice?: any,
    optionalCustomPrice?: number
  ) => {
    if (!product || typeof product !== 'object' || !product.id) {
      console.warn('handleAddToCart aborted: invalid product object', product);
      return;
    }

    // Mandatory user sign-in check before adding item to cart
    if (!user) {
      setPendingCartItem({ product, quantityOrVariant, variantOrCustomPrice, optionalCustomPrice });
      setAuthModalReason('Please sign in with Google or Gmail to add bedsheets to your bag.');
      setIsAuthModalOpen(true);
      return;
    }

    let quantity = 1;
    let selectedVariant: BedsheetVariant | undefined;
    let customPrice: number | undefined;

    if (typeof quantityOrVariant === 'number') {
      quantity = Math.max(1, Math.round(quantityOrVariant));
      if (variantOrCustomPrice && typeof variantOrCustomPrice === 'object') {
        selectedVariant = variantOrCustomPrice;
      } else if (typeof variantOrCustomPrice === 'number') {
        customPrice = variantOrCustomPrice;
      }
      if (typeof optionalCustomPrice === 'number') {
        customPrice = optionalCustomPrice;
      }
    } else if (quantityOrVariant && typeof quantityOrVariant === 'object') {
      // Called as handleAddToCart(product, variant) from ProductCard
      selectedVariant = quantityOrVariant;
      quantity = 1;
      if (typeof variantOrCustomPrice === 'number') {
        customPrice = variantOrCustomPrice;
      }
    }

    // Sanitize variant if invalid
    let safeVariant: BedsheetVariant | undefined = undefined;
    if (selectedVariant && typeof selectedVariant === 'object' && selectedVariant.name) {
      safeVariant = {
        id: String(selectedVariant.id || 'variant-default'),
        name: String(selectedVariant.name),
        image: selectedVariant.image ? String(selectedVariant.image) : String(product.image || ''),
        colorHex: selectedVariant.colorHex ? String(selectedVariant.colorHex) : undefined,
      };
    }

    const finalProduct = customPrice ? { ...product, price: customPrice } : product;
    const variantId = safeVariant?.id;

    setCartItems((prev) => {
      const safePrev = (prev || []).filter(
        (item): item is CartItem => Boolean(item && item.product && typeof item.product === 'object' && item.product.id)
      );

      const existingIdx = safePrev.findIndex(
        (item) => item.product?.id === product.id && item.selectedVariant?.id === variantId
      );

      if (existingIdx >= 0) {
        return safePrev.map((item, idx) => {
          if (idx === existingIdx) {
            const currentQty = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1;
            return {
              ...item,
              quantity: currentQty + quantity,
              product: finalProduct,
              selectedVariant: safeVariant || item.selectedVariant,
            };
          }
          return item;
        });
      }
      return [...safePrev, { product: finalProduct, quantity, selectedVariant: safeVariant }];
    });

    setAddedProductIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedProductIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);

    // Trigger subtle cart confirmation toast with item name & size added
    const sizeText = product.size
      ? product.size
      : product.dimensions
      ? (product.dimensions.includes('(') ? product.dimensions.split('(')[0].trim() : product.dimensions)
      : 'Standard Size';

    setCartToast({
      id: String(Date.now()),
      productName: product.name,
      sizeLabel: sizeText,
      image: resolveBedsheetImage(safeVariant?.image || product.image, product.id, product.updatedAt),
      price: finalProduct.price,
      quantity,
      variantName: safeVariant?.name,
    });

    trackCustomerCartAdd(finalProduct, quantity);
  };

  // Automatically add pending item to bag once user signs in
  useEffect(() => {
    if (user && pendingCartItem) {
      const { product, quantityOrVariant, variantOrCustomPrice, optionalCustomPrice } = pendingCartItem;
      setPendingCartItem(null);
      setAuthModalReason(null);
      handleAddToCart(product, quantityOrVariant, variantOrCustomPrice, optionalCustomPrice);
    }
  }, [user, pendingCartItem]);

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (!productId) return;
    setCartItems((prev) =>
      (prev || [])
        .filter((item): item is CartItem => Boolean(item && item.product && item.product.id))
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: Math.max(1, Math.round(quantity)) } : item
        )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    if (!productId) {
      setCartItems((prev) =>
        (prev || []).filter((item): item is CartItem => Boolean(item && item?.product && item?.product?.id))
      );
      return;
    }
    setCartItems((prev) =>
      (prev || []).filter((item): item is CartItem => Boolean(item && item?.product && item?.product?.id && item?.product?.id !== productId))
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors duration-300 selection:bg-[#F3D7DE] selection:text-[#38262B]"
      style={{
        backgroundColor: 'var(--color-background, #FAF7F2)',
        color: 'var(--color-text, #2C2420)',
      }}
    >
      
      {/* Store Owner Active Mode Banner - Only visible to authenticated owner */}
      {isOwnerMode && !isAdminOpen && (
        <aside aria-label="Owner Mode active status" className="bg-[#2C2420] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#DEC89B]/40 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[#EAE2D5]">Store Owner Mode Active</span>
            {siteContent?.isMaintenanceMode ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] animate-pulse">
                🛠️ MAINTENANCE MODE ACTIVE (Visitors see maintenance screen)
              </span>
            ) : (
              <span className="text-[#A8988D] hidden sm:inline">· You can edit prices, stock, discounts &amp; sync photos</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGlobalToggleMaintenanceMode}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                siteContent?.isMaintenanceMode
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-[#FAF7F2]'
              }`}
            >
              <span>{siteContent?.isMaintenanceMode ? '🛠️ Maint: ON' : '⚡ Maint: OFF'}</span>
            </button>
            <button
              onClick={() => setIsOwnerAuthOpen(true)}
              className="px-2.5 py-1 bg-[#8C2E46] hover:bg-[#A33452] text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
            >
              ⚙️ Admin Panel
            </button>
            <button
              onClick={() => setIsPhotoManagerOpen(true)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#FAF7F2] text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
            >
              📷 Photo Studio
            </button>
            <button
              onClick={handleLockOwnerMode}
              className="px-2 py-1 text-[#A8988D] hover:text-white text-[11px] transition-colors cursor-pointer underline flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              <span>Lock / Exit</span>
            </button>
          </div>
        </aside>
      )}

      {/* If Admin is Open, show full Admin Panel */}
      {isAdminOpen ? (
        <ErrorBoundary fallbackTitle="Admin Panel Encountered an Issue" onReset={() => setIsAdminOpen(false)}>
          <AdminPanel
            products={products}
            onUpdateProducts={handleUpdateProducts}
            onResetDefaults={handleResetProducts}
            onExitAdmin={() => setIsAdminOpen(false)}
            customImages={customImages}
            onUpdateCustomImages={handleUpdateCustomImages}
            onUploadImage={handleUploadImage}
            orders={orders}
            onUpdateOrders={handleUpdateOrders}
            siteContent={siteContent}
            onUpdateSiteContent={handleUpdateSiteContent}
            onResetAllImages={handleResetAllPhotos}
            onUpdateSingleProduct={handleUpdateSingleProduct}
            currentTheme={themeConfig}
            onThemePublished={handleThemePublished}
            seasonalConfig={seasonalConfig}
            onUpdateSeasonalConfig={handleUpdateSeasonalConfig}
            reviews={reviews}
          />
        </ErrorBoundary>
      ) : siteContent?.isMaintenanceMode && !isOwnerMode ? (
        /* Maintenance Mode Full Page View for Visitors */
        <div className="min-h-screen bg-[#FAF7F2] text-[#2C2420] flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-lg">
            <Wrench className="w-10 h-10 animate-bounce" />
          </div>
          <div className="max-w-md space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#8C2E46] bg-[#FDEAF0] px-3 py-1 rounded-full border border-[#FAD1DC]">
              Cotton Nest · Pure Cotton Comfort
            </span>
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420] pt-2">
              We&apos;re making some improvements!
            </h1>
            <p className="text-xs sm:text-sm text-[#6B5D55] leading-relaxed">
              {siteContent.maintenanceNotice ||
                "We're making some improvements! Cotton Nest will be back shortly. Thank you for your patience."}
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] max-w-md w-full text-xs space-y-2.5 text-left shadow-xs">
            <p className="font-bold text-[#2C2420] uppercase tracking-wider text-[10px]">Direct Studio Inquiries:</p>
            <div className="flex items-center gap-2 text-[#6B5D55]">
              <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
              <span>Call / WhatsApp: <strong>{siteContent.company?.phone || '+91 7838625915'}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-[#6B5D55]">
              <MapPin className="w-3.5 h-3.5 text-[#C29E57]" />
              <span>{siteContent.company?.address || 'House Number 2508, Ground Floor, Sector 46, Gurgaon'}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col items-center gap-3">
            <a
              href={`https://wa.me/${siteContent.company?.rawPhone || '917838625915'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Us Directly on WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => setIsOwnerAuthOpen(true)}
              className="text-[11px] text-[#8C7A70] hover:text-[#2C2420] hover:underline cursor-pointer pt-2"
            >
              🔐 Boutique Owner / Admin Sign In
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top subtle golden luxury scroll progress indicator */}
          <motion.div
            style={{ scaleX: scrollProgressX, transformOrigin: '0%' }}
            className="fixed top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#C29E57] via-[#B83F60] to-[#C29E57] z-50 pointer-events-none"
          />

          {/* Top Navbar */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            cartCount={totalCartCount}
            openCart={() => setIsCartOpen(true)}
            onOpenPhotoManager={handleOpenPhotoManagerSafely}
            onOpenAdmin={handleOpenAdminSafely}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            isOwnerMode={isOwnerMode}
            content={siteContent}
            productsCount={products.length}
            seasonalConfig={seasonalConfig}
            updatedImagesCount={updatedImagesCount}
            onOpenNotifications={() => setIsNotificationCenterOpen(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenCompare={() => setIsCompareModalOpen(true)}
            comparedCount={comparedProductIds.length}
            wishlistCount={wishlistItems.length}
            onOpenWishlist={() => setIsWishlistOpen(true)}
            onOpenAccount={() => setIsAccountModalOpen(true)}
          />

          {/* Main Content Area */}
          <ErrorBoundary fallbackTitle="Storefront View Encountered an Issue" onReset={() => setActiveTab('home')}>
          <main className="flex-1 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* TAB 1: HOME VIEW */}
                {activeTab === 'home' && (
                  <>
                    {/* Hero Section */}
                    <Hero
                      onExploreCatalogue={() => {
                        setActiveTab('catalogue');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onVisitStore={() => {
                        setActiveTab('store');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      content={siteContent}
                    />

                    {/* Promotional Offers & Coupons Banner */}
                    <motion.div
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-20px' }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 sm:-mt-6 mb-6 relative z-10"
                    >
                      <OfferBanner onOpenCart={() => setIsCartOpen(true)} />
                    </motion.div>

                    {/* Featured Showcase: 3 Spotlight bedsheets from the 9 */}
                    <section
                      id="curated-highlights"
                      className="py-12 sm:py-16 relative z-10 transition-colors duration-300"
                    >
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        
                        <motion.div
                          initial={{ opacity: 0, y: 24 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '-50px' }}
                          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                          className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4"
                        >
                          <div>
                            <div
                              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 px-3 py-1 rounded-full liquid-glass-badge"
                              style={{ color: 'var(--color-accent, #A8823B)' }}
                            >
                              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
                              Curated Highlights
                            </div>
                            <h2
                              className="font-serif-luxury text-3xl sm:text-4xl font-semibold transition-colors duration-300"
                              style={{ color: 'var(--color-text, #2C2420)' }}
                            >
                              Popular Bedsheets This Season
                            </h2>
                            <p
                              className="text-xs sm:text-sm mt-1 transition-colors duration-300"
                              style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
                            >
                              Handpicked favorites from our pure cotton collection.
                            </p>
                          </div>

                          <motion.button
                            whileHover={{ x: 3, scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setActiveTab('catalogue');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ color: 'var(--color-primary, #70252D)' }}
                            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full liquid-glass-badge hover:bg-white transition-all cursor-pointer group self-start md:self-auto"
                          >
                            <span>Browse All {products.length} Bedsheets in Catalogue</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </motion.button>
                        </motion.div>

                        {/* 3 Featured Cards Grid with Staggered Scroll Animations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                          {products.slice(0, 3).map((product, idx) => (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, y: 28 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, margin: '-40px' }}
                              transition={{ duration: 0.55, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <ProductCard
                                product={product}
                                priority={idx < 2}
                                onQuickView={(p, editMode) => handleOpenProductModal(p, editMode)}
                                onAddToCart={(p) => handleAddToCart(p, 1)}
                                isAdded={addedProductIds.has(product.id)}
                                customImage={customImages[product.id]}
                                onUploadImage={handleUploadImage}
                                isOwnerMode={isOwnerMode}
                                onOpenOwnerAuth={() => setIsOwnerAuthOpen(true)}
                                reviews={reviews}
                                onToggleCompare={handleToggleCompare}
                                isCompared={comparedProductIds.includes(product.id)}
                                onNotifyStock={handleNotifyStock}
                                isWishlisted={isProductWishlisted(product.id)}
                                onToggleWishlist={handleToggleWishlist}
                              />
                            </motion.div>
                          ))}
                        </div>

                        {/* Direct CTA to open Special Catalogue with Scroll Reveal */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="mt-10 text-center"
                        >
                          <motion.button
                            whileHover={{ y: -2, scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setActiveTab('catalogue');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{
                              color: 'var(--color-primary, #70252D)',
                            }}
                            className="px-8 py-3.5 liquid-glass-dock hover:bg-white rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-2.5 transition-all cursor-pointer"
                          >
                            <span>Open Full {products.length}-Sheet Catalogue</span>
                            <ArrowRight className="w-4 h-4" />
                          </motion.button>
                        </motion.div>

                      </div>
                    </section>

                    {/* Story & Craft Section */}
                    <StoryAndFeatures
                      onGoToCatalogue={() => {
                        setActiveTab('catalogue');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      content={siteContent}
                    />

                    {/* Verified Customer Reviews & Comments Section */}
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ReviewsSection
                        reviews={reviews}
                        products={products}
                        onOpenWriteReview={handleOpenWriteReview}
                        onHelpfulClick={handleHelpfulClick}
                      />
                    </motion.div>

                    {/* Store Location Section */}
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <StoreLocation />
                    </motion.div>
                  </>
                )}

                {/* TAB 2: SPECIAL CATALOGUE VIEW (Strictly contains the bedsheets) */}
                {activeTab === 'catalogue' && (
                  <CatalogueView
                    products={products}
                    onQuickView={(p, editMode) => handleOpenProductModal(p, editMode)}
                    onAddToCart={(p) => handleAddToCart(p, 1)}
                    addedProductIds={addedProductIds}
                    customImages={customImages}
                    onUploadImage={handleUploadImage}
                    onOpenPhotoManager={handleOpenPhotoManagerSafely}
                    onOpenAdmin={handleOpenAdminSafely}
                    isOwnerMode={isOwnerMode}
                    onOpenOwnerAuth={() => setIsOwnerAuthOpen(true)}
                    onToggleCompare={handleToggleCompare}
                    comparedProductIds={comparedProductIds}
                    onNotifyStock={handleNotifyStock}
                    isWishlisted={isProductWishlisted}
                    onToggleWishlist={handleToggleWishlist}
                    reviews={reviews}
                  />
                )}

                {/* TAB: SEASONAL FESTIVE SHOPPING PAGE */}
                {activeTab === 'seasonal' && (
                  <SeasonalView
                    products={products}
                    seasonalConfig={seasonalConfig}
                    onAddToCart={(p, customPrice) => handleAddToCart(p, 1, customPrice)}
                    onQuickView={(p) => handleOpenProductModal(p, false)}
                    addedProductIds={Array.from(addedProductIds)}
                    isOwnerMode={isOwnerMode}
                    onOpenAdmin={handleOpenAdminSafely}
                    onExploreFullCatalogue={() => {
                      setActiveTab('catalogue');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    activeThemeId={themeConfig.activeThemeId}
                  />
                )}

                {/* TAB 3: OUR STORY & CRAFTSMANSHIP */}
                {activeTab === 'story' && (
                  <StoryAndFeatures
                    onGoToCatalogue={() => {
                      setActiveTab('catalogue');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    content={siteContent}
                  />
                )}

                {/* TAB 4: STORE LOCATION & VISIT */}
                {activeTab === 'store' && <StoreLocation />}

                {/* TAB 5: LIVE ORDERS FOR INDIVIDUAL CLIENT */}
                {activeTab === 'orders' && (
                  <LiveOrdersView
                    onExploreCatalogue={() => {
                      setActiveTab('catalogue');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                )}

                {/* TAB 6: TERMS & CONDITIONS (T&C) */}
                {activeTab === 'tc' && (
                  <TermsAndConditionsView
                    siteContent={siteContent}
                    onExploreCatalogue={() => {
                      setActiveTab('catalogue');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                )}

                {/* TAB 7: VERIFIED CUSTOMER REVIEWS & COMMENTS */}
                {activeTab === 'reviews' && (
                  <div className="pt-2 sm:pt-4">
                    <ReviewsSection
                      reviews={reviews}
                      products={products}
                      onOpenWriteReview={handleOpenWriteReview}
                      onHelpfulClick={handleHelpfulClick}
                    />
                  </div>
                )}

                {/* TAB 8: STORE PERFORMANCE & TRAFFIC ANALYTICS (ADMIN ONLY) */}
                {activeTab === 'analytics' && (
                  isOwnerMode ? (
                    <AnalyticsView
                      products={products}
                      orders={orders}
                      reviews={reviews}
                      wishlistItems={wishlistItems}
                      trafficData={trafficData}
                      onSelectProduct={(p) => handleOpenProductModal(p, false)}
                      onGoToCatalogue={() => {
                        setActiveTab('catalogue');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onGoToReviews={() => {
                        setActiveTab('reviews');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  ) : (
                    <div className="max-w-xl mx-auto my-16 px-4">
                      <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-[#DEC89B] shadow-xl space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#FDEAF0] text-[#70252D] border border-[#FAD1DC] flex items-center justify-center mx-auto shadow-inner">
                          <Lock className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C2E46] bg-[#FDEAF0] px-3 py-1 rounded-full">
                            Restricted Access
                          </span>
                          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420] pt-1">
                            Atelier Analytics Dashboard
                          </h2>
                          <p className="text-sm text-[#7A6458] leading-relaxed max-w-md mx-auto">
                            Store metrics, website visitor traffic, reviewed bedsheets, order volumes, and customer wishlist insights are strictly reserved for the Cotton Nest boutique owner and administrative staff.
                          </p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            type="button"
                            onClick={() => setIsOwnerAuthOpen(true)}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#70252D] hover:bg-[#852C36] text-white text-sm font-semibold rounded-2xl shadow-md transition-all cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                            <span>Unlock with Owner PIN</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('catalogue');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] text-sm font-semibold rounded-2xl border border-[#DEC89B] transition-all cursor-pointer"
                          >
                            <span>Browse Catalogue</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          </ErrorBoundary>

          {/* Global Product Detail Modal */}
          <ProductModal
            product={selectedProduct}
            onClose={() => {
              setSelectedProduct(null);
              setIsProductModalEditMode(false);
            }}
            onAddToCart={handleAddToCart}
            customImage={selectedProduct ? customImages[selectedProduct.id] : undefined}
            onUploadImage={handleUploadImage}
            onUpdateProduct={handleUpdateSingleProduct}
            isOwnerMode={isOwnerMode}
            initialEditMode={isProductModalEditMode}
            onOpenOwnerAuth={() => setIsOwnerAuthOpen(true)}
            reviews={reviews}
            onOpenWriteReview={handleOpenWriteReview}
            allProducts={products}
            onSelectProduct={(p) => handleOpenProductModal(p, false)}
            onToggleCompare={handleToggleCompare}
            isCompared={selectedProduct ? comparedProductIds.includes(selectedProduct.id) : false}
            onNotifyStock={handleNotifyStock}
            shippingFee={normalizeShippingFee(siteContent.shippingFeeIndia)}
            onViewTermsAndConditions={() => {
              setActiveTab('tc');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* Write Review & Comment Modal */}
          <WriteReviewModal
            isOpen={isWriteReviewOpen}
            onClose={() => setIsWriteReviewOpen(false)}
            products={products}
            defaultProductId={writeReviewProductId}
            onSubmitReview={handleSubmitReview}
          />

          {/* Photo Studio / Upload Manager Modal - Only available to Owner */}
          <PhotoUploadModal
            isOpen={isPhotoManagerOpen && isOwnerMode}
            onClose={() => setIsPhotoManagerOpen(false)}
            products={products}
            customImages={customImages}
            onUploadImage={handleUploadImage}
            onResetImage={handleResetImage}
            onResetAll={handleResetAllPhotos}
            onUpdateSingleProduct={handleUpdateSingleProduct}
          />

          {/* Slide-over Cart / Checkout Drawer */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onOrderPlaced={(order) => {
              setOrders((prev) => [order, ...prev]);
              trackCustomerOrderPlaced(order);
            }}
            shippingFee={normalizeShippingFee(siteContent.shippingFeeIndia)}
            customerProfile={customerProfile}
            orders={orders}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onViewLiveOrders={() => {
              setIsCartOpen(false);
              setActiveTab('orders');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* Mobile Sticky Bottom Bar (Thumb Navigation) */}
          <MobileBottomBar
            activeTab={activeTab as any}
            setActiveTab={setActiveTab as any}
            cartCount={totalCartCount}
            openCart={() => setIsCartOpen(true)}
            seasonalConfig={seasonalConfig}
            wishlistCount={wishlistItems.length}
            openWishlist={() => setIsWishlistOpen(true)}
            onOpenAccount={() => setIsAccountModalOpen(true)}
          />

          {/* Global Footer with discrete owner access */}
          <Footer
            onNavClick={setActiveTab as any}
            onOpenAdmin={handleOpenAdminSafely}
            isOwnerMode={isOwnerMode}
            onOpenOwnerAuth={() => setIsOwnerAuthOpen(true)}
            onLockOwnerMode={handleLockOwnerMode}
            productsCount={products.length}
          />
        </>
      )}

      {/* Google Sign In & Client Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalReason(null);
        }}
        reason={authModalReason}
        onTrackOrderDirect={(_orderId) => {
          setActiveTab('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Owner Security PIN Authentication Modal */}
      <OwnerAuthModal
        isOpen={isOwnerAuthOpen}
        onClose={() => setIsOwnerAuthOpen(false)}
        onAuthenticate={handleOwnerAuthenticate}
      />

      {/* Customer Notification Center Drawer Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearAll={handleClearAllNotifications}
        preferences={notificationPreferences}
        onUpdatePreferences={handleUpdateNotificationPreferences}
        onNavigate={handleNotificationNavigate}
        customerIdentifier={user?.email || user?.phone || 'guest'}
      />

      {/* Floating Bottom Comparison Bar (when 1-3 items selected) */}
      <ProductCompareBar
        products={products.filter((p) => comparedProductIds.includes(p.id))}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onRemove={handleRemoveFromCompare}
        onClear={handleClearCompare}
      />

      {/* Full Bedsheet Comparison Matrix Modal */}
      <ProductCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        products={products.filter((p) => comparedProductIds.includes(p.id))}
        onRemoveFromCompare={handleRemoveFromCompare}
        onClearCompare={handleClearCompare}
        onAddToCart={(p) => handleAddToCart(p, 1)}
        onViewProduct={(p) => {
          setIsCompareModalOpen(false);
          handleOpenProductModal(p, false);
        }}
      />

      {/* Back In Stock Email/WhatsApp Alert Modal */}
      <StockAlertModal
        isOpen={!!stockAlertProduct}
        onClose={() => setStockAlertProduct(null)}
        product={stockAlertProduct}
        defaultContact={user?.phone || user?.email || ''}
      />

      {/* Customer Wishlist Drawer Modal */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlistItems}
        customerProfile={customerProfile}
        onRemoveItem={handleRemoveWishlistItem}
        onMoveToCart={handleMoveToCartFromWishlist}
        onEditProfile={() => setIsCustomerModalOpen(true)}
      />

      {/* Customer Contact Details Capture Modal for Wishlist */}
      <CustomerWishlistModal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setPendingWishlistProduct(null);
        }}
        onConfirmed={handleCustomerProfileConfirmed}
        pendingProductName={pendingWishlistProduct?.product.name}
      />

      {/* Customer Loyalty Points & Rewards Modal */}
      <LoyaltyRewardsModal
        isOpen={isLoyaltyModalOpen}
        onClose={closeLoyaltyModal}
        onShopCatalogue={() => setActiveTab('catalogue')}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* All-in-One Customer Account Hub (Wishlist, Loyalty Points, Orders, Profile) */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        customerProfile={customerProfile}
        onUpdateProfile={(updated) => setCustomerProfile(updated)}
        wishlistItems={wishlistItems}
        onRemoveWishlistItem={handleRemoveWishlistItem}
        onMoveToCartFromWishlist={handleMoveToCartFromWishlist}
        orders={orders}
        onTrackOrderDirect={(orderId) => {
          setIsAccountModalOpen(false);
          setActiveTab('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCart={() => {
          setIsAccountModalOpen(false);
          setIsCartOpen(true);
        }}
        onShopCatalogue={() => {
          setIsAccountModalOpen(false);
          setActiveTab('catalogue');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isOwnerMode={isOwnerMode}
        onOpenAdmin={() => {
          setIsAccountModalOpen(false);
          setIsOwnerAuthOpen(true);
        }}
      />

      {/* Floating Smooth Scroll-to-Top Button (Apple Liquid Glass Orb) */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.12, y: -3 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 p-3.5 liquid-glass-dock rounded-full transition-all cursor-pointer group"
            title="Scroll back to top"
            aria-label="Scroll back to top"
          >
            <ChevronUp className="w-5 h-5 text-[#A8823B] group-hover:text-[#B83F60] transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chrome-Style Top-Left "Allow Notifications" Prompt */}
      <AnimatePresence>
        {showChromePushPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed top-3 left-3 sm:left-6 z-[9999] w-[calc(100vw-1.5rem)] max-w-[340px] bg-white text-[#202124] rounded-xl shadow-[0_8px_30px_ rgba(0,0,0,0.22)] border border-[#dadce0] p-4 font-sans"
            role="dialog"
            aria-label="Notification permission request"
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="text-[13px] leading-snug text-[#202124]">
                <span className="font-semibold">{typeof window !== 'undefined' ? window.location.host : 'Cotton Nest'}</span> wants to
              </div>
              <button
                data-dismiss-push-prompt="true"
                onClick={handleDismissChromeNotifications}
                className="text-[#5f6368] hover:text-[#202124] p-0.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close notification prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2.5 text-[14px] text-[#3c4043] mb-4">
              <Bell className="w-4 h-4 text-[#5f6368] shrink-0" />
              <span>Show notifications</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                data-dismiss-push-prompt="true"
                onClick={handleDismissChromeNotifications}
                className="px-4 py-1.5 rounded-full border border-[#dadce0] text-[#1a73e8] hover:bg-[#f8fbff] text-[13px] font-medium transition-colors cursor-pointer"
              >
                Block
              </button>
              <button
                onClick={handleAllowChromeNotifications}
                className="px-4 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[13px] font-medium shadow-xs transition-colors cursor-pointer"
              >
                Allow
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chrome-Style Top-Right "Install App?" Omnibox Pop-out */}
      <ChromeInstallPopout />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Subtle Cart Addition Toast Notification */}
      <CartToastNotification
        toast={cartToast}
        onClose={() => setCartToast(null)}
        onOpenCart={() => setIsCartOpen(true)}
      />
    </div>
  );
}
