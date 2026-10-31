import React, { useState } from 'react';
import { X, Heart, ShieldCheck, Sparkles, User, Phone, Mail } from 'lucide-react';
import { CustomerProfile, saveCurrentCustomerProfile } from '../data/wishlist';

interface CustomerWishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (profile: CustomerProfile) => void;
  pendingProductName?: string;
}

export const CustomerWishlistModal: React.FC<CustomerWishlistModalProps> = ({
  isOpen,
  onClose,
  onConfirmed,
  pendingProductName,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide your name so we can personalize your wishlist.');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanPhone && !cleanEmail) {
      setError('Please provide either your WhatsApp number or Email to save your curated bedsheets.');
      return;
    }

    const profile = saveCurrentCustomerProfile({
      name: cleanName,
      phone: cleanPhone || undefined,
      email: cleanEmail || undefined,
    });

    onConfirmed(profile);
    onClose();
  };

  const handleContinueAsGuest = () => {
    const profile = saveCurrentCustomerProfile({
      name: 'Atelier Guest',
    });
    onConfirmed(profile);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[var(--color-surface,#FFFFFF)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--color-border,#EAE2D5)]">
        {/* Header Strip */}
        <div className="px-6 pt-6 pb-4 bg-[var(--color-background,#FAF7F2)] border-b border-[var(--color-border,#EAE2D5)] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-2xs">
              <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="font-serif-luxury text-lg font-bold text-[var(--color-text,#2C2420)]">
                Save to Your Wishlist
              </h3>
              <p className="text-xs text-[#7A6458]">
                {pendingProductName ? `Saving "${pendingProductName}"` : 'Curate your favorite pure cotton designs'}
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

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-[#6B5D55] leading-relaxed">
            Enter your details below so the Cotton Nest team can save your choices, offer tailored festival discounts, and notify you if low in stock.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
              Your Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Priya Sharma"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
              WhatsApp / Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 9811122334"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>
            <p className="text-[10px] text-[#8C7A70] mt-1">
              We send direct WhatsApp stock alerts and exclusive festival pricing.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
              Email Address (Optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="e.g. priya@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-[var(--color-primary,#70252D)] hover:brightness-95 text-[var(--color-primary-contrast,#FFFFFF)] text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Save &amp; Keep in Wishlist</span>
            </button>

            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="w-full py-2.5 text-xs font-semibold text-[#7A6458] hover:text-[#2C2420] cursor-pointer"
            >
              Skip and continue as Guest
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
