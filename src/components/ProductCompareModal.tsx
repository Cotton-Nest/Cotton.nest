import React from 'react';
import {
  X,
  Scale,
  ShoppingBag,
  Trash2,
  Check,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Layers,
  ArrowRight
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';

interface ProductCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: BedsheetProduct[];
  onRemoveFromCompare: (productId: string) => void;
  onClearCompare: () => void;
  onAddToCart: (product: BedsheetProduct) => void;
  onViewProduct: (product: BedsheetProduct) => void;
}

export const ProductCompareModal: React.FC<ProductCompareModalProps> = ({
  isOpen,
  onClose,
  products,
  onRemoveFromCompare,
  onClearCompare,
  onAddToCart,
  onViewProduct,
}) => {
  if (!isOpen) return null;

  const comparisonAttributes = [
    {
      label: 'Price & Offer',
      render: (p: BedsheetProduct) => (
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-[#70252D] font-serif-luxury">
            ₹{p.price.toLocaleString('en-IN')}
          </div>
          {p.originalPrice > p.price ? (
            <div className="text-[11px] text-[#7A6458] line-through">
              MRP: ₹{p.originalPrice.toLocaleString('en-IN')}
            </div>
          ) : (
            <span className="text-[10px] text-stone-400">Regular Atelier Price</span>
          )}
        </div>
      ),
    },
    {
      label: 'Dimensions',
      render: (p: BedsheetProduct) => (
        <span className="font-medium text-[#2C2420]">
          {p.dimensions || <em className="text-stone-400 font-normal">Not specified</em>}
        </span>
      ),
    },
    {
      label: 'Fabric Material',
      render: (p: BedsheetProduct) => (
        <span className="font-medium text-[#2C2420]">
          {p.fabric || <em className="text-stone-400 font-normal">100% Pure Cotton</em>}
        </span>
      ),
    },
    {
      label: 'Thread Count',
      render: (p: BedsheetProduct) => (
        <span className="font-medium text-[#2C2420]">
          {p.threadCount || <em className="text-stone-400 font-normal">Not specified</em>}
        </span>
      ),
    },
    {
      label: 'Included Pillow Covers',
      render: (p: BedsheetProduct) => (
        <span className="font-medium text-[#2C2420]">
          {p.pillowCovers || <em className="text-stone-400 font-normal">Not specified</em>}
        </span>
      ),
    },
    {
      label: 'Pattern Style',
      render: (p: BedsheetProduct) => (
        <span className="font-medium text-[#2C2420]">
          {p.pattern || <em className="text-stone-400 font-normal">Not specified</em>}
        </span>
      ),
    },
    {
      label: 'Collection',
      render: (p: BedsheetProduct) => (
        <span className="text-xs px-2 py-0.5 rounded bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B] font-semibold inline-block">
          {p.collection || 'Cotton Nest Signature'}
        </span>
      ),
    },
    {
      label: 'Color Variants',
      render: (p: BedsheetProduct) => (
        <div>
          {p.variants && p.variants.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.variants.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#DEC89B] text-[#2C2420]"
                >
                  {v.colorHex && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: v.colorHex }}
                    />
                  )}
                  <span>{v.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-[#7A6458]">
              {p.colorTone || 'Single Exclusive Shade'}
            </span>
          )}
        </div>
      ),
    },
    {
      label: 'Availability',
      render: (p: BedsheetProduct) => (
        <div>
          {p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0) ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>In Stock ({p.stockQuantity ?? 10} units)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              <span>Sold Out / Waitlist</span>
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-5xl rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#EAE2D5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury font-bold text-lg sm:text-xl text-[#2C2420]">
                  Compare Bedsheets
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B]">
                  {products.length}/3 Selected
                </span>
              </div>
              <p className="text-[11px] text-[#7A6458]">
                Side-by-side comparison of weave, dimensions, and specifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {products.length > 0 && (
              <button
                type="button"
                onClick={onClearCompare}
                className="text-xs font-semibold text-stone-500 hover:text-rose-600 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                title="Remove all from comparison"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#7A6458] hover:text-[#2C2420] rounded-xl hover:bg-[#FAF7F2] transition-colors cursor-pointer border border-[#EAE2D5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {products.length === 0 ? (
            <div className="text-center py-20 px-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-white border border-[#DEC89B] flex items-center justify-center mx-auto text-[#A8823B] shadow-2xs">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <p className="font-serif-luxury font-bold text-base text-[#2C2420]">
                  No bedsheets selected for comparison
                </p>
                <p className="text-xs text-[#7A6458] mt-1 max-w-sm mx-auto">
                  Click the "Compare" option on any bedsheet card or detail view to compare up to 3 products side-by-side.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-[620px] bg-white rounded-2xl border border-[#EAE2D5] shadow-xs overflow-hidden">
              
              {/* Product Card Top Headers Column */}
              <div className="grid grid-cols-4 border-b border-[#EAE2D5] bg-[#FAF7F2]/60">
                <div className="p-4 border-r border-[#EAE2D5] flex items-center font-serif-luxury font-bold text-xs uppercase tracking-wider text-[#7A6458]">
                  Product Overview
                </div>

                {products.map((product) => (
                  <div key={product.id} className="p-4 border-r border-[#EAE2D5] last:border-r-0 space-y-2 relative group">
                    <button
                      type="button"
                      onClick={() => onRemoveFromCompare(product.id)}
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove from comparison"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div
                      onClick={() => {
                        onClose();
                        onViewProduct(product);
                      }}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#F4EFE6] border border-[#DEC89B] mx-auto cursor-pointer shadow-2xs group-hover:scale-102 transition-transform"
                    >
                      <img
                        src={resolveBedsheetImage(product.image, product.id)}
                        alt={product.name}
                        onError={(e) => handleImageFallback(e, product.id)}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>

                    <div className="text-center">
                      <h4
                        onClick={() => {
                          onClose();
                          onViewProduct(product);
                        }}
                        className="font-serif-luxury font-bold text-sm text-[#2C2420] hover:text-[#70252D] cursor-pointer line-clamp-1"
                      >
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-[#7A6458] truncate">{product.collection}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAddToCart(product)}
                      disabled={!product.inStock}
                      className="w-full py-1.5 px-2 bg-[#70252D] hover:bg-[#5b1e24] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>{product.inStock ? 'Add to Bag' : 'Sold Out'}</span>
                    </button>
                  </div>
                ))}

                {/* Empty slots placeholders if fewer than 3 */}
                {Array.from({ length: 3 - products.length }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="p-4 border-r border-[#EAE2D5] last:border-r-0 flex flex-col items-center justify-center text-center text-stone-400 space-y-1.5"
                  >
                    <div className="w-16 h-16 rounded-xl border border-dashed border-[#DEC89B] flex items-center justify-center text-stone-300">
                      <Scale className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-medium">Add product to compare</span>
                  </div>
                ))}
              </div>

              {/* Attributes Rows */}
              {comparisonAttributes.map((attr, rowIdx) => (
                <div
                  key={attr.label}
                  className={`grid grid-cols-4 border-b border-[#EAE2D5] last:border-b-0 text-xs ${
                    rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]/30'
                  }`}
                >
                  <div className="p-3.5 border-r border-[#EAE2D5] font-semibold text-[#6B5D55] flex items-center">
                    {attr.label}
                  </div>

                  {products.map((product) => (
                    <div
                      key={`${product.id}-${attr.label}`}
                      className="p-3.5 border-r border-[#EAE2D5] last:border-r-0 flex items-center"
                    >
                      {attr.render(product)}
                    </div>
                  ))}

                  {Array.from({ length: 3 - products.length }).map((_, idx) => (
                    <div
                      key={`empty-cell-${idx}`}
                      className="p-3.5 border-r border-[#EAE2D5] last:border-r-0 text-stone-300 text-center"
                    >
                      —
                    </div>
                  ))}
                </div>
              ))}

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
