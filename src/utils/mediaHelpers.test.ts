import test from 'node:test';
import assert from 'node:assert/strict';
import { isVideoMedia, getProductGalleryMedia, getProductMediaCounts } from './mediaHelpers';
import {
  STANDARD_PRODUCT_TYPES,
  normalizeProductCategory,
  matchesProductCategory,
  doesProductMatchCategory,
  BEDSHEETS_CATALOG,
} from '../data/products';
import { ACROSS_INDIA_SHIPPING_FEE_INR, normalizeShippingInTerms, INITIAL_SITE_CONTENT } from '../data/siteContent';
import { INITIAL_COMMENTS } from '../data/comments';

test('isVideoMedia identifies video URLs, Cloudinary video paths, and data URIs accurately', () => {
  assert.equal(isVideoMedia('https://res.cloudinary.com/demo/video/upload/v1/sample.mp4'), true);
  assert.equal(isVideoMedia('https://cdn.example.com/drape_showcase.webm?v=123'), true);
  assert.equal(isVideoMedia('/uploads/sheet_gulabi_12345.mov'), true);
  assert.equal(isVideoMedia('data:video/mp4;base64,AAAA'), true);
  assert.equal(isVideoMedia('/images/exact_sheet1_pink_rose_1790997736396.jpg'), false);
  assert.equal(isVideoMedia('https://res.cloudinary.com/demo/image/upload/v1/sheet.jpg'), false);
  assert.equal(isVideoMedia(''), false);
  assert.equal(isVideoMedia(null), false);
});

test('getProductGalleryMedia merges and deduplicates additionalImages, videos, and videoUrl', () => {
  const product = {
    id: 'test-sheet',
    image: '/images/sheet1.jpg',
    additionalImages: ['/images/angle1.jpg', 'https://cdn.example.com/reel.mp4'],
    videos: ['https://cdn.example.com/reel.mp4', 'https://cdn.example.com/closeup.webm'],
    videoUrl: 'https://cdn.example.com/drape.mov',
  };

  const gallery = getProductGalleryMedia(product);
  assert.deepEqual(gallery, [
    '/images/angle1.jpg',
    'https://cdn.example.com/reel.mp4',
    'https://cdn.example.com/closeup.webm',
    'https://cdn.example.com/drape.mov',
  ]);
});

test('getProductMediaCounts calculates photoCount, videoCount, and firstVideoUrl accurately', () => {
  const product = {
    id: 'test-sheet',
    image: '/images/sheet1.jpg',
    additionalImages: ['/images/angle1.jpg', 'https://cdn.example.com/reel.mp4'],
    variants: [
      { id: 'v1', name: 'Rose', image: '/images/rose.jpg' },
      { id: 'v2', name: 'Sage Video', image: '/uploads/sage_video.mp4' },
    ],
  };

  const counts = getProductMediaCounts(product);
  assert.equal(counts.photoCount, 3); // 1 cover + 1 angle photo + 1 variant photo
  assert.equal(counts.videoCount, 2); // 1 angle video + 1 variant video
  assert.equal(counts.totalCount, 5);
  assert.equal(counts.hasVideo, true);
  assert.equal(counts.firstVideoUrl, 'https://cdn.example.com/reel.mp4');
});

test('STANDARD_PRODUCT_TYPES includes Winter Bedsheet, Dohar, Bed Cover, and Quilt', () => {
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Bedsheet'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Winter Bedsheet'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Dohar'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Bed Cover'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Quilt'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Blanket'));
  assert.ok(STANDARD_PRODUCT_TYPES.includes('Comforter'));
});

test('normalizeProductCategory and doesProductMatchCategory match singular/plural and keyword categories', () => {
  assert.equal(normalizeProductCategory('Winter Bedsheets'), 'Winter Bedsheet');
  assert.equal(normalizeProductCategory('flannel winter sheet'), 'Winter Bedsheet');
  assert.equal(normalizeProductCategory('Dohars'), 'Dohar');
  assert.equal(normalizeProductCategory('Bed Covers'), 'Bed Cover');
  assert.equal(normalizeProductCategory('Jaipuri Razai Quilt'), 'Quilt');

  const sampleBase = BEDSHEETS_CATALOG[0];
  const winterProd = { ...sampleBase, productType: 'Winter Bedsheet' as const };
  const doharProd = { ...sampleBase, productType: 'Dohar' as const };
  const bedCoverProd = { ...sampleBase, productType: 'Bed Cover' as const };
  const quiltProd = { ...sampleBase, productType: 'Quilt' as const };

  assert.equal(doesProductMatchCategory(winterProd, 'Winter Bedsheet'), true);
  assert.equal(doesProductMatchCategory(winterProd, 'Winter Bedsheets'), true);
  assert.equal(doesProductMatchCategory(winterProd, 'Bedsheet'), false);
  assert.equal(doesProductMatchCategory(doharProd, 'Dohar'), true);
  assert.equal(doesProductMatchCategory(bedCoverProd, 'Bed Cover'), true);
  assert.equal(doesProductMatchCategory(quiltProd, 'Quilt'), true);
  assert.equal(matchesProductCategory('Winter Bedsheet', 'Winter Bedsheets'), true);
});

test('shipping fee across India is strictly ₹29 and never ₹100 in siteContent, T&C, or comments', () => {
  assert.equal(ACROSS_INDIA_SHIPPING_FEE_INR, 29);
  assert.equal(INITIAL_SITE_CONTENT.termsAndConditions.includes('₹29'), true);
  assert.equal(INITIAL_SITE_CONTENT.termsAndConditions.includes('₹100'), false);

  const legacyTc1 = '👉 Across India: *₹100*';
  assert.equal(normalizeShippingInTerms(legacyTc1), '👉 Across India: *₹29*');

  const legacyTc2 = 'Rest of India\n• Shipping charges shall be levied as applicable at the time of order placement.';
  assert.equal(normalizeShippingInTerms(legacyTc2).includes('₹29'), true);

  for (const comment of INITIAL_COMMENTS) {
    if (comment.reply?.text) {
      assert.equal(comment.reply.text.includes('₹100'), false);
    }
  }
});
