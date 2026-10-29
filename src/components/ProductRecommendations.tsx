import React from 'react';
import { Sparkles, ShoppingBag, ArrowRight, Eye, Check } from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';

interface ProductRecommendationsProps {
  currentProduct: BedsheetProduct;
  recommendations?: BedsheetProduct[];
  allProducts?: BedsheetProduct[];
  onSelectProduct: (product: BedsheetProduct) => void;
  onAddToCart?: (product: BedsheetProduct) => void;
}

export const ProductRecommendations: React.FC<ProductRecommendationsProps> = ({
  currentProduct,
  recommendations,
  allProducts,
  onSelectProduct,
  onAddToCart,
}) => {
  // Compute smart recommendations if not explicitly provided
  const displayItems = React.useMemo(() => {
    if (recommendations && recommendations.length > 0) {
      return recommendations.slice(0, 4);
    }
    if (!allProducts || allProducts.length === 0) return [];
    
    return allProducts
      .filter((p) => p.id !== currentProduct.id)
      .map((p) => {
        let score = 0;
        // Same collection gets higher weight
        if (p.collection && currentProduct.collection && p.collection === currentProduct.collection) score += 3;
        // Similar thread count
        if (p.threadCount && currentProduct.threadCount && p.threadCount === currentProduct.threadCount) score += 2;
        // Similar fabric/weave
        if (p.fabric && currentProduct.fabric && p.fabric.toLowerCase().includes(currentProduct.fabric.toLowerCase())) score += 2;
        // In stock preference
        if (p.inStock) score += 1;
        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.product);
  }, [currentProduct, recommendations, allProducts]);

  if (!displayItems || displayItems.length === 0) return null;

  return (
    <div className="pt-6 border-t border-[#EAE2D5] space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C29E57]" />
          <h4 className="font-serif-luxury font-bold text-sm sm:text-base text-[#2C2420]">
            You May Also Like
          </h4>
        </div>
        <span className="text-[11px] text-[#7A6458]">
          Similar weave &amp; dimensions
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayItems.map((p) => {
          const displayImg = resolveBedsheetImage(p.image, p.id);
          const isDiscounted = p.originalPrice > p.price;

          return (
            <div
              key={p.id}
              onClick={() => onSelectProduct(p)}
              className="group p-2.5 bg-white rounded-2xl border border-[#EAE2D5] shadow-2xs hover:shadow-md hover:border-[#DEC89B] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="aspect-square rounded-xl overflow-hidden bg-[#F4EFE6] relative mb-2 border border-[#EAE2D5]/60">
                  <img
                    src={displayImg}
                    alt={p.name}
                    onError={(e) => handleImageFallback(e, p.id)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {p.badge && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 text-[#8C2E46] text-[9px] font-bold shadow-2xs backdrop-blur-xs">
                      {p.badge}
                    </span>
                  )}
                </div>

                <h5 className="font-serif-luxury font-bold text-xs text-[#2C2420] group-hover:text-[#8C2E46] transition-colors truncate">
                  {p.name}
                </h5>
                <p className="text-[10px] text-[#7A6458] truncate">{p.collection}</p>
              </div>

              <div className="mt-2 pt-2 border-t border-[#F4EFE6] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#70252D] font-mono">
                    ₹{p.price.toLocaleString('en-IN')}
                  </span>
                  {isDiscounted && (
                    <span className="text-[9px] text-stone-400 line-through ml-1">
                      ₹{p.originalPrice}
                    </span>
                  )}
                </div>

                {onAddToCart && p.inStock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(p);
                    }}
                    className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#8C2E46] text-[#8C2E46] hover:text-white border border-[#DEC89B] transition-colors cursor-pointer"
                    title={`Add ${p.name} to bag`}
                  >
                    <ShoppingBag className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
