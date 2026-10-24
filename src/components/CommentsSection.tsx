import React, { useState } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  Heart,
  HelpCircle,
  Palette,
  Droplets,
  Truck,
  CheckCircle2,
  CornerDownRight,
  Filter,
  Search,
  User,
  ShieldCheck,
  Check
} from 'lucide-react';
import { CommentItem, CommentReply } from '../data/comments';
import { BedsheetProduct } from '../data/products';
import { motion, AnimatePresence } from 'motion/react';

interface CommentsSectionProps {
  comments: CommentItem[];
  products: BedsheetProduct[];
  onAddComment: (newComment: CommentItem) => void;
  onLikeComment?: (commentId: string) => void;
  onAddReply?: (commentId: string, reply: CommentReply) => void;
  filterProductId?: string; // If provided, locks or highlights comments for a specific bedsheet
  isEmbeddedInModal?: boolean; // If rendered inside ProductModal
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  products,
  onAddComment,
  onLikeComment,
  onAddReply,
  filterProductId,
  isEmbeddedInModal = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>(
    filterProductId || 'all'
  );

  // Form State
  const [name, setName] = useState<string>('');
  const [city, setCity] = useState<string>('Gurgaon');
  const [category, setCategory] = useState<'general' | 'question' | 'styling' | 'care' | 'order'>('question');
  const [targetProductId, setTargetProductId] = useState<string>(filterProductId || 'general');
  const [commentText, setCommentText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(isEmbeddedInModal);

  // In-line replying state
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyAuthor, setReplyAuthor] = useState<string>('Customer Response');
  const [replyText, setReplyText] = useState<string>('');

  // Local liked tracking
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const handleLike = (id: string) => {
    if (likedMap[id]) return;
    setLikedMap((prev) => ({ ...prev, [id]: true }));
    onLikeComment?.(id);
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !commentText.trim()) {
      setFormError('Please enter your name and comment.');
      return;
    }
    setFormError(null);

    setIsSubmitting(true);
    const prod = products.find((p) => p.id === targetProductId);

    const newComment: CommentItem = {
      id: `cmt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      authorName: name.trim(),
      authorCity: city.trim() || 'Gurgaon',
      authorRole: category === 'question' ? 'Inquiring Buyer' : 'Verified Buyer',
      content: commentText.trim(),
      productId: targetProductId,
      productName: prod ? prod.name : 'General Cotton Nest Question',
      category: category,
      createdAt: Date.now(),
      likesCount: 1,
    };

    onAddComment(newComment);
    setIsSubmitting(false);
    setSubmittedSuccess(true);
    setCommentText('');

    setTimeout(() => {
      setSubmittedSuccess(false);
      if (!isEmbeddedInModal) {
        setIsFormOpen(false);
      }
    }, 2000);
  };

  const handleReplySubmit = (commentId: string) => {
    if (!replyText.trim()) return;

    const reply: CommentReply = {
      author: replyAuthor.trim() || 'Community Member',
      role: replyAuthor.toLowerCase().includes('atelier') ? 'Cotton Nest Team' : 'Community Member',
      text: replyText.trim(),
      date: Date.now(),
    };

    onAddReply?.(commentId, reply);
    setReplyingCommentId(null);
    setReplyText('');
  };

  // Filtered comments
  const filteredComments = comments.filter((c) => {
    // 1. Modal product filter
    if (filterProductId && c.productId !== filterProductId && c.productId !== 'general') {
      return false;
    }
    // 2. Dropdown product filter
    if (selectedProductFilter !== 'all') {
      if (c.productId !== selectedProductFilter && c.productId !== 'general') {
        return false;
      }
    }
    // 3. Category filter
    if (activeCategory !== 'all' && c.category !== activeCategory) {
      return false;
    }
    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAuthor = c.authorName.toLowerCase().includes(q);
      const matchCity = c.authorCity.toLowerCase().includes(q);
      const matchContent = c.content.toLowerCase().includes(q);
      const matchProduct = c.productName?.toLowerCase().includes(q);
      if (!matchAuthor && !matchCity && !matchContent && !matchProduct) {
        return false;
      }
    }
    return true;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'question':
        return {
          icon: <HelpCircle className="w-3 h-3 text-amber-700" />,
          label: 'Q&A / Size Fit',
          bg: 'bg-amber-50 text-amber-900 border-amber-200'
        };
      case 'styling':
        return {
          icon: <Palette className="w-3 h-3 text-[#B83F60]" />,
          label: 'Bedroom Styling',
          bg: 'bg-[#FDEAF0] text-[#8C2E46] border-[#FAD1DC]'
        };
      case 'care':
        return {
          icon: <Droplets className="w-3 h-3 text-sky-700" />,
          label: 'Wash & Fabric Care',
          bg: 'bg-sky-50 text-sky-900 border-sky-200'
        };
      case 'order':
        return {
          icon: <Truck className="w-3 h-3 text-emerald-700" />,
          label: 'Gurgaon Dispatch & Delivery',
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-200'
        };
      default:
        return {
          icon: <MessageSquare className="w-3 h-3 text-[#7A6458]" />,
          label: 'General Discussion',
          bg: 'bg-[#FAF7F2] text-[#4A3E38] border-[#EAE2D5]'
        };
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={isEmbeddedInModal ? "space-y-6 pt-4" : "py-12 sm:py-16 bg-[#FAF7F2] border-t border-[#EAE2D5]"}>
      <div className={isEmbeddedInModal ? "w-full" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"}>
        
        {/* Section Header (Only shown when not in modal) */}
        {!isEmbeddedInModal && (
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0DC] text-[#9E7B3B] text-xs font-semibold tracking-wider uppercase border border-[#DEC89B]">
              <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
              Community Discussion &amp; Q&amp;A
            </div>

            <h2 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#2C2420]">
              Customer Comments &amp; Atelier Q&amp;A
            </h2>

            <p className="text-sm sm:text-base text-[#6B5D55] leading-relaxed">
              Have a question about King size tuck-ins, cotton breathability, or Gurgaon atelier pickups? Ask fellow homeowners and our textile team below.
            </p>
          </div>
        )}

        {/* Action Bar & Search / Filter Controls */}
        <div className="bg-white rounded-2xl border border-[#DEC89B]/80 p-4 sm:p-5 mb-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9B8C83] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search comments by keyword, product, or Gurgaon area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs sm:text-sm text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
              />
            </div>

            {/* Dropdown for specific product (if not locked in modal) */}
            {!filterProductId && (
              <div className="shrink-0">
                <select
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57] cursor-pointer"
                >
                  <option value="all">All Bedsheets &amp; General</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Post a Comment Button */}
            <button
              type="button"
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="px-4 py-2 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-2 shrink-0"
            >
              <MessageSquare className="w-4 h-4 text-[#DEC89B]" />
              <span>{isFormOpen ? 'Close Comment Form' : 'Ask a Question / Post Comment'}</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[#8C7A70] font-semibold flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter by:
            </span>

            {[
              { id: 'all', label: `All Comments (${comments.length})` },
              { id: 'question', label: 'Q&A / Fit & Drop' },
              { id: 'styling', label: 'Styling & Decor' },
              { id: 'care', label: 'Wash & Fabric Care' },
              { id: 'order', label: 'Gurgaon Delivery' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-[#2C2420] text-white border-[#2C2420] shadow-xs font-semibold'
                    : 'bg-white text-[#6B5D55] border-[#EAE2D5] hover:border-[#DEC89B]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Comment / Question Form */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-8"
            >
              <form
                onSubmit={handleFormSubmit}
                className="bg-white rounded-2xl border border-[#C29E57] p-5 sm:p-7 shadow-md space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#EAE2D5] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#FDEAF0] text-[#8C2E46] rounded-xl">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                        Post a Comment or Question
                      </h3>
                      <p className="text-xs text-[#7A6458]">
                        Share feedback or ask our textile atelier team about sizing, care, or orders.
                      </p>
                    </div>
                  </div>
                  {!isEmbeddedInModal && (
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="text-xs text-[#8C7A70] hover:text-[#2C2420] underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B5D55] uppercase tracking-wider mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Radhika Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B5D55] uppercase tracking-wider mb-1">
                      City / Area *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sector 57, Gurgaon"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B5D55] uppercase tracking-wider mb-1">
                      Topic Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57] cursor-pointer"
                    >
                      <option value="question">Question &amp; Sizing Fit</option>
                      <option value="styling">Styling &amp; Decor Advice</option>
                      <option value="care">Wash &amp; Fabric Care</option>
                      <option value="order">Order &amp; Delivery</option>
                      <option value="general">General Community Feedback</option>
                    </select>
                  </div>
                </div>

                {/* Target product selector if not in modal */}
                {!filterProductId && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B5D55] uppercase tracking-wider mb-1">
                      Regarding Bedsheet Design
                    </label>
                    <select
                      value={targetProductId}
                      onChange={(e) => setTargetProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-hidden focus:border-[#C29E57] cursor-pointer"
                    >
                      <option value="general">General / All Cotton Sheets</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (₹{p.price.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[#6B5D55] uppercase tracking-wider mb-1">
                    Your Comment or Question *
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={600}
                    placeholder="Ask about mattress thickness, washing instructions, delivery in Gurgaon, or share your thoughts on the prints..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs sm:text-sm text-[#2C2420] focus:outline-hidden focus:border-[#C29E57]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#9B8C83] mt-1">
                    <span>Clean language and community respect are maintained.</span>
                    <span>{commentText.length}/600</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || submittedSuccess}
                    className="px-6 py-2.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Comment Posted!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Post Comment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comments Feed */}
        <div className="space-y-4">
          {filteredComments.length > 0 ? (
            filteredComments.map((comment) => {
              const badge = getCategoryBadge(comment.category);
              const isLiked = likedMap[comment.id];
              const likesCount = (comment.likesCount || 0) + (isLiked ? 1 : 0);

              return (
                <div
                  key={comment.id}
                  className="bg-white rounded-2xl border border-[#EAE2D5] p-5 sm:p-6 shadow-xs hover:border-[#DEC89B] transition-colors space-y-3.5"
                >
                  {/* Top Bar: Author, City, Badge, Date */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-[#F4EFE6] text-[#8C2E46] border border-[#EAE2D5] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {comment.authorName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-[#2C2420]">
                            {comment.authorName}
                          </span>
                          {comment.authorRole && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#8C7A70] border border-[#EAE2D5]">
                              {comment.authorRole}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#8C7A70]">
                          {comment.authorCity} · {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Category pill */}
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </div>
                  </div>

                  {/* Product Tag if applicable */}
                  {comment.productName && comment.productId !== 'general' && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded border border-[#FAD1DC]">
                      <span>Re: {comment.productName}</span>
                    </div>
                  )}

                  {/* Comment Body */}
                  <p className="text-xs sm:text-sm text-[#382D26] leading-relaxed">
                    {comment.content}
                  </p>

                  {/* Atelier Official Response (if present) */}
                  {comment.reply && (
                    <div className="mt-3 ml-2 sm:ml-6 p-3.5 sm:p-4 rounded-xl bg-[#FAF7F2] border-l-3 border-[#C29E57] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#C29E57]" />
                          <span className="font-bold text-[#2C2420]">
                            {comment.reply.author}
                          </span>
                          <span className="text-[10px] text-[#A8823B] font-semibold bg-[#FAF0DC] px-1.5 py-0.5 rounded">
                            {comment.reply.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8C7A70]">
                          {formatTimeAgo(comment.reply.date)}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A3E38] leading-relaxed">
                        {comment.reply.text}
                      </p>
                    </div>
                  )}

                  {/* In-line Reply Input form */}
                  {replyingCommentId === comment.id && (
                    <div className="mt-3 p-3.5 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#2C2420]">
                          Reply to {comment.authorName}:
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyingCommentId(null)}
                          className="text-[11px] text-[#8C7A70] hover:text-[#2C2420]"
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Your Name (e.g. Fellow Homeowner / Cotton Nest Team)"
                        value={replyAuthor}
                        onChange={(e) => setReplyAuthor(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                      <textarea
                        rows={2}
                        placeholder="Write your reply or advice..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(comment.id)}
                          className="px-3 py-1 bg-[#8C2E46] text-white rounded-lg text-xs font-semibold hover:bg-[#742438] cursor-pointer"
                        >
                          Submit Reply
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions: Helpful Like & Reply Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#EAE2D5]/60 text-xs">
                    <button
                      type="button"
                      onClick={() => handleLike(comment.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        isLiked
                          ? 'bg-[#FDEAF0] text-[#8C2E46] font-semibold'
                          : 'text-[#6B5D55] hover:bg-[#F4EFE6] hover:text-[#2C2420]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#8C2E46] text-[#8C2E46]' : ''}`} />
                      <span>Helpful ({likesCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id)}
                      className="inline-flex items-center gap-1 text-[#8C7A70] hover:text-[#8C2E46] transition-colors cursor-pointer font-medium"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl border border-[#EAE2D5] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FAF7F2] text-[#8C7A70] flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6 text-[#A8988D]" />
              </div>
              <h4 className="font-serif-luxury text-base font-semibold text-[#2C2420]">
                No comments found for this filter
              </h4>
              <p className="text-xs text-[#7A6458] max-w-sm mx-auto">
                Be the first to start a conversation or ask our Gurgaon atelier team a question!
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                  setSelectedProductFilter('all');
                  setIsFormOpen(true);
                }}
                className="mt-2 px-4 py-2 bg-[#8C2E46] text-white text-xs font-semibold rounded-xl hover:bg-[#742438] cursor-pointer"
              >
                Post the First Comment
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
