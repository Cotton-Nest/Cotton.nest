import React from 'react';
import { ShoppingBag, Phone, MessageCircle, Menu, X, Sparkles, SlidersHorizontal, Package, User, LogOut, Star, Gift, Bell, Heart, Award, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COMPANY_DETAILS } from '../data/products';
import { SiteContent } from '../data/siteContent';
import { useAuth, isOwnerEmail } from '../context/AuthContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { SeasonalConfig } from '../data/seasonal';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallPrompt';

interface NavbarProps {
  activeTab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics';
  setActiveTab: (tab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics') => void;
  cartCount: number;
  openCart: () => void;
  onOpenPhotoManager?: () => void;
  onOpenAdmin?: () => void;
  onOpenAuthModal?: () => void;
  onOpenGoogleChooser?: () => void;
  isOwnerMode?: boolean;
  content?: SiteContent;
  productsCount?: number;
  seasonalConfig?: SeasonalConfig;
  updatedImagesCount?: number;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenCompare?: () => void;
  comparedCount?: number;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
  onOpenAccount?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
  onOpenPhotoManager,
  onOpenAdmin,
  onOpenAuthModal,
  onOpenGoogleChooser,
  isOwnerMode = false,
  content,
  productsCount = 10,
  seasonalConfig,
  updatedImagesCount = 0,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenCompare,
  comparedCount = 0,
  wishlistCount = 0,
  onOpenWishlist,
  onOpenAccount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const [mobileUserDropdownOpen, setMobileUserDropdownOpen] = React.useState(false);
  const { user, isAuthenticated, logout, loginWithGoogle, isOwner } = useAuth();
  const isAdmin = Boolean(isOwnerMode || isOwner || (user?.email && isOwnerEmail(user.email)));
  const { pointsBalance, pointsRupeesValue, openLoyaltyModal } = useLoyalty();

  const announcementText = content?.announcement.text || "100% Pure Combed Natural Cotton Bedsheets · Sector 46 Gurgaon Atelier";
  const brandName = content?.company.name || "Cotton Nest";
  const contactPhone = content?.company.phone || COMPANY_DETAILS.phone;

  const handleNavClick = (tab: 'home' | 'catalogue' | 'seasonal' | 'story' | 'store' | 'orders' | 'tc' | 'reviews' | 'analytics') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Top announcement bar */}
      <aside
        aria-label="Announcement"
        className="relative z-40 border-b border-[#EAE2D5] text-xs py-1.5 px-4 text-center transition-colors bg-[#FAF7F2]"
        style={{
          color: 'var(--color-text-secondary, #7A6458)',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
            {announcementText}
          </span>
          <span className="hidden md:inline opacity-40">|</span>
          <a
            href={`tel:${contactPhone.replace(/\s+/g, '')}`}
            className="hidden md:inline-flex items-center gap-1 hover:underline font-semibold"
            style={{ color: 'var(--color-primary, #9E7B3B)' }}
          >
            <Phone className="w-3 h-3" />
            {contactPhone}
          </a>
          <span className="hidden sm:inline opacity-40">|</span>
          <PWAInstallButton variant="topbar" />
        </div>
      </aside>

      {/* Main Header with Apple Liquid Glass */}
      <header className="sticky top-0 z-40 liquid-glass-nav transition-all">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-2 h-16 flex items-center justify-between gap-2">
          
          {/* Zone 1: Logo and Brand Name */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleNavClick('home')}
            className="text-left group cursor-pointer focus:outline-hidden flex items-center gap-2 shrink-0 select-none"
          >
            <img
              src="https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png"
              alt="Cotton Nest Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0 transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col justify-center">
              <span className="font-serif-luxury text-base sm:text-xl font-bold tracking-tight text-[var(--color-text,#2C2420)] group-hover:text-[var(--color-primary,#70252D)] transition-colors leading-tight whitespace-nowrap">
                {brandName}
              </span>
              <span className="text-[8px] sm:text-[9px] tracking-widest text-[#7A6458] font-medium uppercase block whitespace-nowrap">
                Feel The Softness
              </span>
            </div>
          </motion.button>

          {/* Zone 2: Apple Liquid Glass Capsule Navigation Dock with Sliding Glass Pill */}
          <nav className="hidden md:flex items-center flex-wrap justify-center gap-1 text-xs font-medium p-1 rounded-full liquid-glass-dock shrink-0">
            <button
              onClick={() => handleNavClick('home')}
              className={`transition-colors relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'home'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              {activeTab === 'home' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                />
              )}
              <span className="relative z-10">Home</span>
            </button>

            {/* Catalogue Tab */}
            <button
              onClick={() => handleNavClick('catalogue')}
              className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                activeTab === 'catalogue'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              {activeTab === 'catalogue' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                />
              )}
              <span className="relative z-10">Catalogue</span>
              <span className="relative z-10 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/80 text-[var(--color-primary,#70252D)] border border-white/90 shadow-2xs">
                {productsCount}
              </span>
            </button>

            {/* Seasonal Festive Page Tab (Dynamic Name & Visibility from Admin) */}
            {seasonalConfig?.enabled && (
              <button
                onClick={() => handleNavClick('seasonal')}
                className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 group whitespace-nowrap shrink-0 ${
                  activeTab === 'seasonal'
                    ? 'text-[var(--color-primary,#70252D)] font-semibold'
                    : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
                }`}
              >
                {activeTab === 'seasonal' && (
                  <motion.span
                    layoutId="desktop-nav-underline"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                  />
                )}
                <Sparkles className="relative z-10 w-3 h-3 text-amber-500 animate-pulse shrink-0" />
                <span className="relative z-10">{seasonalConfig.name || 'Festive Sale'}</span>
                <span
                  className="relative z-10 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-2xs"
                  style={{
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }}
                >
                  {seasonalConfig.badge || 'Sale'}
                </span>
              </button>
            )}

            {/* Customer Reviews Tab */}
            <button
              onClick={() => handleNavClick('reviews')}
              className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                activeTab === 'reviews'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              {activeTab === 'reviews' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                />
              )}
              <Star className="relative z-10 w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
              <span className="relative z-10">Reviews</span>
              <span className="relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50/90 text-amber-900 border border-amber-200/80">
                4.9★
              </span>
            </button>

            {/* Live Orders Tab */}
            <button
              onClick={() => handleNavClick('orders')}
              className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                activeTab === 'orders'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              {activeTab === 'orders' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                />
              )}
              <Package className="relative z-10 w-3 h-3 text-[#C29E57] shrink-0" />
              <span className="relative z-10">Orders</span>
            </button>

            {/* Analysis Tab - STRICTLY FOR ADMIN ONLY */}
            {isAdmin && (
              <button
                onClick={() => handleNavClick('analytics')}
                className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  activeTab === 'analytics'
                    ? 'text-[var(--color-primary,#70252D)] font-semibold'
                    : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
                }`}
                title="Store Traffic & Performance Analytics (Admin Only)"
              >
                {activeTab === 'analytics' && (
                  <motion.span
                    layoutId="desktop-nav-underline"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                  />
                )}
                <BarChart3 className="relative z-10 w-3 h-3 text-[#70252D] shrink-0" />
                <span className="relative z-10">Analysis</span>
              </button>
            )}

            {/* T&C Tab */}
            <button
              onClick={() => handleNavClick('tc')}
              className={`relative px-2.5 lg:px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                activeTab === 'tc'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              {activeTab === 'tc' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-white/90 rounded-full shadow-[0_2px_10px_rgba(44,36,32,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-white/95 -z-10"
                />
              )}
              <span className="relative z-10">T&amp;C</span>
            </button>
          </nav>

          {/* Zone 3 Desktop: All Action Buttons & User Profile (md:flex) */}
          <div className="hidden md:flex items-center justify-end gap-1.5 lg:gap-2 shrink-0">
            
            {/* Owner Exclusive Controls */}
            {isAdmin && (
              <div className="hidden md:flex items-center gap-1.5 shrink-0">
                {onOpenPhotoManager && (
                  <button
                    type="button"
                    onClick={onOpenPhotoManager}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1E3A8A] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-full transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                    title="Open Bedsheet Photo Studio (Owner Mode)"
                  >
                    <span className="text-xs">📸</span>
                    <span>Photo Studio</span>
                    {updatedImagesCount > 0 && (
                      <span className="bg-[#2563EB] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                        {updatedImagesCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] hover:bg-[#F9D3DE] border border-[#FAD1DC] rounded-full transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                    title="Open Store Admin Panel (Owner Mode)"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C2E46] shrink-0" />
                    <span>Admin</span>
                  </button>
                )}
              </div>
            )}

            {/* PWA Install App CTA */}
            <PWAInstallButton variant="navbar" />

            {/* Account Hub CTA */}
            {onOpenAccount && (
              <motion.button
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onOpenAccount}
                aria-label="My Account"
                title="My Account & Saved Addresses"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#2C2420] hover:text-[#8C2E46] liquid-glass-badge hover:bg-white rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5 text-[#8C2E46] shrink-0" />
                <span className="hidden sm:inline">Account</span>
              </motion.button>
            )}

            {/* Saved Wishlist CTA */}
            {onOpenWishlist && (
              <motion.button
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onOpenWishlist}
                aria-label="Saved Wishlist"
                title="Saved Wishlist"
                className="relative p-2 text-[var(--color-text,#2C2420)] hover:text-rose-600 transition-all rounded-full liquid-glass-badge hover:bg-white cursor-pointer shrink-0"
              >
                <Heart className="w-4 h-4 text-rose-500" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs">
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Notification Bell CTA */}
            {onOpenNotifications && (
              <motion.button
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onOpenNotifications}
                aria-label="Customer Notification Center"
                title="Notifications & Updates"
                className="relative p-2 text-[var(--color-text,#2C2420)] hover:text-[var(--color-primary,#70252D)] transition-all rounded-full liquid-glass-badge hover:bg-white cursor-pointer shrink-0"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Google Sign-In Card / User Profile Card */}
            <div className="flex items-center shrink-0">
              {isAuthenticated && user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 py-1 pl-1.5 pr-2.5 rounded-full border border-[#DEC89B] bg-white hover:bg-[#FAF7F2] transition-colors cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                    title="Account & Profile"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-6 h-6 rounded-full object-cover border border-[#DEC89B] shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#2C2420] text-[#DEC89B] flex items-center justify-center text-[10px] font-bold shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-[#2C2420] max-w-[75px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                    {isAdmin && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-[#8C2E46] text-white px-1.5 py-0.5 rounded-full shrink-0">
                        Admin
                      </span>
                    )}
                  </button>

                  {/* Dropdown Menu (Desktop) */}
                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-[#DEC89B] shadow-xl p-2 z-50 origin-top-right"
                      >
                        <div className="p-2 border-b border-[#EAE2D5]">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#2C2420] truncate">{user.name}</p>
                            {isAdmin && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#7A6458] truncate">{user.email || user.phone}</p>
                        </div>

                        {onOpenAccount && (
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              onOpenAccount();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#8C2E46] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer mt-1"
                          >
                            <User className="w-3.5 h-3.5 text-[#8C2E46]" />
                            <span>My Account</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              handleNavClick('analytics');
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#70252D] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer mt-1"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-[#70252D]" />
                            <span>Store Analytics (Admin)</span>
                          </button>
                        )}

                        {isAdmin && onOpenAdmin && (
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              onOpenAdmin();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#8C2E46] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C2E46]" />
                            <span>Owner Admin Panel</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleNavClick('orders')}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5 text-[#C29E57]" />
                          <span>Live Orders</span>
                        </button>

                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            loginWithGoogle();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                          <span>Switch Google Account</span>
                        </button>

                        <button
                          onClick={() => {
                            logout();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <GoogleSignInButton variant="navbar" customText="Sign In" />
              )}
            </div>

            {/* Shopping Bag CTA - Optimized for both Mobile & Desktop */}
            <motion.button
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.92 }}
              onClick={openCart}
              aria-label="View Shopping Bag"
              title="View Shopping Bag"
              className="relative p-2 text-[var(--color-text,#2C2420)] hover:text-[var(--color-primary,#70252D)] transition-all rounded-full liquid-glass-badge hover:bg-white cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <AnimatePresence mode="popLayout">
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

          </div>

          {/* Zone 3 Mobile: Clean, Single-Row Action Cluster (md:hidden) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {/* Auth / Profile Initial Button on Mobile */}
            {isAuthenticated && user ? (
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setMobileUserDropdownOpen(!mobileUserDropdownOpen)}
                  aria-label="User Account Menu"
                  aria-expanded={mobileUserDropdownOpen}
                  className="w-8 h-8 rounded-full bg-[#70252D] text-white flex items-center justify-center text-xs font-bold shadow-xs hover:bg-[#8C2E46] transition-colors cursor-pointer shrink-0 border border-white/80 select-none"
                >
                  {user.name && user.name.trim().length > 0 ? (
                    user.name.trim().charAt(0).toUpperCase()
                  ) : (
                    <User className="w-3.5 h-3.5 text-white" />
                  )}
                </motion.button>

                <AnimatePresence>
                  {mobileUserDropdownOpen && (
                    <>
                      {/* Click outside backdrop */}
                      <div
                        key="mobile-user-backdrop"
                        className="fixed inset-0 z-40"
                        onClick={() => setMobileUserDropdownOpen(false)}
                      />
                      <motion.div
                        key="mobile-user-dropdown"
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#DEC89B] shadow-2xl p-2 z-50 origin-top-right text-left"
                      >
                        <div className="p-2.5 bg-[#FAF7F2] rounded-xl mb-1.5 border border-[#EAE2D5]">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className="text-xs font-bold text-[#2C2420] truncate">
                              {user.name || 'Valued Member'}
                            </p>
                            {isAdmin && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#70252D] text-white shrink-0">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#7A6458] truncate">{user.email || user.phone}</p>
                          <div className="mt-1.5 pt-1.5 border-t border-[#EAE2D5] flex items-center justify-between text-[11px]">
                            <span className="text-[#7A6458] font-medium">Nest Points:</span>
                            <span className="font-bold text-[#70252D] font-mono">{pointsBalance} pts</span>
                          </div>
                        </div>

                        {onOpenAccount && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileUserDropdownOpen(false);
                              onOpenAccount();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#8C2E46] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <User className="w-3.5 h-3.5 text-[#8C2E46]" />
                            <span>My Account & Points</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setMobileUserDropdownOpen(false);
                            handleNavClick('orders');
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Package className="w-3.5 h-3.5 text-[#C29E57]" />
                          <span>My Orders & Tracking</span>
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileUserDropdownOpen(false);
                              handleNavClick('analytics');
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#70252D] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-[#70252D]" />
                            <span>Store Analytics (Admin)</span>
                          </button>
                        )}

                        {isAdmin && onOpenAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileUserDropdownOpen(false);
                              onOpenAdmin();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#8C2E46] hover:bg-[#FDEAF0] rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C2E46]" />
                            <span>Owner Admin Panel</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setMobileUserDropdownOpen(false);
                            logout();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 cursor-pointer transition-colors mt-1 pt-2 border-t border-[#EAE2D5]"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <GoogleSignInButton variant="navbar" customText="Sign In" className="text-[11px] px-2.5 py-1 shrink-0" />
            )}

            {/* Wishlist CTA Mobile */}
            {onOpenWishlist && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onOpenWishlist}
                aria-label="Saved Wishlist"
                className="relative p-2 text-[var(--color-text,#2C2420)] rounded-full liquid-glass-badge hover:bg-white cursor-pointer shrink-0"
              >
                <Heart className="w-4 h-4 text-rose-500" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs">
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Shopping Bag CTA Mobile */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={openCart}
              aria-label="View Shopping Bag"
              className="relative p-2 text-[var(--color-text,#2C2420)] rounded-full liquid-glass-badge hover:bg-white cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <AnimatePresence mode="popLayout">
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-primary,#70252D)] text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Mobile Menu Hamburger Toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-2 text-[#2C2420] hover:bg-white rounded-full cursor-pointer liquid-glass-badge shrink-0 flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#70252D]" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>

        {/* Redesigned Luxury Mobile Menu Drawer with Apple Liquid Glass */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden liquid-glass-modal border-b border-white/80 px-4 pt-3 pb-8 space-y-4 overflow-y-auto max-h-[85vh]"
            >
              {/* Card 1: User Profile & 1-Tap Google Sign-In */}
              {isAuthenticated && user ? (
                <div className="p-3.5 bg-white rounded-2xl border border-[#DEC89B] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#DEC89B] shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#2C2420] text-[#DEC89B] flex items-center justify-center text-xs font-bold shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#2C2420] truncate">{user.name}</p>
                        <p className="text-[11px] text-[#7A6458] truncate">{user.email || user.phone}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#70252D] text-white shrink-0">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#EAE2D5]">
                    {onOpenAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenAccount();
                        }}
                        className="flex-1 py-1.5 text-center text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] rounded-lg border border-[#FAD1DC] cursor-pointer"
                      >
                        My Account
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openLoyaltyModal();
                      }}
                      className="flex-1 py-1.5 text-center text-xs font-semibold text-amber-900 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer"
                    >
                      {pointsBalance} Nest Pts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-white rounded-2xl border border-[#DEC89B] shadow-2xs space-y-2.5">
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#2C2420]">Welcome to Cotton Nest</p>
                    <p className="text-[11px] text-[#7A6458]">Sign in to track orders, save wishlists &amp; claim loyalty rewards</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      loginWithGoogle();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-[#2C2420] bg-white border border-[#DEC89B] flex items-center justify-center gap-2 shadow-2xs hover:bg-[#FAF7F2] cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign In with Google</span>
                  </button>
                </div>
              )}

              {/* Card 2: Primary Store Navigation */}
              <div className="bg-white rounded-2xl border border-[#EAE2D5] p-2 space-y-1 shadow-2xs">
                <button
                  onClick={() => handleNavClick('home')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                    activeTab === 'home' ? 'bg-[#F4EFE6] text-[#2C2420]' : 'text-[#6B5D55] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <span>Home Showcase</span>
                  <span className="text-xs text-[#8C7A70]">→</span>
                </button>

                <button
                  onClick={() => handleNavClick('catalogue')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors ${
                    activeTab === 'catalogue' ? 'bg-[#FDEAF0] text-[#70252D]' : 'text-[#6B5D55] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <span>Product Catalogue</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#70252D] border border-[#FAD1DC]">
                    {productsCount} Designs
                  </span>
                </button>

                {seasonalConfig?.enabled && (
                  <button
                    onClick={() => handleNavClick('seasonal')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors ${
                      activeTab === 'seasonal'
                        ? 'bg-amber-100/70 text-[#70252D]'
                        : 'text-[#70252D] bg-amber-50/50 hover:bg-amber-100/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span>{seasonalConfig.name || 'Festive Offers'}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#70252D] text-white">
                      {seasonalConfig.badge || 'Sale'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => handleNavClick('reviews')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors ${
                    activeTab === 'reviews' ? 'bg-[#FDEAF0] text-[#70252D]' : 'text-[#6B5D55] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Customer Reviews</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                    4.9 ★
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick('tc')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors ${
                    activeTab === 'tc' ? 'bg-[#FDEAF0] text-[#70252D]' : 'text-[#6B5D55] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <span>Terms &amp; Conditions (T&amp;C)</span>
                  <span className="text-xs">🌸</span>
                </button>

                {/* Analysis Tab - STRICTLY FOR ADMIN ONLY */}
                {isAdmin && (
                  <button
                    onClick={() => handleNavClick('analytics')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors ${
                      activeTab === 'analytics'
                        ? 'bg-[#70252D] text-white'
                        : 'bg-[#FDEAF0] text-[#70252D] hover:bg-[#F9D3DE]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Store Traffic &amp; Analysis</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white text-[#70252D]">
                      Admin Only
                    </span>
                  </button>
                )}
              </div>

              {/* Card 3: Admin Management Tools (ONLY IF isAdmin) */}
              {isAdmin && (
                <div className="p-3 bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                      Atelier Admin Controls
                    </span>
                    <span className="text-[9px] font-bold bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full">
                      Owner Mode
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {onOpenPhotoManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenPhotoManager();
                        }}
                        className="py-2 px-2.5 rounded-xl bg-white border border-[#BFDBFE] text-xs font-semibold text-[#1E3A8A] flex items-center justify-center gap-1.5 hover:bg-[#DBEAFE] cursor-pointer"
                      >
                        <span>📸 Photo Studio</span>
                      </button>
                    )}

                    {onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenAdmin();
                        }}
                        className="py-2 px-2.5 rounded-xl bg-white border border-[#BFDBFE] text-xs font-semibold text-[#8C2E46] flex items-center justify-center gap-1.5 hover:bg-[#FDEAF0] cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Admin Panel</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Card 4: Customer Services & Quick Tools */}
              <div className="bg-white rounded-2xl border border-[#EAE2D5] p-2 space-y-1 shadow-2xs">
                <PWAInstallButton variant="mobile" />
                <button
                  type="button"
                  onClick={() => handleNavClick('orders')}
                  className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#C29E57]" />
                    <span>Track Live Orders</span>
                  </span>
                  <span className="text-xs text-[#8C7A70]">→</span>
                </button>

                {onOpenWishlist && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenWishlist();
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>Saved Wishlist</span>
                    </span>
                    {wishlistCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                        {wishlistCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenNotifications && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenNotifications();
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#70252D]" />
                      <span>Notifications &amp; Updates</span>
                    </span>
                    {unreadNotificationsCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white animate-pulse">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Card 5: Direct Studio Contact (WhatsApp & Call) */}
              <div className="pt-2 flex items-center gap-2.5">
                <a
                  href={COMPANY_DETAILS.callUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[#2C2420] bg-white rounded-xl border border-[#DEC89B] shadow-2xs hover:bg-[#FAF7F2]"
                >
                  <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Call Atelier</span>
                </a>
                <a
                  href={COMPANY_DETAILS.whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-[#70252D] hover:bg-[#8C2E46] rounded-xl shadow-2xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>

              <div className="text-center text-[10px] text-[#8C7A70] pt-1 leading-relaxed">
                <span className="font-semibold text-[#2C2420] block">Cotton Nest Bedding Studio</span>
                <span>Sector 46, Gurgaon, Haryana – 122003 · Open 7 Days</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};
