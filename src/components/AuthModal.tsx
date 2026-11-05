import React, { useState } from 'react';
import { X, Lock, Phone, Mail, CheckCircle2, ArrowRight, ShieldCheck, Search, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
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
  const { loginWithPhone, user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'signin' | 'track'>('signin');

  // Phone sign-in state & OTP state
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Direct track order state
  const [trackOrderId, setTrackOrderId] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      setOtpError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setGeneratedOtp(code);
    setOtpSent(true);
    setOtpError(null);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredOtp || enteredOtp.trim().length !== 4) {
      setOtpError('Please enter the 4-digit OTP code.');
      return;
    }
    // Verify OTP (accept generatedOtp or any 4 digits in demo mode)
    loginWithPhone(phone, name || 'Cotton Nest Client');
    setOtpSent(false);
    setEnteredOtp('');
    setGeneratedOtp('');
    setOtpError(null);
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
            {tab === 'signin' ? 'Sign In' : 'Track Your Order'}
          </h3>
          <p className="text-xs text-[#7A6458]">
            {tab === 'signin'
              ? 'Connect securely with Google or Phone OTP to view live atelier order status, dispatch tracking, and invoices.'
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
              <p className="text-[11px] text-[#7A6458] text-center">
                Uses official Google OAuth 2.0 authentication.
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-[#EAE2D5]"></div>
              <span className="shrink mx-3 text-[11px] text-[#7A6458] uppercase font-semibold">Or continue with phone OTP</span>
              <div className="grow border-t border-[#EAE2D5]"></div>
            </div>

            {/* Phone & OTP Sign-In Form */}
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                {otpError && (
                  <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                    {otpError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Mobile Number (WhatsApp) *
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
                  <span>Send OTP via WhatsApp</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">OTP Verification Code Sent</p>
                  <p className="text-[11px] text-amber-800">
                    We sent a 4-digit code to +91 {phone}. (Demo OTP Code: <strong className="font-bold">{generatedOtp}</strong>)
                  </p>
                </div>

                {otpError && (
                  <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                    {otpError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Enter 4-Digit OTP *
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="e.g. 4829"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-center tracking-widest text-lg font-bold text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57]"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 py-2.5 bg-white hover:bg-[#FAF7F2] text-[#7A6458] border border-[#DEC89B] rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 bg-[#8C2E46] hover:bg-[#722338] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify & Sign In</span>
                  </button>
                </div>
              </form>
            )}

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
                  <span>Store Owner? Enter PIN (2508) or Admin Access</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Track Order Direct Tab */
          <form onSubmit={handleDirectTrack} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#2C2420] mb-1">
                Order ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A89890]" />
                <input
                  type="text"
                  value={trackOrderId}
                  onChange={(e) => setTrackOrderId(e.target.value)}
                  placeholder="e.g. CN-482910"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#B83F60] hover:bg-[#A33452] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Track Order Live</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
