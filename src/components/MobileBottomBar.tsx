import React from 'react';
import { ShoppingBag, Grid, Package, Sparkles, Heart, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SeasonalConfig } from '../data/seasonal';

interface MobileBottomBarProps {
  activeTab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews';
  setActiveTab: (tab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews') => void;
  cartCount: number;
  openCart: () => void;
  seasonalConfig?: SeasonalConfig;
  wishlistCount?: number;
  openWishlist?: () => void;
  onOpenAccount?: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
  seasonalConfig,
  wishlistCount = 0,
  openWishlist,
  onOpenAccount,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-header,#FAF7F2)]/95 backdrop-blur-md border-t border-[var(--color-border,#EAE2D5)] px-2 py-2 flex items-center justify-around text-xs shadow-lg">
      
      {/* Catalogue Tab Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setActiveTab('catalogue');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-2 py-0.5 ${
          activeTab === 'catalogue' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        {activeTab === 'catalogue' && (
          <motion.span
            layoutId="mobile-bottom-active-pill"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute -top-2 inset-x-1 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full"
          />
        )}
        <Grid className="w-5 h-5" />
        <span className="text-[10px]">Catalogue</span>
      </motion.button>

      {/* Seasonal Festive Page (Replaces Studio button) */}
      {seasonalConfig?.enabled ? (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setActiveTab('seasonal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-2 py-0.5 ${
            activeTab === 'seasonal' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          {activeTab === 'seasonal' && (
            <motion.span
              layoutId="mobile-bottom-active-pill"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute -top-2 inset-x-1 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full"
            />
          )}
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-semibold max-w-[65px] truncate">
            {seasonalConfig.name || 'Offers'}
          </span>
        </motion.button>
      ) : (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setActiveTab('reviews');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-2 py-0.5 ${
            activeTab === 'reviews' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          {activeTab === 'reviews' && (
            <motion.span
              layoutId="mobile-bottom-active-pill"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute -top-2 inset-x-1 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full"
            />
          )}
          <span className="text-amber-500 text-sm leading-5">★</span>
          <span className="text-[10px]">Reviews</span>
        </motion.button>
      )}

      {/* Live Orders Tracking Tab */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setActiveTab('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-2 py-0.5 ${
          activeTab === 'orders' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        {activeTab === 'orders' && (
          <motion.span
            layoutId="mobile-bottom-active-pill"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute -top-2 inset-x-1 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full"
          />
        )}
        <div className="relative">
          <Package className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span className="text-[10px]">My Orders</span>
      </motion.button>

      {/* Account Button */}
      {onOpenAccount && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenAccount}
          className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] hover:text-[#8C2E46] relative cursor-pointer px-2 py-0.5"
        >
          <div className="relative">
            <User className="w-5 h-5 text-[#8C2E46]" />
          </div>
          <span className="text-[10px] font-medium">Account</span>
        </motion.button>
      )}

      {/* Shopping Bag Button with Animated Badge */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={openCart}
        className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] relative cursor-pointer px-2 py-0.5"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          <AnimatePresence mode="popLayout">
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums"
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className="text-[10px]">Bag</span>
      </motion.button>

    </div>
  );
};
