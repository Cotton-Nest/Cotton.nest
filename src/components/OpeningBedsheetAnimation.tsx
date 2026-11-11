import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, X } from 'lucide-react';

interface OpeningBedsheetAnimationProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const OpeningBedsheetAnimation: React.FC<OpeningBedsheetAnimationProps> = ({
  onComplete,
  forceShow = false,
}) => {
  const [phase, setPhase] = useState<'initial' | 'unfolding' | 'spread' | 'reveal' | 'fading'>('initial');
  const [isSkipped, setIsSkipped] = useState(false);

  useEffect(() => {
    // 1. Respect user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion && !forceShow) {
      onComplete();
      return;
    }

    // 2. Check session storage to avoid forcing repeated intro on every refresh
    if (!forceShow) {
      try {
        const seen = sessionStorage.getItem('cotton_nest_intro_seen');
        if (seen === 'true') {
          onComplete();
          return;
        }
      } catch {
        // ignore storage errors
      }
    }

    // Timeline Sequence:
    // 0.0s -> initial (folded bedsheet centered)
    // 0.7s -> unfolding (flaps open, fabric spreads outward)
    // 1.5s -> spread & reveal (logo, tagline fade in)
    // 3.4s -> fading (smooth curtain dissolve into Hero)
    // 4.0s -> complete

    const timer1 = setTimeout(() => setPhase('unfolding'), 700);
    const timer2 = setTimeout(() => setPhase('spread'), 1500);
    const timer3 = setTimeout(() => setPhase('reveal'), 1800);
    const timer4 = setTimeout(() => setPhase('fading'), 3400);
    const timer5 = setTimeout(() => {
      try {
        sessionStorage.setItem('cotton_nest_intro_seen', 'true');
      } catch {
        // ignore
      }
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [onComplete, forceShow]);

  const handleSkip = () => {
    setIsSkipped(true);
    try {
      sessionStorage.setItem('cotton_nest_intro_seen', 'true');
    } catch {
      // ignore
    }
    onComplete();
  };

  if (isSkipped) return null;

  return (
    <AnimatePresence>
      {phase !== 'fading' ? (
        <motion.div
          key="bedsheet-opening-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[100] bg-[#FAF6F0] flex items-center justify-center overflow-hidden select-none"
        >
          {/* Top Bar with Skip Animation Control */}
          <div className="absolute top-5 right-5 sm:top-6 sm:right-8 z-30 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/80 hover:bg-white text-[#70252D] border border-[#DEC89B] shadow-xs backdrop-blur-xs transition-all cursor-pointer group"
              title="Skip opening animation"
            >
              <span>Skip Animation</span>
              <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300 text-[#C5A059]" />
            </button>
          </div>

          {/* Subtly Animated Organic Cream Fabric Ripples in Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <svg
              viewBox="0 0 1440 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full object-cover"
            >
              <motion.path
                d="M-100 200 C300 100 600 350 1000 250 C1300 170 1500 300 1600 200 L1600 1000 L-100 1000 Z"
                fill="url(#fabricWaveGrad1)"
                animate={{
                  d: [
                    "M-100 200 C300 100 600 350 1000 250 C1300 170 1500 300 1600 200 L1600 1000 L-100 1000 Z",
                    "M-100 150 C350 250 550 150 1050 300 C1250 220 1520 180 1600 150 L1600 1000 L-100 1000 Z",
                    "M-100 200 C300 100 600 350 1000 250 C1300 170 1500 300 1600 200 L1600 1000 L-100 1000 Z",
                  ],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient id="fabricWaveGrad1" x1="0" y1="0" x2="1440" y2="900" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F5EFE6" />
                  <stop offset="0.5" stopColor="#EAE2D5" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#FBF8F3" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Phase 1 & 2: Central Folded Bedsheet Unfolding Animation */}
          <div className="relative flex flex-col items-center justify-center max-w-xl px-4 text-center z-10">
            {/* The Folding/Unfolding Bedsheet Canvas Visual */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={
                phase === 'initial'
                  ? { scale: 1, opacity: 1, y: 0 }
                  : phase === 'unfolding'
                  ? { scale: [1, 1.15, 2.2], opacity: [1, 0.95, 0] }
                  : { scale: 2.2, opacity: 0 }
              }
              transition={{
                duration: phase === 'unfolding' ? 0.9 : 0.6,
                ease: [0.25, 1, 0.5, 1],
              }}
            >
              {/* Luxury Folded Bedsheet Stack Visual Representation */}
              <div className="relative w-48 h-36 sm:w-56 sm:h-40 rounded-2xl bg-gradient-to-br from-[#FAF6F0] via-[#F4EFE6] to-[#EAE2D5] border border-[#C5A059]/40 shadow-[0_20px_40px_-10px_rgba(44,36,32,0.18)] p-3 flex flex-col items-center justify-between overflow-hidden">
                {/* Gold Foil Trim Hairline */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

                {/* Top Fabric Fold Layer */}
                <motion.div
                  className="w-full h-1/2 rounded-xl bg-gradient-to-r from-white/90 via-[#FAF6F0] to-white/90 border border-[#E2D4C0] shadow-xs flex items-center justify-between px-3 relative overflow-hidden"
                  animate={
                    phase === 'unfolding'
                      ? { rotateX: -110, y: -40, opacity: 0 }
                      : { rotateX: 0, y: 0, opacity: 1 }
                  }
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                  <span className="text-[9px] font-serif-luxury font-bold tracking-widest text-[#5E1924] uppercase">
                    100% PURE COTTON
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                </motion.div>

                {/* Main Draped Fold Center */}
                <div className="w-full flex-1 my-1.5 rounded-lg bg-[#F9F5EF] border border-[#EAE2D5] flex items-center justify-center p-2 relative shadow-inner">
                  <div className="flex items-center gap-1.5 text-[#70252D]">
                    <Sparkles className="w-4 h-4 text-[#C5A059] animate-spin-slow" />
                    <span className="font-serif-luxury text-xs font-bold tracking-wider uppercase">
                      COTTON NEST
                    </span>
                  </div>
                </div>

                {/* Bottom Fabric Hem Fold */}
                <motion.div
                  className="w-full h-1/3 rounded-xl bg-white/90 border border-[#E2D4C0] flex items-center justify-between px-3"
                  animate={
                    phase === 'unfolding'
                      ? { rotateX: 110, y: 40, opacity: 0 }
                      : { rotateX: 0, y: 0, opacity: 1 }
                  }
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <span className="text-[8px] font-semibold text-[#8C7A70] tracking-wider uppercase">
                    KING 108 × 108
                  </span>
                  <span className="text-[8px] font-bold text-[#2E7D46] uppercase">
                    SUPER SOFT
                  </span>
                </motion.div>

                {/* Silk Ribbon Band Wrapper */}
                <div className="absolute inset-y-0 inset-x-1/3 bg-gradient-to-r from-[#70252D] via-[#8C2E46] to-[#70252D] opacity-90 border-x border-[#C5A059]/60 shadow-md flex items-center justify-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-[#FAF6F0] border border-[#C5A059] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Phase 3: Brand Reveal Content (Logo + Tagline + Golden Accents) */}
            <AnimatePresence>
              {(phase === 'spread' || phase === 'reveal') && (
                <motion.div
                  initial={{ opacity: 0, y: 25, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4 flex flex-col items-center"
                >
                  {/* Glowing Logo Emblem */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                    className="relative"
                  >
                    {/* Subtle Radial Glow */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-[#C5A059]/20 via-[#FAF6F0] to-[#70252D]/15 rounded-full blur-xl -z-10" />

                    <img
                      src="https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png"
                      alt="Cotton Nest Logo"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(112,37,45,0.15)]"
                    />
                  </motion.div>

                  {/* Brand Name */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="space-y-1"
                  >
                    <h1 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#2C2420]">
                      COTTON NEST
                    </h1>
                    <div className="h-[1.5px] w-24 mx-auto bg-gradient-to-r from-transparent via-[#C5A059] to-transparent rounded-full" />
                  </motion.div>

                  {/* Brand Tagline */}
                  <motion.p
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="font-serif-luxury italic text-lg sm:text-xl lg:text-2xl font-medium text-[#70252D] max-w-md leading-snug"
                  >
                    “Pure Cotton Comfort, Everyday Elegance”
                  </motion.p>

                  {/* Secondary Atelier Label */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8C7A70] px-4 py-1.5 rounded-full bg-white/90 border border-[#EAE2D5] shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Sector 46 Gurgaon Atelier</span>
                  </motion.div>

                  {/* Explore Collection CTA Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="pt-2"
                  >
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="px-7 py-3 rounded-full bg-[#70252D] hover:bg-[#5E1924] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group"
                    >
                      <span>Explore Collection</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
