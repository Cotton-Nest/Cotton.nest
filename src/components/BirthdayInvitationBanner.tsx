import React, { useState, useEffect } from 'react';
import { Gift, X, Sparkles } from 'lucide-react';
import { getBirthdayRewardStatusApi } from '../services/api';
import { DEFAULT_BIRTHDAY_REWARDS_CONFIG } from '../data/birthdayRewards';

interface BirthdayInvitationBannerProps {
  userId?: string;
  isAuthenticated: boolean;
  isCartOpen: boolean;
  isAccountModalOpen: boolean;
  isAdminOpen: boolean;
  onAddBirthdayMonth: () => void;
}

interface ReminderState {
  dismissCount: number;
  lastDismissedAt: number;
  lastShownAt: number;
}

const MAX_REMINDERS = 3;
const COOLDOWN_AFTER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days between dismissed reminders
const MIN_INTERVAL_BETWEEN_SHOWS_MS = 24 * 60 * 60 * 1000; // Do not show on every login within 24h

export const BirthdayInvitationBanner: React.FC<BirthdayInvitationBannerProps> = ({
  userId,
  isAuthenticated,
  isCartOpen,
  isAccountModalOpen,
  isAdminOpen,
  onAddBirthdayMonth,
}) => {
  const [visible, setVisible] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(
    DEFAULT_BIRTHDAY_REWARDS_CONFIG.discountAmount
  );

  useEffect(() => {
    let cancelled = false;

    const checkEligibility = async () => {
      if (!isAuthenticated || !userId || userId.startsWith('guest_')) {
        setVisible(false);
        return;
      }

      const storageKey = `cotton_nest_bday_banner_v1_${userId}`;
      const sessionKey = `cotton_nest_bday_banner_session_${userId}`;

      try {
        const raw = localStorage.getItem(storageKey);
        const state: ReminderState = raw
          ? JSON.parse(raw)
          : { dismissCount: 0, lastDismissedAt: 0, lastShownAt: 0 };

        // Respect reminder limit
        if (state.dismissCount >= MAX_REMINDERS) {
          setVisible(false);
          return;
        }

        const now = Date.now();
        // Respect cooldown after dismissal
        if (state.lastDismissedAt > 0 && now - state.lastDismissedAt < COOLDOWN_AFTER_DISMISS_MS) {
          setVisible(false);
          return;
        }

        // Do not show on every login within 24 hours if already shown in a previous session
        const shownThisSession = sessionStorage.getItem(sessionKey) === '1';
        if (!shownThisSession && state.lastShownAt > 0 && now - state.lastShownAt < MIN_INTERVAL_BETWEEN_SHOWS_MS) {
          setVisible(false);
          return;
        }

        const res = await getBirthdayRewardStatusApi(userId);
        if (cancelled) return;

        if (!res.config.enabled || res.profile || res.status.uiState !== 'not_registered') {
          setVisible(false);
          return;
        }

        setDiscountAmount(res.config.discountAmount || DEFAULT_BIRTHDAY_REWARDS_CONFIG.discountAmount);
        setVisible(true);

        if (!shownThisSession) {
          sessionStorage.setItem(sessionKey, '1');
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              ...state,
              lastShownAt: now,
            })
          );
        }
      } catch {
        if (!cancelled) setVisible(false);
      }
    };

    checkEligibility();

    const handleProfileUpdated = () => {
      checkEligibility();
    };
    window.addEventListener('cotton-nest-birthday-profile-updated', handleProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('cotton-nest-birthday-profile-updated', handleProfileUpdated);
    };
  }, [isAuthenticated, userId]);

  // Never interrupt checkout, account modal, or admin panel
  if (!visible || isCartOpen || isAccountModalOpen || isAdminOpen) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    if (!userId) return;
    const storageKey = `cotton_nest_bday_banner_v1_${userId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const state: ReminderState = raw
        ? JSON.parse(raw)
        : { dismissCount: 0, lastDismissedAt: 0, lastShownAt: Date.now() };
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...state,
          dismissCount: (state.dismissCount || 0) + 1,
          lastDismissedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage error
    }
  };

  const handleOpenBirthdayRewards = () => {
    setVisible(false);
    onAddBirthdayMonth();
  };

  return (
    <div
      role="region"
      aria-label="Birthday Rewards Invitation"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-40 animate-fadeIn"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#DEC89B]/80 bg-gradient-to-br from-[#FAF7F2] via-[#FFFDF9] to-[#F5EFE6] p-4 sm:p-5 shadow-[0_14px_38px_rgba(44,37,35,0.16)]">
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[#C29E57]/10 pointer-events-none" />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss birthday reward invitation"
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#7C7267] hover:text-[#2C2523] hover:bg-[#EBE3D5]/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-[#8C2E46]/10 border border-[#8C2E46]/25 flex items-center justify-center shrink-0 text-[#8C2E46]">
            <Gift className="w-5 h-5" />
          </div>
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#C29E57]/15 border border-[#C29E57]/30 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#8A6D3B]">
              <Sparkles className="w-3 h-3 text-[#C29E57]" />
              Nest Rewards Club
            </div>
            <p className="text-xs sm:text-sm text-[#2C2523] leading-relaxed font-medium">
              🎁 <span className="font-semibold">Want a Birthday Surprise?</span> Add your birthday month and receive{' '}
              <span className="font-semibold text-[#8C2E46]">₹{discountAmount} OFF</span> every year!
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleOpenBirthdayRewards}
                className="px-4 py-2 rounded-xl bg-[#8C2E46] hover:bg-[#70252D] text-white text-[11px] uppercase tracking-[0.16em] font-semibold transition-colors shadow-sm"
              >
                Add Birthday Month
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl text-[11px] uppercase tracking-[0.14em] text-[#7C7267] hover:text-[#2C2523] transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
