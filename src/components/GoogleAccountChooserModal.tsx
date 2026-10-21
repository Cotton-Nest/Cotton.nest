import React, { useState } from 'react';
import { X, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface GoogleAccountItem {
  id: string;
  name: string;
  email: string;
  avatarType: 'initial' | 'mountain';
  initialChar?: string;
  bgColor?: string;
  phone?: string;
}

export const INITIAL_GOOGLE_ACCOUNTS: GoogleAccountItem[] = [
  {
    id: 'adityaa-primary',
    name: 'Adityaa',
    email: 'adityaa.22082011@gmail.com',
    avatarType: 'initial',
    initialChar: 'A',
    bgColor: '#3367D6', // Google Blue
    phone: '7838625915',
  },
  {
    id: 'adityaa-grover',
    name: 'Adityaa Grover',
    email: 'adityaa.451485@gmail.com',
    avatarType: 'mountain',
    phone: '7838625915',
  },
  {
    id: 'saurabh-grover',
    name: 'saurabh grover',
    email: 'saurabh.451485@gmail.com',
    avatarType: 'initial',
    initialChar: 's',
    bgColor: '#C2410C', // Rust/burnt orange matching screenshot
    phone: '7838625915',
  },
];

export const MOUNTAIN_AVATAR_DATA_URI = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%231d4ed8"/><stop offset="50%" stop-color="%2360a5fa"/><stop offset="100%" stop-color="%2393c5fd"/></linearGradient><linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%231e3a8a"/><stop offset="100%" stop-color="%230b132b"/></linearGradient></defs><rect width="100" height="60" fill="url(%23sky)"/><polygon points="10,60 35,26 55,60" fill="%23475569" opacity="0.95"/><polygon points="35,26 42,35 38,38 35,26" fill="%23ffffff"/><polygon points="30,60 62,16 90,60" fill="%231e293b"/><polygon points="62,16 69,25 63,28 58,24 62,16" fill="%23ffffff"/><polygon points="0,60 20,40 45,60" fill="%230b132b" opacity="0.85"/><rect y="60" width="100" height="40" fill="url(%23lake)"/><line x1="25" y1="68" x2="75" y2="68" stroke="%2393c5fd" stroke-width="1.5" opacity="0.5"/><line x1="38" y1="75" x2="65" y2="75" stroke="%23bfdbfe" stroke-width="1" opacity="0.4"/></svg>`;

export const getInitialAvatarDataUri = (char: string, bgColor: string) => {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${encodeURIComponent(bgColor)}"/><text x="50" y="64" font-size="46" font-family="-apple-system,BlinkMacSystemFont,Roboto,sans-serif" font-weight="500" fill="%23ffffff" text-anchor="middle">${encodeURIComponent(char)}</text></svg>`;
};

const MountainAvatar: React.FC = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    <defs>
      <linearGradient id="gSky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1D4ED8" />
        <stop offset="50%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#93C5FD" />
      </linearGradient>
      <linearGradient id="gLake" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0B132B" />
      </linearGradient>
      <linearGradient id="gPeak1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <linearGradient id="gPeak2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#64748B" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>
    <rect width="100" height="60" fill="url(#gSky)" />
    <polygon points="10,60 35,26 55,60" fill="url(#gPeak2)" opacity="0.95" />
    <polygon points="35,26 42,35 38,38 35,26" fill="#FFFFFF" opacity="0.95" />
    <polygon points="30,60 62,16 90,60" fill="url(#gPeak1)" />
    <polygon points="62,16 69,25 63,28 58,24 62,16" fill="#FFFFFF" />
    <polygon points="0,60 20,40 45,60" fill="#0B132B" opacity="0.85" />
    <rect y="60" width="100" height="40" fill="url(#gLake)" />
    <line x1="25" y1="68" x2="75" y2="68" stroke="#93C5FD" strokeWidth="1.5" opacity="0.5" />
    <line x1="38" y1="75" x2="65" y2="75" stroke="#BFDBFE" strokeWidth="1" opacity="0.4" />
  </svg>
);

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenPhoneAuth?: () => void;
}

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenPhoneAuth,
}) => {
  const { loginWithGoogle } = useAuth();
  const [view, setView] = useState<'chooser' | 'another_account'>('chooser');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [customAccounts, setCustomAccounts] = useState<GoogleAccountItem[]>(() => {
    try {
      const stored = localStorage.getItem('cotton_nest_google_accounts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_GOOGLE_ACCOUNTS;
  });

  if (!isOpen) return null;

  const handleSelectAccount = (account: GoogleAccountItem) => {
    setSelectedAccountId(account.id);
    setIsAuthenticating(true);

    const avatarUrl =
      account.avatarType === 'mountain'
        ? MOUNTAIN_AVATAR_DATA_URI
        : getInitialAvatarDataUri(account.initialChar || account.name.charAt(0), account.bgColor || '#3367D6');

    setTimeout(() => {
      loginWithGoogle({
        name: account.name,
        email: account.email,
        avatar: avatarUrl,
        phone: account.phone || '7838625915',
      });
      setIsAuthenticating(false);
      setSelectedAccountId(null);
      if (onSuccess) onSuccess();
      onClose();
    }, 600);
  };

  const handleCreateAnotherAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) return;

    const emailTrimmed = customEmail.trim().toLowerCase();
    const nameTrimmed = customName.trim() || emailTrimmed.split('@')[0];

    const newAccount: GoogleAccountItem = {
      id: `google-${Date.now()}`,
      name: nameTrimmed,
      email: emailTrimmed,
      avatarType: 'initial',
      initialChar: nameTrimmed.charAt(0).toUpperCase(),
      bgColor: '#1A73E8',
      phone: '7838625915',
    };

    const updated = [...customAccounts, newAccount];
    setCustomAccounts(updated);
    try {
      localStorage.setItem('cotton_nest_google_accounts', JSON.stringify(updated));
    } catch {}

    handleSelectAccount(newAccount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#000000]/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={isAuthenticating ? undefined : onClose} />

      {/* Main Container - replicates the Google OAuth "Choose an account" card */}
      <div className="relative bg-white w-full max-w-[760px] rounded-[28px] border border-[#E0E2EC] shadow-2xl z-10 text-[#1F1F1F] overflow-hidden p-6 sm:p-10 transition-all font-sans">
        
        {/* Google Authentication Progress Bar */}
        {isAuthenticating && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-100 overflow-hidden">
            <div className="h-full bg-[#0B57D0] animate-pulse w-full" />
          </div>
        )}

        {/* Top Header Bar matching screenshot */}
        <div className="flex items-center justify-between pb-6 sm:pb-8">
          <div className="flex items-center gap-2.5">
            {/* Google 4-Color 'G' Logo */}
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
            <span className="text-[14px] font-medium text-[#1F1F1F]">Sign in with Google</span>
          </div>

          <button
            onClick={onClose}
            disabled={isAuthenticating}
            className="p-1.5 text-[#5F6368] hover:text-[#1F1F1F] hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'chooser' ? (
          /* ================= VIEW 1: CHOOSE AN ACCOUNT ================= */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            
            {/* Left Column: Cloud Logo & App Title */}
            <div className="md:col-span-5 flex flex-col justify-start">
              {/* Cloudinary-style Cloud outline icon with 3 vertical bars */}
              <div className="w-12 h-12 text-[#185ABC] mb-5">
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                  <path
                    d="M38 34H12C7.58172 34 4 30.4183 4 26C4 21.8488 7.16456 18.4357 11.2335 18.0416C12.4414 11.229 18.3756 6 25.5 6C33.7843 6 40.5 12.7157 40.5 21C40.5 21.4191 40.4828 21.8341 40.449 22.2443C42.5407 23.3649 44 25.5186 44 28C44 31.3137 41.3137 34 38 34Z"
                    stroke="#185ABC"
                    strokeWidth="3.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 22V31M25 18V31M31 22V31"
                    stroke="#185ABC"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h1 className="text-[32px] sm:text-[34px] font-normal text-[#1F1F1F] tracking-tight leading-tight">
                Choose an account
              </h1>
              <p className="text-[14px] text-[#1F1F1F] mt-3 font-normal">
                to continue to{' '}
                <span className="text-[#0B57D0] font-medium cursor-pointer hover:underline">
                  Cotton Nest
                </span>
              </p>
            </div>

            {/* Right Column: Account List matching the screenshot */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-4">
              <div className="divide-y divide-[#E0E2EC] border-b border-[#E0E2EC]">
                {customAccounts.map((account) => {
                  const isSelected = selectedAccountId === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      disabled={isAuthenticating}
                      onClick={() => handleSelectAccount(account)}
                      className={`w-full py-3 px-2 sm:px-3 flex items-center gap-3.5 text-left transition-colors cursor-pointer rounded-lg hover:bg-[#F8F9FA] group ${
                        isSelected ? 'bg-[#E8F0FE]' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center shadow-2xs">
                        {account.avatarType === 'mountain' ? (
                          <div className="w-full h-full">
                            <MountainAvatar />
                          </div>
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center font-medium text-white text-[15px]"
                            style={{ backgroundColor: account.bgColor || '#3367D6' }}
                          >
                            {account.initialChar || account.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Name & Email */}
                      <div className="grow min-w-0">
                        <div className="text-[14px] font-medium text-[#1F1F1F] truncate group-hover:text-[#0B57D0] transition-colors">
                          {account.name}
                        </div>
                        <div className="text-[12px] text-[#444746] truncate mt-0.5">
                          {account.email}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#0B57D0] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Option: Use another account */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => setView('another_account')}
                  className="w-full py-3 px-2 sm:px-3 flex items-center gap-3.5 text-left transition-colors cursor-pointer rounded-lg hover:bg-[#F8F9FA] group"
                >
                  <div className="w-10 h-10 rounded-full border border-[#747775] text-[#444746] flex items-center justify-center shrink-0 group-hover:border-[#0B57D0] group-hover:text-[#0B57D0] transition-colors">
                    {/* Google silhouette icon */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
                    </svg>
                  </div>
                  <div className="text-[14px] font-medium text-[#1F1F1F] group-hover:text-[#0B57D0] transition-colors">
                    Use another account
                  </div>
                </button>
              </div>

              {/* Legal Text matching screenshot */}
              <div className="space-y-2 pt-2">
                <p className="text-[12px] text-[#444746] leading-relaxed">
                  Before using this app, you can review Cotton Nest's{' '}
                  <span className="text-[#0B57D0] font-medium hover:underline cursor-pointer">
                    Privacy Policy
                  </span>{' '}
                  and{' '}
                  <span className="text-[#0B57D0] font-medium hover:underline cursor-pointer">
                    Terms of Service
                  </span>
                  .
                </p>

                {onOpenPhoneAuth && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onOpenPhoneAuth}
                      className="text-[11px] text-[#5F6368] hover:text-[#0B57D0] hover:underline cursor-pointer transition-colors"
                    >
                      Or sign in with Phone / Track by Order ID →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW 2: USE ANOTHER ACCOUNT ================= */
          <div className="pt-2 sm:pt-4 space-y-6">
            <button
              type="button"
              onClick={() => setView('chooser')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0B57D0] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Choose an account</span>
            </button>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">
                Sign in
              </h2>
              <p className="text-sm text-[#5F6368]">
                to continue to <span className="text-[#0B57D0] font-medium">Cotton Nest</span>
              </p>
            </div>

            <form onSubmit={handleCreateAnotherAccount} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-[#444746] mb-1.5">
                  Email or phone
                </label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full px-4 py-3 rounded-lg border border-[#747775] focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] text-sm text-[#1F1F1F] outline-hidden transition-all"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#444746] mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-4 py-3 rounded-lg border border-[#747775] focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] text-sm text-[#1F1F1F] outline-hidden transition-all"
                />
              </div>

              <p className="text-xs text-[#5F6368]">
                Not your computer? Use Guest mode to sign in privately.{' '}
                <span className="text-[#0B57D0] hover:underline cursor-pointer">Learn more</span>
              </p>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView('chooser')}
                  className="text-sm font-medium text-[#0B57D0] hover:underline cursor-pointer"
                >
                  Create account
                </button>

                <button
                  type="submit"
                  disabled={!customEmail || isAuthenticating}
                  className="px-6 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] disabled:bg-neutral-300 text-white font-medium text-sm rounded-full shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>Next</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Language & Links matching screenshot */}
        <div className="mt-8 pt-4 border-t border-[#F0F2F5] flex flex-wrap items-center justify-between text-xs text-[#5F6368] gap-3">
          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F1F1F]">
            <span>English (United States)</span>
            <span className="text-[10px]">▼</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-[#1F1F1F] cursor-pointer">Help</span>
            <span className="hover:text-[#1F1F1F] cursor-pointer">Privacy</span>
            <span className="hover:text-[#1F1F1F] cursor-pointer">Terms</span>
          </div>
        </div>

      </div>
    </div>
  );
};
