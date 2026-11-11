import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, Eye, Sparkles, Plus, Minus, Package } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant } from '../data/products';
import { resolveBedsheetImage, handleImageFallback, isVideoMedia } from '../utils/imageUrl';

export interface HangerCartItemProps {
  item: {
    product: BedsheetProduct;
    quantity: number;
    selectedVariant?: BedsheetVariant;
  };
  index: number;
  totalItems: number;
  isSelected?: boolean;
  onSelect: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export const HangerCartItem: React.FC<HangerCartItemProps> = ({
  item,
  index,
  totalItems,
  isSelected = false,
  onSelect,
  onUpdateQuantity,
  onRemove,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const prod = item?.product;
  const prodId = typeof prod?.id === 'string' ? prod.id : '';
  const prodName = typeof prod?.name === 'string' && prod.name.trim() !== '' ? prod.name.trim() : 'Handcrafted Bedsheet';
  const prodDimensions = typeof prod?.dimensions === 'string' && prod.dimensions.trim() !== '' ? prod.dimensions.trim() : '108 x 108 inches (274 x 274 cm)';
  const prodSize = typeof prod?.size === 'string' && prod.size.trim() !== '' ? prod.size.trim() : 'King (108 × 108)';
  const itemPrice = typeof prod?.price === 'number' && !isNaN(prod.price) && prod.price >= 0 ? prod.price : 0;

  const variant = (
    item?.selectedVariant &&
    typeof item.selectedVariant === 'object' &&
    typeof item.selectedVariant.name === 'string' &&
    item.selectedVariant.name.trim() !== ''
  ) ? item.selectedVariant : undefined;

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
  const qty = typeof item?.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{
        opacity: 1,
        y: isHovered ? -4 : 0,
        scale: 1,
        rotate: isHovered
          ? [0, 3.4, -3.0, 2.4, -1.8, 1.2, -0.6, 0]
          : 0,
        x: isHovered
          ? [0, 1.8, -1.6, 1.2, -0.9, 0.6, -0.3, 0]
          : 0,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -12 }}
      transition={
        isHovered
          ? {
              rotate: {
                duration: 2.6,
                ease: [0.42, 0, 0.58, 1],
                repeat: Infinity,
                repeatDelay: 0.1,
              },
              x: {
                duration: 2.6,
                ease: [0.42, 0, 0.58, 1],
                repeat: Infinity,
                repeatDelay: 0.1,
              },
              y: { duration: 0.25, ease: 'easeOut' },
            }
          : {
              type: 'spring',
              stiffness: 320,
              damping: 22,
            }
      }
      className="relative flex flex-col items-center w-full max-w-[195px] mx-auto group/hanger select-none pt-1"
      style={{
        transformOrigin: '50% 2px',
        willChange: 'transform',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => {
        setTimeout(() => setIsHovered(false), 1400);
      }}
    >
      {/* Dynamic Sway Shadow projected on wardrobe back wall */}
      <motion.div
        animate={{
          opacity: isHovered ? 0.35 : 0.15,
          scale: isHovered ? 1.05 : 0.96,
          x: isHovered ? [-1.5, 2.5, -2.5, 1.8, -1.2, 0] : 0,
        }}
        transition={{
          duration: 2.6,
          repeat: isHovered ? Infinity : 0,
          ease: 'easeInOut',
        }}
        className="absolute inset-x-4 bottom-1 h-5 bg-black/40 blur-md rounded-full pointer-events-none -z-10"
      />

      {/* ==================================================================
          WARDROBE HANGER FIXTURE (Metallic Brass Hook + Wooden Shoulder Bar)
          ================================================================== */}
      <div className="relative w-full flex flex-col items-center z-20 pointer-events-none">
        {/* Compact Wardrobe Brass Hook hanging on rod */}
        <div className="relative w-6 h-6 -mb-0.5 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 drop-shadow-[0_2px_3px_rgba(0,0,0,0.22)]"
          >
            {/* Swivel eye ring anchored on wardrobe rail */}
            <circle cx="12" cy="2.5" r="2.2" fill="#FAF6F0" stroke="#C5A059" strokeWidth="1.4" />
            <circle cx="12" cy="2.5" r="1.1" fill="#C5A059" opacity="0.6" />
            {/* Elegant curved metallic brass hook */}
            <path
              d="M12 4.7 C12 7.8 17.5 8.2 17.5 12.4 C17.5 15.6 13.2 17.5 12 21.5"
              stroke="url(#wardrobeBrassGradient)"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="wardrobeBrassGradient" x1="12" y1="4" x2="16" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBF0D3" />
                <stop offset="0.45" stopColor="#C5A059" />
                <stop offset="1" stopColor="#73541A" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Contoured Wooden Hanger Shoulders */}
        <div className="w-[90%] h-3.5 rounded-t-full bg-gradient-to-r from-[#C99E66] via-[#F4E9D5] to-[#C99E66] border border-[#B88E52] shadow-[0_2px_6px_rgba(44,36,32,0.2)] flex items-center justify-between px-2 relative overflow-hidden">
          {/* Subtle natural wood grain highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-black/15 pointer-events-none" />
          
          {/* Left brass end cap */}
          <div className="w-1 h-2 rounded-full bg-[#C5A059] shadow-inner" />
          
          {/* Central Atelier Emblem Pin */}
          <div className="flex items-center gap-0.5 bg-[#FAF6F0]/95 px-1.5 py-0.2 rounded-full border border-[#C5A059]/70 shadow-2xs z-10">
            <span className="w-1 h-1 rounded-full bg-[#8C2E46]" />
            <span className="text-[7px] font-serif-luxury font-bold tracking-widest text-[#5E1924] uppercase">
              CN #{index + 1}
            </span>
          </div>

          {/* Right brass end cap */}
          <div className="w-1 h-2 rounded-full bg-[#C5A059] shadow-inner" />
        </div>

        {/* Horizontal Cloth Drape Bar with soft tuck shadow */}
        <div className="w-[84%] h-1.5 bg-[#DDCBB5] rounded-b-sm shadow-inner border-x border-b border-[#C5A059]/40 -mt-0.5 z-10" />
      </div>

      {/* ==================================================================
          VERTICAL WARDROBE DRAPED BEDSHEET CONTAINER
          ================================================================== */}
      <motion.div
        onClick={onSelect}
        tabIndex={0}
        role="button"
        aria-label={`Inspect ${prodName} details`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`w-full rounded-2xl bg-white border transition-all cursor-pointer overflow-hidden -mt-1 shadow-md hover:shadow-xl flex flex-col ${
          isSelected
            ? 'border-[#8C2E46] ring-2 ring-[#8C2E46]/40 shadow-[#8C2E46]/20'
            : isHovered
            ? 'border-[#C5A059] shadow-lg ring-1 ring-[#C5A059]/30'
            : 'border-[#DEC89B]/80'
        }`}
      >
        {/* Exact Original Bedsheet Photo - Vertical Portrait Aspect */}
        <div className="relative w-full aspect-[4/5] bg-[#FAF6F0] overflow-hidden border-b border-[#EAE2D5] flex items-center justify-center">
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
                className="w-full h-full object-cover object-center group-hover/hanger:scale-104 transition-transform duration-300"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-[#8C7A70] p-2 text-center">
              <Package className="w-6 h-6 opacity-40 mb-1" />
              <span className="text-[9px] uppercase tracking-wider">No Photo</span>
            </div>
          )}

          {/* Wardrobe Fabric Fold Shading effect (simulates folded bedsheet hanging down) */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

          {/* Top Left Tag: Wardrobe Indicator */}
          <div className="absolute top-1.5 left-1.5 bg-black/65 backdrop-blur-xs text-white text-[7.5px] font-mono tracking-wider px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-[#E2C889] animate-pulse" />
            <span>WARDROBE</span>
          </div>

          {/* Top Right Quick Inspect Badge */}
          <div className="absolute top-1.5 right-1.5 bg-white/95 backdrop-blur-xs text-[#8C2E46] p-1 rounded-full shadow-xs opacity-0 group-hover/hanger:opacity-100 transition-opacity">
            <Eye className="w-3 h-3" />
          </div>

          {/* Variant Color Dot on Bedding */}
          {variantColorHex && (
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded-full shadow-xs text-[8.5px] font-semibold text-[#2C2420] max-w-[85%]">
              <span
                className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                style={{ backgroundColor: variantColorHex }}
              />
              <span className="truncate">{variantName || 'Variant'}</span>
            </div>
          )}

          {/* Click to inspect overlay label on hover */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/hanger:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-white/95 text-[#2C2420] text-[9.5px] font-bold shadow-md flex items-center gap-1">
              <Eye className="w-3 h-3 text-[#8C2E46]" />
              <span>Inspect</span>
            </span>
          </div>
        </div>

        {/* Product Details & Price */}
        <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1.5 bg-white">
          <div>
            <h3 className="font-serif-luxury text-xs font-bold text-[#2C2420] line-clamp-1 leading-tight group-hover/hanger:text-[#8C2E46] transition-colors" title={prodName}>
              {prodName}
            </h3>
            <p className="text-[9.5px] text-[#7A6458] truncate mt-0.5">
              {prodSize}
            </p>
          </div>

          {/* Price & Line Total */}
          <div className="flex items-center justify-between pt-0.5 border-t border-[#F0EAE1]">
            <span className="text-xs font-bold text-[#2C2420] tabular-nums">
              ₹{(itemPrice * qty).toLocaleString('en-IN')}
            </span>
            {qty > 1 && (
              <span className="text-[9px] text-[#8C7A70] tabular-nums">
                ₹{itemPrice}/ea
              </span>
            )}
          </div>

          {/* Wardrobe Quick Action Bar: Stepper & Remove */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {/* Quantity Stepper */}
            <div className="flex items-center border border-[#EAE2D5] rounded-md bg-[#FAF7F2] overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(Math.max(1, qty - 1));
                }}
                className="w-5 h-5 flex items-center justify-center text-[11px] font-bold text-[#2C2420] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="w-5 text-center text-[10px] font-bold text-[#2C2420] tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(qty + 1);
                }}
                className="w-5 h-5 flex items-center justify-center text-[11px] font-bold text-[#2C2420] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Remove Trash Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 text-[#8C7A70] hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
              title="Remove bedsheet from wardrobe"
              aria-label={`Remove ${prodName}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
