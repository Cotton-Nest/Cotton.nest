import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  BannerSlot,
  getBannerTemplateById,
} from '../data/bannerSlots';

interface PrebuiltBannerDisplayProps {
  slot: BannerSlot;
  onNavigate?: (target: 'catalogue' | 'seasonal' | 'store') => void;
  previewMode?: 'desktop' | 'mobile';
  isPreview?: boolean;
}

export const PrebuiltBannerDisplay: React.FC<PrebuiltBannerDisplayProps> = ({
  slot,
  onNavigate,
  previewMode,
  isPreview = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const template = getBannerTemplateById(slot.templateId);
  const isDark = template.tone === 'dark';

  const showCta = Boolean(
    slot.ctaTarget && slot.ctaTarget !== 'none' && slot.ctaText && slot.ctaText.trim().length > 0
  );

  const handleCtaClick = () => {
    if (isPreview || !onNavigate || !slot.ctaTarget || slot.ctaTarget === 'none') return;
    onNavigate(slot.ctaTarget);
  };

  const isForcedMobilePreview = previewMode === 'mobile';

  return (
    <section
      aria-label={slot.heading || 'Cotton Nest Promotional Banner'}
      className={`relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border shadow-[0_12px_36px_-14px_rgba(44,36,32,0.2)] transition-opacity duration-200 ${
        isForcedMobilePreview
          ? 'max-w-[390px] mx-auto min-h-[180px] py-6 px-5'
          : 'min-h-[164px] sm:aspect-[3.2/1] lg:aspect-[3.8/1] lg:max-h-[290px]'
      }`}
      style={{
        background: template.fallbackGradient,
        borderColor: isDark ? 'rgba(233, 200, 123, 0.35)' : 'rgba(222, 200, 155, 0.75)',
      }}
    >
      {/* Pre-designed Wide Landscape Background Image */}
      {!imageError && (
        <img
          key={template.imageUrl}
          src={template.imageUrl}
          alt={slot.heading || 'Cotton Nest backdrop'}
          referrerPolicy="no-referrer"
          loading={isPreview ? 'lazy' : 'eager'}
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{
            objectPosition: template.objectPosition || 'center center',
          }}
        />
      )}

      {/* Measured Readability Overlay Scrim (keeps edge motifs luminous while ensuring >= 4.5:1 center contrast) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: template.overlayGradient }}
      />

      {/* Subtle Inner Atelier Hairline Frame */}
      <div
        aria-hidden="true"
        className="absolute inset-2 sm:inset-3 rounded-xl sm:rounded-2xl pointer-events-none border"
        style={{
          borderColor: isDark ? 'rgba(255, 251, 244, 0.16)' : 'rgba(140, 46, 70, 0.12)',
        }}
      />

      {/* Content Container — Clean Presentation: Heading, Supporting Message & Optional CTA Only */}
      <div
        className={`relative z-10 h-full w-full flex flex-col items-center justify-center text-center ${
          isForcedMobilePreview
            ? 'px-4 py-4 gap-2'
            : 'px-6 py-6 sm:px-14 sm:py-7 lg:px-24 gap-2 sm:gap-3'
        }`}
      >
        {/* Primary Admin-Defined Heading */}
        <h2
          className={`font-serif-luxury font-bold leading-tight text-balance max-w-3xl ${
            isForcedMobilePreview
              ? 'text-xl'
              : 'text-xl sm:text-3xl lg:text-[2.25rem]'
          }`}
          style={{ color: template.textColor }}
        >
          {slot.heading}
        </h2>

        {/* Admin-Defined Supporting Message */}
        {slot.supportingMessage && (
          <p
            className={`leading-relaxed max-w-2xl font-normal ${
              isForcedMobilePreview
                ? 'text-xs line-clamp-3'
                : 'text-xs sm:text-sm lg:text-[15px] line-clamp-3 sm:line-clamp-2'
            }`}
            style={{ color: template.subtextColor }}
          >
            {slot.supportingMessage}
          </p>
        )}

        {/* Optional Call-to-Action Button (only when configured by admin) */}
        {showCta && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCtaClick}
              className={`inline-flex items-center gap-1.5 rounded-xl font-semibold tracking-wide transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer whitespace-nowrap ${
                isForcedMobilePreview
                  ? 'px-4 py-2 text-xs'
                  : 'px-4 py-2 sm:px-5 sm:py-2.5 text-xs'
              }`}
              style={{
                backgroundColor: template.ctaBgColor,
                color: template.ctaTextColor,
              }}
            >
              <span>{slot.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
