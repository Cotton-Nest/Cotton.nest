import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ShoppingBag, Copy, Check, ArrowRight, X } from 'lucide-react';
import {
  WelcomeOfferConfig,
  DEFAULT_WELCOME_OFFER_CONFIG,
  normalizeWelcomeCouponCode,
  formatRupeeAmount,
} from '../data/welcomeOffer';

interface WelcomeBedsheetAnimationProps {
  config?: WelcomeOfferConfig;
  onShopNow: () => void;
  onDismiss?: () => void;
}

const SESSION_STORAGE_KEY = 'cotton_nest_welcome_unfold_seen_session_v1';
const LOCAL_STORAGE_KEY = 'cotton_nest_welcome_unfold_seen_first_visit_v1';
const LOGO_URL =
  'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png';

export const WelcomeBedsheetAnimation: React.FC<WelcomeBedsheetAnimationProps> = ({
  config = DEFAULT_WELCOME_OFFER_CONFIG,
  onShopNow,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [phase, setPhase] = useState<'prelude' | 'unfolding' | 'settled'>('prelude');
  const [copied, setCopied] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  const couponCode = normalizeWelcomeCouponCode(config?.couponCode);
  const discountPct = Number(config?.discountPercentage ?? config?.discountPercent ?? 10) || 10;
  const minPurchase = Number(config?.minOrderValue ?? 1299) || 1299;
  const maxDiscount = Number(config?.maxDiscountAmount ?? config?.maxDiscount ?? 200) || 200;
  const isAnimationEnabled = config?.welcomeAnimationEnabled !== false;
  const frequency = config?.welcomeAnimationFrequency || 'once_per_session';

  const markAnimationSeen = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    } catch {}
  }, []);

  const triggerAnimationSequence = useCallback(
    (forcePlay: boolean = false) => {
      let reduced = false;
      try {
        reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setPrefersReducedMotion(reduced);
      } catch {}

      if (!forcePlay) {
        if (!isAnimationEnabled) return;
        try {
          if (frequency === 'first_visit_only') {
            if (localStorage.getItem(LOCAL_STORAGE_KEY) === 'true') return;
          } else if (frequency === 'once_per_session') {
            if (sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true') return;
          }
        } catch {}
      }

      markAnimationSeen();
      setIsVisible(true);

      if (reduced) {
        setPhase('settled');
        return undefined;
      }

      setPhase('prelude');
      // 0.35s subtle logo prelude -> 2.15s realistic bedsheet unfolding -> settled reveal (~2.5s total)
      const unfoldTimer = window.setTimeout(() => {
        setPhase('unfolding');
      }, 320);

      const settleTimer = window.setTimeout(() => {
        setPhase('settled');
      }, 2450);

      return () => {
        window.clearTimeout(unfoldTimer);
        window.clearTimeout(settleTimer);
      };
    },
    [isAnimationEnabled, frequency, markAnimationSeen]
  );

  useEffect(() => {
    const cleanup = triggerAnimationSequence(false);
    return () => {
      if (cleanup) cleanup();
    };
  }, [triggerAnimationSequence]);

  // Listen for live preview trigger from the Admin Panel
  useEffect(() => {
    const handleAdminPreview = () => {
      triggerAnimationSequence(true);
    };
    window.addEventListener('cotton-nest-preview-welcome-animation', handleAdminPreview);
    return () => {
      window.removeEventListener('cotton-nest-preview-welcome-animation', handleAdminPreview);
    };
  }, [triggerAnimationSequence]);

  // Support Escape key to skip intro immediately
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onDismiss]);

  const handleClose = () => {
    markAnimationSeen();
    setIsVisible(false);
    onDismiss?.();
  };

  const handleShopNowClick = () => {
    markAnimationSeen();
    setIsVisible(false);
    onShopNow();
  };

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="cotton-nest-luxury-bedsheet-welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[160] overflow-hidden select-none flex items-center justify-center bg-[#FAF6F0]"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Cotton Nest"
        >
          {/* ==================================================================
              LAYER 1: SOFT CREAM STUDIO BASE & SUBTLE OPENING LOGO PRELUDE
              ================================================================== */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FCFBF9] via-[#FAF6F0] to-[#F4EFE6] cotton-weave-texture flex flex-col items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{
                opacity: phase === 'prelude' ? 0.92 : 0.15,
                scale: phase === 'prelude' ? 1 : 0.98,
                y: 0,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center text-center px-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 border border-[#DEC89B] shadow-md flex items-center justify-center p-2.5 mb-3">
                <img
                  src={LOGO_URL}
                  alt="Cotton Nest Emblem"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-wide text-[#2C2420]">
                Cotton Nest
              </span>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.28em] text-[#8C7A70] mt-1 font-medium">
                100% Pure Combed Cotton Atelier
              </span>
            </motion.div>
          </div>

          {/* ==================================================================
              SKIP INTRO BUTTON (Always accessible in top-right corner)
              ================================================================== */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 rounded-full bg-white/90 hover:bg-white border border-[#DEC89B] shadow-sm text-[11px] sm:text-xs font-semibold text-[#5C4E46] hover:text-[#5E1924] flex items-center gap-1.5 cursor-pointer transition-all backdrop-blur-md"
              aria-label="Skip welcome intro animation"
            >
              <span>Skip Intro</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ==================================================================
              LAYER 2: REALISTIC UNFOLDING COTTON BEDSHEET DRAPE FROM TOP
              ================================================================== */}
          {(phase === 'unfolding' || phase === 'settled') && (
            <div
              className={`absolute inset-0 pointer-events-auto flex flex-col justify-between overflow-hidden ${
                prefersReducedMotion ? '' : 'animate-bedsheet-unfold'
              }`}
            >
              {/* Main Cotton Bedsheet Surface */}
              <div
                className={`relative w-full h-full flex flex-col justify-between bg-gradient-to-b from-[#FFFDFB] via-[#FAF6F0] to-[#FFF9FB] cotton-weave-texture shadow-[0_35px_90px_rgba(30,22,18,0.28)] ${
                  phase === 'settled' && !prefersReducedMotion ? 'animate-settled-cotton' : ''
                }`}
              >
                {/* Authentic ProductBedsheet Fabric Drape Panels (4 articulated horizontal folds that flatten naturally) */}
                <div className="absolute inset-0 grid grid-rows-4 pointer-events-none overflow-hidden">
                  {[0, 1, 2, 3].map((pleatIdx) => (
                    <div
                      key={pleatIdx}
                      style={{
                        animationDelay: prefersReducedMotion ? '0ms' : `${pleatIdx * 110}ms`,
                      }}
                      className={`relative w-full h-full overflow-hidden border-b border-[#EAE2D5]/40 ${
                        prefersReducedMotion ? '' : 'animate-cotton-pleat'
                      }`}
                    >
                      {/* Subtle authentic Cotton Nest floral bedsheet border pattern (non-distorted object-cover) */}
                      <img
                        src="/images/exact_sheet1_pink_rose_1790997736396.jpg"
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover object-center opacity-[0.16] sm:opacity-[0.19] scale-105"
                      />
                      {/* Soft cotton fold crease lighting gradient */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            pleatIdx % 2 === 0
                              ? 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(250,246,240,0.68) 65%, rgba(249,211,222,0.22) 100%)'
                              : 'linear-gradient(180deg, rgba(253,234,240,0.26) 0%, rgba(255,255,255,0.84) 55%, rgba(244,239,230,0.75) 100%)',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Left & Right Tailored Bedsheet Hem Framing with Real Floral Cotton Trim */}
                <div className="hidden lg:block absolute inset-y-6 left-6 w-28 xl:w-36 rounded-2xl overflow-hidden border border-[#DEC89B]/60 shadow-inner pointer-events-none opacity-65">
                  <img
                    src="/images/exact_sheet1_pink_rose_1790997736396.jpg"
                    alt="Cotton Nest Floral Bedsheet Trim"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FAF6F0]/35 to-[#FAF6F0]/85" />
                </div>

                <div className="hidden lg:block absolute inset-y-6 right-6 w-28 xl:w-36 rounded-2xl overflow-hidden border border-[#DEC89B]/60 shadow-inner pointer-events-none opacity-65">
                  <img
                    src="/images/exact_sheet2_sage_mint_rose_1790997747019.jpg"
                    alt="Cotton Nest Artisanal Cotton Trim"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#FAF6F0]/35 to-[#FAF6F0]/85" />
                </div>

                {/* Inner Stitched Champagne-Gold Piping Frame (Like a tailored King Bedsheet) */}
                <div className="absolute inset-3 sm:inset-5 rounded-3xl border border-[#DEC89B]/75 pointer-events-none shadow-[inset_0_0_40px_rgba(197,160,89,0.08)]" />
                <div className="absolute inset-4 sm:inset-6 rounded-[22px] border border-dashed border-[#C5A059]/45 pointer-events-none" />

                {/* Dynamic Billowing Air-Wave & Fold Shadow Overlay */}
                {!prefersReducedMotion && (
                  <div className="absolute inset-0 pointer-events-none animate-cotton-fold-ripple" />
                )}

                {/* ==================================================================
                    LAYER 3: WELCOME REVEAL CONTENT (Settled Cotton Bedsheet Centerpiece)
                    ================================================================== */}
                <div className="relative z-20 flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{
                      opacity: phase === 'settled' ? 1 : 0,
                      y: phase === 'settled' ? 0 : 14,
                      scale: phase === 'settled' ? 1 : 0.98,
                    }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-xl rounded-3xl bg-white/92 backdrop-blur-md border-2 border-[#DEC89B] shadow-[0_24px_60px_rgba(44,36,32,0.12)] px-5 py-6 sm:px-9 sm:py-8 text-center space-y-5"
                  >
                    {/* Top Gilded Accent Strip */}
                    <div className="mx-auto w-24 h-1 rounded-full bg-gradient-to-r from-[#DEC89B] via-[#C5A059] to-[#DEC89B]" />

                    {/* Brand Crest & Tactile Fabric Preview Pill */}
                    <div className="flex flex-col items-center space-y-2">
                      <div className="relative flex items-center justify-center">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FAF6F0] border border-[#DEC89B] shadow-xs flex items-center justify-center p-2">
                          <img
                            src={LOGO_URL}
                            alt="Cotton Nest Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#FFF6F8] border border-[#F9D3DE] text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C2E46]">
                        <Sparkles className="w-3 h-3 text-[#C5A059]" />
                        <span>Handcrafted 100% Pure Cotton Bedding</span>
                      </div>
                    </div>

                    {/* Primary Welcome Heading & Subtitle */}
                    <div className="space-y-1.5">
                      <h1 className="font-serif-luxury text-2xl sm:text-4xl font-bold tracking-wide text-[#2C2420] uppercase">
                        WELCOME TO COTTON NEST
                      </h1>
                      <p className="font-serif-luxury italic text-base sm:text-xl text-[#7A6458] font-medium">
                        Pure Cotton Comfort, Everyday Elegance
                      </p>
                    </div>

                    {/* Authentic Non-Distorted Bedsheet Swatch Strip */}
                    <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto pt-0.5">
                      {[
                        {
                          img: '/images/exact_sheet1_pink_rose_1790997736396.jpg',
                          label: 'Blush Rose 108×108',
                        },
                        {
                          img: '/images/exact_sheet2_sage_mint_rose_1790997747019.jpg',
                          label: 'Artisanal Mulmul',
                        },
                        {
                          img: '/images/exact_sheet9_rosemary_blue_rose_1791027541188.jpg',
                          label: '350 TC Percale',
                        },
                      ].map((swatch) => (
                        <div
                          key={swatch.label}
                          className="group relative h-14 sm:h-16 rounded-xl overflow-hidden border border-[#DEC89B]/80 shadow-2xs"
                        >
                          <img
                            src={swatch.img}
                            alt={swatch.label}
                            className="w-full h-full object-cover object-center"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1E1612]/75 via-[#1E1612]/30 to-transparent px-1.5 py-0.5">
                            <span className="text-[9px] font-semibold text-white tracking-wide block truncate">
                              {swatch.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Welcome Offer Voucher Card (WELCOME10) */}
                    {config?.enabled !== false && (
                      <div className="rounded-2xl bg-gradient-to-br from-[#FFF9FB] via-[#FAF6F0] to-[#FAF7EE] border-2 border-[#DEC89B] p-4 sm:p-5 space-y-2.5 shadow-inner">
                        <p className="text-xs sm:text-sm font-extrabold tracking-[0.14em] uppercase text-[#5E1924]">
                          ENJOY {discountPct}% OFF YOUR FIRST ORDER
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white border border-[#C5A059] shadow-2xs">
                            <span className="text-xs font-semibold text-[#7A6458]">
                              Use Code:
                            </span>
                            <span className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-[#8C2E46]">
                              {couponCode}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="px-3 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#FDEAF0] border border-[#DEC89B] text-[#5E1924] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Copy coupon code"
                          >
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span className="text-emerald-800">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#8C2E46]" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] sm:text-xs font-semibold text-[#5C4E46]">
                          Minimum Purchase ₹{formatRupeeAmount(minPurchase)} &nbsp;|&nbsp; Maximum Discount ₹{formatRupeeAmount(maxDiscount)}
                        </p>
                      </div>
                    )}

                    {/* Primary SHOP NOW CTA Button */}
                    <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleShopNowClick}
                        className="w-full sm:w-auto min-w-[220px] py-3.5 px-8 rounded-xl liquid-glass-primary-btn text-white font-bold text-xs sm:text-sm tracking-[0.16em] uppercase flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transition-all"
                      >
                        <ShoppingBag className="w-4 h-4 text-[#F3EBD7]" />
                        <span>SHOP NOW</span>
                        <ArrowRight className="w-4 h-4 text-[#F3EBD7]" />
                      </button>

                      <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto py-3 px-5 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] border border-[#E2D4C0] text-xs font-semibold text-[#5C4E46] hover:text-[#1E1612] cursor-pointer transition-colors"
                      >
                        Enter Storefront
                      </button>
                    </div>
                  </motion.div>
                </div>

                {/* Leading Bottom Flowing Cotton Wave Hem & Cast Shadow */}
                <div
                  className={`relative w-full pointer-events-none select-none overflow-hidden ${
                    prefersReducedMotion ? '' : 'animate-cotton-hem-wave'
                  }`}
                >
                  <svg
                    viewBox="0 0 1440 90"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-7 sm:h-10 block"
                    preserveAspectRatio="none"
                  >
                    {/* Soft cast shadow underneath the billowing bedsheet edge */}
                    <path
                      d="M0 32C240 82 480 4 720 42C960 80 1200 12 1440 48V90H0V32Z"
                      fill="rgba(44, 36, 32, 0.08)"
                    />
                    {/* Blush & Gold stitched hem fold */}
                    <path
                      d="M0 18C240 68 480 -8 720 30C960 68 1200 2 1440 36V64C1200 30 960 86 720 50C480 14 240 82 0 42V18Z"
                      fill="#FDEAF0"
                    />
                    {/* Crisp combed cotton top fold edge */}
                    <path
                      d="M0 0H1440V28C1200 -4 960 62 720 24C480 -14 240 60 0 14V0Z"
                      fill="#FAF6F0"
                    />
                    {/* Subtle champagne gold stitch line */}
                    <path
                      d="M0 16C240 62 480 -10 720 26C960 62 1200 -2 1440 30"
                      stroke="#C5A059"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      strokeOpacity="0.65"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
