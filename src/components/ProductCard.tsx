import React, { useState } from 'react';
import { ShoppingBag, Eye, MessageCircle, Check, Truck, RotateCcw, Star } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant, COMPANY_DETAILS } from '../data/products';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { ProductReview, getProductRatingSummary } from '../data/reviews';

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
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
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
    <article
      onClick={() => onQuickView(product)}
      className={`group bg-[#FAF7F2] rounded-2xl border overflow-hidden hover:border-[#C29E57]/60 hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer ${
        isOutOfStock ? 'opacity-75 border-amber-200' : 'border-[#EAE2D5]'
      }`}
    >
      {/* Product Image Slot */}
      <div className="relative aspect-[4/3] bg-[#F4EFE6] overflow-hidden">
        <img
          src={displayImage}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={(e) => {
            handleImageFallback(e, product.id);
          }}
          className="w-full h-full object-cover object-center transform group-hover:scale-104 transition-transform duration-500 ease-out"
        />

        {/* Subtle Badge */}
        {isOutOfStock ? (
          <div className="absolute top-3 left-3 bg-[#2C2420]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-bold text-amber-300 border border-amber-400/40 shadow-xs">
            Out of Stock
          </div>
        ) : product.badge ? (
          <div className="absolute top-3 left-3 bg-[#FAF7F2]/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#8C2E46] border border-[#FAD1DC] shadow-xs">
            {product.badge}
          </div>
        ) : null}

        {/* Owner Controls: Edit Details & Upload Photo */}
        {isOwnerMode && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product, true);
              }}
              title="Edit Bedsheet Details & Photo (Firebase)"
              className="p-1.5 bg-[#FAF7F2]/95 hover:bg-white text-[#8C2E46] rounded-lg border border-[#FAD1DC] shadow-xs text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
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
              title="Upload/Replace with your original photo from device (Firebase)"
              className="p-1.5 bg-[#FAF7F2]/90 hover:bg-white text-[#6B5D55] hover:text-[#B83F60] rounded-lg border border-[#EAE2D5] shadow-xs text-[10px] flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <span>📷 Photo</span>
            </button>
          </div>
        )}

        {/* Quick View Hover Action */}
        <div className="absolute inset-0 bg-[#2C2420]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="px-4 py-2 bg-[#FAF7F2]/95 hover:bg-[#FAF7F2] text-[#2C2420] text-xs font-semibold rounded-lg shadow-sm backdrop-blur-sm flex items-center gap-1.5 transition-transform transform translate-y-2 group-hover:translate-y-0"
          >
            <Eye className="w-3.5 h-3.5 text-[#C29E57]" />
            Quick Inspect
          </button>
        </div>

        {/* Return & Exchange Tag */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onQuickView(product);
          }}
          className="absolute bottom-2.5 left-2.5 bg-[#FAF7F2]/95 backdrop-blur-xs text-[#8C2E46] border border-[#FAD1DC] px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-2xs hover:bg-white cursor-pointer transition-colors"
          title="Click to view Return & Exchange Policy details"
        >
          <RotateCcw className="w-3 h-3 text-[#8C2E46]" />
          <span>48h Defect Exchange</span>
        </div>

        {/* Dynamic Dimensions Tag */}
        <div className="absolute bottom-2.5 right-2.5 bg-[#2C2420]/75 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-medium tracking-wide">
          {product.dimensions.includes('(') ? product.dimensions.split('(')[0].trim() : product.dimensions}
        </div>
      </div>

      {/* Card Content & Metadata */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        
        <div>
          {/* Collection & Fabric specs */}
          <div className="flex items-center justify-between text-xs text-[#7A6458] mb-1 font-medium">
            <span className="uppercase tracking-wider text-[11px] text-[#A8823B]">{product.collection}</span>
            <span>{product.threadCount}</span>
          </div>

          {/* Product Title */}
          <h3 className="font-serif-luxury text-lg sm:text-xl font-semibold text-[#2C2420] line-clamp-1 group-hover:text-[#B83F60] transition-colors">
            {product.name}
          </h3>

          {/* Customer Reviews Rating */}
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <div className="flex items-center text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <span className="font-bold text-xs text-[#2C2420]">{ratingSummary.average}</span>
            <span className="text-[11px] text-[#8C7A70]">({ratingSummary.count} verified reviews)</span>
          </div>

          {/* Color Variants Swatches */}
          {product.variants && product.variants.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-[#8C7A70] uppercase font-semibold">
                {activeVariant ? activeVariant.name : `${product.variants.length} Colors`}:
              </span>
              <div className="flex items-center gap-1">
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
          <p className="text-xs text-[#6B5D55] line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Specifications snippet & low stock indicator */}
        <div className="pt-2 border-t border-[#EAE2D5]/70 flex items-center justify-between text-[11px] text-[#7A6458]">
          <span>{product.pillowCovers || 'Includes 2 Pillow Covers'}</span>
          {isLowStock ? (
            <span className="text-amber-700 font-semibold animate-pulse">
              Only {product.stockQuantity} left!
            </span>
          ) : isOutOfStock ? (
            <span className="text-amber-800 font-medium">Restocking Soon</span>
          ) : (
            <span className="text-[#3E7D5A] font-medium">{product.fabric || '100% Pure Cotton'}</span>
          )}
        </div>

        {/* Pricing Row with Tabular Figures & Shipping Extra Option */}
        <div className="pt-1 space-y-1">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[#2C2420] tabular-nums">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-[#9B8C83] line-through tabular-nums">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#B83F60] bg-[#FDEAF0] px-1.5 py-0.5 rounded border border-[#FAD1DC]">
              Save {discountPercent}%
            </span>
          </div>

          {/* Shipping Extra Notice */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#7A6458]">
            <Truck className="w-3.5 h-3.5 text-[#B83F60] shrink-0" />
            <span className="font-semibold text-[#2C2420]">+ Shipping Extra</span>
            <span className="text-[10px] text-[#9B8C83]">(Free delivery only in Sec 46 Gurgaon · ₹100 Across India)</span>
          </div>

          {/* Return & Exchange Policy Tag */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="flex items-center justify-between text-[11px] text-[#7A6458] bg-[#F4EFE6]/70 hover:bg-[#FDEAF0]/80 px-2.5 py-1.5 rounded-lg border border-[#EAE2D5]/80 hover:border-[#FAD1DC] transition-colors cursor-pointer group/policy"
            title="Click to view detailed Return & Exchange policy for this bedsheet"
          >
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#8C2E46] shrink-0" />
              <span className="font-semibold text-[#8C2E46]">Exchange Policy:</span>
              <span className="text-[10px] text-[#5A4D45]">Mfg defects only · 48 hrs</span>
            </div>
            <span className="text-[10px] text-[#8C2E46] font-semibold group-hover/policy:underline">View Policy →</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          {/* Add to Bag or Out of Stock */}
          {isOutOfStock ? (
            <button
              type="button"
              disabled
              className="py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 bg-[#EAE2D5] text-[#8C7A70] cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product, activeVariant);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#B83F60] hover:bg-[#A33452] text-white shadow-xs'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Added
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Add to Bag
                </>
              )}
            </button>
          )}

          {/* WhatsApp Direct Inquiry */}
          <button
            type="button"
            onClick={handleWhatsAppEnquiry}
            className="py-2 px-2.5 text-xs font-medium text-[#2C2420] bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Inquire directly on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{isOutOfStock ? 'Waitlist' : 'Inquire'}</span>
          </button>
        </div>

      </div>
    </article>
  );
};
