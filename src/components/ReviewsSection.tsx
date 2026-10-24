import React, { useState } from 'react';
import { Star, ShieldCheck, Heart, ThumbsUp, Sparkles, MessageSquare, Filter, CheckCircle2 } from 'lucide-react';
import { ProductReview, getOverallRatingSummary } from '../data/reviews';
import { BedsheetProduct } from '../data/products';
import { motion } from 'motion/react';

interface ReviewsSectionProps {
  reviews: ProductReview[];
  products: BedsheetProduct[];
  onOpenWriteReview: (productId?: string) => void;
  onHelpfulClick?: (reviewId: string) => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  reviews,
  products,
  onOpenWriteReview,
  onHelpfulClick,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | '5' | '4' | string>('all');
  const [helpfulVoted, setHelpfulVoted] = useState<Record<string, boolean>>({});

  const summary = getOverallRatingSummary(reviews);

  const filteredReviews = reviews.filter((r) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === '5') return r.rating === 5;
    if (selectedFilter === '4') return r.rating === 4;
    return r.productId === selectedFilter;
  });

  const handleVote = (id: string) => {
    if (helpfulVoted[id]) return;
    setHelpfulVoted((prev) => ({ ...prev, [id]: true }));
    onHelpfulClick?.(id);
  };

  return (
    <section
      id="customer-reviews"
      className="py-14 sm:py-20 border-t transition-colors duration-300"
      style={{
        backgroundColor: 'var(--color-background, #FAF7F2)',
        borderColor: 'var(--color-border, #EAE2D5)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDEAF0] text-[#B83F60] text-xs font-semibold tracking-wider uppercase border border-[#FAD1DC]">
            <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
            Verified Customer Reviews
          </div>

          <h2 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#2C2420]">
            Loved by Homes Across Gurgaon &amp; India
          </h2>

          <p className="text-sm sm:text-base text-[#6B5D55] leading-relaxed">
            Real feedback from verified homeowners who tested our 100% pure combed cotton sheets for comfort, softness, and washing durability.
          </p>
        </div>

        {/* Rating Overview Card */}
        <div
          className="rounded-3xl border p-6 sm:p-8 mb-10 shadow-xs"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #DEC89B)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Score */}
            <div className="md:col-span-4 text-center md:text-left md:border-r md:pr-6 space-y-2" style={{ borderColor: 'var(--color-border, #EAE2D5)' }}>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <span
                  className="font-serif-luxury text-5xl font-bold tracking-tight"
                  style={{ color: 'var(--color-text, #2C2420)' }}
                >
                  {summary.average}
                </span>
                <div>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-5 h-5 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>
                    Based on {reviews.length} verified customer reviews
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#3E7D5A] font-semibold flex items-center justify-center md:justify-start gap-1 pt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{summary.recommendationPercent}% of customers recommend our bedsheets</span>
              </p>
            </div>

            {/* Center Highlights */}
            <div className="md:col-span-5 grid grid-cols-3 gap-3 text-center md:px-4">
              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <span className="text-lg font-bold" style={{ color: 'var(--color-text, #2C2420)' }}>100%</span>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>Pure Natural Cotton</p>
              </div>
              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <span className="text-lg font-bold" style={{ color: 'var(--color-text, #2C2420)' }}>108″×108″</span>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>True King Proportions</p>
              </div>
              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <span className="text-lg font-bold" style={{ color: 'var(--color-text, #2C2420)' }}>Sec 46</span>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>Gurgaon Atelier</p>
              </div>
            </div>

            {/* Right Action */}
            <div className="md:col-span-3 text-center md:text-right">
              <button
                type="button"
                onClick={() => onOpenWriteReview()}
                className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--color-primary, #70252D)',
                  color: 'var(--color-primary-contrast, #FFFFFF)',
                }}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Write a Review</span>
              </button>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>
                Share your experience in 60 seconds
              </p>
            </div>

          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none text-xs">
          <span className="font-semibold flex items-center gap-1 shrink-0" style={{ color: 'var(--color-text-secondary, #7A6458)' }}>
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
            Filter Reviews:
          </span>
          <button
            onClick={() => setSelectedFilter('all')}
            className="px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer"
            style={
              selectedFilter === 'all'
                ? {
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }
                : {
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    color: 'var(--color-text-secondary, #6B5D55)',
                    border: '1px solid var(--color-border, #EAE2D5)',
                  }
            }
          >
            All Reviews ({reviews.length})
          </button>
          <button
            onClick={() => setSelectedFilter('5')}
            className="px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            style={
              selectedFilter === '5'
                ? {
                    backgroundColor: 'var(--color-primary, #70252D)',
                    color: 'var(--color-primary-contrast, #FFFFFF)',
                  }
                : {
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    color: 'var(--color-text-secondary, #6B5D55)',
                    border: '1px solid var(--color-border, #EAE2D5)',
                  }
            }
          >
            <span>5 Stars ★</span>
            <span>({reviews.filter((r) => r.rating === 5).length})</span>
          </button>
          {products.map((p) => {
            const count = reviews.filter((r) => r.productId === p.id).length;
            if (count === 0) return null;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedFilter(p.id)}
                className="px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer"
                style={
                  selectedFilter === p.id
                    ? {
                        backgroundColor: 'var(--color-primary, #70252D)',
                        color: 'var(--color-primary-contrast, #FFFFFF)',
                      }
                    : {
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text-secondary, #6B5D55)',
                        border: '1px solid var(--color-border, #EAE2D5)',
                      }
                }
              >
                {p.name.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.map((rev) => {
            const formattedDate = new Date(rev.createdAt).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const votes = (rev.helpfulCount || 0) + (helpfulVoted[rev.id] ? 1 : 0);

            return (
              <motion.div
                key={rev.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all space-y-4"
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <div className="space-y-3">
                  {/* Top Bar: Stars & Verified Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-[#DCD0C0]'
                          }`}
                        />
                      ))}
                    </div>
                    {rev.verifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3E7D5A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Verified Buyer
                      </span>
                    )}
                  </div>

                  {/* Bedsheet Pill */}
                  <div className="text-[11px] font-semibold text-[#8C2E46]">
                    Bedsheet: <span className="text-[#2C2420] underline decoration-[#FAD1DC]">{rev.productName}</span>
                  </div>

                  {/* Headline */}
                  <h3 className="font-serif-luxury text-base font-bold text-[#2C2420] leading-snug">
                    "{rev.title}"
                  </h3>

                  {/* Feedback comment */}
                  <p className="text-xs sm:text-[13px] text-[#6B5D55] leading-relaxed">
                    {rev.comment}
                  </p>

                  {/* Quality Aspect Pill Badges if present */}
                  {rev.qualityAspects && (
                    <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                      {rev.qualityAspects.fabricSoftness && (
                        <span className="bg-[#FAF7F2] text-[#7A6458] border border-[#EAE2D5] px-2 py-0.5 rounded-md">
                          Softness: {rev.qualityAspects.fabricSoftness}★
                        </span>
                      )}
                      {rev.qualityAspects.fitAndDrop && (
                        <span className="bg-[#FAF7F2] text-[#7A6458] border border-[#EAE2D5] px-2 py-0.5 rounded-md">
                          108″ Drop: {rev.qualityAspects.fitAndDrop}★
                        </span>
                      )}
                      {rev.qualityAspects.colorAccuracy && (
                        <span className="bg-[#FAF7F2] text-[#7A6458] border border-[#EAE2D5] px-2 py-0.5 rounded-md">
                          Color: {rev.qualityAspects.colorAccuracy}★
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom author and location */}
                <div className="pt-3 border-t border-[#F4EFE6] flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#2C2420]">{rev.customerName}</p>
                    <p className="text-[11px] text-[#9B8C83]">
                      {rev.customerCity} · {formattedDate}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleVote(rev.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer border ${
                      helpfulVoted[rev.id]
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                        : 'bg-[#FAF7F2] hover:bg-white text-[#7A6458] border-[#EAE2D5]'
                    }`}
                    title="Mark this review as helpful"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{votes}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
