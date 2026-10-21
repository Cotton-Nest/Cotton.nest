import React, { useState } from 'react';
import { X, Lock, Phone, Mail, CheckCircle2, ArrowRight, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGoogleChooser?: () => void;
  onTrackOrderDirect?: (orderId: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenGoogleChooser,
  onTrackOrderDirect,
}) => {
  const { loginWithGoogle, loginWithPhone, loginWithEmail, user } = useAuth();
  const [tab, setTab] = useState<'signin' | 'track'>('signin');
  
  // Custom Google input state if user wants to type a specific Google email
  const [customGoogleEmail, setCustomGoogleEmail] = useState('adityaa.22082011@gmail.com');
  const [customGoogleName, setCustomGoogleName] = useState('Aditya');
  const [showAdvancedGoogle, setShowAdvancedGoogle] = useState(false);

  // Phone sign-in state
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  // Direct track order state
  const [trackOrderId, setTrackOrderId] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
    if (onOpenGoogleChooser) {
      onOpenGoogleChooser();
    } else {
      loginWithGoogle({
        email: customGoogleEmail.trim().toLowerCase(),
        name: customGoogleName.trim() || 'Valued Customer',
      });
    }
  };

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
            {tab === 'signin' ? 'Sign In to Your Account' : 'Track Your Order'}
          </h3>
          <p className="text-xs text-[#7A6458]">
            {tab === 'signin'
              ? 'View live atelier status, dispatch tracking, and invoices for your bedsheet orders.'
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
            
            {/* Primary Google Login Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-xl font-medium text-sm shadow-xs transition-all cursor-pointer group"
              >
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowAdvancedGoogle(!showAdvancedGoogle)}
                  className="text-[11px] text-[#7A6458] hover:text-[#2C2420] underline transition-colors cursor-pointer"
                >
                  {showAdvancedGoogle ? '▲ Hide Google Account Details' : '▼ Sign in with specific Google Email'}
                </button>
              </div>

              {showAdvancedGoogle && (
                <form onSubmit={handleGoogleSignIn} className="p-3 bg-white rounded-xl border border-[#EAE2D5] space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-[#7A6458] mb-1">Your Google Email:</label>
                    <input
                      type="email"
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="adityaa.22082011@gmail.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-[#DEC89B] bg-[#FAF7F2] text-[#2C2420] focus:outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#7A6458] mb-1">Full Name:</label>
                    <input
                      type="text"
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      placeholder="Aditya"
                      className="w-full px-3 py-1.5 rounded-lg border border-[#DEC89B] bg-[#FAF7F2] text-[#2C2420] focus:outline-hidden"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#2C2420] hover:bg-[#3D332D] text-white rounded-lg font-medium text-xs transition-colors cursor-pointer"
                  >
                    Confirm & Sign In with Google
                  </button>
                </form>
              )}
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
              <span>Orders placed via WhatsApp or checkout are linked automatically to your phone/email.</span>
            </div>

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
