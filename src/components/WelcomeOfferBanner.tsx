import React from 'react';
import { Gift, Sparkles, ArrowRight, CheckCircle2, Lock, ShoppingBag, ShieldCheck } from 'lucide-react';
import {
  WelcomeOfferConfig,
  CustomerEligibilityResult,
  DEFAULT_WELCOME_OFFER_CONFIG,
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
  if (!config?.enabled) return null;

  const isEligible = Boolean(isSignedInWithGoogle && eligibility?.eligible);
  const isReserved = eligibility?.status === 'reserved';
  const isRedeemed = eligibility?.status === 'redeemed';
  const isExistingCustomer = eligibility?.status === 'ineligible_existing_customer';

  // Hide promotional banner only for customers who have already permanently redeemed or completed their first order
  if (isSignedInWithGoogle && (isRedeemed || isExistingCustomer)) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FAF7F2] via-[#FFF9FB] to-[#FAF7F2] border border-[#DEC89B]/80 shadow-[0_10px_35px_-12px_rgba(140,46,70,0.12)] p-5 sm:p-7">
      {/* Subtle decorative gold & rose-pink accents */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#FDEAF0]/70 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#DEC89B]/25 blur-2xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        {/* Left: Offer Headline & Details */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FDEAF0] border border-[#F5C6D6] text-[#8C2E46] text-[11px] font-bold uppercase tracking-widest">
            <Gift className="w-3.5 h-3.5 text-[#8C2E46]" />
            <span>WELCOME TO COTTON NEST</span>
            <Sparkles className="w-3 h-3 text-[#C29E57]" />
          </div>

          <h3 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420] leading-tight">
            Enjoy {config.discountPercentage}% OFF on your first order!
          </h3>

          <p className="text-xs sm:text-sm text-[#6B5D55] leading-relaxed">
            Experience pure cotton comfort with our special first-order welcome gift.{' '}
            <span className="font-semibold text-[#2C2420]">
              Minimum purchase ₹{formatRupeeAmount(config.minOrderValue)} | Maximum discount ₹
              {formatRupeeAmount(config.maxDiscountAmount)}.
            </span>
          </p>

          {/* Status line based on auth/eligibility */}
          {!isSignedInWithGoogle ? (
            <div className="inline-flex items-center gap-2 text-xs text-[#8C2E46] font-medium bg-white/90 border border-[#DEC89B]/60 px-3.5 py-2 rounded-xl shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-[#C29E57] shrink-0" />
              <span>Sign in with Google to check your eligibility and unlock 10% OFF at checkout.</span>
            </div>
          ) : isEligible ? (
            <div className="inline-flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50/90 border border-emerald-200 px-3.5 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                You’re eligible! Your {config.discountPercentage}% Welcome Offer (up to ₹
                {formatRupeeAmount(config.maxDiscountAmount)} OFF) is ready at checkout.
              </span>
            </div>
          ) : isReserved ? (
            <div className="inline-flex items-center gap-2 text-xs text-amber-900 font-medium bg-amber-50/90 border border-amber-200 px-3.5 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Your Welcome Offer is currently reserved on Order #{eligibility?.reservedOrderId}.
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Action CTA */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
          <div className="bg-white border border-[#DEC89B] rounded-2xl px-4 py-3 text-center shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#8C7A70]">
              New Customer Benefit
            </span>
            <span className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#8C2E46]">
              {config.discountPercentage}% OFF{' '}
              <span className="text-xs font-sans font-semibold text-[#C29E57]">
                (Up to ₹{formatRupeeAmount(config.maxDiscountAmount)})
              </span>
            </span>
            <span className="block text-[10px] text-[#7A6458] mt-0.5">
              One-time use · Auto-compared at checkout
            </span>
          </div>

          {!isSignedInWithGoogle ? (
            <button
              type="button"
              onClick={onSignInClick}
              className="px-5 py-3 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>Sign In with Google to Check Eligibility</span>
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
