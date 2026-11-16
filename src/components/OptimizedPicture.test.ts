import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptimizedPicture } from './OptimizedPicture.tsx';

test('OptimizedPicture renders <picture> with WebP srcset and omits initial detached .jpg src on <img>', () => {
  const html = renderToStaticMarkup(
    React.createElement(OptimizedPicture, {
      src: '/images/exact_sheet1_pink_rose_1790997736396.jpg',
      alt: 'Gulabi Bagh Rose Pure Cotton Bedsheet',
      productId: 'gulabi-bagh-rose',
      sizes: '(max-width: 640px) 94vw, 390px',
      width: 800,
      height: 600,
      loading: 'lazy',
      decoding: 'async',
    })
  );

  assert.match(html, /^<picture class="contents">/);
  assert.match(html, /type="image\/webp"/);
  assert.match(
    html,
    /srcSet="\/images\/exact_sheet1_pink_rose_1790997736396-480w\.webp 480w, \/images\/exact_sheet1_pink_rose_1790997736396-768w\.webp 768w, \/images\/exact_sheet1_pink_rose_1790997736396\.webp 1200w"/i
  );
  // <img> must NOT have a static src attribute in initial markup before <picture> attachment
  assert.doesNotMatch(html, /<img[^>]*\ssrc="/i);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /width="800"/);
  assert.match(html, /height="600"/);
});

test('OptimizedPicture renders Cloudinary <picture> with f_auto,q_auto,c_limit,w_* responsive srcset', () => {
  const html = renderToStaticMarkup(
    React.createElement(OptimizedPicture, {
      src: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1740000000/cotton_nest/custom_sheet.jpg',
      alt: 'Custom Atelier Sheet',
      sizes: '(max-width: 640px) 94vw, 390px',
      targetWidth: 650,
      cloudinaryWidths: [400, 650, 960],
      width: 800,
      height: 600,
    })
  );

  assert.match(html, /^<picture class="contents">/);
  assert.match(html, /f_auto,q_auto,c_limit,w_400\/v1740000000\/cotton_nest\/custom_sheet\.jpg 400w/);
  assert.match(html, /f_auto,q_auto,c_limit,w_650\/v1740000000\/cotton_nest\/custom_sheet\.jpg 650w/);
  assert.match(html, /f_auto,q_auto,c_limit,w_960\/v1740000000\/cotton_nest\/custom_sheet\.jpg 960w/);
  assert.doesNotMatch(html, /<img[^>]*\ssrc="/i);
});

test('OptimizedPicture keeps data URLs and non-catalog external URLs as plain <img>', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const html = renderToStaticMarkup(
    React.createElement(OptimizedPicture, {
      src: dataUrl,
      alt: 'Inline Preview',
      width: 100,
      height: 100,
    })
  );

  assert.doesNotMatch(html, /<picture/);
  assert.match(html, /<img[^>]*src="data:image\/png;base64,iVBORw0KGgo="/);
});
