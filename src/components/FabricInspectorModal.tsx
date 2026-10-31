import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Sparkles, ShieldCheck, Heart, ShoppingBag, Eye, Move } from 'lucide-react';
import { BedsheetProduct, BedsheetVariant } from '../data/products';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';

interface FabricInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BedsheetProduct | null;
  activeVariant?: BedsheetVariant;
  customImage?: string;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: BedsheetProduct) => void;
  onAddToCart?: (product: BedsheetProduct, variant?: BedsheetVariant) => void;
}

export const FabricInspectorModal: React.FC<FabricInspectorModalProps> = ({
  isOpen,
  onClose,
  product,
  activeVariant,
  customImage,
  isWishlisted = false,
  onToggleWishlist,
  onAddToCart,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(2); // 1 = 100%, 2 = 200%, 3 = 300%
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoomLevel(2);
      setPanPos({ x: 50, y: 50 });
    }
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const rawImage = activeVariant?.image || product.image || customImage;
  const displayImage = resolveBedsheetImage(rawImage, product.id, product.updatedAt);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setPanPos({ x, y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
    setPanPos({ x, y });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl bg-[var(--color-surface,#FFFFFF)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--color-border,#EAE2D5)] flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-[var(--color-border,#EAE2D5)] flex items-center justify-between bg-[var(--color-background,#FAF7F2)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-[var(--color-primary,#70252D)]/10 text-[var(--color-primary,#70252D)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-luxury text-base sm:text-lg font-semibold text-[var(--color-text,#2C2420)] truncate">
                Fabric Weave & Texture Inspector
              </h2>
              <p className="text-[11px] text-[#7A6458]">
                {product.name} {activeVariant ? `· ${activeVariant.name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleWishlist && (
              <button
                type="button"
                onClick={() => onToggleWishlist(product)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-white border-[#EAE2D5] text-[#7A6458] hover:text-rose-600'
                }`}
                title={isWishlisted ? 'Saved in your wishlist' : 'Save to wishlist'}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6B5D55] hover:text-[#2C2420] hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Close fabric inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Interactive Loupe Viewport */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[460px] bg-[#1E1916] overflow-hidden select-none cursor-crosshair">
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            className="w-full h-full relative overflow-hidden flex items-center justify-center"
          >
            <img
              src={displayImage}
              alt={product.name}
              onError={(e) => handleImageFallback(e, product.id)}
              className="w-full h-full object-contain pointer-events-none transition-transform duration-75 ease-out"
              style={{
                transformOrigin: `${panPos.x}% ${panPos.y}%`,
                transform: `scale(${zoomLevel})`,
              }}
            />

            {/* Micro Aim Reticle Guide */}
            <div
              className="absolute pointer-events-none w-16 h-16 sm:w-24 sm:h-24 rounded-full border-2 border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-opacity duration-150"
              style={{
                left: `${panPos.x}%`,
                top: `${panPos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
              </div>
            </div>
          </div>

          {/* Floating Zoom & Pan Controls Pill */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white flex items-center gap-3 shadow-lg z-10 text-xs font-semibold">
            <span className="text-[11px] text-white/70 hidden sm:inline flex items-center gap-1">
              <Move className="w-3 h-3" /> Move cursor to pan
            </span>

            <div className="h-3 w-px bg-white/20 hidden sm:block" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 font-mono text-[11px] text-amber-300">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3.5, z + 0.5))}
                disabled={zoomLevel >= 3.5}
                className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-3 w-px bg-white/20" />

            <div className="flex items-center gap-1">
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setZoomLevel(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    Math.round(zoomLevel) === lvl
                      ? 'bg-[var(--color-primary,#8C2E46)] text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white/80'
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fabric Specifications & Texture Badges */}
        <div className="p-4 sm:p-5 bg-[var(--color-background,#FAF7F2)] border-t border-[var(--color-border,#EAE2D5)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs mb-3">
            <div className="p-2.5 rounded-xl bg-white border border-[#EAE2D5]">
              <span className="text-[10px] uppercase font-bold text-[#8C7A70] block">Thread Count</span>
              <span className="font-serif-luxury font-bold text-sm text-[var(--color-text,#2C2420)]">
                {product.threadCount || '300-400 TC'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-[#EAE2D5]">
              <span className="text-[10px] uppercase font-bold text-[#8C7A70] block">Fabric Material</span>
              <span className="font-medium text-[var(--color-text,#2C2420)] truncate block">
                {product.fabric || '100% Pure Long-Staple Cotton'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-[#EAE2D5]">
              <span className="text-[10px] uppercase font-bold text-[#8C7A70] block">Weave & Finish</span>
              <span className="font-medium text-[var(--color-text,#2C2420)] block">
                Breathable Sateen Glaze
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-[#EAE2D5]">
              <span className="text-[10px] uppercase font-bold text-[#8C7A70] block">Atelier Origin</span>
              <span className="font-medium text-[#2E6B4A] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Gurgaon Inspected
              </span>
            </div>
          </div>

          {/* Bottom Call to Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[var(--color-text,#2C2420)] tabular-nums">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-[#9B8C83] line-through tabular-nums">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
                Pure Cotton Guaranteed
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onAddToCart && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(product, activeVariant);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to Bag</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
