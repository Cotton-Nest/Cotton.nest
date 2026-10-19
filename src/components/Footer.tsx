import React from 'react';
import { Phone, MessageCircle, MapPin, Heart, Lock, Unlock } from 'lucide-react';
import { COMPANY_DETAILS } from '../data/products';

interface FooterProps {
  onNavClick: (tab: 'home' | 'catalogue' | 'story' | 'store' | 'tc' | 'reviews') => void;
  onOpenAdmin?: () => void;
  isOwnerMode?: boolean;
  onOpenOwnerAuth?: () => void;
  onLockOwnerMode?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavClick,
  onOpenAdmin,
  isOwnerMode = false,
  onOpenOwnerAuth,
  onLockOwnerMode,
}) => {
  return (
    <footer
      className="border-t border-[var(--color-border,#EAE2D5)] pt-12 pb-24 md:pb-12 transition-colors"
      style={{
        backgroundColor: 'var(--color-footer,#2C2420)',
        color: 'var(--color-footer-text,#FAF7F2)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
          
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <button
              onClick={() => onNavClick('home')}
              className="text-left font-serif-luxury text-2xl font-bold transition-colors cursor-pointer"
              style={{ color: 'var(--color-footer-text,#FAF7F2)' }}
            >
              Cotton Nest
            </button>
            
            <p className="text-xs sm:text-sm max-w-sm leading-relaxed opacity-85">
              Crafting premium 100% pure cotton bedsheets with serene comfort, subtle floral elegance, 
              and oversized 108″ × 108″ King proportions for Indian homes.
            </p>

            <div className="space-y-1.5 text-xs text-[#4A3E38] pt-1">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#C29E57] shrink-0 mt-0.5" />
                <span>House Number 2508, Ground Floor, Sector 46, Gurgaon, Haryana</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#B83F60] shrink-0" />
                <a href={COMPANY_DETAILS.callUrl} className="hover:underline font-semibold">
                  +91 7838625915
                </a>
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider">
              Quick Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavClick('home')}
                  className="hover:text-[#B83F60] transition-colors cursor-pointer"
                >
                  Home Showcase
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('catalogue')}
                  className="hover:text-[#B83F60] font-semibold text-[#B83F60] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Product Catalogue</span>
                  <span className="text-[10px] bg-[#FDEAF0] text-[#B83F60] px-1.5 rounded border border-[#FAD1DC]">
                    9 Bedsheets
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('story')}
                  className="hover:text-[#B83F60] transition-colors cursor-pointer"
                >
                  Why 100% Pure Cotton
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('store')}
                  className="hover:text-[#B83F60] transition-colors cursor-pointer"
                >
                  Visit Studio (Sector 46 Gurgaon)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('reviews')}
                  className="hover:text-[#B83F60] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Customer Reviews &amp; Comments</span>
                  <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200 font-semibold">
                    4.9 ★
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('tc')}
                  className="hover:text-[#B83F60] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Terms &amp; Conditions (T&amp;C)</span>
                  <span className="text-[10px] text-[#B83F60]">🌸</span>
                </button>
              </li>
              {isOwnerMode && onOpenAdmin && (
                <li className="pt-1">
                  <button
                    onClick={onOpenAdmin}
                    className="text-[#8C2E46] hover:underline font-semibold flex items-center gap-1 transition-colors cursor-pointer text-xs"
                  >
                    <span>⚙️ Store Admin Panel (Owner Mode)</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Contact & Orders */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider">
              Instant Ordering &amp; Support
            </h4>
            <p className="text-xs text-[#7A6458]">
              Have a question about fabric thickness or need recommendations? 
              Chat with our founder directly on WhatsApp.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={COMPANY_DETAILS.whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp (+91 7838625915)</span>
              </a>

              <a
                href={COMPANY_DETAILS.callUrl}
                className="py-2.5 px-3.5 bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#C29E57]" />
                <span>Call Studio</span>
              </a>
            </div>

            <div className="pt-2 text-[11px] text-[#9B8C83]">
              Operating Hours: Mon - Sun · 10:00 AM - 8:30 PM IST
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#9B8C83] gap-3">
          <div className="flex items-center gap-3">
            <p>© {new Date().getFullYear()} Cotton Nest. All rights reserved.</p>
            
            {/* Owner mode active indicator */}
            {isOwnerMode && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC] flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  Owner Mode
                </span>
                {onOpenAdmin && (
                  <button
                    onClick={onOpenAdmin}
                    className="text-[#8C2E46] hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Open Admin
                  </button>
                )}
                {onLockOwnerMode && (
                  <button
                    onClick={onLockOwnerMode}
                    className="text-[#7A6458] hover:text-[#2C2420] text-[11px] hover:underline cursor-pointer"
                  >
                    Lock
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[#7A6458]">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-[#B83F60] fill-current" />
            <span>for restful Indian homes in Gurgaon</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
