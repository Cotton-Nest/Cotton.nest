import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Sparkles, X, ShoppingBag, CheckCircle2, Copy, Check, Tag } from 'lucide-react';
import {
  WelcomeOfferConfig,
  DEFAULT_WELCOME_OFFER_CONFIG,
  normalizeWelcomeCouponCode,
  formatRupeeAmount,
} from '../data/welcomeOffer';

interface WelcomeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShopNow: () => void;
  config?: WelcomeOfferConfig;
  customerName?: string;
}

export const WelcomeOfferModal: React.FC<WelcomeOfferModalProps> = ({
  isOpen,
  onClose,
  onShopNow,
  config = DEFAULT_WELCOME_OFFER_CONFIG,
  customerName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!config?.enabled) return null;

  const couponCode = normalizeWelcomeCouponCode(config.couponCode);

  const handleCopyCode = () => {
    try {
      navigator.clipboard?.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#2C2420]/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-offer-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#FFF9FB] via-[#FAF7F2] to-white border-2 border-[#DEC89B] shadow-2xl overflow-hidden text-center"
          >
            {/* Top gold accent bar */}
            <div className="h-2 w-full bg-gradient-to-r from-[#C29E57] via-[#8C2E46] to-[#C29E57]" />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close welcome gift popup"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 hover:bg-[#FDEAF0] border border-[#EAE2D5] flex items-center justify-center text-[#6B5D55] hover:text-[#8C2E46] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 pt-7 pb-7 space-y-4">
              {/* Gift Icon Badge */}
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FDEAF0] border border-[#DEC89B] flex items-center justify-center shadow-sm">
                <Gift className="w-7 h-7 text-[#8C2E46]" />
              </div>

              {/* Tag */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-white border border-[#DEC89B] text-[11px] font-bold uppercase tracking-widest text-[#C29E57]">
                <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                <span>{config.offerName || 'Welcome to Cotton Nest'}</span>
              </div>

              {/* Title & Promotional Message */}
              <div className="space-y-1.5">
                <h2
                  id="welcome-offer-modal-title"
                  className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420]"
                >
                  A Little Welcome Gift! 🎁
                </h2>
                {customerName && (
                  <p className="text-xs font-semibold text-[#8C2E46]">
                    Welcome, {customerName}!
                  </p>
                )}
                <p className="text-sm sm:text-base font-medium text-[#2C2420]">
                  Enjoy <span className="text-[#8C2E46] font-bold">{config.discountPercentage}% OFF</span> on your first order with Cotton Nest.
                </p>
                <p className="text-xs sm:text-sm text-[#6B5D55] leading-relaxed">
                  Experience pure cotton comfort with a special welcome benefit!
                </p>
              </div>

              {/* Prominent Coupon Code Voucher Box */}
              <div className="bg-[#FFF9FB] rounded-2xl border-2 border-dashed border-[#8C2E46]/70 p-3.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A6458] block">
                  Your Exclusive First-Order Coupon Code
                </span>
                <div className="flex items-center justify-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xl font-extrabold tracking-widest text-[#8C2E46] bg-white px-4 py-1.5 rounded-xl border border-[#DEC89B] shadow-2xs">
                    <Tag className="w-4 h-4 text-[#C29E57]" />
                    {couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#6B5D55]">
                  Auto-applied at checkout on eligible orders, or enter <strong className="font-mono text-[#8C2E46]">{couponCode}</strong> manually.
                </p>
              </div>

              {/* Offer Terms Box */}
              <div className="bg-white rounded-2xl border border-[#DEC89B] p-4 space-y-2 text-left shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B5D55]">Coupon Code:</span>
                  <span className="font-mono font-bold text-[#8C2E46]">{couponCode} ({config.discountPercentage}% OFF)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B5D55]">Minimum Order Value:</span>
                  <span className="font-bold text-[#2C2420]">₹{formatRupeeAmount(config.minOrderValue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B5D55]">Maximum Discount:</span>
                  <span className="font-bold text-[#2C2420]">₹{formatRupeeAmount(config.maxDiscountAmount)}</span>
                </div>
                <div className="pt-2 border-t border-[#EAE2D5] flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Unlocked for your Google account · One-time use at checkout</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onShopNow();
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>SHOP NOW</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 text-xs text-[#7A6458] hover:text-[#2C2420] font-medium transition-colors cursor-pointer"
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
