import React, { useRef } from 'react';
import { X, Upload, RotateCcw, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { BEDSHEETS_CATALOG, BedsheetProduct } from '../data/products';
import { uploadImageApi } from '../services/api';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: BedsheetProduct[];
  customImages: Record<string, string>;
  onUploadImage: (productId: string, dataUrl: string) => void;
  onResetImage: (productId: string) => void;
  onResetAll: () => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  products = BEDSHEETS_CATALOG,
  customImages,
  onUploadImage,
  onResetImage,
  onResetAll,
}) => {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!isOpen) return null;

  const displayProducts = products && products.length > 0 ? products : BEDSHEETS_CATALOG;

  const handleFileSelect = async (productId: string, file?: File) => {
    if (!file) return;
    try {
      setSuccessMessage('Compressing & syncing photo...');
      const serverUrl = await uploadImageApi(file, productId);
      onUploadImage(productId, serverUrl);
      setSuccessMessage('Photo synced & stored permanently in Google Cloud Console!');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      console.error('Failed to upload file:', err);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSuccessMessage(`Processing ${files.length} photos...`);
    for (let index = 0; index < files.length; index++) {
      if (index < displayProducts.length) {
        const product = displayProducts[index];
        try {
          const serverUrl = await uploadImageApi(files[index], product.id);
          onUploadImage(product.id, serverUrl);
        } catch (err) {
          console.error('Failed bulk photo:', err);
        }
      }
    }

    setSuccessMessage(`Uploaded ${Math.min(files.length, displayProducts.length)} photos to Google Cloud Console!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2420]/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-[#FAF7F2] w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-[#EAE2D5] shadow-2xl z-10 flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#EAE2D5] bg-[#FAF7F2] flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A8823B] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
              Photo Studio
            </div>
            <h2 className="font-serif-luxury text-xl sm:text-2xl font-semibold text-[#2C2420]">
              Upload Your Original Bedsheet Photos
            </h2>
            <p className="text-xs text-[#6B5D55] mt-0.5">
              Select your own photos directly from your phone gallery or computer. They will immediately appear on the site!
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Upload Helper Banner */}
        <div className="bg-[#FDEAF0] px-4 sm:px-6 py-3 border-b border-[#FAD1DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#8C2E46]">
            <p className="font-semibold flex items-center gap-1.5">
              <Upload className="w-4 h-4 shrink-0" />
              Quick Option: Select All 8 or 9 Photos at once
            </p>
            <p className="text-[11px] text-[#A33452] mt-0.5">
              Choose all your files together from your gallery and we will map them down the list automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3.5 py-2 bg-[#B83F60] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Select Multiple Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleBulkUpload}
                className="hidden"
              />
            </label>

            {Object.keys(customImages).length > 0 && (
              <button
                type="button"
                onClick={onResetAll}
                className="px-3 py-2 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#7A6458] hover:text-[#2C2420] border border-[#EAE2D5] text-xs font-medium rounded-xl transition-colors flex items-center gap-1"
                title="Reset all back to studio photos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>
            )}
          </div>
        </div>

        {/* Success alert message */}
        {successMessage && (
          <div className="bg-[#EBF7EE] text-[#2E7D46] px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b border-[#D2EBD7] animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Scrollable Bedsheets List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayProducts.map((product, idx) => {
              const hasCustom = !!customImages[product.id];
              const currentImage = resolveBedsheetImage(product.image || customImages[product.id], product.id, product.updatedAt);

              return (
                <div
                  key={product.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    hasCustom
                      ? 'border-[#B83F60] bg-[#FDEAF0]/30 shadow-xs'
                      : 'border-[#EAE2D5] bg-[#FAF7F2]'
                  }`}
                >
                  {/* Image Preview */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#F4EFE6] border border-[#EAE2D5] mb-2.5">
                    <img
                      src={currentImage}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      onError={handleImageFallback}
                      className="w-full h-full object-cover object-center"
                    />

                    {hasCustom && (
                      <span className="absolute top-2 left-2 bg-[#2E7D46] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Custom Photo
                      </span>
                    )}

                    <span className="absolute bottom-2 right-2 bg-[#2C2420]/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Product Title */}
                  <h4 className="text-xs font-semibold text-[#2C2420] truncate mb-0.5">
                    {product.name}
                  </h4>
                  <p className="text-[11px] text-[#7A6458] mb-3">
                    ₹{product.price.toLocaleString('en-IN')} · 108×108 King
                  </p>

                  {/* Actions for this specific card */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[product.id] = el; }}
                      onChange={(e) => handleFileSelect(product.id, e.target.files?.[0])}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[product.id]?.click()}
                      className="flex-1 py-1.5 px-2 bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>{hasCustom ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>

                    {hasCustom && (
                      <button
                        type="button"
                        onClick={() => onResetImage(product.id)}
                        className="p-1.5 text-[#7A6458] hover:text-[#B83F60] hover:bg-[#F4EFE6] border border-[#EAE2D5] rounded-lg transition-colors cursor-pointer"
                        title="Reset to default photo"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-[#FAF7F2] flex items-center justify-between">
          <p className="text-xs text-[#7A6458]">
            Photos are saved locally in your browser storage.
          </p>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#B83F60] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done Viewing
          </button>
        </div>

      </div>
    </div>
  );
};
