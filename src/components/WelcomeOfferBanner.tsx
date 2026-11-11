import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  ShoppingBag,
  ShieldCheck,
  Copy,
  Check,
  Tag,
} from 'lucide-react';
import {
  WelcomeOfferConfig,
  CustomerEligibilityResult,
  DEFAULT_WELCOME_OFFER_CONFIG,
  normalizeWelcomeCouponCode,
  formatRupeeAmount,
} from '../data/welcomeOffer';

interface WelcomeOfferBannerProps {
  config?: WelcomeOfferConfig;
  eligibility?: CustomerEligibilityResult | null;
  isSignedInWithGoogle: boolean;
  onSignInClick: () => void;
  onShopNowClick: () => void;
  onOpenCartClick?: () => void;
}

export const WelcomeOfferBanner: React.FC<WelcomeOfferBannerProps> = ({
  config = DEFAULT_WELCOME_OFFER_CONFIG,
  eligibility,
  isSignedInWithGoogle,
  onSignInClick,
  onShopNowClick,
  onOpenCartClick,
}) => {
  const [copied, setCopied] = useState(false);

  if (!config?.enabled) return null;

  const couponCode = normalizeWelcomeCouponCode(config.couponCode);
  const isEligible = Boolean(isSignedInWithGoogle && eligibility?.eligible);
  const isReserved = eligibility?.status === 'reserved';
  const isRedeemed = eligibility?.status === 'redeemed';
  const isExistingCustomer = eligibility?.status === 'ineligible_existing_customer';

  // Hide promotional banner only for customers who have already permanently redeemed or completed their first order
  if (isSignedInWithGoogle && (isRedeemed || isExistingCustomer)) {
    return null;
  }

  const handleCopyCode = () => {
    try {
      navigator.clipboard?.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FAF7F2] via-[#FFF9FB] to-[#FAF7F2] border border-[#DEC89B]/80 shadow-[0_10px_35px_-12px_rgba(140,46,70,0.12)] p-5 sm:p-7">
      {/* Subtle decorative gold & rose-pink accents */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#FDEAF0]/70 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#DEC89B]/25 blur-2xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        {/* Left: Offer Headline, Coupon Code & Details */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FDEAF0] border border-[#F5C6D6] text-[#8C2E46] text-[11px] font-bold uppercase tracking-widest">
              <Gift className="w-3.5 h-3.5 text-[#8C2E46]" />
              <span>{config.offerName || 'WELCOME TO COTTON NEST'}</span>
              <Sparkles className="w-3 h-3 text-[#C29E57]" />
            </div>

            {/* Prominent Coupon Code Badge with Copy action */}
            <button
              type="button"
              onClick={handleCopyCode}
              title={`Copy coupon code ${couponCode}`}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-dashed border-[#8C2E46] text-[#2C2420] hover:bg-[#FFF9FB] transition-colors cursor-pointer shadow-2xs"
            >
              <Tag className="w-3.5 h-3.5 text-[#8C2E46]" />
              <span className="text-[11px] font-medium text-[#6B5D55]">Code:</span>
              <span className="font-mono text-xs font-extrabold tracking-wider text-[#8C2E46]">
                {couponCode}
              </span>
              {copied ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                  <Check className="w-3 h-3" />
                  Copied
                </span>
              ) : (
                <Copy className="w-3 h-3 text-[#8C7A70]" />
              )}
            </button>
          </div>

          <h3 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420] leading-tight">
            Enjoy {config.discountPercentage}% OFF on your first order!
          </h3>

          <p className="text-xs sm:text-sm text-[#6B5D55] leading-relaxed">
            Experience pure cotton comfort with our special first-order welcome gift.{' '}
            <span className="font-semibold text-[#2C2420]">
              Use code <span className="font-mono text-[#8C2E46]">{couponCode}</span> · Minimum purchase ₹
              {formatRupeeAmount(config.minOrderValue)} | Maximum discount ₹
              {formatRupeeAmount(config.maxDiscountAmount)}.
            </span>
          </p>

          {/* Status line based on auth/eligibility */}
          {!isSignedInWithGoogle ? (
            <div className="inline-flex items-center gap-2 text-xs text-[#8C2E46] font-medium bg-white/90 border border-[#DEC89B]/60 px-3.5 py-2 rounded-xl shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-[#C29E57] shrink-0" />
              <span>
                Sign in with Google to auto-apply code <strong className="font-mono">{couponCode}</strong> (
                {config.discountPercentage}% OFF) at checkout.
              </span>
            </div>
          ) : isEligible ? (
            <div className="inline-flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50/90 border border-emerald-200 px-3.5 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                You’re eligible! Code <strong className="font-mono">{couponCode}</strong> (
                {config.discountPercentage}% OFF up to ₹{formatRupeeAmount(config.maxDiscountAmount)}) auto-applies at checkout.
              </span>
            </div>
          ) : isReserved ? (
            <div className="inline-flex items-center gap-2 text-xs text-amber-900 font-medium bg-amber-50/90 border border-amber-200 px-3.5 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Your Welcome Offer (<strong className="font-mono">{couponCode}</strong>) is currently reserved on Order #{eligibility?.reservedOrderId}.
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Prominent Code Box & Action CTA */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
          <div className="bg-white border border-[#DEC89B] rounded-2xl px-4 py-3 text-center shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#8C7A70]">
              Welcome Coupon Code
            </span>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="font-mono text-lg sm:text-xl font-extrabold tracking-widest text-[#8C2E46] bg-[#FDEAF0] px-2.5 py-0.5 rounded-lg border border-[#F5C6D6]">
                {couponCode}
              </span>
              <span className="font-serif-luxury text-lg sm:text-xl font-bold text-[#2C2420]">
                {config.discountPercentage}% OFF
              </span>
            </div>
            <span className="block text-[10px] text-[#7A6458] mt-1">
              Up to ₹{formatRupeeAmount(config.maxDiscountAmount)} OFF · Auto-applied or enter at checkout
            </span>
          </div>

          {!isSignedInWithGoogle ? (
            <button
              type="button"
              onClick={onSignInClick}
              className="px-5 py-3 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>Sign In with Google to Unlock {couponCode}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onShopNowClick}
                className="px-5 py-3 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>SHOP NOW</span>
              </button>
              {onOpenCartClick && (
                <button
                  type="button"
                  onClick={onOpenCartClick}
                  className="px-4 py-3 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] text-xs font-semibold transition-all cursor-pointer"
                >
                  View Bag
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
