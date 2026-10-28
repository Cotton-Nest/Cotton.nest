import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, Copy, Check, ChevronRight } from 'lucide-react';
import { CouponOffer } from '../data/coupons';
import { getCouponsApi } from '../services/api';

interface OfferBannerProps {
  onOpenCart?: () => void;
  className?: string;
}

export const OfferBanner: React.FC<OfferBannerProps> = ({ onOpenCart, className = '' }) => {
  const [coupons, setCoupons] = useState<CouponOffer[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    getCouponsApi()
      .then((list) => {
        const today = new Date().toISOString().split('T')[0];
        const active = list.filter((c) => c.isActive && c.expiryDate >= today);
        setCoupons(active);
      })
      .catch(() => {});
  }, []);

  const handleCopy = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (!coupons || coupons.length === 0) return null;

  // Pick top 2 featured offers
  const featuredOffers = coupons.slice(0, 2);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all ${className}`}
      style={{
        backgroundColor: 'var(--color-surface, #FAF7F2)',
        borderColor: 'var(--color-border, #DEC89B)',
      }}
    >
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border shadow-2xs"
            style={{
              backgroundColor: 'var(--color-secondary, #B83F60)',
              borderColor: 'var(--color-secondary, #B83F60)',
              color: 'var(--color-secondary-contrast, #FFFFFF)',
            }}
          >
            <Sparkles className="w-3 h-3 text-amber-200" />
            Special Offers
          </span>

          {featuredOffers.map((offer) => {
            const isCopied = copiedCode === offer.code;
            return (
              <div
                key={offer.id}
                className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 rounded-xl border border-[#DEC89B]/80 text-[#2C2420] text-xs font-medium backdrop-blur-xs"
              >
                <span>
                  {offer.discountType === 'percentage'
                    ? `${offer.discountValue}% OFF`
                    : `₹${offer.discountValue} OFF`}
                  {offer.minOrderValue > 0 && (
                    <span className="text-[#6B5D55] text-[11px] ml-1">
                      (orders &gt; ₹{offer.minOrderValue})
                    </span>
                  )}
                  :
                </span>

                {offer.isAutomatic ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Auto-Applied
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleCopy(offer.code, e)}
                    className="inline-flex items-center gap-1 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#70252D] border border-[#DEC89B] transition-colors cursor-pointer group"
                    title={`Click to copy code ${offer.code}`}
                  >
                    <span>{offer.code}</span>
                    {isCopied ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#A8823B] group-hover:text-[#70252D]" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {onOpenCart && (
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline cursor-pointer shrink-0"
            style={{ color: 'var(--color-primary, #70252D)' }}
          >
            <span>Apply in Cart</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
