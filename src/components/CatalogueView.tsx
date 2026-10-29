import React from 'react';
import {
  Search,
  Sparkles,
  Filter,
  SlidersHorizontal,
  MapPin,
  Phone,
  MessageCircle,
  X,
  Tag,
  RotateCcw,
  IndianRupee
} from 'lucide-react';
import { BedsheetProduct, BEDSHEETS_CATALOG, COMPANY_DETAILS } from '../data/products';
import { ProductCard } from './ProductCard';

interface CatalogueViewProps {
  products?: BedsheetProduct[];
  onQuickView: (product: BedsheetProduct, editMode?: boolean) => void;
  onAddToCart: (product: BedsheetProduct) => void;
  addedProductIds: Set<string>;
  customImages?: Record<string, string>;
  onUploadImage?: (productId: string, dataUrl: string) => void;
  onOpenPhotoManager?: () => void;
  onOpenAdmin?: () => void;
  isOwnerMode?: boolean;
  onOpenOwnerAuth?: () => void;
  onToggleCompare?: (product: BedsheetProduct) => void;
  comparedProductIds?: string[];
  onNotifyStock?: (product: BedsheetProduct) => void;
}

// Parses search text in real-time to detect price expressions, material keywords, and names
function parseSearchQuery(query: string) {
  let text = query.trim().toLowerCase();
  let queryMinPrice: number | null = null;
  let queryMaxPrice: number | null = null;
  let exactOrApproxPrice: number | null = null;

  // 1. Between range: "1800-2000", "1800 - 2000", "1800 to 2000", "between 1800 and 2000"
  const rangeMatch = text.match(/(?:between\s+)?(\d{3,5})\s*(?:-|to|and)\s*(\d{3,5})/i);
  if (rangeMatch) {
    queryMinPrice = parseInt(rangeMatch[1], 10);
    queryMaxPrice = parseInt(rangeMatch[2], 10);
    text = text.replace(rangeMatch[0], '').trim();
  } else {
    // 2. Under / below / <= / < pattern: "under 2000", "< 2000", "<=2000", "below 2000", "upto 2000"
    const underMatch = text.match(/(?:under|below|upto|up to|less than|<=|<)\s*(?:rs\.?|inr|₹)?\s*(\d{3,5})/i);
    if (underMatch) {
      queryMaxPrice = parseInt(underMatch[1], 10);
      text = text.replace(underMatch[0], '').trim();
    }

    // 3. Above / over / >= / > pattern: "above 1800", "> 1800", ">=1800", "over 1800"
    const aboveMatch = text.match(/(?:above|over|more than|>=|>)\s*(?:rs\.?|inr|₹)?\s*(\d{3,5})/i);
    if (aboveMatch) {
      queryMinPrice = parseInt(aboveMatch[1], 10);
      text = text.replace(aboveMatch[0], '').trim();
    }
  }

  // 4. Exact number: "1899" or "2000"
  if (/^\d{3,5}$/.test(text)) {
    exactOrApproxPrice = parseInt(text, 10);
    text = '';
  }

  // Remove currency signs or words
  text = text.replace(/(?:rs\.?|inr|₹|price|rupees)/gi, '').trim();

  return { text, queryMinPrice, queryMaxPrice, exactOrApproxPrice };
}

export const CatalogueView: React.FC<CatalogueViewProps> = ({
  products = BEDSHEETS_CATALOG,
  onQuickView,
  onAddToCart,
  addedProductIds,
  customImages = {},
  onUploadImage,
  onOpenPhotoManager,
  onOpenAdmin,
  isOwnerMode = false,
  onOpenOwnerAuth,
  onToggleCompare,
  comparedProductIds = [],
  onNotifyStock,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = React.useState<'all' | 'under-1850' | '1850-2000' | 'above-2000' | 'custom'>('all');
  const [customMinPrice, setCustomMinPrice] = React.useState<string>('');
  const [customMaxPrice, setCustomMaxPrice] = React.useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'featured' | 'price-low' | 'price-high'>('featured');
  const [isFilterExpanded, setIsFilterExpanded] = React.useState(false);

  // Filter Categories
  const filterOptions = [
    { id: 'all', label: 'All Collections' },
    { id: 'floral', label: 'Vintage Floral' },
    { id: 'geometric', label: 'Trellis & Vines' },
    { id: 'botanical', label: 'Botanical & Poppy' },
    { id: 'heritage', label: 'Artisanal & Lotus' },
  ];

  // Price Range presets
  const priceRangeOptions = [
    { id: 'all', label: 'All Prices' },
    { id: 'under-1850', label: 'Under ₹1,850' },
    { id: '1850-2000', label: '₹1,850 – ₹2,000' },
    { id: 'above-2000', label: 'Above ₹2,000' },
    { id: 'custom', label: 'Custom Range' },
  ];

  // Material presets
  const materialOptions = [
    { id: 'all', label: 'All Materials' },
    { id: 'percale', label: 'Pure Percale' },
    { id: 'combed', label: 'Combed Cotton' },
    { id: 'glace', label: 'Glace Percale' },
    { id: '350+tc', label: '350+ Thread Count' },
  ];

  // Quick search suggestions
  const quickSearchTags = [
    { label: 'English Rose', query: 'Rose' },
    { label: 'Pure Percale', query: 'Percale' },
    { label: 'Under ₹2,000', query: 'under 2000' },
    { label: '350 TC', query: '350 TC' },
    { label: 'Mint Sage', query: 'Sage' },
    { label: 'Combed Cotton', query: 'Combed' },
  ];

  // Real-time filtering by Name, Material, Price, and Collection
  const filteredProducts = React.useMemo(() => {
    const { text, queryMinPrice, queryMaxPrice, exactOrApproxPrice } = parseSearchQuery(searchQuery);

    return products
      .filter((product) => {
        // 1. Price constraint from Search Query
        if (queryMinPrice !== null && product.price < queryMinPrice) return false;
        if (queryMaxPrice !== null && product.price > queryMaxPrice) return false;
        if (exactOrApproxPrice !== null) {
          const matchesNum =
            product.price === exactOrApproxPrice ||
            Math.abs(product.price - exactOrApproxPrice) <= 100 ||
            product.price.toString().includes(exactOrApproxPrice.toString());
          if (!matchesNum) return false;
        }

        // 2. Price constraint from dedicated Price Filter Chips & Inputs
        if (selectedPriceRange === 'under-1850' && product.price >= 1850) return false;
        if (selectedPriceRange === '1850-2000' && (product.price < 1850 || product.price > 2000)) return false;
        if (selectedPriceRange === 'above-2000' && product.price <= 2000) return false;
        if (selectedPriceRange === 'custom') {
          if (customMinPrice !== '' && product.price < Number(customMinPrice)) return false;
          if (customMaxPrice !== '' && product.price > Number(customMaxPrice)) return false;
        }

        // 3. Material / Fabric filter from dedicated chip
        if (selectedMaterial !== 'all') {
          const fabricStr = `${product.fabric || ''} ${product.threadCount || ''}`.toLowerCase();
          if (selectedMaterial === 'percale' && !fabricStr.includes('percale')) return false;
          if (selectedMaterial === 'combed' && !fabricStr.includes('combed')) return false;
          if (selectedMaterial === 'glace' && !fabricStr.includes('glace')) return false;
          if (selectedMaterial === '350+tc') {
            const tcMatch = fabricStr.match(/(\d{3})\s*(?:thread|tc)/);
            const tc = tcMatch ? parseInt(tcMatch[1], 10) : 300;
            if (tc < 350) return false;
          }
        }

        // 4. Category match
        if (selectedFilter !== 'all') {
          if (selectedFilter === 'floral' && !(
            product.id === 'gulabi-bagh-rose' ||
            product.id === 'mint-meadow-sage' ||
            product.id === 'ivory-garland-wreath' ||
            product.collection.toLowerCase().includes('floral') ||
            product.pattern.toLowerCase().includes('floral')
          )) return false;

          if (selectedFilter === 'geometric' && !(
            product.id === 'petals-print-marigold' ||
            product.id === 'shivaura-trellis-slate' ||
            product.pattern.toLowerCase().includes('trellis') ||
            product.pattern.toLowerCase().includes('geometric')
          )) return false;

          if (selectedFilter === 'botanical' && !(
            product.id === 'milky-white-poppy' ||
            product.id === 'amber-orchid-medallion' ||
            product.pattern.toLowerCase().includes('poppy') ||
            product.pattern.toLowerCase().includes('botanical')
          )) return false;

          if (selectedFilter === 'heritage' && !(
            product.id === 'peacock-teal-paisley' ||
            product.id === 'blush-lotus-gold-trim' ||
            product.collection.toLowerCase().includes('heritage') ||
            product.pattern.toLowerCase().includes('paisley') ||
            product.pattern.toLowerCase().includes('lotus')
          )) return false;
        }

        // 5. Search Text matching (Name, Material / Fabric, Thread Count, Features, Motif, Description)
        if (text) {
          const nameMatch = product.name.toLowerCase().includes(text);
          const materialMatch =
            (product.fabric && product.fabric.toLowerCase().includes(text)) ||
            (product.threadCount && product.threadCount.toLowerCase().includes(text)) ||
            (product.features && product.features.some((f) => f.toLowerCase().includes(text)));
          const collectionMatch = product.collection.toLowerCase().includes(text);
          const patternMatch = product.pattern.toLowerCase().includes(text);
          const colorToneMatch = product.colorTone.toLowerCase().includes(text);
          const descMatch = product.description.toLowerCase().includes(text);

          if (!nameMatch && !materialMatch && !collectionMatch && !patternMatch && !colorToneMatch && !descMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        return 0; // featured maintains original order
      });
  }, [
    products,
    searchQuery,
    selectedFilter,
    selectedPriceRange,
    customMinPrice,
    customMaxPrice,
    selectedMaterial,
    sortBy,
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedFilter('all');
    setSelectedPriceRange('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setSelectedMaterial('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedFilter !== 'all' ||
    selectedPriceRange !== 'all' ||
    selectedMaterial !== 'all' ||
    customMinPrice !== '' ||
    customMaxPrice !== '';

  const parsedQuery = parseSearchQuery(searchQuery);

  return (
    <div
      className="py-8 sm:py-12 transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-3">
          
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border shadow-2xs"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-primary, #70252D) 10%, transparent)',
              color: 'var(--color-primary, #70252D)',
              borderColor: 'color-mix(in srgb, var(--color-primary, #70252D) 25%, transparent)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
            Official Product Catalogue
          </div>

          <h1
            className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-semibold text-balance"
            style={{ color: 'var(--color-text, #2C2420)' }}
          >
            The Signature {products.length > 0 ? products.length : 10} Collection
          </h1>

          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
          >
            Every bedsheet in this catalogue is generously cut in our signature{' '}
            <strong className="font-semibold" style={{ color: 'var(--color-text, #2C2420)' }}>
              108″ × 108″ King size
            </strong>{' '}
            from 100% pure combed cotton. Each set includes 2 coordinating pillow covers (45×70 cm).
          </p>

          {/* Quick Gurgaon Atelier reassurance & Photo Studio Button */}
          <div
            className="pt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"
            style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
          >
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
              Sector 46, Gurgaon
            </span>
            <span style={{ color: 'var(--color-border, #EAE2D5)' }}>·</span>
            <a
              href={COMPANY_DETAILS.whatsappUrl("Hello Cotton Nest! I would like assistance choosing a bedsheet from your catalogue.")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline font-semibold"
              style={{ color: 'var(--color-primary, #70252D)' }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Order Assistance: +91 7838625915
            </a>
            {isOwnerMode && (
              <>
                {onOpenPhotoManager && (
                  <>
                    <span style={{ color: 'var(--color-border, #EAE2D5)' }}>·</span>
                    <button
                      type="button"
                      onClick={onOpenPhotoManager}
                      className="inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border"
                      style={{
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-primary, #70252D)',
                        borderColor: 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      <span>📷 Upload / Change Photos</span>
                    </button>
                  </>
                )}
                {onOpenAdmin && (
                  <>
                    <span style={{ color: 'var(--color-border, #EAE2D5)' }}>·</span>
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border"
                      style={{
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #2C2420)',
                        borderColor: 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      <span>⚙️ Admin Panel</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Real-time Search and Filter Panel */}
        <div
          className="border rounded-2xl p-4 sm:p-6 mb-8 shadow-xs space-y-4 transition-colors"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #EAE2D5)',
          }}
        >
          {/* Main Search Bar & Sort Row */}
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
            {/* Real-Time Search Input with live search icon & clear button */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--color-accent, #C29E57)' }}
              />
              <input
                type="text"
                placeholder="Search by name (e.g. Rose), material (e.g. Percale), or price (e.g. under 2000)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl text-xs sm:text-sm focus:outline-none transition-all shadow-xs"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                  borderWidth: '1px',
                  color: 'var(--color-text, #2C2420)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors cursor-pointer opacity-70 hover:opacity-100"
                  style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort & Count */}
            <div className="flex items-center justify-between md:justify-end gap-3 text-xs shrink-0">
              <span
                className="tabular-nums font-semibold whitespace-nowrap px-3 py-2 rounded-xl border"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                  color: 'var(--color-text-secondary, #6B5D55)',
                }}
              >
                {filteredProducts.length} of {products.length} sheets
              </span>

              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #C29E57)' }} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="py-2 px-3 rounded-xl font-medium focus:outline-none cursor-pointer border"
                  style={{
                    backgroundColor: 'var(--color-background, #FAF7F2)',
                    borderColor: 'var(--color-border, #EAE2D5)',
                    color: 'var(--color-text, #2C2420)',
                  }}
                >
                  <option value="featured">Featured Order</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>

              {/* Toggle Filters Button for Mobile / Quick Access */}
              <button
                type="button"
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                className="md:hidden px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                style={{
                  backgroundColor: isFilterExpanded || hasActiveFilters ? 'var(--color-primary, #70252D)' : 'var(--color-background, #FAF7F2)',
                  color: isFilterExpanded || hasActiveFilters ? 'var(--color-primary-contrast, #FFFFFF)' : 'var(--color-text, #2C2420)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                }}
              >
                <Filter className="w-3 h-3" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Quick Search Tag Suggestions */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]"
            style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
          >
            <span className="font-semibold shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3" style={{ color: 'var(--color-accent, #C29E57)' }} />
              Quick:
            </span>
            {quickSearchTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => setSearchQuery(tag.query)}
                className="px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0 font-medium border hover:opacity-85"
                style={{
                  backgroundColor: 'var(--color-background, #FAF7F2)',
                  borderColor: 'var(--color-border, #EAE2D5)',
                  color: 'var(--color-text, #2C2420)',
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* Real-time Query Interpretation Badge (Shows parsed criteria if typed in search bar) */}
          {(parsedQuery.queryMinPrice !== null || parsedQuery.queryMaxPrice !== null || parsedQuery.exactOrApproxPrice !== null) && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 border rounded-xl text-xs animate-in fade-in"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary, #70252D) 8%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-primary, #70252D) 25%, transparent)',
                color: 'var(--color-primary, #70252D)',
              }}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>
                Real-time Price Filter detected:{' '}
                <strong>
                  {parsedQuery.queryMinPrice !== null && parsedQuery.queryMaxPrice !== null
                    ? `₹${parsedQuery.queryMinPrice.toLocaleString('en-IN')} – ₹${parsedQuery.queryMaxPrice.toLocaleString('en-IN')}`
                    : parsedQuery.queryMaxPrice !== null
                    ? `Up to ₹${parsedQuery.queryMaxPrice.toLocaleString('en-IN')}`
                    : parsedQuery.queryMinPrice !== null
                    ? `₹${parsedQuery.queryMinPrice.toLocaleString('en-IN')} & Above`
                    : `Around ₹${parsedQuery.exactOrApproxPrice?.toLocaleString('en-IN')}`}
                </strong>
                {parsedQuery.text && <span> · Matching "{parsedQuery.text}" in name or material</span>}
              </span>
            </div>
          )}

          {/* Dedicated Filter Rows (Category, Price Range, Material) */}
          <div
            className={`space-y-3 pt-3 border-t ${isFilterExpanded ? 'block' : 'hidden md:block'}`}
            style={{ borderColor: 'var(--color-border, #EAE2D5)' }}
          >
            {/* Row 1: Collections */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider w-24 shrink-0"
                style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
              >
                Collection:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-1">
                {filterOptions.map((filter) => {
                  const isActive = selectedFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSelectedFilter(filter.id)}
                      className="px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer border"
                      style={{
                        backgroundColor: isActive ? 'var(--color-primary, #70252D)' : 'var(--color-background, #FAF7F2)',
                        color: isActive ? 'var(--color-primary-contrast, #FFFFFF)' : 'var(--color-text-secondary, #6B5D55)',
                        borderColor: isActive ? 'var(--color-primary, #70252D)' : 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Price Range Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider w-24 shrink-0"
                style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
              >
                Price Range:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-1 flex-wrap">
                {priceRangeOptions.map((opt) => {
                  const isActive = selectedPriceRange === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedPriceRange(opt.id as any)}
                      className="px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer border"
                      style={{
                        backgroundColor: isActive ? 'var(--color-secondary, #8C3A44)' : 'var(--color-background, #FAF7F2)',
                        color: isActive ? 'var(--color-secondary-contrast, #FFFFFF)' : 'var(--color-text-secondary, #6B5D55)',
                        borderColor: isActive ? 'var(--color-secondary, #8C3A44)' : 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}

                {/* Custom Price Range Inputs */}
                {selectedPriceRange === 'custom' && (
                  <div
                    className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-lg border text-xs"
                    style={{
                      backgroundColor: 'var(--color-surface, #FFFFFF)',
                      borderColor: 'var(--color-accent, #C29E57)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-secondary, #6B5D55)' }}>₹</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={customMinPrice}
                      onChange={(e) => setCustomMinPrice(e.target.value)}
                      className="w-16 px-1.5 py-0.5 border rounded text-xs"
                      style={{
                        borderColor: 'var(--color-border, #EAE2D5)',
                        color: 'var(--color-text, #2C2420)',
                        backgroundColor: 'var(--color-background, #FAF7F2)',
                      }}
                    />
                    <span style={{ color: 'var(--color-text-secondary, #6B5D55)' }}>to ₹</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={customMaxPrice}
                      onChange={(e) => setCustomMaxPrice(e.target.value)}
                      className="w-16 px-1.5 py-0.5 border rounded text-xs"
                      style={{
                        borderColor: 'var(--color-border, #EAE2D5)',
                        color: 'var(--color-text, #2C2420)',
                        backgroundColor: 'var(--color-background, #FAF7F2)',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Material / Fabric Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider w-24 shrink-0"
                style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
              >
                Material:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-1">
                {materialOptions.map((mat) => {
                  const isActive = selectedMaterial === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setSelectedMaterial(mat.id)}
                      className="px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer border"
                      style={{
                        backgroundColor: isActive ? 'var(--color-accent, #C29E57)' : 'var(--color-background, #FAF7F2)',
                        color: isActive ? '#FFFFFF' : 'var(--color-text-secondary, #6B5D55)',
                        borderColor: isActive ? 'var(--color-accent, #C29E57)' : 'var(--color-border, #EAE2D5)',
                      }}
                    >
                      {mat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Filter Chips & Reset All Button */}
          {hasActiveFilters && (
            <div
              className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
              style={{ borderColor: 'var(--color-border, #EAE2D5)' }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span style={{ color: 'var(--color-text-secondary, #6B5D55)' }} className="text-[11px] font-medium">
                  Active Filters:
                </span>
                
                {searchQuery && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: 'var(--color-background, #FAF7F2)',
                      borderColor: 'var(--color-border, #EAE2D5)',
                      color: 'var(--color-text, #2C2420)',
                    }}
                  >
                    Search: "{searchQuery}"
                    <button type="button" onClick={() => setSearchQuery('')} className="hover:text-red-600">✕</button>
                  </span>
                )}

                {selectedFilter !== 'all' && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: 'var(--color-background, #FAF7F2)',
                      borderColor: 'var(--color-border, #EAE2D5)',
                      color: 'var(--color-text, #2C2420)',
                    }}
                  >
                    Collection: {filterOptions.find((f) => f.id === selectedFilter)?.label}
                    <button type="button" onClick={() => setSelectedFilter('all')} className="hover:text-red-600">✕</button>
                  </span>
                )}

                {selectedPriceRange !== 'all' && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: 'var(--color-background, #FAF7F2)',
                      borderColor: 'var(--color-border, #EAE2D5)',
                      color: 'var(--color-text, #2C2420)',
                    }}
                  >
                    Price: {priceRangeOptions.find((p) => p.id === selectedPriceRange)?.label}
                    <button type="button" onClick={() => setSelectedPriceRange('all')} className="hover:text-red-600">✕</button>
                  </span>
                )}

                {selectedMaterial !== 'all' && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: 'var(--color-background, #FAF7F2)',
                      borderColor: 'var(--color-border, #EAE2D5)',
                      color: 'var(--color-text, #2C2420)',
                    }}
                  >
                    Material: {materialOptions.find((m) => m.id === selectedMaterial)?.label}
                    <button type="button" onClick={() => setSelectedMaterial('all')} className="hover:text-red-600">✕</button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 hover:underline font-semibold text-xs cursor-pointer ml-auto"
                style={{ color: 'var(--color-primary, #70252D)' }}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            </div>
          )}

        </div>

        {/* Bedsheets Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={onQuickView}
                onAddToCart={onAddToCart}
                isAdded={addedProductIds.has(product.id)}
                customImage={customImages[product.id]}
                onUploadImage={onUploadImage}
                isOwnerMode={isOwnerMode}
                onOpenOwnerAuth={onOpenOwnerAuth}
                onToggleCompare={onToggleCompare}
                isCompared={comparedProductIds.includes(product.id)}
                onNotifyStock={onNotifyStock}
              />
            ))}
          </div>
        ) : (
          <div
            className="text-center py-16 rounded-2xl border p-8 max-w-lg mx-auto space-y-4"
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              borderColor: 'var(--color-border, #EAE2D5)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary, #70252D) 10%, transparent)',
                color: 'var(--color-primary, #70252D)',
              }}
            >
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text, #2C2420)' }}>
                No bedsheets match your current search
              </h3>
              <p
                className="text-xs mt-1.5 leading-relaxed"
                style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
              >
                {searchQuery
                  ? `No pure cotton sheets matched "${searchQuery}". Try searching for keywords like "rose", "percale", "350 TC", or "under 2000".`
                  : 'No bedsheets found with the selected material or price filter.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                style={{
                  backgroundColor: 'var(--color-primary, #70252D)',
                  color: 'var(--color-primary-contrast, #FFFFFF)',
                }}
              >
                Clear All Filters &amp; View All Bedsheets
              </button>
            </div>
          </div>
        )}

        {/* Catalog Assurance Footer Banner */}
        <div
          className="mt-12 border rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderColor: 'var(--color-border, #EAE2D5)',
          }}
        >
          <div className="max-w-2xl mx-auto space-y-2">
            <h3
              className="font-serif-luxury text-xl sm:text-2xl font-semibold"
              style={{ color: 'var(--color-text, #2C2420)' }}
            >
              All King Sets Include 2 Pillow Covers (45 × 70 cm)
            </h3>
            <p
              className="text-xs sm:text-sm max-w-xl mx-auto"
              style={{ color: 'var(--color-text-secondary, #6B5D55)' }}
            >
              Direct from the manufacturer in Gurugram. 100% pure combed long-staple cotton with breathable, color-fast guarantee.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
