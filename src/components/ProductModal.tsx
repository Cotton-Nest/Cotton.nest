import React from 'react';
import { X, Check, MessageCircle, ShoppingBag, ShieldCheck, Truck, RotateCcw, MapPin, Sparkles, Edit3, Save, ImageIcon, Cloud, Loader2, Star, ThumbsUp, Upload, Plus, Trash2, Tag, Copy, ArrowLeftRight, Bell } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { updateSingleProduct, addProductGalleryImageApi, removeProductGalleryImageApi, getCouponsApi } from '../services/api';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from '../services/cloudinary';
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
}) => {
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryFileInputRef = React.useRef<HTMLInputElement>(null);

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
  const [editInStock, setEditInStock] = React.useState(true);
  const [editStockQuantity, setEditStockQuantity] = React.useState(10);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = React.useState<string | null>(null);
  const [showFullPolicy, setShowFullPolicy] = React.useState(false);
  const [activeCoupons, setActiveCoupons] = React.useState<CouponOffer[]>([]);
  const [copiedCouponCode, setCopiedCouponCode] = React.useState<string | null>(null);

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
      setEditInStock(product.inStock);
      setEditStockQuantity(product.stockQuantity ?? 10);
    }
  }, [product?.id, product?.image, customImage]);

  if (!product) return null;

  const activeVariant = selectedVariantId
    ? product.variants?.find((v) => v.id === selectedVariantId)
    : undefined;

  const rawImage = selectedPreviewUrl || activeVariant?.image || product.image || customImage;
  const displayImage = resolveBedsheetImage(rawImage, product.id, product.updatedAt);
  const productRating = product ? getProductRatingSummary(product.id, reviews) : { average: 4.9, count: 0, reviews: [] };

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

  const handleAddAdditionalPhotoDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    setIsSaving(true);
    setSaveSuccessMessage('Uploading extra angle photo to Cloudinary & Firebase...');
    try {
      const currentAdditional = product.additionalImages || [];
      const newUrl = await addProductGalleryImageApi(product.id, file, currentAdditional);
      const updatedList = [...currentAdditional, newUrl];
      const updatedProduct: BedsheetProduct = {
        ...product,
        additionalImages: updatedList,
        updatedAt: Date.now(),
      };
      if (onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }
      setSelectedPreviewUrl(newUrl);
      setSaveSuccessMessage('✓ Extra angle photo added & saved in Firebase!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to add angle photo:', err);
      setSaveSuccessMessage(`Upload failed: ${err.message || 'Please try again.'}`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } finally {
      setIsSaving(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAdditionalPhotoDirect = async (urlToRemove: string) => {
    if (!product) return;
    try {
      const currentAdditional = product.additionalImages || [];
      const updatedList = await removeProductGalleryImageApi(product.id, urlToRemove, currentAdditional);
      const updatedProduct: BedsheetProduct = {
        ...product,
        additionalImages: updatedList,
        updatedAt: Date.now(),
      };
      if (onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }
      if (selectedPreviewUrl === urlToRemove) {
        setSelectedPreviewUrl(null);
      }
      setSaveSuccessMessage('Photo angle removed.');
      setTimeout(() => setSaveSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Failed to remove angle photo:', err);
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

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[var(--color-surface,#FFFFFF)] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--color-border,#EAE2D5)] shadow-2xl z-10 text-[var(--color-text,#2C2420)]">
        
        {/* Owner Edit Bar or Unlock Prompt */}
        {isOwnerMode ? (
          <div className="bg-[#2C2420] text-white px-5 py-3 rounded-t-3xl flex items-center justify-between gap-3 text-xs border-b border-[#DEC89B]/30">
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
                    : 'bg-[#8C2E46] hover:bg-[#A33452] text-white shadow-xs'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Details & Photo'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FAF7F2] border-b border-[#EAE2D5] px-5 py-2.5 flex items-center justify-between text-xs rounded-t-3xl">
            <span className="text-[11px] font-medium text-[#7A6458] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#C29E57]" />
              <span>Cotton Nest Atelier · Sector 46 Gurgaon · 100% Pure Combed Cotton</span>
            </span>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full bg-white/80 backdrop-blur-xs border border-[#EAE2D5] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 p-6 sm:p-8">
          
          {/* Left Column: Big Product Photography & Features */}
          <div className="space-y-4">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#EAE2D5] bg-[#F4EFE6]">
              <img
                src={displayImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                onError={handleImageFallback}
                className="w-full h-full object-cover object-center"
              />
              {product.badge && (
                <span className="absolute top-3 left-3 bg-[#FAF7F2]/95 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-semibold text-[#8C2E46] border border-[#FAD1DC]">
                  {product.badge}
                </span>
              )}

              {/* Custom Photo Stored Badge */}
              {(isCloudinaryUrl(displayImage) || !!customImage || (typeof product.image === 'string' && !product.image.includes('exact_sheet') && !product.image.startsWith('/images/exact_'))) && (
                <span className="absolute top-3 right-3 bg-emerald-800/90 text-white backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-500/40 shadow-xs flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span>Custom Atelier Photo</span>
                </span>
              )}

              {/* Replace image button inside modal - only visible to store owners */}
              {isOwnerMode && (
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
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

            {/* Multi-Photo Gallery Thumbnail Row & Add Angle Button */}
            <div className="p-3 bg-white rounded-2xl border border-[#EAE2D5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Product Photos &amp; Angles</span>
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
                  <img
                    src={resolveBedsheetImage(product.image, product.id)}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-[#2C2420]/75 text-white text-[8px] font-bold text-center py-0.5">
                    Cover
                  </span>
                </button>

                {/* 2. Additional Gallery Angle Photos */}
                {(product.additionalImages || []).map((imgUrl, idx) => {
                  const isSelected = selectedPreviewUrl === imgUrl;
                  return (
                    <div key={idx} className="relative w-14 h-14 shrink-0 group/thumb">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewUrl(imgUrl)}
                        className={`w-full h-full rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#8C2E46] ring-2 ring-[#8C2E46]/20'
                            : 'border-[#EAE2D5] opacity-70 hover:opacity-100'
                        }`}
                        title={`Angle #${idx + 1}`}
                      >
                        <img
                          src={resolveBedsheetImage(imgUrl, product.id)}
                          alt={`Angle ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>

                      {isOwnerMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAdditionalPhotoDirect(imgUrl);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                          title="Delete this photo angle"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 3. Owner Action: Add Extra Angle Photo Button */}
                {isOwnerMode && (
                  <>
                    <input
                      type="file"
                      ref={galleryFileInputRef}
                      onChange={handleAddAdditionalPhotoDirect}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => galleryFileInputRef.current?.click()}
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-[#C29E57] bg-[#FAF7F2] hover:bg-white text-[#8C2E46] flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                      title="Add extra angle or detail photo"
                    >
                      <Plus className="w-4 h-4 text-[#C29E57]" />
                      <span className="text-[9px] font-bold">+ Angle</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Micro highlights */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Dimension</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">{product.dimensions.split('(')[0].trim()}</p>
              </div>
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Thread Count</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">{product.threadCount}</p>
              </div>
              <div className="p-2.5 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5]">
                <p className="text-[10px] text-[#7A6458] uppercase">Material</p>
                <p className="font-semibold text-[#2C2420] mt-0.5">100% Cotton</p>
              </div>
            </div>

            {/* Store Pickup Callout */}
            <div className="p-3 bg-[#FDEAF0]/60 rounded-xl border border-[#F9D3DE] flex items-center gap-2.5 text-xs text-[#8C2E46]">
              <MapPin className="w-4 h-4 text-[#B83F60] shrink-0" />
              <span>Available for touch &amp; feel at Sector 46 Gurgaon Atelier</span>
            </div>

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

                {/* Badge / Tag */}
                <div>
                  <label className="text-[10px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                    Badge / Highlight Tag
                  </label>
                  <input
                    type="text"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="e.g. Best Seller, 108x108 Pack"
                    className="w-full px-3 py-1.5 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
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

                {/* Photo Upload prompt inside edit panel */}
                <div className="bg-white p-3 rounded-xl border border-[#DEC89B] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#C29E57]" />
                      Bedsheet Photo
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-semibold bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC] rounded-lg hover:bg-[#F9D3DE] cursor-pointer"
                    >
                      Choose New Photo
                    </button>
                  </div>
                  <p className="text-[10px] text-[#7A6458]">
                    Photos are automatically compressed to ~70KB and stored directly in Firebase Firestore.
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
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#A8823B]">
                <span>{product.collection}</span>
                <span>·</span>
                <span className={isOutOfStock ? "text-amber-800" : "text-[#3E7D5A]"}>
                  {isOutOfStock ? "Out of Stock" : "In Stock"}
                </span>
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
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-[#2C2420] tabular-nums">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-[#9B8C83] line-through tabular-nums">
                    ₹{product.originalPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
                    Save {discountPercent}% (₹{(product.originalPrice - product.price).toLocaleString('en-IN')})
                  </span>
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
                      className="w-full py-3.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer shadow-xs"
                      title="Subscribe to restock alerts"
                    >
                      <Bell className="w-4 h-4 text-amber-600" />
                      <span>Notify Me When In Stock</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className={`w-full py-3.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        added
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] shadow-xs hover:shadow-md'
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
                    className="w-full py-3.5 px-4 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>{isOutOfStock ? 'Waitlist on WhatsApp' : 'Order on WhatsApp'}</span>
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
                    <span>Free hand delivery across Sector 46 Gurgaon. Rest of Gurgaon on actuals or atelier pickup. Across India: flat ₹100 dispatch.</span>
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

      </div>
    </div>
  );
};
