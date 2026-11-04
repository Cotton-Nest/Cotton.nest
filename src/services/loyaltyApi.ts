import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  calculateEarnedPoints,
  calculatePointsDiscount,
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
    list.unshift(tx);
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
    updatedAt: Date.now(),
  };

  // 2. Fetch from Express backend (/api/loyalty/:id)
  try {
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}`);
    if (res.ok) {
      const serverAccount = await res.json();
      if (serverAccount && typeof serverAccount.pointsBalance === 'number') {
        account = { ...account, ...serverAccount };
        saveLocalAccount(account);
      }
    }
  } catch {}

  // 3. Fetch from Firestore (Authoritative)
  try {
    const docRef = doc(db, 'loyalty', accountId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const firestoreData = snap.data() as LoyaltyAccount;
      if (firestoreData && typeof firestoreData.pointsBalance === 'number') {
        account = { ...account, ...firestoreData, id: accountId };
        saveLocalAccount(account);
      }
    } else {
      // First time initial record in Firestore
      const initialDoc = stripUndefined({
        ...account,
        id: accountId,
        updatedAt: Date.now(),
      });
      await setDoc(docRef, initialDoc, { merge: true });
    }
  } catch (err) {
    // Non-blocking fallback
    console.warn('Loyalty account fetch notice:', err);
  }

  return account;
}

/**
 * Record earned points from a purchase: 1 point for every 50 Rs spent.
 */
export async function earnLoyaltyPointsApi(
  rawKey: string,
  rupeesSpent: number,
  orderId: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string }
): Promise<{ account: LoyaltyAccount; pointsEarned: number; tx: LoyaltyTransaction }> {
  const pointsEarned = calculateEarnedPoints(rupeesSpent);
  const accountId = sanitizeLoyaltyKey(rawKey);

  const current = await getLoyaltyAccountApi(accountId, extra);
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
    updatedAt: Date.now(),
  };

  const tx: LoyaltyTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    accountId,
    orderId,
    type: 'earned',
    points: pointsEarned,
    amountInr: rupeesSpent,
    description: `Earned on Order #${orderId} (1 pt / ₹50)`,
    createdAt: Date.now(),
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
        amountInr: rupeesSpent,
        orderId,
        account: updatedAccount,
        tx,
      }),
    }).catch(() => {});
  } catch {}

  // 3. Firestore persistence
  try {
    await setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true });
    await setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true });
  } catch (err) {
    console.warn('Firestore loyalty earn notice:', err);
  }

  return { account: updatedAccount, pointsEarned, tx };
}

/**
 * Redeem loyalty points as an instant cash discount at checkout.
 * 1 point = 1 Rupee discount.
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
  const actualRedeemed = Math.min(availablePoints, Math.max(0, Math.floor(pointsToRedeem)));
  const discountInr = calculatePointsDiscount(actualRedeemed);

  const newBalance = availablePoints - actualRedeemed;
  const newLifetimeSpent = (current.lifetimeSpent || 0) + actualRedeemed;

  const updatedAccount: LoyaltyAccount = {
    ...current,
    pointsBalance: newBalance,
    lifetimeSpent: newLifetimeSpent,
    updatedAt: Date.now(),
  };

  const tx: LoyaltyTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    accountId,
    orderId,
    type: 'redeemed',
    points: -actualRedeemed,
    amountInr: discountInr,
    description: `Redeemed for ₹${discountInr} discount on Order #${orderId}`,
    createdAt: Date.now(),
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
    await setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true });
    await setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true });
  } catch (err) {
    console.warn('Firestore loyalty redeem notice:', err);
  }

  return { account: updatedAccount, discountInr, tx };
}

/**
 * Fetch transaction history for a customer's loyalty wallet.
 */
export async function getLoyaltyTransactionsApi(rawKey: string): Promise<LoyaltyTransaction[]> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const localList = getLocalTransactions(accountId);
  const txMap = new Map<string, LoyaltyTransaction>();

  localList.forEach((t) => txMap.set(t.id, t));

  // Fetch from server backend
  try {
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}/transactions`);
    if (res.ok) {
      const serverTxs: LoyaltyTransaction[] = await res.json();
      if (Array.isArray(serverTxs)) {
        serverTxs.forEach((t) => txMap.set(t.id, t));
      }
    }
  } catch {}

  // Fetch from Firestore
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
        txMap.set(d.id, { ...data, id: d.id });
      }
    });
  } catch (err) {
    console.warn('Firestore transactions fetch notice:', err);
  }

  const merged = Array.from(txMap.values());
  merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return merged;
}
