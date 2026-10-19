import React, { useState } from 'react';
import { X, Star, CheckCircle2, ShieldCheck, HeartHandshake, Sparkles } from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { ProductReview } from '../data/reviews';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: BedsheetProduct[];
  defaultProductId?: string;
  onSubmitReview: (review: ProductReview) => void;
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  isOpen,
  onClose,
  products,
  defaultProductId,
  onSubmitReview,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    defaultProductId || (products[0]?.id ?? 'gulabi-bagh-rose')
  );
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerCity, setCustomerCity] = useState<string>('Gurgaon');
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [recommended, setRecommended] = useState<boolean>(true);
  const [softnessRating, setSoftnessRating] = useState<number>(5);
  const [fitRating, setFitRating] = useState<number>(5);
  const [colorRating, setColorRating] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    if (defaultProductId) {
      setSelectedProductId(defaultProductId);
    }
  }, [defaultProductId]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !comment.trim()) {
      alert('Please provide your name and review feedback.');
      return;
    }

    setIsSubmitting(true);
    const newReview: ProductReview = {
      id: `rev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      productId: selectedProductId,
      productName: selectedProduct?.name || 'Cotton Nest Pure Cotton Bedsheet',
      customerName: customerName.trim(),
      customerCity: customerCity.trim() || 'Gurgaon',
      rating,
      title: title.trim() || 'Verified Customer Review',
      comment: comment.trim(),
      verifiedPurchase: true,
      recommended,
      createdAt: Date.now(),
      helpfulCount: 1,
      qualityAspects: {
        fabricSoftness: softnessRating,
        fitAndDrop: fitRating,
        colorAccuracy: colorRating,
      },
    };

    onSubmitReview(newReview);
    setIsSubmitting(false);
    setSubmittedSuccess(true);

    setTimeout(() => {
      setSubmittedSuccess(false);
      onClose();
      // Reset form
      setTitle('');
      setComment('');
      setCustomerName('');
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#FAF7F2] rounded-3xl border border-[#DEC89B] shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#7A6458] hover:text-[#2C2420] hover:bg-black/5 rounded-full transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
              Thank You for Your Review!
            </h3>
            <p className="text-xs sm:text-sm text-[#7A6458] max-w-xs mx-auto">
              Your genuine review helps other families choose the perfect 100% cotton bedsheet for their homes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8C2E46] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                Customer Verified Review
              </div>
              <h2 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                Share Your Bedsheet Experience
              </h2>
              <p className="text-xs text-[#7A6458] mt-0.5">
                Tell fellow cotton lovers about the fabric feel, sizing drop, and wash experience.
              </p>
            </div>

            {/* Bedsheet Selection */}
            <div>
              <label className="text-xs font-bold text-[#2C2420] block mb-1">
                Select Bedsheet Design
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.collection} ({p.dimensions})
                  </option>
                ))}
              </select>
            </div>

            {/* Overall Star Rating */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#EAE2D5] space-y-1.5">
              <label className="text-xs font-bold text-[#2C2420] block">
                Overall Rating: {rating} of 5 Stars
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        (hoverRating || rating) >= star
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-[#DCD0C0]'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-semibold text-[#8C2E46] ml-2">
                  {rating === 5 && 'Outstanding ★★★★★'}
                  {rating === 4 && 'Very Good ★★★★'}
                  {rating === 3 && 'Average ★★★'}
                  {rating <= 2 && 'Needs Improvement'}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#2C2420] block mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pooja Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C2420] block mb-1">
                  City / Locality *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sector 57, Gurgaon"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                />
              </div>
            </div>

            {/* Review Headline */}
            <div>
              <label className="text-xs font-bold text-[#2C2420] block mb-1">
                Headline / One-Line Summary
              </label>
              <input
                type="text"
                placeholder="e.g. Perfect King size drop, truly 100% cotton!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>

            {/* Detailed Review Text */}
            <div>
              <label className="text-xs font-bold text-[#2C2420] block mb-1">
                Detailed Review *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Share your thoughts on softness, thickness, color richness, whether it tucked into your mattress properly, and packaging..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>

            {/* Quality Breakdown ratings */}
            <div className="bg-[#F4EFE6]/70 p-3 rounded-2xl border border-[#EAE2D5] space-y-2">
              <span className="text-[11px] font-bold text-[#2C2420] block uppercase tracking-wider">
                Rate Specific Aspects
              </span>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B5D55]">Fabric Softness &amp; Breathability:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSoftnessRating(val)}
                      className={`w-6 h-6 rounded text-[11px] font-bold cursor-pointer ${
                        softnessRating >= val
                          ? 'bg-amber-400 text-[#2C2420]'
                          : 'bg-white text-[#9B8C83] border border-[#EAE2D5]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B5D55]">108″ × 108″ King Fit &amp; Tuck-in Drop:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFitRating(val)}
                      className={`w-6 h-6 rounded text-[11px] font-bold cursor-pointer ${
                        fitRating >= val
                          ? 'bg-amber-400 text-[#2C2420]'
                          : 'bg-white text-[#9B8C83] border border-[#EAE2D5]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B5D55]">Color &amp; Pattern Accuracy:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setColorRating(val)}
                      className={`w-6 h-6 rounded text-[11px] font-bold cursor-pointer ${
                        colorRating >= val
                          ? 'bg-amber-400 text-[#2C2420]'
                          : 'bg-white text-[#9B8C83] border border-[#EAE2D5]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendation Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#2C2420]">
              <input
                type="checkbox"
                checked={recommended}
                onChange={(e) => setRecommended(e.target.checked)}
                className="w-4 h-4 text-[#8C2E46] rounded border-[#DEC89B] focus:ring-[#8C2E46]"
              />
              <span className="font-medium">
                Yes, I recommend Cotton Nest 100% Pure Cotton bedsheets to friends and family.
              </span>
            </label>

            {/* Submit Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Submit Verified Customer Review</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 bg-white hover:bg-[#F4EFE6] text-[#6B5D55] text-xs font-medium rounded-xl border border-[#EAE2D5] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
