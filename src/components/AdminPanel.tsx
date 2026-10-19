import React, { useState, useRef } from 'react';
import {
  BedsheetProduct,
  BedsheetVariant,
  COMPANY_DETAILS
} from '../data/products';
import { Order, OrderStatus } from '../data/orders';
import { SiteContent, INITIAL_SITE_CONTENT } from '../data/siteContent';
import { uploadImageApi, removeProduct } from '../services/api';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
  checkCloudinaryConfig
} from '../services/cloudinary';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { savePersistentImage } from '../utils/persistentStorage';
import {
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
  ExternalLink
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
}) => {
  // Tabs: 'products' | 'orders' | 'content'
  const [activeAdminTab, setActiveAdminTab] = useState<'products' | 'orders' | 'content'>('products');

  // Products local state
  const [editableProducts, setEditableProducts] = useState<BedsheetProduct[]>(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      alert('Please enter a Color Name and select a Photo for this variant.');
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
          return { ...mod, updatedAt: Date.now() };
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

  const contentInitializedRef = useRef(false);
  React.useEffect(() => {
    if (!contentInitializedRef.current && siteContent && siteContent.company) {
      setEditableContent(siteContent);
      contentInitializedRef.current = true;
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
    updateProductItem(id, (p) => ({ ...p, badge: badge.trim() || undefined }), false);
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
      alert('Catalogue must have at least one bedsheet.');
      return;
    }
    const target = editableProducts.find((p) => p.id === productId);
    if (!window.confirm(`Are you sure you want to remove "${target?.name || 'this bedsheet'}" from your store?`)) {
      return;
    }
    const updated = editableProducts.filter((p) => p.id !== productId);
    setEditableProducts(updated);
    onUpdateProducts(updated);
    removeProduct(productId).catch(() => {});
    showToast('Bedsheet removed from store.');
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

      // 3. Atomically update local editable state and parent state
      const updatedProduct: BedsheetProduct = {
        ...targetProduct,
        ...updatedFields,
      };

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
      alert(`Image Replacement Failed:\n${err.message || err}\n\nYour previous product image has been kept unchanged.`);
      showToast('Image replacement failed. Previous image retained.');
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
      alert('Please provide a Color Name and select an image/photo for this variant.');
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
      alert('Please enter a name for the new bedsheet.');
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
        alert(`Cloudinary Upload Failed:\n${uploadErr.message || uploadErr}\n\nPlease verify your Cloudinary configuration.`);
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
    };

    // Save directly to Google Cloud Firestore
    try {
      await saveProductToFirestore(fullProduct);
    } catch (fsErr) {
      console.warn('Firestore new product save warning:', fsErr);
    }

    const updated = [fullProduct, ...editableProducts];
    setEditableProducts(updated);
    onUpdateProducts(updated);
    setIsAddProductModalOpen(false);
    setNewProductFile(null);
    showToast(`"${fullProduct.name}" created with Cloudinary image & Firestore persistence!`);
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
                savePersistentImage(k, resolveBedsheetImage(v, k)).catch(() => {});
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
    if (!window.confirm(`Delete order #${orderId}? This cannot be undone.`)) return;
    const updated = editableOrders.filter((o) => o.id !== orderId);
    setEditableOrders(updated);
    onUpdateOrders(updated);
    showToast(`Order #${orderId} deleted.`);
  };

  /* ---------------- SITE CONTENT HANDLERS ---------------- */

  const handleSaveContent = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSiteContent(editableContent);
    showToast('Store content, header & story updated successfully!');
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
    <div className="min-h-screen bg-[#F4EFE6] text-[#2C2420]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#2C2420] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-[#C29E57]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2] border-b border-[#EAE2D5] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6B5D55] hover:text-[#2C2420] bg-white border border-[#EAE2D5] rounded-xl hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-luxury text-lg sm:text-xl font-bold text-[#2C2420]">
                  {editableContent.company.name}
                </span>
                <span className="px-2 py-0.5 bg-[#8C2E46] text-white text-[10px] font-bold tracking-wider uppercase rounded-md">
                  Owner Dashboard
                </span>
              </div>
              <p className="text-[11px] text-[#7A6458]">
                {editableContent.company.address} · Synced across Phone &amp; Web
              </p>
            </div>
          </div>

          {/* Tab Switcher Buttons */}
          <div className="flex items-center gap-1.5 bg-[#F4EFE6] p-1 rounded-xl border border-[#EAE2D5]">
            <button
              onClick={() => setActiveAdminTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'products'
                  ? 'bg-[#2C2420] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Bedsheets ({totalProducts})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative ${
                activeAdminTab === 'orders'
                  ? 'bg-[#2C2420] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Incoming Orders</span>
              {pendingOrdersCount > 0 && (
                <span className="bg-[#B83F60] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab('content')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'content'
                  ? 'bg-[#2C2420] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Store &amp; Story Content</span>
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
                showToast('✅ All changes permanently saved to Firebase Firestore!');
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ======================================================== */}
        {/* TAB 1: BEDSHEET INVENTORY, VARIANTS & PHOTOS             */}
        {/* ======================================================== */}
        {activeAdminTab === 'products' && (
          <div className="space-y-6">
            
            {/* Top KPI Metrics Row */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Bedsheet Models</span>
                  <Package className="w-4 h-4 text-[#C29E57]" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-[#2C2420]">
                  {totalProducts}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Active catalogue</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">In Stock</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-emerald-700">
                  {inStockCount}
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Available for buyers</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Out of Stock</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-amber-700">
                  {outOfStockCount}
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Needs stock replenishment</p>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Total Units</span>
                  <Boxes className="w-4 h-4 text-[#B83F60]" />
                </div>
                <div className="text-2xl font-bold font-serif-luxury text-[#2C2420]">
                  {totalInventoryUnits} pcs
                </div>
                <p className="text-[10px] text-[#8C7A70] mt-0.5">Ready in warehouse/studio</p>
              </div>

              <div className="col-span-2 lg:col-span-1 bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#7A6458] mb-1">
                  <span className="text-xs font-medium">Quick Action</span>
                  <Sparkles className="w-4 h-4 text-[#C29E57]" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="w-full py-2 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Bedsheet</span>
                </button>
              </div>
            </section>

            {/* Quick Bulk Tools */}
            <section className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EAE2D5] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#8C2E46] text-white text-xs font-semibold rounded-lg hover:bg-[#742438] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
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
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Google Cloud Firestore Connected (Google Console)</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("⚠️ Are you sure you want to perform a factory reset? All your custom bedsheets, prices, inventory, and details will be reset.")) {
                      onResetDefaults();
                      showToast('Factory reset completed.');
                    }
                  }}
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

                return (
                  <div
                    key={product.id}
                    className={`bg-[#FAF7F2] rounded-2xl border p-4 sm:p-5 transition-all shadow-xs space-y-4 ${
                      product.inStock ? 'border-[#EAE2D5]' : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
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
                          <span className="absolute top-1 left-1 bg-[#2C2420]/80 text-white text-[9px] px-1 rounded">
                            #{idx + 1}
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
                      className="bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] p-5 shadow-xs space-y-4"
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
        {/* TAB 3: STORE CONTENT & STORY EDITOR                      */}
        {/* ======================================================== */}
        {activeAdminTab === 'content' && (
          <form onSubmit={handleSaveContent} className="space-y-8 bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#EAE2D5] shadow-xs">
            
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
                className="px-6 py-2.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
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

    </div>
  );
};
