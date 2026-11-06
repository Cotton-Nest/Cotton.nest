import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_REFERRAL_REWARD_POINTS,
  calculateEarnedPoints,
  calculatePointsDiscount,
  getTransactionExpiryDate,
  generateReferralCode,
  sanitizeLoyaltyKey,
} from '../data/loyalty';
import { stripUndefined } from './api';

const LOCAL_STORAGE_LOYALTY_KEY = 'cotton_nest_loyalty_accounts';
const LOCAL_STORAGE_TX_KEY = 'cotton_nest_loyalty_transactions';

function getLocalAccounts(): Record<string, LoyaltyAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOYALTY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAccount(account: LoyaltyAccount): void {
  try {
    const map = getLocalAccounts();
    map[account.id] = account;
    localStorage.setItem(LOCAL_STORAGE_LOYALTY_KEY, JSON.stringify(map));
  } catch {}
}

function getLocalTransactions(accountId: string): LoyaltyTransaction[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
    const list: LoyaltyTransaction[] = raw ? JSON.parse(raw) : [];
    return list.filter((tx) => tx.accountId === accountId);
  } catch {
    return [];
  }
}

function saveLocalTransaction(tx: LoyaltyTransaction): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
    const list: LoyaltyTransaction[] = raw ? JSON.parse(raw) : [];
    const existingIdx = list.findIndex((item) => item.id === tx.id);
    if (existingIdx >= 0) {
      list[existingIdx] = tx;
    } else {
      list.unshift(tx);
    }
    localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Resolves the primary key for a user (Phone > Email > User ID > Guest Phone > browser session).
 */
export function getActiveLoyaltyKey(user?: any, phoneInput?: string): string {
  if (phoneInput && phoneInput.replace(/[^0-9]/g, '').length >= 10) {
    return sanitizeLoyaltyKey(phoneInput);
  }
  if (user?.phone && user.phone.replace(/[^0-9]/g, '').length >= 10) {
    return sanitizeLoyaltyKey(user.phone);
  }
  if (user?.email) {
    return sanitizeLoyaltyKey(user.email);
  }
  if (user?.id) {
    return sanitizeLoyaltyKey(user.id);
  }
  return 'guest_default_wallet';
}

/**
 * Fetch or initialize customer loyalty account.
 */
export async function getLoyaltyAccountApi(
  rawKey: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string }
): Promise<LoyaltyAccount> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const defaultReferralCode = generateReferralCode(extra?.name || extra?.email || extra?.phone || accountId);

  // 1. Check local cache
  const localMap = getLocalAccounts();
  let account: LoyaltyAccount = localMap[accountId] || {
    id: accountId,
    customerName: extra?.name || 'Cotton Nest Client',
    phone: extra?.phone,
    email: extra?.email,
    userId: extra?.userId,
    pointsBalance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    referralPointsEarned: 0,
    referralCode: defaultReferralCode,
    referralCount: 0,
    updatedAt: Date.now(),
  };

  if (!account.referralCode) {
    account.referralCode = defaultReferralCode;
  }

  // 2. Fetch from Express backend (/api/loyalty/:id)
  try {
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}`);
    if (res.ok) {
      const serverAccount = await res.json();
      if (serverAccount && typeof serverAccount.pointsBalance === 'number') {
        account = {
          ...account,
          ...serverAccount,
          referralCode: serverAccount.referralCode || account.referralCode || defaultReferralCode,
        };
        saveLocalAccount(account);
      }
    }
  } catch {}

  // 3. Fetch from Firestore (Authoritative)
  try {
    const docRef = doc(db, 'site_content', `loyalty_${accountId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const firestoreData = snap.data() as LoyaltyAccount;
      if (firestoreData && typeof firestoreData.pointsBalance === 'number') {
        account = {
          ...account,
          ...firestoreData,
          id: accountId,
          referralCode: firestoreData.referralCode || account.referralCode || defaultReferralCode,
        };
        saveLocalAccount(account);
      }
    } else {
      const initialDoc = stripUndefined({
        ...account,
        id: accountId,
        referralCode: account.referralCode || defaultReferralCode,
        updatedAt: Date.now(),
      });
      await setDoc(docRef, initialDoc, { merge: true });
    }
  } catch {}

  return account;
}

/**
 * Record earned Nest Points from a delivered & paid purchase:
 * Rule: 5 points per ₹100 spent (excluding delivery charges). Valid for 12 months.
 */
export async function earnLoyaltyPointsApi(
  rawKey: string,
  eligibleRupeesExcludingDelivery: number,
  orderId: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string; explicitPoints?: number }
): Promise<{ account: LoyaltyAccount; pointsEarned: number; tx: LoyaltyTransaction }> {
  const pointsEarned =
    typeof extra?.explicitPoints === 'number' && extra.explicitPoints > 0
      ? Math.floor(extra.explicitPoints)
      : calculateEarnedPoints(eligibleRupeesExcludingDelivery);
  const accountId = sanitizeLoyaltyKey(rawKey);

  const current = await getLoyaltyAccountApi(accountId, extra);

  // Prevent duplicate credit for the same delivered orderId
  const existingTxs = await getLoyaltyTransactionsApi(accountId);
  const alreadyCredited = existingTxs.find(
    (t) => t.orderId === orderId && t.type === 'earned' && t.points > 0
  );
  if (alreadyCredited) {
    return { account: current, pointsEarned: alreadyCredited.points, tx: alreadyCredited };
  }

  const now = Date.now();
  const expiresAt = getTransactionExpiryDate(now);
  const newBalance = (current.pointsBalance || 0) + pointsEarned;
  const newLifetimeEarned = (current.lifetimeEarned || 0) + pointsEarned;

  const updatedAccount: LoyaltyAccount = {
    ...current,
    pointsBalance: newBalance,
    lifetimeEarned: newLifetimeEarned,
    customerName: extra?.name || current.customerName,
    phone: extra?.phone || current.phone,
    email: extra?.email || current.email,
    userId: extra?.userId || current.userId,
    updatedAt: now,
  };

  const tx: LoyaltyTransaction = {
    id: `tx_earn_${orderId.replace(/[^a-zA-Z0-9_-]/g, '')}_${now}`,
    accountId,
    orderId,
    type: 'earned',
    points: pointsEarned,
    amountInr: eligibleRupeesExcludingDelivery,
    description: `Earned on Delivered Order #${orderId} (5 pts / ₹100)`,
    createdAt: now,
    expiresAt,
    status: 'credited',
  };

  // 1. Local update
  saveLocalAccount(updatedAccount);
  saveLocalTransaction(tx);

  // 2. Server backend dual-write
  try {
    fetch('/api/loyalty/earn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        points: pointsEarned,
        amountInr: eligibleRupeesExcludingDelivery,
        orderId,
        account: updatedAccount,
        tx,
      }),
    }).catch(() => {});
  } catch {}

  // 3. Firestore persistence
  try {
    await setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true });
  } catch {}

  return { account: updatedAccount, pointsEarned, tx };
}

/**
 * Redeem Nest Points as an instant discount at checkout.
 * Rules:
 * - Minimum 200 points required for redemption.
 * - 100 points = ₹50 (1 point = ₹0.50).
 * - Points cannot be exchanged for cash.
 */
export async function redeemLoyaltyPointsApi(
  rawKey: string,
  pointsToRedeem: number,
  orderId: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string }
): Promise<{ account: LoyaltyAccount; discountInr: number; tx: LoyaltyTransaction }> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const current = await getLoyaltyAccountApi(accountId, extra);

  const availablePoints = Math.max(0, current.pointsBalance || 0);
  if (availablePoints < LOYALTY_MIN_REDEMPTION_POINTS || pointsToRedeem < LOYALTY_MIN_REDEMPTION_POINTS) {
    throw new Error(`Minimum ${LOYALTY_MIN_REDEMPTION_POINTS} Nest Points are required for redemption.`);
  }

  const actualRedeemed = Math.min(availablePoints, Math.max(0, Math.floor(pointsToRedeem)));
  const discountInr = calculatePointsDiscount(actualRedeemed);

  const newBalance = availablePoints - actualRedeemed;
  const newLifetimeSpent = (current.lifetimeSpent || 0) + actualRedeemed;
  const now = Date.now();

  const updatedAccount: LoyaltyAccount = {
    ...current,
    pointsBalance: newBalance,
    lifetimeSpent: newLifetimeSpent,
    updatedAt: now,
  };

  const tx: LoyaltyTransaction = {
    id: `tx_redeem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    accountId,
    orderId,
    type: 'redeemed',
    points: -actualRedeemed,
    amountInr: discountInr,
    description: `Redeemed ${actualRedeemed} Nest Points for ₹${discountInr} discount on Order #${orderId} (100 pts = ₹50)`,
    createdAt: now,
    status: 'credited',
  };

  // 1. Local update
  saveLocalAccount(updatedAccount);
  saveLocalTransaction(tx);

  // 2. Server backend dual-write
  try {
    fetch('/api/loyalty/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        points: actualRedeemed,
        discountInr,
        orderId,
        account: updatedAccount,
        tx,
      }),
    }).catch(() => {});
  } catch {}

  // 3. Firestore persistence
  try {
    await setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true });
  } catch {}

  return { account: updatedAccount, discountInr, tx };
}

/**
 * Claim a Referral Reward by applying a friend's referral code.
 * Awards +100 Nest Points (₹50 value), valid for 12 months.
 */
export async function claimReferralRewardApi(
  rawKey: string,
  referralCodeInput: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string }
): Promise<{ account: LoyaltyAccount; pointsAwarded: number; tx: LoyaltyTransaction }> {
  const cleanCode = (referralCodeInput || '').trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 4) {
    throw new Error('Please enter a valid Cotton Nest referral code.');
  }

  const accountId = sanitizeLoyaltyKey(rawKey);
  const current = await getLoyaltyAccountApi(accountId, extra);

  if (current.referralCode && current.referralCode.toUpperCase() === cleanCode) {
    throw new Error('You cannot apply your own referral code.');
  }

  if (current.referredByCode) {
    throw new Error(`Referral reward already claimed using code ${current.referredByCode}.`);
  }

  const now = Date.now();
  const expiresAt = getTransactionExpiryDate(now);
  const pointsAwarded = LOYALTY_REFERRAL_REWARD_POINTS;

  const updatedAccount: LoyaltyAccount = {
    ...current,
    pointsBalance: (current.pointsBalance || 0) + pointsAwarded,
    lifetimeEarned: (current.lifetimeEarned || 0) + pointsAwarded,
    referralPointsEarned: (current.referralPointsEarned || 0) + pointsAwarded,
    referredByCode: cleanCode,
    referralCount: (current.referralCount || 0) + 1,
    updatedAt: now,
  };

  const tx: LoyaltyTransaction = {
    id: `tx_ref_${now}_${Math.random().toString(36).substring(2, 6)}`,
    accountId,
    type: 'referral',
    points: pointsAwarded,
    amountInr: calculatePointsDiscount(pointsAwarded),
    description: `Referral Reward Bonus (Code: ${cleanCode})`,
    createdAt: now,
    expiresAt,
    status: 'credited',
  };

  saveLocalAccount(updatedAccount);
  saveLocalTransaction(tx);

  try {
    fetch('/api/loyalty/earn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        points: pointsAwarded,
        amountInr: calculatePointsDiscount(pointsAwarded),
        orderId: `REF-${cleanCode}`,
        account: updatedAccount,
        tx,
      }),
    }).catch(() => {});
  } catch {}

  try {
    await setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true });
  } catch {}

  return { account: updatedAccount, pointsAwarded, tx };
}

/**
 * Fetch transaction history for a customer's loyalty wallet.
 */
export async function getLoyaltyTransactionsApi(rawKey: string): Promise<LoyaltyTransaction[]> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const localList = getLocalTransactions(accountId);
  const txMap = new Map<string, LoyaltyTransaction>();

  localList.forEach((t) => {
    const normalized: LoyaltyTransaction = {
      ...t,
      expiresAt: t.points > 0 ? getTransactionExpiryDate(t.createdAt, t.expiresAt) : t.expiresAt,
    };
    txMap.set(t.id, normalized);
  });

  // Fetch from server backend
  try {
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}/transactions`);
    if (res.ok) {
      const serverTxs: LoyaltyTransaction[] = await res.json();
      if (Array.isArray(serverTxs)) {
        serverTxs.forEach((t) => {
          txMap.set(t.id, {
            ...t,
            expiresAt: t.points > 0 ? getTransactionExpiryDate(t.createdAt, t.expiresAt) : t.expiresAt,
          });
        });
      }
    }
  } catch {}

  // Fetch from Firestore if permitted
  try {
    const q = query(
      collection(db, 'loyalty_transactions'),
      where('accountId', '==', accountId),
      limit(50)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as LoyaltyTransaction;
      if (data && d.id) {
        txMap.set(d.id, {
          ...data,
          id: d.id,
          expiresAt: data.points > 0 ? getTransactionExpiryDate(data.createdAt, data.expiresAt) : data.expiresAt,
        });
      }
    });
  } catch {}

  const merged = Array.from(txMap.values());
  merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return merged;
}
