import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ShoppingBag, X, ArrowRight } from 'lucide-react';

export interface CartToastInfo {
  id: string;
  productName: string;
  sizeLabel: string;
  image: string;
  price: number;
  quantity: number;
  variantName?: string;
}

interface CartToastNotificationProps {
  toast: CartToastInfo | null;
  onClose: () => void;
  onOpenCart: () => void;
}

export const CartToastNotification: React.FC<CartToastNotificationProps> = ({
  toast,
  onClose,
  onOpenCart,
}) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast?.id, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-[80] w-[calc(100vw-24px)] sm:w-auto sm:max-w-md pointer-events-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-[#2C2420]/95 sm:bg-[#2C2420]/95 backdrop-blur-md text-white border border-[#C29E57]/40 shadow-2xl p-3.5 flex items-center gap-3.5">
            {/* Gold Accent Hairline at Top */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

            {/* Product Thumbnail */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#F4EFE6] shrink-0 border border-[#C29E57]/30 shadow-xs">
              <img
                src={toast.image}
                alt={toast.productName}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-0.5 right-0.5 bg-[#8C2E46] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white/60 shadow-2xs">
                {toast.quantity}
              </div>
            </div>

            {/* Notification Content */}
            <div className="flex-1 min-w-0 pr-1 space-y-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                </div>
                <span>Added to Bag</span>
              </div>

              {/* Product Title */}
              <h4 className="text-xs font-semibold text-white truncate leading-tight">
                {toast.productName}
              </h4>

              {/* Size & Variant Confirmation */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#DCD0C0]">
                <span className="inline-block bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-medium border border-white/15 text-[#E6C687]">
                  Size: {toast.sizeLabel}
                </span>
                {toast.variantName && (
                  <span className="truncate text-[#B8A498] text-[10px]">
                    · {toast.variantName}
                  </span>
                )}
              </div>
            </div>

            {/* Actions: View Bag & Dismiss */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCart();
                }}
                className="px-3 py-1.5 bg-[#8C2E46] hover:bg-[#A33753] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>Bag</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[#A8988D] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
