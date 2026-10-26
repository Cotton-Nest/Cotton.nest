import React, { useRef, useState } from 'react';
import { X, Upload, RotateCcw, Check, Sparkles, Image as ImageIcon, Plus, Trash2, Cloud, Layers } from 'lucide-react';
import { BEDSHEETS_CATALOG, BedsheetProduct } from '../data/products';
import {
  uploadImageApi,
  computeUpdatedImagesCount,
  addProductGalleryImageApi,
  removeProductGalleryImageApi,
  saveUpdatedImagesStatsApi,
} from '../services/api';
import { resolveBedsheetImage, handleImageFallback } from '../utils/imageUrl';
import { isCloudinaryUrl } from '../services/cloudinary';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: BedsheetProduct[];
  customImages: Record<string, string>;
  onUploadImage: (productId: string, fileOrUrl: string | File) => void;
  onResetImage: (productId: string) => void;
  onResetAll: () => void;
  onUpdateSingleProduct?: (updatedProduct: BedsheetProduct) => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  products = BEDSHEETS_CATALOG,
  customImages,
  onUploadImage,
  onResetImage,
  onResetAll,
  onUpdateSingleProduct,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // New bedsheet quick-add modal inside Photo Studio
  const [isAddingNewSheet, setIsAddingNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetPrice, setNewSheetPrice] = useState('1499');
  const [newSheetFile, setNewSheetFile] = useState<File | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const galleryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!isOpen) return null;

  const displayProducts = products && products.length > 0 ? products : BEDSHEETS_CATALOG;

  // Authoritative count of updated images across primary, gallery, and variant photos
  const totalUpdatedImagesCount = computeUpdatedImagesCount(displayProducts, customImages);

  const customProductsCount = displayProducts.filter(
    (p) =>
      !!customImages[p.id] ||
      isCloudinaryUrl(p.image) ||
      (typeof p.image === 'string' && !p.image.includes('exact_sheet') && !p.image.startsWith('/images/exact_'))
  ).length;

  const completionPercentage = Math.round((customProductsCount / Math.max(1, displayProducts.length)) * 100);

  // Replace primary image
  const handleFileSelect = async (productId: string, file?: File) => {
    if (!file) return;
    setUploadingId(productId);
    setErrorMessage(null);
    try {
      setSuccessMessage('Uploading image to Cloudinary & saving link in Firebase...');
      const serverUrl = await uploadImageApi(file, productId);
      onUploadImage(productId, serverUrl);

      // Save updated stats in Firestore
      const nextCount = totalUpdatedImagesCount + 1;
      saveUpdatedImagesStatsApi(nextCount).catch(() => {});

      setSuccessMessage('✓ Photo replaced and stored permanently in Cloudinary & Firebase!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      setErrorMessage(`Upload error: ${err.message || 'Please try again.'}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setUploadingId(null);
    }
  };

  // Add extra angle / gallery image to a specific bedsheet
  const handleAddGalleryImage = async (productId: string, file?: File) => {
    if (!file) return;
    setUploadingId(`gallery_${productId}`);
    setErrorMessage(null);
    try {
      setSuccessMessage('Adding extra angle photo to bedsheet gallery...');
      const target = displayProducts.find((p) => p.id === productId);
      const currentAdditional = target?.additionalImages || [];
      const newImageUrl = await addProductGalleryImageApi(productId, file, currentAdditional);

      if (onUpdateSingleProduct && target) {
        onUpdateSingleProduct({
          ...target,
          additionalImages: [...currentAdditional, newImageUrl],
        });
      }

      setSuccessMessage('✓ New photo added to bedsheet gallery & saved in Firebase!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to add gallery image:', err);
      setErrorMessage(`Gallery upload error: ${err.message || 'Please try again.'}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setUploadingId(null);
    }
  };

  // Remove extra angle image
  const handleRemoveGalleryImage = async (productId: string, imageUrl: string) => {
    try {
      const target = displayProducts.find((p) => p.id === productId);
      if (!target) return;
      const updatedAdditional = await removeProductGalleryImageApi(
        productId,
        imageUrl,
        target.additionalImages || []
      );
      if (onUpdateSingleProduct) {
        onUpdateSingleProduct({
          ...target,
          additionalImages: updatedAdditional,
        });
      }
      setSuccessMessage('Angle photo removed.');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setErrorMessage('Could not remove photo: ' + (err.message || err));
    }
  };

  // Create new bedsheet directly from Photo Studio
  const handleCreateNewSheetFromStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetName.trim() || !newSheetFile) {
      setErrorMessage('Please provide a bedsheet name and choose a photo.');
      return;
    }

    setIsCreatingSheet(true);
    setErrorMessage(null);
    try {
      setSuccessMessage('Uploading new bedsheet photo and creating item in Firebase...');
      const createdId = `bedsheet-${Date.now().toString(36)}`;
      const hostedUrl = await uploadImageApi(newSheetFile, createdId);

      const newProduct: BedsheetProduct = {
        id: createdId,
        name: newSheetName.trim(),
        collection: 'Signature Collection',
        price: Number(newSheetPrice) || 1499,
        originalPrice: Math.round((Number(newSheetPrice) || 1499) * 1.3),
        dimensions: '108 x 108 inches (274 x 274 cm)',
        pillowCovers: '2 Pillow Covers (45 x 70 cm)',
        threadCount: '350 Thread Count',
        fabric: '100% Pure Percale Cotton',
        pattern: 'Botanical Floral',
        colorTone: 'Ivory & Pastels',
        description: 'Pristine 100% pure cotton luxury bedsheet with matching pillow covers.',
        image: hostedUrl,
        additionalImages: [],
        variants: [],
        badge: 'New Photo',
        inStock: true,
        stockQuantity: 15,
        features: [
          'Expansive King size drop',
          'Includes 2 matching pillow shams',
          '100% pure breathable cotton',
          'Machine wash tested',
        ],
        updatedAt: Date.now(),
        order: 0,
      };

      if (onUpdateSingleProduct) {
        onUpdateSingleProduct(newProduct);
      }

      setSuccessMessage(`✓ "${newProduct.name}" created with custom photo!`);
      setIsAddingNewSheet(false);
      setNewSheetName('');
      setNewSheetFile(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to add new bedsheet: ${err.message || err}`);
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Bulk Upload
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    setSuccessMessage(`Processing ${files.length} photos with Cloudinary & Firebase...`);
    let successfulCount = 0;
    for (let index = 0; index < files.length; index++) {
      if (index < displayProducts.length) {
        const product = displayProducts[index];
        try {
          const serverUrl = await uploadImageApi(files[index], product.id);
          onUploadImage(product.id, serverUrl);
          successfulCount++;
        } catch (err: any) {
          console.error('Failed bulk photo:', err);
          setErrorMessage(`Bulk upload issue: ${err.message || 'Some photos could not be uploaded'}`);
        }
      }
    }

    const nextCount = totalUpdatedImagesCount + successfulCount;
    saveUpdatedImagesStatsApi(nextCount).catch(() => {});

    setSuccessMessage(`✓ Successfully uploaded ${successfulCount} photos to Cloudinary & Firebase!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2420]/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-[#FAF7F2] w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border border-[#EAE2D5] shadow-2xl z-10 flex flex-col">
        
        {/* Header with Prominent Updated Image Counter */}
        <div className="p-4 sm:p-6 border-b border-[#EAE2D5] bg-[#FAF7F2] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A8823B] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
              Photo Studio &amp; Image Memory
            </div>
            <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
              Custom Bedsheet Photos &amp; Image Gallery
            </h2>
            <p className="text-xs text-[#6B5D55] mt-0.5">
              Change existing photos, add multiple angle shots, or add new bedsheets. Permanent links are saved in Firebase &amp; Cloudinary.
            </p>

            {/* Persistent Image Memory Stats Banner */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300 shadow-2xs">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{totalUpdatedImagesCount} Updated Images Active</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#8C2E46]/10 text-[#8C2E46] text-xs font-semibold rounded-full border border-[#8C2E46]/20">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{customProductsCount} of {displayProducts.length} Bedsheets Customized ({completionPercentage}%)</span>
              </span>

              <span className="text-[11px] text-[#8C7A70] italic">
                (Synced &amp; remembered across devices)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNewSheet(!isAddingNewSheet)}
              className="px-3.5 py-2 bg-[#8C2E46] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingNewSheet ? 'Cancel' : 'Add New Photo / Sheet'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* New Bedsheet / Photo Upload Form (Collapsible) */}
        {isAddingNewSheet && (
          <form
            onSubmit={handleCreateNewSheetFromStudio}
            className="p-4 sm:p-5 bg-white border-b border-[#EAE2D5] space-y-3 animate-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#8C2E46]" />
                <span>Add a New Bedsheet with Custom Photo</span>
              </h3>
              <span className="text-[11px] text-[#7A6458]">Image link will be stored in Firestore &amp; hosted on Cloudinary</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                  Bedsheet Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharani Marigold Pink"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                  Selling Price (₹)
                </label>
                <input
                  type="number"
                  value={newSheetPrice}
                  onChange={(e) => setNewSheetPrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#8C7A70] uppercase block mb-1">
                  Select Photo File *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewSheetFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#7A6458] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#FAF7F2] file:text-[#8C2E46] hover:file:bg-[#FDEAF0]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNewSheet(false)}
                className="px-3 py-1.5 text-xs text-[#7A6458] hover:text-[#2C2420] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingSheet}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isCreatingSheet ? 'Uploading & Creating...' : 'Save & Add to Catalogue'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Bulk Upload Helper Banner */}
        <div className="bg-[#FDEAF0] px-4 sm:px-6 py-3 border-b border-[#FAD1DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#8C2E46]">
            <p className="font-semibold flex items-center gap-1.5">
              <Upload className="w-4 h-4 shrink-0" />
              Quick Batch: Select Multiple Photos from Gallery
            </p>
            <p className="text-[11px] text-[#A33452] mt-0.5">
              Choose several files together and they will upload in sequence and store links in Firebase automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3.5 py-2 bg-[#8C2E46] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5">
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
                className="px-3 py-2 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#7A6458] hover:text-[#2C2420] border border-[#EAE2D5] text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset all back to original stock photos"
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

        {/* Error alert message */}
        {errorMessage && (
          <div className="bg-red-50 text-red-700 px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b border-red-200 animate-in fade-in">
            <X className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Scrollable Bedsheets List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayProducts.map((product, idx) => {
              const hasCustom =
                !!customImages[product.id] ||
                isCloudinaryUrl(product.image) ||
                (typeof product.image === 'string' &&
                  !product.image.includes('exact_sheet') &&
                  !product.image.startsWith('/images/exact_'));

              const currentImage = resolveBedsheetImage(
                product.image || customImages[product.id],
                product.id,
                product.updatedAt
              );

              const additionalImages = product.additionalImages || [];
              const isUploadingThis = uploadingId === product.id || uploadingId === `gallery_${product.id}`;

              return (
                <div
                  key={product.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    hasCustom
                      ? 'border-[#B83F60] bg-[#FDEAF0]/30 shadow-xs'
                      : 'border-[#EAE2D5] bg-[#FAF7F2]'
                  }`}
                >
                  {/* Image Preview with Custom Indicator */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#F4EFE6] border border-[#EAE2D5] mb-2.5 group">
                    <img
                      src={currentImage}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      onError={handleImageFallback}
                      className="w-full h-full object-cover object-center"
                    />

                    {hasCustom ? (
                      <span className="absolute top-2 left-2 bg-[#2E7D46] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Custom Photo
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 bg-[#2C2420]/70 text-white text-[10px] font-medium px-2 py-0.5 rounded-md backdrop-blur-xs">
                        Catalog Stock
                      </span>
                    )}

                    <span className="absolute bottom-2 right-2 bg-[#2C2420]/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>

                    {isUploadingThis && (
                      <div className="absolute inset-0 bg-[#2C2420]/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold">
                        Uploading...
                      </div>
                    )}
                  </div>

                  {/* Product Title & Details */}
                  <h4 className="text-xs font-semibold text-[#2C2420] truncate mb-0.5">
                    {product.name}
                  </h4>
                  <p className="text-[11px] text-[#7A6458] mb-2.5">
                    ₹{product.price.toLocaleString('en-IN')} · 108×108 King
                  </p>

                  {/* Additional Gallery Angle Images Strip */}
                  {additionalImages.length > 0 && (
                    <div className="mb-2.5 p-2 bg-white rounded-xl border border-[#EAE2D5]">
                      <p className="text-[10px] font-semibold text-[#8C7A70] uppercase mb-1.5 flex items-center justify-between">
                        <span>Gallery Angles ({additionalImages.length})</span>
                      </p>
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {additionalImages.map((extraUrl, extraIdx) => (
                          <div
                            key={extraIdx}
                            className="relative w-11 h-11 rounded-lg overflow-hidden border border-[#EAE2D5] shrink-0 group/extra"
                          >
                            <img
                              src={resolveBedsheetImage(extraUrl, product.id)}
                              alt="Detail shot"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryImage(product.id, extraUrl)}
                              className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover/extra:opacity-100 transition-opacity cursor-pointer"
                              title="Delete this angle photo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Action Buttons: Change Primary Photo + Add Extra Photo */}
                  <div className="space-y-1.5">
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
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-[#FAF7F2] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#C29E57]" />
                        <span>{hasCustom ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>

                      {hasCustom && (
                        <button
                          type="button"
                          onClick={() => onResetImage(product.id)}
                          className="p-1.5 text-[#7A6458] hover:text-[#B83F60] hover:bg-white border border-[#EAE2D5] rounded-lg transition-colors cursor-pointer"
                          title="Reset to default photo"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Add extra angle / gallery image button */}
                    <input
                      type="file"
                      ref={(el) => { galleryInputRefs.current[product.id] = el; }}
                      onChange={(e) => handleAddGalleryImage(product.id, e.target.files?.[0])}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => galleryInputRefs.current[product.id]?.click()}
                      className="w-full py-1 px-2 bg-[#FAF7F2] hover:bg-white border border-dashed border-[#C29E57] text-[#8C2E46] text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#C29E57]" />
                      <span>+ Add Extra Angle / Detail Photo</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer with Summary */}
        <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-[#FAF7F2] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#7A6458]">
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>{totalUpdatedImagesCount} Images Remembered</strong> · Uploads host on Cloudinary CDN and links save in Firebase Firestore.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#8C2E46] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Done Viewing
          </button>
        </div>

      </div>
    </div>
  );
};
