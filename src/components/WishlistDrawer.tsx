import React from 'react';
import { X, Heart, ShoppingBag, Trash2, MessageCircle, ArrowRight, Sparkles, User, Edit2 } from 'lucide-react';
import { WishlistItem, CustomerProfile } from '../data/wishlist';
import { sendWhatsAppProductOrder } from '../utils/whatsappOrder';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: WishlistItem[];
  customerProfile: CustomerProfile;
  onRemoveItem: (id: string) => void;
  onMoveToCart: (item: WishlistItem) => void;
  onEditProfile: () => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  items,
  customerProfile,
  onRemoveItem,
  onMoveToCart,
  onEditProfile,
}) => {
  const [copiedCode, setCopiedCode] = React.useState(false);

  if (!isOpen) return null;

  const totalValue = items.reduce((acc, item) => acc + (item.productPrice || 0), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[var(--color-surface,#FFFFFF)] shadow-2xl flex flex-col border-l border-[var(--color-border,#EAE2D5)]">
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                <Heart className="w-4 h-4 fill-rose-500" />
              </div>
              <div>
                <h2 className="font-serif-luxury text-base font-bold text-[var(--color-text,#2C2420)]">
                  Your Curated Wishlist
                </h2>
                <p className="text-[11px] text-[#7A6458]">
                  {items.length} {items.length === 1 ? 'bedsheet saved' : 'bedsheets saved'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#6B5D55] hover:text-[#2C2420] rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Customer Profile Banner */}
          <div className="px-5 py-2.5 bg-[#FAF7EE] border-b border-[#DEC89B]/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <User className="w-3.5 h-3.5 text-[#8C2E46] shrink-0" />
              <span className="font-semibold text-[#2C2420] truncate">
                {customerProfile.name}
              </span>
              {(customerProfile.phone || customerProfile.email) && (
                <span className="text-[10px] text-[#7A6458] truncate">
                  ({customerProfile.phone || customerProfile.email})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onEditProfile}
              className="text-[11px] font-semibold text-[#8C2E46] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>

          {/* Wishlist Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 3-Day Retention 5% Coupon Reward Banner */}
            {items.some((it) => (Date.now() - (it.createdAt || 0)) >= 3 * 24 * 60 * 60 * 1000) && (
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-rose-50 rounded-2xl border border-amber-300 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#8C2E46]">
                    <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>5% Wishlist Loyalty Reward Unlocked!</span>
                  </span>
                  <span className="text-[10px] font-bold bg-[#8C2E46] text-white px-2 py-0.5 rounded-full">
                    3+ Days Saved
                  </span>
                </div>
                <p className="text-[11px] text-[#6B5D55] leading-relaxed">
                  Because you've kept your favorites saved for 3 days, enjoy an exclusive <strong>5% discount</strong> on your order!
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-[#8C2E46]">
                    <span>WISHLIST5</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('WISHLIST5');
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-[#8C2E46] hover:bg-[#732438] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedCode ? '✓ Copied!' : 'Copy 5% Code'}
                  </button>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-300">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="font-serif-luxury text-base font-medium text-[#2C2420]">
                  Your wishlist is empty
                </h3>
                <p className="text-xs text-[#7A6458] max-w-xs mx-auto">
                  Click the heart icon on any pure cotton bedsheet in our catalogue to curate your personal collection.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const daysSaved = Math.max(0, Math.floor((Date.now() - (item.createdAt || Date.now())) / (1000 * 60 * 60 * 24)));
                const isThreeDays = daysSaved >= 3;

                return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-[var(--color-border,#EAE2D5)] bg-white shadow-2xs flex gap-3 hover:border-[#DEC89B] transition-colors"
                >
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-20 h-20 rounded-xl object-cover border border-[#EAE2D5] bg-[#F4EFE6] shrink-0"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-[#2C2420] line-clamp-1">
                          {item.productName}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-[#A8988D] hover:text-rose-600 transition-colors p-1"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[10px] text-[#7A6458] mt-0.5">
                        {item.threadCount || 'Pure Cotton'} · {item.productDimensions || 'King Size'}
                        {item.selectedVariantName ? ` · ${item.selectedVariantName}` : ''}
                      </p>

                      {/* 3-Day Loyalty Status Badge */}
                      {isThreeDays ? (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md w-fit">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          <span>5% Coupon Unlocked (Saved {daysSaved}d)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#8C7A70]">
                          <span>Saved {daysSaved === 0 ? 'today' : `${daysSaved}d ago`} · {3 - daysSaved}d left for 5% coupon</span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-xs font-bold text-[#2C2420]">
                          ₹{item.productPrice.toLocaleString('en-IN')}
                        </span>
                        {item.productOriginalPrice > item.productPrice && (
                          <span className="text-[10px] text-[#9B8C83] line-through">
                            ₹{item.productOriginalPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#F4EFE6] mt-2">
                      <button
                        type="button"
                        onClick={() => onMoveToCart(item)}
                        className="flex-1 py-1.5 px-2 bg-[var(--color-primary,#70252D)] text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 hover:brightness-95 transition-all cursor-pointer"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>Move to Bag</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sendWhatsAppProductOrder({
                            productId: item.productId,
                            productName: item.productName,
                            variantName: item.selectedVariantName,
                            dimensions: item.productDimensions || 'King Size',
                            price: item.productPrice,
                            imageUrl: item.productImage,
                            customerName: customerProfile?.name || item.customerName,
                            customerPhone: customerProfile?.phone || item.customerPhone,
                            customerEmail: customerProfile?.email || item.customerEmail,
                            source: 'wishlist_enquiry',
                          });
                        }}
                        className="py-1.5 px-2 bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] text-[11px] font-medium rounded-lg hover:bg-[#F4EFE6] transition-colors cursor-pointer flex items-center gap-1"
                        title="Inquire on WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-600" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>

          {/* Drawer Footer */}
          {items.length > 0 && (
            <div className="p-5 border-t border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] space-y-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[#6B5D55]">Curated Wishlist Total:</span>
                <span className="font-serif-luxury text-base font-bold text-[#2C2420]">
                  ₹{totalValue.toLocaleString('en-IN')}
                </span>
              </div>

              <p className="text-[11px] text-[#7A6458]">
                Wishlisted items are saved permanently under your contact and synced with the atelier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
