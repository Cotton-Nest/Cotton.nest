import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Search,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  Loader2,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { sendEmailOtpApi, verifyEmailOtpApi } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOwnerAuth?: () => void;
  onTrackOrderDirect?: (orderId: string) => void;
  reason?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenOwnerAuth,
  onTrackOrderDirect,
  reason,
}) => {
  const { loginWithEmail } = useAuth();
  const [tab, setTab] = useState<'signin' | 'track'>('signin');

  // Gmail / Email OTP State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [authErrorDetails, setAuthErrorDetails] = useState<{
    senderEmail: string;
    fullSenderEmail: string;
    passLength: number;
    is16Chars: boolean;
    helpUrl: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Direct track order state
  const [trackOrderId, setTrackOrderId] = useState('');

  // Handle Resend Cooldown Countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Reset transient error when switching modal state
  useEffect(() => {
    if (!isOpen) {
      setOtpError(null);
      setIsSending(false);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendGmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setOtpError('Please enter a valid Gmail / Email address.');
      return;
    }

    setIsSending(true);
    setOtpError(null);
    setAuthErrorDetails(null);

    try {
      const res = await sendEmailOtpApi(cleanEmail);
      if (res.success) {
        setOtpSent(true);
        setCooldown(res.cooldownSeconds || 60);
        setEnteredOtp('');
        setAuthErrorDetails(null);
      } else {
        setOtpError(res.error || 'Failed to deliver OTP email. Please verify your address and try again.');
        if (res.authErrorDetails) {
          setAuthErrorDetails(res.authErrorDetails);
        }
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Network error while contacting the verification service.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isSending) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsSending(true);
    setOtpError(null);
    setAuthErrorDetails(null);

    try {
      const res = await sendEmailOtpApi(cleanEmail);
      if (res.success) {
        setCooldown(res.cooldownSeconds || 60);
        setAuthErrorDetails(null);
      } else {
        setOtpError(res.error || 'Failed to resend verification code. Please try again.');
        if (res.authErrorDetails) {
          setAuthErrorDetails(res.authErrorDetails);
        }
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to resend verification code.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = enteredOtp.trim();
    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    setOtpError(null);

    try {
      const res = await verifyEmailOtpApi(email.trim().toLowerCase(), cleanCode);
      if (res.success) {
        loginWithEmail(email.trim().toLowerCase(), name.trim() || email.split('@')[0]);
        setOtpSent(false);
        setEnteredOtp('');
        setOtpError(null);
        onClose();
      } else {
        setOtpError(res.error || 'Invalid verification code. Please check your email and try again.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
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
          aria-label="Close"
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
              ? 'Connect securely with Google or Gmail OTP to view orders, save addresses, and add bedsheets to your bag.'
              : 'Track the live status of any order using your Order ID.'}
          </p>
        </div>

        {/* Optional Action Reason Banner (e.g. Before adding to cart) */}
        {reason && tab === 'signin' && (
          <div className="p-3 bg-[#F4EFE6] rounded-2xl border border-[#DEC89B] text-xs text-[#70252D] font-medium flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-[#C29E57] shrink-0" />
            <span>{reason}</span>
          </div>
        )}

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
            Google / Gmail Sign In
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
                customText="Continue with Google"
              />
              <p className="text-[11px] text-[#7A6458] text-center">
                Uses official Google OAuth 2.0 authentication.
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-[#EAE2D5]"></div>
              <span className="shrink mx-3 text-[11px] text-[#7A6458] uppercase font-semibold">Or sign in with Gmail OTP</span>
              <div className="grow border-t border-[#EAE2D5]"></div>
            </div>

            {/* Gmail OTP Sign-In Form */}
            {!otpSent ? (
              <form onSubmit={handleSendGmailOtp} className="space-y-3">
                {/* Pre-Send Customer Message */}
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] text-xs text-[#4A3B32] space-y-1">
                  <div className="flex items-start gap-2">
                    <Inbox className="w-4 h-4 text-[#8C2E46] shrink-0 mt-0.5" />
                    <p className="text-[11.5px] leading-relaxed">
                      Your verification code will be sent by email from <strong>Cotton Nest</strong> with the subject <strong>Cotton Nest OTP</strong>. Please check your inbox and spam folder.
                    </p>
                  </div>
                </div>

                {otpError && (
                  <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <div className="space-y-1.5 text-[11.5px] leading-relaxed flex-1">
                        <p className="font-semibold text-red-900">{otpError}</p>
                        {authErrorDetails && (
                          <div className="pt-2 border-t border-red-200/80 space-y-1.5 text-[11px] text-red-800">
                            <p>
                              <strong>Configured sender:</strong> <span className="font-mono bg-red-100/60 px-1 py-0.5 rounded">{authErrorDetails.senderEmail}</span>
                            </p>
                            <p className="text-red-700">
                              Google requires a <strong>16-character App Password</strong> generated on that specific Google account. Standard Gmail passwords are not supported for SMTP.
                            </p>
                            <div className="pt-1">
                              <a
                                href={authErrorDetails.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#8C2E46] hover:underline bg-white px-2.5 py-1 rounded-lg border border-red-200 shadow-2xs"
                              >
                                <span>Generate Google App Password ↗</span>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Gmail / Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A89890]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      disabled={isSending}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57] disabled:opacity-60"
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
                    disabled={isSending}
                    className="w-full px-3 py-2 rounded-xl border border-[#DEC89B] bg-white text-sm text-[#2C2420] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57] disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-3 bg-[#8C2E46] hover:bg-[#722338] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send OTP to Gmail</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {/* Post-Send Customer Message */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-800">
                        OTP sent! Look for an email from Cotton Nest with the subject Cotton Nest OTP.
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Dispatched to <strong>{email}</strong>. Check your inbox & spam folder. Code expires in 5 minutes.
                      </p>
                    </div>
                  </div>
                </div>

                {otpError && (
                  <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{otpError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Enter 6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    disabled={isVerifying}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-center tracking-widest text-xl font-bold text-[#8C2E46] placeholder-[#A89890] focus:outline-hidden focus:ring-1 focus:ring-[#C29E57] disabled:opacity-60"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] px-1 text-[#7A6458]">
                  <span>Didn&apos;t receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldown > 0 || isSending}
                    className="font-semibold text-[#8C2E46] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span>Resend OTP in {cooldown}s</span>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Resend OTP</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setEnteredOtp('');
                      setOtpError(null);
                    }}
                    disabled={isVerifying}
                    className="w-1/3 py-2.5 bg-white hover:bg-[#FAF7F2] text-[#7A6458] border border-[#DEC89B] rounded-xl font-semibold text-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Change Email
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || enteredOtp.trim().length !== 6}
                    className="w-2/3 py-2.5 bg-[#8C2E46] hover:bg-[#722338] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify & Sign In</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] flex items-center gap-2 text-[11px] text-[#7A6458]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your cart items, wishlist, and saved addresses are securely preserved.</span>
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
