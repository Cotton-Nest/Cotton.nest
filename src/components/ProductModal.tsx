import React from 'react';
import { X, Check, MessageCircle, ShoppingBag, ShieldCheck, Truck, RotateCcw, MapPin, Sparkles, Edit3, Save, ImageIcon, Cloud, Loader2, Star, ThumbsUp, Upload } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { saveProductDetailsToFirestore } from '../services/firebaseStore';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from '../services/cloudinary';
import { ProductReview, getProductRatingSummary } from '../data/reviews';

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
}) => {
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  React.useEffect(() => {
    setSelectedVariantId(null);
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

  const rawImage = activeVariant?.image || product.image || customImage;
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
        badge: editBadge.trim() || undefined,
        inStock: editInStock,
        stockQuantity: Number(editStockQuantity),
        updatedAt: Date.now(),
      };

      await saveProductDetailsToFirestore(product.id, updatedData);

      const mergedProduct: BedsheetProduct = {
        ...product,
        ...updatedData,
      };

      if (onUpdateProduct) {
        onUpdateProduct(mergedProduct);
      }

      setSaveSuccessMessage('Saved to Firebase Firestore!');
      setTimeout(() => {
        setSaveSuccessMessage(null);
        setIsEditing(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to save product details:', err);
      alert('Failed to save to Firebase. Please try again.');
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

      // 2. Save image and public_id to Firestore (preserving name, price, variants, etc.)
      await saveProductDetailsToFirestore(product.id, {
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
      alert(`Image Replacement Failed:\n${err.message || err}\n\nPrevious image has been kept unchanged.`);
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-bold text-[#2C2420] tabular-nums">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-[#9B8C83] line-through tabular-nums">
                    ₹{product.originalPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-[#B83F60] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
                    Save {discountPercent}% (₹{(product.originalPrice - product.price).toLocaleString('en-IN')})
                  </span>
                </div>

                {/* Shipping Extra Notice */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 px-3 py-2 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] text-xs text-[#6B5D55]">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Truck className="w-3.5 h-3.5 text-[#B83F60] shrink-0" />
                    <span className="font-semibold text-[#2C2420]">+ Shipping Extra:</span>
                  </div>
                  <span className="text-[11px] sm:text-xs">
                    Free delivery only in Sec 46 Gurgaon · Rest of Gurgaon: Self pickup or on actuals · Across India: ₹100
                  </span>
                </div>

                {/* Return & Exchange Policy Card */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FDEAF0]/50 border border-[#FAD1DC] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#8C2E46] uppercase tracking-wider">
                      <RotateCcw className="w-4 h-4 text-[#8C2E46] shrink-0" />
                      <span>Return &amp; Exchange Policy</span>
                    </div>
                    {onViewTermsAndConditions && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewTermsAndConditions();
                        }}
                        className="text-[11px] font-semibold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span>Full T&amp;C</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-[#3C322C] leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="text-[#8C2E46] font-bold text-sm leading-none mt-0.5">•</span>
                      <p>
                        <strong className="text-[#2C2420]">Manufacturing Defects Only:</strong> Exchange is applicable only for genuine manufacturing defects reported within <strong>48 hours of delivery</strong> with clear unboxing photos/videos.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#8C2E46] font-bold text-sm leading-none mt-0.5">•</span>
                      <p>
                        <strong className="text-[#2C2420]">Condition:</strong> Must be unused, unwashed &amp; in original packaging.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#8C2E46] font-bold text-sm leading-none mt-0.5">•</span>
                      <p>
                        <strong className="text-[#2C2420]">Colour &amp; Lighting:</strong> Slight colour variations due to natural lighting/photography are not defects. Original vs catalogue photos provided wherever possible.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#8C2E46] font-bold text-sm leading-none mt-0.5">•</span>
                      <p>
                        <strong className="text-[#2C2420]">Resolution:</strong> Exchanged with same/equivalent product. Store credit valid for 2 months provided if unavailable. No cash refunds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Variants Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#EAE2D5]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#2C2420]">Choose Color / Style:</span>
                    <span className="font-bold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded text-[11px]">
                      {activeVariant ? activeVariant.name : 'Select a color'}
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

              {/* Editorial Description */}
              <p className="text-sm text-[#6B5D55] leading-relaxed">
                {product.description}
              </p>

              {/* Key Bullet Features */}
              <div className="space-y-2 pt-2 border-t border-[#EAE2D5]">
                <p className="text-xs font-semibold uppercase text-[#7A6458] tracking-wider">
                  Product Specifications
                </p>
                <ul className="space-y-1.5 text-xs text-[#4A3E38]">
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
                    <span><strong>Fabric:</strong> {product.fabric} (Zero Polyester)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#3E7D5A] shrink-0" />
                    <span><strong>Care:</strong> Machine wash cold, gentle cycle, tumble dry low</span>
                  </li>
                </ul>
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

              {/* Quantity Selector & Stock Info */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#7A6458]">Quantity:</span>
                  <div className="inline-flex items-center rounded-lg border border-[#EAE2D5] bg-[#FAF7F2]">
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 text-sm text-[#2C2420] hover:bg-[#F4EFE6] rounded-l-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="px-4 py-1 text-sm font-semibold text-[#2C2420] tabular-nums">
                      {isOutOfStock ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock || quantity >= maxQty}
                      onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                      className="px-3 py-1 text-sm text-[#2C2420] hover:bg-[#F4EFE6] rounded-r-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-xs">
                  {isOutOfStock ? (
                    <span className="font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Temporarily Out of Stock
                    </span>
                  ) : (
                    <span className="text-[#3E7D5A] font-medium">
                      ✓ In Stock ({product.stockQuantity ?? 10} units available)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-4 border-t border-[#EAE2D5]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isOutOfStock ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-[#EAE2D5] text-[#8C7A70] cursor-not-allowed"
                  >
                    Sold Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      added
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] shadow-sm'
                    }`}
                  >
                    {added ? (
                      <>
                        <Check className="w-4 h-4" />
                        Added to Bag!
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        Add to Bag · ₹{(product.price * quantity).toLocaleString('en-IN')}
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="w-full py-3 px-4 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  {isOutOfStock ? 'Waitlist on WhatsApp' : 'Order on WhatsApp'}
                </button>
              </div>

              {/* Guarantees */}
              <div className="flex items-center justify-between text-[11px] text-[#7A6458] pt-2 px-1">
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
            </div>
          </>
        )}

          </div>

        </div>

      </div>
    </div>
  );
};
