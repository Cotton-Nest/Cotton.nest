import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Eye, MessageCircle, Check, Truck, RotateCcw, Star, ArrowLeftRight, Bell, Heart, Sparkles, Play, Video, Film } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { ProductReview, getProductRatingSummary } from '../data/reviews';
import { isCloudinaryUrl, isVideoMedia, getProductMediaCounts } from '../services/cloudinary';

export type ProductCardViewMode = 'single' | 'tile' | 'list';

interface ProductCardProps {
  product: BedsheetProduct;
  onQuickView: (product: BedsheetProduct, editMode?: boolean) => void;
  onAddToCart: (product: BedsheetProduct, variant?: BedsheetVariant) => void;
  isAdded?: boolean;
  customImage?: string;
  onUploadImage?: (productId: string, dataUrl: string) => void;
  isOwnerMode?: boolean;
  onOpenOwnerAuth?: () => void;
  reviews?: ProductReview[];
  onToggleCompare?: (product: BedsheetProduct) => void;
  isCompared?: boolean;
  onNotifyStock?: (product: BedsheetProduct) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: BedsheetProduct, variant?: BedsheetVariant) => void;
  viewMode?: ProductCardViewMode;
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onQuickView,
  onAddToCart,
  isAdded = false,
  customImage,
  onUploadImage,
  isOwnerMode = false,
  onOpenOwnerAuth,
  reviews = [],
  onToggleCompare,
  isCompared = false,
  onNotifyStock,
  isWishlisted = false,
  onToggleWishlist,
  viewMode = 'single',
  priority = false,
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const ratingSummary = getProductRatingSummary(product.id, reviews);

  React.useEffect(() => {
    setSelectedVariantId(null);
  }, [product.id, product.image, customImage]);

  const activeVariant = selectedVariantId
    ? product.variants?.find((v) => v.id === selectedVariantId)
    : undefined;

  const rawImage = activeVariant?.image || product.image || customImage;
  const displayImage = resolveBedsheetImage(rawImage, product.id, product.updatedAt);
  const isDisplayVideo = isVideoMedia(displayImage);
  const mediaCounts = getProductMediaCounts(product);

  const handleImageLoad = React.useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadImage) {
      onUploadImage(product.id, file as any);
    }
  };

  const handleWhatsAppEnquiry = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendWhatsAppProductOrder({
      productName: product.name,
      variantName: activeVariant?.name,
      dimensions: product.dimensions,
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

  const isOutOfStock = !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0);
  const isLowStock = !isOutOfStock && product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 3;

  return (
    <motion.article
      onClick={() => onQuickView(product)}
      initial={false}
      whileHover={{
        scale: 1.018,
        y: -5,
        boxShadow: '0 26px 52px -12px rgba(44, 36, 32, 0.16), 0 10px 26px -6px rgba(194, 158, 87, 0.18)',
      }}
      whileTap={{ scale: 0.992 }}
      transition={{ type: 'spring', stiffness: 340, damping: 25, mass: 0.7 }}
      className={`group relative liquid-glass-product-card rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer p-1.5 sm:p-2 ${
        viewMode === 'list' ? 'flex flex-col sm:flex-row gap-2' : 'flex flex-col'
      } ${
        viewMode === 'single' ? 'sm:rounded-3xl' : ''
      } ${
        isOutOfStock ? 'opacity-85' : ''
      }`}
    >
      {/* Top-left diagonal Apple Liquid Glass specular reflection */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-56 h-56 rounded-full bg-white/35 blur-2xl z-0" />

      {/* Ambient liquid glass sheen sweep across card on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none z-20" />

      {/* Product Image / Video Slot in Recessed Glass Bezel */}
      <div
        className={`relative bg-[#F4EFE6]/70 overflow-hidden shrink-0 rounded-xl sm:rounded-2xl border border-white/80 shadow-inner ${
          viewMode === 'list'
            ? 'w-full sm:w-72 md:w-80 aspect-[4/3] sm:aspect-auto sm:min-h-[240px]'
            : viewMode === 'single'
            ? 'aspect-[4/3] sm:aspect-[16/10]'
            : 'aspect-[4/3]'
        }`}
      >
        {/* Soft Liquid Glass Shimmer Placeholder Skeleton */}
        {!imageLoaded && !isDisplayVideo && (
          <div className="absolute inset-0 bg-gradient-to-tr from-[#F4EFE6] via-[#FAF7F2] to-[#EAE2D5] flex items-center justify-center overflow-hidden z-0">
            <div className="absolute inset-0 animate-liquid-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            <div className="relative flex flex-col items-center gap-1.5 opacity-55">
              <div className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-md border border-white/80 flex items-center justify-center shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#C29E57]" />
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#8C7A70]">Cotton Nest</span>
            </div>
          </div>
        )}

        {/* Liquid top specular reflection */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/40 to-transparent pointer-events-none z-10" />

        {isDisplayVideo ? (
          <video
            src={displayImage}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="w-full h-full object-cover object-center relative z-[1]"
          />
        ) : (
          <img
            ref={(el) => {
              imgRef.current = el;
              if (el && el.complete && el.naturalWidth > 0 && !imageLoaded) {
                setImageLoaded(true);
              }
            }}
            src={displayImage}
            alt={product.name}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleImageLoad}
            onError={(e) => {
              setImageLoaded(true);
              handleImageFallback(e, product.id);
            }}
            className={`w-full h-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-108 relative z-[1] ${
              imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-90 blur-[1px] scale-[1.01]'
            }`}
          />
        )}

        {/* Video Reel Available Indicator Pill (Bottom Left) */}
        {mediaCounts.hasVideo && (
          <div className="absolute bottom-3 left-3 z-10 bg-[#2C2420]/80 backdrop-blur-md text-[#E6C687] px-2.5 py-1 rounded-xl text-[10px] font-bold border border-[#E6C687]/40 shadow-xs flex items-center gap-1 pointer-events-none">
            <Play className="w-3 h-3 fill-[#E6C687] text-[#E6C687]" />
            <span>{mediaCounts.videoCount > 1 ? `${mediaCounts.videoCount} Videos` : 'Video'}</span>
          </div>
        )}

        {/* Wishlist Heart Button (Top Left) - Liquid Glass Bubble */}
        {onToggleWishlist && (
          <motion.button
            whileHover={{ scale: 1.14, y: -2 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product, activeVariant);
            }}
            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            className={`absolute top-2.5 left-2.5 z-10 p-2 rounded-2xl border backdrop-blur-xl transition-all shadow-[0_4px_16px_rgba(44,36,32,0.08)] cursor-pointer ${
              isWishlisted
                ? 'bg-rose-500/90 text-white border-rose-300/60 shadow-rose-500/25'
                : 'liquid-glass-badge text-[#7A6458] hover:text-rose-600 hover:border-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 transition-transform duration-300 ${isWishlisted ? 'fill-white text-white scale-110' : ''}`} />
          </motion.button>
        )}

        {/* Status Badges - Liquid Glass Pills */}
        {isOutOfStock ? (
          <div className="absolute top-2.5 left-12 z-10 bg-[#2C2420]/85 backdrop-blur-md px-3 py-1 rounded-xl text-[11px] font-medium text-amber-300 border border-amber-400/35 shadow-xs">
            Sold Out
          </div>
        ) : product.badge ? (
          <div className="absolute top-2.5 left-12 z-10 liquid-glass-badge px-3 py-1 rounded-xl text-[11px] font-semibold text-[#8C2E46] border-white/90 shadow-xs">
            {product.badge}
          </div>
        ) : (isOwnerMode && (!!customImage || (typeof product.image === 'string' && (isCloudinaryUrl(product.image) || (!product.image.includes('exact_sheet') && !product.image.startsWith('/images/exact_')))))) ? (
          <div className="absolute top-2.5 left-12 z-10 liquid-glass-badge text-[#2E6B4A] px-2.5 py-1 rounded-xl text-[10px] font-semibold border-white/90 shadow-2xs flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-[#2E6B4A]" />
            <span>Updated Photo</span>
          </div>
        ) : null}

        {/* Owner Quick Controls: Discreet Frosted Top-Right Controls */}
        {isOwnerMode && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product, true);
              }}
              title="Edit Bedsheet Details & Photo"
              className="p-1.5 liquid-glass-badge hover:bg-white text-[#8C2E46] rounded-xl border border-[#FAD1DC] shadow-xs text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>✏️ Edit</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Upload custom photo or video"
              className="p-1.5 liquid-glass-badge hover:bg-white text-[#6B5D55] hover:text-[#B83F60] rounded-xl border border-[#EAE2D5] shadow-xs text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>📷 Photo / Video</span>
            </button>
          </div>
        )}

        {/* Quick Action Overlay on Hover with Liquid Glass Pill */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="px-4 py-2 liquid-glass-dock text-[#2C2420] text-xs font-semibold rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.18)] flex items-center gap-2 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#C29E57]" />
            <span>Quick View</span>
          </motion.button>
        </div>
      </div>

      {/* Card Content & Metadata - Translucent Liquid Glass Information Deck */}
      <div
        className={`relative z-10 flex-1 flex flex-col justify-between ${
          viewMode === 'list'
            ? 'p-3.5 sm:p-5 space-y-3'
            : viewMode === 'single'
            ? 'p-3.5 sm:p-5 space-y-3.5'
            : 'p-2.5 sm:p-3.5 space-y-2.5'
        }`}
      >
        <div>
          {/* Collection & Fabric specs */}
          <div className="flex items-center justify-between text-xs text-[#7A6458] mb-1.5 font-medium tracking-wide">
            <span className="uppercase text-[10px] sm:text-[11px] text-[var(--color-accent,#A8823B)] font-bold truncate max-w-[140px] sm:max-w-none">
              {product.collection || 'Signature Cotton'}
            </span>
            <span className="text-[10px] sm:text-[11px] text-[#6B5D55] shrink-0 px-2 py-0.5 rounded-full bg-white/45 border border-white/75 backdrop-blur-xs">
              {product.threadCount || '300 TC'} · {product.dimensions ? (product.dimensions.includes('(') ? product.dimensions.split('(')[0].trim() : product.dimensions) : '108 x 108 in'}
            </span>
          </div>

          {/* Product Title */}
          <h3
            className={`font-serif-luxury font-semibold tracking-tight text-[var(--color-text,#2C2420)] group-hover:text-[var(--color-primary,#70252D)] transition-colors line-clamp-1 ${
              viewMode === 'single'
                ? 'text-xl sm:text-2xl'
                : viewMode === 'list'
                ? 'text-lg sm:text-xl'
                : 'text-base sm:text-lg'
            }`}
          >
            {product.name}
          </h3>

          {/* Customer Reviews Rating */}
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <div className="flex items-center text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <span className="font-semibold text-xs text-[#2C2420]">{ratingSummary.average}</span>
            <span className="text-[11px] text-[#7A6458]">({ratingSummary.count} verified reviews)</span>
          </div>

          {/* Color Variants Swatches */}
          {product.variants && product.variants.length > 0 && (
            <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] text-[#7A6458] uppercase font-semibold shrink-0">
                {activeVariant ? activeVariant.name : `${product.variants.length} Colors`}:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    title={v.name}
                    onClick={() => setSelectedVariantId(selectedVariantId === v.id ? null : v.id)}
                    className={`w-4 h-4 rounded-full border p-0.5 transition-transform cursor-pointer ${
                      activeVariant?.id === v.id
                        ? 'scale-125 border-[#8C2E46] ring-1 ring-[#8C2E46]'
                        : 'border-white/90 shadow-2xs hover:scale-110'
                    }`}
                  >
                    <span
                      className="w-full h-full rounded-full block"
                      style={{ backgroundColor: v.colorHex || '#C29E57' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clean Description */}
          <p
            className={`text-[#5E5048] mt-1.5 leading-relaxed font-normal ${
              viewMode === 'single'
                ? 'text-xs sm:text-sm line-clamp-2 sm:line-clamp-3'
                : viewMode === 'list'
                ? 'text-xs line-clamp-2'
                : 'text-[11px] sm:text-xs line-clamp-2'
            }`}
          >
            {product.description}
          </p>
        </div>

        {/* Pricing & Value Summary */}
        <div className="pt-2 border-t border-white/60 space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span
                className={`font-bold text-[#2C2420] tabular-nums tracking-tight ${
                  viewMode === 'single' ? 'text-2xl sm:text-3xl' : 'text-xl'
                }`}
              >
                ₹{currPrice.toLocaleString('en-IN')}
              </span>
              {origPrice > currPrice && (
                <span className="text-xs text-[#8C7A70] line-through tabular-nums">
                  ₹{origPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {discountPercent > 0 && (
              <span className="text-[11px] font-bold text-[#8C2E46] liquid-glass-badge px-2 py-0.5 rounded-lg border-white/80">
                Save {discountPercent}%
              </span>
            )}
          </div>

          {/* Clean Editorial Delivery & Exchange Strip (Liquid Glass Capsule) */}
          <div className="flex items-center justify-between text-[11px] text-[#6B5D55] py-1.5 px-2.5 rounded-xl liquid-glass-badge">
            <span className="text-[#2E6B4A] font-semibold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#2E6B4A]" />
              <span>Free Sec 46 Delivery</span>
            </span>
            <span
              className="text-[#8C2E46] font-semibold hover:underline cursor-pointer flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
            >
              <span>48h Defect Exchange</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className={`pt-1 grid gap-2 ${viewMode === 'list' ? 'grid-cols-2 max-w-sm' : 'grid-cols-2'}`}>
          {/* Add to Bag or Out of Stock Notify */}
          {isOutOfStock ? (
            <motion.button
              whileHover={{ scale: 1.02, y: -1.5 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onNotifyStock) {
                  onNotifyStock(product);
                }
              }}
              className="py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 bg-amber-50/80 text-amber-800 border border-amber-300 hover:bg-amber-100/90 transition-all cursor-pointer shadow-2xs backdrop-blur-md"
              title="Get notified when this bedsheet is back in stock"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Notify Me</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02, y: -1.5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product, activeVariant);
              }}
              className={`py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative overflow-hidden ${
                isAdded
                  ? 'bg-emerald-700/90 backdrop-blur-md text-white border border-white/40 shadow-sm'
                  : 'liquid-glass-primary-btn text-white'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added to Bag</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to Bag</span>
                </>
              )}
            </motion.button>
          )}

          {/* WhatsApp Direct Inquiry */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1.5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            type="button"
            onClick={handleWhatsAppEnquiry}
            className="py-2.5 px-2.5 text-xs font-semibold text-[#2C2420] liquid-glass-badge hover:bg-white/80 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Enquire on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{isOutOfStock ? 'Join Waitlist' : 'Enquire on WhatsApp'}</span>
          </motion.button>
        </div>

      </div>
    </motion.article>
  );
};
