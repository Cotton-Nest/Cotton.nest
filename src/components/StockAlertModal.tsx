import React, { useState } from 'react';
import { X, Bell, CheckCircle2, Phone, Mail, Sparkles } from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { saveStockSubscriptionApi } from '../services/api';
import { triggerLocalPushNotification } from '../utils/pushNotifications';

interface StockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BedsheetProduct | null;
  defaultContact?: string;
}

export const StockAlertModal: React.FC<StockAlertModalProps> = ({
  isOpen,
  onClose,
  product,
  defaultContact = '',
}) => {
  const [contact, setContact] = useState(defaultContact);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = contact.trim();
    if (!clean || clean.length < 5) {
      setError('Please provide a valid WhatsApp number or email address.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await saveStockSubscriptionApi({
        id: `sub_${product.id}_${clean.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
        productId: product.id,
        productName: product.name,
        customerIdentifier: clean,
        createdAt: Date.now(),
        notified: false,
      });

      triggerLocalPushNotification(
        'Stock Alert Subscribed',
        `We will notify you immediately when "${product.name}" is back in stock at our Sector 46 Gurgaon Atelier!`,
        'stock'
      ).catch(() => {});

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Could not subscribe at this time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-md rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif-luxury font-bold text-lg text-[#2C2420]">
              Notify When Back in Stock
            </h3>
            <p className="text-xs text-[#7A6458]">
              {product.name} ({product.dimensions})
            </p>
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="font-bold text-xs text-emerald-900">
              You are on the priority restock list!
            </p>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              We will send you an alert the instant this piece is replenished in our atelier.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <p className="text-xs text-[#6B5D55] leading-relaxed">
              This signature bedsheet is currently reserved or sold out. Leave your WhatsApp number or email to receive priority notification when stock arrives.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                WhatsApp Number or Email
              </label>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 98182 34567 or pooja@example.com"
                className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
              />
              {error && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#70252D] hover:bg-[#5b1e24] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>{submitting ? 'Saving Subscription...' : 'Notify Me on Restock'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
