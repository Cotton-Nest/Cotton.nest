import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  BannerAudienceContext,
  HomepageBanner,
  getNextBannerTransitionDelayMs,
  getTopEligibleCustomerBanner,
} from '../data/banners';

interface CustomerAnnouncementBannerProps {
  banners: HomepageBanner[];
  audienceContext?: BannerAudienceContext;
  onNavigate?: (destination: string) => void;
  previewBanner?: HomepageBanner | null;
  fallbackAnnouncement?: React.ReactNode;
}

export const CustomerAnnouncementBanner: React.FC<CustomerAnnouncementBannerProps> = ({
  banners,
  audienceContext = { isAuthenticated: false, isNewUser: true },
  onNavigate,
  previewBanner,
  fallbackAnnouncement = null,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Automatically re-evaluate IST validity boundaries locally without polling Firebase
  useEffect(() => {
    if (previewBanner) return;
    setNowMs(Date.now());

    const scheduleNextTick = () => {
      const currentNow = Date.now();
      const delayMs = getNextBannerTransitionDelayMs(banners, currentNow);
      if (delayMs === null) return undefined;
      return window.setTimeout(() => {
        setNowMs(Date.now());
      }, delayMs);
    };

    const timerId = scheduleNextTick();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [banners, nowMs, previewBanner]);

  const activeBanner: HomepageBanner | null = previewBanner
    ? previewBanner
    : getTopEligibleCustomerBanner(banners, new Date(nowMs), audienceContext);

  if (!activeBanner) {
    return <>{fallbackAnnouncement}</>;
  }

  const bg = activeBanner.backgroundColor || '#FAF7F2';
  const textCol =
    activeBanner.textColor === 'light'
      ? '#FFFFFF'
      : activeBanner.textColor || '#2C2420';
  const accentCol = activeBanner.accentColor || '#8C2E46';

  const headingFontClass =
    activeBanner.textStyle === 'editorial_serif'
      ? 'font-serif-luxury font-semibold tracking-tight'
      : activeBanner.textStyle === 'bold_display'
      ? 'font-sans font-bold tracking-wide uppercase'
      : 'font-sans font-semibold';

  const alignClass =
    activeBanner.textAlignment === 'left'
      ? 'justify-start text-left'
      : activeBanner.textAlignment === 'right'
      ? 'justify-end text-right'
      : 'justify-center text-center';

  return (
    <aside
      aria-label={activeBanner.heading || 'Announcement & Festive Banner'}
      className="relative z-40 border-b border-[#EAE2D5]/80 py-2 px-4 transition-colors"
      style={{
        backgroundColor: bg,
        color: textCol,
      }}
    >
      <div className={`max-w-7xl mx-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs ${alignClass}`}>
        {activeBanner.category && (
          <>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
              style={{ color: accentCol }}
            >
              {activeBanner.category}
            </span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
          </>
        )}

        <span className={`text-xs sm:text-[13px] ${headingFontClass}`} style={{ color: textCol }}>
          {activeBanner.heading}
        </span>

        {activeBanner.subtitle && (
          <>
            <span aria-hidden="true" className="hidden sm:inline opacity-40">
              —
            </span>
            <span className="text-xs opacity-90" style={{ color: textCol }}>
              {activeBanner.subtitle}
            </span>
          </>
        )}

        {activeBanner.ctaText && activeBanner.ctaText.trim() !== '' && (
          <button
            type="button"
            onClick={() => onNavigate?.(activeBanner.ctaDestination || 'catalogue')}
            className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-4 hover:opacity-80 cursor-pointer whitespace-nowrap shrink-0 ml-1"
            style={{ color: accentCol }}
          >
            <span>{activeBanner.ctaText}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default CustomerAnnouncementBanner;
