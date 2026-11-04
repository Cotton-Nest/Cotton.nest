import test from 'node:test';
import assert from 'node:assert/strict';
import { isVideoMedia, getProductGalleryMedia, getProductMediaCounts } from './mediaHelpers';

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
