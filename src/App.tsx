/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BedsheetProduct, BEDSHEETS_CATALOG, COMPANY_DETAILS } from './data/products';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CatalogueView } from './components/CatalogueView';
import { CartDrawer, CartItem } from './components/CartDrawer';
import { StoreLocation } from './components/StoreLocation';
import { StoryAndFeatures } from './components/StoryAndFeatures';
import { Footer } from './components/Footer';
import { MobileBottomBar } from './components/MobileBottomBar';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { AdminPanel } from './components/AdminPanel';
import { OwnerAuthModal } from './components/OwnerAuthModal';
import { WhatsAppPhotoHelperModal, WhatsAppHelperData } from './components/WhatsAppPhotoHelperModal';
import { LiveOrdersView } from './components/LiveOrdersView';
import { TermsAndConditionsView } from './components/TermsAndConditionsView';
import { SeasonalView } from './components/SeasonalView';
import { AuthModal } from './components/AuthModal';
import { GoogleAccountChooserModal } from './components/GoogleAccountChooserModal';
import { setWhatsAppListener } from './utils/whatsappOrder';
import { Order, INITIAL_ORDERS } from './data/orders';
import { SiteContent, INITIAL_SITE_CONTENT } from './data/siteContent';
import { SeasonalConfig, INITIAL_SEASONAL_CONFIG } from './data/seasonal';
import {
  getProducts,
  saveAllProducts,
  updateSingleProduct,
  getOrders,
  getSiteContent,
  saveSiteContentApi,
  uploadImageApi,
  getPublishedThemeApi,
  getReviewsApi,
  saveReviewApi,
  helpfulReviewApi,
  getSeasonalConfigApi,
  saveSeasonalConfigApi,
} from './services/api';
import {
  savePersistentImage,
  getAllPersistentImages,
  removePersistentImage,
  clearAllPersistentImages,
  getPersistentProducts,
  savePersistentProducts,
  getPersistentContent,
  savePersistentContent
} from './utils/persistentStorage';
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

  const [isOwnerAuthOpen, setIsOwnerAuthOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [whatsAppHelperData, setWhatsAppHelperData] = useState<WhatsAppHelperData | null>(null);

  // Store Owner Authentication Mode (default false for viewers)
  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cotton_nest_owner_mode') === 'true';
    } catch {
      return false;
    }
  });

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

  const handleThemePublished = (newTheme: WebsiteThemeConfig) => {
    setThemeConfig(newTheme);
    saveStoredPublishedTheme(newTheme);
    applyThemeToDom(newTheme.colors);
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
      return saved ? JSON.parse(saved) : [];
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

  // Load products, orders, content, reviews, theme and seasonal on mount & sync periodically
  useEffect(() => {
    let isMounted = true;

    // 1. Initial fast local cache load from IndexedDB
    getPersistentProducts().then((idb) => {
      if (isMounted && idb && Array.isArray(idb) && idb.length > 0) {
        setProducts((curr) => {
          const currTime = Math.max(...curr.map((p) => p.updatedAt || 0), 0);
          const idbTime = Math.max(...idb.map((p) => p.updatedAt || 0), 0);
          if (idbTime >= currTime || curr === BEDSHEETS_CATALOG) {
            return idb;
          }
          return curr;
        });
      }
    }).catch(() => {});

    getPersistentContent().then((idbContent) => {
      if (isMounted && idbContent && idbContent.company) {
        setSiteContent((curr) => (curr === INITIAL_SITE_CONTENT ? idbContent : curr));
      }
    }).catch(() => {});

    // 2. Authoritative load from Backend Server File (store_db.json)
    const loadDataFromServer = async () => {
      try {
        const [serverProducts, serverOrders, serverContent, serverReviews, serverTheme, serverSeasonal] = await Promise.all([
          fetch(`/api/products?t=${Date.now()}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          getOrders().catch(() => null),
          getSiteContent().catch(() => null),
          getReviewsApi().catch(() => null),
          getPublishedThemeApi().catch(() => null),
          getSeasonalConfigApi().catch(() => null),
        ]);

        if (isMounted) {
          if (serverReviews && Array.isArray(serverReviews) && serverReviews.length > 0) {
            setReviews(serverReviews);
          }

          if (serverProducts && Array.isArray(serverProducts) && serverProducts.length > 0) {
            // Sort by order field
            const orderMap = new Map(BEDSHEETS_CATALOG.map((p, idx) => [p.id, idx]));
            const sorted = [...serverProducts].sort((a: any, b: any) => {
              const orderA = typeof a.order === 'number' ? a.order : (orderMap.get(a.id) ?? 999);
              const orderB = typeof b.order === 'number' ? b.order : (orderMap.get(b.id) ?? 999);
              return orderA - orderB;
            });

            const mergedProducts = sorted.map((p: any) => ({
              ...p,
              image: resolveBedsheetImage(p.image, p.id, p.updatedAt),
            }));

            const serverTime = Math.max(...mergedProducts.map((p) => p.updatedAt || 0), 0);
            lastServerTimestampRef.current = serverTime;

            if (!isAdminOpenRef.current || Date.now() - lastAdminSaveRef.current > 5000) {
              setProducts(mergedProducts);
              savePersistentProducts(mergedProducts, serverTime).catch(() => {});
              try {
                localStorage.setItem('cotton_nest_products', JSON.stringify(mergedProducts));
                localStorage.setItem('cotton_nest_products_updated_at', String(serverTime));
              } catch {}
            }
          }

          if (serverOrders) {
            setOrders(serverOrders);
          }

          if (serverContent && (!isAdminOpenRef.current || Date.now() - lastAdminSaveRef.current > 5000)) {
            setSiteContent(serverContent);
          }

          if (serverTheme && serverTheme.colors && isValidHex(serverTheme.colors.primary)) {
            setThemeConfig(serverTheme);
            saveStoredPublishedTheme(serverTheme);
            applyThemeToDom(serverTheme.colors);
            lastThemeTimestampRef.current = serverTheme.updatedAt || 0;
          }

          if (serverSeasonal && typeof serverSeasonal.name === 'string') {
            setSeasonalConfig(serverSeasonal);
            lastSeasonalTimestampRef.current = serverSeasonal.updatedAt || 0;
            try {
              localStorage.setItem('cotton_nest_seasonal', JSON.stringify(serverSeasonal));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Server sync failed:', err);
      }
    };

    loadDataFromServer();

    // 3. Fast Cross-Device Sync Polling (every 4 seconds)
    // Lets mobile phones and other browsers instantly reflect any new bedsheet added on PC!
    const syncInterval = setInterval(async () => {
      if (!isMounted || isAdminOpenRef.current) return;
      if (Date.now() - lastAdminSaveRef.current < 4000) return;

      try {
        const res = await fetch(`/api/sync-check?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const syncInfo = await res.json();
          const shouldUpdate =
            syncInfo.productCount !== productsRef.current.length ||
            (syncInfo.timestamp && syncInfo.timestamp > lastServerTimestampRef.current) ||
            (syncInfo.themeUpdatedAt && syncInfo.themeUpdatedAt > lastThemeTimestampRef.current) ||
            (syncInfo.seasonalUpdatedAt && syncInfo.seasonalUpdatedAt > lastSeasonalTimestampRef.current);

          if (shouldUpdate) {
            loadDataFromServer();
          }
        }
      } catch {
        // Network hiccups silently ignored
      }
    }, 4000);

    // When returning to tab or switching apps on mobile, refresh data
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted && !isAdminOpenRef.current) {
        loadDataFromServer();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
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
        setIsOwnerMode(true);
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
        setIsOwnerMode(true);
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

  // Admin: Update all products & persist to backend server
  const handleUpdateProducts = async (updatedProducts: BedsheetProduct[]) => {
    lastAdminSaveRef.current = Date.now();
    setProducts(updatedProducts);
    try {
      localStorage.setItem('cotton_nest_products', JSON.stringify(updatedProducts));
    } catch (err) {
      console.warn('Storage quota exceeded:', err);
    }
    await saveAllProducts(updatedProducts);
  };

  const handleUpdateSingleProduct = (updatedProduct: BedsheetProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setSelectedProduct(updatedProduct);
  };

  // Admin: Update Orders & persist to backend server
  const handleUpdateOrders = async (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
    try {
      localStorage.setItem('cotton_nest_orders', JSON.stringify(updatedOrders));
    } catch (err) {
      console.warn('Storage quota exceeded:', err);
    }
    try {
      await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrders),
      });
    } catch (err) {
      console.error('Failed to sync orders to server:', err);
    }
  };

  // Admin: Update Site Content & persist to backend server
  const handleUpdateSiteContent = async (updatedContent: SiteContent) => {
    lastAdminSaveRef.current = Date.now();
    setSiteContent(updatedContent);
    try {
      localStorage.setItem('cotton_nest_site_content', JSON.stringify(updatedContent));
    } catch (err) {
      console.warn('Storage quota exceeded:', err);
    }
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
    setIsOwnerMode(true);
    setIsAdminOpen(true);
    try {
      localStorage.setItem('cotton_nest_owner_mode', 'true');
    } catch {
      // ignore
    }
  };

  const handleLockOwnerMode = () => {
    setIsOwnerMode(false);
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

  // Save custom images to Cloudinary, server store, IndexedDB & local storage so photos NEVER reset!
  const handleUploadImage = async (productId: string, fileOrDataUrl: string | File) => {
    try {
      const finalUrl = await uploadImageApi(fileOrDataUrl, productId);

      // 1. Permanently persist to IndexedDB
      await savePersistentImage(productId, finalUrl);

      // 2. Update state and attempt localStorage cache
      setCustomImages((prev) => {
        const updated = { ...prev, [productId]: finalUrl };
        try {
          localStorage.setItem('cotton_nest_custom_images', JSON.stringify(updated));
        } catch (err) {
          console.warn('Storage quota exceeded, safely stored in IndexedDB:', err);
        }
        return updated;
      });

      // 3. Update product on server and locally
      await updateSingleProduct(productId, { image: finalUrl });

      setProducts((prev) => {
        const updated = prev.map((p) => (p.id === productId ? { ...p, image: finalUrl, updatedAt: Date.now() } : p));
        savePersistentProducts(updated, Date.now()).catch(() => {});
        try {
          localStorage.setItem('cotton_nest_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err) {
      console.error('Failed to upload image:', err);
    }
  };

  const handleResetImage = async (productId: string) => {
    await removePersistentImage(productId);

    setCustomImages((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      try {
        localStorage.setItem('cotton_nest_custom_images', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    const defaultP = BEDSHEETS_CATALOG.find((p) => p.id === productId);
    if (defaultP) {
      const updated = products.map((p) => (p.id === productId ? { ...p, image: defaultP.image } : p));
      setProducts(updated);
      await saveAllProducts(updated);
    }
  };

  const handleResetAllPhotos = async () => {
    await clearAllPersistentImages();
    setCustomImages({});
    try {
      localStorage.removeItem('cotton_nest_custom_images');
    } catch {
      // ignore
    }
    // Revert custom photos back to default catalog photos without touching prices, names, or inventory!
    setProducts((prev) => {
      const updated = prev.map((p) => {
        const cat = BEDSHEETS_CATALOG.find((c) => c.id === p.id);
        return cat ? { ...p, image: cat.image } : p;
      });
      saveAllProducts(updated);
      return updated;
    });
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleAddToCart = (
    product: BedsheetProduct,
    quantity: number = 1,
    variantOrCustomPrice?: any,
    optionalCustomPrice?: number
  ) => {
    const customPrice = typeof variantOrCustomPrice === 'number' ? variantOrCustomPrice : optionalCustomPrice;
    const finalProduct = customPrice ? { ...product, price: customPrice } : product;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity, product: finalProduct }
            : item
        );
      }
      return [...prev, { product: finalProduct, quantity }];
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
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
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
            onOpenGoogleChooser={() => setIsGoogleChooserOpen(true)}
            isOwnerMode={isOwnerMode}
            content={siteContent}
            productsCount={products.length}
            seasonalConfig={seasonalConfig}
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
                onOpenGoogleChooser={() => setIsGoogleChooserOpen(true)}
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

      {/* Google Account Chooser Modal (Choose an account dialog matching Google OAuth) */}
      <GoogleAccountChooserModal
        isOpen={isGoogleChooserOpen}
        onClose={() => setIsGoogleChooserOpen(false)}
        onOpenPhoneAuth={() => {
          setIsGoogleChooserOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Google Sign In & Client Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenGoogleChooser={() => {
          setIsAuthModalOpen(false);
          setIsGoogleChooserOpen(true);
        }}
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
