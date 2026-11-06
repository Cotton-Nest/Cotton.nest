import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (openAdmin?: boolean) => void;
}

// Strictly authorized safe PINs for Store Owner Admin access
// 1234 has been permanently removed
const ALLOWED_ADMIN_PINS = ['admin', '2508', 'aadi22', '123897'];

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();

    // Explicitly reject 1234
    if (cleanPin === '1234') {
      setError(true);
      return;
    }

    // Clean up obsolete 1234 from local storage if present
    const savedPin = localStorage.getItem('cotton_nest_owner_pin');
    if (savedPin === '1234') {
      localStorage.removeItem('cotton_nest_owner_pin');
    }

    const isMatch =
      ALLOWED_ADMIN_PINS.includes(cleanPin) ||
      ALLOWED_ADMIN_PINS.includes(cleanPin.toLowerCase()) ||
      Boolean(savedPin && savedPin !== '1234' && cleanPin === savedPin);

    if (isMatch) {
      setError(false);
      setPin('');
      onAuthenticate(true);
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-sm rounded-3xl border border-[#EAE2D5] shadow-2xl p-6 z-10 text-[#2C2420]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto bg-[#FDEAF0] text-[#8C2E46] rounded-2xl flex items-center justify-center border border-[#FAD1DC] shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
            Store Owner Access
          </h3>
          <p className="text-xs text-[#7A6458] max-w-xs mx-auto">
            Enter your confidential Owner Security PIN to open the Admin Panel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-[#7A6458] uppercase tracking-wider block mb-1.5">
              Enter Owner Security PIN / Passcode
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type={showPin ? 'text' : 'password'}
                autoFocus
                maxLength={16}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Enter authorized PIN"
                className={`w-full pl-9 pr-10 py-2.5 bg-white border rounded-xl text-sm font-semibold tracking-wider text-[#2C2420] focus:outline-hidden ${
                  error
                    ? 'border-red-500 focus:border-red-600 bg-red-50/20'
                    : 'border-[#DEC89B] focus:border-[#C29E57]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Incorrect PIN. Only authorized owner pins are permitted.
              </p>
            )}
          </div>

          <div className="bg-[#F4EFE6]/60 p-2.5 rounded-xl border border-[#EAE2D5] text-[11px] text-[#7A6458] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#8C2E46] shrink-0" />
            <span>PIN verification is required every time before entering the store management console.</span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Admin Panel</span>
          </button>
        </form>
      </div>
    </div>
  );
};
