import React from 'react';
import { ShoppingBag, Phone, MessageCircle, Menu, X, Sparkles, MapPin, SlidersHorizontal, Package, User, LogOut, Star } from 'lucide-react';
import { COMPANY_DETAILS } from '../data/products';
import { SiteContent } from '../data/siteContent';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: 'home' | 'catalogue' | 'story' | 'store' | 'orders' | 'tc' | 'reviews';
  setActiveTab: (tab: 'home' | 'catalogue' | 'story' | 'store' | 'orders' | 'tc' | 'reviews') => void;
  cartCount: number;
  openCart: () => void;
  onOpenPhotoManager?: () => void;
  onOpenAdmin?: () => void;
  onOpenAuthModal?: () => void;
  isOwnerMode?: boolean;
  content?: SiteContent;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
  onOpenPhotoManager,
  onOpenAdmin,
  onOpenAuthModal,
  isOwnerMode = false,
  content,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const announcementText = content?.announcement.text || "100% Pure Combed Natural Cotton Bedsheets · Sector 46 Gurgaon Atelier";
  const brandName = content?.company.name || "Cotton Nest";
  const contactPhone = content?.company.phone || COMPANY_DETAILS.phone;

  const handleNavClick = (tab: 'home' | 'catalogue' | 'story' | 'store' | 'orders' | 'tc' | 'reviews') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Subtle announcement bar */}
      <aside aria-label="Announcement" className="bg-[#F4EFE6] border-b border-[#EAE2D5] text-[#7A6458] text-xs py-1.5 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
            {announcementText}
          </span>
          <span className="hidden md:inline text-[#DCD0C0]">|</span>
          <a
            href={`tel:${contactPhone.replace(/\s+/g, '')}`}
            className="hidden md:inline-flex items-center gap-1 text-[#9E7B3B] hover:underline font-semibold"
          >
            <Phone className="w-3 h-3" />
            {contactPhone}
          </a>
        </div>
      </aside>

      {/* Main Header strictly adhering to the 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[var(--color-header,#FAF7F2)]/95 backdrop-blur-md border-b border-[var(--color-border,#EAE2D5)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Zone 1: Single text element wordmark in display face */}
          <button
            onClick={() => handleNavClick('home')}
            className="text-left group cursor-pointer focus:outline-hidden"
          >
            <span className="font-serif-luxury text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-text,#2C2420)] group-hover:text-[var(--color-primary,#70252D)] transition-colors">
              {brandName}
            </span>
          </button>

          {/* Zone 2: Clean text navigation links with active state indicator */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-8 text-sm font-medium">
            <button
              onClick={() => handleNavClick('home')}
              className={`transition-colors relative py-1 cursor-pointer ${
                activeTab === 'home'
                  ? 'text-[var(--color-text,#2C2420)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              Home
              {activeTab === 'home' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full" />
              )}
            </button>

            {/* Catalogue Tab */}
            <button
              onClick={() => handleNavClick('catalogue')}
              className={`relative py-1 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'catalogue'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              <span>Catalogue</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-background,#FAF7F2)] text-[var(--color-primary,#70252D)] border border-[var(--color-border,#EAE2D5)]">
                9 Designs
              </span>
              {activeTab === 'catalogue' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full" />
              )}
            </button>

            {/* T&C Tab */}
            <button
              onClick={() => handleNavClick('tc')}
              className={`relative py-1 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'tc'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              <span>T&amp;C</span>
              {activeTab === 'tc' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full" />
              )}
            </button>

            {/* Customer Reviews Tab */}
            <button
              onClick={() => handleNavClick('reviews')}
              className={`relative py-1 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'text-[var(--color-primary,#70252D)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-primary,#70252D)]'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>Reviews</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                4.9 ★
              </span>
              {activeTab === 'reviews' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary,#70252D)] rounded-full" />
              )}
            </button>

            {/* LIVE ORDERS TAB - SYNCED WITH ADMIN (Uses Secondary Theme Colour) */}
            <button
              onClick={() => handleNavClick('orders')}
              className={`relative py-1 cursor-pointer transition-colors flex items-center gap-1.5 group ${
                activeTab === 'orders'
                  ? 'text-[var(--color-secondary,#8C3A44)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
            >
              <Package
                className="w-4 h-4 transition-colors"
                style={{ color: 'var(--color-secondary, #8C3A44)' }}
              />
              <span
                className="transition-colors"
                style={{
                  color: activeTab === 'orders' ? 'var(--color-secondary, #8C3A44)' : undefined,
                }}
              >
                Live Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live sync" />
              {activeTab === 'orders' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-secondary, #8C3A44)' }}
                />
              )}
            </button>

            {/* Our Story Tab (Uses Secondary Theme Colour) */}
            <button
              onClick={() => handleNavClick('story')}
              className={`transition-colors relative py-1 cursor-pointer group ${
                activeTab === 'story'
                  ? 'text-[var(--color-secondary,#8C3A44)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
              style={{
                color: activeTab === 'story' ? 'var(--color-secondary, #8C3A44)' : undefined,
              }}
            >
              <span>Our Story</span>
              {activeTab === 'story' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-secondary, #8C3A44)' }}
                />
              )}
            </button>

            {/* Store Location Tab (Uses Secondary Theme Colour) */}
            <button
              onClick={() => handleNavClick('store')}
              className={`transition-colors relative py-1 cursor-pointer flex items-center gap-1 group ${
                activeTab === 'store'
                  ? 'text-[var(--color-secondary,#8C3A44)] font-semibold'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
              style={{
                color: activeTab === 'store' ? 'var(--color-secondary, #8C3A44)' : undefined,
              }}
            >
              <MapPin
                className="w-3.5 h-3.5 transition-colors"
                style={{ color: 'var(--color-secondary, #8C3A44)' }}
              />
              <span>Sector 46 Gurgaon</span>
              {activeTab === 'store' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-secondary, #8C3A44)' }}
                />
              )}
            </button>
          </nav>

          {/* Zone 3: Primary functional actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Owner Exclusive Controls - Only visible when owner mode is activated via Ctrl+Shift+A or URL */}
            {isOwnerMode && (
              <>
                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#8C2E46] bg-[#FDEAF0] hover:bg-[#F9D3DE] border border-[#FAD1DC] rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="Open Store Admin Panel (Owner Mode)"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C2E46]" />
                    <span>Admin Panel</span>
                  </button>
                )}

                {onOpenPhotoManager && (
                  <button
                    type="button"
                    onClick={onOpenPhotoManager}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2C2420] bg-white border border-[#EAE2D5] rounded-lg hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                    title="Upload or change photos (Owner Mode)"
                  >
                    <span>📷 Upload Photos</span>
                  </button>
                )}
              </>
            )}

            {/* Google Sign In / User Profile Button */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-[#DEC89B] bg-white hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover border border-[#DEC89B]"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#2C2420] text-[#DEC89B] flex items-center justify-center text-[10px] font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-[#2C2420] max-w-[80px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-[#DEC89B] shadow-xl p-2 z-50 animate-in fade-in duration-100">
                    <div className="p-2 border-b border-[#EAE2D5]">
                      <p className="text-xs font-bold text-[#2C2420] truncate">{user.name}</p>
                      <p className="text-[10px] text-[#7A6458] truncate">{user.email || user.phone}</p>
                    </div>
                    <button
                      onClick={() => handleNavClick('orders')}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>Live Orders</span>
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
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2420] bg-white border border-[#EAE2D5] rounded-lg hover:border-[#DEC89B] hover:bg-[#FAF7F2] transition-colors cursor-pointer shadow-2xs"
                title="Sign in with Google"
              >
                {/* Google Icon */}
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In</span>
              </button>
            )}

            {/* Shopping Bag CTA */}
            <button
              onClick={openCart}
              aria-label="View Shopping Bag"
              className="relative p-2 text-[var(--color-text,#2C2420)] hover:text-[var(--color-primary,#70252D)] transition-colors rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-[#2C2420] hover:bg-[#F4EFE6] rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#FAF7F2] border-b border-[#EAE2D5] px-4 pt-2 pb-6 space-y-2 shadow-lg animate-in fade-in duration-150">
            <button
              onClick={() => handleNavClick('home')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                activeTab === 'home' ? 'bg-[#F4EFE6] text-[#2C2420] font-semibold' : 'text-[#6B5D55]'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNavClick('catalogue')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between ${
                activeTab === 'catalogue' ? 'bg-[#FDEAF0] text-[#B83F60] font-semibold' : 'text-[#6B5D55]'
              }`}
            >
              <span>Product Catalogue</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF7F2] text-[#B83F60] border border-[#F9D3DE]">
                9 Bedsheets
              </span>
            </button>

            {/* Mobile T&C Tab */}
            <button
              onClick={() => handleNavClick('tc')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between ${
                activeTab === 'tc' ? 'bg-[#FDEAF0] text-[#B83F60] font-semibold' : 'text-[#6B5D55]'
              }`}
            >
              <span>Terms &amp; Conditions (T&amp;C)</span>
              <span className="text-xs">🌸</span>
            </button>

            {/* Mobile Customer Reviews */}
            <button
              onClick={() => handleNavClick('reviews')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between ${
                activeTab === 'reviews' ? 'bg-[#FDEAF0] text-[#B83F60] font-semibold' : 'text-[#6B5D55]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                Customer Reviews
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                4.9 ★ (Verified)
              </span>
            </button>

            {/* Mobile Live Orders */}
            <button
              onClick={() => handleNavClick('orders')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
                activeTab === 'orders'
                  ? 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-secondary,#8C3A44)] font-semibold border border-[var(--color-border,#EAE2D5)]'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Package
                  className="w-4 h-4 transition-colors"
                  style={{ color: 'var(--color-secondary, #8C3A44)' }}
                />
                Live Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={() => handleNavClick('story')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'story'
                  ? 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-secondary,#8C3A44)] font-semibold border border-[var(--color-border,#EAE2D5)]'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
            >
              Our Story &amp; Craft
            </button>
            <button
              onClick={() => handleNavClick('store')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'store'
                  ? 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-secondary,#8C3A44)] font-semibold border border-[var(--color-border,#EAE2D5)]'
                  : 'text-[var(--color-text-secondary,#6B5D55)] hover:text-[var(--color-secondary,#8C3A44)]'
              }`}
            >
              <MapPin
                className="w-3.5 h-3.5 transition-colors"
                style={{ color: 'var(--color-secondary, #8C3A44)' }}
              />
              Visit Store (Sector 46, Gurgaon)
            </button>

            {/* Mobile Auth Button */}
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuthModal?.();
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#2C2420] bg-white border border-[#DEC89B] flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In with Google</span>
              </button>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-[#DEC89B] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2C2420]">{user?.name}</p>
                  <p className="text-[11px] text-[#7A6458]">{user?.email || user?.phone}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs text-rose-600 font-semibold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}

            {isOwnerMode && (
              <>
                {onOpenPhotoManager && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenPhotoManager();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#8C2E46] bg-[#FDEAF0] border border-[#FAD1DC] flex items-center justify-between"
                  >
                    <span>📷 Upload / Change Photos</span>
                    <span className="text-[10px] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#F9D3DE]">Photo Studio</span>
                  </button>
                )}

                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAdmin();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#2C2420] bg-white border border-[#DEC89B] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#A8823B]" />
                      Admin Panel (Prices & Stock)
                    </span>
                    <span className="text-[10px] bg-[#F4EFE6] px-2 py-0.5 rounded font-bold text-[#A8823B]">Store Admin</span>
                  </button>
                )}
              </>
            )}

            <div className="pt-3 border-t border-[#EAE2D5] flex items-center gap-3">
              <a
                href={COMPANY_DETAILS.callUrl}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-[#2C2420] bg-[#F4EFE6] rounded-lg border border-[#EAE2D5]"
              >
                <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
                Call +91 7838625915
              </a>
              <a
                href={COMPANY_DETAILS.whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-[#B83F60] hover:bg-[#A33452] rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
