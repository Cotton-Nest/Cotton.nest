import React, { useState, useMemo, useEffect } from 'react';
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
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
import { trackCustomerSearch } from '../services/customerActivityTracker';

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
  enableHangerAnimation?: boolean;
  onToggleHangerAnimation?: () => void;
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

export function checkProductMatchesSizeFilter(filterLabel: string, itemSize?: string, dimensions?: string): boolean {
  const cleanS = String(filterLabel || '').toLowerCase();
  const d = String(dimensions || '').toLowerCase();
  const sz = String(itemSize || '').toLowerCase();

  // 1. Super King (108 × 108) / 108x108
  if (
    cleanS.includes('super king') ||
    cleanS.includes('108 × 108') ||
    cleanS.includes('108x108') ||
    cleanS.includes('108 x 108') ||
    cleanS.includes('super-king-size')
  ) {
    return (
      sz.includes('super king') ||
      d.includes('108 x 108') ||
      d.includes('108x108') ||
      d.includes('108 × 108') ||
      (d.includes('108') && d.indexOf('108') !== d.lastIndexOf('108'))
    );
  }

  // 2. Standard King (100 × 108) / 100x108
  if (
    cleanS.includes('king size (100') ||
    cleanS.includes('king (100') ||
    cleanS.includes('100 × 108') ||
    cleanS.includes('100x108') ||
    cleanS.includes('100 x 108') ||
    (cleanS.includes('100') && cleanS.includes('108'))
  ) {
    return (
      (d.includes('100') && d.includes('108')) ||
      (sz.includes('king') && !sz.includes('super') && !sz.includes('120') && !d.includes('108 x 108') && !d.includes('108x108') && !d.includes('108 × 108'))
    );
  }

  // 3. King Size XL (120 × 120)
  if (cleanS.includes('xl') || cleanS.includes('120')) {
    return d.includes('120') || sz.includes('xl');
  }

  // 4. Specific dimension combos
  if (cleanS.includes('90') && cleanS.includes('108')) return d.includes('90') && d.includes('108');
  if (cleanS.includes('90') && cleanS.includes('100')) return d.includes('90') && d.includes('100');
  if (cleanS.includes('60') && cleanS.includes('100')) return d.includes('60') && d.includes('100');
  if (cleanS.includes('60') && cleanS.includes('90')) return d.includes('60') && d.includes('90');
  if (cleanS.includes('40')) return d.includes('40') && d.includes('60');

  // 5. Generic King search
  if (cleanS.includes('king')) {
    if (cleanS.includes('super')) {
      return (
        sz.includes('super king') ||
        d.includes('108 x 108') ||
        d.includes('108x108') ||
        d.includes('108 × 108')
      );
    }
    // Standard King
    return (
      (sz.includes('king') && !sz.includes('super')) ||
      (d.includes('100') && d.includes('108')) ||
      (d.includes('108') && !d.includes('108 x 108') && !d.includes('108x108') && !d.includes('108 × 108'))
    );
  }

  if (cleanS.includes('queen')) return sz.includes('queen') || d.includes('90');
  if (cleanS.includes('double')) return sz.includes('double') || d.includes('90');
  if (cleanS.includes('single')) return sz.includes('single') || d.includes('60');
  if (cleanS.includes('diwan')) return sz.includes('diwan') || d.includes('60');
  if (cleanS.includes('baby')) return sz.includes('baby') || d.includes('40');

  return sz.includes(cleanS) || d.includes(cleanS);
}

type FilterCategoryTab = 'stock' | 'size' | 'material' | 'pattern' | 'productType' | 'price' | 'color' | 'brand' | 'quick';

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
  enableHangerAnimation = true,
  onToggleHangerAnimation,
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

  // Multi-select Filters State - Keeping Material & Pattern strictly separated
  const [selectedStockFilter, setSelectedStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPricePreset, setSelectedPricePreset] = useState<'all' | 'under-1200' | '1200-1500' | 'above-1500' | 'custom'>('all');
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);

  // Myntra-style 2-column Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterCategoryTab>('stock');
  const [categorySearch, setCategorySearch] = useState('');

  // Calculate stock counts for instant filter tabs & badges
  const stockCounts = useMemo(() => {
    let inStockCount = 0;
    let outOfStockCount = 0;
    (products || []).forEach((p) => {
      if (!p) return;
      const isOut = !p.inStock || (p.stockQuantity !== undefined && p.stockQuantity <= 0);
      if (isOut) {
        outOfStockCount++;
      } else {
        inStockCount++;
      }
    });
    return {
      total: (products || []).length,
      inStock: inStockCount,
      outOfStock: outOfStockCount,
    };
  }, [products]);

  // Extract distinct dynamic filter choices and counts from actual products data
  const availableFilterData = useMemo(() => {
    const sizesSet = new Set<string>();
    const materialsSet = new Set<string>();
    const patternsSet = new Set<string>();
    const typesSet = new Set<string>();
    const brandsSet = new Set<string>();
    const colorsSet = new Set<string>();

    // Seed with standard presets so catalog filters are rich and predictable
    STANDARD_SIZES.filter((s) => s !== 'Other').forEach((s) => sizesSet.add(s));
    STANDARD_PRODUCT_TYPES.filter((t) => t !== 'Other').forEach((t) => typesSet.add(t));
    POPULAR_BRANDS.forEach((b) => brandsSet.add(b));

    // Curated pure cotton atelier fabric & material options (100% genuine)
    const curatedMaterials = [
      '100% Pure Natural Cotton',
      '100% Glace Finish Cotton',
      '100% Pure Percale Cotton',
      '100% Luxury Percale Cotton',
      '100% Long-Staple Cotton',
      '100% Premium Egyptian Combed Cotton',
      '100% Pure Organic Cotton',
      'Triple-Layer Pure Mulmul Cotton',
      '100% Sanganeri Weave Cotton',
      '100% Cotton Outer Shell (Cloud-Fill)',
    ];
    curatedMaterials.forEach((m) => materialsSet.add(m));

    // Curated design & pattern styles (100% genuine)
    const curatedPatterns = [
      'Vintage Rose Floral',
      'Soft Sage Botanicals',
      'Circular Floral Wreath',
      'Golden Botanical Vines',
      'Chevron Trellis & Floral',
      'Poppy Meadow & Grid',
      'Centerpiece Bouquet',
      'Royal Paisley Jaal',
      'Cobalt Blue Rose Print',
      'Traditional Hand-Block Floral',
      'Box-Stitched Reversible',
    ];
    curatedPatterns.forEach((pat) => patternsSet.add(pat));

    (products || []).forEach((p) => {
      if (!p) return;
      if (p.size && typeof p.size === 'string' && p.size.trim()) sizesSet.add(p.size.trim());
      
      // Distinct Material extraction from custom uploaded products
      if (p.fabric && typeof p.fabric === 'string' && p.fabric.trim()) {
        const cleanFab = p.fabric.trim();
        const alreadyExists = Array.from(materialsSet).some((m) => m.toLowerCase() === cleanFab.toLowerCase());
        if (!alreadyExists) materialsSet.add(cleanFab);
      }

      // Distinct Pattern extraction from custom uploaded products
      if (p.pattern && typeof p.pattern === 'string' && p.pattern.trim()) {
        const cleanPat = p.pattern.trim();
        const alreadyExists = Array.from(patternsSet).some((pat) => pat.toLowerCase() === cleanPat.toLowerCase());
        if (!alreadyExists) patternsSet.add(cleanPat);
      }

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
    });

    return {
      sizes: Array.from(sizesSet),
      materials: Array.from(materialsSet),
      patterns: Array.from(patternsSet),
      types: Array.from(typesSet),
      brands: Array.from(brandsSet),
      colors: Array.from(colorsSet).slice(0, 14),
    };
  }, [products]);

  // Clean, authentic Quick Filter Options for Cotton Nest with distinct Material and Pattern chips
  const quickFilterDefs = [
    { id: 'pure-cotton', label: 'Material: 100% Cotton', icon: Feather },
    { id: 'floral-pattern', label: 'Pattern: Floral & Botanicals', icon: LayoutGrid },
    { id: 'king-size', label: 'Size: King (100×108)', icon: Box },
    { id: 'super-king-size', label: 'Size: Super King (108×108)', icon: Box },
    { id: 'top-rated', label: 'Top Rated 4.5★+', icon: Star },
  ];

  // Helper toggle functions for multi-select
  const toggleArrayFilter = (current: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const toggleSize = (size: string) => toggleArrayFilter(selectedSizes, size, setSelectedSizes);
  const toggleMaterial = (mat: string) => toggleArrayFilter(selectedMaterials, mat, setSelectedMaterials);
  const togglePattern = (pattern: string) => toggleArrayFilter(selectedPatterns, pattern, setSelectedPatterns);
  const toggleProductType = (type: string) => toggleArrayFilter(selectedProductTypes, type, setSelectedProductTypes);
  const toggleBrand = (brand: string) => toggleArrayFilter(selectedBrands, brand, setSelectedBrands);
  const toggleColor = (color: string) => toggleArrayFilter(selectedColors, color, setSelectedColors);
  const toggleQuickFilter = (qId: string) => toggleArrayFilter(selectedQuickFilters, qId, setSelectedQuickFilters);

  // Select stock availability filter & automatically reset category selection to All Categories
  const handleStockFilterSelect = (status: 'all' | 'in-stock' | 'out-of-stock') => {
    setSelectedStockFilter(status);
    setSelectedProductTypes([]); // Automatically reset category selection to "All Categories" so the customer sees all items immediately
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedStockFilter('all');
    setSelectedSizes([]);
    setSelectedMaterials([]);
    setSelectedPatterns([]);
    setSelectedProductTypes([]);
    setSelectedBrands([]);
    setSelectedPricePreset('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setSelectedColors([]);
    setSelectedQuickFilters([]);
    setSearchQuery('');
  };

  // Count active filter conditions
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStockFilter !== 'all') count += 1;
    count += selectedSizes.length;
    count += selectedMaterials.length;
    count += selectedPatterns.length;
    count += selectedProductTypes.length;
    count += selectedBrands.length;
    if (selectedPricePreset !== 'all' || customMinPrice !== '' || customMaxPrice !== '') count += 1;
    count += selectedColors.length;
    count += selectedQuickFilters.length;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [
    selectedStockFilter,
    selectedSizes,
    selectedMaterials,
    selectedPatterns,
    selectedProductTypes,
    selectedBrands,
    selectedPricePreset,
    customMinPrice,
    customMaxPrice,
    selectedColors,
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

        // 0. Stock availability constraint
        const isOutOfStockItem = !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0);
        if (selectedStockFilter === 'in-stock' && isOutOfStockItem) return false;
        if (selectedStockFilter === 'out-of-stock' && !isOutOfStockItem) return false;
        const prodPatt = String(product.pattern || '');
        const prodColor = String(product.colorTone || '');
        const prodFabric = String(product.fabric || '');
        const prodTC = String(product.threadCount || '');
        const prodDesc = String(product.description || '');

        // 1. Size constraint (Multi-select: Match any selected size)
        if (selectedSizes.length > 0) {
          const matchesSize = selectedSizes.some((s) => checkProductMatchesSizeFilter(s, itemSize, dims));
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

        // 6. Material constraint (Multi-select: Separate from Pattern)
        if (selectedMaterials.length > 0) {
          const matchesMat = selectedMaterials.some((m) => {
            const cleanM = String(m || '').toLowerCase();
            const f = prodFabric.toLowerCase();
            if (f.includes(cleanM) || cleanM.includes(f)) return true;
            if (cleanM.includes('glace') && f.includes('glace')) return true;
            if (cleanM.includes('percale') && f.includes('percale')) return true;
            if (cleanM.includes('staple') && f.includes('staple')) return true;
            if (cleanM.includes('egyptian') && (f.includes('egyptian') || f.includes('combed'))) return true;
            if (cleanM.includes('organic') && f.includes('organic')) return true;
            if (cleanM.includes('mulmul') && f.includes('mulmul')) return true;
            if (cleanM.includes('sanganeri') && f.includes('sanganeri')) return true;
            if (cleanM.includes('flannel') && (f.includes('flannel') || f.includes('cloud'))) return true;
            if (cleanM.includes('pure natural') && (f.includes('natural') || f.includes('pure'))) return true;
            return false;
          });
          if (!matchesMat) return false;
        }

        // 7. Pattern constraint (Multi-select: Separate from Material)
        if (selectedPatterns.length > 0) {
          const patternString = `${prodPatt} ${prodColl}`.toLowerCase();
          const matchesPattern = selectedPatterns.some((p) => {
            const cleanP = String(p || '').toLowerCase();
            if (patternString.includes(cleanP) || cleanP.includes(patternString)) return true;
            if (cleanP.includes('rose') && patternString.includes('rose')) return true;
            if (cleanP.includes('floral') && (patternString.includes('floral') || patternString.includes('flower') || patternString.includes('bloom') || patternString.includes('bagh'))) return true;
            if (cleanP.includes('botanical') && (patternString.includes('botanical') || patternString.includes('sage') || patternString.includes('vines'))) return true;
            if (cleanP.includes('trellis') && (patternString.includes('trellis') || patternString.includes('chevron'))) return true;
            if (cleanP.includes('grid') && (patternString.includes('grid') || patternString.includes('meadow'))) return true;
            if (cleanP.includes('bouquet') && patternString.includes('bouquet')) return true;
            if (cleanP.includes('paisley') && (patternString.includes('paisley') || patternString.includes('jaal'))) return true;
            if (cleanP.includes('hand-block') && (patternString.includes('hand-block') || patternString.includes('block') || patternString.includes('traditional'))) return true;
            if (cleanP.includes('geometric') && (patternString.includes('geometric') || patternString.includes('trellis') || patternString.includes('chevron'))) return true;
            return false;
          });
          if (!matchesPattern) return false;
        }

        // 8. Color filter (Multi-select)
        if (selectedColors.length > 0) {
          const colorString = `${prodColor} ${product.variants?.map((v) => v?.name || '').join(' ') || ''}`.toLowerCase();
          const matchesColor = selectedColors.some((c) => colorString.includes(String(c || '').toLowerCase()));
          if (!matchesColor) return false;
        }

        // 9. Quick Filter chips logic (distinct Material & Pattern quick filters)
        if (selectedQuickFilters.includes('top-rated')) {
          const r = getProductRatingSummary(product.id, reviews);
          if (r.average < 4.5 && r.count > 0) return false;
        }
        if (selectedQuickFilters.includes('pure-cotton')) {
          const isCotton = prodFabric.toLowerCase().includes('cotton') || prodFabric.toLowerCase().includes('percale');
          if (!isCotton) return false;
        }
        if (selectedQuickFilters.includes('floral-pattern')) {
          const pComb = `${prodPatt} ${prodColl}`.toLowerCase();
          const isFloral = pComb.includes('floral') || pComb.includes('flower') || pComb.includes('rose') || pComb.includes('botanical') || pComb.includes('wreath') || pComb.includes('vines') || pComb.includes('meadow') || pComb.includes('bouquet');
          if (!isFloral) return false;
        }
        if (selectedQuickFilters.includes('king-size')) {
          const isKing = checkProductMatchesSizeFilter('King (100 × 108)', itemSize, dims);
          if (!isKing) return false;
        }
        if (selectedQuickFilters.includes('super-king-size')) {
          const isSuper = checkProductMatchesSizeFilter('Super King (108 × 108)', itemSize, dims);
          if (!isSuper) return false;
        }

        // 10. Free-text Search
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
    selectedMaterials,
    selectedPatterns,
    selectedProductTypes,
    selectedBrands,
    selectedPricePreset,
    customMinPrice,
    customMaxPrice,
    selectedColors,
    selectedQuickFilters,
    sortBy,
    reviews
  ]);

  // Log search queries for signed-in customer activity analytics (debounced)
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) return;
    const timer = window.setTimeout(() => {
      trackCustomerSearch(clean, filteredProducts.length);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [searchQuery, filteredProducts.length]);

  // Compute option product counts with 100% safe null-guards
  const getCountForFilter = (type: 'size' | 'material' | 'pattern' | 'productType' | 'brand' | 'color', value?: string) => {
    if (!value) return 0;
    const cleanVal = String(value).toLowerCase().trim();
    return (products || []).filter((p) => {
      if (!p) return false;

      // Filter by stock status if stock filter is active
      const isOut = !p.inStock || (p.stockQuantity !== undefined && p.stockQuantity <= 0);
      if (selectedStockFilter === 'in-stock' && isOut) return false;
      if (selectedStockFilter === 'out-of-stock' && !isOut) return false;
      if (type === 'size') {
        return checkProductMatchesSizeFilter(cleanVal, p.size, p.dimensions);
      }
      if (type === 'material') {
        const f = String(p.fabric || '').toLowerCase();
        if (f.includes(cleanVal) || cleanVal.includes(f)) return true;
        if (cleanVal.includes('glace') && f.includes('glace')) return true;
        if (cleanVal.includes('percale') && f.includes('percale')) return true;
        if (cleanVal.includes('staple') && f.includes('staple')) return true;
        if (cleanVal.includes('egyptian') && (f.includes('egyptian') || f.includes('combed'))) return true;
        if (cleanVal.includes('organic') && f.includes('organic')) return true;
        if (cleanVal.includes('mulmul') && f.includes('mulmul')) return true;
        if (cleanVal.includes('sanganeri') && f.includes('sanganeri')) return true;
        if (cleanVal.includes('flannel') && (f.includes('flannel') || f.includes('cloud'))) return true;
        if (cleanVal.includes('pure natural') && (f.includes('natural') || f.includes('pure'))) return true;
        return false;
      }
      if (type === 'pattern') {
        const pComb = `${p.pattern || ''} ${p.collection || ''}`.toLowerCase();
        if (pComb.includes(cleanVal) || cleanVal.includes(pComb)) return true;
        if (cleanVal.includes('rose') && pComb.includes('rose')) return true;
        if (cleanVal.includes('floral') && (pComb.includes('floral') || pComb.includes('flower') || pComb.includes('bloom') || pComb.includes('bagh'))) return true;
        if (cleanVal.includes('botanical') && (pComb.includes('botanical') || pComb.includes('sage') || pComb.includes('vines'))) return true;
        if (cleanVal.includes('trellis') && (pComb.includes('trellis') || pComb.includes('chevron'))) return true;
        if (cleanVal.includes('grid') && (pComb.includes('grid') || pComb.includes('meadow'))) return true;
        if (cleanVal.includes('bouquet') && pComb.includes('bouquet')) return true;
        if (cleanVal.includes('paisley') && (pComb.includes('paisley') || pComb.includes('jaal'))) return true;
        if (cleanVal.includes('hand-block') && (pComb.includes('hand-block') || pComb.includes('block') || pComb.includes('traditional'))) return true;
        if (cleanVal.includes('geometric') && (pComb.includes('geometric') || pComb.includes('trellis') || pComb.includes('chevron'))) return true;
        return false;
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase liquid-glass-badge mb-1.5"
                style={{
                  color: 'var(--color-primary, #70252D)',
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
            <div className="hidden md:flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="px-4 py-2 liquid-glass-badge text-[#2C2420] rounded-2xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
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
                className="py-2 px-3.5 liquid-glass-badge rounded-2xl text-xs font-semibold text-[#2C2420] focus:outline-hidden cursor-pointer"
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C29E57] z-10 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by size (King, Queen), fabric, style, or price (e.g. under 1500)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 liquid-glass-input rounded-2xl text-xs sm:text-sm text-[#2C2420] transition-all"
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

        {/* Frozen (Sticky) Top Filter & Category Bar */}
        <div
          className="sticky top-16 sm:top-18 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2.5 mb-4 border-b border-[#EAE2D5] shadow-2xs transition-colors"
          style={{ backgroundColor: 'var(--color-background, #FAF7F2)' }}
        >
          {/* 1. Category Navigation with Distinct Icons */}
          <div className="mb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              {/* All Categories Option */}
              <button
                type="button"
                onClick={() => setSelectedProductTypes([])}
                className={`px-3.5 py-2 rounded-2xl whitespace-nowrap font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  selectedProductTypes.length === 0
                    ? 'liquid-glass-primary-btn text-white'
                    : 'liquid-glass-badge text-[#2C2420] hover:border-[#8C2E46]/40'
                }`}
              >
                <LayoutGrid className={`w-4 h-4 ${selectedProductTypes.length === 0 ? 'text-white' : 'text-[#8C2E46]'}`} />
                <span>All Categories</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedProductTypes.length === 0 ? 'bg-white/25 text-white' : 'bg-[#F4EFE6]/90 text-[#7A6458]'
                  }`}
                >
                  {selectedStockFilter === 'in-stock'
                    ? stockCounts.inStock
                    : selectedStockFilter === 'out-of-stock'
                    ? stockCounts.outOfStock
                    : stockCounts.total}
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
                    className={`px-3.5 py-2 rounded-2xl whitespace-nowrap font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'liquid-glass-primary-btn text-white'
                        : 'liquid-glass-badge text-[#2C2420] hover:border-[#8C2E46]/40'
                    }`}
                  >
                    <CategoryIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#8C2E46]'}`} />
                    <span>{displayLabel}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-[#F4EFE6]/90 text-[#7A6458]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Secondary Refine & Quick Filters Bar (Frozen at Top) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            {/* Main All Filters Trigger */}
            <button
              type="button"
              onClick={() => {
                setActiveFilterTab('quick');
                setIsFilterModalOpen(true);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeFiltersCount > 0
                  ? 'liquid-glass-primary-btn text-white'
                  : 'liquid-glass-badge text-[#2C2420]'
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

            {/* Mobile & Tablet Sort Trigger in Top Frozen Bar */}
            <button
              type="button"
              onClick={() => setIsSortModalOpen(true)}
              className={`md:hidden px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                sortBy !== 'featured'
                  ? 'bg-[#FDEAF0] text-[#8C2E46] border border-[#8C2E46]'
                  : 'liquid-glass-badge text-[#2C2420]'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#8C2E46]" />
              <span>Sort</span>
            </button>

            {/* Quick Attribute Filter Triggers (Stock, Size, Material, Pattern, Color, Price, Brand) */}
            {[
              {
                id: 'stock' as FilterCategoryTab,
                label: selectedStockFilter === 'in-stock' ? 'In Stock' : selectedStockFilter === 'out-of-stock' ? 'Out of Stock' : 'Stock',
                count: selectedStockFilter !== 'all' ? 1 : 0,
                icon: Boxes,
              },
              { id: 'size' as FilterCategoryTab, label: 'Size', count: selectedSizes.length, icon: Box },
              { id: 'material' as FilterCategoryTab, label: 'Material', count: selectedMaterials.length, icon: Feather },
              { id: 'pattern' as FilterCategoryTab, label: 'Pattern', count: selectedPatterns.length, icon: LayoutGrid },
              { id: 'price' as FilterCategoryTab, label: 'Price', count: (selectedPricePreset !== 'all' || customMinPrice || customMaxPrice) ? 1 : 0, icon: IndianRupee },
              { id: 'color' as FilterCategoryTab, label: 'Color', count: selectedColors.length, icon: Tag },
              { id: 'brand' as FilterCategoryTab, label: 'Brand', count: selectedBrands.length, icon: ShieldCheck },
            ].map((tab) => {
              const hasSelection = tab.count > 0;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveFilterTab(tab.id);
                    setIsFilterModalOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    hasSelection
                      ? 'bg-[#FDEAF0] text-[#8C2E46] border border-[#8C2E46] font-bold shadow-2xs'
                      : 'liquid-glass-badge text-[#4A3B32] font-medium'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${hasSelection ? 'text-[#8C2E46]' : 'text-[#8C7A70]'}`} />
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

            {/* Quick Stock Status Toggle Pills */}
            <div className="flex items-center gap-1 shrink-0 bg-[#FAF7F2] p-1 rounded-xl border border-[#EAE2D5]">
              <button
                type="button"
                onClick={() => handleStockFilterSelect('all')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedStockFilter === 'all'
                    ? 'bg-[#2C2420] text-white shadow-2xs font-bold'
                    : 'text-[#6B5D55] hover:text-[#2C2420]'
                }`}
              >
                All ({stockCounts.total})
              </button>
              <button
                type="button"
                onClick={() => handleStockFilterSelect('in-stock')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                  selectedStockFilter === 'in-stock'
                    ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                    : 'text-emerald-800 hover:bg-emerald-100/50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>In Stock ({stockCounts.inStock})</span>
              </button>
              <button
                type="button"
                onClick={() => handleStockFilterSelect('out-of-stock')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                  selectedStockFilter === 'out-of-stock'
                    ? 'bg-amber-900 text-white shadow-2xs font-bold'
                    : 'text-amber-900 hover:bg-amber-100/50'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Out of Stock ({stockCounts.outOfStock})</span>
              </button>
            </div>

            {/* Quick Refinement Chips */}
            {quickFilterDefs.map((chip) => {
              const isSelected = selectedQuickFilters.includes(chip.id);
              const IconComponent = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleQuickFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'liquid-glass-primary-btn text-white font-semibold'
                      : 'liquid-glass-badge text-[#2C2420]'
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#8C7A70]'}`} />
                  <span>{chip.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Active Filters Tag Ribbon & Clear All */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2 py-2.5 px-3.5 mb-4 liquid-glass-surface rounded-2xl text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-[#8C7A70] uppercase">Active:</span>

              {selectedStockFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] shadow-2xs">
                  {selectedStockFilter === 'in-stock' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Availability: In Stock Only</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Availability: Out of Stock</span>
                    </>
                  )}
                  <button type="button" onClick={() => handleStockFilterSelect('all')} className="cursor-pointer hover:font-bold ml-0.5">✕</button>
                </span>
              )}

              {selectedSizes.map((s) => (
                <span
                  key={`size-${s}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FDEAF0] text-[#8C2E46] border border-[#FAD1DC]"
                >
                  Size: {s}
                  <button type="button" onClick={() => toggleSize(s)} className="cursor-pointer hover:font-bold">✕</button>
                </span>
              ))}

              {selectedMaterials.map((m) => (
                <span
                  key={`mat-${m}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA] shadow-2xs"
                >
                  <Feather className="w-3 h-3 text-[#EA580C]" />
                  <span>Material: {m}</span>
                  <button type="button" onClick={() => toggleMaterial(m)} className="cursor-pointer hover:font-bold ml-0.5 text-[#9A3412]">✕</button>
                </span>
              ))}

              {selectedPatterns.map((p) => (
                <span
                  key={`pat-${p}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] shadow-2xs"
                >
                  <LayoutGrid className="w-3 h-3 text-[#16A34A]" />
                  <span>Pattern: {p}</span>
                  <button type="button" onClick={() => togglePattern(p)} className="cursor-pointer hover:font-bold ml-0.5 text-[#166534]">✕</button>
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

          {/* View mode toggle buttons: 1 View (Single bedsheet at a time), Tile (Grid), List (Row) - Liquid Glass Container */}
          <div className="flex items-center gap-1 liquid-glass-surface p-1 rounded-2xl border-white/80 shadow-2xs">
            <button
              type="button"
              onClick={() => handleViewModeChange('single')}
              title="1 View (One bedsheet at a time)"
              aria-label="1 View"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-white/60'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'tile'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-white/60'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#8C2E46] text-white shadow-xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420] hover:bg-white/60'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[11px]">List</span>
            </button>
          </div>
        </div>

        {/* Boutique Wardrobe Closet Rod Presentation */}
        <div className="relative pt-1 pb-3 mb-2">
          <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-[#8C6D2D] via-[#F4E2A8] via-[#C5A059] to-[#8C6D2D] shadow-sm relative flex items-center justify-between px-2">
            <div className="w-2.5 h-4.5 -ml-2.5 rounded-sm bg-gradient-to-b from-[#A88B4A] to-[#5C4518] shadow-md border-r border-[#F4E2A8]/60" />
            <div className="absolute inset-x-2 top-0.5 h-0.5 bg-white/40 rounded-full" />
            <div className="w-2.5 h-4.5 -mr-2.5 rounded-sm bg-gradient-to-b from-[#A88B4A] to-[#5C4518] shadow-md border-l border-[#F4E2A8]/60" />
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-[#8C7A70] flex-wrap gap-2">
            <span className="font-serif-luxury italic flex items-center gap-1.5 text-[#5E1924]">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Boutique Wardrobe Collection · Bedsheets hanging on luxury hangers</span>
            </span>
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-block text-[10px] text-[#7A6458]">
                {enableHangerAnimation ? 'Hover or tap any bedsheet to experience natural fabric sway' : 'Hanger sway animation is paused'}
              </span>
              {onToggleHangerAnimation && (
                <button
                  type="button"
                  onClick={onToggleHangerAnimation}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                    enableHangerAnimation
                      ? 'bg-[#FAF6F0] text-[#70252D] border-[#DEC89B] shadow-2xs'
                      : 'bg-white/80 text-[#8C7A70] border-[#EAE2D5] hover:bg-[#FAF7F2]'
                  }`}
                  title={enableHangerAnimation ? 'Turn off hanger animation' : 'Turn on hanger animation'}
                >
                  <span>Hanger Sway:</span>
                  <span className={`px-1.5 py-0.2 rounded-full font-bold ${enableHangerAnimation ? 'bg-[#70252D] text-white' : 'bg-[#EAE2D5] text-[#6B5D55]'}`}>
                    {enableHangerAnimation ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 6. Products Container (Single: 1 bedsheet view at a time / Tile: 2 on mobile, 3-4 on desktop / List: row cards) */}
        {filteredProducts.length > 0 ? (
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={
              viewMode === 'single'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto'
                : viewMode === 'list'
                ? 'flex flex-col space-y-4 max-w-4xl mx-auto'
                : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6'
            }
          >
            {filteredProducts.map((product, idx) => (
              <motion.div
                key={`${product.id || 'prod'}-${idx}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{
                  duration: 0.45,
                  delay: Math.min(idx * 0.04, 0.22),
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <ProductCard
                  product={product}
                  viewMode={viewMode}
                  priority={idx < 2}
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
                  enableHangerAnimation={enableHangerAnimation}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-16 liquid-glass-card rounded-3xl p-8 max-w-md mx-auto space-y-4 my-8">
            <div className="w-14 h-14 rounded-2xl bg-[#FDEAF0]/90 border border-white/80 text-[#8C2E46] flex items-center justify-center mx-auto shadow-2xs">
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
              className="px-5 py-2.5 liquid-glass-primary-btn text-white text-xs font-semibold rounded-xl cursor-pointer transition-all"
            >
              Clear All Filters
            </button>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* 7. SORT BOTTOM SHEET MODAL (MOBILE)                      */}
      {/* ======================================================== */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsSortModalOpen(false)} />
          <div className="relative liquid-glass-modal w-full rounded-t-3xl p-5 z-10 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE2D5]/70">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8C7A70]">Sort By</span>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="p-1 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-[#F4EFE6]/70 pt-1">
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
                  className="w-full py-3.5 px-2 flex items-center justify-between text-xs font-medium text-[#2C2420] hover:bg-white/60 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsFilterModalOpen(false)} />

          <div className="relative liquid-glass-modal w-full max-w-xl sm:max-w-2xl h-[90vh] max-h-[720px] rounded-3xl z-10 flex flex-col overflow-hidden">
            
            {/* Modal Top Header (Matching Screenshot 1: "Filters" left, "CLEAR ALL" right) */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/70 bg-white/60 backdrop-blur-md shrink-0">
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
                  { id: 'stock', label: 'Availability', count: selectedStockFilter !== 'all' ? 1 : 0, sub: 'In Stock / Sold Out' },
                  { id: 'size', label: 'Size', count: selectedSizes.length, sub: 'Mattress fit' },
                  { id: 'material', label: 'Material', count: selectedMaterials.length, sub: 'Fabric & Weave' },
                  { id: 'pattern', label: 'Pattern', count: selectedPatterns.length, sub: 'Prints & Motifs' },
                  { id: 'productType', label: 'Categories', count: selectedProductTypes.length, sub: 'Sheets & Covers' },
                  { id: 'price', label: 'Price', count: (selectedPricePreset !== 'all' || customMinPrice || customMaxPrice) ? 1 : 0, sub: 'Budget & Ranges' },
                  { id: 'color', label: 'Color', count: selectedColors.length, sub: 'Shades & Tones' },
                  { id: 'brand', label: 'Brand', count: selectedBrands.length, sub: 'Atelier labels' },
                  { id: 'quick', label: 'Quick Filters', count: selectedQuickFilters.length, sub: 'Trending' },
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
                      className={`w-full py-3 sm:py-3.5 px-3 sm:px-4 text-left text-xs transition-colors cursor-pointer flex items-center justify-between border-b border-[#EAE2D5]/60 ${
                        isActive
                          ? 'bg-white font-bold text-[#2C2420] border-l-4 border-l-[#8C2E46]'
                          : 'text-[#6B5D55] hover:bg-[#EFE9DF]'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <span className={`block truncate ${isActive ? 'font-bold text-[#2C2420]' : 'font-semibold text-[#4A3B32]'}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-[#8C7A70] block truncate">
                          {cat.sub}
                        </span>
                      </div>
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
                
                {/* 0. Stock Availability Tab */}
                {activeFilterTab === 'stock' && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider mb-2">
                      Filter Bedsheet Availability Status
                    </p>

                    {/* All Items */}
                    <button
                      type="button"
                      onClick={() => handleStockFilterSelect('all')}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedStockFilter === 'all'
                          ? 'bg-[#2C2420] text-white border-[#2C2420] font-bold shadow-xs'
                          : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          selectedStockFilter === 'all' ? 'bg-white/20 text-amber-300' : 'bg-[#FAF7F2] text-[#8C2E46]'
                        }`}>
                          <Boxes className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs block font-bold">All Bedsheets</span>
                          <span className={`text-[10px] block ${selectedStockFilter === 'all' ? 'text-[#EAE2D5]' : 'text-[#7A6458]'}`}>
                            Show full catalogue (both available and sold out items)
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums">({stockCounts.total})</span>
                    </button>

                    {/* Available / In Stock Only */}
                    <button
                      type="button"
                      onClick={() => handleStockFilterSelect('in-stock')}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedStockFilter === 'in-stock'
                          ? 'bg-emerald-800 text-white border-emerald-800 font-bold shadow-xs'
                          : 'bg-emerald-50/50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          selectedStockFilter === 'in-stock' ? 'bg-white/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs block font-bold">Available / In Stock</span>
                          <span className={`text-[10px] block ${selectedStockFilter === 'in-stock' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                            Ready for immediate purchase &amp; fast dispatch
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums">({stockCounts.inStock})</span>
                    </button>

                    {/* Out of Stock / Sold Out */}
                    <button
                      type="button"
                      onClick={() => handleStockFilterSelect('out-of-stock')}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedStockFilter === 'out-of-stock'
                          ? 'bg-amber-900 text-white border-amber-900 font-bold shadow-xs'
                          : 'bg-amber-50/60 text-amber-950 border-amber-300 hover:bg-amber-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          selectedStockFilter === 'out-of-stock' ? 'bg-white/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                        }`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs block font-bold">Out of Stock / Sold Out</span>
                          <span className={`text-[10px] block ${selectedStockFilter === 'out-of-stock' ? 'text-amber-100' : 'text-amber-800'}`}>
                            View sold out items to request restock alerts
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums">({stockCounts.outOfStock})</span>
                    </button>
                  </div>
                )}
                
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
                      { label: 'King Size (100 × 108)', spec: 'Mattress: 72 × 78 (Standard King)' },
                      { label: 'Super King Size (108 × 108)', spec: 'Mattress: 72 × 78 (Super King / Extra Drop)' },
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

                {/* 7. Material Tab (Kept separately from Pattern) */}
                {activeFilterTab === 'material' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider">
                        Pure Cotton Fabric &amp; Material
                      </p>
                      <span className="text-[10px] text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded-full font-bold">
                        100% Breathable
                      </span>
                    </div>

                    {/* Search inside Materials */}
                    {availableFilterData.materials.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7A70]" />
                        <input
                          type="text"
                          placeholder="Search materials (Glace, Percale, Combed, Mulmul...)"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-lg text-xs focus:outline-hidden"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      {availableFilterData.materials
                        .filter((m) => String(m || '').toLowerCase().includes(String(categorySearch || '').toLowerCase()))
                        .map((m) => {
                          const isChecked = selectedMaterials.includes(m);
                          const count = getCountForFilter('material', m);
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => toggleMaterial(m)}
                              className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                  isChecked ? 'bg-[#8C2E46] text-white' : 'border border-[#C29E57]/60 group-hover:border-[#8C2E46]'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className={`text-xs ${isChecked ? 'font-bold text-[#2C2420]' : 'text-[#6B5D55]'}`}>
                                  {m}
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

                {/* 8. Pattern Tab (Kept separately from Material) */}
                {activeFilterTab === 'pattern' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider">
                        Design &amp; Pattern Style
                      </p>
                      <span className="text-[10px] text-[#8C2E46] bg-[#FDEAF0] px-2 py-0.5 rounded-full font-bold">
                        Artisanal Prints
                      </span>
                    </div>

                    {/* Search inside Patterns */}
                    {availableFilterData.patterns.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7A70]" />
                        <input
                          type="text"
                          placeholder="Search pattern (Floral, Geometric, Rose, Trellis...)"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-lg text-xs focus:outline-hidden"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      {availableFilterData.patterns
                        .filter((p) => String(p || '').toLowerCase().includes(String(categorySearch || '').toLowerCase()))
                        .map((p) => {
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
