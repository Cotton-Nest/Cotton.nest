import React from 'react';
import { ShoppingBag, Grid, MessageCircle, Package, Sparkles, Heart } from 'lucide-react';
import { COMPANY_DETAILS } from '../data/products';
import { SeasonalConfig } from '../data/seasonal';

interface MobileBottomBarProps {
  activeTab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews';
  setActiveTab: (tab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews') => void;
  cartCount: number;
  openCart: () => void;
  seasonalConfig?: SeasonalConfig;
  wishlistCount?: number;
  openWishlist?: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
  seasonalConfig,
  wishlistCount = 0,
  openWishlist,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-header,#FAF7F2)]/95 backdrop-blur-md border-t border-[var(--color-border,#EAE2D5)] px-2 py-2 flex items-center justify-around text-xs shadow-lg">
      
      {/* Catalogue Tab Button */}
      <button
        onClick={() => {
          setActiveTab('catalogue');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer ${
          activeTab === 'catalogue' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        <Grid className="w-5 h-5" />
        <span className="text-[10px]">Catalogue</span>
      </button>

      {/* Seasonal Festive Page (Replaces Studio button) */}
      {seasonalConfig?.enabled ? (
        <button
          onClick={() => {
            setActiveTab('seasonal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'seasonal' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-semibold max-w-[65px] truncate">
            {seasonalConfig.name || 'Offers'}
          </span>
        </button>
      ) : (
        <button
          onClick={() => {
            setActiveTab('reviews');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'reviews' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          <span className="text-amber-500 text-sm leading-5">★</span>
          <span className="text-[10px]">Reviews</span>
        </button>
      )}

      {/* Live Orders Tracking Tab */}
      <button
        onClick={() => {
          setActiveTab('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer relative ${
          activeTab === 'orders' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        <div className="relative">
          <Package className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span className="text-[10px]">My Orders</span>
      </button>

      {/* WhatsApp Quick Message */}
      <a
        href={COMPANY_DETAILS.whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct WhatsApp Message"
        className="flex flex-col items-center gap-0.5 text-emerald-700"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-[10px]">WhatsApp</span>
      </a>

      {/* Wishlist Button with Badge */}
      {openWishlist && (
        <button
          onClick={openWishlist}
          className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] hover:text-rose-600 relative cursor-pointer"
        >
          <div className="relative">
            <Heart className={`w-5 h-5 ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {wishlistCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Wishlist</span>
        </button>
      )}

      {/* Shopping Bag Button with Badge */}
      <button
        onClick={openCart}
        className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] relative cursor-pointer"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
              {cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">Bag</span>
      </button>

    </div>
  );
};
