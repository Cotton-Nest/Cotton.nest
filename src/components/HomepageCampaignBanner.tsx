import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, Calendar, Tag, ChevronRight, Gift } from 'lucide-react';
import { HomepageBanner, getActiveEligibleBanners } from '../data/banners';

interface HomepageCampaignBannerProps {
  banners: HomepageBanner[];
  onNavigate: (destination: string) => void;
  previewBanner?: HomepageBanner | null; // For Admin Panel Live Preview
}

export const HomepageCampaignBanner: React.FC<HomepageCampaignBannerProps> = ({
  banners,
  onNavigate,
  previewBanner,
}) => {
  // If preview banner is passed (from Admin Panel), use it directly; otherwise get highest priority active banner
  const activeBanner = previewBanner || getActiveEligibleBanners(banners)[0];

  if (!activeBanner) {
    return null; // Return null so zero empty space is left on homepage when no banner is active
  }

  const {
    heading,
    subtitle,
    description,
    ctaText,
    ctaDestination,
    secondaryCtaText,
    secondaryCtaDestination,
    desktopImageUrl,
    mobileImageUrl,
    backgroundColor,
    textColor,
    textAlignment,
    festiveEffect,
    category,
  } = activeBanner;

  const isLightText = textColor === 'light' || textColor === '#FFFFFF' || textColor === '#FAF6F0';

  const alignmentClass =
    textAlignment === 'left'
      ? 'text-left items-start'
      : textAlignment === 'right'
      ? 'text-right items-end'
      : 'text-center items-center';

  return (
    <div className="relative overflow-hidden w-full my-4 sm:my-6 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Outer Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: backgroundColor || '#FAF6F0' }}
          className="relative rounded-[28px] overflow-hidden shadow-lg border border-[#EAE2D5]/80"
        >
          {/* Background Images with Responsive Fallbacks */}
          {desktopImageUrl && (
            <div className="absolute inset-0 z-0">
              <picture>
                {mobileImageUrl && (
                  <source media="(max-width: 640px)" srcSet={mobileImageUrl} />
                )}
                <img
                  src={desktopImageUrl}
                  alt={heading || 'Cotton Nest Campaign'}
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
              </picture>
              
              {/* Gradient Overlay for Readable Text Contrast */}
              <div
                className={`absolute inset-0 ${
                  isLightText
                    ? 'bg-gradient-to-t from-black/75 via-black/40 to-transparent'
                    : 'bg-gradient-to-r from-white/90 via-white/70 to-white/40'
                }`}
              />
            </div>
          )}

          {/* Festive Effect Overlays */}
          {festiveEffect === 'gold_sparks' && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-35 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200/50 via-transparent to-transparent" />
          )}

          {festiveEffect === 'diwali_diyas' && (
            <div className="absolute top-3 right-4 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-300/40 text-amber-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Festive Lights & Comfort</span>
            </div>
          )}

          {festiveEffect === 'champagne_shimmer' && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-30 bg-gradient-to-r from-transparent via-amber-100/40 to-transparent animate-pulse" />
          )}

          {/* Banner Main Content Layout */}
          <div className="relative z-20 px-6 py-10 sm:px-12 sm:py-16 flex flex-col justify-center min-h-[220px] sm:min-h-[320px]">
            <div className={`max-w-3xl flex flex-col ${alignmentClass} ${textAlignment === 'center' ? 'mx-auto' : ''}`}>
              
              {/* Category Tag */}
              {category && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-3 border backdrop-blur-md ${
                    isLightText
                      ? 'bg-white/20 border-white/30 text-amber-200'
                      : 'bg-[#70252D]/10 border-[#70252D]/20 text-[#70252D]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{category}</span>
                </motion.div>
              )}

              {/* Main Heading */}
              <motion.h2
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`font-serif-luxury text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-2 ${
                  isLightText ? 'text-white drop-shadow-md' : 'text-[#2C2420]'
                }`}
              >
                {heading}
              </motion.h2>

              {/* Subtitle */}
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className={`text-base sm:text-xl font-medium tracking-wide mb-3 max-w-2xl ${
                    isLightText ? 'text-amber-100/90 drop-shadow-xs' : 'text-[#6B5D55]'
                  }`}
                >
                  {subtitle}
                </motion.p>
              )}

              {/* Description */}
              {description && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`text-xs sm:text-sm leading-relaxed mb-6 max-w-xl ${
                    isLightText ? 'text-white/80' : 'text-[#7A6458]'
                  }`}
                >
                  {description}
                </motion.p>
              )}

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className={`flex flex-wrap items-center gap-3 pt-1 ${
                  textAlignment === 'center'
                    ? 'justify-center'
                    : textAlignment === 'right'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                {/* Primary CTA */}
                {ctaText && (
                  <button
                    type="button"
                    onClick={() => onNavigate(ctaDestination || 'catalogue')}
                    className="px-6 py-3 rounded-full bg-[#70252D] hover:bg-[#581C23] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group"
                  >
                    <span>{ctaText}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* Secondary CTA */}
                {secondaryCtaText && (
                  <button
                    type="button"
                    onClick={() => onNavigate(secondaryCtaDestination || 'store')}
                    className={`px-5 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all border cursor-pointer backdrop-blur-md flex items-center gap-1.5 ${
                      isLightText
                        ? 'bg-white/20 hover:bg-white/30 border-white/40 text-white'
                        : 'bg-white/80 hover:bg-white border-[#EAE2D5] text-[#2C2420]'
                    }`}
                  >
                    <span>{secondaryCtaText}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>

            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default HomepageCampaignBanner;
