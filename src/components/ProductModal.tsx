import React from 'react';
import { X, Check, MessageCircle, ShoppingBag, ShieldCheck, Truck, RotateCcw, MapPin, Sparkles, Edit3, Save, ImageIcon, Cloud, Loader2, Star, ThumbsUp, Upload, Plus, Trash2, Tag, Copy, ArrowLeftRight, Bell, Play, Video, Film, Link as LinkIcon, Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS, STANDARD_PRODUCT_TYPES, STANDARD_SIZES, AVAILABILITY_OPTIONS, normalizeAvailabilityType } from '../data/products';
import { ImageLightboxModal } from './ImageLightboxModal';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { updateSingleProduct, addProductGalleryImageApi, removeProductGalleryImageApi, getCouponsApi } from '../services/api';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl, isVideoMedia, getProductGalleryMedia } from '../services/cloudinary';
import { ProductReview, getProductRatingSummary } from '../data/reviews';
import { CouponOffer } from '../data/coupons';
import { ProductRecommendations } from './ProductRecommendations';

interface ProductModalProps {
  product: BedsheetProduct | null;
  onClose: () => void;
  onAddToCart: (product: BedsheetProduct, quantity: number, variant?: BedsheetVariant) => void;
  customImage?: string;
  onUploadImage?: (productId: string, dataUrl: string) => void;
  onUpdateProduct?: (updatedProduct: BedsheetProduct) => void;
  isOwnerMode?: boolean;
  onViewTermsAndConditions?: () => void;
  initialEditMode?: boolean;
  onOpenOwnerAuth?: () => void;
  reviews?: ProductReview[];
  onOpenWriteReview?: (productId: string) => void;
  allProducts?: BedsheetProduct[];
  onSelectProduct?: (product: BedsheetProduct) => void;
  onToggleCompare?: (product: BedsheetProduct) => void;
  isCompared?: boolean;
  onNotifyStock?: (product: BedsheetProduct) => void;
  shippingFee?: number;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
  customImage,
  onUploadImage,
  onUpdateProduct,
  isOwnerMode = false,
  onViewTermsAndConditions,
  initialEditMode = false,
  onOpenOwnerAuth,
  reviews = [],
  onOpenWriteReview,
  allProducts = [],
  onSelectProduct,
  onToggleCompare,
  isCompared = false,
  onNotifyStock,
  shippingFee = 29,
}) => {
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryFileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryVideoInputRef = React.useRef<HTMLInputElement>(null);

  // Owner Edit Mode State
  const [isEditing, setIsEditing] = React.useState(initialEditMode);
  const [editName, setEditName] = React.useState('');
  const [editPrice, setEditPrice] = React.useState(0);
  const [editOriginalPrice, setEditOriginalPrice] = React.useState(0);
  const [editDimensions, setEditDimensions] = React.useState('');
  const [editThreadCount, setEditThreadCount] = React.useState('');
  const [editFabric, setEditFabric] = React.useState('');
  const [editPillowCovers, setEditPillowCovers] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editBadge, setEditBadge] = React.useState('');
  const [editProductType, setEditProductType] = React.useState('Bedsheet');
  const [editSize, setEditSize] = React.useState('King');
  const [editAvailabilityType, setEditAvailabilityType] = React.useState('none');
  const [editInStock, setEditInStock] = React.useState(true);
  const [editStockQuantity, setEditStockQuantity] = React.useState(10);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = React.useState<string | null>(null);
  const [showFullPolicy, setShowFullPolicy] = React.useState(false);
  const [activeCoupons, setActiveCoupons] = React.useState<CouponOffer[]>([]);
  const [copiedCouponCode, setCopiedCouponCode] = React.useState<string | null>(null);
  const [showVideoUrlModal, setShowVideoUrlModal] = React.useState(false);
  const [videoUrlInput, setVideoUrlInput] = React.useState('');
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  React.useEffect(() => {
    getCouponsApi()
      .then((list) => {
        const today = new Date().toISOString().split('T')[0];
        const active = list.filter((c) => c.isActive && c.expiryDate >= today);
        setActiveCoupons(active);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    setSelectedVariantId(null);
    setSelectedPreviewUrl(null);
    setQuantity(1);
    setAdded(false);
    setIsEditing(initialEditMode);
    setSaveSuccessMessage(null);
    setShowVideoUrlModal(false);
    setVideoUrlInput('');

    if (product) {
      setEditName(product.name);
      setEditPrice(product.price);
      setEditOriginalPrice(product.originalPrice);
      setEditDimensions(product.dimensions);
      setEditThreadCount(product.threadCount);
      setEditFabric(product.fabric);
      setEditPillowCovers(product.pillowCovers);
      setEditDescription(product.description);
      setEditBadge(product.badge || '');
      setEditProductType(product.productType || 'Bedsheet');
      setEditSize(product.size || 'King');
      setEditAvailabilityType(normalizeAvailabilityType(product.availabilityType));
      setEditInStock(product.inStock);
      setEditStockQuantity(product.stockQuantity ?? 10);
    }
  }, [product?.id, product?.image, customImage]);

  const activeVariant = selectedVariantId && product
    ? product.variants?.find((v) => v.id === selectedVariantId)
    : undefined;

  const rawImage = selectedPreviewUrl || activeVariant?.image || product?.image || customImage;
  const displayImage = product ? resolveBedsheetImage(rawImage, product.id, product.updatedAt) : '';
  const productRating = product ? getProductRatingSummary(product.id, reviews) : { average: 4.9, count: 0, reviews: [] };

  const lightboxPhotos = React.useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    const addPhoto = (url?: string) => {
      if (!url) return;
      const resolved = resolveBedsheetImage(url, product.id, product.updatedAt);
      if (resolved && !isVideoMedia(resolved) && !list.includes(resolved)) {
        list.push(resolved);
      }
    };

    addPhoto(selectedPreviewUrl || displayImage || product.image);
    addPhoto(product.image);

    if (Array.isArray(product.additionalImages)) {
      product.additionalImages.forEach(addPhoto);
    }
    if (Array.isArray(product.variants)) {
      product.variants.forEach((v) => addPhoto(v.image));
    }

    return list;
  }, [product, selectedPreviewUrl, displayImage]);

  if (!product) return null;

  const handleSaveToFirebase = async () => {
    if (!product) return;
    setIsSaving(true);
    setSaveSuccessMessage(null);
    try {
      const updatedData: Partial<BedsheetProduct> = {
        name: editName.trim() || product.name,
        price: Number(editPrice) || product.price,
        originalPrice: Number(editOriginalPrice) || product.originalPrice,
        dimensions: editDimensions.trim() || product.dimensions,
        threadCount: editThreadCount.trim() || product.threadCount,
        fabric: editFabric.trim() || product.fabric,
        pillowCovers: editPillowCovers.trim() || product.pillowCovers,
        description: editDescription.trim() || product.description,
        badge: editBadge.trim() ? editBadge.trim() : '',
        productType: editProductType || product.productType || 'Bedsheet',
        size: editSize || product.size || 'King',
        availabilityType: normalizeAvailabilityType(editAvailabilityType),
        inStock: editInStock,
        stockQuantity: Number(editStockQuantity),
        updatedAt: Date.now(),
      };

      await updateSingleProduct(product.id, updatedData);

      const mergedProduct: BedsheetProduct = {
        ...product,
        ...updatedData,
      };

      if (onUpdateProduct) {
        onUpdateProduct(mergedProduct);
      }

      setSaveSuccessMessage('Saved to store!');
      setTimeout(() => {
        setSaveSuccessMessage(null);
        setIsEditing(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to save product details:', err);
      setSaveSuccessMessage('Failed to save product details. Please try again.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUploadDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    const previousImage = product.image;
    const previousPublicId = product.cloudinaryPublicId;

    setIsSaving(true);
    setSaveSuccessMessage('Uploading replacement to Cloudinary...');
    try {
      // 1. Upload to Cloudinary via signed direct upload
      const uploadResult = await uploadToCloudinary(file, product.id);
      const newUrl = uploadResult.url;
      const newPublicId = uploadResult.public_id;

      // 2. Save image and public_id to server store (preserving name, price, variants, etc.)
      await updateSingleProduct(product.id, {
        image: newUrl,
        cloudinaryPublicId: newPublicId,
        updatedAt: Date.now(),
      });

      const updatedProduct: BedsheetProduct = {
        ...product,
        image: newUrl,
        cloudinaryPublicId: newPublicId,
        updatedAt: Date.now(),
      };

      if (onUploadImage) {
        onUploadImage(product.id, newUrl);
      }
      if (onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }

      setSaveSuccessMessage('Image replaced & hosted on Cloudinary!');
      setTimeout(() => setSaveSuccessMessage(null), 2500);

      // 3. Cleanup previous Cloudinary asset after successful save
      if (previousPublicId && previousPublicId !== newPublicId && isCloudinaryUrl(previousImage)) {
        deleteFromCloudinary(previousPublicId).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to upload image to Cloudinary:', err);
      setSaveSuccessMessage(`Image Replacement Failed: ${err.message || 'Previous image kept unchanged.'}`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddAngleMedia = async (fileOrUrl: File | string) => {
    if (!product) return;

    setIsSaving(true);
    const isVideo = isVideoMedia(fileOrUrl);
    setSaveSuccessMessage(
      isVideo
        ? 'Uploading video reel & saving in Firebase...'
        : 'Uploading extra angle photo & saving in Firebase...'
    );
    try {
      const currentAdditional = getProductGalleryMedia(product);
      const newUrl = await addProductGalleryImageApi(product.id, fileOrUrl, currentAdditional);
      const updatedList = Array.from(new Set([...currentAdditional, newUrl]));
      const videoList = updatedList.filter((u) => isVideoMedia(u));
      const updatedProduct: BedsheetProduct = {
        ...product,
        additionalImages: updatedList,
        videos: videoList,
        videoUrl: videoList[0] || '',
        updatedAt: Date.now(),
      };
      if (onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }
      setSelectedPreviewUrl(newUrl);
      setSaveSuccessMessage(
        isVideo
          ? '✓ Video added to gallery & saved in Firebase!'
          : '✓ Extra angle photo added & saved in Firebase!'
      );
      setShowVideoUrlModal(false);
      setVideoUrlInput('');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to add angle media:', err);
      setSaveSuccessMessage(`Upload failed: ${err.message || 'Please try again.'}`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } finally {
      setIsSaving(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
      if (galleryVideoInputRef.current) {
        galleryVideoInputRef.current.value = '';
      }
    }
  };

  const handleAddAdditionalPhotoDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !product) return;
    for (let i = 0; i < files.length; i++) {
      await handleAddAngleMedia(files[i]);
    }
  };

  const handleRemoveAdditionalPhotoDirect = async (urlToRemove: string) => {
    if (!product) return;
    try {
      const currentAdditional = getProductGalleryMedia(product);
      const updatedList = await removeProductGalleryImageApi(product.id, urlToRemove, currentAdditional);
      const videoList = updatedList.filter((u) => isVideoMedia(u));
      const updatedProduct: BedsheetProduct = {
        ...product,
        additionalImages: updatedList,
        videos: videoList,
        videoUrl: videoList[0] || '',
        updatedAt: Date.now(),
      };
      if (onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }
      if (selectedPreviewUrl === urlToRemove) {
        setSelectedPreviewUrl(null);
      }
      setSaveSuccessMessage('Media removed from gallery.');
      setTimeout(() => setSaveSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Failed to remove angle media:', err);
    }
  };

  const isOutOfStock = !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0);
  const maxQty = product.stockQuantity && product.stockQuantity > 0 ? product.stockQuantity : 10;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity, activeVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWhatsApp = () => {
    sendWhatsAppProductOrder({
      productName: product.name,
      variantName: activeVariant?.name,
      dimensions: product.dimensions,
      quantity,
      price: product.price,
      imageUrl: displayImage,
    });
  };

  const origPrice = Number(product.originalPrice) || 0;
  const currPrice = Number(product.price) || 0;
  const rawDiscount = origPrice > currPrice && origPrice > 0
    ? Math.round(((origPrice - currPrice) / origPrice) * 100)
    : 0;
  const discountPercent = Number.isFinite(rawDiscount) && !isNaN(rawDiscount) ? Math.max(0, rawDiscount) : 0;
  const savingsAmount = origPrice > currPrice ? origPrice - currPrice : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2420]/50 backdrop-blur-sm"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.85 }}
        className="relative liquid-glass-modal w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl z-10 text-[var(--color-text,#2C2420)]"
      >
        
        {/* Owner Edit Bar or Unlock Prompt */}
        {isOwnerMode ? (
          <div className="bg-[#2C2420]/90 backdrop-blur-md text-white px-5 py-3 rounded-t-3xl flex items-center justify-between gap-3 text-xs border-b border-[#DEC89B]/30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-[#EAE2D5]">Store Owner Mode</span>
              <span className="text-[#A8988D] hidden sm:inline">· Firebase Firestore Direct Edit</span>
            </div>
            <div className="flex items-center gap-3">
              {saveSuccessMessage && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                  <Check className="w-3.5 h-3.5" />
                  {saveSuccessMessage}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditing
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'liquid-glass-primary-btn text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Details & Photo'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md border-b border-white/75 px-5 py-2.5 flex items-center justify-between text-xs rounded-t-3xl">
            <span className="text-[11px] font-medium text-[#7A6458] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#C29E57]" />
              <span>Cotton Nest Atelier · Sector 46 Gurgaon · 100% Pure Combed Cotton</span>
            </span>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-3.5 right-4 z-20 p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full liquid-glass-badge transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 p-6 sm:p-8">
          
          {/* Left Column: Big Product Photography & Features */}
          <div className="space-y-4">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#EAE2D5] bg-[#F4EFE6]">
              {isVideoMedia(displayImage) ? (
                <div className="w-full h-full relative bg-black flex items-center justify-center">
                  <video
                    key={displayImage}
                    src={displayImage}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                  <span className="absolute top-3 left-3 bg-[#8C2E46]/95 text-white backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border border-[#E6C687]/40 shadow-xs pointer-events-none">
                    <Film className="w-3.5 h-3.5 text-[#E6C687]" />
                    <span>Product Video Reel</span>
                  </span>
                </div>
              ) : (
                <div
                  className="w-full h-full relative cursor-zoom-in group/img overflow-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(0);
                    setIsLightboxOpen(true);
                  }}
                  title="Click to enlarge photo"
                >
                  <img
                    src={displayImage}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    onError={handleImageFallback}
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/img:scale-105"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(0);
                      setIsLightboxOpen(true);
                    }}
                    className="absolute bottom-3 right-3 z-20 bg-black/75 hover:bg-black/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/40 flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 cursor-pointer active:scale-95"
                  >
                    <Maximize2 className="w-4 h-4 text-[#E6C687]" />
                    <span>Enlarge Photo</span>
                  </button>
                </div>
              )}
              {product.badge && (
                <span className="absolute top-3 left-3 bg-[#FAF7F2]/95 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-semibold text-[#8C2E46] border border-[#FAD1DC]">
                  {product.badge}
                </span>
              )}

              {/* Custom Photo / Video Stored Badge */}
              {isVideoMedia(displayImage) ? (
                <span className="absolute top-3 right-3 bg-purple-900/90 text-white backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-bold border border-purple-400/40 shadow-xs flex items-center gap-1">
                  <Play className="w-3 h-3 text-[#E6C687] fill-[#E6C687]" />
                  <span>Cloudinary Video</span>
                </span>
              ) : (
                (isCloudinaryUrl(displayImage) || !!customImage || (typeof product.image === 'string' && !product.image.includes('exact_sheet') && !product.image.startsWith('/images/exact_'))) && (
                  <span className="absolute top-3 right-3 bg-emerald-800/90 text-white backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-500/40 shadow-xs flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-300" />
                    <span>Custom Atelier Photo</span>
                  </span>
                )
              )}

              {/* Replace image button inside modal - only visible to store owners */}
              {isOwnerMode && (
                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUploadDirect}
                    accept="image/*"
                    className="hidden"
                  />
                  {isCloudinaryUrl(displayImage) && (
                    <span className="px-2 py-1 bg-emerald-900/80 backdrop-blur-xs text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 shadow-xs">
                      <Cloud className="w-3 h-3 text-emerald-300" />
                      <span>Cloudinary</span>
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-[#FAF7F2]/95 hover:bg-white text-[#2C2420] text-xs font-semibold rounded-lg border border-[#DEC89B] shadow-xs backdrop-blur-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-[#C29E57]" />
                        <span>Replace Image</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Multi-Photo & Video Gallery Thumbnail Row & Add Angle Button */}
            <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Photos &amp; Video Angles</span>
                </span>
                {isOwnerMode && (
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Firebase &amp; Cloudinary Synced
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {/* 1. Main Cover Image Thumbnail */}
                <button
                  type="button"
                  onClick={() => setSelectedPreviewUrl(null)}
                  className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    !selectedPreviewUrl
                      ? 'border-[#8C2E46] ring-2 ring-[#8C2E46]/20'
                      : 'border-[#EAE2D5] opacity-70 hover:opacity-100'
                  }`}
                  title="Main Cover Photo"
                >
                  {isVideoMedia(product.image) ? (
                    <video
                      src={product.image}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={resolveBedsheetImage(product.image, product.id)}
                      alt="Cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => handleImageFallback(e, product.id)}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-[#2C2420]/75 text-white text-[8px] font-bold text-center py-0.5">
                    Cover
                  </span>
                </button>

                {/* 2. Additional Gallery Angle Photos & Videos */}
                {getProductGalleryMedia(product).map((imgUrl, idx) => {
                  const isSelected = selectedPreviewUrl === imgUrl;
                  const isVideo = isVideoMedia(imgUrl);
                  return (
                    <div key={idx} className="relative w-14 h-14 shrink-0 group/thumb">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewUrl(imgUrl)}
                        className={`w-full h-full rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative bg-zinc-900 ${
                          isSelected
                            ? 'border-[#8C2E46] ring-2 ring-[#8C2E46]/20'
                            : 'border-[#EAE2D5] opacity-80 hover:opacity-100'
                        }`}
                        title={isVideo ? `Video Angle #${idx + 1}` : `Photo Angle #${idx + 1}`}
                      >
                        {isVideo ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-white relative">
                            <video src={imgUrl} className="w-full h-full object-cover opacity-80 pointer-events-none" muted playsInline />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="w-4 h-4 text-[#E6C687] fill-[#E6C687]" />
                            </div>
                            <span className="absolute bottom-0 inset-x-0 bg-black/90 text-[7px] text-[#E6C687] text-center font-bold tracking-tight">
                              VIDEO
                            </span>
                          </div>
                        ) : (
                          <img
                            src={resolveBedsheetImage(imgUrl, product.id)}
                            alt={`Angle ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>

                      {isOwnerMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAdditionalPhotoDirect(imgUrl);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer z-10"
                          title="Delete this angle"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 3. Owner Action: Add Extra Angle Photo, Video, or URL Buttons */}
                {isOwnerMode && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="file"
                      multiple
                      ref={galleryFileInputRef}
                      onChange={handleAddAdditionalPhotoDirect}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    <input
                      type="file"
                      multiple
                      ref={galleryVideoInputRef}
                      onChange={handleAddAdditionalPhotoDirect}
                      accept="video/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => galleryFileInputRef.current?.click()}
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-[#C29E57] bg-[#FAF7F2] hover:bg-white text-[#8C2E46] flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                      title="Upload extra photo angle (JPG, PNG, WebP)"
                    >
                      <Plus className="w-4 h-4 text-[#C29E57]" />
                      <span className="text-[9px] font-bold">+ Photo</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => galleryVideoInputRef.current?.click()}
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-[#8C2E46]/60 bg-[#FDEAF0]/60 hover:bg-white text-[#8C2E46] flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                      title="Upload product video file (MP4, WebM, MOV)"
                    >
                      <Video className="w-4 h-4 text-[#8C2E46]" />
                      <span className="text-[9px] font-bold">+ Video</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setShowVideoUrlModal(!showVideoUrlModal)}
                      className="h-14 px-2.5 rounded-xl border border-[#DEC89B] bg-[#FAF7F2] hover:bg-white text-[#7A6458] hover:text-[#8C2E46] flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer text-[9px] font-semibold"
                      title="Add video or photo by URL link"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>+ Link</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Inline URL add panel */}
              {isOwnerMode && showVideoUrlModal && (
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] space-y-2 mt-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#2C2420]">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Add Angle via Video / Image Link</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVideoUrlModal(false)}
                      className="text-[#7A6458] hover:text-[#2C2420]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Paste MP4, WebM, or Cloudinary video link..."
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-[#DEC89B] rounded-lg text-xs text-[#2C2420] focus:outline-hidden focus:ring-1 focus:ring-[#8C2E46]"
                    />
                    <button
                      type="button"
                      disabled={!videoUrlInput.trim() || isSaving}
                      onClick={() => {
                        if (videoUrlInput.trim()) {
                          handleAddAngleMedia(videoUrlInput.trim());
                        }
                      }}
                      className="px-3 py-1.5 bg-[#8C2E46] hover:bg-[#A33452] text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-[10px] text-[#7A6458]">
                    Supports Cloudinary video URLs, direct .mp4, .webm, or image links. Saved directly to Firebase.
                  </p>
                </div>
              )}
            </div>

            {/* Micro highlights */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Dimension</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">
                  {product.dimensions ? (product.dimensions.includes('(') ? product.dimensions.split('(')[0].trim() : product.dimensions) : '108 x 108 in'}
                </p>
              </div>
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Thread Count</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">{product.threadCount || '300 TC'}</p>
              </div>
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Material</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">100% Cotton</p>
              </div>
            </div>

            {/* Store Availability Callout (Hidden when Blank / 'none' is selected) */}
            {normalizeAvailabilityType(product.availabilityType, product.inStock) === 'out_of_stock' || isOutOfStock ? (
              <div className="p-3.5 bg-amber-950/10 rounded-xl border border-amber-300 flex items-center gap-3 text-xs text-amber-900 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-amber-200/60 flex items-center justify-center shrink-0 text-sm">
                  🚫
                </div>
                <div>
                  <p className="font-bold text-amber-950">Out of Stock</p>
                  <p className="text-[11px] text-amber-900">This item is currently sold out. You can click "Notify Me" to get informed when it is available again.</p>
                </div>
              </div>
            ) : normalizeAvailabilityType(product.availabilityType) === 'atelier_touch' ? (
              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] flex items-center gap-3 text-xs text-[#8C2E46] shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-[#8C2E46]/10 text-[#8C2E46] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[#C29E57]" />
                </div>
                <div>
                  <p className="font-bold text-[#8C2E46]">Available for Touch &amp; Feel in Sector 46 Atelier</p>
                  <p className="text-[11px] text-[#6B5D55]">Visit our atelier store in Sector 46 Gurgaon to feel the pure cotton fabric before buying.</p>
                </div>
              </div>
            ) : normalizeAvailabilityType(product.availabilityType) === 'on_order' ? (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 text-xs text-amber-900 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-sm">
                  🧵
                </div>
                <div>
                  <p className="font-bold text-amber-900">On Order Basis</p>
                  <p className="text-[11px] text-amber-800">Handcrafted to order at our atelier. Custom finished &amp; delivered in 3-5 business days.</p>
                </div>
              </div>
            ) : null}

            {/* Return / Exchange Reassurance under photo */}
            <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] flex items-center justify-between text-xs text-[#2C2420]">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#8C2E46] shrink-0" />
                <span><strong>Exchange Policy:</strong> Mfg defects only (48 hrs)</span>
              </div>
              {onViewTermsAndConditions && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewTermsAndConditions();
                  }}
                  className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer"
                >
                  T&amp;C Policy →
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Contiguous Purchase Module OR Owner Edit Form */}
          <div className="flex flex-col justify-between space-y-5">
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#EAE2D5]">
                  <span className="font-serif-luxury text-xl font-bold text-[#2C2420] flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#8C2E46]" />
                    Edit Bedsheet Details
                  </span>
                  <span className="text-[10px] bg-[#FAF7F2] text-[#8C2E46] border border-[#FAD1DC] px-2 py-0.5 rounded font-semibold">
                    Firebase Live
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Bedsheet Name / Title
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Bedsheet Name"
                    className="w-full px-3 py-2 bg-white border border-[#DEC89B] rounded-xl text-sm font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                  />
                </div>

                {/* Pricing: Selling Price & MRP */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#DEC89B] rounded-xl text-sm font-bold text-[#8C2E46] focus:outline-hidden focus:border-[#8C2E46]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      MRP / Original (₹)
                    </label>
                    <input
                      type="number"
                      value={editOriginalPrice}
                      onChange={(e) => setEditOriginalPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-sm text-[#7A6458] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                </div>

                {/* Dimensions & Thread Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Dimensions
                    </label>
                    <input
                      type="text"
                      value={editDimensions}
                      onChange={(e) => setEditDimensions(e.target.value)}
                      placeholder="108 x 108 inches"
                      className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Thread Count
                    </label>
                    <input
                      type="text"
                      value={editThreadCount}
                      onChange={(e) => setEditThreadCount(e.target.value)}
                      placeholder="350 Thread Count"
                      className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                </div>

                {/* Fabric Material & Pillow Covers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Fabric Material
                    </label>
                    <input
                      type="text"
                      value={editFabric}
                      onChange={(e) => setEditFabric(e.target.value)}
                      placeholder="100% Pure Percale Cotton"
                      className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Pillow Covers
                    </label>
                    <input
                      type="text"
                      value={editPillowCovers}
                      onChange={(e) => setEditPillowCovers(e.target.value)}
                      placeholder="2 Pillow Covers (45x70 cm)"
                      className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                </div>

                {/* Category (Product Type), Size & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Category / Type
                    </label>
                    <select
                      value={editProductType}
                      onChange={(e) => setEditProductType(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#DEC89B] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    >
                      {STANDARD_PRODUCT_TYPES.filter((t) => t !== 'Other').map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {!STANDARD_PRODUCT_TYPES.includes(editProductType as any) && (
                        <option value={editProductType}>{editProductType}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Size
                    </label>
                    <select
                      value={editSize}
                      onChange={(e) => setEditSize(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#DEC89B] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    >
                      {STANDARD_SIZES.filter((s) => s !== 'Other').map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      {!STANDARD_SIZES.includes(editSize as any) && (
                        <option value={editSize}>{editSize}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Store Availability Option
                    </label>
                    <select
                      value={editAvailabilityType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditAvailabilityType(val);
                        if (val === 'out_of_stock') {
                          setEditInStock(false);
                          setEditStockQuantity(0);
                        } else if (editAvailabilityType === 'out_of_stock' || !editInStock) {
                          setEditInStock(true);
                          if (editStockQuantity === 0) setEditStockQuantity(10);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#DEC89B] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    >
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                      Badge / Highlight Tag
                    </label>
                    <input
                      type="text"
                      value={editBadge}
                      onChange={(e) => setEditBadge(e.target.value)}
                      placeholder="e.g. Best Seller"
                      className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>
                </div>

                {/* In Stock Toggle & Stock Qty */}
                <div className="grid grid-cols-2 gap-3 items-center bg-[#F4EFE6]/60 p-3 rounded-xl border border-[#EAE2D5]">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#2C2420]">
                    <input
                      type="checkbox"
                      checked={editInStock}
                      onChange={(e) => setEditInStock(e.target.checked)}
                      className="w-4 h-4 text-[#8C2E46] rounded accent-[#8C2E46]"
                    />
                    <span>Available / In Stock</span>
                  </label>
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-0.5">
                      Units in Stock
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editStockQuantity}
                      onChange={(e) => setEditStockQuantity(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                </div>

                {/* Photo & Video Upload prompt inside edit panel */}
                <div className="bg-white p-3.5 rounded-xl border border-[#DEC89B] space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-[#8C2E46]" />
                      Bedsheet Photos &amp; Videos
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-lg hover:bg-[#F4EFE6] cursor-pointer flex items-center gap-1"
                      >
                        <ImageIcon className="w-3 h-3 text-[#C29E57]" />
                        <span>Replace Cover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryFileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-lg hover:bg-[#F4EFE6] cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-[#C29E57]" />
                        <span>+ Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryVideoInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC] rounded-lg hover:bg-[#F9D3DE] cursor-pointer flex items-center gap-1"
                      >
                        <Video className="w-3 h-3 text-[#8C2E46]" />
                        <span>+ Add Video</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowVideoUrlModal(true)}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#FAF7F2] text-[#8C2E46] border border-[#DEC89B] rounded-lg hover:bg-white cursor-pointer flex items-center gap-1"
                      >
                        <LinkIcon className="w-3 h-3 text-[#8C2E46]" />
                        <span>+ Video Link</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#7A6458]">
                    Upload high-res photos or MP4/WebM/MOV fabric drape videos, or paste a video link. Synced across Cloudinary &amp; Firebase Firestore.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveToFirebase}
                    className="flex-1 py-3 px-4 bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Saving to Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-white" />
                        <span>Save to Firebase Firestore</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-3 px-4 bg-white hover:bg-[#F4EFE6] text-[#6B5D55] text-xs font-medium rounded-xl border border-[#EAE2D5] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
              {/* Category & Collection */}
              <div className="flex items-center flex-wrap gap-2 text-xs font-semibold tracking-wider uppercase text-[#A8823B]">
                <span>{product.collection}</span>
                <span>·</span>
                <span className={isOutOfStock ? "text-amber-800" : "text-[#3E7D5A]"}>
                  {isOutOfStock ? "Out of Stock" : "In Stock"}
                </span>
                {normalizeAvailabilityType(product.availabilityType, product.inStock) === 'out_of_stock' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case tracking-normal bg-[#2C2420] text-amber-300 border border-amber-400/40">
                    <span>🚫 Out of Stock</span>
                  </span>
                )}
                {normalizeAvailabilityType(product.availabilityType) === 'atelier_touch' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case tracking-normal bg-[#FAF7F2] text-[#8C2E46] border border-[#DEC89B]">
                    <Sparkles className="w-2.5 h-2.5 text-[#C29E57]" />
                    <span>Available at Sec 46 Atelier</span>
                  </span>
                )}
                {normalizeAvailabilityType(product.availabilityType) === 'on_order' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case tracking-normal bg-amber-50 text-amber-900 border border-amber-200">
                    <span>🧵 On Order Basis</span>
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="font-serif-luxury text-2xl sm:text-3xl font-semibold text-[#2C2420] leading-snug">
                {product.name}
              </h2>

              {/* Customer Rating & Review Counter */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex items-center text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(productRating.average)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[#DCD0C0]'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-xs text-[#2C2420]">{productRating.average}</span>
                <span className="text-[11px] text-[#7A6458]">
                  ({productRating.count} verified reviews)
                </span>
                {onOpenWriteReview && (
                  <button
                    type="button"
                    onClick={() => onOpenWriteReview(product.id)}
                    className="ml-auto text-xs text-[#8C2E46] hover:underline font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>Write Review ✍️</span>
                  </button>
                )}
              </div>

              {/* Price & Savings */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold text-[#2C2420] tabular-nums">
                    ₹{currPrice.toLocaleString('en-IN')}
                  </span>
                  {origPrice > currPrice && (
                    <span className="text-sm text-[#9B8C83] line-through tabular-nums">
                      ₹{origPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
                      Save {discountPercent}% (₹{savingsAmount.toLocaleString('en-IN')})
                    </span>
                  )}
                </div>

                {/* Eligible Offer Teaser */}
                {activeCoupons.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#DEC89B] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1 rounded-md bg-[#70252D]/10 text-[#70252D] shrink-0">
                        <Tag className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 truncate sm:whitespace-normal">
                        <span className="font-semibold text-[#2C2420]">
                          {activeCoupons[0].discountType === 'percentage'
                            ? `Save ${activeCoupons[0].discountValue}%`
                            : `Save ₹${activeCoupons[0].discountValue}`}:
                        </span>{' '}
                        <span className="text-[#6B5D55]">
                          Use code <strong className="font-mono text-[#70252D] font-bold">{activeCoupons[0].code}</strong>
                          {activeCoupons[0].minOrderValue > 0 && ` (orders > ₹${activeCoupons[0].minOrderValue})`}
                        </span>
                      </div>
                    </div>
                    {!activeCoupons[0].isAutomatic && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeCoupons[0].code);
                          setCopiedCouponCode(activeCoupons[0].code);
                          setTimeout(() => setCopiedCouponCode(null), 2500);
                        }}
                        className="px-2 py-1 rounded bg-white hover:bg-stone-50 border border-[#DEC89B] text-[11px] font-bold text-[#70252D] cursor-pointer flex items-center gap-1 transition-colors ml-2 shrink-0"
                      >
                        {copiedCouponCode === activeCoupons[0].code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#A8823B]" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Color Variants Selector */}
                {product.variants && product.variants.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#2C2420]">Select Shade / Color:</span>
                      <span className="font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded text-[11px]">
                        {activeVariant ? activeVariant.name : 'Choose a color'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(selectedVariantId === v.id ? null : v.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            activeVariant?.id === v.id
                              ? 'border-[#8C2E46] bg-[#FDEAF0] text-[#8C2E46] shadow-xs ring-1 ring-[#8C2E46]'
                              : 'border-[#EAE2D5] bg-white text-[#6B5D55] hover:border-[#DEC89B]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shrink-0"
                            style={{ backgroundColor: v.colorHex || '#C29E57' }}
                          />
                          <span>{v.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity Selector & Live Availability */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[#7A6458]">Quantity:</span>
                    <div className="inline-flex items-center rounded-xl border border-[#EAE2D5] bg-[#FAF7F2]">
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-1.5 text-sm text-[#2C2420] hover:bg-[#F4EFE6] rounded-l-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="px-4 py-1.5 text-sm font-semibold text-[#2C2420] tabular-nums">
                        {isOutOfStock ? 0 : quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isOutOfStock || quantity >= maxQty}
                        onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                        className="px-3 py-1.5 text-sm text-[#2C2420] hover:bg-[#F4EFE6] rounded-r-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-xs">
                    {isOutOfStock ? (
                      <span className="font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                        Temporarily Out of Stock
                      </span>
                    ) : (
                      <span className="text-[#3E7D5A] font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-[#3E7D5A]" />
                        <span>In Stock ({product.stockQuantity ?? 10} units in atelier)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Contiguous Primary Purchase CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {isOutOfStock ? (
                    <button
                      type="button"
                      onClick={() => onNotifyStock?.(product)}
                      className="w-full py-3.5 px-4 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 bg-amber-50/90 backdrop-blur-md text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer shadow-xs"
                      title="Subscribe to restock alerts"
                    >
                      <Bell className="w-4 h-4 text-amber-600" />
                      <span>Notify Me When In Stock</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className={`w-full py-3.5 px-4 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        added
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'liquid-glass-primary-btn text-white'
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Added to Bag!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>Add to Bag · ₹{(product.price * quantity).toLocaleString('en-IN')}</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="w-full py-3.5 px-4 liquid-glass-badge text-[#2C2420] rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>{isOutOfStock ? 'Waitlist on WhatsApp' : 'Enquire on WhatsApp'}</span>
                  </button>
                </div>

                {/* Compare Option */}
                {onToggleCompare && (
                  <button
                    type="button"
                    onClick={() => onToggleCompare(product)}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isCompared
                        ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs'
                        : 'bg-white border-[#EAE2D5] text-[#6B5D55] hover:text-[#2C2420] hover:border-[#DEC89B]'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                    <span>{isCompared ? '✓ Added to Comparison (View Compare)' : 'Compare with other bedsheets'}</span>
                  </button>
                )}

                {/* Quiet Guarantees Bar */}
                <div className="flex items-center justify-between text-[11px] text-[#7A6458] pt-1 px-1 border-b border-[#EAE2D5] pb-3">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#C29E57]" /> Direct Atelier Dispatch
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C29E57]" /> 100% Genuine Cotton
                  </span>
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-[#8C2E46]" /> 48h Defect Exchange
                  </span>
                </div>

                {/* Editorial Description */}
                <p className="text-sm text-[#6B5D55] leading-relaxed pt-1">
                  {product.description}
                </p>

                {/* Shipping & Delivery Notice */}
                <div className="flex items-start gap-2 p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] text-xs text-[#6B5D55]">
                  <Truck className="w-4 h-4 text-[#B83F60] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#2C2420]">Delivery &amp; Shipping: </span>
                    <span>Free hand delivery across Sector 46 Gurgaon. Rest of Gurgaon on actuals or atelier pickup. Across India: flat ₹{shippingFee && shippingFee !== 100 ? shippingFee : 29} dispatch.</span>
                  </div>
                </div>

                {/* Return & Exchange Policy Summary */}
                <div className="p-3 bg-[#FDEAF0]/40 rounded-xl border border-[#FAD1DC] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#8C2E46] flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Exchange Policy (48 Hours)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFullPolicy(!showFullPolicy)}
                      className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer"
                    >
                      {showFullPolicy ? 'Hide Details' : 'View Terms'}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5A4D45] leading-relaxed">
                    Exchanges honored for genuine manufacturing defects reported within 48 hours of delivery with unboxing photo/video. Product must be unused and unwashed.
                  </p>
                  {showFullPolicy && (
                    <div className="pt-2 border-t border-[#FAD1DC] space-y-1 text-[11px] text-[#4A3E38]">
                      <p>• <strong>Condition:</strong> Must remain unused, unwashed with original packaging tags.</p>
                      <p>• <strong>Lighting Note:</strong> Slight tone variances due to natural photography lighting are not defects.</p>
                      <p>• <strong>Resolution:</strong> Replaced with same/equivalent piece or store credit valid 60 days. No cash refunds.</p>
                      {onViewTermsAndConditions && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onViewTermsAndConditions();
                          }}
                          className="pt-1 text-[11px] font-semibold text-[#8C2E46] hover:underline block"
                        >
                          Read Full Terms &amp; Conditions Policy →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Specifications List */}
                <div className="space-y-1.5 pt-2 border-t border-[#EAE2D5]">
                  <p className="text-xs font-semibold uppercase text-[#7A6458] tracking-wider">
                    Specifications &amp; Care
                  </p>
                  <ul className="space-y-1 text-xs text-[#4A3E38]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3E7D5A] shrink-0" />
                      <span><strong>Bedsheet Size:</strong> {product.dimensions}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3E7D5A] shrink-0" />
                      <span><strong>Pillow Shams:</strong> {product.pillowCovers} with flap tuck</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3E7D5A] shrink-0" />
                      <span><strong>Fabric:</strong> {product.fabric} (Zero Synthetic Fibers)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Verified Customer Reviews for this Bedsheet */}
              <div className="space-y-2.5 pt-3 border-t border-[#EAE2D5]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    Customer Reviews ({productRating.reviews.length})
                  </span>
                  {onOpenWriteReview && (
                    <button
                      type="button"
                      onClick={() => onOpenWriteReview(product.id)}
                      className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer"
                    >
                      + Write Review
                    </button>
                  )}
                </div>

                {productRating.reviews.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {productRating.reviews.slice(0, 3).map((rev) => (
                      <div key={rev.id} className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-[#DCD0C0]'}`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-[#3E7D5A] font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> Verified Buyer
                          </span>
                        </div>
                        <p className="font-semibold text-[#2C2420] text-[11px]">"{rev.title}"</p>
                        <p className="text-[#6B5D55] text-[11px] leading-relaxed line-clamp-2">{rev.comment}</p>
                        <div className="text-[10px] text-[#9B8C83] pt-0.5 flex items-center justify-between">
                          <span>{rev.customerName} · {rev.customerCity}</span>
                          <span>{new Date(rev.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] text-xs text-center text-[#7A6458]">
                    <p>Be the first verified customer to review this bedsheet!</p>
                    {onOpenWriteReview && (
                      <button
                        type="button"
                        onClick={() => onOpenWriteReview(product.id)}
                        className="mt-1.5 px-3 py-1 bg-[#8C2E46] text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Share Your Feedback
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Smart Product Recommendations: "You May Also Like" */}
              {allProducts && allProducts.length > 0 && (
                <div className="pt-3 border-t border-[#EAE2D5]">
                  <ProductRecommendations
                    currentProduct={product}
                    allProducts={allProducts}
                    onSelectProduct={(p) => {
                      if (onSelectProduct) {
                        onSelectProduct(p);
                      }
                    }}
                    onAddToCart={(p) => {
                      onAddToCart(p, 1);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}

          </div>

        </div>

      </motion.div>

      {/* Image Lightbox Fullscreen Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        images={lightboxPhotos}
        initialIndex={lightboxIndex}
        title={product.name}
        onClose={() => setIsLightboxOpen(false)}
      />
    </motion.div>
  );
};
