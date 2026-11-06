import React from 'react';
import { ShoppingBag, Grid, Package, Sparkles, Heart, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SeasonalConfig } from '../data/seasonal';

interface MobileBottomBarProps {
  activeTab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics';
  setActiveTab: (tab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics') => void;
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
    <div className="md:hidden fixed bottom-2.5 left-3 right-3 z-40 liquid-glass-dock rounded-3xl px-2 py-1.5 flex items-center justify-around text-xs">
      
      {/* Catalogue Tab Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setActiveTab('catalogue');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-3 py-1 rounded-2xl transition-colors ${
          activeTab === 'catalogue' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        {activeTab === 'catalogue' && (
          <motion.span
            layoutId="mobile-bottom-active-pill"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute inset-0 bg-white/85 rounded-2xl border border-white/95 shadow-[0_2px_10px_rgba(44,36,32,0.06)] -z-10"
          />
        )}
        <Grid className="w-4.5 h-4.5 relative z-10" />
        <span className="text-[10px] relative z-10">Catalogue</span>
      </motion.button>

      {/* Seasonal Festive Page (Replaces Studio button) */}
      {seasonalConfig?.enabled ? (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setActiveTab('seasonal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-3 py-1 rounded-2xl transition-colors ${
            activeTab === 'seasonal' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          {activeTab === 'seasonal' && (
            <motion.span
              layoutId="mobile-bottom-active-pill"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute inset-0 bg-white/85 rounded-2xl border border-white/95 shadow-[0_2px_10px_rgba(44,36,32,0.06)] -z-10"
            />
          )}
          <div className="relative z-10">
            <Sparkles className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-semibold max-w-[65px] truncate relative z-10">
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
          className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-3 py-1 rounded-2xl transition-colors ${
            activeTab === 'reviews' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
          }`}
        >
          {activeTab === 'reviews' && (
            <motion.span
              layoutId="mobile-bottom-active-pill"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute inset-0 bg-white/85 rounded-2xl border border-white/95 shadow-[0_2px_10px_rgba(44,36,32,0.06)] -z-10"
            />
          )}
          <span className="text-amber-500 text-sm leading-4.5 relative z-10">★</span>
          <span className="text-[10px] relative z-10">Reviews</span>
        </motion.button>
      )}

      {/* Live Orders Tracking Tab */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setActiveTab('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 cursor-pointer relative px-3 py-1 rounded-2xl transition-colors ${
          activeTab === 'orders' ? 'text-[var(--color-primary,#70252D)] font-semibold' : 'text-[var(--color-text-secondary,#6B5D55)]'
        }`}
      >
        {activeTab === 'orders' && (
          <motion.span
            layoutId="mobile-bottom-active-pill"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute inset-0 bg-white/85 rounded-2xl border border-white/95 shadow-[0_2px_10px_rgba(44,36,32,0.06)] -z-10"
          />
        )}
        <div className="relative z-10">
          <Package className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] relative z-10">My Orders</span>
      </motion.button>

      {/* Account Button */}
      {onOpenAccount && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenAccount}
          className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] hover:text-[#8C2E46] relative cursor-pointer px-3 py-1 rounded-2xl"
        >
          <div className="relative">
            <User className="w-4.5 h-4.5 text-[#8C2E46]" />
          </div>
          <span className="text-[10px] font-medium">Account</span>
        </motion.button>
      )}

      {/* Shopping Bag Button with Animated Badge */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={openCart}
        className="flex flex-col items-center gap-0.5 text-[var(--color-text,#2C2420)] relative cursor-pointer px-3 py-1 rounded-2xl"
      >
        <div className="relative">
          <ShoppingBag className="w-4.5 h-4.5" />
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
