import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_MAX_REDEMPTION_POINTS,
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
    // Purge legacy 1pt/₹50 test records so they never pollute the ledger
    const cleaned = list.filter(
      (tx) => tx && !(tx.description && String(tx.description).includes('1 pt / ₹50'))
    );
    if (cleaned.length !== list.length) {
      localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(cleaned));
    }
    return cleaned.filter((tx) => tx.accountId === accountId);
  } catch {
    return [];
  }
}

function saveLocalTransaction(tx: LoyaltyTransaction): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
    const list: LoyaltyTransaction[] = raw ? JSON.parse(raw) : [];
    const existingIdx = list.findIndex(
      (item) =>
        item.id === tx.id ||
        (tx.orderId && item.accountId === tx.accountId && item.orderId === tx.orderId && item.type === tx.type)
    );
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
  // Check customer profile from localStorage
  try {
    const raw = localStorage.getItem('cotton_nest_customer_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.phone && parsed.phone.replace(/[^0-9]/g, '').length >= 10) {
        return sanitizeLoyaltyKey(parsed.phone);
      }
    }
  } catch {}
  if (user?.email) {
    return sanitizeLoyaltyKey(user.email);
  }
  if (user?.id) {
    return sanitizeLoyaltyKey(user.id);
  }
  // Check most recent order in localStorage for guest session continuity
  try {
    const rawOrders = localStorage.getItem('cotton_nest_orders');
    if (rawOrders) {
      const parsedOrders = JSON.parse(rawOrders);
      if (Array.isArray(parsedOrders) && parsedOrders.length > 0) {
        const latest = parsedOrders[0];
        if (latest?.customerPhone && String(latest.customerPhone).replace(/[^0-9]/g, '').length >= 10) {
          return sanitizeLoyaltyKey(latest.customerPhone);
        }
        if (latest?.customerEmail) {
          return sanitizeLoyaltyKey(latest.customerEmail);
        }
      }
    }
  } catch {}
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

  // 1. Check local cache (healing any corrupted local spent > earned state)
  const localMap = getLocalAccounts();
  const cachedLocal = localMap[accountId];
  if (cachedLocal && (cachedLocal.lifetimeSpent || 0) > (cachedLocal.lifetimeEarned || 0)) {
    cachedLocal.lifetimeSpent = 0;
    cachedLocal.pointsBalance = Math.max(0, cachedLocal.lifetimeEarned || 0);
  }

  let account: LoyaltyAccount = cachedLocal || {
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

  // 3. Collect alternate keys for this user (phone, email, userId)
  const alternateKeys: string[] = [];
  if (extra?.phone) alternateKeys.push(sanitizeLoyaltyKey(extra.phone));
  if (extra?.email) alternateKeys.push(sanitizeLoyaltyKey(extra.email));
  if (extra?.userId) alternateKeys.push(sanitizeLoyaltyKey(extra.userId));
  let profilePhone = '';
  let profileEmail = '';
  try {
    const rawProfile = localStorage.getItem('cotton_nest_customer_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed?.phone) {
        profilePhone = String(parsed.phone);
        alternateKeys.push(sanitizeLoyaltyKey(parsed.phone));
      }
      if (parsed?.email) {
        profileEmail = String(parsed.email);
        alternateKeys.push(sanitizeLoyaltyKey(parsed.email));
      }
    }
  } catch {}

  const uniqueAltKeys = Array.from(new Set(alternateKeys.filter((k) => k && k !== accountId)));

  for (const alt of uniqueAltKeys) {
    try {
      const altRes = await fetch(`/api/loyalty/${encodeURIComponent(alt)}`);
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData && typeof altData.pointsBalance === 'number') {
          const mergedEarned = Math.max(account.lifetimeEarned || 0, altData.lifetimeEarned || 0);
          const safeAltSpent = (altData.lifetimeSpent || 0) <= mergedEarned ? (altData.lifetimeSpent || 0) : 0;
          const safeAccSpent = (account.lifetimeSpent || 0) <= mergedEarned ? (account.lifetimeSpent || 0) : 0;
          const mergedSpent = Math.max(safeAccSpent, safeAltSpent);
          account = {
            ...account,
            ...altData,
            id: accountId,
            lifetimeEarned: mergedEarned,
            lifetimeSpent: mergedSpent,
            pointsBalance: Math.max(0, mergedEarned - mergedSpent),
            referralCode: altData.referralCode || account.referralCode || defaultReferralCode,
          };
          saveLocalAccount(account);
        }
      }
    } catch {}
  }

  // 4. Fetch from Firestore across customer's candidate keys
  try {
    const allCandidateKeys = Array.from(new Set([accountId, ...uniqueAltKeys]));
    const candidateDocRefs = allCandidateKeys.flatMap((k) => [
      doc(db, 'site_content', `loyalty_${k}`),
      doc(db, 'loyalty', k),
    ]);
    const snaps = await Promise.all(candidateDocRefs.map((ref) => getDoc(ref).catch(() => null)));

    for (const snap of snaps) {
      if (snap && snap.exists()) {
        const firestoreData = snap.data() as LoyaltyAccount;
        if (firestoreData && (typeof firestoreData.lifetimeEarned === 'number' || typeof firestoreData.pointsBalance === 'number')) {
          const mergedEarned = Math.max(account.lifetimeEarned || 0, firestoreData.lifetimeEarned || 0);
          const fsSpent = (firestoreData.lifetimeSpent || 0) <= mergedEarned ? (firestoreData.lifetimeSpent || 0) : 0;
          const accSpent = (account.lifetimeSpent || 0) <= mergedEarned ? (account.lifetimeSpent || 0) : 0;
          const mergedSpent = Math.max(accSpent, fsSpent);
          const mergedBalance = Math.max(0, mergedEarned - mergedSpent);

          account = {
            ...account,
            ...firestoreData,
            id: accountId,
            lifetimeEarned: mergedEarned,
            lifetimeSpent: mergedSpent,
            pointsBalance: mergedBalance,
            referralCode: firestoreData.referralCode || account.referralCode || defaultReferralCode,
          };
          saveLocalAccount(account);
        }
      }
    }
  } catch {}

  // 5. Reconcile against local orders cache: credit earned points for 'delivered' orders and debit valid redemptions
  try {
    const rawOrders = localStorage.getItem('cotton_nest_orders');
    if (rawOrders) {
      const parsedOrders = JSON.parse(rawOrders);
      if (Array.isArray(parsedOrders)) {
        const orderStatusMap = new Map<string, string>();
        parsedOrders.forEach((o) => {
          if (o && o.id) orderStatusMap.set(String(o.id), String(o.status || 'pending'));
        });

        // Clean up any premature local 'earned' transactions or legacy 1pt/50 records
        try {
          const rawTxs = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
          if (rawTxs) {
            const txList: LoyaltyTransaction[] = JSON.parse(rawTxs);
            if (Array.isArray(txList)) {
              const filtered = txList.filter((t) => {
                if (!t) return false;
                if (t.description && String(t.description).includes('1 pt / ₹50')) return false;
                if (t.type === 'earned' && t.orderId && orderStatusMap.has(String(t.orderId))) {
                  return orderStatusMap.get(String(t.orderId)) === 'delivered';
                }
                if (t.type === 'redeemed' && Math.abs(t.points) > LOYALTY_MAX_REDEMPTION_POINTS) return false;
                return true;
              });
              if (filtered.length !== txList.length) {
                localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(filtered));
              }
            }
          }
        } catch {}

        let deliveredOrderEarned = 0;
        let orderSpent = 0;
        let matchedAnyOrder = false;

        const myEmail = (
          account.email ||
          extra?.email ||
          profileEmail ||
          (accountId.startsWith('email_') ? accountId.slice(6) : '')
        )
          .toLowerCase()
          .trim();
        const myPhone = (
          account.phone ||
          extra?.phone ||
          profilePhone ||
          (accountId.startsWith('phone_') ? accountId.slice(6) : '')
        )
          .replace(/[^0-9]/g, '')
          .slice(-10);

        parsedOrders.forEach((o) => {
          if (!o || o.status === 'cancelled') return;
          const oEmail = (o.customerEmail || '').toLowerCase().trim();
          const oPhone = (o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
          const isMatch =
            Boolean(myEmail && oEmail === myEmail) ||
            Boolean(myPhone && oPhone === myPhone) ||
            Boolean(extra?.userId && o.userId === extra.userId) ||
            accountId === 'guest_default_wallet';

          if (isMatch) {
            matchedAnyOrder = true;
            const ship = Number(o.shippingCost) || 0;
            const net = Math.max(0, (Number(o.totalAmount) || Number(o.subtotal) || 0) - ship);
            const pts = typeof o.pointsEarned === 'number' && o.pointsEarned > 0 ? o.pointsEarned : calculateEarnedPoints(net);

            if (o.status === 'delivered') {
              deliveredOrderEarned += pts;
              if (pts > 0) {
                const localTxs = getLocalTransactions(accountId);
                const hasTx = localTxs.some((t) => t.orderId === o.id && t.type === 'earned' && t.points > 0);
                if (!hasTx) {
                  const now = o.deliveredAt
                    ? new Date(o.deliveredAt).getTime() || Date.now()
                    : o.createdAt
                    ? new Date(o.createdAt).getTime() || Date.now()
                    : Date.now();
                  saveLocalTransaction({
                    id: `tx_earn_${o.id.replace(/[^a-zA-Z0-9_-]/g, '')}_${accountId}`,
                    accountId,
                    orderId: o.id,
                    type: 'earned',
                    points: pts,
                    amountInr: net,
                    description: `Earned on Delivered Order #${o.id} (5 pts / ₹100)`,
                    createdAt: now,
                    expiresAt: getTransactionExpiryDate(now),
                    status: 'credited',
                  });
                }
              }
            }
            const usedVal = Number(o.pointsUsed) || 0;
            if (usedVal > 0 && usedVal <= LOYALTY_MAX_REDEMPTION_POINTS) {
              orderSpent += usedVal;
              const localTxs = getLocalTransactions(accountId);
              const hasRedeemTx = localTxs.some((t) => t.orderId === o.id && (t.type === 'redeemed' || t.points < 0));
              if (!hasRedeemTx) {
                const now = o.createdAt ? new Date(o.createdAt).getTime() || Date.now() : Date.now();
                saveLocalTransaction({
                  id: `tx_redeem_${o.id.replace(/[^a-zA-Z0-9_-]/g, '')}_${accountId}`,
                  accountId,
                  orderId: o.id,
                  type: 'redeemed',
                  points: -usedVal,
                  amountInr: calculatePointsDiscount(usedVal),
                  description: `Redeemed ${usedVal} Nest Points on Order #${o.id} (100 pts = ₹50)`,
                  createdAt: now,
                  status: 'credited',
                });
              }
            }
          }
        });

        if (matchedAnyOrder) {
          const referralPts = account.referralPointsEarned || 0;
          const computedEarned = Math.max(account.lifetimeEarned || 0, deliveredOrderEarned + referralPts);
          const computedSpent = orderSpent;
          const computedNet = Math.max(0, computedEarned - computedSpent);
          account.lifetimeEarned = computedEarned;
          account.lifetimeSpent = computedSpent;
          account.pointsBalance = computedNet;
          saveLocalAccount(account);
        }
      }
    }
  } catch {}

  account.pointsBalance = Math.max(0, (account.lifetimeEarned || 0) - (account.lifetimeSpent || 0));
  saveLocalAccount(account);
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

  // Check server & Firestore transactions before crediting to prevent duplicates
  const existingTxs = await getLoyaltyTransactionsApi(accountId);
  const alreadyCredited = existingTxs.find(
    (t) => t.accountId === accountId && t.orderId === orderId && t.type === 'earned' && t.points > 0
  );

  const current = await getLoyaltyAccountApi(accountId, extra);
  if (alreadyCredited) {
    return { account: current, pointsEarned: alreadyCredited.points, tx: alreadyCredited };
  }

  const now = Date.now();
  const expiresAt = getTransactionExpiryDate(now);
  const newLifetimeEarned = (current.lifetimeEarned || 0) + pointsEarned;
  const currentSpent = current.lifetimeSpent || 0;
  const newBalance = Math.max(0, newLifetimeEarned - currentSpent);

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
    id: `tx_earn_${orderId.replace(/[^a-zA-Z0-9_-]/g, '')}_${accountId}`,
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
    await fetch('/api/loyalty/earn', {
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

  // 3. Firestore persistence across both loyalty collections and transaction log
  try {
    await Promise.all([
      setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true }).catch(() => {}),
    ]);
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
  const requestedPoints = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, Math.max(0, Math.floor(pointsToRedeem)));
  if (requestedPoints <= 0 || availablePoints <= 0) {
    throw new Error('Please enter a valid number of Nest Points to redeem.');
  }

  const actualRedeemed = Math.min(availablePoints, requestedPoints);
  const discountInr = calculatePointsDiscount(actualRedeemed);

  const newLifetimeEarned = Math.max(current.lifetimeEarned || 0, availablePoints + (current.lifetimeSpent || 0));
  const newLifetimeSpent = (current.lifetimeSpent || 0) + actualRedeemed;
  const newBalance = Math.max(0, newLifetimeEarned - newLifetimeSpent);
  const now = Date.now();

  const updatedAccount: LoyaltyAccount = {
    ...current,
    lifetimeEarned: newLifetimeEarned,
    lifetimeSpent: newLifetimeSpent,
    pointsBalance: newBalance,
    updatedAt: now,
  };

  const cleanOrderId = (orderId || `ord_${now}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const tx: LoyaltyTransaction = {
    id: `tx_redeem_${cleanOrderId}_${accountId}`,
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
    await fetch('/api/loyalty/redeem', {
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

  // 3. Firestore persistence across both loyalty collections and transaction log
  try {
    await Promise.all([
      setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true }).catch(() => {}),
    ]);
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
    await Promise.all([
      setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true }).catch(() => {}),
    ]);
  } catch {}

  return { account: updatedAccount, pointsAwarded, tx };
}

/**
 * Fetch transaction history for a customer's loyalty wallet.
 */
export async function getLoyaltyTransactionsApi(rawKey: string): Promise<LoyaltyTransaction[]> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const orderStatusMap = new Map<string, string>();
  try {
    const rawOrders = localStorage.getItem('cotton_nest_orders');
    if (rawOrders) {
      const parsedOrders = JSON.parse(rawOrders);
      if (Array.isArray(parsedOrders)) {
        parsedOrders.forEach((o) => {
          if (o && o.id) orderStatusMap.set(String(o.id), String(o.status || 'pending'));
        });
      }
    }
  } catch {}

  const isEligibleTx = (t: LoyaltyTransaction) => {
    if (!t) return false;
    if (t.description && String(t.description).includes('1 pt / ₹50')) return false;
    if (t.type === 'earned' && t.orderId) {
      if (orderStatusMap.size > 0) {
        return orderStatusMap.get(String(t.orderId)) === 'delivered';
      }
    }
    if ((t.type === 'redeemed' || t.points < 0) && Math.abs(t.points) > LOYALTY_MAX_REDEMPTION_POINTS) {
      return false;
    }
    return true;
  };

  const localList = getLocalTransactions(accountId);
  const txMap = new Map<string, LoyaltyTransaction>();

  const putUniqueTx = (t: LoyaltyTransaction) => {
    if (!isEligibleTx(t)) return;
    // Deduplicate by (type + orderId) so an order never appears twice in the ledger
    const dedupKey = t.orderId ? `${t.type}_${t.orderId}` : t.id;
    const normalized: LoyaltyTransaction = {
      ...t,
      expiresAt: t.points > 0 ? getTransactionExpiryDate(t.createdAt, t.expiresAt) : t.expiresAt,
    };
    txMap.set(dedupKey, normalized);
  };

  localList.forEach(putUniqueTx);

  // Fetch from server backend
  try {
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}/transactions`);
    if (res.ok) {
      const serverTxs: LoyaltyTransaction[] = await res.json();
      if (Array.isArray(serverTxs)) {
        serverTxs.forEach(putUniqueTx);
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
        putUniqueTx({ ...data, id: d.id });
      }
    });
  } catch {}

  const merged = Array.from(txMap.values());
  merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return merged;
}
