import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHEET_IMAGE,
  PRODUCT_DEFAULT_IMAGES,
  STORY_ATELIER_SEAL_JPG,
  STORY_ATELIER_SEAL_WEBP,
  getCloudinaryLogoSrcSet,
  getCloudinaryLogoUrl,
  getCloudinarySrcSet,
  getLocalImageVariants,
  isCloudinaryImageUploadUrl,
  optimizeCloudinaryImageUrl,
  resolveBedsheetImage,
} from './imageUrl.ts';

test('getCloudinaryLogoUrl produces properly constrained transparent logo URLs', () => {
  const url128 = getCloudinaryLogoUrl(128);
  assert.equal(
    url128,
    'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_128/logo-removebg-preview.png'
  );
  const srcSet = getCloudinaryLogoSrcSet();
  assert.match(srcSet, /w_64\/logo-removebg-preview\.png 64w/);
  assert.match(srcSet, /w_128\/logo-removebg-preview\.png 128w/);
});

test('optimizeCloudinaryImageUrl transforms Cloudinary image URLs and skips video/non-Cloudinary URLs', () => {
  assert.equal(
    isCloudinaryImageUploadUrl('https://res.cloudinary.com/ys2sgydi/image/upload/v1740000000/cotton_nest/sheet1.jpg'),
    true
  );
  assert.equal(
    isCloudinaryImageUploadUrl('https://res.cloudinary.com/ys2sgydi/video/upload/v1740000000/cotton_nest/reel.mp4'),
    false
  );
  assert.equal(
    isCloudinaryImageUploadUrl('/images/exact_sheet1_pink_rose_1790997736396.jpg'),
    false
  );

  // Raw uploaded image URL gets f_auto,q_auto,c_limit,w_650
  const optimizedRaw = optimizeCloudinaryImageUrl(
    'https://res.cloudinary.com/ys2sgydi/image/upload/v1740000000/cotton_nest/sheet1.jpg',
    650
  );
  assert.equal(
    optimizedRaw,
    'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_650/v1740000000/cotton_nest/sheet1.jpg'
  );

  // URL that already contains f_auto/q_auto avoids duplicate transforms and replaces width cleanly
  const optimizedPrefixed = optimizeCloudinaryImageUrl(
    'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/w_1600/v1740000000/cotton_nest/sheet2.png',
    400
  );
  assert.equal(
    optimizedPrefixed,
    'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_400/v1740000000/cotton_nest/sheet2.png'
  );

  // Video URLs are untouched
  const videoUrl = 'https://res.cloudinary.com/ys2sgydi/video/upload/v1740000000/cotton_nest/reel.mp4';
  assert.equal(optimizeCloudinaryImageUrl(videoUrl, 650), videoUrl);
});

test('getCloudinarySrcSet builds responsive width candidates cleanly', () => {
  const srcSet = getCloudinarySrcSet(
    'https://res.cloudinary.com/ys2sgydi/image/upload/v1740000000/cotton_nest/sheet1.jpg',
    [400, 650, 960]
  );
  assert.equal(
    srcSet,
    [
      'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_400/v1740000000/cotton_nest/sheet1.jpg 400w',
      'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_650/v1740000000/cotton_nest/sheet1.jpg 650w',
      'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto,q_auto,c_limit,w_960/v1740000000/cotton_nest/sheet1.jpg 960w',
    ].join(', ')
  );
});

test('getLocalImageVariants maps Hero, Sheets, Banners, and Story Atelier Seal to WebP srcset + JPG fallback', () => {
  const hero = getLocalImageVariants('/images/hero_cotton_nest_bedding_1790996973951.jpg');
  assert.equal(hero.isKnownLocalAsset, true);
  assert.equal(
    hero.webpSrcSet,
    '/images/hero_cotton_nest_bedding_1790996973951-480w.webp 480w, /images/hero_cotton_nest_bedding_1790996973951-768w.webp 768w, /images/hero_cotton_nest_bedding_1790996973951.webp 1376w'
  );
  assert.equal(hero.fallbackSrc, '/images/hero_cotton_nest_bedding_1790996973951.jpg');

  // Handles cottonnest.in origin and query strings
  const sheetWithOriginAndQuery = getLocalImageVariants(
    'https://cottonnest.in/images/exact_sheet1_pink_rose_1790997736396.jpg?v=123'
  );
  assert.equal(sheetWithOriginAndQuery.isKnownLocalAsset, true);
  assert.equal(
    sheetWithOriginAndQuery.webpSrcSet,
    '/images/exact_sheet1_pink_rose_1790997736396-480w.webp 480w, /images/exact_sheet1_pink_rose_1790997736396-768w.webp 768w, /images/exact_sheet1_pink_rose_1790997736396.webp 1200w'
  );
  assert.equal(sheetWithOriginAndQuery.fallbackSrc, '/images/exact_sheet1_pink_rose_1790997736396.jpg');

  const banner = getLocalImageVariants('/images/banners/welcome-floral.jpg');
  assert.equal(banner.isKnownLocalAsset, true);
  assert.equal(
    banner.webpSrcSet,
    '/images/banners/welcome-floral-640w.webp 640w, /images/banners/welcome-floral.webp 1376w'
  );
  assert.equal(banner.fallbackSrc, '/images/banners/welcome-floral.jpg');

  const seal = getLocalImageVariants('/assets/aistudio/IMG-20261106-WA0032_3f856e9c.jpg');
  assert.equal(seal.isKnownLocalAsset, true);
  assert.equal(seal.webpSrcSet, `${STORY_ATELIER_SEAL_WEBP} 128w`);
  assert.equal(seal.fallbackSrc, STORY_ATELIER_SEAL_JPG);

  // Unknown upload URL does not fabricate non-existent WebP paths
  const dynamicUpload = getLocalImageVariants('/uploads/sheet_custom_123.jpg');
  assert.equal(dynamicUpload.isKnownLocalAsset, false);
  assert.equal(dynamicUpload.webpSrcSet, undefined);
  assert.equal(dynamicUpload.fallbackSrc, '/uploads/sheet_custom_123.jpg');
});

test('resolveBedsheetImage recovers empty paths to product catalog defaults', () => {
  assert.equal(
    resolveBedsheetImage('', 'mint-meadow-sage'),
    PRODUCT_DEFAULT_IMAGES['mint-meadow-sage']
  );
  assert.equal(resolveBedsheetImage(null, 'unknown-id'), DEFAULT_SHEET_IMAGE);
});
