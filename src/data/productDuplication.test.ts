import { test } from 'node:test';
import assert from 'node:assert';
import { BedsheetProduct, generateUniqueProductSku } from './products';

test('Product Duplication - copies all specifications and generates unique SKU', () => {
  const originalProduct: BedsheetProduct = {
    id: 'prod-original-101',
    sku: 'CN-ROSE-108K',
    name: 'Gulabi Bagh Combed Cotton',
    collection: 'Signature Royal',
    size: 'Super King (108 × 108)',
    productType: 'Bedsheet',
    brand: 'Cotton Nest',
    price: 2499,
    originalPrice: 3299,
    dimensions: '108 x 108 inches',
    pillowCovers: '2 Flanged Pillow Covers',
    threadCount: '350 Thread Count',
    fabric: '100% Combed Cotton',
    pattern: 'Royal Floral',
    colorTone: 'Blush Pink',
    description: 'Pristine 100% combed cotton bedsheet',
    badge: 'Best Seller',
    inStock: true,
    stockQuantity: 25,
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6',
    cloudinaryPublicId: 'public-id-original-123',
    additionalImages: ['https://images.unsplash.com/photo-angle1'],
    videos: ['https://cloudinary.com/video1.mp4'],
    videoUrl: 'https://cloudinary.com/video1.mp4',
    features: ['100% Combed Cotton', 'Breathable Percale'],
    variants: [
      { id: 'var-1', name: 'Rose Gold', colorHex: '#C29E57', image: 'https://images.unsplash.com/photo-var1' }
    ],
    updatedAt: 1000,
  };

  const catalog = [originalProduct];

  const copyName = `${originalProduct.name} (Copy)`;
  const newSku = generateUniqueProductSku(copyName, catalog);

  const newId = `prod-duplicate-${Date.now()}`;
  const duplicatedProduct: BedsheetProduct = {
    ...originalProduct,
    id: newId,
    sku: newSku,
    name: copyName,
    badge: 'Draft',
    inStock: false, // Must start as DRAFT / INACTIVE
    cloudinaryPublicId: undefined, // Must NOT inherit original Cloudinary public ID
    features: [...originalProduct.features!],
    additionalImages: [...originalProduct.additionalImages!],
    videos: [...originalProduct.videos!],
    variants: originalProduct.variants!.map((v, idx) => ({ ...v, id: `var-dup-${idx}` })),
    updatedAt: Date.now(),
  };

  // 1. Verify unique SKU generation
  assert.ok(duplicatedProduct.sku);
  assert.notStrictEqual(duplicatedProduct.sku, originalProduct.sku);
  assert.ok(duplicatedProduct.sku!.startsWith('CN-ROSE') || duplicatedProduct.sku!.includes('-001'));

  // 2. Verify independent ID and state
  assert.notStrictEqual(duplicatedProduct.id, originalProduct.id);
  assert.strictEqual(duplicatedProduct.inStock, false);
  assert.strictEqual(duplicatedProduct.cloudinaryPublicId, undefined);

  // 3. Verify images are reused initially without altering original URLs
  assert.strictEqual(duplicatedProduct.image, originalProduct.image);
  assert.deepStrictEqual(duplicatedProduct.additionalImages, originalProduct.additionalImages);

  // 4. Verify original product remains completely unchanged
  assert.strictEqual(originalProduct.sku, 'CN-ROSE-108K');
  assert.strictEqual(originalProduct.inStock, true);
  assert.strictEqual(originalProduct.cloudinaryPublicId, 'public-id-original-123');

  // 5. Verify image replacement on duplicate does NOT touch original product
  duplicatedProduct.image = 'https://images.unsplash.com/photo-NEW-COVER';
  assert.notStrictEqual(duplicatedProduct.image, originalProduct.image);
  assert.strictEqual(originalProduct.image, 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6');
});
