import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Award,
  Gift,
  Clock,
  ShieldCheck,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  History,
  Filter,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  Download,
} from 'lucide-react';
import { useLoyalty } from '../context/LoyaltyContext';
import { useAuth } from '../context/AuthContext';
import {
  LoyaltyTransaction,
  LOYALTY_POINTS_PER_100_INR,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_MAX_REDEMPTION_POINTS,
  LOYALTY_EXPIRY_MONTHS,
  LOYALTY_REFERRAL_REWARD_POINTS,
  calculatePointsDiscount,
  canRedeemPoints,
  getTransactionExpiryDate,
  isTransactionExpired,
} from '../data/loyalty';
import { COMPANY_DETAILS } from '../data/products';

interface LoyaltyRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShopCatalogue?: () => void;
  onOpenCart?: () => void;
}

/**
 * Formats a loyalty transaction into a clean, human-readable chronological log title
 * e.g., "+50 points: Order #1234", "+100 points: Referral Bonus", "-200 points: Redeemed on Order #1234"
 */
function getTransactionTitle(t: LoyaltyTransaction): string {
  const isEarned = t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0;
  const pts = Math.abs(t.points);

  if (!isEarned) {
    if (t.orderId) {
      return `-${pts} points: Redeemed on Order #${t.orderId}`;
    }
    return `-${pts} points: Redeemed at Checkout`;
  }

  if (t.type === 'referral') {
    return `+${pts} points: Referral Bonus${t.orderId ? ` (${t.orderId})` : ''}`;
  }

  if (t.orderId) {
    return `+${pts} points: Order #${t.orderId}`;
  }

  if (t.description) {
    const orderMatch = t.description.match(/Order\s*#?([A-Za-z0-9_-]+)/i);
    if (orderMatch) {
      return `+${pts} points: Order #${orderMatch[1]}`;
    }
    return `+${pts} points: ${t.description.replace(/^Earned on /i, '')}`;
  }

  return `+${pts} points: Delivered Order`;
}

export const LoyaltyRewardsModal: React.FC<LoyaltyRewardsModalProps> = ({
  isOpen,
  onClose,
  onShopCatalogue,
  onOpenCart,
}) => {
  const {
    pointsBalance,
    pointsRupeesValue,
    lifetimeEarned,
    lifetimeSpent,
    pointsEarnedFromPurchases,
    pointsUsed,
    referralPointsEarned,
    referralCode,
    referredByCode,
    nextExpiryTimestamp,
    preferRedeemAtCheckout,
    setPreferRedeemAtCheckout,
    claimReferralReward,
    transactions,
    loadTransactions,
    refreshLoyalty,
  } = useLoyalty();

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [friendReferralInput, setFriendReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [claimingReferral, setClaimingReferral] = useState(false);

  // Sync latest loyalty data and transactions whenever modal opens
  useEffect(() => {
    if (isOpen) {
      refreshLoyalty();
      loadTransactions();
    }
  }, [isOpen, refreshLoyalty, loadTransactions]);

  // Sort transactions chronologically: newest first
  const chronologicalTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [transactions]);

  // Filtered transactions based on filter tabs
  const filteredTransactions = useMemo(() => {
    if (historyFilter === 'earned') {
      return chronologicalTransactions.filter(
        (t) => t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0
      );
    }
    if (historyFilter === 'redeemed') {
      return chronologicalTransactions.filter((t) => t.type === 'redeemed' || t.points < 0);
    }
    return chronologicalTransactions;
  }, [chronologicalTransactions, historyFilter]);

  const earnedTxsCount = useMemo(() => {
    return chronologicalTransactions.filter(
      (t) => t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0
    ).length;
  }, [chronologicalTransactions]);

  const redeemedTxsCount = useMemo(() => {
    return chronologicalTransactions.filter((t) => t.type === 'redeemed' || t.points < 0).length;
  }, [chronologicalTransactions]);

  if (!isOpen) return null;

  const formattedNextExpiry = nextExpiryTimestamp
    ? new Date(nextExpiryTimestamp).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : `${LOYALTY_EXPIRY_MONTHS} months from credit date`;

  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendReferralInput.trim()) return;
    setClaimingReferral(true);
    setReferralStatus(null);
    const res = await claimReferralReward(friendReferralInput.trim(), user?.phone);
    setClaimingReferral(false);
    setReferralStatus({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });
    if (res.success) {
      setFriendReferralInput('');
    }
  };

  const handleDownloadCsvHistory = () => {
    if (!chronologicalTransactions || chronologicalTransactions.length === 0) return;

    const headers = ['Transaction ID', 'Date & Time', 'Type', 'Points Delta', 'INR Value (INR)', 'Order ID', 'Description'];
    
    const rows = chronologicalTransactions.map((t) => {
      const isEarned = t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0;
      const ptsDelta = isEarned ? `+${Math.abs(t.points)}` : `-${Math.abs(t.points)}`;
      const typeLabel = t.type ? t.type.toUpperCase() : isEarned ? 'EARNED' : 'REDEEMED';
      const dateStr = new Date(t.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const inrVal = calculatePointsDiscount(Math.abs(t.points));
      const orderRef = t.orderId || '';
      const desc = t.description || '';

      return [
        t.id,
        dateStr,
        typeLabel,
        ptsDelta,
        `₹${inrVal}`,
        orderRef,
        desc,
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const userIdentifier = user?.phone || user?.email || 'customer';
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `cotton_nest_nest_points_history_${userIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-lg rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Luxury Gold & Royal Burgundy Header */}
        <div className="relative bg-gradient-to-br from-[#70252D] via-[#8C2E46] to-[#541B22] text-white p-5 sm:p-6 pb-6 rounded-t-3xl overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-52 h-52 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/25 via-transparent to-transparent pointer-events-none" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close loyalty modal"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[11px] font-semibold tracking-wider uppercase mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Cotton Nest · Nest Points Program</span>
          </div>

          <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
            Customer Nest Points Wallet
          </h3>
          <p className="text-xs text-white/85">
            {user?.name ? `Welcome, ${user.name}` : '5 Points per ₹100 · 100 Points = ₹50'}
          </p>

          {/* Points Balance Card Highlight */}
          <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-200 uppercase tracking-wider block">
                Available Nest Points
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {pointsBalance.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-semibold text-amber-200">Nest Points</span>
              </div>
              <span className="text-xs text-white/95 font-medium block mt-0.5">
                Equivalent Rupee Value: <strong className="text-amber-200">₹{pointsRupeesValue.toLocaleString('en-IN')}</strong> (100 pts = ₹50)
              </span>
            </div>

            <div className="p-3 bg-amber-400/20 rounded-2xl border border-amber-300/30 text-amber-200 flex flex-col items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-amber-300" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                {canRedeemPoints(pointsBalance) ? 'Redeemable' : `Min ${LOYALTY_MIN_REDEMPTION_POINTS}`}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Overview vs Points History */}
        <div className="px-5 sm:px-6 pt-3.5 pb-2 border-b border-[#EAE2D5] bg-[#FAF7F2] shrink-0">
          <div className="grid grid-cols-2 p-1 bg-[#EAE2D5]/60 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-white text-[#2C2420] shadow-xs'
                  : 'text-[#7A6458] hover:text-[#2C2420]'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-[#C29E57]" />
              <span>Nest Points &amp; Rules</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white text-[#70252D] shadow-xs font-bold'
                  : 'text-[#7A6458] hover:text-[#2C2420]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#8C2E46]" />
              <span>Points History</span>
              {chronologicalTransactions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#DEC89B]/50 text-[#70252D] font-bold">
                  {chronologicalTransactions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content (Scrollable Area) */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {activeTab === 'overview' ? (
            <>
              {/* Summary Grid: Earned, Used, Expiry */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] shadow-2xs">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Earned (Purchases)
                  </span>
                  <span className="font-mono text-base font-extrabold text-emerald-800 mt-0.5 block">
                    +{pointsEarnedFromPurchases} pts
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] shadow-2xs">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Points Used
                  </span>
                  <span className="font-mono text-base font-extrabold text-rose-700 mt-0.5 block">
                    {pointsUsed} pts
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] shadow-2xs">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Next Expiry
                  </span>
                  <span className="font-semibold text-[11px] text-[#2C2420] mt-1 block truncate">
                    {formattedNextExpiry}
                  </span>
                </div>
              </div>

              {/* Quick Jump to Points History */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-[#FAF7F2] rounded-2xl border border-[#DEC89B] flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-100/70 text-[#70252D] border border-amber-200/80 shrink-0">
                    <History className="w-4 h-4 text-[#8C2E46]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#2C2420] text-xs">
                      Points History Log
                    </h4>
                    <p className="text-[11px] text-[#7A6458] truncate">
                      {chronologicalTransactions.length > 0
                        ? `${chronologicalTransactions.length} recorded transaction(s) · Newest first`
                        : 'Chronological log of earned & redeemed Nest Points'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-3 py-1.5 bg-white hover:bg-amber-50 text-[#70252D] border border-[#DEC89B] rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-2xs"
                >
                  <span>View History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Rule Card: 5 pts per ₹100 & 100 pts = ₹50 */}
              <div className="p-4 bg-white rounded-2xl border border-[#DEC89B] space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 text-[#70252D] font-bold text-sm">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-700 border border-amber-200">
                    <Sparkles className="w-4 h-4 text-[#C29E57]" />
                  </div>
                  <span>Nest Points Rules &amp; Terms</span>
                </div>
                <ul className="space-y-1 text-[11px] text-[#6B5D55] list-disc pl-4 leading-relaxed">
                  <li><strong>Earn Rate:</strong> <strong>{LOYALTY_POINTS_PER_100_INR} Nest Points per ₹100</strong> spent on bedsheets.</li>
                  <li><strong>Redemption Value:</strong> <strong>100 Points = ₹50</strong> (1 Nest Point = ₹0.50).</li>
                  <li><strong>Redemption Limit per Order:</strong> Redeem up to a maximum of <strong>{LOYALTY_MAX_REDEMPTION_POINTS} Nest Points</strong> (₹{calculatePointsDiscount(LOYALTY_MAX_REDEMPTION_POINTS)} discount) per order.</li>
                  <li><strong>Minimum Redemption:</strong> Minimum <strong>{LOYALTY_MIN_REDEMPTION_POINTS} points</strong> required for redemption.</li>
                  <li><strong>Credited After Delivery:</strong> Points are credited only after successful delivery and full payment.</li>
                  <li><strong>No Points on Delivery Charges:</strong> Shipping / delivery charges do not earn Nest Points.</li>
                  <li><strong>Expiry:</strong> Points expire after <strong>{LOYALTY_EXPIRY_MONTHS} months</strong> from credit date.</li>
                  <li><strong>Non-Cash:</strong> Points cannot be exchanged for cash.</li>
                </ul>

                {/* Additional Terms & Conditions for Nest Points Redemption */}
                <div className="pt-2.5 mt-2.5 border-t border-[#EAE2D5] space-y-1.5">
                  <h5 className="font-bold text-[#8C2E46] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Additional Terms &amp; Conditions for Nest Points Redemption</span>
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#6B5D55]">
                    <li>Nest Points are account-specific and non-transferable. They can only be redeemed by the registered customer to whom they were credited.</li>
                    <li>Nest Points cannot be exchanged for cash or transferred to another account.</li>
                    <li>Redemption is permitted only on eligible purchases.</li>
                    <li>Maximum redemption is capped at 125 Nest Points per order.</li>
                    <li>Customers must have sufficient available points at checkout to redeem them.</li>
                    <li>Once an order is successfully placed using Nest Points, the redeemed points must be deducted from the available balance.</li>
                    <li>If an order is cancelled or refunded, redeemed points must be reinstated after verification, according to the applicable refund process.</li>
                    <li>Cotton Nest reserves the right to reverse points credited incorrectly or obtained through fraudulent transactions.</li>
                    <li>Nest Points have no independent cash value and cannot be redeemed outside the Cotton Nest website.</li>
                    <li>Cotton Nest reserves the right to modify or discontinue the loyalty programme with reasonable notice.</li>
                  </ol>
                </div>
              </div>

              {/* Referral Rewards Card */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2C2420] flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#8C2E46]" />
                    <span>Referral Rewards (+{LOYALTY_REFERRAL_REWARD_POINTS} pts)</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Earned: {referralPointsEarned} pts
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-[#FAF7F2] rounded-xl border border-[#DEC89B]">
                  <div>
                    <span className="text-[10px] text-[#7A6458] block">Your Referral Code</span>
                    <span className="font-mono font-extrabold text-sm text-[#70252D]">{referralCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferralCode}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-[#2C2420] border border-[#DEC89B] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedReferral ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedReferral ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                {!referredByCode && (
                  <form onSubmit={handleClaimReferral} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={friendReferralInput}
                      onChange={(e) => setFriendReferralInput(e.target.value.toUpperCase())}
                      placeholder="Enter friend's referral code"
                      className="flex-1 px-2.5 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-lg text-xs uppercase font-semibold placeholder:normal-case placeholder:font-normal"
                    />
                    <button
                      type="submit"
                      disabled={claimingReferral || !friendReferralInput.trim()}
                      className="px-3 py-1.5 bg-[#8C2E46] text-white rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {claimingReferral ? '...' : 'Claim'}
                    </button>
                  </form>
                )}

                {referralStatus && (
                  <p className={`text-[11px] font-semibold ${referralStatus.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {referralStatus.message}
                  </p>
                )}
              </div>

              {/* Redeem Option at Checkout */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#2C2420] block">Redeem Points at Checkout</span>
                  <span className="text-[10px] text-[#7A6458]">
                    {canRedeemPoints(pointsBalance)
                      ? `Apply up to ${Math.min(pointsBalance, LOYALTY_MAX_REDEMPTION_POINTS)} pts (-₹${calculatePointsDiscount(Math.min(pointsBalance, LOYALTY_MAX_REDEMPTION_POINTS))}) per order in your shopping bag`
                      : `Minimum ${LOYALTY_MIN_REDEMPTION_POINTS} Nest Points required to redeem (max ${LOYALTY_MAX_REDEMPTION_POINTS} pts/order)`}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferRedeemAtCheckout}
                  onChange={(e) => setPreferRedeemAtCheckout(e.target.checked)}
                  disabled={!canRedeemPoints(pointsBalance)}
                  className="accent-[#70252D] w-4 h-4 cursor-pointer disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            /* DEDICATED 'POINTS HISTORY' CHRONOLOGICAL LOG & SCROLLABLE CONTAINER */
            <div className="space-y-3.5">
              
              {/* Header and Filter Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                <div>
                  <h4 className="font-serif-luxury font-bold text-sm text-[#70252D] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#8C2E46]" />
                    <span>Points History Ledger</span>
                  </h4>
                  <p className="text-[11px] text-[#7A6458]">
                    Chronological audit log of earned &amp; redeemed Nest Points
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-[#EAE2D5]/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        historyFilter === 'all'
                          ? 'bg-white text-[#70252D] shadow-2xs'
                          : 'text-[#7A6458] hover:text-[#2C2420]'
                      }`}
                    >
                      All ({chronologicalTransactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('earned')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        historyFilter === 'earned'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-[#7A6458] hover:text-emerald-800'
                      }`}
                    >
                      Earned ({earnedTxsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('redeemed')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        historyFilter === 'redeemed'
                          ? 'bg-[#70252D] text-white shadow-2xs'
                          : 'text-[#7A6458] hover:text-rose-800'
                      }`}
                    >
                      Redeemed ({redeemedTxsCount})
                    </button>
                  </div>

                  {/* Download CSV Button */}
                  <button
                    type="button"
                    onClick={handleDownloadCsvHistory}
                    disabled={chronologicalTransactions.length === 0}
                    className="px-2.5 py-1.5 bg-[#70252D] hover:bg-[#5a1c22] disabled:opacity-40 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
                    title="Download Points History as CSV file"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" />
                    <span>CSV Download</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Container for the Points History List */}
              <div className="max-h-72 sm:max-h-80 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-amber-200/80 hover:scrollbar-thumb-amber-300">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-3 shadow-2xs">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C29E57]">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#2C2420]">
                        {historyFilter === 'all'
                          ? 'No Points History Yet'
                          : historyFilter === 'earned'
                          ? 'No Points Earned Yet'
                          : 'No Points Redeemed Yet'}
                      </p>
                      <p className="text-[11px] text-[#7A6458] max-w-xs mx-auto mt-1 leading-relaxed">
                        {historyFilter === 'all'
                          ? `Nest Points are logged automatically upon successful delivery of orders (5 pts / ₹100 spent) or referral rewards (+100 pts).`
                          : historyFilter === 'earned'
                          ? `Delivered orders earn 5 Nest Points per ₹100 spent (excluding delivery charges).`
                          : `Points redeemed at checkout (min. ${LOYALTY_MIN_REDEMPTION_POINTS} pts = ₹100) will appear here.`}
                      </p>
                    </div>

                    {historyFilter === 'all' && (
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyReferralCode}
                          className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-amber-50 text-[#70252D] border border-[#DEC89B] rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedReferral ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Share Referral Code (+100 pts)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredTransactions.map((t) => {
                    const isEarned =
                      t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0;
                    const expiryDate = isEarned
                      ? new Date(getTransactionExpiryDate(t.createdAt, t.expiresAt))
                      : null;
                    const expired = isTransactionExpired(t.createdAt, t.expiresAt);
                    const title = getTransactionTitle(t);
                    const formattedDate = new Date(t.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = new Date(t.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <div
                        key={t.id}
                        className={`p-3.5 rounded-2xl border transition-all shadow-2xs ${
                          isEarned
                            ? 'bg-white hover:border-emerald-300 border-[#EAE2D5]'
                            : 'bg-white hover:border-rose-300 border-[#EAE2D5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          
                          {/* Left: Direction Icon & Main Log Line */}
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                isEarned
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isEarned ? (
                                <ArrowDownLeft className="w-4 h-4" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              {/* Main chronological log title: e.g. "+50 points: Order #1234" */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5
                                  className={`font-bold text-xs sm:text-sm font-sans tracking-tight ${
                                    isEarned ? 'text-emerald-900' : 'text-rose-900'
                                  }`}
                                >
                                  {title}
                                </h5>

                                {t.type === 'referral' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                    Referral
                                  </span>
                                )}

                                {t.orderId && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                    #{t.orderId}
                                  </span>
                                )}
                              </div>

                              {/* Secondary description */}
                              <p className="text-[11px] text-[#6B5D55] mt-0.5 leading-normal">
                                {t.description}
                              </p>

                              {/* Timestamp & Expiry Details */}
                              <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#8C7A70] mt-1.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#A8988D]" />
                                  <span>{formattedDate} at {formattedTime}</span>
                                </span>

                                {expiryDate && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded-md font-medium ${
                                      expired
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                                        : 'bg-amber-50 text-amber-900 border border-amber-200'
                                    }`}
                                  >
                                    {expired
                                      ? `Expired on ${expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                      : `Expires: ${expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (12 mos)`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Points Delta & Rupee Equivalent */}
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block font-mono font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                                isEarned
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isEarned ? `+${Math.abs(t.points)}` : `-${Math.abs(t.points)}`} pts
                            </span>
                            <span className="text-[10px] text-[#7A6458] font-medium block mt-1">
                              ≈ ₹{calculatePointsDiscount(Math.abs(t.points))} value
                            </span>
                          </div>

                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ledger Summary Stats */}
              <div className="p-3 bg-white rounded-2xl border border-[#DEC89B] grid grid-cols-3 gap-2 text-center shadow-2xs">
                <div>
                  <span className="text-[10px] text-[#7A6458] uppercase font-semibold block">Total Earned</span>
                  <span className="font-mono font-bold text-xs text-emerald-800 mt-0.5 block">
                    +{lifetimeEarned} pts
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7A6458] uppercase font-semibold block">Total Redeemed</span>
                  <span className="font-mono font-bold text-xs text-rose-800 mt-0.5 block">
                    -{lifetimeSpent} pts
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7A6458] uppercase font-semibold block">Active Balance</span>
                  <span className="font-mono font-bold text-xs text-[#70252D] mt-0.5 block">
                    {pointsBalance} pts (₹{pointsRupeesValue})
                  </span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-[#F4EFE6]/70 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[#7A6458]">
            <span>100 Nest Points = </span>
            <strong className="text-[#2C2420]">₹50 Discount</strong>
          </div>

          <div className="flex items-center gap-2">
            {onShopCatalogue && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShopCatalogue();
                }}
                className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Explore Catalogue
              </button>
            )}

            {onOpenCart && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCart();
                }}
                className="px-4 py-2 bg-[#70252D] hover:bg-[#5a1c22] text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Go to Checkout</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

