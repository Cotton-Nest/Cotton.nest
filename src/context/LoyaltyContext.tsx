import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LOYALTY_MAX_REDEMPTION_POINTS,
  calculatePointsDiscount,
  getTransactionExpiryDate,
  isTransactionExpired,
  generateReferralCode,
  sanitizeLoyaltyKey,
} from '../data/loyalty';
import {
  getLoyaltyAccountApi,
  earnLoyaltyPointsApi,
  redeemLoyaltyPointsApi,
  claimReferralRewardApi,
  getLoyaltyTransactionsApi,
  getActiveLoyaltyKey,
} from '../services/loyaltyApi';
import { useAuth } from './AuthContext';

interface LoyaltyContextType {
  account: LoyaltyAccount | null;
  pointsBalance: number;
  pointsRupeesValue: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  pointsEarnedFromPurchases: number;
  pointsUsed: number;
  referralPointsEarned: number;
  referralCode: string;
  referredByCode?: string;
  nextExpiryTimestamp: number | null;
  transactions: LoyaltyTransaction[];
  isLoading: boolean;
  isLoyaltyModalOpen: boolean;
  preferRedeemAtCheckout: boolean;
  setPreferRedeemAtCheckout: (val: boolean) => void;
  openLoyaltyModal: () => void;
  closeLoyaltyModal: () => void;
  refreshLoyalty: (explicitKey?: string) => Promise<LoyaltyAccount | null>;
  earnPoints: (
    eligibleAmountExcludingDelivery: number,
    orderId: string,
    phoneOrKey?: string,
    explicitPoints?: number
  ) => Promise<{ pointsEarned: number }>;
  redeemPoints: (points: number, orderId: string, phoneOrKey?: string) => Promise<{ discountInr: number }>;
  claimReferralReward: (
    referralCodeInput: string,
    phoneOrKey?: string
  ) => Promise<{ success: boolean; message: string; pointsAwarded: number }>;
  loadTransactions: () => Promise<LoyaltyTransaction[]>;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState<boolean>(false);
  const [preferRedeemAtCheckout, setPreferRedeemAtCheckout] = useState<boolean>(false);

  const activeKey = getActiveLoyaltyKey(user);

  const refreshLoyalty = useCallback(
    async (explicitKey?: string): Promise<LoyaltyAccount | null> => {
      let resolvedPhone = user?.phone;
      let resolvedEmail = user?.email;
      try {
        const rawProfile = localStorage.getItem('cotton_nest_customer_profile');
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          if (parsed?.phone && !resolvedPhone) resolvedPhone = parsed.phone;
          if (parsed?.email && !resolvedEmail) resolvedEmail = parsed.email;
        }
      } catch {}

      const key = explicitKey || (resolvedPhone ? sanitizeLoyaltyKey(resolvedPhone) : activeKey);
      if (!key) return null;
      setIsLoading(true);
      try {
        const acc = await getLoyaltyAccountApi(key, {
          name: user?.name,
          phone: resolvedPhone,
          email: resolvedEmail,
          userId: user?.id,
        });
        setAccount(acc);
        return acc;
      } catch (err) {
        console.warn('Error refreshing loyalty account:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [activeKey, user]
  );

  const loadTransactions = useCallback(async (): Promise<LoyaltyTransaction[]> => {
    let resolvedPhone = user?.phone;
    try {
      const rawProfile = localStorage.getItem('cotton_nest_customer_profile');
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed?.phone && !resolvedPhone) resolvedPhone = parsed.phone;
      }
    } catch {}

    const key = resolvedPhone ? sanitizeLoyaltyKey(resolvedPhone) : activeKey;
    if (!key) return [];
    try {
      const txs = await getLoyaltyTransactionsApi(key);
      setTransactions(txs);
      return txs;
    } catch {
      return [];
    }
  }, [activeKey, user]);

  useEffect(() => {
    refreshLoyalty();
    loadTransactions();

    const handleLoyaltyUpdate = () => {
      refreshLoyalty();
      loadTransactions();
    };

    window.addEventListener('cotton-nest-loyalty-updated', handleLoyaltyUpdate);
    window.addEventListener('storage', handleLoyaltyUpdate);

    return () => {
      window.removeEventListener('cotton-nest-loyalty-updated', handleLoyaltyUpdate);
      window.removeEventListener('storage', handleLoyaltyUpdate);
    };
  }, [refreshLoyalty, loadTransactions]);

  const earnPoints = useCallback(
    async (
      eligibleAmountExcludingDelivery: number,
      orderId: string,
      phoneOrKey?: string,
      explicitPoints?: number
    ) => {
      const targetKey = phoneOrKey || activeKey;
      const res = await earnLoyaltyPointsApi(targetKey, eligibleAmountExcludingDelivery, orderId, {
        name: user?.name,
        phone: user?.phone,
        email: user?.email,
        userId: user?.id,
        explicitPoints,
      });
      setAccount(res.account);
      setTransactions((prev) => {
        if (prev.some((t) => t.id === res.tx.id)) return prev;
        return [res.tx, ...prev];
      });
      return { pointsEarned: res.pointsEarned };
    },
    [activeKey, user]
  );

  const redeemPoints = useCallback(
    async (pointsToRedeem: number, orderId: string, phoneOrKey?: string) => {
      const targetKey = phoneOrKey || activeKey;
      const res = await redeemLoyaltyPointsApi(targetKey, pointsToRedeem, orderId, {
        name: user?.name,
        phone: user?.phone,
        email: user?.email,
        userId: user?.id,
      });
      setAccount(res.account);
      setTransactions((prev) => [res.tx, ...prev]);
      return { discountInr: res.discountInr };
    },
    [activeKey, user]
  );

  const claimReferralReward = useCallback(
    async (referralCodeInput: string, phoneOrKey?: string) => {
      const targetKey = phoneOrKey || activeKey;
      try {
        const res = await claimReferralRewardApi(targetKey, referralCodeInput, {
          name: user?.name,
          phone: user?.phone,
          email: user?.email,
          userId: user?.id,
        });
        setAccount(res.account);
        setTransactions((prev) => [res.tx, ...prev]);
        return {
          success: true,
          message: `🎉 +${res.pointsAwarded} Nest Points credited from referral code!`,
          pointsAwarded: res.pointsAwarded,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Could not apply referral code.',
          pointsAwarded: 0,
        };
      }
    },
    [activeKey, user]
  );

  // Calculate active non-expired metrics: strictly Earned (credited) minus Used (debited)
  const {
    pointsBalance,
    pointsEarnedFromPurchases,
    pointsUsed,
    referralPointsEarned,
    nextExpiryTimestamp,
  } = useMemo(() => {
    const now = Date.now();
    const earnedTxs = transactions.filter((t) => (Number(t.points) || 0) > 0 && (t.type === 'earned' || !t.type));
    const referralTxs = transactions.filter((t) => (Number(t.points) || 0) > 0 && (t.type === 'referral' || t.type === 'bonus'));
    const redeemedTxs = transactions.filter(
      (t) => (t.type === 'redeemed' || (Number(t.points) || 0) < 0) && Math.abs(Number(t.points) || 0) <= LOYALTY_MAX_REDEMPTION_POINTS
    );

    const calcPurchaseEarned = earnedTxs.reduce((sum, t) => sum + Math.max(0, Number(t.points) || 0), 0);
    const calcReferralEarned = referralTxs.reduce((sum, t) => sum + Math.max(0, Number(t.points) || 0), 0);
    const calcUsed = redeemedTxs.reduce((sum, t) => sum + Math.abs(Number(t.points) || 0), 0);

    const expiredPoints = [...earnedTxs, ...referralTxs]
      .filter((t) => isTransactionExpired(t.createdAt, t.expiresAt, now))
      .reduce((sum, t) => sum + Math.max(0, Number(t.points) || 0), 0);

    const totalEarned = Math.max(
      account?.lifetimeEarned || 0,
      calcPurchaseEarned + calcReferralEarned
    );
    // Only debit actual redeemed transactions or verified account spent (never exceeding totalEarned)
    const rawAccountSpent = account?.lifetimeSpent || 0;
    const totalSpent =
      redeemedTxs.length > 0
        ? Math.max(calcUsed, rawAccountSpent <= totalEarned ? rawAccountSpent : calcUsed)
        : rawAccountSpent <= totalEarned
        ? rawAccountSpent
        : 0;

    const computedNet = Math.max(0, totalEarned - totalSpent - expiredPoints);
    const effectiveBalance = Math.max(account?.pointsBalance || 0, computedNet);

    // Find the earliest upcoming expiry timestamp among active positive transactions
    const activePositiveExpiries = [...earnedTxs, ...referralTxs]
      .map((t) => getTransactionExpiryDate(t.createdAt, t.expiresAt))
      .filter((exp) => exp > now)
      .sort((a, b) => a - b);

    // Fallback default 12-month expiry if pointsBalance > 0 and no transactions in list
    let earliestExpiry: number | null = activePositiveExpiries.length > 0 ? activePositiveExpiries[0] : null;
    if (!earliestExpiry && effectiveBalance > 0 && account?.updatedAt) {
      earliestExpiry = getTransactionExpiryDate(account.updatedAt);
    }

    return {
      pointsBalance: effectiveBalance,
      pointsEarnedFromPurchases:
        calcPurchaseEarned > 0
          ? calcPurchaseEarned
          : Math.max(0, totalEarned - (account?.referralPointsEarned || calcReferralEarned)),
      pointsUsed: totalSpent,
      referralPointsEarned:
        calcReferralEarned > 0 ? calcReferralEarned : account?.referralPointsEarned || 0,
      nextExpiryTimestamp: earliestExpiry,
    };
  }, [account, transactions]);

  const pointsRupeesValue = calculatePointsDiscount(pointsBalance);
  const lifetimeEarned = account?.lifetimeEarned || pointsEarnedFromPurchases + referralPointsEarned;
  const lifetimeSpent = account?.lifetimeSpent || pointsUsed;
  const referralCode =
    account?.referralCode ||
    generateReferralCode(user?.name || user?.email || user?.phone || activeKey);

  return (
    <LoyaltyContext.Provider
      value={{
        account,
        pointsBalance,
        pointsRupeesValue,
        lifetimeEarned,
        lifetimeSpent,
        pointsEarnedFromPurchases,
        pointsUsed,
        referralPointsEarned,
        referralCode,
        referredByCode: account?.referredByCode,
        nextExpiryTimestamp,
        transactions,
        isLoading,
        isLoyaltyModalOpen,
        preferRedeemAtCheckout,
        setPreferRedeemAtCheckout,
        openLoyaltyModal: () => {
          setIsLoyaltyModalOpen(true);
          refreshLoyalty();
          loadTransactions();
        },
        closeLoyaltyModal: () => setIsLoyaltyModalOpen(false),
        refreshLoyalty,
        earnPoints,
        redeemPoints,
        claimReferralReward,
        loadTransactions,
      }}
    >
      {children}
    </LoyaltyContext.Provider>
  );
};

export function useLoyalty(): LoyaltyContextType {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error('useLoyalty must be used within a LoyaltyProvider');
  }
  return context;
}
