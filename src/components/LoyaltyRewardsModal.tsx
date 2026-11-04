import React, { useState } from 'react';
import { X, Sparkles, Award, Gift, ArrowRight, Clock, CheckCircle2, ChevronRight, ShieldCheck, ShoppingBag, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useLoyalty } from '../context/LoyaltyContext';
import { useAuth } from '../context/AuthContext';
import { LOYALTY_EARNING_RATE_INR, LOYALTY_POINT_VALUE_INR } from '../data/loyalty';

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
  const { pointsBalance, pointsRupeesValue, lifetimeEarned, lifetimeSpent, transactions, isLoading } = useLoyalty();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger'>('overview');

  if (!isOpen) return null;

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
            <span>Cotton Nest · Royal Club</span>
          </div>

          <h3 className="font-serif-luxury text-2xl font-bold tracking-tight text-white mb-1">
            Customer Loyalty Rewards
          </h3>
          <p className="text-xs text-white/80">
            {user?.name ? `Welcome, ${user.name}` : 'Atelier Loyalty Rewards Wallet'}
          </p>

          {/* Points Balance Card Highlight */}
          <div className="mt-5 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-amber-200 uppercase tracking-wider block">
                Active Reward Balance
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {pointsBalance.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-semibold text-amber-200">Points</span>
              </div>
              <span className="text-xs text-white/90 font-medium block mt-0.5">
                ≈ ₹{pointsRupeesValue.toLocaleString('en-IN')} instant checkout discount
              </span>
            </div>

            <div className="p-3 bg-amber-400/20 rounded-2xl border border-amber-300/30 text-amber-300 flex flex-col items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">Active</span>
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
              Benefits & How it Works
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
              <span>Points History</span>
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
              {/* Rule Card: 1 pt per 50 Rs */}
              <div className="p-4 bg-white rounded-2xl border border-[#DEC89B] space-y-3 shadow-2xs">
                <div className="flex items-center gap-2.5 text-[#70252D] font-bold text-sm">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-700 border border-amber-200">
                    <Sparkles className="w-4 h-4 text-[#C29E57]" />
                  </div>
                  <span>Rule: 1 Point for every ₹{LOYALTY_EARNING_RATE_INR} Spent</span>
                </div>
                <p className="text-[#6B5D55] leading-relaxed">
                  Every time you purchase a pure combed cotton bedsheet, dohar, or bed set from Cotton Nest Atelier, you automatically earn <strong>1 loyalty point for every ₹{LOYALTY_EARNING_RATE_INR}</strong> in order value.
                </p>
                <div className="pt-2 border-t border-[#EAE2D5] flex items-center justify-between text-[11px] text-[#7A6458]">
                  <span>Earn Rate: <strong>1 pt / ₹{LOYALTY_EARNING_RATE_INR}</strong></span>
                  <span>Redemption: <strong>1 pt = ₹{LOYALTY_POINT_VALUE_INR} discount</strong></span>
                </div>
              </div>

              {/* How it Works Steps */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#7A6458]">
                  How to Earn & Redeem
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#2C2420]">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-extrabold">1</span>
                      <span>Shop Authentic Bedding</span>
                    </div>
                    <p className="text-[11px] text-[#7A6458]">
                      Place an order on the website or via WhatsApp. Points are credited immediately upon order placement.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#EAE2D5] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#2C2420]">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-extrabold">2</span>
                      <span>Redeem at Checkout</span>
                    </div>
                    <p className="text-[11px] text-[#7A6458]">
                      In your shopping bag, toggle "Apply Loyalty Points". Your points instantly reduce the order total by ₹1 per point.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/60 grid grid-cols-2 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider block">
                    Lifetime Earned
                  </span>
                  <span className="font-serif-luxury text-lg font-bold text-[#70252D]">
                    +{lifetimeEarned} pts
                  </span>
                </div>
                <div className="border-l border-amber-200/60">
                  <span className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider block">
                    Total Redeemed
                  </span>
                  <span className="font-serif-luxury text-lg font-bold text-emerald-800">
                    -₹{lifetimeSpent} saved
                  </span>
                </div>
              </div>

              {/* Phone / User identification reassurance */}
              <div className="p-2.5 bg-white rounded-xl border border-[#EAE2D5] flex items-center gap-2 text-[11px] text-[#7A6458]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Points are safely tied to your mobile WhatsApp number and account across visits.
                </span>
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
                    Place an order to start earning 1 point for every ₹50 spent at Cotton Nest!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((t) => {
                    const isEarned = t.type === 'earned' || t.points > 0;
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
                              {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold font-mono text-xs ${
                              isEarned ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isEarned ? `+${t.points}` : t.points} pts
                          </span>
                          {t.amountInr !== undefined && (
                            <span className="text-[10px] text-[#8C7A70] block">
                              {isEarned ? `(₹${t.amountInr})` : `-₹${t.amountInr}`}
                            </span>
                          )}
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
            <span>1 Point = </span>
            <strong className="text-[#2C2420]">₹1 Discount</strong>
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
