import React, { useState } from 'react';
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
} from 'lucide-react';
import { useLoyalty } from '../context/LoyaltyContext';
import { useAuth } from '../context/AuthContext';
import {
  LOYALTY_POINTS_PER_100_INR,
  LOYALTY_MIN_REDEMPTION_POINTS,
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

export const LoyaltyRewardsModal: React.FC<LoyaltyRewardsModalProps> = ({
  isOpen,
  onClose,
  onShopCatalogue,
  onOpenCart,
}) => {
  const {
    pointsBalance,
    pointsRupeesValue,
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
  } = useLoyalty();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger'>('overview');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [friendReferralInput, setFriendReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [claimingReferral, setClaimingReferral] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-lg rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with decorative luxury gold accent */}
        <div className="relative bg-gradient-to-br from-[#70252D] via-[#8C2E46] to-[#541B22] text-white p-6 pb-7 rounded-t-3xl overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent pointer-events-none" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close loyalty modal"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[11px] font-semibold tracking-wider uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Cotton Nest · Nest Points Program</span>
          </div>

          <h3 className="font-serif-luxury text-2xl font-bold tracking-tight text-white mb-1">
            Customer Nest Points Wallet
          </h3>
          <p className="text-xs text-white/80">
            {user?.name ? `Welcome, ${user.name}` : '5 Points per ₹100 · 100 Points = ₹50'}
          </p>

          {/* Points Balance Card Highlight */}
          <div className="mt-5 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-medium text-amber-200 uppercase tracking-wider block">
                Available Nest Points
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {pointsBalance.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-semibold text-amber-200">Nest Points</span>
              </div>
              <span className="text-xs text-white/90 font-medium block mt-0.5">
                Equivalent Rupee Value: <strong>₹{pointsRupeesValue.toLocaleString('en-IN')}</strong> (100 pts = ₹50)
              </span>
            </div>

            <div className="p-3 bg-amber-400/20 rounded-2xl border border-amber-300/30 text-amber-300 flex flex-col items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                {canRedeemPoints(pointsBalance) ? 'Redeemable' : `Min ${LOYALTY_MIN_REDEMPTION_POINTS}`}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-[#EAE2D5] bg-[#FAF7F2] shrink-0">
          <div className="grid grid-cols-2 p-1 bg-[#EAE2D5]/50 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-[#2C2420] shadow-xs'
                  : 'text-[#7A6458] hover:text-[#2C2420]'
              }`}
            >
              Nest Points &amp; Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-white text-[#2C2420] shadow-xs'
                  : 'text-[#7A6458] hover:text-[#2C2420]'
              }`}
            >
              <span>Points &amp; Expiry Ledger</span>
              {transactions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#EAE2D5] text-[#2C2420]">
                  {transactions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {activeTab === 'overview' ? (
            <>
              {/* Summary Grid: Earned, Used, Expiry */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Earned (Purchases)
                  </span>
                  <span className="font-mono text-base font-extrabold text-emerald-800 mt-0.5 block">
                    +{pointsEarnedFromPurchases} pts
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Points Used
                  </span>
                  <span className="font-mono text-base font-extrabold text-rose-700 mt-0.5 block">
                    {pointsUsed} pts
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#EAE2D5]">
                  <span className="text-[10px] text-[#7A6458] font-semibold uppercase block">
                    Next Expiry
                  </span>
                  <span className="font-semibold text-[11px] text-[#2C2420] mt-1 block truncate">
                    {formattedNextExpiry}
                  </span>
                </div>
              </div>

              {/* Rule Card: 5 pts per ₹100 & 100 pts = ₹50 */}
              <div className="p-4 bg-white rounded-2xl border border-[#DEC89B] space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 text-[#70252D] font-bold text-sm">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-700 border border-amber-200">
                    <Sparkles className="w-4 h-4 text-[#C29E57]" />
                  </div>
                  <span>Nest Points Rules &amp; Terms</span>
                </div>
                <ul className="space-y-1 text-[11px] text-[#6B5D55] list-disc pl-4">
                  <li><strong>Earn Rate:</strong> <strong>{LOYALTY_POINTS_PER_100_INR} Nest Points per ₹100</strong> spent on bedsheets.</li>
                  <li><strong>Redemption Value:</strong> <strong>100 Points = ₹50</strong> (1 Nest Point = ₹0.50).</li>
                  <li><strong>Minimum Redemption:</strong> Minimum <strong>{LOYALTY_MIN_REDEMPTION_POINTS} points</strong> (₹100 value) required for redemption.</li>
                  <li><strong>Credited After Delivery:</strong> Points are credited only after successful delivery and full payment.</li>
                  <li><strong>No Points on Delivery Charges:</strong> Shipping / delivery charges do not earn Nest Points.</li>
                  <li><strong>Expiry:</strong> Points expire after <strong>{LOYALTY_EXPIRY_MONTHS} months</strong> from credit date.</li>
                  <li><strong>Non-Cash:</strong> Points cannot be exchanged for cash.</li>
                </ul>
              </div>

              {/* Referral Rewards Card */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5">
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
                      ? `Apply ${pointsBalance} pts (-₹${pointsRupeesValue}) automatically in your shopping bag`
                      : `Minimum ${LOYALTY_MIN_REDEMPTION_POINTS} Nest Points required to redeem`}
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
            /* Points History / Ledger */
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Clock className="w-8 h-8 text-[#DEC89B] mx-auto" />
                  <p className="font-medium text-[#2C2420]">No points transactions yet</p>
                  <p className="text-[11px] text-[#7A6458] max-w-xs mx-auto">
                    Place an order to earn {LOYALTY_POINTS_PER_100_INR} Nest Points for every ₹100 spent (credited after delivery &amp; full payment)!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((t) => {
                    const isEarned = t.type === 'earned' || t.type === 'bonus' || t.type === 'referral' || t.points > 0;
                    const expiryDate = isEarned ? new Date(getTransactionExpiryDate(t.createdAt, t.expiresAt)) : null;
                    const expired = isTransactionExpired(t.createdAt, t.expiresAt);
                    return (
                      <div
                        key={t.id}
                        className="p-3 bg-white rounded-xl border border-[#EAE2D5] flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
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
                            <p className="font-bold text-[#2C2420] truncate">{t.description}</p>
                            <span className="text-[10px] text-[#8C7A70] block">
                              Credited: {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {expiryDate && (
                                <span className={`ml-2 ${expired ? 'text-rose-600 font-semibold' : 'text-amber-800'}`}>
                                  · {expired ? 'Expired' : `Expires ${expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold font-mono text-xs ${
                              isEarned ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isEarned ? `+${Math.abs(t.points)}` : `-${Math.abs(t.points)}`} pts
                          </span>
                          <span className="text-[10px] text-[#8C7A70] block">
                            ≈ ₹{calculatePointsDiscount(Math.abs(t.points))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
