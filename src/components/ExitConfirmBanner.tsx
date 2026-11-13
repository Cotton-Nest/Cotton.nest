import React from 'react';

interface ExitConfirmBannerProps {
  isOpen: boolean;
  onContinueShopping: () => void;
  onExitApp: () => void;
}

export const ExitConfirmBanner: React.FC<ExitConfirmBannerProps> = ({
  isOpen,
  onContinueShopping,
  onExitApp,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-[#2C2420]/30"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="exit-banner-heading"
      aria-describedby="exit-banner-message"
      onClick={onContinueShopping}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[#FFFFFF] border border-[#DEC89B] shadow-[0_18px_48px_rgba(44,36,32,0.16)] overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top subtle cream & blush band with gold accent line */}
        <div className="bg-[#FAF7F2] border-b border-[#FAD1DC] px-6 pt-5 pb-4">
          <div className="w-12 h-[2px] bg-[#C29E57] mx-auto mb-3.5 rounded-full" />
          <h2
            id="exit-banner-heading"
            className="font-serif-luxury text-xl sm:text-2xl font-semibold text-[#70252D] tracking-tight"
          >
            A Soft Goodbye! 🌸
          </h2>
        </div>

        {/* Text-only message body */}
        <div id="exit-banner-message" className="px-6 pt-5 pb-6 bg-[#FFFFFF] space-y-2">
          <p className="text-sm sm:text-base font-semibold text-[#2C2420]">
            Thank You for Visiting Cotton Nest
          </p>
          <p className="text-xs sm:text-sm text-[#6B5D55] leading-relaxed">
            May your days be as comfortable as your nights.
          </p>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onContinueShopping}
              className="flex-1 py-3 px-5 rounded-2xl bg-[#8C2E46] hover:bg-[#70252D] text-[#FFFFFF] text-xs sm:text-sm font-semibold border border-[#8C2E46] cursor-pointer"
            >
              Continue Shopping
            </button>
            <button
              type="button"
              onClick={onExitApp}
              className="flex-1 py-3 px-5 rounded-2xl bg-[#FDEAF0]/60 hover:bg-[#FDEAF0] text-[#70252D] text-xs sm:text-sm font-semibold border border-[#DEC89B] cursor-pointer"
            >
              Exit App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
