import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, RotateCcw } from 'lucide-react';

// Pre-loaded generated high-fidelity luxury assets
const LUXURY_BEDROOM_IMG = '/src/assets/images/intro_luxury_bedroom_1794452266836.jpg';
const COTTON_FABRIC_IMG = '/src/assets/images/intro_cotton_fabric_1794452265232.jpg';
const COTTON_BOLL_IMG = '/src/assets/images/intro_cotton_boll_1794452268001.jpg';
const COTTON_NEST_LOGO = 'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png';

interface OpeningBedsheetAnimationProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const OpeningBedsheetAnimation: React.FC<OpeningBedsheetAnimationProps> = ({
  onComplete,
  forceShow = false,
}) => {
  // Check if reduced motion or returning user
  const [phase, setPhase] = useState<'initial' | 'float' | 'unfold' | 'bedroom' | 'logo'>('initial');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion && !forceShow) {
      localStorage.setItem('cotton_nest_intro_completed', 'true');
      onComplete();
      setIsDone(true);
      return;
    }

    // Check returning user
    const hasSeenIntro = localStorage.getItem('cotton_nest_intro_completed') === 'true';
    if (hasSeenIntro && !forceShow) {
      onComplete();
      setIsDone(true);
      return;
    }

    // Master Timeline Strategy: 4.5 seconds total
    // 0.0s -> initial (Ivory & Sun rays)
    // 0.7s -> float (Bedsheet floats up from bottom)
    // 1.7s -> unfold (Bedsheet unfolds and spreads full width)
    // 2.7s -> bedroom (Luxury bedroom interior reveal)
    // 3.6s -> logo (Cotton Nest Brand & Tagline Reveal)
    // 4.5s -> finish

    const t1 = setTimeout(() => setPhase('float'), 700);
    const t2 = setTimeout(() => setPhase('unfold'), 1700);
    const t3 = setTimeout(() => setPhase('bedroom'), 2700);
    const t4 = setTimeout(() => setPhase('logo'), 3600);
    const t5 = setTimeout(() => {
      handleFinish();
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [forceShow]);

  const handleFinish = () => {
    localStorage.setItem('cotton_nest_intro_completed', 'true');
    setIsDone(true);
    onComplete();
  };

  if (isDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="bedsheet-intro-overlay"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
        className="fixed inset-0 z-[99999] overflow-hidden bg-[#FAF6F0] text-[#2C2420] font-sans select-none flex flex-col justify-between"
      >
        {/* Soft Golden Morning Light Ray Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-10 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FFF8E7] via-transparent to-transparent"
        />

        {/* Ambient Subtle Cotton Fibers/Particles */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: `${15 + i * 15}%`, 
                y: '100%', 
                opacity: 0, 
                scale: 0.6 + (i % 3) * 0.2 
              }}
              animate={{ 
                y: '-20%', 
                opacity: [0, 0.7, 0.7, 0],
                x: `${15 + i * 15 + (i % 2 === 0 ? 8 : -8)}%`,
                rotate: 360
              }}
              transition={{
                duration: 4 + i * 0.5,
                ease: 'linear',
                repeat: Infinity,
                delay: i * 0.4
              }}
              className="absolute w-3 h-3 rounded-full bg-white blur-[1px] shadow-sm"
            />
          ))}
        </div>

        {/* Skip Button - Always available top-right */}
        <div className="relative z-50 p-4 sm:p-6 flex justify-end">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-[#70252D] text-xs font-medium tracking-wide shadow-xs border border-[#EAE2D5] backdrop-blur-md transition-all cursor-pointer"
            aria-label="Skip animation"
          >
            <span>Skip Intro</span>
            <X className="w-3.5 h-3.5 text-[#9E7B3B]" />
          </motion.button>
        </div>

        {/* Dynamic Animation Canvas */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          
          {/* Phase 1: Raw Cotton Boll Close-Up & Morning Sun Accent (0s - 1.7s) */}
          {(phase === 'initial' || phase === 'float') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-2xl border-4 border-white/90 mb-6"
              >
                <img
                  src={COTTON_BOLL_IMG}
                  alt="Raw Natural Cotton"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-1"
              >
                <span className="text-xs uppercase tracking-[0.25em] text-[#9E7B3B] font-semibold flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  100% Pure Natural Cotton
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#2C2420] font-bold tracking-tight">
                  From Natural Fibre to Everyday Comfort
                </h2>
              </motion.div>
            </motion.div>
          )}

          {/* Phase 2: Bedsheet Floating & Spreading (0.7s - 2.7s) */}
          {(phase === 'float' || phase === 'unfold') && (
            <motion.div
              key="floating-sheet-wrapper"
              initial={{ y: '100%', opacity: 0.5, scale: 0.75, rotate: -4 }}
              animate={
                phase === 'unfold'
                  ? { y: '0%', opacity: 1, scale: 1.15, rotate: 0 }
                  : { y: '15%', opacity: 0.95, scale: 0.9, rotate: -1 }
              }
              transition={{
                duration: 1.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              {/* Realistic White Cotton Fabric Texture Container */}
              <div className="relative w-full h-full max-w-5xl max-h-[80vh] mx-auto rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(112,37,45,0.25)] border-2 border-white/80">
                <img
                  src={COTTON_FABRIC_IMG}
                  alt="Pure White Percale Cotton Bedsheet"
                  className="w-full h-full object-cover transform scale-105"
                />

                {/* Fabric Soft Wave Overlay Gradient */}
                <motion.div
                  animate={{
                    x: ['-20%', '20%', '-20%'],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                />

                {/* Micro Brand Stamp on Bedsheet Corner */}
                <div className="absolute bottom-6 right-8 flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#EAE2D5] shadow-md">
                  <img
                    src={COTTON_NEST_LOGO}
                    alt="Cotton Nest Emblem"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="font-serif text-xs font-bold text-[#70252D] tracking-wider">
                    COTTON NEST PERCALE
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 3: Premium Bedroom Reveal (2.7s - 3.6s) */}
          {(phase === 'bedroom' || phase === 'logo') && (
            <motion.div
              key="bedroom-reveal-wrapper"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute inset-0 z-20"
            >
              <img
                src={LUXURY_BEDROOM_IMG}
                alt="Luxury Cotton Nest Bedroom Interior"
                className="w-full h-full object-cover"
              />
              {/* Warm Soft Vignette Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0]/40 to-black/20" />
            </motion.div>
          )}

          {/* Phase 4: Cotton Nest Brand & Logo Reveal (3.6s - 4.5s) */}
          {phase === 'logo' && (
            <motion.div
              key="brand-logo-reveal"
              initial={{ opacity: 0, y: 25, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-[#FAF6F0]/90 backdrop-blur-md"
            >
              {/* Brand Logo with Gold Shimmer */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
                className="relative mb-5"
              >
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto flex items-center justify-center p-3 rounded-3xl bg-white shadow-xl border border-[#EAE2D5] overflow-hidden">
                  <img
                    src={COTTON_NEST_LOGO}
                    alt="Cotton Nest Logo"
                    className="w-full h-full object-contain"
                  />
                  {/* Subtle Champagne Gold Light Sweep Shimmer */}
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.2, delay: 0.3, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent skew-x-12"
                  />
                </div>
              </motion.div>

              {/* Brand Title */}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C2420] tracking-tight mb-2"
              >
                COTTON NEST
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="font-serif italic text-base sm:text-xl text-[#70252D] font-medium tracking-wide mb-6"
              >
                Pure Cotton Comfort, Everyday Elegance
              </motion.p>

              {/* Atelier Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-[#D4AF37]/40 shadow-xs text-xs font-semibold text-[#9E7B3B]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Sector 46 Gurgaon Atelier</span>
              </motion.div>

              {/* Explore CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFinish}
                className="mt-8 px-8 py-3 rounded-full bg-[#70252D] hover:bg-[#581C23] text-white font-medium text-sm shadow-lg shadow-[#70252D]/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Explore Collection</span>
              </motion.button>
            </motion.div>
          )}

        </div>

        {/* Minimal Footer Info */}
        <div className="relative z-50 p-4 text-center text-[10px] uppercase tracking-widest text-[#7A6458] font-medium">
          Pure Percale Cotton · 100% Breathable
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OpeningBedsheetAnimation;
