import React, { useState } from 'react';
import { X, Lock, Phone, Mail, CheckCircle2, ArrowRight, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOwnerAuth?: () => void;
  onTrackOrderDirect?: (orderId: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenOwnerAuth,
  onTrackOrderDirect,
}) => {
  const { loginWithPhone, loginWithGoogleDirect, user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'signin' | 'track'>('signin');

  // Phone sign-in state
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  // Direct track order state
  const [trackOrderId, setTrackOrderId] = useState('');

  if (!isOpen) return null;

  const handlePhoneSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) return;
    loginWithPhone(phone, name || 'Cotton Nest Client');
    onClose();
  };

  const handleDirectTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackOrderId) return;
    if (onTrackOrderDirect) {
      onTrackOrderDirect(trackOrderId.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-md rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden p-6 sm:p-7 space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full bg-white/80 border border-[#EAE2D5] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6] text-[#A8823B] text-[11px] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
            Cotton Nest · Client Atelier
          </div>
          <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
            {tab === 'signin' ? 'Sign In with Google' : 'Track Your Order'}
          </h3>
          <p className="text-xs text-[#7A6458]">
            {tab === 'signin'
              ? 'Connect securely with Google to view live atelier order status, dispatch tracking, and invoices.'
              : 'Track the live status of any order using your Order ID.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#EAE2D5]/50 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-white text-[#2C2420] shadow-xs'
                : 'text-[#7A6458] hover:text-[#2C2420]'
            }`}
          >
            Google / Phone Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('track')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'track'
                ? 'bg-white text-[#2C2420] shadow-xs'
                : 'text-[#7A6458] hover:text-[#2C2420]'
            }`}
          >
            Track by Order ID
          </button>
        </div>

        {tab === 'signin' ? (
          <div className="space-y-4">
            
            {/* Primary Google Login Button directly connected to real Google Sign-In API */}
            <div className="space-y-2">
              <GoogleSignInButton
                onSuccess={onClose}
                variant="standard"
                customText="Sign in with Google API"
              />
              <button
                type="button"
                onClick={() => {
                  loginWithGoogleDirect();
                  onClose();
                }}
                className="w-full py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F4EFE6] active:bg-[#EAE2D5] border border-[#DEC89B] rounded-xl text-xs font-semibold text-[#70252D] flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                <span>1-Click Owner Sign-In (adityaa.22082011@gmail.com)</span>
              </button>
              <p className="text-[11px] text-[#7A6458] text-center">
                Uses official Google OAuth 2.0 authentication.
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-[#EAE2D5]"></div>
              <span className="shrink mx-3 text-[11px] text-[#7A6458] uppercase font-semibold">Or continue with phone</span>
              <div className="grow border-t border-[#EAE2D5]"></div>
            </div>

            {/* Phone Sign-In Form */}
            <form onSubmit={handlePhoneSignIn} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#2C2420] mb-1">
                  Mobile Number (WhatsApp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#7A6458]">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98182 34567"
                    className="w-full pl-12 pr-3 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2C2420] mb-1">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pooja Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#B83F60] hover:bg-[#A33452] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Sign In with Phone</span>
              </button>
            </form>

            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-[11px] text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Orders placed via WhatsApp or checkout are linked automatically to your account.</span>
            </div>

            {onOpenOwnerAuth && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={onOpenOwnerAuth}
                  className="text-xs text-[#8C2E46] hover:text-[#742438] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Store Owner? Enter PIN (2508) or Google Admin Access</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Track Order Direct Tab */
          <form onSubmit={handleDirectTrack} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#2C2420] mb-1">
                Order Reference Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={trackOrderId}
                  onChange={(e) => setTrackOrderId(e.target.value)}
                  placeholder="e.g. CN-920415 or CN-783921"
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57] uppercase font-mono"
                  required
                />
                <Search className="w-4 h-4 text-[#A89890] absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-[#7A6458] mt-1">
                Found in your WhatsApp order message or checkout confirmation.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#2C2420] hover:bg-[#3D332D] text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Track Live Delivery Status</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
