import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, runTransaction } from 'firebase/firestore';
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
import {
  ReferralRecord,
  ReferralRewardsConfig,
  CustomerReferralSummary,
  AdminReferralSummary,
  DEFAULT_REFERRAL_REWARDS_CONFIG,
  REFERRAL_APPLIED_SUCCESS_MESSAGE,
  validateAndCreateReferralApplication,
  evaluateReferralOnOrderPlaced,
  settleReferralRewardOnDelivery,
  reverseReferralOnCancellationOrRefund,
  computeCustomerReferralSummary,
  computeAdminReferralSummary,
} from '../data/referrals';
import { Order } from '../data/orders';
import { stripUndefined } from './api';

const LOCAL_STORAGE_LOYALTY_KEY = 'cotton_nest_loyalty_accounts';
const LOCAL_STORAGE_TX_KEY = 'cotton_nest_loyalty_transactions';
const LOCAL_STORAGE_REFERRALS_KEY = 'cotton_nest_referral_records';
const LOCAL_STORAGE_REFERRAL_CONFIG_KEY = 'cotton_nest_referral_config';

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

  // 2. Fetch from Express backend (/api/loyalty/:id) with candidate query params
  try {
    const qParams = new URLSearchParams();
    if (extra?.phone) qParams.set('phone', extra.phone);
    if (extra?.email) qParams.set('email', extra.email);
    if (extra?.userId) qParams.set('userId', extra.userId);
    const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}${qStr}`);
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
        const welcomeOrderIds = new Set<string>();
        parsedOrders.forEach((o) => {
          if (o && o.id) {
            orderStatusMap.set(String(o.id), String(o.status || 'pending'));
            if (o.welcomeOfferApplied || o.benefitType === 'welcome_offer' || (Number(o.welcomeDiscount) || 0) > 0) {
              welcomeOrderIds.add(String(o.id));
            }
          }
        });

        // Clean up any premature local 'earned' transactions, Welcome Offer order transactions, or legacy 1pt/50 records
        try {
          const rawTxs = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
          if (rawTxs) {
            const txList: LoyaltyTransaction[] = JSON.parse(rawTxs);
            if (Array.isArray(txList)) {
              const filtered = txList.filter((t) => {
                if (!t) return false;
                if (t.orderId && welcomeOrderIds.has(String(t.orderId))) return false;
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
          const isWelcomeOrder = Boolean(
            o.welcomeOfferApplied || o.benefitType === 'welcome_offer' || (Number(o.welcomeDiscount) || 0) > 0
          );
          if (isWelcomeOrder) return;

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
            const pts = typeof o.pointsEarned === 'number' && o.pointsEarned >= 0 ? o.pointsEarned : calculateEarnedPoints(net);

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
          const computedEarned = deliveredOrderEarned + referralPts > 0 ? (deliveredOrderEarned + referralPts) : (account.lifetimeEarned || 0);
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
 * Note: Orders with Welcome Offer applied earn ZERO Nest Points.
 */
export async function earnLoyaltyPointsApi(
  rawKey: string,
  eligibleRupeesExcludingDelivery: number,
  orderId: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string; explicitPoints?: number }
): Promise<{ account: LoyaltyAccount; pointsEarned: number; tx: LoyaltyTransaction }> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const current = await getLoyaltyAccountApi(accountId, extra);

  if (extra?.explicitPoints === 0) {
    return {
      account: current,
      pointsEarned: 0,
      tx: {
        id: `tx_none_${orderId}`,
        accountId,
        orderId,
        type: 'earned',
        points: 0,
        amountInr: 0,
        description: 'Welcome Offer applied — 0 Nest Points earned',
        createdAt: Date.now(),
      },
    };
  }

  const pointsEarned =
    typeof extra?.explicitPoints === 'number' && extra.explicitPoints > 0
      ? Math.floor(extra.explicitPoints)
      : calculateEarnedPoints(eligibleRupeesExcludingDelivery);

  // Check server & Firestore transactions before crediting to prevent duplicates
  const existingTxs = await getLoyaltyTransactionsApi(accountId);
  const alreadyCredited = existingTxs.find(
    (t) => t.accountId === accountId && t.orderId === orderId && t.type === 'earned' && t.points > 0
  );

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

  // Idempotency check: if points for this order ID were already redeemed, return existing account & transaction
  const existingTxs = await getLoyaltyTransactionsApi(accountId);
  const existingRedeemTx = existingTxs.find(
    (t) => t.orderId === orderId && (t.type === 'redeemed' || t.points < 0)
  );
  if (existingRedeemTx) {
    return {
      account: current,
      discountInr: Math.abs(existingRedeemTx.amountInr || calculatePointsDiscount(Math.abs(existingRedeemTx.points))),
      tx: existingRedeemTx,
    };
  }

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
 * Refund / reinstate redeemed Nest Points when an order is cancelled or refunded.
 */
export async function refundLoyaltyPointsApi(
  rawKey: string,
  pointsToRefund: number,
  orderId: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string }
): Promise<{ account: LoyaltyAccount; tx: LoyaltyTransaction } | null> {
  const accountId = sanitizeLoyaltyKey(rawKey);
  const current = await getLoyaltyAccountApi(accountId, extra);

  const existingTxs = await getLoyaltyTransactionsApi(accountId);
  const alreadyRefunded = existingTxs.some(
    (t) => t.orderId === orderId && t.type === 'refund' && t.points > 0
  );
  if (alreadyRefunded) return null;

  const ptsRefund = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, Math.max(0, Math.floor(pointsToRefund)));
  if (ptsRefund <= 0) return null;

  const currentSpent = current.lifetimeSpent || 0;
  const newLifetimeSpent = Math.max(0, currentSpent - ptsRefund);
  const newBalance = Math.max(0, (current.lifetimeEarned || 0) - newLifetimeSpent);
  const now = Date.now();

  const updatedAccount: LoyaltyAccount = {
    ...current,
    lifetimeSpent: newLifetimeSpent,
    pointsBalance: newBalance,
    updatedAt: now,
  };

  const cleanOrderId = (orderId || `ord_${now}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const tx: LoyaltyTransaction = {
    id: `tx_refund_${cleanOrderId}_${accountId}`,
    accountId,
    orderId,
    type: 'refund',
    points: ptsRefund,
    amountInr: calculatePointsDiscount(ptsRefund),
    description: `Refund of ${ptsRefund} Nest Points for cancelled Order #${orderId}`,
    createdAt: now,
    status: 'credited',
  };

  saveLocalAccount(updatedAccount);
  saveLocalTransaction(tx);

  try {
    await Promise.all([
      setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty_transactions', tx.id), stripUndefined(tx), { merge: true }).catch(() => {}),
    ]);
  } catch {}

  return { account: updatedAccount, tx };
}

function getLocalReferralRecords(): Record<string, ReferralRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REFERRALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalReferralRecord(record: ReferralRecord): void {
  try {
    const map = getLocalReferralRecords();
    map[record.referredUid] = record;
    localStorage.setItem(LOCAL_STORAGE_REFERRALS_KEY, JSON.stringify(map));
  } catch {}
}

export async function getReferralRewardsConfigApi(): Promise<ReferralRewardsConfig> {
  try {
    const res = await fetch('/api/referrals/config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.enabled === 'boolean') {
        const cfg: ReferralRewardsConfig = {
          ...DEFAULT_REFERRAL_REWARDS_CONFIG,
          ...data,
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_REFERRAL_CONFIG_KEY, JSON.stringify(cfg));
        } catch {}
        return cfg;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'referral_rewards_config', 'config'));
    if (snap.exists()) {
      const cfg: ReferralRewardsConfig = {
        ...DEFAULT_REFERRAL_REWARDS_CONFIG,
        ...(snap.data() as Partial<ReferralRewardsConfig>),
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_REFERRAL_CONFIG_KEY, JSON.stringify(cfg));
      } catch {}
      return cfg;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_REFERRAL_CONFIG_KEY);
    if (cached) {
      return { ...DEFAULT_REFERRAL_REWARDS_CONFIG, ...JSON.parse(cached) };
    }
  } catch {}

  return { ...DEFAULT_REFERRAL_REWARDS_CONFIG };
}

export async function saveReferralRewardsConfigApi(
  partial: Partial<ReferralRewardsConfig>
): Promise<ReferralRewardsConfig> {
  const current = await getReferralRewardsConfigApi();
  const updated: ReferralRewardsConfig = {
    ...current,
    ...partial,
    rewardPointsReferrer: Math.max(
      1,
      Math.round(Number(partial.rewardPointsReferrer ?? current.rewardPointsReferrer) || LOYALTY_REFERRAL_REWARD_POINTS)
    ),
    rewardPointsReferred: Math.max(
      1,
      Math.round(Number(partial.rewardPointsReferred ?? current.rewardPointsReferred) || LOYALTY_REFERRAL_REWARD_POINTS)
    ),
    minOrderSubtotalInr: Math.max(
      100,
      Math.round(Number(partial.minOrderSubtotalInr ?? current.minOrderSubtotalInr) || 1299)
    ),
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_REFERRAL_CONFIG_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await fetch('/api/referrals/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch {}

  try {
    await setDoc(doc(db, 'referral_rewards_config', 'config'), stripUndefined(updated), { merge: true });
  } catch {}

  try {
    window.dispatchEvent(new Event('cotton-nest-referrals-updated'));
  } catch {}

  return updated;
}

/**
 * Finds an existing referrer LoyaltyAccount by its personal `referralCode` (e.g., NEST-XXXX123).
 */
async function findReferrerAccountByCode(cleanCode: string): Promise<LoyaltyAccount | null> {
  // 1. Check Firestore `loyalty` collection
  try {
    const q = query(collection(db, 'loyalty'), where('referralCode', '==', cleanCode), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { ...(d.data() as LoyaltyAccount), id: d.id };
    }
  } catch {}

  // 2. Check local cached loyalty accounts
  const localMap = getLocalAccounts();
  for (const acc of Object.values(localMap)) {
    if (acc && acc.referralCode && acc.referralCode.trim().toUpperCase() === cleanCode) {
      return acc;
    }
  }

  return null;
}

/**
 * Apply a friend's referral code (`Apply Referral Code`).
 * IMPORTANT (Section 2, 3, 5):
 * - Entering or applying a referral code MUST NOT immediately credit points.
 * - Both referrer (+100 Nest Points) and referred customer (+100 Nest Points) are credited ONLY after
 *   the referred customer's first eligible order (subtotal >= ₹1,299, no Welcome Offer, no Nest Points redeemed)
 *   is marked Delivered and paid.
 */
export async function claimReferralRewardApi(
  rawKey: string,
  referralCodeInput: string,
  extra?: { name?: string; phone?: string; email?: string; userId?: string; orders?: Order[] }
): Promise<{
  account: LoyaltyAccount;
  pointsAwarded: number;
  tx?: LoyaltyTransaction;
  record: ReferralRecord;
  message: string;
}> {
  const cleanCode = (referralCodeInput || '').trim().toUpperCase();
  const cleanUid = String(extra?.userId || '').trim();
  const accountId = sanitizeLoyaltyKey(rawKey || cleanUid);

  if (!cleanUid || cleanUid === 'guest_default_wallet') {
    throw new Error('Please sign in to your Cotton Nest account to apply a referral code.');
  }

  const [config, current] = await Promise.all([
    getReferralRewardsConfigApi(),
    getLoyaltyAccountApi(accountId, extra),
  ]);

  // 1. Call Express backend `/api/referrals/apply` first for server-side verification
  let serverRecord: ReferralRecord | null = null;
  let serverReferrerAccount: LoyaltyAccount | null = null;
  try {
    const res = await fetch('/api/referrals/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCodeInput: cleanCode,
        referredUid: cleanUid,
        referredAccountId: accountId,
        referredEmail: extra?.email || current.email,
        referredPhone: extra?.phone || current.phone,
        referredName: extra?.name || current.customerName,
        referredOwnReferralCode: current.referralCode,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok && data?.error) {
      throw new Error(data.error);
    }
    if (data?.record) {
      serverRecord = data.record as ReferralRecord;
    }
    if (data?.referrerAccount) {
      serverReferrerAccount = data.referrerAccount as LoyaltyAccount;
    }
  } catch (err: any) {
    if (
      err?.message &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError')
    ) {
      throw err;
    }
  }

  // 2. Verify existing referral record and customer order history
  let existingReferral: ReferralRecord | null = getLocalReferralRecords()[cleanUid] || null;
  try {
    const refSnap = await getDoc(doc(db, 'referrals', cleanUid));
    if (refSnap.exists()) {
      existingReferral = refSnap.data() as ReferralRecord;
    }
  } catch {}

  let customerOrders: Order[] = Array.isArray(extra?.orders) ? extra!.orders! : [];
  if (customerOrders.length === 0) {
    try {
      const rawOrders = localStorage.getItem('cotton_nest_orders');
      if (rawOrders) {
        const parsed = JSON.parse(rawOrders);
        if (Array.isArray(parsed)) customerOrders = parsed;
      }
    } catch {}
  }

  const referrerAccount =
    serverReferrerAccount || (await findReferrerAccountByCode(cleanCode));

  if (!serverRecord) {
    const validation = validateAndCreateReferralApplication({
      referralCodeInput: cleanCode,
      referredUid: cleanUid,
      referredAccountId: accountId,
      referredEmail: extra?.email || current.email,
      referredPhone: extra?.phone || current.phone,
      referredName: extra?.name || current.customerName,
      referredOwnReferralCode: current.referralCode,
      existingReferralForUser: existingReferral,
      alreadyReferredByCodeOnAccount: current.referredByCode || null,
      referrerAccount,
      customerOrders,
      config,
      nowMs: Date.now(),
    });

    if (!validation.valid || !validation.record) {
      throw new Error(validation.error || 'Could not apply referral code.');
    }
    serverRecord = validation.record;
  }

  // 3. Atomically save in Firestore `referrals/{cleanUid}` to prevent duplicate claims
  try {
    const refDoc = doc(db, 'referrals', cleanUid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(refDoc);
      if (snap.exists()) {
        const existingData = snap.data() as ReferralRecord;
        if (existingData && existingData.referralCode) {
          throw new Error(
            `You have already applied referral code ${existingData.referralCode}. Each customer can claim only one referral code.`
          );
        }
      }
      tx.set(refDoc, stripUndefined(serverRecord!));
    });
  } catch (err: any) {
    if (err?.message && err.message.includes('already applied referral code')) {
      throw err;
    }
  }

  // 4. Update customer's LoyaltyAccount with `referredByCode` (0 points awarded at application time!)
  const now = Date.now();
  const updatedAccount: LoyaltyAccount = {
    ...current,
    userId: cleanUid,
    referredByCode: cleanCode,
    updatedAt: now,
  };

  saveLocalAccount(updatedAccount);
  saveLocalReferralRecord(serverRecord);

  try {
    await Promise.all([
      setDoc(doc(db, 'site_content', `loyalty_${accountId}`), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
      setDoc(doc(db, 'loyalty', accountId), stripUndefined(updatedAccount), { merge: true }).catch(() => {}),
    ]);
  } catch {}

  try {
    window.dispatchEvent(new Event('cotton-nest-referrals-updated'));
    window.dispatchEvent(new Event('cotton-nest-loyalty-updated'));
  } catch {}

  return {
    account: updatedAccount,
    pointsAwarded: 0, // Strictly 0 until qualifying order is delivered & paid
    record: serverRecord,
    message: REFERRAL_APPLIED_SUCCESS_MESSAGE,
  };
}

/**
 * Fetches a customer's complete referral status summary (applied referral, referrals made by them,
 * Pending Rewards, Earned Rewards, and Successful Referrals).
 */
export async function getCustomerReferralSummaryApi(params: {
  uid?: string | null;
  accountId?: string | null;
  myReferralCode: string;
  myLoyaltyAccount?: LoyaltyAccount | null;
}): Promise<CustomerReferralSummary> {
  const cleanUid = String(params.uid || '').trim();
  const cleanCode = String(params.myReferralCode || '').trim().toUpperCase();
  const config = await getReferralRewardsConfigApi();

  let appliedReferral: ReferralRecord | null = null;
  const madeByMeMap = new Map<string, ReferralRecord>();

  // 1. Check local cache first
  const localRecords = getLocalReferralRecords();
  if (cleanUid && localRecords[cleanUid]) {
    appliedReferral = localRecords[cleanUid];
  }
  Object.values(localRecords).forEach((r) => {
    if (r && cleanCode && r.referralCode === cleanCode && r.referredUid !== cleanUid) {
      madeByMeMap.set(r.referredUid, r);
    }
  });

  // 2. Fetch from Express server
  if (cleanUid || cleanCode) {
    try {
      const q = new URLSearchParams();
      if (cleanUid) q.set('uid', cleanUid);
      if (cleanCode) q.set('code', cleanCode);
      const res = await fetch(`/api/referrals/status?${q.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.appliedReferral) {
          appliedReferral = data.appliedReferral as ReferralRecord;
          saveLocalReferralRecord(appliedReferral);
        }
        if (Array.isArray(data?.referralsMadeByMe)) {
          data.referralsMadeByMe.forEach((r: ReferralRecord) => {
            if (r && r.referredUid) {
              madeByMeMap.set(r.referredUid, r);
              saveLocalReferralRecord(r);
            }
          });
        }
      }
    } catch {}
  }

  // 3. Fetch from Firestore `referrals`
  if (cleanUid) {
    try {
      const appliedSnap = await getDoc(doc(db, 'referrals', cleanUid));
      if (appliedSnap.exists()) {
        const fsApplied = appliedSnap.data() as ReferralRecord;
        if (!appliedReferral || (fsApplied.updatedAt || 0) >= (appliedReferral.updatedAt || 0)) {
          appliedReferral = fsApplied;
          saveLocalReferralRecord(fsApplied);
        }
      }
    } catch {}

    try {
      const qMade = query(collection(db, 'referrals'), where('referrerUid', '==', cleanUid), limit(50));
      const snapMade = await getDocs(qMade);
      snapMade.forEach((d) => {
        const rec = d.data() as ReferralRecord;
        if (rec && rec.referredUid) {
          madeByMeMap.set(rec.referredUid, rec);
          saveLocalReferralRecord(rec);
        }
      });
    } catch {}
  }

  return computeCustomerReferralSummary({
    config,
    myReferralCode: cleanCode,
    myLoyaltyAccount: params.myLoyaltyAccount || null,
    appliedReferral,
    referralsMadeByMe: Array.from(madeByMeMap.values()),
  });
}

/**
 * Updates a referred customer's `code_applied` ReferralRecord when they place an order.
 */
export async function handleReferralOnOrderPlacedApi(
  order: Order,
  priorOrders: Order[] = []
): Promise<ReferralRecord | null> {
  const cleanUid = String(order.userId || '').trim();
  if (!cleanUid) return null;

  let existingRecord: ReferralRecord | null = getLocalReferralRecords()[cleanUid] || null;
  try {
    const snap = await getDoc(doc(db, 'referrals', cleanUid));
    if (snap.exists()) {
      existingRecord = snap.data() as ReferralRecord;
    }
  } catch {}

  if (!existingRecord || existingRecord.status !== 'code_applied') {
    return existingRecord;
  }

  const config = await getReferralRewardsConfigApi();
  const { updatedRecord, isQualifyingOrder } = evaluateReferralOnOrderPlaced({
    record: existingRecord,
    order,
    priorOrders,
    config,
    nowMs: Date.now(),
  });

  order.referralCodeApplied = updatedRecord.referralCode;
  order.referralQualifyingOrder = isQualifyingOrder;

  saveLocalReferralRecord(updatedRecord);
  try {
    await setDoc(doc(db, 'referrals', cleanUid), stripUndefined(updatedRecord), { merge: true });
  } catch {}

  try {
    window.dispatchEvent(new Event('cotton-nest-referrals-updated'));
  } catch {}

  return updatedRecord;
}

/**
 * Idempotently settles referral rewards (+100 Nest Points to referrer and +100 Nest Points to referred friend)
 * when a qualifying order is marked Delivered.
 */
export async function handleReferralOnOrderDeliveredApi(order: Order): Promise<boolean> {
  const cleanUid = String(order.userId || '').trim();
  if (!cleanUid || order.status !== 'delivered') return false;

  let existingRecord: ReferralRecord | null = getLocalReferralRecords()[cleanUid] || null;
  try {
    const snap = await getDoc(doc(db, 'referrals', cleanUid));
    if (snap.exists()) {
      existingRecord = snap.data() as ReferralRecord;
    }
  } catch {}

  if (!existingRecord || existingRecord.rewardCredited || existingRecord.status === 'reward_earned') {
    return false;
  }

  if (existingRecord.qualifyingOrderId && existingRecord.qualifyingOrderId !== order.id) {
    return false;
  }

  const config = await getReferralRewardsConfigApi();
  const [referrerAccount, referredAccount] = await Promise.all([
    getLoyaltyAccountApi(existingRecord.referrerAccountId, {
      userId: existingRecord.referrerUid,
      name: existingRecord.referrerName,
    }),
    getLoyaltyAccountApi(existingRecord.referredAccountId, {
      userId: existingRecord.referredUid,
      name: existingRecord.referredName || order.customerName,
      email: existingRecord.referredEmail || order.customerEmail,
      phone: existingRecord.referredPhone || order.customerPhone,
    }),
  ]);

  const settlement = settleReferralRewardOnDelivery({
    record: existingRecord,
    order,
    referrerAccount,
    referredAccount,
    config,
    nowMs: Date.now(),
  });

  if (!settlement.settled) {
    if (settlement.updatedRecord.status !== existingRecord.status) {
      saveLocalReferralRecord(settlement.updatedRecord);
      try {
        await setDoc(doc(db, 'referrals', cleanUid), stripUndefined(settlement.updatedRecord), { merge: true });
      } catch {}
    }
    return false;
  }

  saveLocalReferralRecord(settlement.updatedRecord);
  if (settlement.updatedReferrerAccount) saveLocalAccount(settlement.updatedReferrerAccount);
  if (settlement.updatedReferredAccount) saveLocalAccount(settlement.updatedReferredAccount);
  if (settlement.referrerTx) saveLocalTransaction(settlement.referrerTx);
  if (settlement.referredTx) saveLocalTransaction(settlement.referredTx);

  try {
    await Promise.all([
      setDoc(doc(db, 'referrals', cleanUid), stripUndefined(settlement.updatedRecord), { merge: true }).catch(() => {}),
      settlement.updatedReferrerAccount
        ? setDoc(doc(db, 'loyalty', settlement.updatedReferrerAccount.id), stripUndefined(settlement.updatedReferrerAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      settlement.updatedReferrerAccount
        ? setDoc(doc(db, 'site_content', `loyalty_${settlement.updatedReferrerAccount.id}`), stripUndefined(settlement.updatedReferrerAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      settlement.updatedReferredAccount
        ? setDoc(doc(db, 'loyalty', settlement.updatedReferredAccount.id), stripUndefined(settlement.updatedReferredAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      settlement.updatedReferredAccount
        ? setDoc(doc(db, 'site_content', `loyalty_${settlement.updatedReferredAccount.id}`), stripUndefined(settlement.updatedReferredAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      settlement.referrerTx
        ? setDoc(doc(db, 'loyalty_transactions', settlement.referrerTx.id), stripUndefined(settlement.referrerTx), { merge: true }).catch(() => {})
        : Promise.resolve(),
      settlement.referredTx
        ? setDoc(doc(db, 'loyalty_transactions', settlement.referredTx.id), stripUndefined(settlement.referredTx), { merge: true }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {}

  try {
    window.dispatchEvent(new Event('cotton-nest-referrals-updated'));
    window.dispatchEvent(new Event('cotton-nest-loyalty-updated'));
  } catch {}

  return true;
}

/**
 * Handles referral state cancellation or point reversal when an order is marked Cancelled or Refunded.
 */
export async function handleReferralOnOrderCancelledOrRefundedApi(
  order: Order,
  status: 'cancelled' | 'refunded'
): Promise<boolean> {
  const cleanUid = String(order.userId || '').trim();
  if (!cleanUid) return false;

  let existingRecord: ReferralRecord | null = getLocalReferralRecords()[cleanUid] || null;
  try {
    const snap = await getDoc(doc(db, 'referrals', cleanUid));
    if (snap.exists()) {
      existingRecord = snap.data() as ReferralRecord;
    }
  } catch {}

  if (!existingRecord) return false;
  if (existingRecord.qualifyingOrderId && existingRecord.qualifyingOrderId !== order.id) {
    return false;
  }

  let referrerAccount: LoyaltyAccount | null = null;
  let referredAccount: LoyaltyAccount | null = null;

  if (existingRecord.rewardCredited && !existingRecord.rewardReversed) {
    [referrerAccount, referredAccount] = await Promise.all([
      getLoyaltyAccountApi(existingRecord.referrerAccountId, { userId: existingRecord.referrerUid }),
      getLoyaltyAccountApi(existingRecord.referredAccountId, { userId: existingRecord.referredUid }),
    ]);
  }

  const reversal = reverseReferralOnCancellationOrRefund({
    record: existingRecord,
    orderId: order.id,
    orderStatus: status,
    referrerAccount,
    referredAccount,
    nowMs: Date.now(),
  });

  if (!reversal.changed) return false;

  saveLocalReferralRecord(reversal.updatedRecord);
  if (reversal.updatedReferrerAccount) saveLocalAccount(reversal.updatedReferrerAccount);
  if (reversal.updatedReferredAccount) saveLocalAccount(reversal.updatedReferredAccount);
  if (reversal.referrerReversalTx) saveLocalTransaction(reversal.referrerReversalTx);
  if (reversal.referredReversalTx) saveLocalTransaction(reversal.referredReversalTx);

  try {
    await Promise.all([
      setDoc(doc(db, 'referrals', cleanUid), stripUndefined(reversal.updatedRecord), { merge: true }).catch(() => {}),
      reversal.updatedReferrerAccount
        ? setDoc(doc(db, 'loyalty', reversal.updatedReferrerAccount.id), stripUndefined(reversal.updatedReferrerAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      reversal.updatedReferrerAccount
        ? setDoc(doc(db, 'site_content', `loyalty_${reversal.updatedReferrerAccount.id}`), stripUndefined(reversal.updatedReferrerAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      reversal.updatedReferredAccount
        ? setDoc(doc(db, 'loyalty', reversal.updatedReferredAccount.id), stripUndefined(reversal.updatedReferredAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      reversal.updatedReferredAccount
        ? setDoc(doc(db, 'site_content', `loyalty_${reversal.updatedReferredAccount.id}`), stripUndefined(reversal.updatedReferredAccount), { merge: true }).catch(() => {})
        : Promise.resolve(),
      reversal.referrerReversalTx
        ? setDoc(doc(db, 'loyalty_transactions', reversal.referrerReversalTx.id), stripUndefined(reversal.referrerReversalTx), { merge: true }).catch(() => {})
        : Promise.resolve(),
      reversal.referredReversalTx
        ? setDoc(doc(db, 'loyalty_transactions', reversal.referredReversalTx.id), stripUndefined(reversal.referredReversalTx), { merge: true }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {}

  try {
    window.dispatchEvent(new Event('cotton-nest-referrals-updated'));
    window.dispatchEvent(new Event('cotton-nest-loyalty-updated'));
  } catch {}

  return true;
}

/**
 * Fetches aggregated referral tracking metrics and records for the Admin Panel.
 */
export async function getReferralAdminDataApi(): Promise<AdminReferralSummary> {
  const config = await getReferralRewardsConfigApi();
  const recordMap = new Map<string, ReferralRecord>();

  // 1. Local cache
  Object.values(getLocalReferralRecords()).forEach((r) => {
    if (r && r.referredUid) recordMap.set(r.referredUid, r);
  });

  // 2. Express server
  try {
    const res = await fetch('/api/referrals/admin', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.records)) {
        data.records.forEach((r: ReferralRecord) => {
          if (r && r.referredUid) recordMap.set(r.referredUid, r);
        });
      }
    }
  } catch {}

  // 3. Firestore collection (admin list permission)
  try {
    const snap = await getDocs(collection(db, 'referrals'));
    snap.forEach((d) => {
      const r = d.data() as ReferralRecord;
      if (r && r.referredUid) {
        const prev = recordMap.get(r.referredUid);
        if (!prev || (r.updatedAt || 0) >= (prev.updatedAt || 0)) {
          recordMap.set(r.referredUid, r);
        }
      }
    });
  } catch {}

  return computeAdminReferralSummary({
    config,
    records: Array.from(recordMap.values()),
  });
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
    if ((t.type === 'redeemed' || t.points < 0) && t.type !== 'adjustment' && Math.abs(t.points) > LOYALTY_MAX_REDEMPTION_POINTS) {
      return false;
    }
    return true;
  };

  let customerPhone = '';
  try {
    const rawProfile = localStorage.getItem('cotton_nest_customer_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed?.phone) customerPhone = String(parsed.phone).replace(/[^0-9]/g, '').slice(-10);
    }
  } catch {}
  if (!customerPhone && rawKey.replace(/[^0-9]/g, '').length >= 10) {
    customerPhone = rawKey.replace(/[^0-9]/g, '').slice(-10);
  }

  const localList = getLocalTransactions(accountId);
  if (customerPhone && `phone_${customerPhone}` !== accountId) {
    localList.push(...getLocalTransactions(`phone_${customerPhone}`));
  }
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
    const qStr = customerPhone ? `?phone=${encodeURIComponent(customerPhone)}` : '';
    const res = await fetch(`/api/loyalty/${encodeURIComponent(accountId)}/transactions${qStr}`);
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
