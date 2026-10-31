/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BedsheetProduct, BedsheetVariant, BEDSHEETS_CATALOG, COMPANY_DETAILS } from './data/products';
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
import { OwnerAuthModal } from './components/OwnerAuthModal';
import { WhatsAppPhotoHelperModal, WhatsAppHelperData } from './components/WhatsAppPhotoHelperModal';
import { LiveOrdersView } from './components/LiveOrdersView';
import { TermsAndConditionsView } from './components/TermsAndConditionsView';
import { SeasonalView } from './components/SeasonalView';
import { AuthModal } from './components/AuthModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { ProductCompareModal } from './components/ProductCompareModal';
import { ProductCompareBar } from './components/ProductCompareBar';
import { StockAlertModal } from './components/StockAlertModal';
import {
  AppNotification,
  DEFAULT_NOTIFICATIONS,
  NotificationPreferences,
  getStoredNotificationPreferences,
  saveStoredNotificationPreferences,
} from './data/notifications';
import { initPushNotifications, triggerLocalPushNotification } from './utils/pushNotifications';
import { useAuth } from './context/AuthContext';
import { setWhatsAppListener } from './utils/whatsappOrder';
import { Order, INITIAL_ORDERS } from './data/orders';
import { SiteContent, INITIAL_SITE_CONTENT } from './data/siteContent';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from './data/seasonal';
import {
  getProducts,
  saveAllProducts,
  updateSingleProduct,
  getOrders,
  saveOrder,
  updateOrderStatus,
  deleteOrder,
  getSiteContent,
  saveSiteContentApi,
  uploadImageApi,
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
} from './services/api';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerWishlistModal } from './components/CustomerWishlistModal';
import {
  WishlistItem,
  CustomerProfile,
  getCurrentCustomerProfile,
  saveCurrentCustomerProfile,
  getLocalWishlist,
  saveLocalWishlist,
} from './data/wishlist';
import { collection, doc, onSnapshot } from 'firebase/firestore';
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
import { resolveBedsheetImage } from './utils/imageUrl';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, HeartHandshake, Phone, MessageCircle, Lock, Unlock, Cloud, ChevronUp, ChevronDown, Star } from 'lucide-react';
import { motion, useScroll, useSpring, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews'>('home');
  const [selectedProduct, setSelectedProduct] = useState<BedsheetProduct | null>(null);
  const [isProductModalEditMode, setIsProductModalEditMode] = useState<boolean>(false);

  const handleOpenProductModal = (product: BedsheetProduct, editMode: boolean = false) => {
    setSelectedProduct(product);
    setIsProductModalEditMode(editMode);
  };

  const [isCartOpen, setIsCartOpen] = useState(false);
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
  const [isOwnerAuthOpen, setIsOwnerAuthOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [whatsAppHelperData, setWhatsAppHelperData] = useState<WhatsAppHelperData | null>(null);

  // Customer Wishlist State with local caching and backend sync
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(() => {
    return getCurrentCustomerProfile();
  });

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => {
    return getLocalWishlist();
  });

  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
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
      setPendingWishlistProduct(null);
    }
  };

  const handleRemoveWishlistItem = (id: string) => {
    const updated = wishlistItems.filter((item) => item.id !== id);
    setWishlistItems(updated);
    saveLocalWishlist(updated);
    removeWishlistItemApi(id).catch(() => {});
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

  // Store Owner Authentication Mode (unlocked by Google login adityaa.22082011@gmail.com or PIN)
  const [isOwnerPinUnlocked, setIsOwnerPinUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cotton_nest_owner_mode') === 'true';
    } catch {
      return false;
    }
  });

  const isOwnerMode = isOwnerPinUnlocked || isOwner;

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

  // Apply theme to DOM on initial mount
  useEffect(() => {
    applyThemeToDom(themeConfig.colors);
  }, []);

  // Fetch published theme from server API on initial load
  useEffect(() => {
    let isMounted = true;
    getPublishedThemeApi()
      .then((remoteTheme) => {
        if (isMounted && remoteTheme && remoteTheme.colors && isValidHex(remoteTheme.colors.primary)) {
          setThemeConfig(remoteTheme);
          saveStoredPublishedTheme(remoteTheme);
          applyThemeToDom(remoteTheme.colors);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleThemePublished = async (newTheme: WebsiteThemeConfig) => {
    setThemeConfig(newTheme);
    applyThemeToDom(newTheme.colors);
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
        return JSON.parse(saved);
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

  // Initialize service worker once on mount
  useEffect(() => {
    initPushNotifications().catch(() => {});
  }, []);

  // Real-time authoritative subscriptions to Cloud Firestore
  useEffect(() => {
    testConnection();

    // 1. Authoritative Products listener from Firestore
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedProducts: BedsheetProduct[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as BedsheetProduct;
            loadedProducts.push({
              ...data,
              id: docSnap.id,
              image: resolveBedsheetImage(data.image, docSnap.id, data.updatedAt),
            });
          });
          loadedProducts.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 9999;
            const orderB = typeof b.order === 'number' ? b.order : 9999;
            return orderA - orderB;
          });
          setProducts(loadedProducts);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    );

    // 2. Authoritative Theme listener from Firestore
    const unsubTheme = onSnapshot(
      doc(db, 'theme', 'active'),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteTheme = docSnap.data() as WebsiteThemeConfig;
          if (remoteTheme && remoteTheme.colors && isValidHex(remoteTheme.colors.primary)) {
            setThemeConfig(remoteTheme);
            applyThemeToDom(remoteTheme.colors);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'theme/active');
      }
    );

    // 3. Authoritative Seasonal Config listener from Firestore
    const unsubSeasonal = onSnapshot(
      doc(db, 'seasonal', 'active'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SeasonalConfig;
          if (data && typeof data === 'object' && typeof data.name === 'string') {
            setSeasonalConfig(data);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'seasonal/active');
      }
    );

    // 4. Authoritative Orders listener from Firestore
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedOrders: Order[] = [];
          snapshot.forEach((d) => loadedOrders.push({ ...(d.data() as Order), id: d.id }));
          loadedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(loadedOrders);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );

    // 5. Authoritative Reviews listener from Firestore
    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedReviews: ProductReview[] = [];
          snapshot.forEach((d) => loadedReviews.push({ ...(d.data() as ProductReview), id: d.id }));
          loadedReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReviews(loadedReviews);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reviews');
      }
    );

    // 6. Authoritative Site Content listener from Firestore
    const unsubContent = onSnapshot(
      doc(db, 'site_content', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          const content = docSnap.data() as SiteContent;
          if (content && content.company) {
            setSiteContent(content);
            try {
              localStorage.setItem('cotton_nest_site_content', JSON.stringify(content));
            } catch {}
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'site_content/main');
      }
    );

    // 7. Authoritative Custom Image Links listener from Firestore
    const unsubCustomImages = onSnapshot(
      collection(db, 'custom_images'),
      (snapshot) => {
        if (!snapshot.empty) {
          const imageMap: Record<string, string> = {};
          snapshot.forEach((d) => {
            const data = d.data();
            if (data && data.imageUrl && typeof data.imageUrl === 'string') {
              imageMap[d.id] = data.imageUrl;
            }
          });
          setCustomImages((prev) => ({ ...prev, ...imageMap }));
        }
      },
      (error) => {
        console.warn('Could not subscribe to custom_images:', error);
      }
    );

    // 8. Authoritative Notifications listener from Firestore
    const unsubNotifications = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: AppNotification[] = [];
          snapshot.forEach((d) => {
            loaded.push({ ...(d.data() as AppNotification), id: d.id });
          });
          loaded.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setNotifications(loaded);
          try {
            localStorage.setItem('cotton_nest_notifications', JSON.stringify(loaded));
          } catch {}
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

  // Listen for WhatsApp order events to show photo helper modal
  useEffect(() => {
    setWhatsAppListener((data) => {
      setWhatsAppHelperData(data);
    });
    return () => setWhatsAppListener(null);
  }, []);

  // Secret Owner Access Listeners: ?admin=true in URL & Ctrl+Shift+A shortcut
  useEffect(() => {
    // 1. Check URL parameters: ?admin=true or #admin
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true' || window.location.hash === '#admin') {
        // Clean URL quietly
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {
          // ignore
        }
        setIsOwnerPinUnlocked(true);
        setIsAdminOpen(true);
        try {
          localStorage.setItem('cotton_nest_owner_mode', 'true');
        } catch {
          // ignore
        }
      }
    };
    checkUrl();

    // 2. Keyboard shortcut: Ctrl + Shift + A (or Cmd + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setIsOwnerPinUnlocked(true);
        setIsAdminOpen((prev) => !prev);
        try {
          localStorage.setItem('cotton_nest_owner_mode', 'true');
        } catch {}
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
  const handleUpdateProducts = async (updatedProducts: BedsheetProduct[]) => {
    lastAdminSaveRef.current = Date.now();
    setProducts(updatedProducts);
    await saveAllProducts(updatedProducts);
  };

  const handleUpdateSingleProduct = async (updatedProduct: BedsheetProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setSelectedProduct(updatedProduct);
    try {
      await updateSingleProduct(updatedProduct.id, updatedProduct);
    } catch (err) {
      console.warn('Failed to persist single product edit to Firestore:', err);
    }
  };

  // Admin: Update Orders & persist to Firestore
  const handleUpdateOrders = async (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
  };

  // Admin: Update Site Content & persist to Firestore
  const handleUpdateSiteContent = async (updatedContent: SiteContent) => {
    lastAdminSaveRef.current = Date.now();
    setSiteContent(updatedContent);
    try {
      localStorage.setItem('cotton_nest_site_content', JSON.stringify(updatedContent));
    } catch {}
    await saveSiteContentApi(updatedContent);
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
  const handleOwnerAuthenticate = () => {
    setIsOwnerPinUnlocked(true);
    setIsAdminOpen(true);
    try {
      localStorage.setItem('cotton_nest_owner_mode', 'true');
    } catch {
      // ignore
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
    if (isOwnerMode) {
      setIsAdminOpen(true);
    } else {
      setIsOwnerAuthOpen(true);
    }
  };

  const handleOpenPhotoManagerSafely = () => {
    if (isOwnerMode) {
      setIsPhotoManagerOpen(true);
    } else {
      setIsOwnerAuthOpen(true);
    }
  };

  // Save custom images to Cloudinary & Firestore so photos persist across all devices
  const handleUploadImage = async (productId: string, fileOrDataUrl: string | File) => {
    try {
      const finalUrl = await uploadImageApi(fileOrDataUrl, productId);

      // Update state
      setCustomImages((prev) => ({ ...prev, [productId]: finalUrl }));

      // Update product directly in Firestore
      await updateSingleProduct(productId, { image: finalUrl });

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image: finalUrl, updatedAt: Date.now() } : p))
      );
    } catch (err) {
      console.error('Failed to upload image:', err);
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
      await updateSingleProduct(productId, { image: defaultP.image });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image: defaultP.image } : p))
      );
    }
  };

  const handleResetAllPhotos = async () => {
    setCustomImages({});
    const updated = products.map((p) => {
      const cat = BEDSHEETS_CATALOG.find((c) => c.id === p.id);
      return cat ? { ...p, image: cat.image } : p;
    });
    setProducts(updated);
    await saveAllProducts(updated);
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
  };

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
            <span className="text-[#A8988D] hidden sm:inline">· You can edit prices, stock, discounts &amp; sync photos</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdminOpen(true)}
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
        <AdminPanel
          products={products}
          onUpdateProducts={handleUpdateProducts}
          onResetDefaults={handleResetProducts}
          onExitAdmin={() => setIsAdminOpen(false)}
          customImages={customImages}
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
          />

          {/* Main Content Area */}
          <main className="flex-1">
            
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 sm:-mt-6 mb-6 relative z-10">
                  <OfferBanner onOpenCart={() => setIsCartOpen(true)} />
                </div>

                {/* Featured Showcase: 3 Spotlight bedsheets from the 9 */}
                <section
                  id="curated-highlights"
                  className="py-12 sm:py-16 relative transition-colors duration-300"
                  style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
                >
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4"
                    >
                      <div>
                        <div
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1"
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

                      <button
                        onClick={() => {
                          setActiveTab('catalogue');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{ color: 'var(--color-primary, #70252D)' }}
                        className="inline-flex items-center gap-2 text-xs font-semibold hover:opacity-80 transition-all cursor-pointer group"
                      >
                        <span>Browse All {products.length} Bedsheets in Catalogue</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </motion.div>

                    {/* 3 Featured Cards Grid with Staggered Scroll Animations */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 transition-colors duration-300"
                      style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
                    >
                      {products.slice(0, 3).map((product, idx) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 35 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={{ duration: 0.6, delay: idx * 0.14, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <ProductCard
                            product={product}
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
                      transition={{ duration: 0.5, delay: 0.25 }}
                      className="mt-10 text-center"
                    >
                      <button
                        onClick={() => {
                          setActiveTab('catalogue');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          backgroundColor: 'var(--color-surface, #FFFFFF)',
                          color: 'var(--color-primary, #70252D)',
                          borderColor: 'var(--color-border, #EAE2D5)',
                        }}
                        className="px-8 py-3.5 hover:shadow-md border rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                      >
                        <span>Open Full {products.length}-Sheet Catalogue</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
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
                <ReviewsSection
                  reviews={reviews}
                  products={products}
                  onOpenWriteReview={handleOpenWriteReview}
                  onHelpfulClick={handleHelpfulClick}
                />

                {/* Store Location Section */}
                <StoreLocation />
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

          </main>

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
          />

          {/* Slide-over Cart / Checkout Drawer */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onOrderPlaced={(order) => setOrders((prev) => [order, ...prev])}
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
        onClose={() => setIsAuthModalOpen(false)}
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

      {/* WhatsApp Photo Helper & Preview Modal */}
      <WhatsAppPhotoHelperModal
        data={whatsAppHelperData}
        onClose={() => setWhatsAppHelperData(null)}
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

      {/* Floating Smooth Scroll-to-Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.25 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #2C2420)',
              borderColor: 'var(--color-border, #DEC89B)',
            }}
            className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 p-3 backdrop-blur-md border rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer group"
            title="Scroll back to top"
            aria-label="Scroll back to top"
          >
            <ChevronUp className="w-5 h-5 text-[#A8823B] group-hover:text-[#B83F60] transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
