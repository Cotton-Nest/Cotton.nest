import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Image as ImageIcon,
  Check,
  Tag,
  Package,
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { resolveBedsheetImage } from '../utils/imageUrl';
import { isVideoMedia } from '../utils/mediaHelpers';

interface AdminPhotoEnlargeModalProps {
  product: BedsheetProduct | null;
  initialPhotoIndex?: number;
  customImages?: Record<string, string>;
  onClose: () => void;
}

export const AdminPhotoEnlargeModal: React.FC<AdminPhotoEnlargeModalProps> = ({
  product,
  initialPhotoIndex = 0,
  customImages = {},
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Extract all high-res photos belonging strictly to this product
  const photos = React.useMemo(() => {
    if (!product) return [];
    const list: string[] = [];

    // 1. Primary cover image
    const cover = product.image || customImages[product.id];
    if (cover && !isVideoMedia(cover)) {
      list.push(resolveBedsheetImage(cover, product.id, product.updatedAt));
    }

    // 2. Extra angle photos (additionalImages)
    if (Array.isArray(product.additionalImages)) {
      product.additionalImages.forEach((img) => {
        if (img && !isVideoMedia(img)) {
          const resolved = resolveBedsheetImage(img, product.id, product.updatedAt);
          if (!list.includes(resolved)) {
            list.push(resolved);
          }
        }
      });
    }

    // 3. Variant photos
    if (Array.isArray(product.variants)) {
      product.variants.forEach((v) => {
        if (v.image && !isVideoMedia(v.image)) {
          const resolved = resolveBedsheetImage(v.image, product.id, product.updatedAt);
          if (!list.includes(resolved)) {
            list.push(resolved);
          }
        }
      });
    }

    // Fallback if no photos found
    if (list.length === 0) {
      list.push('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200');
    }

    return list;
  }, [product, customImages]);

  // Sync initial index when modal opens with a new index or product
  useEffect(() => {
    if (initialPhotoIndex >= 0 && initialPhotoIndex < photos.length) {
      setCurrentIndex(initialPhotoIndex);
    } else {
      setCurrentIndex(0);
    }
    setZoomLevel(1);
  }, [initialPhotoIndex, photos.length, product?.id]);

  // Handle zoom in/out
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.7));
  const handleResetZoom = () => setZoomLevel(1);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    setZoomLevel(1);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    setZoomLevel(1);
  }, [photos.length]);

  // ESC key and Arrow keys navigation
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose, handlePrev, handleNext]);

  // Mobile Back Button support via history pushState / popstate
  useEffect(() => {
    if (!product) return;

    window.history.pushState({ admin_photo_enlarge: true }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [product, onClose]);

  if (!product || photos.length === 0) return null;

  const currentPhotoUrl = photos[currentIndex] || photos[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-black/92 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 overflow-hidden select-none">
        
        {/* Backdrop click handler */}
        <div
          className="absolute inset-0 z-0"
          onClick={onClose}
          title="Click backdrop to close viewer"
        />

        {/* Top Header Bar */}
        <div className="relative z-20 flex items-center justify-between gap-4 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#8C2E46] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md" title={product.name}>
                {product.name}
              </h3>
              <p className="text-xs text-amber-300 font-medium flex items-center gap-2">
                <span>SKU: {product.id}</span>
                <span>·</span>
                <span className="text-stone-300">₹{Number(product.price || 0).toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>

          {/* Photo Counter & Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="px-3 py-1 rounded-full bg-stone-800 border border-stone-700 text-xs font-mono font-bold text-amber-300">
              {currentIndex + 1} / {photos.length}
            </span>

            {/* Zoom Controls Bar */}
            <div className="hidden sm:flex items-center gap-1 bg-stone-800/80 p-1 rounded-xl border border-stone-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.7}
                className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-200 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-stone-300 px-1 font-bold">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-200 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg hover:bg-stone-700 text-amber-300 transition-colors cursor-pointer text-xs font-bold"
                title="Fit to Screen (1:1)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition-colors cursor-pointer border border-stone-700"
              title="Close Fullscreen Viewer (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Viewing Stage */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
          
          {/* Previous Button */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-6 z-30 p-3 sm:p-4 rounded-full bg-zinc-900/80 hover:bg-black text-white border border-zinc-700/80 shadow-2xl transition-all hover:scale-105 cursor-pointer backdrop-blur-md"
              title="Previous Photo"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
            </button>
          )}

          {/* Enlarged Image Box */}
          <div
            className="relative max-w-full max-h-full flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing transition-transform duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              key={`${product.id}-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: zoomLevel }}
              transition={{ duration: 0.25 }}
              src={currentPhotoUrl}
              alt={`${product.name} - Photo ${currentIndex + 1}`}
              className="max-w-[88vw] max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-stone-800/80 bg-zinc-950"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Next Button */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-6 z-30 p-3 sm:p-4 rounded-full bg-zinc-900/80 hover:bg-black text-white border border-zinc-700/80 shadow-2xl transition-all hover:scale-105 cursor-pointer backdrop-blur-md"
              title="Next Photo"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
            </button>
          )}
        </div>

        {/* Bottom Thumbnail Strip (if multiple photos exist) */}
        <div className="relative z-20 flex flex-col items-center gap-2">
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full p-2 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md scrollbar-none">
              {photos.map((photoUrl, idx) => (
                <button
                  key={`thumb-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                    setZoomLevel(1);
                  }}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    currentIndex === idx
                      ? 'border-amber-400 scale-105 shadow-md ring-2 ring-amber-400/40'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="text-[11px] text-stone-400 font-medium">
            <span>Click outside image or press </span>
            <kbd className="px-1.5 py-0.5 bg-stone-800 text-amber-300 rounded font-mono font-bold border border-stone-700">ESC</kbd>
            <span> to close. Use arrow keys to navigate photos.</span>
          </div>
        </div>

      </div>
    </AnimatePresence>
  );
};
