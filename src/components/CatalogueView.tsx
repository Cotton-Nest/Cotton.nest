import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Filter,
  SlidersHorizontal,
  MessageCircle,
  X,
  Tag,
  RotateCcw,
  IndianRupee,
  ArrowUpDown,
  Check,
  ChevronDown,
  Star,
  TrendingUp,
  Zap,
  Globe,
  Layers,
  Box,
  Percent,
  Sliders,
  Square,
  Grid2X2,
  List,
  BedDouble,
  Snowflake,
  Feather,
  Flame,
  ShieldCheck,
  LayoutGrid
} from 'lucide-react';
import {
  BedsheetProduct,
  BedsheetVariant,
  BEDSHEETS_CATALOG,
  COMPANY_DETAILS,
  STANDARD_SIZES,
  STANDARD_PRODUCT_TYPES,
  POPULAR_BRANDS,
  normalizeProductCategory,
  doesProductMatchCategory,
} from '../data/products';
import { ProductCard, ProductCardViewMode } from './ProductCard';
import { ProductReview, getProductRatingSummary } from '../data/reviews';

export type CatalogueViewMode = ProductCardViewMode;

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
  isWishlisted?: (productId: string) => boolean;
  onToggleWishlist?: (product: BedsheetProduct, variant?: BedsheetVariant) => void;
  reviews?: ProductReview[];
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

type FilterCategoryTab = 'quick' | 'size' | 'productType' | 'brand' | 'price' | 'color' | 'pattern';

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
  isWishlisted,
  onToggleWishlist,
  reviews = [],
}) => {
  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating' | 'newest'>('featured');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // View mode state: 'single' (default: 1 bedsheet view at a time), 'tile', or 'list'
  const [viewMode, setViewMode] = useState<CatalogueViewMode>(() => {
    try {
      const saved = localStorage.getItem('cotton_nest_catalogue_view_mode');
      if (saved === 'single' || saved === 'tile' || saved === 'list') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'single'; // By default keep it one bedsheet view at a time instead of 2 bedsheets
  });

  const handleViewModeChange = (mode: CatalogueViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cotton_nest_catalogue_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Multi-select Filters State
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPricePreset, setSelectedPricePreset] = useState<'all' | 'under-1200' | '1200-1500' | 'above-1500' | 'custom'>('all');
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);

  // Myntra-style 2-column Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterCategoryTab>('quick');
  const [categorySearch, setCategorySearch] = useState('');

  // Extract distinct dynamic filter choices and counts from actual products data
  const availableFilterData = useMemo(() => {
    const sizesSet = new Set<string>();
    const typesSet = new Set<string>();
    const brandsSet = new Set<string>();
    const colorsSet = new Set<string>();
    const patternsSet = new Set<string>();

    // Seed with standard presets so catalog filters are rich and predictable
    STANDARD_SIZES.filter((s) => s !== 'Other').forEach((s) => sizesSet.add(s));
    STANDARD_PRODUCT_TYPES.filter((t) => t !== 'Other').forEach((t) => typesSet.add(t));
    POPULAR_BRANDS.forEach((b) => brandsSet.add(b));

    (products || []).forEach((p) => {
      if (!p) return;
      if (p.size && typeof p.size === 'string' && p.size.trim()) sizesSet.add(p.size.trim());
      if (p.productType && typeof p.productType === 'string' && p.productType.trim()) {
        typesSet.add(normalizeProductCategory(p.productType));
      }
      if (p.brand && typeof p.brand === 'string' && p.brand.trim()) brandsSet.add(p.brand.trim());

      // Extract colors
      if (p.colorTone && typeof p.colorTone === 'string') {
        p.colorTone.split(/[,&/]/).forEach((part) => {
          const clean = part.trim();
          if (clean && clean.length > 2) colorsSet.add(clean);
        });
      }
      p.variants?.forEach((v) => {
        if (v && v.name && typeof v.name === 'string') colorsSet.add(v.name.trim());
      });

      // Extract pattern / collections
      if (p.pattern && typeof p.pattern === 'string') patternsSet.add(p.pattern.trim());
      if (p.collection && typeof p.collection === 'string') patternsSet.add(p.collection.trim());
    });

    return {
      sizes: Array.from(sizesSet),
      types: Array.from(typesSet),
      brands: Array.from(brandsSet),
      colors: Array.from(colorsSet).slice(0, 14),
      patterns: Array.from(patternsSet).slice(0, 12),
    };
  }, [products]);

  // Quick Filter Options (matching Screenshot 2 top pills)
  const quickFilterDefs = [
    { id: 'diwali-price-drop', label: 'Diwali Price Drop', icon: TrendingUp },
    { id: 'crazy-deal', label: 'Crazy Deal', icon: Percent },
    { id: 'top-brands', label: 'Top Brands', icon: Zap },
    { id: 'top-rated', label: 'Top Rated', icon: Star },
    { id: 'global-finds', label: 'Global Finds', icon: Globe },
    { id: 'pure-cotton', label: '100% Cotton', icon: Sparkles },
    { id: 'king-size', label: 'King Size', icon: Box },
  ];

  // Helper toggle functions for multi-select
  const toggleArrayFilter = (current: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const toggleSize = (size: string) => toggleArrayFilter(selectedSizes, size, setSelectedSizes);
  const toggleProductType = (type: string) => toggleArrayFilter(selectedProductTypes, type, setSelectedProductTypes);
  const toggleBrand = (brand: string) => toggleArrayFilter(selectedBrands, brand, setSelectedBrands);
  const toggleColor = (color: string) => toggleArrayFilter(selectedColors, color, setSelectedColors);
  const togglePattern = (pattern: string) => toggleArrayFilter(selectedPatterns, pattern, setSelectedPatterns);
  const toggleQuickFilter = (qId: string) => toggleArrayFilter(selectedQuickFilters, qId, setSelectedQuickFilters);

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedSizes([]);
    setSelectedProductTypes([]);
    setSelectedBrands([]);
    setSelectedPricePreset('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setSelectedColors([]);
    setSelectedPatterns([]);
    setSelectedQuickFilters([]);
    setSearchQuery('');
  };

  // Count active filter conditions
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += selectedSizes.length;
    count += selectedProductTypes.length;
    count += selectedBrands.length;
    if (selectedPricePreset !== 'all' || customMinPrice !== '' || customMaxPrice !== '') count += 1;
    count += selectedColors.length;
    count += selectedPatterns.length;
    count += selectedQuickFilters.length;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [
    selectedSizes,
    selectedProductTypes,
    selectedBrands,
    selectedPricePreset,
    customMinPrice,
    customMaxPrice,
    selectedColors,
    selectedPatterns,
    selectedQuickFilters,
    searchQuery
  ]);

  // Real-time authoritative filtering & sorting
  const filteredProducts = useMemo(() => {
    const { text, queryMinPrice, queryMaxPrice, exactOrApproxPrice } = parseSearchQuery(searchQuery);

    return products
      .filter((product) => {
        if (!product) return false;
        const itemSize = String(product.size || 'King').trim();
        const itemType = String(product.productType || 'Bedsheet').trim();
        const itemBrand = String(product.brand || 'Cotton Nest').trim();
        const dims = String(product.dimensions || '');
        const prodName = String(product.name || '');
        const prodColl = String(product.collection || '');
        const prodPatt = String(product.pattern || '');
        const prodColor = String(product.colorTone || '');
        const prodFabric = String(product.fabric || '');
        const prodTC = String(product.threadCount || '');
        const prodDesc = String(product.description || '');

        // 1. Size constraint (Multi-select: Match any selected size)
        if (selectedSizes.length > 0) {
          const matchesSize = selectedSizes.some((s) => {
            const cleanS = String(s || '').toLowerCase();
            const d = dims.toLowerCase();
            const sz = itemSize.toLowerCase();
            if (cleanS.includes('xl') || cleanS.includes('120')) return d.includes('120') || sz.includes('xl');
            if (cleanS.includes('108')) return d.includes('108') && !d.includes('110');
            if (cleanS.includes('90') && cleanS.includes('108')) return d.includes('90') && d.includes('108');
            if (cleanS.includes('90') && cleanS.includes('100')) return d.includes('90') && d.includes('100');
            if (cleanS.includes('60') && cleanS.includes('100')) return d.includes('60') && d.includes('100');
            if (cleanS.includes('60') && cleanS.includes('90')) return d.includes('60') && d.includes('90');
            if (cleanS.includes('40')) return d.includes('40') && d.includes('60');
            if (cleanS.includes('king')) return sz.includes('king') || d.includes('108');
            if (cleanS.includes('queen')) return sz.includes('queen') || d.includes('90');
            if (cleanS.includes('double')) return sz.includes('double') || d.includes('90');
            if (cleanS.includes('single')) return sz.includes('single') || d.includes('60');
            if (cleanS.includes('diwan')) return sz.includes('diwan') || d.includes('60');
            if (cleanS.includes('baby')) return sz.includes('baby') || d.includes('40');
            return sz.includes(cleanS) || d.includes(cleanS);
          });
          if (!matchesSize) return false;
        }

        // 2. Product Type / Category constraint (Multi-select: Match any selected category)
        if (selectedProductTypes.length > 0) {
          const matchesType = selectedProductTypes.some((t) => doesProductMatchCategory(product, t));
          if (!matchesType) return false;
        }

        // 3. Brand constraint (Multi-select: Match any selected brand)
        if (selectedBrands.length > 0) {
          const matchesBrand = selectedBrands.some((b) => {
            const cleanB = String(b || '').toLowerCase();
            return (
              itemBrand.toLowerCase() === cleanB ||
              (cleanB === 'cotton nest' && !product.brand)
            );
          });
          if (!matchesBrand) return false;
        }

        // 4. Price presets & Custom inputs
        const priceNum = Number(product.price) || 0;
        if (selectedPricePreset === 'under-1200' && priceNum >= 1200) return false;
        if (selectedPricePreset === '1200-1500' && (priceNum < 1200 || priceNum > 1500)) return false;
        if (selectedPricePreset === 'above-1500' && priceNum <= 1500) return false;
        if (selectedPricePreset === 'custom') {
          if (customMinPrice && priceNum < Number(customMinPrice)) return false;
          if (customMaxPrice && priceNum > Number(customMaxPrice)) return false;
        }

        // 5. Natural Language Price constraint from Search Bar
        if (queryMinPrice !== null && priceNum < queryMinPrice) return false;
        if (queryMaxPrice !== null && priceNum > queryMaxPrice) return false;
        if (exactOrApproxPrice !== null) {
          const matchesNum =
            priceNum === exactOrApproxPrice ||
            Math.abs(priceNum - exactOrApproxPrice) <= 100 ||
            priceNum.toString().includes(exactOrApproxPrice.toString());
          if (!matchesNum) return false;
        }

        // 6. Color filter (Multi-select)
        if (selectedColors.length > 0) {
          const colorString = `${prodColor} ${product.variants?.map((v) => v?.name || '').join(' ') || ''}`.toLowerCase();
          const matchesColor = selectedColors.some((c) => colorString.includes(String(c || '').toLowerCase()));
          if (!matchesColor) return false;
        }

        // 7. Pattern / Collection filter (Multi-select)
        if (selectedPatterns.length > 0) {
          const patternString = `${prodPatt} ${prodColl}`.toLowerCase();
          const matchesPattern = selectedPatterns.some((p) => patternString.includes(String(p || '').toLowerCase()));
          if (!matchesPattern) return false;
        }

        // 8. Quick Filter chips logic
        const origPriceNum = Number(product.originalPrice) || priceNum;
        if (selectedQuickFilters.includes('diwali-price-drop') || selectedQuickFilters.includes('crazy-deal')) {
          if (origPriceNum <= priceNum) return false;
        }
        if (selectedQuickFilters.includes('top-brands')) {
          const isTopBrand = ['Cotton Nest', 'Swayam', 'Spaces', 'Bombay Dyeing', 'Portico New York'].includes(itemBrand);
          if (!isTopBrand) return false;
        }
        if (selectedQuickFilters.includes('top-rated')) {
          const r = getProductRatingSummary(product.id, reviews);
          if (r.average < 4.5 && r.count > 0) return false;
        }
        if (selectedQuickFilters.includes('global-finds')) {
          if (!product.badge && !prodColl.toLowerCase().includes('heritage')) return false;
        }
        if (selectedQuickFilters.includes('pure-cotton')) {
          const isCotton = prodFabric.toLowerCase().includes('cotton') || prodFabric.toLowerCase().includes('percale');
          if (!isCotton) return false;
        }
        if (selectedQuickFilters.includes('king-size')) {
          if (itemSize !== 'King' && !dims.includes('108')) return false;
        }

        // 9. Free-text Search
        if (text) {
          const nameMatch = prodName.toLowerCase().includes(text);
          const materialMatch =
            prodFabric.toLowerCase().includes(text) ||
            prodTC.toLowerCase().includes(text) ||
            Boolean(product.features && product.features.some((f) => String(f || '').toLowerCase().includes(text)));
          const collectionMatch = prodColl.toLowerCase().includes(text);
          const patternMatch = prodPatt.toLowerCase().includes(text);
          const colorToneMatch = prodColor.toLowerCase().includes(text);
          const descMatch = prodDesc.toLowerCase().includes(text);
          const sizeMatch = itemSize.toLowerCase().includes(text);
          const typeMatch = itemType.toLowerCase().includes(text);

          if (!nameMatch && !materialMatch && !collectionMatch && !patternMatch && !colorToneMatch && !descMatch && !sizeMatch && !typeMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'rating') {
          const ratingA = getProductRatingSummary(a.id, reviews).average;
          const ratingB = getProductRatingSummary(b.id, reviews).average;
          return ratingB - ratingA;
        }
        if (sortBy === 'newest') {
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
        return 0; // featured maintains authoritative ordering
      });
  }, [
    products,
    searchQuery,
    selectedSizes,
    selectedProductTypes,
    selectedBrands,
    selectedPricePreset,
    customMinPrice,
    customMaxPrice,
    selectedColors,
    selectedPatterns,
    selectedQuickFilters,
    sortBy,
    reviews
  ]);

  // Compute option product counts with 100% safe null-guards
  const getCountForFilter = (type: 'size' | 'productType' | 'brand' | 'color' | 'pattern', value?: string) => {
    if (!value) return 0;
    const cleanVal = String(value).toLowerCase().trim();
    return (products || []).filter((p) => {
      if (!p) return false;
      if (type === 'size') {
        const s = String(p.size || '').toLowerCase();
        const dims = String(p.dimensions || '').toLowerCase();
        if (cleanVal.includes('xl') || cleanVal.includes('120')) return dims.includes('120') || s.includes('xl');
        if (cleanVal.includes('108')) return dims.includes('108') && !dims.includes('110');
        if (cleanVal.includes('90') && cleanVal.includes('108')) return dims.includes('90') && dims.includes('108');
        if (cleanVal.includes('90') && cleanVal.includes('100')) return dims.includes('90') && dims.includes('100');
        if (cleanVal.includes('60') && cleanVal.includes('100')) return dims.includes('60') && dims.includes('100');
        if (cleanVal.includes('60') && cleanVal.includes('90')) return dims.includes('60') && dims.includes('90');
        if (cleanVal.includes('40')) return dims.includes('40') && dims.includes('60');
        if (cleanVal.includes('king')) return s.includes('king') || dims.includes('108');
        if (cleanVal.includes('queen')) return s.includes('queen') || dims.includes('90');
        if (cleanVal.includes('double')) return s.includes('double') || dims.includes('90');
        if (cleanVal.includes('single')) return s.includes('single') || dims.includes('60');
        if (cleanVal.includes('diwan')) return s.includes('diwan') || dims.includes('60');
        if (cleanVal.includes('baby')) return s.includes('baby') || dims.includes('40');
        return s.includes(cleanVal) || dims.includes(cleanVal);
      }
      if (type === 'productType') {
        return doesProductMatchCategory(p, value);
      }
      if (type === 'brand') {
        const b = String(p.brand || 'Cotton Nest').toLowerCase();
        return b === cleanVal;
      }
      if (type === 'color') {
        return String(p.colorTone || '').toLowerCase().includes(cleanVal);
      }
      if (type === 'pattern') {
        return (
          String(p.pattern || '').toLowerCase().includes(cleanVal) ||
          String(p.collection || '').toLowerCase().includes(cleanVal)
        );
      }
      return false;
    }).length;
  };

  const getCategoryIcon = (catType: string) => {
    const norm = normalizeProductCategory(catType).toLowerCase();
    if (norm.includes('winter') || norm.includes('flannel') || norm.includes('warm') || norm.includes('fleece')) {
      return Snowflake;
    }
    if (norm.includes('dohar') || norm.includes('ac')) {
      return Feather;
    }
    if (norm.includes('quilt') || norm.includes('razai') || norm.includes('jaipuri')) {
      return Flame;
    }
    if (norm.includes('cover') || norm.includes('protector')) {
      return ShieldCheck;
    }
    if (norm.includes('blanket') || norm.includes('throw')) {
      return Layers;
    }
    if (norm.includes('comforter') || norm.includes('duvet')) {
      return Sparkles;
    }
    if (norm.includes('bedsheet') || norm.includes('sheet') || norm.includes('linen')) {
      return BedDouble;
    }
    return Tag;
  };

  const getCategoryDisplayLabel = (catType: string) => {
    if (catType === 'Winter Bedsheet') return 'Winter Bedsheets';
    if (catType === 'Bedsheet') return 'Bedsheets';
    if (catType === 'Bed Cover') return 'Bed Covers';
    if (catType === 'Quilt') return 'Quilts';
    if (catType === 'Dohar') return 'Dohars';
    if (catType === 'Blanket') return 'Blankets';
    if (catType === 'Comforter') return 'Comforters';
    return catType;
  };

  const parsedQuery = parseSearchQuery(searchQuery);

  return (
    <div
      className="pb-24 pt-3 sm:pt-6 transition-colors duration-300 min-h-screen"
      style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

        {/* Top Header Title & Search Row */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-2xs mb-1"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-primary, #70252D) 10%, transparent)',
                  color: 'var(--color-primary, #70252D)',
                  borderColor: 'color-mix(in srgb, var(--color-primary, #70252D) 25%, transparent)',
                }}
              >
                <Sparkles className="w-3 h-3 text-[#C29E57]" />
                Pure Cotton Atelier Catalogue
              </div>
              <h1 className="font-serif-luxury text-2xl sm:text-3xl font-semibold text-[#2C2420]">
                All Products ({filteredProducts.length})
              </h1>
            </div>

            {/* Desktop Filter Button (Opens the Myntra 2-column modal) */}
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="px-4 py-2 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-[#8C2E46]" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 bg-[#8C2E46] text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="py-2 px-3 bg-white border border-[#EAE2D5] rounded-xl text-xs font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="featured">Featured Order</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C29E57]" />
            <input
              type="text"
              placeholder="Search by size (King, Queen), fabric, style, or price (e.g. under 1500)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs sm:text-sm text-[#2C2420] focus:outline-hidden focus:border-[#C29E57] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 1. Category Navigation with Distinct Icons */}
        <div className="mb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar text-xs">
            {/* All Categories Option */}
            <button
              type="button"
              onClick={() => setSelectedProductTypes([])}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap font-semibold flex items-center gap-2 transition-all cursor-pointer border shrink-0 shadow-2xs ${
                selectedProductTypes.length === 0
                  ? 'bg-[#8C2E46] text-white border-[#8C2E46] shadow-xs'
                  : 'bg-white hover:bg-[#FAF7F2] text-[#2C2420] border-[#DEC89B] hover:border-[#8C2E46]'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${selectedProductTypes.length === 0 ? 'text-white' : 'text-[#8C2E46]'}`} />
              <span>All Categories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedProductTypes.length === 0 ? 'bg-white/20 text-white' : 'bg-[#F4EFE6] text-[#7A6458]'
                }`}
              >
                {products.length}
              </span>
            </button>

            {/* Individual Category Pills with Icons & Counts */}
            {availableFilterData.types.map((catType) => {
              const isSelected = selectedProductTypes.some(
                (s) => normalizeProductCategory(s).toLowerCase() === normalizeProductCategory(catType).toLowerCase()
              );
              const count = getCountForFilter('productType', catType);
              const CategoryIcon = getCategoryIcon(catType);
              const displayLabel = getCategoryDisplayLabel(catType);

              return (
                <button
                  key={catType}
                  type="button"
                  onClick={() => {
                    if (isSelected && selectedProductTypes.length === 1) {
                      setSelectedProductTypes([]);
                    } else {
                      setSelectedProductTypes([catType]);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl whitespace-nowrap font-semibold flex items-center gap-2 transition-all cursor-pointer border shrink-0 shadow-2xs ${
                    isSelected
                      ? 'bg-[#8C2E46] text-white border-[#8C2E46] shadow-xs'
                      : 'bg-white hover:bg-[#FAF7F2] text-[#2C2420] border-[#DEC89B] hover:border-[#8C2E46]'
                  }`}
                >
                  <CategoryIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#8C2E46]'}`} />
                  <span>{displayLabel}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#F4EFE6] text-[#7A6458]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>



        {/* 2. Secondary Refine & Quick Filters Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar mb-3 text-xs">
          {/* Main All Filters Trigger */}
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('quick');
              setIsFilterModalOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeFiltersCount > 0
                ? 'bg-[#8C2E46] text-white border-[#8C2E46]'
                : 'bg-white hover:bg-[#FAF7F2] text-[#2C2420] border-[#DEC89B]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>All Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-white text-[#8C2E46] text-[10px] font-bold rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Quick Attribute Filter Triggers (Size, Price, Color, Brand) */}
          {[
            { id: 'size' as FilterCategoryTab, label: 'Size', count: selectedSizes.length },
            { id: 'price' as FilterCategoryTab, label: 'Price', count: (selectedPricePreset !== 'all' || customMinPrice || customMaxPrice) ? 1 : 0 },
            { id: 'color' as FilterCategoryTab, label: 'Color', count: selectedColors.length },
            { id: 'brand' as FilterCategoryTab, label: 'Brand', count: selectedBrands.length },
          ].map((tab) => {
            const hasSelection = tab.count > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveFilterTab(tab.id);
                  setIsFilterModalOpen(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-2xs ${
                  hasSelection
                    ? 'bg-[#FDEAF0] text-[#8C2E46] border-[#8C2E46] font-bold'
                    : 'bg-white text-[#4A3B32] border-[#EAE2D5] hover:border-[#DEC89B] hover:bg-[#FAF7F2] font-medium'
                }`}
              >
                <span>{tab.label}</span>
                {hasSelection ? (
                  <span className="w-4 h-4 rounded-full bg-[#8C2E46] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.count}
                  </span>
                ) : (
                  <ChevronDown className="w-3 h-3 text-[#8C7A70]" />
                )}
              </button>
            );
          })}

          <div className="h-4 w-px bg-[#DEC89B]/50 shrink-0 mx-0.5" />

          {/* Quick Refinement Chips */}
          {quickFilterDefs.map((chip) => {
            const isSelected = selectedQuickFilters.includes(chip.id);
            const IconComponent = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleQuickFilter(chip.id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs shrink-0 ${
                  isSelected
                    ? 'bg-[#8C2E46] text-white border-[#8C2E46] shadow-sm font-semibold'
                    : 'bg-white hover:bg-[#F4EFE6] text-[#2C2420] border-[#EAE2D5]'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#8C7A70]'}`} />
                <span>{chip.label}</span>
                {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* 4. Active Filters Tag Ribbon & Clear All */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2 py-2 px-3 mb-4 bg-white rounded-xl border border-[#EAE2D5] text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-[#8C7A70] uppercase">Active:</span>

              {selectedSizes.map((s) => (
                <span
                  key={`size-${s}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]"
                >
                  Size: {s}
                  <button type="button" onClick={() => toggleSize(s)} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              ))}

              {selectedProductTypes.map((t) => (
                <span
                  key={`type-${t}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]"
                >
                  Type: {t}
                  <button type="button" onClick={() => toggleProductType(t)} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              ))}

              {selectedBrands.map((b) => (
                <span
                  key={`brand-${b}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]"
                >
                  Brand: {b}
                  <button type="button" onClick={() => toggleBrand(b)} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              ))}

              {selectedPricePreset !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4EFE6] text-[#2C2420] border border-[#EAE2D5]">
                  Price: {selectedPricePreset === 'under-1200' ? 'Under ₹1,200' : selectedPricePreset === '1200-1500' ? '₹1,200 – ₹1,500' : selectedPricePreset === 'above-1500' ? 'Above ₹1,500' : `₹${customMinPrice || 0} - ₹${customMaxPrice || 'Max'}`}
                  <button type="button" onClick={() => { setSelectedPricePreset('all'); setCustomMinPrice(''); setCustomMaxPrice(''); }} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              )}

              {selectedColors.map((c) => (
                <span
                  key={`col-${c}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF7F2] text-[#2C2420] border border-[#EAE2D5]"
                >
                  Color: {c}
                  <button type="button" onClick={() => toggleColor(c)} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs font-bold text-[#B83F60] hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>CLEAR ALL</span>
            </button>
          </div>
        )}

        {/* 5. View Mode Switcher & Count Header */}
        <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[#DEC89B]/50 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm sm:text-base text-[#2C2420]">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[11px] text-[#8C7A70] bg-[#FAF7F2] px-2 py-0.5 rounded-md border border-[#EAE2D5]">
                {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* View mode toggle buttons: 1 View (Single bedsheet at a time), Tile (Grid), List (Row) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DEC89B] shadow-2xs">
            <button
              type="button"
              onClick={() => handleViewModeChange('single')}
              title="1 View (One bedsheet at a time)"
              aria-label="1 View"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-[#FAF7F2]'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span className="text-[11px]">1 View</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('tile')}
              title="Tile View (Grid view)"
              aria-label="Tile View"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'tile'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-[#FAF7F2]'
              }`}
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Tile</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('list')}
              title="List View (Horizontal cards)"
              aria-label="List View"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-[#FAF7F2]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[11px]">List</span>
            </button>
          </div>
        </div>

        {/* 6. Products Container (Single: 1 bedsheet view at a time / Tile: 2 on mobile, 3-4 on desktop / List: row cards) */}
        {filteredProducts.length > 0 ? (
          <div
            className={
              viewMode === 'single'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto'
                : viewMode === 'list'
                ? 'flex flex-col space-y-4 max-w-4xl mx-auto'
                : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6'
            }
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                viewMode={viewMode}
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
                isWishlisted={isWishlisted ? isWishlisted(product.id) : false}
                onToggleWishlist={onToggleWishlist}
                reviews={reviews}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-[#EAE2D5] p-8 max-w-md mx-auto space-y-4 my-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#FDEAF0] text-[#8C2E46] flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base text-[#2C2420]">
                No items match your selected filters
              </h3>
              <p className="text-xs text-[#8C7A70] leading-relaxed">
                We couldn't find any products matching all your active filter conditions. Try clearing some filters or searching for different keywords.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-5 py-2.5 bg-[#8C2E46] hover:bg-[#742438] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* 6. MOBILE STICKY BOTTOM BAR (SORT & FILTER)              */}
      {/* (Matching Screenshot 2 bottom bar: No Gender, pure SORT/FILTER) */}
      {/* ======================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#EAE2D5] shadow-lg md:hidden">
        <div className="grid grid-cols-2 divide-x divide-[#EAE2D5] h-13">
          {/* SORT Button */}
          <button
            type="button"
            onClick={() => setIsSortModalOpen(true)}
            className="flex items-center justify-center gap-2 text-xs font-bold text-[#2C2420] hover:bg-[#FAF7F2] transition-colors cursor-pointer uppercase tracking-wider"
          >
            <ArrowUpDown className="w-4 h-4 text-[#8C2E46]" />
            <span>SORT</span>
          </button>

          {/* FILTER Button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center justify-center gap-2 text-xs font-bold text-[#2C2420] hover:bg-[#FAF7F2] transition-colors cursor-pointer uppercase tracking-wider relative"
          >
            <Filter className="w-4 h-4 text-[#8C2E46]" />
            <span>FILTER</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 bg-[#8C2E46] text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. SORT BOTTOM SHEET MODAL (MOBILE)                      */}
      {/* ======================================================== */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsSortModalOpen(false)} />
          <div className="relative bg-white w-full rounded-t-3xl border-t border-[#EAE2D5] p-5 shadow-2xl z-10 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE2D5]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8C7A70]">Sort By</span>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="p-1 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-[#F4EFE6] pt-1">
              {[
                { id: 'featured', label: 'Featured Order' },
                { id: 'price-low', label: 'Price: Low to High' },
                { id: 'price-high', label: 'Price: High to Low' },
                { id: 'rating', label: 'Customer Rating' },
                { id: 'newest', label: 'Newest Arrivals' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.id as any);
                    setIsSortModalOpen(false);
                  }}
                  className="w-full py-3.5 px-2 flex items-center justify-between text-xs font-medium text-[#2C2420] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  <span className={sortBy === opt.id ? 'font-bold text-[#8C2E46]' : ''}>{opt.label}</span>
                  {sortBy === opt.id && <Check className="w-4 h-4 text-[#8C2E46]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MYNTRA-STYLE 2-COLUMN FILTER MODAL                    */}
      {/* (Exactly matching Screenshot 1: Left Categories, Right Options, */}
      {/* Top CLEAR ALL, Bottom CLOSE & APPLY)                     */}
      {/* ======================================================== */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsFilterModalOpen(false)} />

          <div className="relative bg-white w-full max-w-xl sm:max-w-2xl h-[90vh] max-h-[720px] rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden border border-[#EAE2D5]">
            
            {/* Modal Top Header (Matching Screenshot 1: "Filters" left, "CLEAR ALL" right) */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE2D5] bg-white shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="md:hidden p-1 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-sans font-bold text-base text-[#2C2420]">
                  Filters
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-bold text-[#B83F60] hover:underline cursor-pointer uppercase tracking-wider"
              >
                CLEAR ALL
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              
              {/* Left Column: Categories List (~35% width, light gray background) */}
              <div className="w-[36%] sm:w-[32%] bg-[#F7F4EF] border-r border-[#EAE2D5] overflow-y-auto no-scrollbar">
                {[
                  { id: 'quick', label: 'Quick Filters', count: selectedQuickFilters.length },
                  { id: 'size', label: 'Size', count: selectedSizes.length },
                  { id: 'productType', label: 'Categories', count: selectedProductTypes.length },
                  { id: 'brand', label: 'Brand', count: selectedBrands.length },
                  { id: 'price', label: 'Price', count: (selectedPricePreset !== 'all' || customMinPrice || customMaxPrice) ? 1 : 0 },
                  { id: 'color', label: 'Color', count: selectedColors.length },
                  { id: 'pattern', label: 'Pattern & Material', count: selectedPatterns.length },
                ].map((cat) => {
                  const isActive = activeFilterTab === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveFilterTab(cat.id as FilterCategoryTab);
                        setCategorySearch('');
                      }}
                      className={`w-full py-4 px-3 sm:px-4 text-left text-xs font-medium transition-colors cursor-pointer flex items-center justify-between border-b border-[#EAE2D5]/60 ${
                        isActive
                          ? 'bg-white font-bold text-[#2C2420] border-l-4 border-l-[#8C2E46]'
                          : 'text-[#6B5D55] hover:bg-[#EFE9DF]'
                      }`}
                    >
                      <span className="truncate">{cat.label}</span>
                      {cat.count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#8C2E46] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {cat.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Options List (~65% width, white background) */}
              <div className="flex-1 bg-white overflow-y-auto p-4 sm:p-5 flex flex-col">
                
                {/* 1. Quick Filters Tab */}
                {activeFilterTab === 'quick' && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Popular Collections &amp; Deals
                    </p>
                    {quickFilterDefs.map((q) => {
                      const isChecked = selectedQuickFilters.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => toggleQuickFilter(q.id)}
                          className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                              {q.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. Size Tab */}
                {activeFilterTab === 'size' && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Select Bedsheet Size &amp; Mattress
                    </p>
                    {[
                      { label: 'King Size (108 × 108)', spec: 'Mattress: 72 × 78' },
                      { label: 'King Size XL (120 × 120)', spec: 'Mattress: 72 × 78' },
                      { label: 'Queen Size (90 × 100)', spec: 'Mattress: 60 × 78' },
                      { label: 'Queen Size XL (90 × 108)', spec: 'Mattress: 60 × 78' },
                      { label: 'Double Size (90 × 100)', spec: 'Mattress: 54 × 75' },
                      { label: 'Single Size (60 × 90)', spec: 'Mattress: 36 × 75' },
                      { label: 'Single XL (60 × 100)', spec: 'Mattress: 36 × 78' },
                      { label: 'Diwan Size (60 × 90)', spec: 'Mattress: Diwan' },
                      { label: 'Diwan XL (60 × 100)', spec: 'Mattress: Large Diwan' },
                      { label: 'Baby Cot (40 × 60)', spec: 'Mattress: Baby cot' },
                    ].map((item) => {
                      const isChecked = selectedSizes.includes(item.label);
                      const count = getCountForFilter('size', item.label);
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => toggleSize(item.label)}
                          className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <span className={`text-xs block ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                                {item.label}
                              </span>
                              <span className="text-[10px] text-[#8C7A70] block">
                                {item.spec}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#8C7A70] tabular-nums font-medium">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Product Type / Categories Tab */}
                {activeFilterTab === 'productType' && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Product Type
                    </p>
                    {availableFilterData.types.map((t) => {
                      const isChecked = selectedProductTypes.includes(t);
                      const count = getCountForFilter('productType', t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleProductType(t)}
                          className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                              {t}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#8C7A70] tabular-nums font-medium">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. Brand Tab (Backend Only - Filter option only, never on product card) */}
                {activeFilterTab === 'brand' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider">
                        Filter by Brand
                      </p>
                      <span className="text-[10px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Catalogue Filter
                      </span>
                    </div>

                    {/* Search inside Brands */}
                    {availableFilterData.brands.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7A70]" />
                        <input
                          type="text"
                          placeholder="Search brand..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-lg text-xs focus:outline-hidden"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      {availableFilterData.brands
                        .filter((b) => String(b || '').toLowerCase().includes(String(categorySearch || '').toLowerCase()))
                        .map((b) => {
                          const isChecked = selectedBrands.includes(b);
                          const count = getCountForFilter('brand', b);
                          return (
                            <button
                              key={b}
                              type="button"
                              onClick={() => toggleBrand(b)}
                              className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                  isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                                  {b}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#8C7A70] tabular-nums font-medium">
                                ({count})
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 5. Price Tab */}
                {activeFilterTab === 'price' && (
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider">
                      Price Ranges
                    </p>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'All Prices' },
                        { id: 'under-1200', label: 'Under ₹1,200' },
                        { id: '1200-1500', label: '₹1,200 – ₹1,500' },
                        { id: 'above-1500', label: 'Above ₹1,500' },
                        { id: 'custom', label: 'Custom Price Range' },
                      ].map((pr) => (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => setSelectedPricePreset(pr.id as any)}
                          className="w-full py-2.5 px-3 rounded-xl border flex items-center justify-between text-xs font-medium cursor-pointer transition-colors"
                          style={{
                            backgroundColor: selectedPricePreset === pr.id ? '#FDEAF0' : '#FFFFFF',
                            borderColor: selectedPricePreset === pr.id ? '#8C2E46' : '#EAE2D5',
                            color: selectedPricePreset === pr.id ? '#8C2E46' : '#2C2420',
                          }}
                        >
                          <span className={selectedPricePreset === pr.id ? 'font-bold' : ''}>{pr.label}</span>
                          {selectedPricePreset === pr.id && <Check className="w-4 h-4 text-[#8C2E46]" />}
                        </button>
                      ))}
                    </div>

                    {/* Custom Price Range Inputs */}
                    {selectedPricePreset === 'custom' && (
                      <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] space-y-2 animate-in fade-in">
                        <label className="text-[11px] font-semibold text-[#2C2420] block">
                          Enter Price Range (₹)
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C7A70]">₹</span>
                            <input
                              type="number"
                              placeholder="Min"
                              value={customMinPrice}
                              onChange={(e) => setCustomMinPrice(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                            />
                          </div>
                          <span className="text-xs text-[#8C7A70]">to</span>
                          <div className="flex-1 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C7A70]">₹</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={customMaxPrice}
                              onChange={(e) => setCustomMaxPrice(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Color Tab */}
                {activeFilterTab === 'color' && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Color Tone
                    </p>
                    <div className="space-y-1">
                      {availableFilterData.colors.map((c) => {
                        const isChecked = selectedColors.includes(c);
                        const count = getCountForFilter('color', c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleColor(c)}
                            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                              }`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                                {c}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#8C7A70] tabular-nums font-medium">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7. Pattern & Material Tab */}
                {activeFilterTab === 'pattern' && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Pattern &amp; Collections
                    </p>
                    <div className="space-y-1">
                      {availableFilterData.patterns.map((p) => {
                        const isChecked = selectedPatterns.includes(p);
                        const count = getCountForFilter('pattern', p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePattern(p)}
                            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                              }`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                                {p}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#8C7A70] tabular-nums font-medium">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Bottom Bar (Matching Screenshot 1: "CLOSE" on left, "APPLY" on right) */}
            <div className="flex items-center border-t border-[#EAE2D5] bg-white h-14 shrink-0">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="w-1/2 h-full flex items-center justify-center text-xs font-bold text-[#6B5D55] hover:bg-[#FAF7F2] transition-colors cursor-pointer uppercase tracking-wider border-r border-[#EAE2D5]"
              >
                CLOSE
              </button>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="w-1/2 h-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-[#8C2E46] hover:bg-[#742438] transition-colors cursor-pointer uppercase tracking-wider"
              >
                <span>APPLY</span>
                <span>({filteredProducts.length})</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
