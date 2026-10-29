import React from 'react';
import { Scale, X, ArrowRight } from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { resolveBedsheetImage } from '../utils/imageUrl';

interface ProductCompareBarProps {
  products: BedsheetProduct[];
  onOpenCompare: () => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export const ProductCompareBar: React.FC<ProductCompareBarProps> = ({
  products,
  onOpenCompare,
  onRemove,
  onClear,
}) => {
  if (products.length === 0) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] bg-[#2C2420]/95 backdrop-blur-md text-white rounded-2xl p-2.5 sm:p-3 shadow-2xl border border-[#DEC89B]/50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="p-1.5 rounded-lg bg-[#DEC89B]/20 text-[#DEC89B]">
            <Scale className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold font-serif-luxury tracking-wide hidden sm:inline">
            Compare ({products.length}/3)
          </span>
        </div>

        {/* Thumbnails */}
        <div className="flex items-center gap-1.5">
          {products.map((p) => (
            <div
              key={p.id}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-[#DEC89B]/50 shrink-0 bg-[#FAF7F2] group"
              title={p.name}
            >
              <img
                src={resolveBedsheetImage(p.image, p.id)}
                alt={p.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(p.id);
                }}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white cursor-pointer"
                title={`Remove ${p.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-stone-400 hover:text-white transition-colors cursor-pointer px-1.5 py-1"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onOpenCompare}
          className="py-1.5 px-3 sm:px-4 bg-[#C29E57] hover:bg-[#a8823b] text-[#2C2420] font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <span>Compare ({products.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
