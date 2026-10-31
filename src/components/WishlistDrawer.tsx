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
              items.map((item) => (
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
                            productName: item.productName,
                            variantName: item.selectedVariantName,
                            dimensions: item.productDimensions || 'King Size',
                            price: item.productPrice,
                            imageUrl: item.productImage,
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
              ))
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
