import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, Package, Sparkles, Check, Info } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant } from '../data/products';
import { resolveBedsheetImage, handleImageFallback, isVideoMedia } from '../utils/imageUrl';
import { formatRupeeAmount } from '../data/welcomeOffer';

interface HangerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BedsheetProduct | null;
  quantity: number;
  selectedVariant?: BedsheetVariant;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
}

export const HangerDetailModal: React.FC<HangerDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  quantity,
  selectedVariant,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  if (!isOpen || !product) return null;

  const prodId = typeof product.id === 'string' ? product.id : '';
  const prodName = typeof product.name === 'string' && product.name.trim() !== '' ? product.name.trim() : 'Handcrafted Bedsheet';
  const prodType = product.productType || 'Bedsheet';
  const prodDimensions = product.dimensions || '108 x 108 inches (274 x 274 cm)';
  const prodFabric = product.fabric || '100% Pure Combed Cotton';
  const prodThreadCount = product.threadCount || '350 Thread Count';
  const prodPillowCovers = product.pillowCovers || '2 Matching Pillow Covers';
  const prodPattern = product.pattern || 'Signature Print';
  const prodColorTone = product.colorTone || 'Natural Linen Tone';
  const unitPrice = typeof product.price === 'number' && !isNaN(product.price) && product.price >= 0 ? product.price : 0;
  const lineTotal = unitPrice * quantity;

  const variantName = selectedVariant?.name?.trim() || null;
  const variantColorHex = selectedVariant?.colorHex && typeof selectedVariant.colorHex === 'string' && selectedVariant.colorHex.startsWith('#') ? selectedVariant.colorHex.trim() : null;
  const variantImage = selectedVariant?.image && typeof selectedVariant.image === 'string' && selectedVariant.image.trim() !== '' ? selectedVariant.image.trim() : null;

  const rawImg = variantImage || (typeof product.image === 'string' ? product.image : '');
  const displayImg = resolveBedsheetImage(rawImg, prodId);

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      onUpdateQuantity(prodId, quantity - 1);
    } else {
      onRemoveItem(prodId);
      onClose();
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateQuantity(prodId, quantity + 1);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveItem(prodId);
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-[#2C2420]/65 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hanger-modal-title"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF7F2] to-white border-2 border-[#DEC89B] shadow-2xl text-[#2C2420]"
        >
          {/* Top Gold Accent Bar */}
          <div className="h-2 w-full bg-gradient-to-r from-[#C29E57] via-[#8C2E46] to-[#C29E57]" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product hanger details"
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-[#FDEAF0] border border-[#EAE2D5] flex items-center justify-center text-[#6B5D55] hover:text-[#8C2E46] transition-colors cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5 sm:p-7 space-y-5">
            {/* Showroom Hanger Header Graphic */}
            <div className="flex flex-col items-center select-none pt-1">
              {/* Showroom Rod Bar */}
              <div className="relative w-full max-w-xs h-3 rounded-full bg-gradient-to-r from-[#C5A059] via-[#F3EBD7] to-[#A8823B] border border-[#A8823B]/60 shadow-sm flex items-center justify-between px-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#8C2E46] border border-white/60 shadow-xs" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#8C2E46] border border-white/60 shadow-xs" />
              </div>

              {/* Swivel Hook */}
              <div className="relative -mt-1 z-10">
                <svg className="w-7 h-9 text-[#C5A059]" viewBox="0 0 24 30" fill="none">
                  <path
                    d="M12 30V20M12 20C15.5 20 18 18 18 14.5C18 10.5 13.5 9.5 11.5 8C9.5 6.5 9.5 4 12 2.5C14.2 1.2 17 2.5 17 2.5"
                    stroke="url(#hangerModalGoldGrad)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="hangerModalGoldGrad" x1="0" y1="0" x2="24" y2="30" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#E6D5B3" />
                      <stop offset="0.5" stopColor="#C5A059" />
                      <stop offset="1" stopColor="#A8823B" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Wooden Hanger Shoulders */}
              <div className="relative w-full max-w-sm h-5 -mt-1 rounded-t-full bg-gradient-to-r from-[#D4C1A5] via-[#FFF9FB] to-[#C5A059] border-t-2 border-[#C5A059] shadow-xs flex items-center justify-between px-4">
                <div className="w-2 h-2 rounded-full bg-[#8C2E46]/80" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#7A6458]">
                  Cotton Nest Atelier Hanger
                </span>
                <div className="w-2 h-2 rounded-full bg-[#8C2E46]/80" />
              </div>
            </div>

            {/* Hanger Draped Bedsheet Image Frame */}
            <div className="relative mx-auto w-full max-w-sm rounded-2xl overflow-hidden border-2 border-[#DEC89B] bg-white shadow-lg group">
              {/* Brass Swatch Clips holding image */}
              <div className="absolute top-0 inset-x-6 z-10 flex justify-between pointer-events-none">
                <div className="w-3 h-4 bg-gradient-to-b from-[#C5A059] to-[#8C2E46] rounded-b-sm shadow-xs border border-white/60" />
                <div className="w-3 h-4 bg-gradient-to-b from-[#C5A059] to-[#8C2E46] rounded-b-sm shadow-xs border border-white/60" />
              </div>

              {/* Image Container */}
              <div className="relative aspect-4/3 w-full bg-[#F4EFE6] overflow-hidden flex items-center justify-center">
                {displayImg ? (
                  isVideoMedia(displayImg) ? (
                    <video
                      src={displayImg}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <img
                      src={displayImg}
                      alt={prodName}
                      onError={handleImageFallback}
                      className="w-full h-full object-cover object-center"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#8C7A70] p-4 text-center">
                    <Package className="w-8 h-8 opacity-40 mb-1" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Photo Unavailable</span>
                  </div>
                )}
                {/* Subtle Luxury Linen Texture Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2C2420]/30 via-transparent to-transparent opacity-60 pointer-events-none" />
                {/* Badge */}
                <div className="absolute bottom-2.5 left-2.5 bg-white/92 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#DEC89B] text-[10px] font-bold uppercase tracking-wider text-[#8C2E46] flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-[#C5A059]" />
                  <span>{prodType}</span>
                </div>
              </div>
            </div>

            {/* Product Specifications & Details */}
            <div className="space-y-3.5 text-left">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 id="hanger-modal-title" className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420] leading-snug">
                    {prodName}
                  </h2>
                  <span className="text-lg font-extrabold text-[#8C2E46] shrink-0 tabular-nums">
                    ₹{formatRupeeAmount(unitPrice)}
                  </span>
                </div>
                {variantName && (
                  <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-[#8C2E46]">
                    {variantColorHex && (
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 inline-block shadow-2xs"
                        style={{ backgroundColor: variantColorHex }}
                      />
                    )}
                    <span>Selected Color Variant: {variantName}</span>
                  </div>
                )}
              </div>

              {/* Grid Specifications Card */}
              <div className="bg-[#FAF7F2] rounded-2xl border border-[#DEC89B] p-3.5 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A6458] block">Size &amp; Dimensions</span>
                    <span className="font-semibold text-[#2C2420] block truncate">{prodDimensions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A6458] block">Fabric Quality</span>
                    <span className="font-semibold text-[#2C2420] block truncate">{prodFabric}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A6458] block">Thread Count</span>
                    <span className="font-semibold text-[#2C2420] block truncate">{prodThreadCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A6458] block">Pillow Covers</span>
                    <span className="font-semibold text-[#2C2420] block truncate">{prodPillowCovers}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EAE2D5] flex items-center justify-between text-[11px] text-[#6B5D55]">
                  <span>Pattern: <strong>{prodPattern}</strong></span>
                  <span>Tone: <strong>{prodColorTone}</strong></span>
                </div>
              </div>

              {/* Quantity Controls & Line Total */}
              <div className="bg-white rounded-2xl border border-[#EAE2D5] p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2C2420]">Quantity:</span>
                  <div className="flex items-center border border-[#DEC89B] rounded-xl bg-[#FAF7F2]">
                    <button
                      type="button"
                      onClick={handleDecrease}
                      className="p-2 text-xs font-bold text-[#2C2420] hover:bg-[#F4EFE6] rounded-l-xl transition-colors cursor-pointer"
                      title="Decrease quantity"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-[#2C2420] tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrease}
                      className="p-2 text-xs font-bold text-[#2C2420] hover:bg-[#F4EFE6] rounded-r-xl transition-colors cursor-pointer"
                      title="Increase quantity"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#7A6458] block font-semibold uppercase">Item Total</span>
                  <span className="text-base font-extrabold text-[#8C2E46] tabular-nums">
                    ₹{formatRupeeAmount(lineTotal)}
                  </span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Item</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                  Back to Bag
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
