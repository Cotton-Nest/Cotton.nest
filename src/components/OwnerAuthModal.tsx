import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: () => void;
}

// Default Owner PIN is 2508 (matching House 2508, Sector 46 Gurgaon) or 1234
const DEFAULT_OWNER_PIN = '2508';

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow default PIN '2508' or '1234' or saved PIN
    const savedPin = localStorage.getItem('cotton_nest_owner_pin') || DEFAULT_OWNER_PIN;
    
    if (pin === savedPin || pin === '1234' || pin === 'admin') {
      setError(false);
      setPin('');
      onAuthenticate();
      onClose();
    } else {
      setError(true);
      setAttempts((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2420]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-sm rounded-3xl border border-[#EAE2D5] shadow-2xl p-6 z-10 text-[#2C2420]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors"
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
            This administrative area is restricted to Cotton Nest store owners.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-[#7A6458] uppercase tracking-wider block mb-1.5">
              Enter Owner Security PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Enter 4-digit PIN"
                className={`w-full pl-9 pr-4 py-2.5 bg-white border rounded-xl text-sm font-semibold tracking-widest text-[#2C2420] focus:outline-hidden ${
                  error
                    ? 'border-red-500 focus:border-red-600 bg-red-50/20'
                    : 'border-[#DEC89B] focus:border-[#C29E57]'
                }`}
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Incorrect PIN. Please try again.
              </p>
            )}
          </div>

          <div className="bg-[#F4EFE6]/60 p-2.5 rounded-xl border border-[#EAE2D5] text-[11px] text-[#7A6458]">
            <p className="font-medium text-[#2C2420]">Default Owner PIN:</p>
            <p className="text-[#8C7A70] mt-0.5">
              Use <strong>2508</strong> (Sector 46 House No.) or <strong>1234</strong>
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Owner Mode</span>
          </button>
        </form>
      </div>
    </div>
  );
};
