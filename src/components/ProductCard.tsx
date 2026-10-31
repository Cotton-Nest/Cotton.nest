import React, { useState } from 'react';
import { ShoppingBag, Eye, MessageCircle, Check, Truck, RotateCcw, Star, ArrowLeftRight, Bell, Heart, ZoomIn, Sparkles } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { ProductReview, getProductRatingSummary } from '../data/reviews';
import { isCloudinaryUrl } from '../services/cloudinary';
import { FabricInspectorModal } from './FabricInspectorModal';

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
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isHoverZooming, setIsHoverZooming] = useState<boolean>(false);
  const [hoverZoomPos, setHoverZoomPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isFabricModalOpen, setIsFabricModalOpen] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const ratingSummary = getProductRatingSummary(product.id, reviews);

  React.useEffect(() => {
    setSelectedVariantId(null);
  }, [product.id, product.image, customImage]);

  const activeVariant = selectedVariantId
    ? product.variants?.find((v) => v.id === selectedVariantId)
    : undefined;

  const rawImage = activeVariant?.image || product.image || customImage;
  const displayImage = resolveBedsheetImage(rawImage, product.id, product.updatedAt);

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

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  const isOutOfStock = !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0);
  const isLowStock = !isOutOfStock && product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 3;

  return (
    <>
    <article
      onClick={() => onQuickView(product)}
      className={`group bg-[var(--color-surface,#FFFFFF)] rounded-2xl border overflow-hidden hover:border-[var(--color-accent,#C29E57)]/60 hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer ${
        isOutOfStock ? 'opacity-75 border-amber-200' : 'border-[var(--color-border,#EAE2D5)]'
      }`}
    >
      {/* Product Image Slot with Fabric Weave Hover Zoom */}
      <div
        className="relative aspect-[4/3] bg-[#F4EFE6] overflow-hidden"
        onMouseEnter={() => setIsHoverZooming(true)}
        onMouseLeave={() => setIsHoverZooming(false)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
          setHoverZoomPos({ x, y });
        }}
      >
        <img
          src={displayImage}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={(e) => {
            handleImageFallback(e, product.id);
          }}
          className="w-full h-full object-cover object-center will-change-transform"
          style={{
            transformOrigin: isHoverZooming ? `${hoverZoomPos.x}% ${hoverZoomPos.y}%` : 'center center',
            transform: isHoverZooming ? 'scale(2.25)' : 'scale(1)',
            transition: isHoverZooming ? 'transform 0.12s ease-out' : 'transform 0.4s ease-out',
          }}
        />

        {/* Micro reticle when hovering to inspect fabric weave */}
        {isHoverZooming && (
          <div
            className="absolute pointer-events-none w-14 h-14 rounded-full border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.4)] backdrop-brightness-110"
            style={{
              left: `${hoverZoomPos.x}%`,
              top: `${hoverZoomPos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Wishlist Heart Button (Top Left) */}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product, activeVariant);
            }}
            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            className={`absolute top-3 left-3 z-10 p-2 rounded-xl border backdrop-blur-md transition-all shadow-xs cursor-pointer ${
              isWishlisted
                ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm scale-105'
                : 'bg-[#FAF7F2]/90 hover:bg-white text-[#7A6458] hover:text-rose-600 border-[#EAE2D5]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        )}

        {/* Quiet Single Status Badge (Moved slightly to right of wishlist button) */}
        {isOutOfStock ? (
          <div className="absolute top-3 left-12 bg-[#2C2420]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 border border-amber-400/30 shadow-xs">
            Sold Out
          </div>
        ) : product.badge ? (
          <div className="absolute top-3 left-12 bg-[#FAF7F2]/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#8C2E46] border border-[#FAD1DC] shadow-xs">
            {product.badge}
          </div>
        ) : (!!customImage || (typeof product.image === 'string' && (isCloudinaryUrl(product.image) || (!product.image.includes('exact_sheet') && !product.image.startsWith('/images/exact_'))))) ? (
          <div className="absolute top-3 left-12 bg-[#FAF7F2]/95 backdrop-blur-xs text-[#2E6B4A] px-2 py-0.5 rounded text-[10px] font-semibold border border-[#BDE0CE] shadow-2xs flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-[#2E6B4A]" />
            <span>Updated Photo</span>
          </div>
        ) : null}

        {/* Click-to-Zoom Fabric Weave Pill (Top Right, accessible anytime) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsFabricModalOpen(true);
          }}
          title="Inspect fabric weave & thread texture in detail"
          className={`absolute z-10 p-1.5 rounded-lg border text-[11px] font-semibold transition-all backdrop-blur-md flex items-center gap-1 cursor-pointer ${
            isOwnerMode ? 'top-12 right-3' : 'top-3 right-3'
          } bg-[#FAF7F2]/90 hover:bg-white text-[#2C2420] hover:text-[var(--color-primary,#70252D)] border-[#EAE2D5] shadow-xs`}
        >
          <ZoomIn className="w-3.5 h-3.5 text-[#C29E57]" />
          <span className="hidden sm:inline">Zoom Fabric</span>
        </button>

        {/* Owner Quick Controls: Discreet Frosted Top-Right Controls */}
        {isOwnerMode && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product, true);
              }}
              title="Edit Bedsheet Details & Photo"
              className="p-1.5 bg-[#FAF7F2]/90 hover:bg-white text-[#8C2E46] rounded-lg border border-[#FAD1DC] shadow-xs text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <span>✏️ Edit</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Upload custom photo"
              className="p-1.5 bg-[#FAF7F2]/90 hover:bg-white text-[#6B5D55] hover:text-[#B83F60] rounded-lg border border-[#EAE2D5] shadow-xs text-[10px] flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <span>📷 Photo</span>
            </button>
          </div>
        )}

        {/* Quick Action Overlay on Hover */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFabricModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#FAF7F2]/95 hover:bg-white text-[#2C2420] text-xs font-semibold rounded-lg shadow-sm backdrop-blur-sm flex items-center gap-1.5 transition-transform"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#C29E57]" />
            <span>Inspect Fabric</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="px-3 py-1.5 bg-[#FAF7F2]/95 hover:bg-white text-[#2C2420] text-xs font-semibold rounded-lg shadow-sm backdrop-blur-sm flex items-center gap-1.5 transition-transform"
          >
            <Eye className="w-3.5 h-3.5 text-[#C29E57]" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Card Content & Metadata */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        
        <div>
          {/* Collection & Fabric specs */}
          <div className="flex items-center justify-between text-xs text-[#7A6458] mb-1.5 font-medium tracking-wide">
            <span className="uppercase text-[11px] text-[var(--color-accent,#C29E57)] font-semibold">
              {product.collection || 'Signature Cotton'}
            </span>
            <span className="text-[11px] text-[#8C7A70]">
              {product.threadCount} · {product.dimensions.includes('(') ? product.dimensions.split('(')[0].trim() : product.dimensions}
            </span>
          </div>

          {/* Product Title */}
          <h3 className="font-serif-luxury text-xl font-medium tracking-tight text-[var(--color-text,#2C2420)] line-clamp-1 group-hover:text-[var(--color-primary,#70252D)] transition-colors">
            {product.name}
          </h3>

          {/* Customer Reviews Rating */}
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <div className="flex items-center text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <span className="font-semibold text-xs text-[#2C2420]">{ratingSummary.average}</span>
            <span className="text-[11px] text-[#8C7A70]">({ratingSummary.count} verified reviews)</span>
          </div>

          {/* Color Variants Swatches */}
          {product.variants && product.variants.length > 0 && (
            <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] text-[#8C7A70] uppercase font-semibold">
                {activeVariant ? activeVariant.name : `${product.variants.length} Colors`}:
              </span>
              <div className="flex items-center gap-1.5">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    title={v.name}
                    onClick={() => setSelectedVariantId(selectedVariantId === v.id ? null : v.id)}
                    className={`w-4 h-4 rounded-full border p-0.5 transition-transform cursor-pointer ${
                      activeVariant?.id === v.id
                        ? 'scale-125 border-[#8C2E46] ring-1 ring-[#8C2E46]'
                        : 'border-[#DEC89B] hover:scale-110'
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
          <p className="text-xs text-[#6B5D55] line-clamp-2 mt-1.5 leading-relaxed font-normal">
            {product.description}
          </p>
        </div>

        {/* Pricing & Value Summary */}
        <div className="pt-2 border-t border-[#EAE2D5]/70 space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#2C2420] tabular-nums tracking-tight">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-[#9B8C83] line-through tabular-nums">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
              Save {discountPercent}%
            </span>
          </div>

          {/* Clean Editorial Delivery & Exchange Strip */}
          <div className="flex items-center justify-between text-[11px] text-[#7A6458] pt-0.5">
            <span className="text-[#3E7D5A] font-medium flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-[#3E7D5A]" />
              Free Sec 46 Gurgaon Delivery
            </span>
            <span className="text-[#8C2E46] font-medium hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onQuickView(product); }}>
              48h Defect Exchange
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-1 grid grid-cols-2 gap-2">
          {/* Add to Bag or Out of Stock Notify */}
          {isOutOfStock ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onNotifyStock) {
                  onNotifyStock(product);
                }
              }}
              className="py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
              title="Get notified when this bedsheet is back in stock"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Notify Me</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product, activeVariant);
              }}
              className={`py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isAdded
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] shadow-xs hover:shadow-sm'
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
            </button>
          )}

          {/* WhatsApp Direct Inquiry */}
          <button
            type="button"
            onClick={handleWhatsAppEnquiry}
            className="py-2.5 px-2.5 text-xs font-medium text-[#2C2420] bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Inquire directly on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{isOutOfStock ? 'Join Waitlist' : 'WhatsApp'}</span>
          </button>
        </div>

      </div>
    </article>

    {/* Fabric Weave Detail Modal */}
    <FabricInspectorModal
      isOpen={isFabricModalOpen}
      onClose={() => setIsFabricModalOpen(false)}
      product={product}
      activeVariant={activeVariant}
      customImage={customImage}
      isWishlisted={isWishlisted}
      onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(product, activeVariant) : undefined}
      onAddToCart={onAddToCart}
    />
    </>
  );
};
