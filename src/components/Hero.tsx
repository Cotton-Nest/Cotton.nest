import React from 'react';
import { ArrowRight, ShieldCheck, Sparkles, MapPin, MessageCircle, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { COMPANY_DETAILS } from '../data/products';
import { SiteContent } from '../data/siteContent';

interface HeroProps {
  onExploreCatalogue: () => void;
  onVisitStore: () => void;
  content?: SiteContent;
}

export const Hero: React.FC<HeroProps> = ({ onExploreCatalogue, onVisitStore, content }) => {
  const kicker = content?.hero.kicker || "Handcrafted Pure Cotton Bedding · Gurgaon Atelier";
  const headline = content?.hero.headline || "The touch of pure cotton, woven for serene mornings.";
  const subheadline = content?.hero.subheadline || "Welcome to Cotton Nest. Discover our exclusive release of pure cotton King size bedsheets — tailored from 100% natural long-staple cotton with breathable comfort, delicate florals, and subtle muted golden accents.";
  const ctaText = content?.hero.ctaButtonText || "View Bedsheets Catalogue";
  const secondaryText = content?.hero.secondaryButtonText || "Visit Gurgaon Studio";

  return (
    <section className="relative overflow-hidden pt-6 pb-12 sm:pt-10 sm:pb-20 bg-[var(--color-background,#FAF7F2)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Editorial & Brand copy with staggered entrance */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            
            {/* Quiet text kicker */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-accent,#C29E57)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent,#C29E57)]" />
              <span>{kicker}</span>
            </motion.div>

            {/* Display Headline with balanced wrap */}
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif-luxury text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[var(--color-text,#2C2420)] leading-[1.15] text-balance"
            >
              {headline}
            </motion.h1>

            {/* Body description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-base sm:text-lg text-[var(--color-text-secondary,#6B5D55)] leading-relaxed max-w-xl mx-auto lg:mx-0 font-normal"
            >
              {subheadline}
            </motion.p>

            {/* CTA action cluster */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2"
            >
              <button
                onClick={onExploreCatalogue}
                className="w-full sm:w-auto px-6 py-3.5 bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-98"
              >
                <span>{ctaText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onVisitStore}
                className="w-full sm:w-auto px-5 py-3.5 bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text,#2C2420)] border border-[var(--color-border,#EAE2D5)] hover:border-[var(--color-accent,#C29E57)] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <MapPin className="w-4 h-4 text-[var(--color-accent,#C29E57)]" />
                <span>{secondaryText}</span>
              </button>
            </motion.div>

            {/* Quiet trust markers */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="pt-4 border-t border-[#EAE2D5] flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-[#7A6458]"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#C29E57]" />
                100% Pure Cotton
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#B83F60]" />
                108×108 King Tuck-In Drop
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Direct WhatsApp Ordering
              </span>
            </motion.div>

          </div>

          {/* Right Column: Hero Visual Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-[#EAE2D5] shadow-lg bg-[#FAF7F2] aspect-[16/10] sm:aspect-[16/11]">
              <img
                src="/images/hero_cotton_nest_bedding_1790996973951.jpg"
                alt="Cotton Nest luxury master bedroom featuring pure cotton bedding in cream, blush pink, and muted gold"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center transform hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C2420]/40 via-transparent to-transparent pointer-events-none" />
              
              {/* Floating aesthetic location badge */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xs bg-[#FAF7F2]/95 backdrop-blur-md p-3 rounded-xl border border-[#EAE2D5] text-left shadow-sm"
              >
                <p className="text-[11px] font-semibold text-[#B83F60] uppercase tracking-wide">
                  Gurgaon Flagship
                </p>
                <p className="text-xs text-[#2C2420] font-medium leading-snug">
                  Sector 46, Gurgaon · Ground Floor 2508
                </p>
                <p className="text-[11px] text-[#7A6458] mt-0.5">
                  Try our fabrics in person or order direct via WhatsApp
                </p>
              </motion.div>
            </div>
          </motion.div>

        </div>

        {/* Scroll-Down Visual Cue Indicator with Gentle Levitation */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="flex justify-center pt-8 sm:pt-12 cursor-pointer"
          onClick={() => {
            const el = document.getElementById('curated-highlights');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="flex items-center gap-2 text-xs font-medium text-[#A8823B] bg-white/80 backdrop-blur-xs px-4 py-2 rounded-full border border-[#DEC89B]/50 shadow-xs hover:border-[#C29E57] hover:bg-white transition-all group"
          >
            <span>Scroll to explore 100% cotton sheets</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#B83F60] group-hover:translate-y-0.5 transition-transform" />
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
};
