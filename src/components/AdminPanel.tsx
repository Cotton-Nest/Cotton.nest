import React, { useState, useRef, useEffect } from 'react';
import {
  BedsheetProduct,
  BedsheetVariant,
  COMPANY_DETAILS,
  BEDSHEETS_CATALOG
} from '../data/products';
import { Order, OrderStatus } from '../data/orders';
import { SiteContent, INITIAL_SITE_CONTENT } from '../data/siteContent';
import {
  uploadImageApi,
  removeProduct,
  saveSeasonalConfigApi,
  reorderProductsApi,
  addProduct,
  updateSingleProduct,
  saveSiteContentApi,
  computeUpdatedImagesCount,
  addProductGalleryImageApi,
  removeProductGalleryImageApi,
  saveUpdatedImagesStatsApi,
} from '../services/api';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
  checkCloudinaryConfig
} from '../services/cloudinary';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { useAuth } from '../context/AuthContext';
import { ThemeCustomizer } from './ThemeCustomizer';
import { WebsiteThemeConfig, CLASSIC_COTTON_NEST_COLORS } from '../data/theme';
import { SeasonalConfig, SeasonalItemDiscount, INITIAL_SEASONAL_CONFIG } from '../data/seasonal';
import { AdminCouponsSection } from './AdminCouponsSection';
import { AdminNotificationsSection } from './AdminNotificationsSection';
import { AdminWishlistsSection } from './AdminWishlistsSection';
import { ProductReview } from '../data/reviews';
import {
  Heart,
  Bell,
  Package,
  Percent,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Upload,
  ArrowLeft,
  Check,
  Tag,
  Plus,
  Trash2,
  ShoppingBag,
  Clock,
  Phone,
  MessageCircle,
  FileText,
  MapPin,
  TrendingUp,
  Boxes,
  Truck,
  Edit3,
  Calendar,
  Layers,
  Save,
  Palette,
  ChevronDown,
  ChevronUp,
  Download,
  ShieldCheck,
  X,
  Cloud,
  Loader2,
  HelpCircle,
  ExternalLink,
  GripVertical,
  MoveVertical,
  ArrowUpDown,
  Gift,
  Ticket
} from 'lucide-react';

interface AdminPanelProps {
  products: BedsheetProduct[];
  onUpdateProducts: (updatedProducts: BedsheetProduct[]) => void;
  onResetDefaults: () => void;
  onExitAdmin: () => void;
  customImages: Record<string, string>;
  onUploadImage: (productId: string, dataUrl: string) => void;
  orders: Order[];
  onUpdateOrders: (orders: Order[]) => void;
  siteContent: SiteContent;
  onUpdateSiteContent: (content: SiteContent) => void;
  onResetAllImages?: () => void;
  onUpdateSingleProduct?: (updatedProduct: BedsheetProduct) => void;
  currentTheme?: WebsiteThemeConfig;
  onThemePublished?: (theme: WebsiteThemeConfig) => void;
  seasonalConfig?: SeasonalConfig;
  onUpdateSeasonalConfig?: (config: SeasonalConfig) => void;
  reviews?: ProductReview[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  onUpdateProducts,
  onResetDefaults,
  onExitAdmin,
  customImages,
  onUploadImage,
  orders,
  onUpdateOrders,
  siteContent,
  onUpdateSiteContent,
  onResetAllImages,
  onUpdateSingleProduct,
  currentTheme = {
    activeThemeId: 'classic',
    themeName: 'Classic Cotton Nest',
    colors: CLASSIC_COTTON_NEST_COLORS,
    updatedAt: Date.now(),
  },
  onThemePublished,
  seasonalConfig,
  onUpdateSeasonalConfig,
  reviews = [],
}) => {
  // Tabs: 'products' | 'orders' | 'seasonal' | 'coupons' | 'notifications' | 'wishlists' | 'content' | 'appearance'
  const [activeAdminTab, setActiveAdminTab] = useState<'products' | 'orders' | 'seasonal' | 'coupons' | 'notifications' | 'wishlists' | 'content' | 'appearance'>('products');

  // Seasonal Page state
  const [editableSeasonal, setEditableSeasonal] = useState<SeasonalConfig>(() => {
    return seasonalConfig || INITIAL_SEASONAL_CONFIG;
  });

  useEffect(() => {
    if (seasonalConfig) {
      setEditableSeasonal(seasonalConfig);
    }
  }, [seasonalConfig]);

  const [seasonalSearchQuery, setSeasonalSearchQuery] = useState('');

  // Products local state
  const [editableProducts, setEditableProducts] = useState<BedsheetProduct[]>(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Authoritative count of updated/custom photos remembered across sessions
  const totalUpdatedImagesCount = computeUpdatedImagesCount(
    editableProducts && editableProducts.length > 0 ? editableProducts : products,
    customImages
  );

  useEffect(() => {
    saveUpdatedImagesStatsApi(totalUpdatedImagesCount).catch(() => {});
  }, [totalUpdatedImagesCount]);

  // Drag and drop card reordering state
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  // Sync with upstream products updates
  useEffect(() => {
    if (products && products.length > 0) {
      setEditableProducts(products);
    }
  }, [products]);

  // Expanded variant managers for specific product IDs
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});
  // Expanded specifications & story editors for specific product IDs
  const [expandedSpecs, setExpandedSpecs] = useState<Record<string, boolean>>({});

  // New variant draft form per product: { [productId]: { name: string; colorHex: string; image: string } }
  const [variantDrafts, setVariantDrafts] = useState<Record<string, { name: string; colorHex: string; image: string }>>({});

  // Cloudinary image upload tracking & configuration status
  const [replacingProductId, setReplacingProductId] = useState<string | null>(null);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{ configured: boolean; cloudName?: string; error?: string } | null>(null);
  const [isCloudinaryHelpModalOpen, setIsCloudinaryHelpModalOpen] = useState(false);
  const [newProductFile, setNewProductFile] = useState<File | null>(null);

  React.useEffect(() => {
    checkCloudinaryConfig().then((status) => {
      setCloudinaryStatus(status);
    });
  }, []);

  // New Bedsheet Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<BedsheetProduct>>({
    name: '',
    collection: 'Signature Collection',
    price: 1899,
    originalPrice: 2499,
    dimensions: '108 x 108 inches (274 x 274 cm)',
    pillowCovers: '2 Pillow Covers (45 x 70 cm)',
    threadCount: '350 Thread Count',
    fabric: '100% Pure Percale Cotton',
    pattern: 'Artisanal Floral',
    colorTone: 'Ivory & Pastels',
    description: 'Pristine 100% combed cotton bedsheet crafted for luxury Indian king beds.',
    image: '/images/exact_sheet1_pink_rose_1790997736396.jpg',
    variants: [],
    badge: 'New Arrival',
    inStock: true,
    stockQuantity: 15,
    features: [
      'Expansive 108x108 inch King size drop',
      'Includes 2 matching flanged pillow shams',
      'Zero synthetic blend, 100% breathable cotton',
      'Color-fast reactive dye print'
    ]
  });
  const newProductFileRef = useRef<HTMLInputElement>(null);
  const newProductVariantFileRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [newProductVariantDraft, setNewProductVariantDraft] = useState<{
    name: string;
    colorHex: string;
    image: string;
  }>({ name: '', colorHex: '#C29E57', image: '' });

  const handleAddNewProductVariant = () => {
    if (!newProductVariantDraft.name.trim() || !newProductVariantDraft.image) {
      showToast('Please enter a Color Name and select a Photo for this variant.');
      return;
    }
    const createdVariant: BedsheetVariant = {
      id: `var-new-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      name: newProductVariantDraft.name.trim(),
      colorHex: newProductVariantDraft.colorHex || '#C29E57',
      image: newProductVariantDraft.image,
    };
    setNewProduct((prev) => ({
      ...prev,
      variants: [...(prev.variants || []), createdVariant],
    }));
    setNewProductVariantDraft({ name: '', colorHex: '#C29E57', image: '' });
  };

  const handleRemoveNewProductVariant = (variantId: string) => {
    setNewProduct((prev) => ({
      ...prev,
      variants: (prev.variants || []).filter((v) => v.id !== variantId),
    }));
  };

  // Orders local state & filter
  const [editableOrders, setEditableOrders] = useState<Order[]>(orders);
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [deleteConfirmationProduct, setDeleteConfirmationProduct] = useState<BedsheetProduct | null>(null);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);

  // Site Content local state
  const [editableContent, setEditableContent] = useState<SiteContent>(siteContent);

  // File input refs for changing product photos and variant photos
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variantFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Safely persist product changes with debouncing to avoid race conditions
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestProductsRef = useRef(editableProducts);
  latestProductsRef.current = editableProducts;
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const persistProducts = (updated: BedsheetProduct[], immediate = false) => {
    setEditableProducts(updated);
    latestProductsRef.current = updated;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (immediate) {
      onUpdateProducts(updated);
      setSaveStatus('saved');
    } else {
      saveTimeoutRef.current = setTimeout(() => {
        onUpdateProducts(latestProductsRef.current);
        saveTimeoutRef.current = null;
        setSaveStatus('saved');
      }, 300);
    }
  };

  const updateProductItem = (id: string, updater: (p: BedsheetProduct) => BedsheetProduct, immediate = false) => {
    setEditableProducts((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const mod = updater(p);
          const stamped = { ...mod, updatedAt: Date.now() };
          updateSingleProduct(id, stamped).catch((err) => {
            console.warn('Failed to update single product in Firestore:', err);
          });
          return stamped;
        }
        return p;
      });
      latestProductsRef.current = updated;
      setSaveStatus('saving');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (immediate) {
        onUpdateProducts(updated);
        setSaveStatus('saved');
      } else {
        saveTimeoutRef.current = setTimeout(() => {
          onUpdateProducts(latestProductsRef.current);
          saveTimeoutRef.current = null;
          setSaveStatus('saved');
        }, 300);
      }
      return updated;
    });
  };

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        onUpdateProducts(latestProductsRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    setEditableOrders(orders);
  }, [orders]);

  React.useEffect(() => {
    if (!saveTimeoutRef.current) {
      setEditableProducts(products);
      latestProductsRef.current = products;
    }
  }, [products]);

  React.useEffect(() => {
    if (siteContent && siteContent.company) {
      setEditableContent(siteContent);
    }
  }, [siteContent]);

  const handleExit = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      onUpdateProducts(latestProductsRef.current);
    }
    onExitAdmin();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ---------------- PRODUCT HANDLERS ---------------- */

  const handlePriceChange = (id: string, newPrice: number) => {
    updateProductItem(id, (p) => ({ ...p, price: Math.max(0, newPrice) }), false);
    showToast('Price updated!');
  };

  const handleOriginalPriceChange = (id: string, newOriginalPrice: number) => {
    updateProductItem(id, (p) => ({ ...p, originalPrice: Math.max(0, newOriginalPrice) }), false);
    showToast('MRP updated!');
  };

  const handleDiscountPercentChange = (id: string, discountPct: number) => {
    updateProductItem(id, (p) => {
      const pct = Math.min(90, Math.max(0, discountPct));
      const newPrice = Math.round(p.originalPrice * (1 - pct / 100));
      return { ...p, price: newPrice };
    }, true);
    showToast(discountPct === 0 ? '0% Discount applied (Selling at Full MRP)!' : `${discountPct}% Discount applied!`);
  };

  const handleStockToggle = (id: string) => {
    updateProductItem(id, (p) => {
      const nextInStock = !p.inStock;
      const currentQty = p.stockQuantity ?? 10;
      const nextQty = nextInStock ? (currentQty > 0 ? currentQty : 10) : 0;
      return { ...p, inStock: nextInStock, stockQuantity: nextQty };
    }, true);
    showToast('Stock status toggled!');
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    const qty = Math.max(0, newQty);
    updateProductItem(id, (p) => ({
      ...p,
      stockQuantity: qty,
      inStock: qty > 0,
    }), false);
    showToast('Quantity updated!');
  };

  const handleBadgeChange = (id: string, badge: string) => {
    updateProductItem(id, (p) => ({ ...p, badge: badge.trim() ? badge.trim() : '' }), false);
  };

  const handleNameChange = (id: string, name: string) => {
    updateProductItem(id, (p) => ({ ...p, name }), false);
  };

  const handleProductFieldChange = (id: string, field: keyof BedsheetProduct, value: any) => {
    updateProductItem(id, (p) => ({ ...p, [field]: value }), false);
  };

  const toggleSpecsPanel = (productId: string) => {
    setExpandedSpecs((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleDeleteProduct = (productId: string) => {
    if (editableProducts.length <= 1) {
      showToast('Catalogue must have at least one bedsheet.');
      return;
    }
    const target = editableProducts.find((p) => p.id === productId);
    if (target) {
      setDeleteConfirmationProduct(target);
    }
  };

  const handleConfirmDeleteProduct = async (productId: string) => {
    const target = editableProducts.find((p) => p.id === productId);
    const updated = editableProducts.filter((p) => p.id !== productId);
    setEditableProducts(updated);
    onUpdateProducts(updated);
    try {
      await removeProduct(productId);
    } catch (err) {
      console.warn('Failed to remove product from server:', err);
    }
    setDeleteConfirmationProduct(null);
    showToast(`"${target?.name || 'Bedsheet'}" removed from store.`);
  };

  /* ---------------- DRAG & DROP CARD REORDERING ---------------- */
  const handleDragStart = (e: React.DragEvent, productId: string) => {
    setDraggedProductId(productId);
    e.dataTransfer.setData('text/plain', productId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, productId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverProductId !== productId) {
      setDragOverProductId(productId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetProductId: string) => {
    e.preventDefault();
    const sourceProductId = e.dataTransfer.getData('text/plain') || draggedProductId;
    setDraggedProductId(null);
    setDragOverProductId(null);

    if (!sourceProductId || sourceProductId === targetProductId) return;

    const fromIdx = editableProducts.findIndex((p) => p.id === sourceProductId);
    const toIdx = editableProducts.findIndex((p) => p.id === targetProductId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...editableProducts];
    const [movedProduct] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, movedProduct);

    // Re-index order property
    const updatedWithOrder = reordered.map((p, idx) => ({
      ...p,
      order: idx,
      updatedAt: Date.now(),
    }));

    setEditableProducts(updatedWithOrder);
    onUpdateProducts(updatedWithOrder);
    reorderProductsApi(updatedWithOrder.map((p) => p.id)).catch((err) => {
      console.warn('Firestore reorder error:', err);
    });
    showToast(`Moved "${movedProduct.name}" to position #${toIdx + 1}! Card order updated.`);
  };

  const handleDragEnd = () => {
    setDraggedProductId(null);
    setDragOverProductId(null);
  };

  // 1-Click Move Up / Move Down buttons for accessibility & mobile touch
  const handleMoveCard = (productId: string, direction: 'up' | 'down') => {
    const fromIdx = editableProducts.findIndex((p) => p.id === productId);
    if (fromIdx === -1) return;
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= editableProducts.length) return;

    const reordered = [...editableProducts];
    const [movedProduct] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, movedProduct);

    const updatedWithOrder = reordered.map((p, idx) => ({
      ...p,
      order: idx,
      updatedAt: Date.now(),
    }));

    setEditableProducts(updatedWithOrder);
    onUpdateProducts(updatedWithOrder);
    reorderProductsApi(updatedWithOrder.map((p) => p.id)).catch((err) => {
      console.warn('Firestore reorder error:', err);
    });
    showToast(`Moved "${movedProduct.name}" to position #${toIdx + 1}!`);
  };

  // Reset to default catalogue sequence
  const handleResetCardOrder = () => {
    const defaultIds = BEDSHEETS_CATALOG.map((p) => p.id);
    const sorted = [...editableProducts].sort((a, b) => {
      const idxA = defaultIds.indexOf(a.id);
      const idxB = defaultIds.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    }).map((p, idx) => ({
      ...p,
      order: idx,
      updatedAt: Date.now(),
    }));

    setEditableProducts(sorted);
    persistProducts(sorted, true);
    onUpdateProducts(sorted);
    showToast('Reset cards to default sequence!');
  };

  const handleReplaceImage = async (productId: string, file?: File) => {
    if (!file) return;
    const targetProduct = editableProducts.find((p) => p.id === productId);
    if (!targetProduct) return;

    const previousImage = targetProduct.image;
    const previousPublicId = targetProduct.cloudinaryPublicId;

    setReplacingProductId(productId);
    showToast(`Uploading replacement image to Cloudinary for "${targetProduct.name}"...`);

    try {
      // 1. Upload to Cloudinary via signed direct upload
      const uploadResult = await uploadToCloudinary(file, productId);
      const newUrl = uploadResult.url;
      const newPublicId = uploadResult.public_id;

      if (!newUrl) {
        throw new Error('Upload succeeded but no image URL was returned.');
      }

      // 2. Prepare updated fields for this product record (preserving all other fields)
      const updatedFields: Partial<BedsheetProduct> = {
        image: newUrl,
        cloudinaryPublicId: newPublicId,
        updatedAt: Date.now(),
      };

      // 3. Atomically update local editable state, Firestore, and parent state
      const updatedProduct: BedsheetProduct = {
        ...targetProduct,
        ...updatedFields,
      };

      await updateSingleProduct(productId, updatedFields);

      const updatedList = editableProducts.map((p) => (p.id === productId ? updatedProduct : p));
      setEditableProducts(updatedList);
      if (onUpdateSingleProduct) {
        onUpdateSingleProduct(updatedProduct);
      } else {
        onUpdateProducts(updatedList);
      }
      onUploadImage(productId, newUrl);

      showToast(`Image replaced & hosted on Cloudinary for "${targetProduct.name}"!`);

      // 4. Safely cleanup previous Cloudinary asset ONLY after successful save
      if (previousPublicId && previousPublicId !== newPublicId && isCloudinaryUrl(previousImage)) {
        deleteFromCloudinary(previousPublicId).catch((delErr) => {
          console.warn('Old image cleanup warning:', delErr);
        });
      }
    } catch (err: any) {
      console.error('Failed to replace image:', err);
      // Retain previous image and show clear error message
      showToast(`Image replacement failed: ${err.message || err}`);
    } finally {
      setReplacingProductId(null);
      if (fileInputRefs.current[productId]) {
        fileInputRefs.current[productId]!.value = '';
      }
    }
  };

  /* ---------------- COLOR VARIANT HANDLERS ---------------- */

  const toggleVariantsPanel = (productId: string) => {
    setExpandedVariants((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleAddVariantToProduct = (productId: string) => {
    const draft = variantDrafts[productId];
    if (!draft || !draft.name.trim() || !draft.image) {
      showToast('Please provide a Color Name and select an image/photo for this variant.');
      return;
    }

    const newVar: BedsheetVariant = {
      id: `var-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      name: draft.name.trim(),
      colorHex: draft.colorHex || '#C29E57',
      image: draft.image,
    };

    const updated = editableProducts.map((p) => {
      if (p.id === productId) {
        const currentVariants = p.variants ? [...p.variants] : [];
        return {
          ...p,
          variants: [...currentVariants, newVar],
        };
      }
      return p;
    });

    setEditableProducts(updated);
    onUpdateProducts(updated);

    // Reset draft
    setVariantDrafts((prev) => ({
      ...prev,
      [productId]: { name: '', colorHex: '#C29E57', image: '' },
    }));

    showToast(`Added color variant "${newVar.name}"!`);
  };

  const handleRemoveVariant = (productId: string, variantId: string) => {
    const updated = editableProducts.map((p) => {
      if (p.id === productId && p.variants) {
        return {
          ...p,
          variants: p.variants.filter((v) => v.id !== variantId),
        };
      }
      return p;
    });

    setEditableProducts(updated);
    onUpdateProducts(updated);
    showToast('Variant removed.');
  };

  const handleVariantPhotoUpload = async (productId: string, variantId: string, file?: File) => {
    if (!file) return;
    try {
      showToast('Uploading variant photo...');
      const serverUrl = await uploadImageApi(file);
      const updated = editableProducts.map((p) => {
        if (p.id === productId && p.variants) {
          return {
            ...p,
            updatedAt: Date.now(),
            variants: p.variants.map((v) => (v.id === variantId ? { ...v, image: serverUrl } : v)),
          };
        }
        return p;
      });
      setEditableProducts(updated);
      onUpdateProducts(updated);
      showToast('Variant photo synced across all devices!');
    } catch (err) {
      console.error('Failed to upload variant photo:', err);
    }
  };

  const handleDraftVariantPhotoUpload = async (productId: string, file?: File) => {
    if (!file) return;
    try {
      showToast('Uploading photo...');
      const serverUrl = await uploadImageApi(file);
      setVariantDrafts((prev) => ({
        ...prev,
        [productId]: {
          name: prev[productId]?.name || '',
          colorHex: prev[productId]?.colorHex || '#C29E57',
          image: serverUrl,
        },
      }));
      showToast('Photo ready for variant!');
    } catch (err) {
      console.error('Failed to process variant photo:', err);
    }
  };

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name?.trim()) {
      showToast('Please enter a name for the new bedsheet.');
      return;
    }

    const createdId = `bedsheet-${Date.now().toString(36)}`;
    let finalImageUrl = newProduct.image || '/images/exact_sheet1_pink_rose_1790997736396.jpg';
    let assignedPublicId: string | undefined;

    // If owner selected a new file from their device, upload directly to Cloudinary
    if (newProductFile) {
      showToast('Uploading bedsheet image to Cloudinary...');
      try {
        const uploadResult = await uploadToCloudinary(newProductFile, createdId);
        finalImageUrl = uploadResult.url;
        assignedPublicId = uploadResult.public_id;
      } catch (uploadErr: any) {
        console.error('Failed to upload image for new bedsheet:', uploadErr);
        showToast(`Cloudinary upload failed: ${uploadErr.message || uploadErr}`);
        return;
      }
    }

    const fullProduct: BedsheetProduct = {
      id: createdId,
      name: newProduct.name.trim(),
      collection: newProduct.collection || 'Signature Collection',
      price: Number(newProduct.price) || 1899,
      originalPrice: Number(newProduct.originalPrice) || 2499,
      dimensions: newProduct.dimensions || '108 x 108 inches (274 x 274 cm)',
      pillowCovers: newProduct.pillowCovers || '2 Pillow Covers (45 x 70 cm)',
      threadCount: newProduct.threadCount || '350 Thread Count',
      fabric: newProduct.fabric || '100% Pure Percale Cotton',
      pattern: newProduct.pattern || 'Botanical Jaal',
      colorTone: newProduct.colorTone || 'Ivory & Pastels',
      description: newProduct.description || 'Pristine 100% pure cotton bedsheet.',
      image: finalImageUrl,
      cloudinaryPublicId: assignedPublicId,
      variants: newProduct.variants || [],
      badge: newProduct.badge || 'New Arrival',
      inStock: newProduct.inStock ?? true,
      stockQuantity: Number(newProduct.stockQuantity) || 15,
      features: [
        'Expansive King size drop',
        'Includes 2 matching pillow shams',
        '100% pure breathable cotton',
        'Machine wash tested'
      ],
      updatedAt: Date.now(),
      order: 0,
    };

    const updated = [fullProduct, ...editableProducts].map((p, idx) => ({
      ...p,
      order: idx,
    }));
    setEditableProducts(updated);
    onUpdateProducts(updated);
    addProduct(fullProduct).catch((err) => {
      console.warn('Failed to add product to Firestore:', err);
    });
    reorderProductsApi(updated.map((p) => p.id)).catch(() => {});
    setIsAddProductModalOpen(false);
    setNewProductFile(null);
    showToast(`"${fullProduct.name}" created and saved to store!`);
  };

  const handleBulkDiscount = (discountPercent: number) => {
    const updated = editableProducts.map((p) => {
      const newPrice = Math.round(p.originalPrice * (1 - discountPercent / 100));
      return { ...p, price: newPrice };
    });
    setEditableProducts(updated);
    onUpdateProducts(updated);
    showToast(
      discountPercent === 0
        ? 'Applied 0% discount across all bedsheets (All selling at Full MRP)!'
        : `Applied ${discountPercent}% discount across all bedsheets!`
    );
  };

  const handleMarkAllInStock = () => {
    const updated = editableProducts.map((p) => ({
      ...p,
      inStock: true,
      stockQuantity: (p.stockQuantity && p.stockQuantity > 0) ? p.stockQuantity : 15,
    }));
    setEditableProducts(updated);
    onUpdateProducts(updated);
    showToast('All bedsheets marked as In Stock!');
  };

  const handleExportBackup = () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: editableProducts,
      customImages,
      orders: editableOrders,
      siteContent,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotton_nest_store_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Store & images backup downloaded successfully!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let productsToRestore: BedsheetProduct[] | null = null;
        let imagesToRestore: Record<string, string> = {};
        let ordersToRestore: Order[] | null = null;
        let contentToRestore: SiteContent | null = null;

        // Support array of products directly OR structured JSON object
        if (Array.isArray(parsed)) {
          productsToRestore = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.products)) {
            productsToRestore = parsed.products;
          } else if (Array.isArray(parsed.catalog)) {
            productsToRestore = parsed.catalog;
          } else if (Array.isArray(parsed.items)) {
            productsToRestore = parsed.items;
          }

          if (parsed.customImages && typeof parsed.customImages === 'object') {
            imagesToRestore = parsed.customImages;
          } else if (parsed.images && typeof parsed.images === 'object') {
            imagesToRestore = parsed.images;
          }

          if (Array.isArray(parsed.orders)) {
            ordersToRestore = parsed.orders;
          }
          if (parsed.siteContent) {
            contentToRestore = parsed.siteContent;
          }
        }

        if (productsToRestore && productsToRestore.length > 0) {
          const importTimestamp = Date.now();
          // Normalize image paths on each product so they render cleanly and give them fresh current timestamp
          const normalizedProducts = productsToRestore.map((p, idx) => ({
            ...p,
            order: typeof (p as any).order === 'number' ? (p as any).order : idx,
            image: resolveBedsheetImage(p.image, p.id),
            updatedAt: importTimestamp,
          }));

          // 1. Immediately update AdminPanel state
          setEditableProducts(normalizedProducts);
          latestProductsRef.current = normalizedProducts;
          setSaveStatus('saved');

          // 2. Persist custom images directly without firing concurrent background upload cascades
          if (imagesToRestore && Object.keys(imagesToRestore).length > 0) {
            try {
              localStorage.setItem('cotton_nest_custom_images', JSON.stringify(imagesToRestore));
            } catch {}
            for (const [k, v] of Object.entries(imagesToRestore)) {
              if (v && typeof v === 'string') {
                // Resolved custom image in Firestore
              }
            }
          }

          // 3. Atomically update parent state & sync to server and storage
          onUpdateProducts(normalizedProducts);

          if (ordersToRestore) {
            setEditableOrders(ordersToRestore);
            onUpdateOrders(ordersToRestore);
          }
          if (contentToRestore) {
            setEditableContent(contentToRestore);
            onUpdateSiteContent(contentToRestore);
          }

          showToast(`Successfully restored ${normalizedProducts.length} bedsheets from your backup file!`);
        } else {
          showToast('Invalid backup file. Could not find bedsheets in JSON.');
        }
      } catch (err) {
        console.error('Failed to parse backup:', err);
        showToast('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset file input value so user can re-upload if needed
    e.target.value = '';
  };

  /* ---------------- ORDER HANDLERS ---------------- */

  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    const updated = editableOrders.map((o) => {
      if (o.id === orderId) return { ...o, status: nextStatus };
      return o;
    });
    setEditableOrders(updated);
    onUpdateOrders(updated);
    showToast(`Order #${orderId} status set to ${nextStatus.toUpperCase()}`);
  };

  const handleDeleteOrder = (orderId: string) => {
    const updated = editableOrders.filter((o) => o.id !== orderId);
    setEditableOrders(updated);
    onUpdateOrders(updated);
    showToast(`Order #${orderId} deleted.`);
  };

  /* ---------------- SEASONAL PAGE & FESTIVE DEALS HANDLERS ---------------- */
  const handleSaveSeasonal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = editableSeasonal.name?.trim() || 'Festive Offers';
    const stamped: SeasonalConfig = {
      ...editableSeasonal,
      name: finalName,
      badge: editableSeasonal.badge?.trim() || 'Festive Special',
      tagline: editableSeasonal.tagline?.trim() || 'Exclusive Festive Savings on Combed Cotton Bedsheets',
      updatedAt: Date.now(),
    };
    setEditableSeasonal(stamped);
    if (onUpdateSeasonalConfig) {
      onUpdateSeasonalConfig(stamped);
    }
    try {
      await saveSeasonalConfigApi(stamped);
    } catch (err) {
      console.warn('Failed to save seasonal config to server:', err);
    }
    showToast(`Seasonal page "${finalName}" saved and published!`);
  };

  const handleToggleSeasonalActive = () => {
    setEditableSeasonal((prev) => {
      const nextEnabled = !prev.enabled;
      const updated: SeasonalConfig = {
        ...prev,
        enabled: nextEnabled,
        updatedAt: Date.now(),
      };
      onUpdateSeasonalConfig?.(updated);
      saveSeasonalConfigApi(updated).catch(() => {});
      showToast(nextEnabled ? `"${prev.name}" is now LIVE in the Navbar!` : `"${prev.name}" hidden from Navbar.`);
      return updated;
    });
  };

  const handleToggleSeasonalProduct = (productId: string) => {
    setEditableSeasonal((prev) => {
      const exists = (prev.items || []).some((item) => item.productId === productId);
      let nextItems: SeasonalItemDiscount[];
      const prod = editableProducts.find((p) => p.id === productId);

      if (exists) {
        nextItems = prev.items.filter((item) => item.productId !== productId);
        showToast(`Removed "${prod?.name || 'Bedsheet'}" from ${prev.name}`);
      } else {
        const regularPrice = prod?.price || 1200;
        const discountPrice = Math.round(regularPrice * 0.8); // 20% discount default
        nextItems = [
          ...prev.items,
          {
            productId,
            discountPrice,
            discountPercentage: 20,
            customBadge: 'Festive Deal',
          },
        ];
        showToast(`Added "${prod?.name || 'Bedsheet'}" to ${prev.name}!`);
      }
      const updated: SeasonalConfig = { ...prev, items: nextItems, updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      saveSeasonalConfigApi(updated).catch(() => {});
      return updated;
    });
  };

  const handleUpdateSeasonalItemPrice = (productId: string, newOfferPrice: number) => {
    setEditableSeasonal((prev) => {
      const prod = editableProducts.find((p) => p.id === productId);
      const originalPrice = prod?.originalPrice || (prod?.price ? Math.round(prod.price * 1.35) : 2000);
      const validPrice = Math.max(0, newOfferPrice);
      const computedPct = Math.max(0, Math.min(95, Math.round(((originalPrice - validPrice) / originalPrice) * 100)));

      const nextItems = prev.items.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            discountPrice: validPrice,
            discountPercentage: computedPct,
          };
        }
        return item;
      });

      const updated = { ...prev, items: nextItems, updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      return updated;
    });
  };

  const handleUpdateSeasonalItemPct = (productId: string, newPct: number) => {
    setEditableSeasonal((prev) => {
      const prod = editableProducts.find((p) => p.id === productId);
      const originalPrice = prod?.originalPrice || (prod?.price ? Math.round(prod.price * 1.35) : 2000);
      const validPct = Math.max(0, Math.min(95, newPct));
      const computedPrice = Math.round(originalPrice * (1 - validPct / 100));

      const nextItems = prev.items.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            discountPercentage: validPct,
            discountPrice: computedPrice,
          };
        }
        return item;
      });

      const updated = { ...prev, items: nextItems, updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      return updated;
    });
  };

  const handleUpdateSeasonalItemBadge = (productId: string, badge: string) => {
    setEditableSeasonal((prev) => {
      const nextItems = prev.items.map((item) => {
        if (item.productId === productId) {
          return { ...item, customBadge: badge };
        }
        return item;
      });
      const updated = { ...prev, items: nextItems, updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      return updated;
    });
  };

  const handleBulkSeasonalDiscount = (discountPercent: number) => {
    setEditableSeasonal((prev) => {
      const nextItems = editableProducts.map((p) => {
        const originalPrice = p.originalPrice || Math.round(p.price * 1.35);
        const offerPrice = Math.round(originalPrice * (1 - discountPercent / 100));
        return {
          productId: p.id,
          discountPercentage: discountPercent,
          discountPrice: offerPrice,
          customBadge: `${discountPercent}% Festive Deal`,
        };
      });
      const updated = { ...prev, items: nextItems, updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      saveSeasonalConfigApi(updated).catch(() => {});
      showToast(`Applied ${discountPercent}% discount to all ${nextItems.length} bedsheets on ${prev.name}!`);
      return updated;
    });
  };

  const handleClearSeasonalItems = () => {
    setEditableSeasonal((prev) => {
      const updated = { ...prev, items: [], updatedAt: Date.now() };
      onUpdateSeasonalConfig?.(updated);
      saveSeasonalConfigApi(updated).catch(() => {});
      showToast(`Cleared all bedsheets from ${prev.name}`);
      return updated;
    });
  };

  /* ---------------- SITE CONTENT HANDLERS ---------------- */

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSiteContent(editableContent);
    try {
      await saveSiteContentApi(editableContent);
      showToast('Store content, header & story saved to Firestore!');
    } catch (err: any) {
      showToast('Saved locally. Firestore sync notice: ' + (err.message || 'Updated'));
    }
  };

  // Metrics
  const totalProducts = editableProducts.length;
  const inStockCount = editableProducts.filter((p) => p.inStock).length;
  const outOfStockCount = totalProducts - inStockCount;
  const totalInventoryUnits = editableProducts.reduce(
    (acc, p) => acc + (p.inStock ? (p.stockQuantity ?? 10) : 0),
    0
  );
  const totalRevenue = editableOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0), 0);
  const pendingOrdersCount = editableOrders.filter((o) => o.status === 'pending').length;
  const lowStockCount = editableProducts.filter((p) => p.inStock && p.stockQuantity !== undefined && p.stockQuantity <= 3).length;
  const adminAlertsCount = outOfStockCount + lowStockCount + pendingOrdersCount;

  const handleUpdateStockDirect = (productId: string, inStock: boolean, quantity: number) => {
    updateProductItem(productId, (p) => ({
      ...p,
      inStock,
      stockQuantity: quantity,
      updatedAt: Date.now(),
    }), true);
  };

  // Filtered Products
  const filteredProducts = editableProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.collection.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'inStock') return p.inStock;
    if (filterStatus === 'outOfStock') return !p.inStock;
    return true;
  });

  // Filtered Orders
  const filteredOrders = editableOrders.filter((o) => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.customerAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Color Swatch Presets for Quick Selection
  const COLOR_PRESETS = [
    { name: 'Blush Pink', hex: '#E8A598' },
    { name: 'Sage Mint', hex: '#9BB29B' },
    { name: 'Sapphire Blue', hex: '#4E6B8A' },
    { name: 'Warm Cream', hex: '#DFD3C3' },
    { name: 'Marigold Ochre', hex: '#E0B567' },
    { name: 'Teal Peacock', hex: '#4A8B88' },
    { name: 'Slate Trellis', hex: '#7D8C96' },
    { name: 'Rose Red', hex: '#C25968' },
  ];

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden transition-colors duration-200"
      style={{
        backgroundColor: 'var(--color-background, #F4EFE6)',
        color: 'var(--color-text, #2C2420)',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#2C2420] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-[#C29E57]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Fully responsive on mobile with zero horizontal scroll */}
      <header
        className="sticky top-0 z-40 border-b shadow-xs transition-colors"
        style={{
          backgroundColor: 'var(--color-header, #FAF7F2)',
          borderColor: 'var(--color-border, #EAE2D5)',
        }}
      >
        {/* MOBILE VIEW (< 640px): 100% fits mobile screen, NO horizontal scroll */}
        <div className="block sm:hidden px-3 py-2.5 space-y-2 max-w-full overflow-hidden">
          {/* Row 1: Back, Title, Save */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border bg-white text-[#2C2420] border-[#EAE2D5] shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Store</span>
            </button>

            <div className="text-center min-w-0 flex-1 px-1">
              <span className="font-serif-luxury text-sm font-bold text-[#2C2420] block truncate">
                {editableContent.company.name} Admin
              </span>
              <span className="text-[10px] text-[#8C2E46] font-semibold tracking-wide uppercase">
                Owner Dashboard
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = null;
                }
                onUpdateProducts(latestProductsRef.current);
                setSaveStatus('saved');
                showToast('✅ All changes permanently saved to store database!');
              }}
              className="px-3 py-1.5 bg-[#8C2E46] active:bg-[#732438] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 active:scale-95 shrink-0 cursor-pointer"
              title="Force save all product details permanently"
            >
              <Save className="w-3.5 h-3.5 text-white" />
              <span>Save</span>
            </button>
          </div>

          {/* Row 2: Status Strip on Mobile */}
          <div className="flex items-center justify-between text-[11px] px-1 text-[#7A6458]">
            <span className="inline-flex items-center gap-1 font-medium truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              📸 {totalUpdatedImagesCount} Images Customized
            </span>

            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-amber-700 font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Saving...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 font-medium shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Synced</span>
              </span>
            )}
          </div>

          {/* Row 3: Swipeable Mobile Tab Navigation with smooth horizontal swipe and zero body overflow */}
          <div className="w-full overflow-x-auto scrollbar-none flex items-center gap-1 p-1 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] touch-pan-x whitespace-nowrap">
            <button
              type="button"
              onClick={() => setActiveAdminTab('products')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'products'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Bedsheets ({totalProducts})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('orders')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'orders'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders {pendingOrdersCount > 0 ? `(${pendingOrdersCount})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('notifications')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'notifications'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>Alerts {adminAlertsCount > 0 ? `(${adminAlertsCount})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('coupons')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'coupons'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Coupons</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('wishlists')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'wishlists'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Wishlists</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('seasonal')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'seasonal'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seasonal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('appearance')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'appearance'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Appearance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAdminTab('content')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                activeAdminTab === 'content'
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Story & Store</span>
            </button>
          </div>
        </div>

        {/* DESKTOP VIEW (>= 640px) */}
        <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                borderColor: 'var(--color-border, #EAE2D5)',
                color: 'var(--color-text, #2C2420)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif-luxury text-lg sm:text-xl font-bold" style={{ color: 'var(--color-text, #2C2420)' }}>
                  {editableContent.company.name}
                </span>
                <span
                  className="px-2 py-0.5 text-white text-[10px] font-bold tracking-wider uppercase rounded-md shadow-2xs"
                  style={{
                    backgroundColor: 'var(--color-primary, #8C2E46)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }}
                >
                  Owner Dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold tracking-wide rounded-md bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  📸 {totalUpdatedImagesCount} Images Updated
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>
                {editableContent.company.address} · Synced across Phone &amp; Web
              </p>
            </div>
          </div>

          {/* Tab Switcher Buttons */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-xl border transition-colors overflow-x-auto max-w-full"
            style={{
              backgroundColor: 'var(--color-background, #F4EFE6)',
              borderColor: 'var(--color-border, #EAE2D5)',
            }}
          >
            <button
              onClick={() => setActiveAdminTab('products')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              style={
                activeAdminTab === 'products'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Package className="w-3.5 h-3.5" />
              <span>Bedsheets ({totalProducts})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('orders')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0"
              style={
                activeAdminTab === 'orders'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Incoming Orders</span>
              {pendingOrdersCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-secondary, #B83F60)',
                    color: 'var(--color-secondary-contrast, #FFFFFF)',
                  }}
                >
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab('seasonal')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0"
              style={
                activeAdminTab === 'seasonal'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: activeAdminTab === 'seasonal' ? undefined : '#C29E57' }} />
              <span>Seasonal Page ({editableSeasonal.name || 'Offers'})</span>
              {editableSeasonal.enabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live in Navbar" />
              ) : (
                <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200 text-stone-600 font-bold">OFF</span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab('content')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              style={
                activeAdminTab === 'content'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Store &amp; Story</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('appearance')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              style={
                activeAdminTab === 'appearance'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Palette className="w-3.5 h-3.5" style={{ color: activeAdminTab === 'appearance' ? undefined : 'var(--color-accent, #C29E57)' }} />
              <span>Website Appearance</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('coupons')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              style={
                activeAdminTab === 'coupons'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Ticket className="w-3.5 h-3.5" style={{ color: activeAdminTab === 'coupons' ? undefined : 'var(--color-accent, #C29E57)' }} />
              <span>Coupons &amp; Offers</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('notifications')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0"
              style={
                activeAdminTab === 'notifications'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>Atelier Alerts</span>
              {adminAlertsCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white animate-pulse">
                  {adminAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab('wishlists')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              style={
                activeAdminTab === 'wishlists'
                  ? {
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      color: 'var(--color-text-secondary, #6B5D55)',
                    }
              }
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Customer Wishlists</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Cloudinary Status Indicator */}
            {cloudinaryStatus?.configured ? (
              <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloudinary Connected</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCloudinaryHelpModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-300 text-xs font-semibold text-amber-900 cursor-pointer transition-colors shadow-2xs"
                title="Click to view Cloudinary environment setup guide"
              >
                <Cloud className="w-3.5 h-3.5 text-amber-600" />
                <span>Cloudinary Setup</span>
                <HelpCircle className="w-3 h-3 text-amber-700" />
              </button>
            )}

            {/* Auto-Save Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-xl border border-[#EAE2D5] text-xs font-medium">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Saving...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All Changes Saved</span>
                </span>
              )}
            </div>

            {/* Manual Save Button */}
            <button
              type="button"
              onClick={() => {
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = null;
                }
                onUpdateProducts(latestProductsRef.current);
                setSaveStatus('saved');
                showToast('✅ All changes permanently saved to store database!');
              }}
              className="px-3.5 py-1.5 bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Force save all product details permanently"
            >
              <Save className="w-3.5 h-3.5 text-white" />
              <span>Save Changes</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container: Zero horizontal scrolling on mobile */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
        
        {/* ======================================================== */}
        {/* TAB 1: BEDSHEET INVENTORY, VARIANTS & PHOTOS             */}
        {/* ======================================================== */}
        {activeAdminTab === 'products' && (
          <div className="space-y-6">
            
            {/* Top KPI Metrics Row */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                className="p-4 rounded-2xl border shadow-xs"
                style={{
                  backgroundColor: 'var(--color-surface, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Bedsheet Models</span>
                  <Package className="w-4 h-4" style={{ color: 'var(--color-accent, #C29E57)' }} />
                </div>
                <div className="text-2xl font-bold font-serif-luxury" style={{ color: 'var(--color-text, #2C2420)' }}>
                  {totalProducts}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Active catalogue</p>
              </div>

              <div
                className="p-4 rounded-2xl border shadow-xs"
                style={{
                  backgroundColor: 'var(--color-surface, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">In Stock</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-emerald-700">
                  {inStockCount}
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Available for buyers</p>
              </div>

              <div
                className="p-4 rounded-2xl border shadow-xs"
                style={{
                  backgroundColor: 'var(--color-surface, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Out of Stock</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-amber-700">
                  {outOfStockCount}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Needs stock replenishment</p>
              </div>

              <div
                className="p-4 rounded-2xl border shadow-xs"
                style={{
                  backgroundColor: 'var(--color-surface, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Total Units</span>
                  <Boxes className="w-4 h-4" style={{ color: 'var(--color-secondary, #B83F60)' }} />
                </div>
                <div className="text-2xl font-bold font-serif-luxury" style={{ color: 'var(--color-text, #2C2420)' }}>
                  {totalInventoryUnits} pcs
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Ready in warehouse/studio</p>
              </div>

              <div
                className="col-span-2 lg:col-span-1 p-4 rounded-2xl border shadow-xs flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--color-surface, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Quick Action</span>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent, #C29E57)' }} />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="w-full py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Bedsheet</span>
                </button>
              </div>
            </section>

            {/* Quick Bulk Tools */}
            <section
              className="p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4"
              style={{
                backgroundColor: 'var(--color-surface, #FAF7F2)',
                borderColor: 'var(--color-border, #EAE2D5)',
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  style={{
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Bedsheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateProducts(editableProducts);
                    showToast('All bedsheet details & prices saved successfully!');
                  }}
                  className="px-3.5 py-1.5 bg-[#2E7D46] hover:bg-[#256639] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Force immediate save of all prices and bedsheet details to Google Cloud"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Products</span>
                </button>

                <button
                  onClick={handleMarkAllInStock}
                  className="px-3 py-1.5 bg-white hover:bg-[#F4EFE6] text-[#2C2420] text-xs font-medium border border-[#EAE2D5] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mark All In Stock</span>
                </button>

                {/* Permanent Backup & Restore */}
                <button
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] text-[#2C2420] text-xs font-medium border border-[#DEC89B] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Download complete store and photos backup as JSON file"
                >
                  <Download className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Export Backup</span>
                </button>

                <input
                  type="file"
                  ref={backupFileInputRef}
                  onChange={handleImportBackup}
                  accept=".json,application/json"
                  className="hidden"
                />
                <button
                  onClick={() => backupFileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-[#2C2420] hover:bg-[#433731] text-[#FAF7F2] text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Restore store data and uploaded images from JSON backup file"
                >
                  <Upload className="w-3.5 h-3.5 text-[#DEC89B]" />
                  <span>Restore from JSON</span>
                </button>

                {onResetAllImages && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllImages();
                      showToast('Photo cache cleared! Showing clean catalog photos.');
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 text-xs font-medium border border-amber-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Clear stuck custom photos and restore original distinct catalog photos"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Clear Photo Cache</span>
                  </button>
                )}

                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Cloudinary & Server Store Connected</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFactoryResetModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-[#FDEAF0] text-[#8C2E46] text-xs font-medium border border-[#FAD1DC] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Factory Reset</span>
                </button>
              </div>

              {/* Bulk Discounts */}
              <div className="flex items-center gap-1.5 text-xs text-[#7A6458] flex-wrap">
                <span className="font-medium">Set All Discounts:</span>
                {[0, 10, 15, 20, 25, 30].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleBulkDiscount(pct)}
                    className="px-2 py-0.5 bg-white hover:bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC] rounded text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {pct === 0 ? '0% (Full MRP)' : `${pct}%`}
                  </button>
                ))}
              </div>
            </section>

            {/* Search & Filter */}
            <section className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search bedsheet name or collection..."
                  className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#C29E57]"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-[#2C2420] text-white'
                      : 'bg-[#FAF7F2] text-[#6B5D55] border border-[#EAE2D5]'
                  }`}
                >
                  All ({totalProducts})
                </button>
                <button
                  onClick={() => setFilterStatus('inStock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === 'inStock'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#FAF7F2] text-[#6B5D55] border border-[#EAE2D5]'
                  }`}
                >
                  In Stock ({inStockCount})
                </button>
                <button
                  onClick={() => setFilterStatus('outOfStock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === 'outOfStock'
                      ? 'bg-amber-700 text-white'
                      : 'bg-[#FAF7F2] text-[#6B5D55] border border-[#EAE2D5]'
                  }`}
                >
                  Out of Stock ({outOfStockCount})
                </button>
              </div>
            </section>

            {/* Card Order & Sequence Management Banner */}
            <section className="bg-[#FAF7EE] border border-[#DEC89B] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl border border-[#DEC89B] text-[#8C2E46] shrink-0 shadow-2xs">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#2C2420] flex items-center gap-1.5">
                      <span>Card Ordering &amp; Display Sequence</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#C29E57]" />
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Drag cards to reorder
                    </span>
                  </div>
                  <p className="text-xs text-[#7A6458] mt-1">
                    Click &amp; drag any card using its <span className="font-semibold text-[#8C2E46] bg-white px-1 py-0.5 rounded border border-[#DEC89B]">⋮⋮ Drag</span> handle to change its position.
                    Cards <strong className="text-[#8C2E46]">#1, #2, and #3</strong> automatically appear as the featured spotlight bedsheets on your live homepage!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={handleResetCardOrder}
                  className="px-3 py-1.5 bg-white hover:bg-[#F4EFE6] border border-[#DEC89B] rounded-xl text-xs font-semibold text-[#2C2420] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Reset card sequence back to default catalogue order"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#A8988D]" />
                  <span>Reset to Default Order</span>
                </button>
              </div>
            </section>

            {/* Product Cards List */}
            <section className="space-y-4">
              {filteredProducts.map((product, idx) => {
                const currentImg = product.image || customImages[product.id];
                const discountPct = Math.max(
                  0,
                  Math.round(
                    ((product.originalPrice - product.price) / (product.originalPrice || 1)) * 100
                  )
                );
                const isVariantsOpen = expandedVariants[product.id] || false;
                const isSpecsOpen = expandedSpecs[product.id] || false;
                const draft = variantDrafts[product.id] || { name: '', colorHex: '#C29E57', image: '' };

                const masterIdx = editableProducts.findIndex((p) => p.id === product.id);
                const currentPosition = (masterIdx !== -1 ? masterIdx : idx) + 1;
                const isFirst = masterIdx === 0;
                const isLast = masterIdx === editableProducts.length - 1;
                const isTopShowcase = masterIdx >= 0 && masterIdx < 3;
                const isBeingDragged = draggedProductId === product.id;
                const isDragOver = dragOverProductId === product.id && !isBeingDragged;

                return (
                  <div
                    key={product.id}
                    onDragOver={(e) => handleDragOver(e, product.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, product.id)}
                    className={`rounded-2xl border p-3.5 sm:p-5 transition-all shadow-xs space-y-4 relative w-full max-w-full overflow-hidden ${
                      isBeingDragged
                        ? 'opacity-40 border-dashed scale-[0.99]'
                        : isDragOver
                        ? 'shadow-md -translate-y-0.5'
                        : product.inStock
                        ? ''
                        : 'border-amber-300'
                    }`}
                    style={{
                      backgroundColor: 'var(--color-surface, #FAF7F2)',
                      borderColor: 'var(--color-border, #EAE2D5)',
                    }}
                  >
                    {/* Visual Drop Target Indicator */}
                    {isDragOver && (
                      <div className="absolute -top-3.5 left-4 right-4 sm:left-8 sm:right-8 bg-[#8C2E46] text-white text-[11px] font-bold py-1 px-3 rounded-full shadow-md flex items-center justify-center gap-1.5 z-20 animate-pulse pointer-events-none">
                        <MoveVertical className="w-3.5 h-3.5" />
                        <span>Drop here to place bedsheet at position #{currentPosition}</span>
                      </div>
                    )}

                    {/* Card Drag & Sequence Header Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#EAE2D5]/70 gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Draggable Grip Handle */}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, product.id)}
                          onDragEnd={handleDragEnd}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#FAF7F2] border border-[#DEC89B] hover:border-[#8C2E46] rounded-xl text-xs font-semibold text-[#2C2420] cursor-grab active:cursor-grabbing transition-all shadow-2xs select-none group"
                          title="Click and drag to rearrange this bedsheet card order"
                        >
                          <GripVertical className="w-4 h-4 text-[#A8988D] group-hover:text-[#8C2E46] transition-colors" />
                          <span className="font-bold text-[#8C2E46]">#{currentPosition}</span>
                          <span className="text-[10px] text-[#7A6458] hidden sm:inline">Drag to reorder</span>
                        </div>

                        {/* Top Spotlight badge */}
                        {isTopShowcase ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FAF7EE] text-[#A8823B] border border-[#DEC89B] shadow-2xs">
                            <Sparkles className="w-3 h-3 text-[#C29E57]" />
                            <span>⭐ Home Spotlight #{currentPosition}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#7A6458] hidden sm:inline font-medium">
                            Catalogue Position #{currentPosition}
                          </span>
                        )}
                      </div>

                      {/* 1-Click Move Up / Move Down buttons for mobile and touch accessibility */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveCard(product.id, 'up')}
                          className="p-1.5 bg-white hover:bg-[#FAF7F2] disabled:opacity-25 disabled:cursor-not-allowed border border-[#EAE2D5] rounded-lg text-[#2C2420] transition-colors cursor-pointer"
                          title={isFirst ? 'Already first in order' : `Move up to position #${currentPosition - 1}`}
                          aria-label="Move card up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveCard(product.id, 'down')}
                          className="p-1.5 bg-white hover:bg-[#FAF7F2] disabled:opacity-25 disabled:cursor-not-allowed border border-[#EAE2D5] rounded-lg text-[#2C2420] transition-colors cursor-pointer"
                          title={isLast ? 'Already last in order' : `Move down to position #${currentPosition + 1}`}
                          aria-label="Move card down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                      
                      {/* Photo Column */}
                      <div className="lg:col-span-3 flex items-center gap-3">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#F4EFE6] border border-[#EAE2D5] shrink-0">
                          <img
                            src={resolveBedsheetImage(currentImg, product.id)}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageFallback(e, product.id)}
                            className="w-full h-full object-cover object-center"
                          />
                          <span className="absolute top-1 left-1 bg-[#2C2420]/80 text-white text-[9px] px-1 rounded font-bold">
                            #{currentPosition}
                          </span>
                        </div>

                        <div className="flex-1 space-y-2">
                          <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[product.id] = el; }}
                            onChange={(e) => handleReplaceImage(product.id, e.target.files?.[0])}
                            accept="image/*"
                            className="hidden"
                          />

                          {/* Primary Replace Image Action */}
                          <button
                            type="button"
                            disabled={replacingProductId === product.id}
                            onClick={() => fileInputRefs.current[product.id]?.click()}
                            className="w-full px-3 py-1.5 bg-[#8C2E46] hover:bg-[#732438] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Upload and host replacement photo on Cloudinary, updating Firestore immediately"
                          >
                            {replacingProductId === product.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                <span>Replace Image</span>
                              </>
                            )}
                          </button>

                          {/* Image Hosting Badge */}
                          {isCloudinaryUrl(currentImg) ? (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md justify-center font-medium">
                              <Cloud className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">Cloudinary CDN</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-[#7A6458] bg-white border border-[#EAE2D5] px-2 py-0.5 rounded-md justify-center">
                              <ImageIcon className="w-3 h-3 text-[#C29E57] shrink-0" />
                              <span className="truncate">Catalog Photo</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="w-full px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] rounded transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Sheet</span>
                          </button>
                        </div>
                      </div>

                      {/* Title, Collection & Badge */}
                      <div className="lg:col-span-3 space-y-2">
                        <div>
                          <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                            Bedsheet Title
                          </label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => handleNameChange(product.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Collection
                            </label>
                            <input
                              type="text"
                              value={product.collection}
                              onChange={(e) => handleProductFieldChange(product.id, 'collection', e.target.value)}
                              placeholder="Collection"
                              className="w-full px-2 py-1 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Badge
                            </label>
                            <input
                              type="text"
                              value={product.badge || ''}
                              onChange={(e) => handleBadgeChange(product.id, e.target.value)}
                              placeholder="No Badge"
                              className="w-full px-2 py-1 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#7A6458] pt-0.5">
                          <span className="truncate">{product.dimensions}</span>
                          <button
                            type="button"
                            onClick={() => toggleSpecsPanel(product.id)}
                            className="text-[#8C2E46] hover:underline font-semibold text-[10px] shrink-0 ml-1 cursor-pointer"
                          >
                            {isSpecsOpen ? 'Hide Specs' : 'Edit Specs ⚙️'}
                          </button>
                        </div>
                      </div>

                      {/* Pricing Row */}
                      <div className="lg:col-span-3 space-y-2 bg-[#F4EFE6]/60 p-3 rounded-xl border border-[#EAE2D5]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-0.5">
                              Selling Price (₹)
                            </label>
                            <input
                              type="number"
                              value={product.price}
                              onChange={(e) => handlePriceChange(product.id, Number(e.target.value))}
                              step={50}
                              min={0}
                              className="w-full px-2 py-1 bg-white border border-[#DEC89B] rounded-lg text-sm font-bold text-[#8C2E46] focus:outline-hidden focus:border-[#B83F60]"
                            />
                          </div>

                          <div className="flex-1">
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-0.5">
                              MRP (₹)
                            </label>
                            <input
                              type="number"
                              value={product.originalPrice}
                              onChange={(e) => handleOriginalPriceChange(product.id, Number(e.target.value))}
                              step={50}
                              min={0}
                              className="w-full px-2 py-1 bg-white border border-[#EAE2D5] rounded-lg text-sm text-[#7A6458] focus:outline-hidden focus:border-[#C29E57]"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-[#7A6458]">Calculated Discount:</span>
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                discountPct === 0
                                  ? 'text-[#7A6458] bg-[#F4EFE6] border border-[#EAE2D5]'
                                  : 'text-[#8C2E46] bg-[#FDEAF0] border border-[#FAD1DC]'
                              }`}
                            >
                              {discountPct === 0 ? '0% (Full MRP)' : `${discountPct}% OFF`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[0, 10, 15, 20, 25, 30].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => handleDiscountPercentChange(product.id, d)}
                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors ${
                                  discountPct === d
                                    ? 'bg-[#8C2E46] text-white border-[#8C2E46] font-bold shadow-2xs'
                                    : 'bg-white text-[#7A6458] border-[#EAE2D5] hover:border-[#C29E57] hover:bg-[#FAF7F2]'
                                }`}
                              >
                                {d === 0 ? '0%' : `${d}%`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Shipping Extra Notice in Price Tab */}
                        <div className="pt-2 border-t border-[#EAE2D5] flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 font-semibold text-[#2C2420]">
                            <Truck className="w-3 h-3 text-[#B83F60]" />
                            <span>+ Shipping Extra:</span>
                          </span>
                          <span className="text-[10px] text-[#7A6458]">₹100 India · Free in Sec 46 Gurgaon</span>
                        </div>
                      </div>

                      {/* Stock & Quantity */}
                      <div className="lg:col-span-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                            Availability Status
                          </label>
                          <button
                            type="button"
                            onClick={() => handleStockToggle(product.id)}
                            className={`w-full py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-between transition-colors cursor-pointer border ${
                              product.inStock
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100/70 text-amber-900 border-amber-300'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {product.inStock ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                              )}
                              <span>{product.inStock ? 'In Stock (Live)' : 'Out of Stock (Disabled)'}</span>
                            </span>
                            <span className="text-[10px] underline">Toggle</span>
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                            Quantity Units
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, (product.stockQuantity ?? 10) - 1)}
                              className="w-8 h-8 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420] font-bold flex items-center justify-center hover:bg-[#F4EFE6] cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={product.stockQuantity ?? 10}
                              onChange={(e) => handleQuantityChange(product.id, Number(e.target.value))}
                              min={0}
                              className="flex-1 text-center py-1 bg-white border border-[#EAE2D5] rounded-lg text-sm font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, (product.stockQuantity ?? 10) + 1)}
                              className="w-8 h-8 rounded-lg bg-white border border-[#EAE2D5] text-[#2C2420] font-bold flex items-center justify-center hover:bg-[#F4EFE6] cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* SPECIFICATIONS & EDITORIAL STORY EDITOR FOR THIS SHEET */}
                    {isSpecsOpen && (
                      <div className="p-4 bg-white rounded-2xl border border-[#DEC89B] space-y-3.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C2420]">
                            <Layers className="w-4 h-4 text-[#8C2E46]" />
                            <span>Edit Dimensions, Fabric, Pillow Covers &amp; Story for "{product.name}"</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleSpecsPanel(product.id)}
                            className="text-xs text-[#7A6458] hover:text-[#2C2420] font-medium cursor-pointer"
                          >
                            Close ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Dimensions */}
                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Dimensions / Size Tag *
                            </label>
                            <input
                              type="text"
                              value={product.dimensions}
                              onChange={(e) => handleProductFieldChange(product.id, 'dimensions', e.target.value)}
                              placeholder="e.g. 108 x 108 inches (274 x 274 cm)"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                            <div className="flex items-center gap-1 mt-1 text-[10px]">
                              <span className="text-[#8C7A70]">Presets:</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'dimensions', '108 x 108 inches (274 x 274 cm)')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                108×108
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'dimensions', '100 x 108 inches (254 x 274 cm)')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                100×108
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'dimensions', '90 x 108 inches (228 x 274 cm)')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                90×108
                              </button>
                            </div>
                          </div>

                          {/* Pillow Covers */}
                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Pillow Covers Spec
                            </label>
                            <input
                              type="text"
                              value={product.pillowCovers}
                              onChange={(e) => handleProductFieldChange(product.id, 'pillowCovers', e.target.value)}
                              placeholder="e.g. 2 Pillow Covers (45 x 70 cm)"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                            <div className="flex items-center gap-1 mt-1 text-[10px]">
                              <span className="text-[#8C7A70]">Presets:</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'pillowCovers', '2 Pillow Covers (45 x 70 cm)')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                2 Covers (45×70)
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'pillowCovers', '2 Pillow Covers (50 x 75 cm)')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                2 Covers (50×75)
                              </button>
                            </div>
                          </div>

                          {/* Thread Count */}
                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Thread Count
                            </label>
                            <input
                              type="text"
                              value={product.threadCount}
                              onChange={(e) => handleProductFieldChange(product.id, 'threadCount', e.target.value)}
                              placeholder="e.g. 350 Thread Count"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                            <div className="flex items-center gap-1 mt-1 text-[10px]">
                              <span className="text-[#8C7A70]">Presets:</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'threadCount', '350 Thread Count')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                350 TC
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'threadCount', '400 Thread Count')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                400 TC
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'threadCount', '300 Thread Count')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                300 TC
                              </button>
                            </div>
                          </div>

                          {/* Fabric Weave */}
                          <div>
                            <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                              Fabric Weave
                            </label>
                            <input
                              type="text"
                              value={product.fabric}
                              onChange={(e) => handleProductFieldChange(product.id, 'fabric', e.target.value)}
                              placeholder="e.g. 100% Pure Percale Cotton"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                            />
                            <div className="flex items-center gap-1 mt-1 text-[10px]">
                              <span className="text-[#8C7A70]">Presets:</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'fabric', '100% Pure Percale Cotton')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                Percale
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'fabric', '100% Combed Cotton')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                Combed
                              </button>
                              <span className="text-[#DCD0C0]">·</span>
                              <button
                                type="button"
                                onClick={() => handleProductFieldChange(product.id, 'fabric', '100% Sateen Cotton')}
                                className="text-[#8C2E46] hover:underline cursor-pointer"
                              >
                                Sateen
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Product Description / Story */}
                        <div>
                          <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                            Bedsheet Editorial Description &amp; Details
                          </label>
                          <textarea
                            rows={2}
                            value={product.description}
                            onChange={(e) => handleProductFieldChange(product.id, 'description', e.target.value)}
                            placeholder="Describe the print, feel, weave, color palette, and styling notes..."
                            className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                          />
                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* COLOR VARIANTS & MULTI-PHOTO UPLOAD SECTION FOR THIS SHEET */}
                    {/* ======================================================== */}
                    <div className="pt-3 border-t border-[#EAE2D5] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSpecsPanel(product.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                            isSpecsOpen
                              ? 'bg-[#2C2420] text-white border-[#2C2420]'
                              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-[#DEC89B]'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-[#C29E57]" />
                          <span>Specs, Size &amp; Story</span>
                          {isSpecsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleVariantsPanel(product.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                            isVariantsOpen
                              ? 'bg-[#8C2E46] text-white border-[#8C2E46]'
                              : 'bg-white text-[#8C2E46] border-[#FAD1DC] hover:bg-[#FDEAF0]'
                          }`}
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>
                            Color Variants ({product.variants?.length || 0})
                          </span>
                          {isVariantsOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Mini preview dots */}
                      {product.variants && product.variants.length > 0 && !isVariantsOpen && (
                        <div className="flex items-center gap-1 text-[11px] text-[#7A6458]">
                          <span>Variants:</span>
                          {product.variants.map((v) => (
                            <span
                              key={v.id}
                              className="w-3 h-3 rounded-full border border-black/10 inline-block"
                              style={{ backgroundColor: v.colorHex || '#C29E57' }}
                              title={v.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                      {/* Expanded Variant Manager */}
                      {isVariantsOpen && (
                        <div className="mt-3 p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-4 animate-in fade-in duration-150">
                          
                          {/* List of existing variants */}
                          <div>
                            <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                              Active Color Variants
                            </p>

                            {product.variants && product.variants.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {product.variants.map((variant) => (
                                  <div
                                    key={variant.id}
                                    className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] flex items-center justify-between gap-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white border border-[#EAE2D5] shrink-0">
                                        <img
                                          src={resolveBedsheetImage(variant.image)}
                                          alt={variant.name}
                                          onError={handleImageFallback}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-3 h-3 rounded-full border border-black/10 shrink-0 inline-block"
                                            style={{ backgroundColor: variant.colorHex || '#C29E57' }}
                                          />
                                          <p className="text-xs font-semibold text-[#2C2420] truncate">
                                            {variant.name}
                                          </p>
                                        </div>

                                        <input
                                          type="file"
                                          ref={(el) => { variantFileInputRefs.current[`${product.id}-${variant.id}`] = el; }}
                                          onChange={(e) => handleVariantPhotoUpload(product.id, variant.id, e.target.files?.[0])}
                                          accept="image/*"
                                          className="hidden"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => variantFileInputRefs.current[`${product.id}-${variant.id}`]?.click()}
                                          className="text-[10px] text-[#8C2E46] hover:underline font-medium mt-1 cursor-pointer block"
                                        >
                                          Replace Photo
                                        </button>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariant(product.id, variant.id)}
                                      className="p-1 text-[#8C7A70] hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                      title="Delete variant"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[#8C7A70] italic">
                                No additional color variants added yet. Add variants below.
                              </p>
                            )}
                          </div>

                          {/* Form to Add New Color Variant */}
                          <div className="p-3.5 bg-[#F4EFE6]/60 rounded-xl border border-[#EAE2D5] space-y-3">
                            <p className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-[#8C2E46]" />
                              <span>Upload New Color / Style for "{product.name}"</span>
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                              {/* Color Name */}
                              <div className="sm:col-span-4">
                                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                                  Color / Variant Name *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Royal Indigo / Sage Mint"
                                  value={draft.name}
                                  onChange={(e) =>
                                    setVariantDrafts((prev) => ({
                                      ...prev,
                                      [product.id]: {
                                        name: e.target.value,
                                        colorHex: draft.colorHex,
                                        image: draft.image,
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                                />
                              </div>

                              {/* Color Swatch Picker */}
                              <div className="sm:col-span-3">
                                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                                  Swatch Color
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={draft.colorHex || '#C29E57'}
                                    onChange={(e) =>
                                      setVariantDrafts((prev) => ({
                                        ...prev,
                                        [product.id]: {
                                          name: draft.name,
                                          colorHex: e.target.value,
                                          image: draft.image,
                                        },
                                      }))
                                    }
                                    className="w-8 h-8 rounded-lg border border-[#EAE2D5] p-0.5 cursor-pointer bg-white"
                                  />
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {COLOR_PRESETS.slice(0, 5).map((cp) => (
                                      <button
                                        key={cp.name}
                                        type="button"
                                        title={cp.name}
                                        onClick={() =>
                                          setVariantDrafts((prev) => ({
                                            ...prev,
                                            [product.id]: {
                                              name: draft.name || cp.name,
                                              colorHex: cp.hex,
                                              image: draft.image,
                                            },
                                          }))
                                        }
                                        className="w-4 h-4 rounded-full border border-black/10 inline-block hover:scale-110"
                                        style={{ backgroundColor: cp.hex }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Photo Upload */}
                              <div className="sm:col-span-3">
                                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                                  Variant Photo *
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    ref={(el) => { fileInputRefs.current[`draft-${product.id}`] = el; }}
                                    onChange={(e) => handleDraftVariantPhotoUpload(product.id, e.target.files?.[0])}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => fileInputRefs.current[`draft-${product.id}`]?.click()}
                                    className="px-2.5 py-1.5 bg-white border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-lg hover:bg-[#FAF7F2] flex items-center gap-1 cursor-pointer w-full justify-center"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-[#C29E57]" />
                                    <span>{draft.image ? 'Photo Ready ✓' : 'Pick Photo'}</span>
                                  </button>
                                  {draft.image && (
                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#EAE2D5] shrink-0">
                                      <img src={draft.image} alt="Draft" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Add Button */}
                              <div className="sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddVariantToProduct(product.id)}
                                  className="w-full py-1.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                  Add Color
                                </button>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                  </div>
                );
              })}
            </section>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: INCOMING ORDERS MANAGEMENT                        */}
        {/* ======================================================== */}
        {activeAdminTab === 'orders' && (
          <div className="space-y-6">
            
            {/* Orders Metric Row */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Total Orders</span>
                  <ShoppingBag className="w-4 h-4 text-[#C29E57]" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-[#2C2420]">
                  {editableOrders.length}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Recorded customer orders</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Pending Action</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-amber-700">
                  {pendingOrdersCount}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Needs confirmation</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Dispatched</span>
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-blue-700">
                  {editableOrders.filter((o) => o.status === 'dispatched').length}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Out for courier/delivery</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Order Value</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-emerald-700">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Active gross revenue</p>
              </div>
            </section>

            {/* Search and Status Filters */}
            <section className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by order ID, customer, phone..."
                  className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#C29E57]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {(['all', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      orderFilter === st
                        ? 'bg-[#2C2420] text-white shadow-xs'
                        : 'bg-[#FAF7F2] text-[#6B5D55] border border-[#EAE2D5]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </section>

            {/* Orders Feed */}
            <section className="space-y-4">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
                    pending: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
                    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
                    dispatched: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
                    delivered: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
                    cancelled: { bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-300' },
                  };

                  const cleanPhone = order.customerPhone.replace(/\D/g, '');
                  const whatsappMsg = encodeURIComponent(
                    `Hello ${order.customerName}! Cotton Nest here regarding your order #${order.id}. Current status is: ${order.status.toUpperCase()}.`
                  );

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 w-full max-w-full overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-surface, #FAF7F2)',
                        borderColor: 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      {/* Order Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EAE2D5]">
                        <div className="flex items-center gap-2.5">
                          <span className="font-serif-luxury font-bold text-base text-[#2C2420]">
                            Order #{order.id}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border uppercase tracking-wider ${
                              statusColors[order.status].bg
                            } ${statusColors[order.status].text} ${statusColors[order.status].border}`}
                          >
                            {order.status}
                          </span>
                          <span className="text-xs text-[#8C7A70]">
                            {new Date(order.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        {/* Status Change Selector & Delete */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#7A6458] font-medium">Status:</label>
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                            className="bg-white border border-[#EAE2D5] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="dispatched">Dispatched</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>

                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 text-[#8C7A70] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Customer Info & Items Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        
                        {/* Customer Information (Cols 1-5) */}
                        <div className="lg:col-span-5 space-y-2 bg-[#F4EFE6]/60 p-4 rounded-xl border border-[#EAE2D5] text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Customer Details</span>
                            <span className="font-semibold text-emerald-800 uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <MessageCircle className="w-3 h-3 text-emerald-700" />
                              WhatsApp Order
                            </span>
                          </div>

                          <div className="font-semibold text-sm text-[#2C2420]">
                            {order.customerName}
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <a
                              href={`https://wa.me/91${cleanPhone}?text=${whatsappMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-[11px] rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>

                            <a
                              href={`tel:${cleanPhone}`}
                              className="px-2.5 py-1 bg-white hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#2C2420] font-medium text-[11px] rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
                              <span>{order.customerPhone}</span>
                            </a>
                          </div>

                          <div className="pt-2 text-[#6B5D55] leading-relaxed flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#C29E57] shrink-0 mt-0.5" />
                            <span>{order.customerAddress}</span>
                          </div>

                          {order.notes && (
                            <div className="pt-2 border-t border-[#EAE2D5] text-[11px] text-[#7A6458] italic">
                              <strong>Note:</strong> {order.notes}
                            </div>
                          )}
                        </div>

                        {/* Itemized Order Products (Cols 6-12) */}
                        <div className="lg:col-span-7 space-y-3">
                          <div className="text-[10px] uppercase font-semibold text-[#8C7A70]">
                            Items in Order ({order.items.length})
                          </div>

                          <div className="space-y-2">
                            {order.items.map((item, iIdx) => (
                              <div
                                key={iIdx}
                                className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#EAE2D5] gap-3"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F4EFE6] border border-[#EAE2D5] shrink-0">
                                    <img
                                      src={resolveBedsheetImage(item.productImage)}
                                      alt={item.productName}
                                      onError={handleImageFallback}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-[#2C2420]">
                                      {item.productName}
                                    </div>
                                    <div className="text-[10px] text-[#8C7A70]">
                                      {item.dimensions} · Qty: {item.quantity}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs font-bold text-[#2C2420] tabular-nums">
                                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Order Total Footer */}
                          <div className="pt-2 border-t border-[#EAE2D5] flex items-center justify-between text-xs">
                            <span className="text-[#7A6458]">Total Order Amount:</span>
                            <span className="text-base font-bold text-[#8C2E46] tabular-nums">
                              ₹{order.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] p-6">
                  <ShoppingBag className="w-8 h-8 text-[#C29E57] mx-auto mb-2" />
                  <p className="font-semibold text-sm text-[#2C2420]">No orders found</p>
                  <p className="text-xs text-[#7A6458] mt-1">Orders placed via the cart checkout will display here in real time.</p>
                </div>
              )}
            </section>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: SEASONAL PAGE & FESTIVE DEALS MANAGER               */}
        {/* ======================================================== */}
        {activeAdminTab === 'seasonal' && (
          <div className="space-y-8">
            
            {/* Header & Master Toggle Card */}
            <div
              className="p-6 sm:p-8 rounded-3xl border shadow-xs transition-colors"
              style={{
                backgroundColor: 'var(--color-surface, #FAF7F2)',
                borderColor: 'var(--color-border, #EAE2D5)',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--color-border,#EAE2D5)]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-2xs"
                      style={{
                        backgroundColor: 'var(--color-primary, #70252D)',
                        color: 'var(--color-primary-contrast, #FFFFFF)',
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Festive Campaign
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary,#6B5D55)]">
                      {(editableSeasonal.items || []).length} Bedsheets on Sale
                    </span>
                  </div>
                  <h3
                    className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ color: 'var(--color-text, #2C2420)' }}
                  >
                    Seasonal Page &amp; Festive Deals
                  </h3>
                  <p
                    className="text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed"
                    style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
                  >
                    Create a dedicated festive event page (e.g. Diwali Fest, Summer Sale) with custom discounted bedsheet pricing.
                    When enabled, it automatically appears as a prominent tab in the storefront Navbar with your custom title.
                  </p>
                </div>

                {/* Master Switch & Save Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleSeasonalActive}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                      editableSeasonal.enabled
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        editableSeasonal.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                      }`}
                    />
                    <span>{editableSeasonal.enabled ? 'Active on Navbar (Visible)' : 'Hidden from Navbar (Disabled)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveSeasonal()}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:opacity-90 active:scale-98"
                    style={{
                      backgroundColor: 'var(--color-primary, #70252D)',
                      color: 'var(--color-primary-contrast, #FFFFFF)',
                    }}
                  >
                    <Save className="w-4 h-4" />
                    <span>Save &amp; Publish</span>
                  </button>
                </div>
              </div>

              {/* Live Navbar Preview Strip */}
              <div
                className="mt-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-stone-500">Navbar Preview:</span>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#EAE2D5] shadow-2xs font-semibold text-[#2C2420]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span>{editableSeasonal.name || 'Festive Sale'}</span>
                    <span
                      className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded"
                      style={{
                        backgroundColor: 'var(--color-primary, #70252D)',
                        color: 'var(--color-primary-contrast, #FFFFFF)',
                      }}
                    >
                      {editableSeasonal.badge || 'Sale'}
                    </span>
                  </div>
                  {editableSeasonal.enabled ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Live for all store visitors
                    </span>
                  ) : (
                    <span className="text-stone-500 italic">(Currently hidden from navbar)</span>
                  )}
                </div>

                <span className="text-[11px] text-[var(--color-text-secondary,#6B5D55)]">
                  ✓ Studio button removed from Navbar as requested
                </span>
              </div>
            </div>

            {/* Customization Settings Form */}
            <div
              className="p-6 sm:p-8 rounded-3xl border shadow-xs space-y-6 transition-colors"
              style={{
                backgroundColor: 'var(--color-surface, #FAF7F2)',
                borderColor: 'var(--color-border, #EAE2D5)',
              }}
            >
              <h4
                className="font-serif-luxury text-lg font-bold border-b border-[var(--color-border,#EAE2D5)] pb-3"
                style={{ color: 'var(--color-text, #2C2420)' }}
              >
                1. Page Details &amp; Branding
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Seasonal Page Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)] flex items-center gap-1">
                    <span>Page Name (Navbar &amp; Heading)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editableSeasonal.name}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Diwali Fest, Summer Sale, Monsoon Offers"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] font-semibold focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary,#6B5D55)]">
                    Appears directly on the desktop navbar and mobile menu.
                  </p>
                </div>

                {/* Festive Tag / Badge */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)]">
                    Festive Badge
                  </label>
                  <input
                    type="text"
                    value={editableSeasonal.badge}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, badge: e.target.value }))}
                    placeholder="e.g. Festive Special, Limited Edition"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] font-medium focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary,#6B5D55)]">
                    Pill tag shown next to page name in navbar and hero.
                  </p>
                </div>

                {/* Discount Highlight Label */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)]">
                    Discount Highlight
                  </label>
                  <input
                    type="text"
                    value={editableSeasonal.discountLabel || ''}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, discountLabel: e.target.value }))}
                    placeholder="e.g. Up to 40% OFF, Flat ₹300 OFF"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] font-medium focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary,#6B5D55)]">
                    Highlight shown in page hero badge.
                  </p>
                </div>

                {/* Main Tagline */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)]">
                    Main Headline / Tagline
                  </label>
                  <input
                    type="text"
                    value={editableSeasonal.tagline}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, tagline: e.target.value }))}
                    placeholder="e.g. Exclusive Festive Savings - 100% Pure Combed Cotton Bedsheets"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] font-medium focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                </div>

                {/* Announcement Notice */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)]">
                    Top Announcement Banner
                  </label>
                  <input
                    type="text"
                    value={editableSeasonal.bannerNotice || ''}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, bannerNotice: e.target.value }))}
                    placeholder="e.g. ✨ Special Festive Pricing Active · Free Delivery in Gurgaon"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] font-medium focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                </div>

                {/* Promotional Description */}
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text,#2C2420)]">
                    Promotional Description
                  </label>
                  <textarea
                    rows={2}
                    value={editableSeasonal.description}
                    onChange={(e) => setEditableSeasonal((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the festive occasion, fabrics, delivery perks..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
                  />
                </div>
              </div>
            </div>

            {/* Bedsheets Discount & Assignment Manager */}
            <div
              className="p-6 sm:p-8 rounded-3xl border shadow-xs space-y-6 transition-colors"
              style={{
                backgroundColor: 'var(--color-surface, #FAF7F2)',
                borderColor: 'var(--color-border, #EAE2D5)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border,#EAE2D5)] pb-4">
                <div>
                  <h4
                    className="font-serif-luxury text-lg font-bold"
                    style={{ color: 'var(--color-text, #2C2420)' }}
                  >
                    2. Bedsheets Under Discount ({editableSeasonal.items.length} of {editableProducts.length} Selected)
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary,#6B5D55)] mt-0.5">
                    Select which bedsheets should appear under discount on your {editableSeasonal.name} page. Set custom offer prices or discount percentages.
                  </p>
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkSeasonalDiscount(20)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[var(--color-border,#EAE2D5)] text-[var(--color-text,#2C2420)] hover:bg-[var(--color-background,#FAF7F2)] cursor-pointer shadow-2xs"
                  >
                    ⚡ Add All with 20% OFF
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkSeasonalDiscount(30)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[var(--color-border,#EAE2D5)] text-[var(--color-text,#2C2420)] hover:bg-[var(--color-background,#FAF7F2)] cursor-pointer shadow-2xs"
                  >
                    🔥 Add All with 30% OFF
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSeasonalItems}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search within bedsheets */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  value={seasonalSearchQuery}
                  onChange={(e) => setSeasonalSearchQuery(e.target.value)}
                  placeholder="Filter bedsheets by name..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] focus:outline-hidden"
                />
              </div>

              {/* Bedsheets List */}
              <div className="space-y-3">
                {editableProducts
                  .filter((p) => {
                    if (!seasonalSearchQuery.trim()) return true;
                    return p.name.toLowerCase().includes(seasonalSearchQuery.toLowerCase());
                  })
                  .map((product) => {
                    const seasonalItem = (editableSeasonal.items || []).find((i) => i.productId === product.id);
                    const isIncluded = !!seasonalItem;
                    const resolvedImg = resolveBedsheetImage(product.image, product.id, product.updatedAt);
                    const originalPrice = product.originalPrice || Math.round(product.price * 1.35);

                    return (
                      <div
                        key={product.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isIncluded
                            ? 'bg-white border-[var(--color-primary,#70252D)]/40 shadow-xs'
                            : 'bg-white/60 border-[var(--color-border,#EAE2D5)] opacity-85'
                        }`}
                      >
                        {/* Left: Checkbox + Thumbnail + Product Title & Regular Price */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => handleToggleSeasonalProduct(product.id)}
                            id={`seasonal-toggle-${product.id}`}
                            className="w-4 h-4 rounded text-[var(--color-primary,#70252D)] border-[var(--color-border,#EAE2D5)] focus:ring-[var(--color-primary,#70252D)] cursor-pointer"
                          />

                          <img
                            src={resolvedImg}
                            alt={product.name}
                            className="w-14 h-14 rounded-xl object-cover border border-[var(--color-border,#EAE2D5)] shrink-0 bg-stone-100"
                          />

                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={`seasonal-toggle-${product.id}`}
                              className="font-serif-luxury text-sm font-bold text-[var(--color-text,#2C2420)] truncate block cursor-pointer hover:underline"
                            >
                              {product.name}
                            </label>
                            <p className="text-[11px] text-[var(--color-text-secondary,#6B5D55)]">
                              Regular: ₹{product.price} · MRP: ₹{originalPrice} · {product.fabric || '100% Pure Cotton'}
                            </p>
                            {isIncluded && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                                On {editableSeasonal.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Discount Controls (Enabled only if included) */}
                        {isIncluded ? (
                          <div className="flex flex-wrap items-center gap-3 shrink-0">
                            {/* Offer Price Input */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary,#6B5D55)] block">
                                Seasonal Price (₹)
                              </span>
                              <input
                                type="number"
                                min={100}
                                max={originalPrice}
                                value={seasonalItem?.discountPrice ?? Math.round(product.price * 0.8)}
                                onChange={(e) => handleUpdateSeasonalItemPrice(product.id, Number(e.target.value))}
                                className="w-24 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-primary,#70252D)] focus:outline-hidden"
                              />
                            </div>

                            {/* Discount % Input */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary,#6B5D55)] block">
                                Discount %
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={90}
                                value={seasonalItem?.discountPercentage ?? 20}
                                onChange={(e) => handleUpdateSeasonalItemPct(product.id, Number(e.target.value))}
                                className="w-16 px-2 py-1.5 text-xs font-bold rounded-lg border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] text-center focus:outline-hidden"
                              />
                            </div>

                            {/* Custom Item Badge */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary,#6B5D55)] block">
                                Item Badge
                              </span>
                              <input
                                type="text"
                                value={seasonalItem?.customBadge || ''}
                                onChange={(e) => handleUpdateSeasonalItemBadge(product.id, e.target.value)}
                                placeholder="e.g. Festive Pick"
                                className="w-28 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border,#EAE2D5)] bg-white text-[var(--color-text,#2C2420)] focus:outline-hidden"
                              />
                            </div>

                            {/* Remove button */}
                            <div className="pt-4">
                              <button
                                type="button"
                                onClick={() => handleToggleSeasonalProduct(product.id)}
                                className="p-2 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Remove from seasonal page"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleSeasonalProduct(product.id)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[var(--color-border,#EAE2D5)] text-[var(--color-primary,#70252D)] hover:bg-[var(--color-surface,#FAF7F2)] cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to {editableSeasonal.name}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Bottom Save Bar */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border,#EAE2D5)]">
                <button
                  type="button"
                  onClick={() => handleSaveSeasonal()}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:opacity-90 active:scale-98"
                  style={{
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }}
                >
                  <Save className="w-4 h-4" />
                  <span>Save All Seasonal Changes</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: STORE CONTENT & STORY EDITOR                      */}
        {/* ======================================================== */}
        {activeAdminTab === 'content' && (
          <form
            onSubmit={handleSaveContent}
            className="space-y-8 p-6 sm:p-8 rounded-3xl border shadow-xs"
            style={{
              backgroundColor: 'var(--color-surface, #FAF7F2)',
              borderColor: 'var(--color-border, #EAE2D5)',
            }}
          >
            
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAE2D5]">
              <div>
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  Edit Website Copy, Headers &amp; Our Story
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Customize brand headlines, announcement banner, company phone number, and story text.
                </p>
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  backgroundColor: 'var(--color-primary, #70252D)',
                  color: 'var(--color-primary-contrast, #FFFFFF)',
                }}
              >
                <Save className="w-4 h-4" />
                <span>Save All Changes</span>
              </button>
            </div>

            {/* Announcement Banner */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C29E57]" />
                Top Announcement Bar
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Announcement Banner Text
                  </label>
                  <input
                    type="text"
                    value={editableContent.announcement.text}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        announcement: { ...editableContent.announcement, text: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Announcement Badge
                  </label>
                  <input
                    type="text"
                    value={editableContent.announcement.badge}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        announcement: { ...editableContent.announcement, badge: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="space-y-4 pt-4 border-t border-[#EAE2D5]">
              <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C29E57]" />
                Hero Section (Homepage Display)
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Hero Small Kicker Tag
                  </label>
                  <input
                    type="text"
                    value={editableContent.hero.kicker}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        hero: { ...editableContent.hero, kicker: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Hero Main Headline
                  </label>
                  <input
                    type="text"
                    value={editableContent.hero.headline}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        hero: { ...editableContent.hero, headline: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-sm font-serif-luxury font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Hero Subtitle / Description
                  </label>
                  <textarea
                    rows={3}
                    value={editableContent.hero.subheadline}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        hero: { ...editableContent.hero, subheadline: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>
              </div>
            </div>

            {/* Our Story & Craft */}
            <div className="space-y-4 pt-4 border-t border-[#EAE2D5]">
              <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C29E57]" />
                Our Story &amp; Brand Philosophy
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Story Heading
                  </label>
                  <input
                    type="text"
                    value={editableContent.story.heading}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        story: { ...editableContent.story, heading: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-sm font-serif-luxury font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Story Paragraph 1
                  </label>
                  <textarea
                    rows={3}
                    value={editableContent.story.paragraph1}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        story: { ...editableContent.story, paragraph1: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Story Paragraph 2
                  </label>
                  <textarea
                    rows={3}
                    value={editableContent.story.paragraph2}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        story: { ...editableContent.story, paragraph2: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>
              </div>
            </div>

            {/* Store & Contact Information */}
            <div className="space-y-4 pt-4 border-t border-[#EAE2D5]">
              <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C29E57]" />
                Store Location, Phone &amp; Hours
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Store Address
                  </label>
                  <input
                    type="text"
                    value={editableContent.company.address}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        company: { ...editableContent.company, address: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Customer Support Phone / WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={editableContent.company.phone}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        company: { ...editableContent.company, phone: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={editableContent.company.operatingHours}
                    onChange={(e) =>
                      setEditableContent({
                        ...editableContent,
                        company: { ...editableContent.company, operatingHours: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    City &amp; Pincode
                  </label>
                  <input
                    type="text"
                    value={`${editableContent.company.city} - ${editableContent.company.pincode}`}
                    onChange={(e) => {
                      const [city, pin] = e.target.value.split('-');
                      setEditableContent({
                        ...editableContent,
                        company: {
                          ...editableContent.company,
                          city: city?.trim() || 'Gurgaon, Haryana',
                          pincode: pin?.trim() || '122003'
                        }
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>
              </div>
            </div>

            {/* Terms & Conditions (T&C) Policy Section */}
            <div className="space-y-4 pt-4 border-t border-[#EAE2D5]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C29E57]" />
                  Terms &amp; Conditions (T&amp;C) Store Policies
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setEditableContent({
                      ...editableContent,
                      termsAndConditions: INITIAL_SITE_CONTENT.termsAndConditions
                    })
                  }
                  className="text-[11px] text-[#8C2E46] hover:underline cursor-pointer font-medium"
                >
                  Reset to Standard Cotton Nest T&amp;C Policy
                </button>
              </div>
              <p className="text-xs text-[#7A6458]">
                This content is displayed in the Terms &amp; Conditions (T&amp;C) tab in your website navigation header. You can edit the text, exchange rules, defect reporting period, and shipping guidelines.
              </p>
              <textarea
                rows={12}
                value={editableContent.termsAndConditions ?? INITIAL_SITE_CONTENT.termsAndConditions}
                onChange={(e) =>
                  setEditableContent({
                    ...editableContent,
                    termsAndConditions: e.target.value
                  })
                }
                placeholder="Enter Terms & Conditions text here..."
                className="w-full px-3.5 py-3 bg-white border border-[#EAE2D5] rounded-xl text-xs font-mono text-[#2C2420] leading-relaxed focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-[#EAE2D5] flex justify-end">
              <button
                type="submit"
                className="px-8 py-3 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save All Website Content</span>
              </button>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 4: WEBSITE APPEARANCE & FESTIVAL THEME CUSTOMIZER     */}
        {/* ======================================================== */}
        {activeAdminTab === 'appearance' && (
          <ThemeCustomizer
            currentTheme={currentTheme}
            onThemePublished={(newTheme) => {
              if (onThemePublished) onThemePublished(newTheme);
            }}
            isOwnerAuthenticated={true}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 5: COUPONS & OFFERS PROMOTIONAL MANAGEMENT          */}
        {/* ======================================================== */}
        {activeAdminTab === 'coupons' && (
          <AdminCouponsSection
            products={editableProducts}
            onToast={showToast}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 6: NOTIFICATIONS & OPERATIONAL ATELIER ALERTS        */}
        {/* ======================================================== */}
        {activeAdminTab === 'notifications' && (
          <AdminNotificationsSection
            products={editableProducts}
            orders={editableOrders}
            reviews={reviews}
            onNavigateToTab={(tab) => setActiveAdminTab(tab)}
            onUpdateProductStock={handleUpdateStockDirect}
            onToast={showToast}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 7: CUSTOMER WISHLISTS & VIP DIRECT OUTREACH          */}
        {/* ======================================================== */}
        {activeAdminTab === 'wishlists' && (
          <AdminWishlistsSection
            onShowToast={showToast}
          />
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL: ADD NEW BEDSHEET                                  */}
      {/* ======================================================== */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddProductModalOpen(false)} />

          <div className="relative bg-[#FAF7F2] w-full max-w-2xl rounded-3xl border border-[#EAE2D5] shadow-2xl p-6 sm:p-8 z-10 text-[#2C2420] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddProductModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-6">
              <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#8C2E46]" />
                Add New Bedsheet to Store
              </h3>
              <p className="text-xs text-[#7A6458]">
                Enter product specifications, pricing, stock units, and upload the bedsheet photograph.
              </p>
            </div>

            <form onSubmit={handleCreateNewProduct} className="space-y-5">
              
              {/* Photo Preview & Picker */}
              <div className="flex items-center gap-4 p-4 bg-[#F4EFE6] rounded-2xl border border-[#EAE2D5]">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-white border border-[#EAE2D5] shrink-0">
                  <img
                    src={resolveBedsheetImage(newProduct.image)}
                    alt="Preview"
                    onError={handleImageFallback}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-2 flex-1">
                  <input
                    type="file"
                    ref={newProductFileRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProductFile(file);
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setNewProduct({ ...newProduct, image: reader.result });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => newProductFileRef.current?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#C29E57]" />
                    <span>{newProductFile ? 'Change Selected Photo' : 'Choose Photo From Device'}</span>
                  </button>
                  <p className="text-[10px] text-[#8C7A70]">
                    {newProductFile ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        "{newProductFile.name}" selected · Will upload to Cloudinary upon publishing.
                      </span>
                    ) : (
                      'Select any photo from your phone gallery or computer.'
                    )}
                  </p>
                </div>
              </div>

              {/* Title & Collection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Bedsheet Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Indigo Botanical Rose"
                    value={newProduct.name || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Heritage Rose Collection"
                    value={newProduct.collection || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, collection: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>
              </div>

              {/* Price & MRP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F4EFE6]/60 p-3 rounded-2xl border border-[#EAE2D5]">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50}
                    value={newProduct.price || 1899}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-[#DEC89B] rounded-xl text-xs font-bold text-[#8C2E46]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    MRP (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50}
                    value={newProduct.originalPrice || 2499}
                    onChange={(e) => setNewProduct({ ...newProduct, originalPrice: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#7A6458]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Initial Stock Units
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newProduct.stockQuantity || 15}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs font-semibold text-[#2C2420]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Badge
                  </label>
                  <input
                    type="text"
                    placeholder="New Arrival"
                    value={newProduct.badge || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, badge: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
              </div>

              {/* Dimensions & Thread Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={newProduct.dimensions || '108 x 108 inches (274 x 274 cm)'}
                    onChange={(e) => setNewProduct({ ...newProduct, dimensions: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Thread Count
                  </label>
                  <input
                    type="text"
                    value={newProduct.threadCount || '350 Thread Count'}
                    onChange={(e) => setNewProduct({ ...newProduct, threadCount: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Fabric Weave
                  </label>
                  <input
                    type="text"
                    value={newProduct.fabric || '100% Pure Percale Cotton'}
                    onChange={(e) => setNewProduct({ ...newProduct, fabric: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                  Product Description
                </label>
                <textarea
                  rows={2}
                  value={newProduct.description || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Describe the fabric feel, print details, and styling..."
                  className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                />
              </div>

              {/* Color Variants / Additional Colors */}
              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#8C2E46]" />
                    <span>Upload Additional Color Variants (Optional)</span>
                  </label>
                  <span className="text-[11px] text-[#7A6458]">
                    {newProduct.variants?.length || 0} variant{(newProduct.variants?.length || 0) === 1 ? '' : 's'} added
                  </span>
                </div>

                {/* Existing Variants in Draft */}
                {newProduct.variants && newProduct.variants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newProduct.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 p-1.5 pl-2 bg-white rounded-xl border border-[#EAE2D5] shadow-xs text-xs"
                      >
                        <div className="w-6 h-6 rounded-md overflow-hidden bg-[#F4EFE6] shrink-0 border border-black/10">
                          <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                        </div>
                        <span
                          className="w-3 h-3 rounded-full border border-black/10 inline-block shrink-0"
                          style={{ backgroundColor: v.colorHex || '#C29E57' }}
                        />
                        <span className="font-medium text-[#2C2420]">{v.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewProductVariant(v.id)}
                          className="p-1 text-[#8C7A70] hover:text-red-600 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Variant Draft Input */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                      Color Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sage Mint / Blush Rose"
                      value={newProductVariantDraft.name}
                      onChange={(e) =>
                        setNewProductVariantDraft((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                      Color Tone
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newProductVariantDraft.colorHex}
                        onChange={(e) =>
                          setNewProductVariantDraft((prev) => ({ ...prev, colorHex: e.target.value }))
                        }
                        className="w-8 h-8 rounded-lg border border-[#EAE2D5] cursor-pointer p-0.5 bg-white shrink-0"
                      />
                      <input
                        type="text"
                        value={newProductVariantDraft.colorHex}
                        onChange={(e) =>
                          setNewProductVariantDraft((prev) => ({ ...prev, colorHex: e.target.value }))
                        }
                        className="w-full px-2 py-1 bg-white border border-[#EAE2D5] rounded-lg text-xs uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-5 flex items-center gap-2">
                    <input
                      type="file"
                      ref={newProductVariantFileRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setNewProductVariantDraft((prev) => ({
                                ...prev,
                                image: reader.result as string,
                              }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => newProductVariantFileRef.current?.click()}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#2C2420] text-xs font-medium rounded-lg flex items-center justify-center gap-1 cursor-pointer truncate"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#C29E57] shrink-0" />
                      <span className="truncate">
                        {newProductVariantDraft.image ? 'Photo Ready ✓' : 'Variant Photo'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddNewProductVariant}
                      className="py-1.5 px-3 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EAE2D5]">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7A6458] hover:text-[#2C2420] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish to Store</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CLOUDINARY CONFIGURATION GUIDE                    */}
      {/* ======================================================== */}
      {isCloudinaryHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsCloudinaryHelpModalOpen(false)} />

          <div className="relative bg-[#FAF7F2] w-full max-w-xl rounded-3xl border border-[#EAE2D5] shadow-2xl p-6 sm:p-8 z-10 text-[#2C2420] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCloudinaryHelpModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#FDEAF0] text-[#8C2E46] flex items-center justify-center shrink-0">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  Cloudinary Image Hosting Setup
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Permanent, high-speed CDN photography for Cotton Nest bedsheets
                </p>
              </div>
            </div>

            {/* Current Status Box */}
            <div className={`p-4 rounded-2xl border mb-5 ${
              cloudinaryStatus?.configured
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {cloudinaryStatus?.configured ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Cloudinary Connected ({cloudinaryStatus.cloudName})</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Cloudinary Credentials Not Detected</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const st = await checkCloudinaryConfig();
                    setCloudinaryStatus(st);
                    showToast(st.configured ? 'Cloudinary connected!' : 'Credentials still not detected');
                  }}
                  className="px-2.5 py-1 text-[11px] bg-white border rounded-lg font-medium shadow-2xs hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Check Status
                </button>
              </div>
              {!cloudinaryStatus?.configured && (
                <p className="text-[11px] text-amber-800 mt-2">
                  Photos can be replaced once the 3 environment variables below are added to your hosting settings.
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-4 text-xs text-[#4A3E38]">
              <div>
                <h4 className="font-bold text-[#2C2420] text-sm mb-1.5">
                  Required Environment Variables
                </h4>
                <p className="text-[11px] text-[#7A6458] mb-2.5">
                  Set these in your <strong>Vercel Project Settings &gt; Environment Variables</strong> (or server environment):
                </p>

                <div className="space-y-2 font-mono text-[11px]">
                  <div className="p-2.5 bg-white rounded-xl border border-[#EAE2D5]">
                    <div className="font-bold text-[#8C2E46]">CLOUDINARY_CLOUD_NAME</div>
                    <div className="text-[10px] text-[#7A6458] font-sans mt-0.5">Your Cloudinary cloud name (e.g. "my-store-cloud")</div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-[#EAE2D5]">
                    <div className="font-bold text-[#8C2E46]">CLOUDINARY_API_KEY</div>
                    <div className="text-[10px] text-[#7A6458] font-sans mt-0.5">Your 15-digit public API key</div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-[#EAE2D5]">
                    <div className="font-bold text-[#8C2E46]">CLOUDINARY_API_SECRET</div>
                    <div className="text-[10px] text-[#7A6458] font-sans mt-0.5">
                      Your private API secret (kept secure on server, never sent to browsers)
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[#8C7A70] mt-2">
                  Tip: You can alternatively provide a single <code className="font-bold text-[#2C2420]">CLOUDINARY_URL</code> (e.g. <code className="text-[#8C2E46]">cloudinary://API_KEY:API_SECRET@CLOUD_NAME</code>).
                </p>
              </div>

              <div className="p-3.5 bg-[#F4EFE6] rounded-2xl border border-[#EAE2D5] space-y-1.5 text-[11px]">
                <div className="font-bold text-[#2C2420] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Security &amp; Architecture Highlights</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#6B5D55]">
                  <li><strong>Signed Direct Uploads:</strong> Photos upload straight to Cloudinary CDN with temporary HMAC signatures signed on the server.</li>
                  <li><strong>Zero Secrets in Browser:</strong> The API Secret is never exposed to public JavaScript or HTML.</li>
                  <li><strong>Firestore Persistence:</strong> Only lightweight HTTPS URLs are stored in Firestore, eliminating 1MB document quota blocks.</li>
                  <li><strong>Instant Cross-Device Sync:</strong> Changes reflect in real-time across phones, tablets, and computers.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EAE2D5] flex items-center justify-between">
              <a
                href="https://cloudinary.com/console"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#8C2E46] font-semibold hover:underline"
              >
                <span>Open Cloudinary Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={() => setIsCloudinaryHelpModalOpen(false)}
                className="px-5 py-2 bg-[#2C2420] hover:bg-[#433731] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bedsheet Delete Confirmation Modal (In-App, never blocked by iframes) */}
      {deleteConfirmationProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setDeleteConfirmationProduct(null)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 border border-red-200 shadow-2xl z-10 text-[#2C2420]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  Delete Bedsheet?
                </h3>
                <p className="text-xs text-[#7A6458]">
                  This bedsheet will be removed from your catalogue, store, and database.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#DEC89B] flex items-center gap-3.5">
              <img
                src={deleteConfirmationProduct.image}
                alt={deleteConfirmationProduct.name}
                className="w-16 h-16 rounded-xl object-cover border border-[#DEC89B] shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/exact_sheet1_pink_rose_1790997736396.jpg';
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#2C2420] truncate">
                  {deleteConfirmationProduct.name}
                </p>
                <p className="text-xs text-[#A8823B] font-semibold">
                  {deleteConfirmationProduct.collection} · ₹{deleteConfirmationProduct.price}
                </p>
                <p className="text-[11px] text-[#8C7A70] font-mono mt-0.5">
                  ID: {deleteConfirmationProduct.id}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmationProduct(null)}
                className="px-4 py-2.5 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteProduct(deleteConfirmationProduct.id)}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Bedsheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal (In-App) */}
      {isFactoryResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsFactoryResetModalOpen(false)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 border border-red-200 shadow-2xl z-10 text-[#2C2420]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  Factory Reset Store?
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Reset all bedsheets, inventory, prices, and settings back to initial factory defaults.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFactoryResetModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFactoryResetModalOpen(false);
                  onResetDefaults();
                  showToast('Factory reset completed.');
                }}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yes, Reset to Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
