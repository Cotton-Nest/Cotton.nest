import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  images,
  initialIndex = 0,
  title,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, onClose]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];
  const hasMultiple = images.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-xl flex flex-col justify-between select-none overflow-hidden"
          onClick={onClose}
        >
          {/* Header Controls */}
          <div
            className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-white/90 min-w-0">
              {title && (
                <span className="font-serif-luxury font-semibold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">
                  {title}
                </span>
              )}
              {hasMultiple && (
                <span className="text-xs text-[#E6C687] bg-white/10 px-2 py-0.5 rounded-full border border-white/15 shrink-0">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                title={isZoomed ? "Reset Zoom" : "Zoom Photo"}
              >
                {isZoomed ? <ZoomOut className="w-5 h-5 text-amber-300" /> : <ZoomIn className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                title="Close fullscreen photo (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Main Image Display */}
          <div
            className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-auto cursor-zoom-in"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
          >
            <motion.div
              key={currentImage}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: isZoomed ? 1.45 : 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
            >
              <img
                src={currentImage}
                alt={title || "Bedsheet Enlarge"}
                className={`max-w-[92vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-all duration-300 ${
                  isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                }`}
              />
            </motion.div>

            {/* Left / Right Nav Buttons */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 text-white bg-black/50 hover:bg-black/80 rounded-full border border-white/20 backdrop-blur-md transition-all cursor-pointer hover:scale-110 shadow-lg"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 text-white bg-black/50 hover:bg-black/80 rounded-full border border-white/20 backdrop-blur-md transition-all cursor-pointer hover:scale-110 shadow-lg"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Footer Gallery Thumbnails Strip (if multiple photos) */}
          {hasMultiple && (
            <div
              className="relative z-10 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setCurrentIndex(idx);
                  }}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    idx === currentIndex
                      ? 'border-[#C29E57] scale-110 shadow-md ring-2 ring-[#C29E57]/50'
                      : 'border-white/30 opacity-60 hover:opacity-100 hover:border-white'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
