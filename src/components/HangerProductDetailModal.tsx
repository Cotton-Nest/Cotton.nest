import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Package, Sparkles, ShoppingBag } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant } from '../data/products';
import { resolveBedsheetImage, handleImageFallback, isVideoMedia } from '../utils/imageUrl';

export interface HangerProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{
    product: BedsheetProduct;
    quantity: number;
    selectedVariant?: BedsheetVariant;
  }>;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
}

export const HangerProductDetailModal: React.FC<HangerProductDetailModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedIndex,
  onSelectIndex,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  if (!isOpen || items.length === 0) return null;

  const validIndex = Math.max(0, Math.min(items.length - 1, selectedIndex));
  const currentItem = items[validIndex];
  if (!currentItem) return null;

  const prod = currentItem.product;
  const prodId = typeof prod?.id === 'string' ? prod.id : '';
  const prodName = typeof prod?.name === 'string' && prod.name.trim() !== '' ? prod.name.trim() : 'Handcrafted Bedsheet';
  const prodCollection = typeof prod?.collection === 'string' ? prod.collection : 'Cotton Nest Atelier';
  const prodDimensions = typeof prod?.dimensions === 'string' && prod.dimensions.trim() !== '' ? prod.dimensions.trim() : '108 x 108 inches (274 x 274 cm)';
  const prodSize = typeof prod?.size === 'string' && prod.size.trim() !== '' ? prod.size.trim() : 'King (108 × 108)';
  const prodType = typeof prod?.productType === 'string' && prod.productType.trim() !== '' ? prod.productType.trim() : 'Bedsheet';
  const prodFabric = typeof prod?.fabric === 'string' ? prod.fabric : '100% Pure Combed Natural Cotton';
  const prodThreadCount = typeof prod?.threadCount === 'string' ? prod.threadCount : '350 Thread Count';
  const prodPillowCovers = typeof prod?.pillowCovers === 'string' ? prod.pillowCovers : '2 Matching Pillow Covers';
  const prodPattern = typeof prod?.pattern === 'string' ? prod.pattern : '';
  const prodColorTone = typeof prod?.colorTone === 'string' ? prod.colorTone : '';
  const itemPrice = typeof prod?.price === 'number' && !isNaN(prod.price) && prod.price >= 0 ? prod.price : 0;
  const originalPrice = typeof prod?.originalPrice === 'number' && prod.originalPrice > itemPrice ? prod.originalPrice : null;

  const variant = (
    currentItem.selectedVariant &&
    typeof currentItem.selectedVariant === 'object' &&
    typeof currentItem.selectedVariant.name === 'string' &&
    currentItem.selectedVariant.name.trim() !== ''
  ) ? currentItem.selectedVariant : undefined;

  const variantName = variant?.name?.trim() || null;
  const variantColorHex = (
    variant?.colorHex &&
    typeof variant.colorHex === 'string' &&
    variant.colorHex.trim().startsWith('#')
  ) ? variant.colorHex.trim() : null;
  const variantImage = (
    variant?.image &&
    typeof variant.image === 'string' &&
    variant.image.trim() !== ''
  ) ? variant.image.trim() : null;

  const rawImg = variantImage || (typeof prod?.image === 'string' ? prod.image : '');
  const displayImg = resolveBedsheetImage(rawImg, prodId);
  const qty = typeof currentItem.quantity === 'number' && !isNaN(currentItem.quantity) && currentItem.quantity > 0 ? Math.round(currentItem.quantity) : 1;
  const lineTotal = itemPrice * qty;

  const handlePrev = () => {
    if (items.length <= 1) return;
    onSelectIndex((validIndex - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    if (items.length <= 1) return;
    onSelectIndex((validIndex + 1) % items.length);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-[#2C2420]/75 backdrop-blur-sm select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hanger-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-[#FAF7F2] rounded-3xl border-2 border-[#DEC89B] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Wooden Hanger Bar & Brass Swivel Hook Visual Header */}
          <div className="relative bg-gradient-to-r from-[#D8B986] via-[#F3EBD7] to-[#D8B986] border-b border-[#C5A059] px-4 py-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              {/* Brass Hook Icon */}
              <div className="w-6 h-6 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#8C6D2D]">
                  <circle cx="12" cy="4" r="2" stroke="#8C6D2D" strokeWidth="1.8" />
                  <path d="M12 6 C12 8.5 16 9 16 12 C16 15 12 16 12 20" stroke="#8C6D2D" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5E1924] block">
                  SHOWROOM HANGER INSPECTION
                </span>
                <span className="text-[11px] font-serif-luxury font-bold text-[#2C2420]">
                  Hanger #{validIndex + 1} of {items.length} in Bag
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#5C4E46] hover:text-[#8C2E46] border border-[#DEC89B] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              aria-label="Close showroom details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Scrollable Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* Hanger Navigation Switcher (If multiple items in cart) */}
            {items.length > 1 && (
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-[#DEC89B]/80 text-xs text-[#5C4E46]">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-2.5 py-1 rounded-lg hover:bg-[#FAF7F2] text-[#8C2E46] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Hanger</span>
                </button>

                <span className="text-[11px] font-mono font-bold text-[#8C6D2D]">
                  {validIndex + 1} / {items.length}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-2.5 py-1 rounded-lg hover:bg-[#FAF7F2] text-[#8C2E46] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Next Hanger</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Product Layout: High-Res Original Photo + Full Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
              {/* Exact Original Bedsheet Photograph Displayed on Hanger Frame */}
              <div className="relative rounded-2xl overflow-hidden bg-white border-2 border-[#DEC89B] shadow-sm flex flex-col items-center">
                <div className="w-full bg-[#FAF7F2] border-b border-[#EAE2D5] px-3 py-1 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C6D2D]">
                    Authentic Cotton Nest Catalogue Design
                  </span>
                </div>

                <div className="relative w-full aspect-square bg-[#FAF6F0] overflow-hidden">
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
                        draggable={false}
                        className="w-full h-full object-cover object-center"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#8C7A70] p-4 text-center">
                      <Package className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-xs uppercase tracking-wider">No Photo</span>
                    </div>
                  )}

                  {/* Corner Badge */}
                  <div className="absolute bottom-2.5 left-2.5 bg-black/65 backdrop-blur-xs text-white text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md">
                    100% Cotton Weave
                  </div>
                </div>

                {/* Drape Foot Trim */}
                <div className="w-full bg-[#FAF7F2] px-3 py-1.5 border-t border-[#EAE2D5] flex items-center justify-between text-[10px] text-[#7A6458]">
                  <span>{prodSize}</span>
                  <span className="font-semibold text-[#8C2E46]">{prodFabric}</span>
                </div>
              </div>

              {/* Complete Specifications & Pricing Details */}
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF6F8] border border-[#F9D3DE] text-[10px] font-bold text-[#8C2E46] uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3 text-[#C5A059]" />
                    <span>{prodCollection}</span>
                  </div>

                  <h2 id="hanger-modal-title" className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420] leading-tight">
                    {prodName}
                  </h2>

                  <p className="text-xs text-[#7A6458] mt-1">
                    {prodDimensions}
                  </p>
                </div>

                {/* Selected Color Variant Info */}
                {variantName && (
                  <div className="p-2.5 rounded-xl bg-white border border-[#DEC89B] flex items-center justify-between text-xs">
                    <span className="text-[#6B5D55] font-medium">Selected Color:</span>
                    <div className="flex items-center gap-1.5 font-bold text-[#8C2E46]">
                      {variantColorHex && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: variantColorHex }}
                        />
                      )}
                      <span>{variantName}</span>
                    </div>
                  </div>
                )}

                {/* Technical Specifications Grid */}
                <div className="bg-white rounded-2xl border border-[#DEC89B]/80 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7A6458]">Product Type:</span>
                    <span className="font-semibold text-[#2C2420]">{prodType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#7A6458]">Thread Count:</span>
                    <span className="font-semibold text-[#2C2420]">{prodThreadCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#7A6458]">Includes:</span>
                    <span className="font-semibold text-[#2C2420]">{prodPillowCovers}</span>
                  </div>
                  {prodPattern ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[#7A6458]">Pattern Style:</span>
                      <span className="font-semibold text-[#2C2420]">{prodPattern}</span>
                    </div>
                  ) : null}
                  {prodColorTone ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[#7A6458]">Color Palette:</span>
                      <span className="font-semibold text-[#2C2420]">{prodColorTone}</span>
                    </div>
                  ) : null}
                </div>

                {/* Pricing & Quantity Stepper */}
                <div className="p-4 rounded-2xl bg-[#FFF9FB] border-2 border-[#F9D3DE] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#7A6458] block uppercase tracking-wider font-semibold">
                        Unit Price
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-[#2C2420]">
                          ₹{itemPrice.toLocaleString('en-IN')}
                        </span>
                        {originalPrice && (
                          <span className="text-xs text-[#8C7A70] line-through">
                            ₹{originalPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div>
                      <span className="text-[10px] text-[#7A6458] block uppercase tracking-wider font-semibold mb-1 text-right">
                        Quantity
                      </span>
                      <div className="flex items-center border border-[#DEC89B] rounded-xl bg-white shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(prodId, Math.max(1, qty - 1))}
                          className="px-3 py-1.5 text-sm text-[#2C2420] hover:bg-[#FAF7F2] font-bold cursor-pointer transition-colors"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="px-3 text-sm font-bold text-[#2C2420] tabular-nums min-w-[24px] text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(prodId, qty + 1)}
                          className="px-3 py-1.5 text-sm text-[#2C2420] hover:bg-[#FAF7F2] font-bold cursor-pointer transition-colors"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#FAD1DC] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#5C4E46]">
                      Line Total ({qty} {qty === 1 ? 'Bedsheet' : 'Bedsheets'}):
                    </span>
                    <span className="text-lg font-bold text-[#8C2E46] tabular-nums">
                      ₹{lineTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#EAE2D5]">
              <button
                type="button"
                onClick={() => {
                  onRemoveItem(prodId);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove From Bag</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Keep in Bag &amp; Return</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
