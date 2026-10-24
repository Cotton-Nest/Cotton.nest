import React, { useState, useMemo } from 'react';
import { BedsheetProduct, COMPANY_DETAILS } from '../data/products';
import { SeasonalConfig, SeasonalItemDiscount } from '../data/seasonal';
import { resolveBedsheetImage } from '../utils/imageUrl';
import {
  Sparkles,
  ShoppingBag,
  Eye,
  Check,
  MessageCircle,
  Tag,
  ShieldCheck,
  Clock,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Flame,
  Gift,
  Truck,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { motion } from 'motion/react';

interface SeasonalViewProps {
  products: BedsheetProduct[];
  seasonalConfig: SeasonalConfig;
  onAddToCart: (product: BedsheetProduct, customPrice?: number) => void;
  onQuickView: (product: BedsheetProduct) => void;
  addedProductIds: string[];
  isOwnerMode?: boolean;
  onOpenAdmin?: () => void;
  onExploreFullCatalogue?: () => void;
}

export const SeasonalView: React.FC<SeasonalViewProps> = ({
  products,
  seasonalConfig,
  onAddToCart,
  onQuickView,
  addedProductIds,
  isOwnerMode = false,
  onOpenAdmin,
  onExploreFullCatalogue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'under1000' | 'bigDiscount' | 'inStock'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'discountDesc'>('default');

  // Match products with seasonal item discounts
  const seasonalProductsWithPricing = useMemo(() => {
    const itemMap = new Map<string, SeasonalItemDiscount>();
    (seasonalConfig.items || []).forEach((item) => {
      itemMap.set(item.productId, item);
    });

    // Filter only products present in seasonalConfig.items
    const matched = products
      .filter((p) => itemMap.has(p.id))
      .map((p) => {
        const itemDiscount = itemMap.get(p.id)!;
        const regularPrice = p.price;
        const originalPrice = p.originalPrice || Math.round(regularPrice * 1.35);

        let finalOfferPrice = itemDiscount.discountPrice;
        let finalDiscountPct = itemDiscount.discountPercentage;

        if (finalOfferPrice && !finalDiscountPct) {
          finalDiscountPct = Math.max(5, Math.round(((originalPrice - finalOfferPrice) / originalPrice) * 100));
        } else if (finalDiscountPct && !finalOfferPrice) {
          finalOfferPrice = Math.round(originalPrice * (1 - finalDiscountPct / 100));
        } else if (!finalOfferPrice && !finalDiscountPct) {
          // Default 20% off regular price
          finalDiscountPct = 20;
          finalOfferPrice = Math.round(regularPrice * 0.8);
        }

        const savings = Math.max(0, originalPrice - (finalOfferPrice || regularPrice));

        return {
          product: p,
          itemDiscount,
          offerPrice: finalOfferPrice || regularPrice,
          originalPrice,
          discountPercentage: finalDiscountPct || 20,
          savings,
          badge: itemDiscount.customBadge || `${finalDiscountPct}% OFF`,
        };
      });

    return matched;
  }, [products, seasonalConfig.items]);

  // Filter and search
  const filteredItems = useMemo(() => {
    return seasonalProductsWithPricing.filter(({ product, offerPrice, discountPercentage }) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = product.name.toLowerCase().includes(q);
        const matchDesc = (product.description || '').toLowerCase().includes(q);
        const matchPattern = (product.pattern || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchPattern) return false;
      }

      if (selectedFilter === 'under1000' && offerPrice > 1000) return false;
      if (selectedFilter === 'bigDiscount' && discountPercentage < 20) return false;
      if (selectedFilter === 'inStock' && !product.inStock) return false;

      return true;
    });
  }, [seasonalProductsWithPricing, searchQuery, selectedFilter]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    if (sortBy === 'priceAsc') {
      list.sort((a, b) => a.offerPrice - b.offerPrice);
    } else if (sortBy === 'priceDesc') {
      list.sort((a, b) => b.offerPrice - a.offerPrice);
    } else if (sortBy === 'discountDesc') {
      list.sort((a, b) => b.discountPercentage - a.discountPercentage);
    }
    return list;
  }, [filteredItems, sortBy]);

  return (
    <div
      className="min-h-screen pb-24 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--color-background, #FAF7F2)',
        color: 'var(--color-text, #2C2420)',
      }}
    >
      {/* Top Notice Banner if defined */}
      {seasonalConfig.bannerNotice && (
        <aside
          aria-label="Festive Banner"
          className="border-b py-2 px-4 text-center text-xs font-medium tracking-wide flex items-center justify-center gap-2 shadow-2xs"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #EAE2D5)',
            color: 'var(--color-primary, #70252D)',
          }}
        >
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
          <span>{seasonalConfig.bannerNotice}</span>
        </aside>
      )}

      {/* Hero Header Section */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-14 sm:pb-16 border-b border-[var(--color-border,#EAE2D5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="max-w-3xl mx-auto text-center space-y-4">
            
            {/* Seasonal Badge Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-2xs"
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                borderColor: 'var(--color-accent, #C29E57)',
                color: 'var(--color-primary, #70252D)',
              }}
            >
              <Gift className="w-3.5 h-3.5 text-amber-600" />
              <span>{seasonalConfig.badge || 'Seasonal Special'}</span>
              {seasonalConfig.discountLabel && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-amber-700 font-extrabold">{seasonalConfig.discountLabel}</span>
                </>
              )}
            </motion.div>

            {/* Dynamic Page Title */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-serif-luxury text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight"
              style={{ color: 'var(--color-text, #2C2420)' }}
            >
              {seasonalConfig.name || 'Festive Offers & Deals'}
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-base sm:text-lg font-medium"
              style={{ color: 'var(--color-primary, #70252D)' }}
            >
              {seasonalConfig.tagline || 'Limited edition seasonal savings on pure natural cotton bedsheets.'}
            </motion.p>

            {/* Promotional Description */}
            {seasonalConfig.description && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed"
                style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
              >
                {seasonalConfig.description}
              </motion.p>
            )}

            {/* Store Owner Fast Shortcut Bar */}
            {isOwnerMode && onOpenAdmin && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-2 flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border shadow-2xs hover:opacity-90 transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    borderColor: 'var(--color-accent, #C29E57)',
                    color: 'var(--color-primary, #70252D)',
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Edit {seasonalConfig.name} in Admin Panel</span>
                </button>
              </motion.div>
            )}

            {/* Key Perks Guarantee Bar */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-[11px] font-semibold text-left">
              <div
                className="p-2.5 rounded-xl border flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>100% Combed Natural Cotton</span>
              </div>

              <div
                className="p-2.5 rounded-xl border flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Special Festive Discount Rates</span>
              </div>

              <div
                className="p-2.5 rounded-xl border flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Gurgaon Fast Hand Delivery</span>
              </div>

              <div
                className="p-2.5 rounded-xl border flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                <span>2 Matching Pillow Shams Included</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Products & Interactive Filter Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Controls Bar: Search, Quick Filters, Sort */}
        <div
          className="p-4 rounded-2xl border shadow-xs mb-8 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #EAE2D5)',
          }}
        >
          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${seasonalConfig.name}...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] text-[var(--color-text,#2C2420)] focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary,#70252D)]"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] border-transparent'
                  : 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-text-secondary,#6B5D55)] border-[var(--color-border,#EAE2D5)] hover:border-[var(--color-primary,#70252D)]'
              }`}
            >
              All Festive Deals ({seasonalProductsWithPricing.length})
            </button>

            <button
              onClick={() => setSelectedFilter('under1000')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                selectedFilter === 'under1000'
                  ? 'bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] border-transparent'
                  : 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-text-secondary,#6B5D55)] border-[var(--color-border,#EAE2D5)] hover:border-[var(--color-primary,#70252D)]'
              }`}
            >
              Under ₹1,000
            </button>

            <button
              onClick={() => setSelectedFilter('bigDiscount')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                selectedFilter === 'bigDiscount'
                  ? 'bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] border-transparent'
                  : 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-text-secondary,#6B5D55)] border-[var(--color-border,#EAE2D5)] hover:border-[var(--color-primary,#70252D)]'
              }`}
            >
              🔥 20%+ OFF
            </button>

            <button
              onClick={() => setSelectedFilter('inStock')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                selectedFilter === 'inStock'
                  ? 'bg-[var(--color-primary,#70252D)] text-[var(--color-primary-contrast,#FFFFFF)] border-transparent'
                  : 'bg-[var(--color-background,#FAF7F2)] text-[var(--color-text-secondary,#6B5D55)] border-[var(--color-border,#EAE2D5)] hover:border-[var(--color-primary,#70252D)]'
              }`}
            >
              In Stock Only
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs text-[var(--color-text-secondary,#6B5D55)] font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] text-[var(--color-text,#2C2420)] font-medium cursor-pointer focus:outline-hidden"
            >
              <option value="default">Featured</option>
              <option value="discountDesc">Highest Discount</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Product Cards Grid */}
        {sortedItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {sortedItems.map(({ product, offerPrice, originalPrice, discountPercentage, savings, badge }, idx) => {
              const isAdded = addedProductIds.includes(product.id);
              const resolvedImg = resolveBedsheetImage(product.image, product.id, product.updatedAt);

              const whatsappOrderMsg = `Hello Cotton Nest! I would like to order "${product.name}" from the ${seasonalConfig.name} at the special price of ₹${offerPrice.toLocaleString('en-IN')}. Please confirm availability.`;

              return (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: idx * 0.08 }}
                  className="rounded-2xl border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    borderColor: 'var(--color-border, #EAE2D5)',
                  }}
                >
                  {/* Bedsheet Image Container */}
                  <div className="relative aspect-4/3 overflow-hidden bg-stone-100 cursor-pointer" onClick={() => onQuickView(product)}>
                    <img
                      src={resolvedImg}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickView(product);
                        }}
                        className="w-full py-2 bg-white/95 text-[var(--color-text,#2C2420)] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:bg-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Fabric &amp; Pillow Shams</span>
                      </button>
                    </div>

                    {/* Festive Discount Tag - Top Left */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                      <span
                        className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide rounded-md text-white shadow-md flex items-center gap-1"
                        style={{ backgroundColor: 'var(--color-primary, #70252D)' }}
                      >
                        <Flame className="w-3 h-3 text-amber-300" />
                        <span>{badge}</span>
                      </span>

                      {/* Stock status indicator */}
                      {!product.inStock && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-600 text-white shadow-xs">
                          Made to Order
                        </span>
                      )}
                    </div>

                    {/* King Size Spec Tag - Top Right */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white/90 backdrop-blur-xs text-[#2C2420] border border-[#DEC89B] shadow-xs">
                        108″×108″ King
                      </span>
                    </div>
                  </div>

                  {/* Card Details Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Sub-header info */}
                      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary,#6B5D55)] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: 'var(--color-accent, #C29E57)' }}>
                          {product.collection || 'Signature Combed Cotton'}
                        </span>
                        <span className="text-[11px]">{product.threadCount || 'Pure Percale'}</span>
                      </div>

                      {/* Title */}
                      <h3
                        onClick={() => onQuickView(product)}
                        className="font-serif-luxury text-lg sm:text-xl font-semibold tracking-tight group-hover:text-[var(--color-primary,#70252D)] transition-colors cursor-pointer line-clamp-1"
                        style={{ color: 'var(--color-text, #2C2420)' }}
                      >
                        {product.name}
                      </h3>

                      {/* Description preview */}
                      <p
                        className="text-xs line-clamp-2 mt-1 leading-relaxed"
                        style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
                      >
                        {product.description || 'Pure combed natural cotton bedsheet crafted in Sector 46 Gurgaon.'}
                      </p>
                    </div>

                    {/* Pricing Zone */}
                    <div
                      className="pt-3 border-t border-[var(--color-border,#EAE2D5)] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-xl sm:text-2xl font-bold tracking-tight"
                            style={{ color: 'var(--color-primary, #70252D)' }}
                          >
                            ₹{offerPrice.toLocaleString('en-IN')}
                          </span>
                          {originalPrice > offerPrice && (
                            <span className="text-xs line-through text-[var(--color-text-secondary,#6B5D55)] opacity-60">
                              ₹{originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        {savings > 0 && (
                          <div className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Tag className="w-3 h-3" />
                            <span>Save ₹{savings.toLocaleString('en-IN')} ({discountPercentage}% OFF)</span>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-right text-[var(--color-text-secondary,#6B5D55)]">
                        +2 Pillow Covers<br /><strong>Free Shipping</strong>
                      </span>
                    </div>

                    {/* Action Buttons: Add to Bag + WhatsApp Order */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onAddToCart(product, offerPrice)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-xs ${
                          isAdded
                            ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                            : 'hover:opacity-90'
                        }`}
                        style={
                          !isAdded
                            ? {
                                backgroundColor: 'var(--color-primary, #70252D)',
                                color: 'var(--color-primary-contrast, #FFFFFF)',
                              }
                            : undefined
                        }
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Added to Bag! (₹{offerPrice})</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Add to Bag · ₹{offerPrice.toLocaleString('en-IN')}</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onQuickView(product)}
                          className="flex-1 py-1.5 px-3 rounded-lg border border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] text-[var(--color-text,#2C2420)] text-xs font-semibold hover:border-[var(--color-primary,#70252D)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Photos &amp; Specs</span>
                        </button>

                        <a
                          href={COMPANY_DETAILS.whatsappUrl(whatsappOrderMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 px-3 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>

                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          /* Empty State if no products match or none added to seasonal list yet */
          <div
            className="p-12 text-center rounded-3xl border border-dashed border-[var(--color-border,#EAE2D5)] max-w-xl mx-auto space-y-4 my-12"
            style={{ backgroundColor: 'var(--color-surface, #FFFFFF)' }}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Gift className="w-7 h-7" />
            </div>

            <h3
              className="font-serif-luxury text-2xl font-semibold"
              style={{ color: 'var(--color-text, #2C2420)' }}
            >
              No Bedsheets Match Your Filter
            </h3>

            <p
              className="text-xs sm:text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
            >
              {seasonalProductsWithPricing.length === 0
                ? `The store owner hasn't assigned bedsheets to the ${seasonalConfig.name} collection yet. Please check back soon or browse our full catalogue!`
                : 'Try adjusting your search query or price filters to see available festive deals.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {searchQuery || selectedFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFilter('all');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-primary,#70252D)] text-white hover:opacity-90 cursor-pointer"
                >
                  Reset Filters
                </button>
              ) : null}

              {onExploreFullCatalogue && (
                <button
                  type="button"
                  onClick={onExploreFullCatalogue}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border,#EAE2D5)] text-[var(--color-text,#2C2420)] hover:bg-[var(--color-background,#FAF7F2)] cursor-pointer"
                >
                  Explore Full Catalogue ({products.length} Bedsheets)
                </button>
              )}

              {isOwnerMode && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 cursor-pointer flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Open Admin to Add Bedsheets</span>
                </button>
              )}
            </div>
          </div>
        )}

      </section>

      {/* Bottom Reassurance Footer Callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div
          className="p-8 sm:p-10 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #EAE2D5)',
          }}
        >
          <div className="space-y-2 text-center md:text-left">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-accent, #C29E57)' }}
            >
              Curated Bedsheet Guarantee
            </span>
            <h3
              className="font-serif-luxury text-2xl sm:text-3xl font-semibold"
              style={{ color: 'var(--color-text, #2C2420)' }}
            >
              Want to See Swatches in Person?
            </h3>
            <p
              className="text-xs sm:text-sm max-w-lg leading-relaxed"
              style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
            >
              Visit our Cotton Nest Atelier at Sector 46 Gurgaon, or WhatsApp us for real fabric video walkthroughs before ordering.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {onExploreFullCatalogue && (
              <button
                type="button"
                onClick={onExploreFullCatalogue}
                className="w-full sm:w-auto px-5 py-3 text-xs font-semibold rounded-xl border border-[var(--color-border,#EAE2D5)] bg-[var(--color-background,#FAF7F2)] text-[var(--color-text,#2C2420)] hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Full Catalogue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <a
              href={COMPANY_DETAILS.whatsappUrl(`Hello Cotton Nest! I am browsing the ${seasonalConfig.name} and would like to ask some questions.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 text-xs font-bold rounded-xl text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};
