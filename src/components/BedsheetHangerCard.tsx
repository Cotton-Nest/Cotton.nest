import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, Plus, Minus, Info, Package, Sparkles } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant } from '../data/products';
import { resolveBedsheetImage, handleImageFallback, isVideoMedia } from '../utils/imageUrl';
import { formatRupeeAmount } from '../data/welcomeOffer';

interface BedsheetHangerCardProps {
  product: BedsheetProduct;
  quantity: number;
  selectedVariant?: BedsheetVariant;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onOpenDetails: (product: BedsheetProduct, quantity: number, variant?: BedsheetVariant) => void;
}

export const BedsheetHangerCard: React.FC<BedsheetHangerCardProps> = ({
  product,
  quantity,
  selectedVariant,
  onUpdateQuantity,
  onRemoveItem,
  onOpenDetails,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const prodId = typeof product.id === 'string' ? product.id : '';
  const prodName = typeof product.name === 'string' && product.name.trim() !== '' ? product.name.trim() : 'Handcrafted Bedsheet';
  const prodDimensions = product.dimensions || '108 x 108 inches';
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
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateQuantity(prodId, quantity + 1);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveItem(prodId);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDetails(product, quantity, selectedVariant);
  };

  return (
    <div className="relative w-full pb-1 select-none">
      {/* Showroom Rail Ring Connector */}
      <div className="flex justify-center -mb-1 relative z-10 pointer-events-none">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#C5A059] bg-[#F3EBD7] shadow-2xs" />
      </div>

      {/* Pendulum Interactive Hanger Card */}
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        animate={
          isHovered
            ? {
                rotate: [-1.2, 1.2, -0.6, 0.6, 0],
                transition: { duration: 0.6, ease: 'easeInOut' },
              }
            : { rotate: 0 }
        }
        style={{ transformOrigin: 'top center' }}
        className={`relative w-full rounded-2xl bg-white border transition-all duration-200 shadow-xs ${
          isHovered
            ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30 shadow-md'
            : 'border-[#EAE2D5] hover:border-[#C5A059]/70'
        }`}
      >
        {/* Top Metallic Swivel Hook Graphic */}
        <div className="flex flex-col items-center pt-1.5 px-2 select-none">
          <svg className="w-5 h-6 text-[#C5A059]" viewBox="0 0 24 28" fill="none">
            <path
              d="M12 28V18M12 18C15 18 17.5 16 17.5 13C17.5 9.5 13 8.5 11 7C9 5.5 9 3.5 11.5 2C13.5 0.8 16 2 16 2"
              stroke="url(#hangerCardGoldGrad)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="hangerCardGoldGrad" x1="0" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E6D5B3" />
                <stop offset="0.5" stopColor="#C5A059" />
                <stop offset="1" stopColor="#A8823B" />
              </linearGradient>
            </defs>
          </svg>

          {/* Wooden / Gilded Hanger Shoulder Bar */}
          <div className="relative w-full h-3.5 rounded-t-full bg-gradient-to-r from-[#D4C1A5] via-[#FFF9FB] to-[#C5A059] border-t border-[#C5A059]/70 shadow-2xs flex items-center justify-between px-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8C2E46]/80" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#7A6458]">
              Cotton Nest
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#8C2E46]/80" />
          </div>
        </div>

        {/* Hanger Body & Cart Item Controls */}
        <div className="p-2.5 pt-2 flex gap-3 items-center">
          {/* Draped Bedsheet Original Image Swatch Frame */}
          <div
            onClick={handleOpenClick}
            className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#F4EFE6] shrink-0 border border-[#DEC89B] shadow-xs cursor-pointer group flex items-center justify-center"
            title="Click to view hanger details"
          >
            {/* Top Brass Swatch Clips */}
            <div className="absolute top-0 inset-x-2 z-10 flex justify-between pointer-events-none">
              <div className="w-2 h-2.5 bg-gradient-to-b from-[#C5A059] to-[#8C2E46] rounded-b-xs border border-white/60 shadow-2xs" />
              <div className="w-2 h-2.5 bg-gradient-to-b from-[#C5A059] to-[#8C2E46] rounded-b-xs border border-white/60 shadow-2xs" />
            </div>

            {/* Original Unmodified Catalogue Image */}
            {displayImg ? (
              isVideoMedia(displayImg) ? (
                <video
                  src={displayImg}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <img
                  src={displayImg}
                  alt={prodName}
                  onError={handleImageFallback}
                  draggable={false}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-[#8C7A70] p-1 text-center">
                <Package className="w-5 h-5 opacity-40 mb-0.5" />
                <span className="text-[9px] uppercase tracking-wider font-medium">No Photo</span>
              </div>
            )}

            {/* Hover Magnify Overlay */}
            <div className="absolute inset-0 bg-[#2C2420]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Info className="w-4 h-4 text-white drop-shadow-sm" />
            </div>
          </div>

          {/* Product Details & Actions */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-start justify-between gap-1.5">
                <h3
                  onClick={handleOpenClick}
                  className="font-serif-luxury text-sm font-bold text-[#2C2420] leading-tight truncate hover:text-[#8C2E46] cursor-pointer transition-colors"
                >
                  {prodName}
                </h3>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-[#8C7A70] hover:text-rose-700 p-1 cursor-pointer shrink-0 transition-colors"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {variantName && (
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-[#8C2E46]">
                  {variantColorHex && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shrink-0 shadow-2xs"
                      style={{ backgroundColor: variantColorHex }}
                    />
                  )}
                  <span className="truncate">Color: {variantName}</span>
                </div>
              )}

              <p className="text-[10px] text-[#7A6458] truncate">
                {prodDimensions}
              </p>
            </div>

            {/* Bottom Row: Quantity Controls & Price */}
            <div className="flex items-center justify-between pt-1.5">
              <div className="flex items-center border border-[#DEC89B] rounded-lg bg-[#FAF7F2]">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold rounded-l-lg transition-colors cursor-pointer"
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="px-2 text-xs font-bold text-[#2C2420] tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  className="px-2 py-0.5 text-xs text-[#2C2420] hover:bg-[#F4EFE6] font-bold rounded-r-lg transition-colors cursor-pointer"
                  title="Increase quantity"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenClick}
                  className="p-1 rounded-md bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#7A6458] hover:text-[#8C2E46] transition-colors cursor-pointer"
                  title="View hanger details"
                  aria-label="View hanger details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-extrabold text-[#8C2E46] tabular-nums">
                  ₹{formatRupeeAmount(lineTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
