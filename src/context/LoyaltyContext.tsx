import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LoyaltyAccount, LoyaltyTransaction, calculatePointsDiscount, calculateEarnedPoints } from '../data/loyalty';
import {
  getLoyaltyAccountApi,
  earnLoyaltyPointsApi,
  redeemLoyaltyPointsApi,
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
  transactions: LoyaltyTransaction[];
  isLoading: boolean;
  isLoyaltyModalOpen: boolean;
  openLoyaltyModal: () => void;
  closeLoyaltyModal: () => void;
  refreshLoyalty: (explicitKey?: string) => Promise<LoyaltyAccount | null>;
  earnPoints: (amountSpent: number, orderId: string, phoneOrKey?: string) => Promise<{ pointsEarned: number }>;
  redeemPoints: (points: number, orderId: string, phoneOrKey?: string) => Promise<{ discountInr: number }>;
  loadTransactions: () => Promise<LoyaltyTransaction[]>;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState<boolean>(false);

  const activeKey = getActiveLoyaltyKey(user);

  const refreshLoyalty = useCallback(
    async (explicitKey?: string): Promise<LoyaltyAccount | null> => {
      const key = explicitKey || activeKey;
      if (!key) return null;
      setIsLoading(true);
      try {
        const acc = await getLoyaltyAccountApi(key, {
          name: user?.name,
          phone: user?.phone,
          email: user?.email,
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
    const key = activeKey;
    if (!key) return [];
    try {
      const txs = await getLoyaltyTransactionsApi(key);
      setTransactions(txs);
      return txs;
    } catch {
      return [];
    }
  }, [activeKey]);

  useEffect(() => {
    refreshLoyalty();
    loadTransactions();
  }, [refreshLoyalty, loadTransactions]);

  const earnPoints = useCallback(
    async (amountSpent: number, orderId: string, phoneOrKey?: string) => {
      const targetKey = phoneOrKey || activeKey;
      const res = await earnLoyaltyPointsApi(targetKey, amountSpent, orderId, {
        name: user?.name,
        phone: user?.phone,
        email: user?.email,
        userId: user?.id,
      });
      setAccount(res.account);
      setTransactions((prev) => [res.tx, ...prev]);
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

  const pointsBalance = account?.pointsBalance || 0;
  const pointsRupeesValue = calculatePointsDiscount(pointsBalance);
  const lifetimeEarned = account?.lifetimeEarned || 0;
  const lifetimeSpent = account?.lifetimeSpent || 0;

  return (
    <LoyaltyContext.Provider
      value={{
        account,
        pointsBalance,
        pointsRupeesValue,
        lifetimeEarned,
        lifetimeSpent,
        transactions,
        isLoading,
        isLoyaltyModalOpen,
        openLoyaltyModal: () => {
          setIsLoyaltyModalOpen(true);
          loadTransactions();
        },
        closeLoyaltyModal: () => setIsLoyaltyModalOpen(false),
        refreshLoyalty,
        earnPoints,
        redeemPoints,
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
