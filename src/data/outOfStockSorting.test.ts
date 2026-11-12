import { test } from 'node:test';
import assert from 'node:assert';
import { sortProductsByStockAvailability, isProductOutOfStock } from './products';

test('isProductOutOfStock identifies out-of-stock products correctly', () => {
  assert.strictEqual(isProductOutOfStock({ inStock: true, stockQuantity: 10 }), false);
  assert.strictEqual(isProductOutOfStock({ inStock: false, stockQuantity: 10 }), true);
  assert.strictEqual(isProductOutOfStock({ inStock: true, stockQuantity: 0 }), true);
  assert.strictEqual(isProductOutOfStock({ inStock: false, stockQuantity: 0 }), true);
});

test('sortProductsByStockAvailability places In-Stock items before Out-of-Stock items', () => {
  const p1 = { id: 'p1', name: 'Sheet 1 (In Stock)', inStock: true, stockQuantity: 15, price: 1800 };
  const p2 = { id: 'p2', name: 'Sheet 2 (Out of Stock)', inStock: false, stockQuantity: 0, price: 2000 };
  const p3 = { id: 'p3', name: 'Sheet 3 (In Stock)', inStock: true, stockQuantity: 5, price: 1500 };
  const p4 = { id: 'p4', name: 'Sheet 4 (Out of Stock)', inStock: true, stockQuantity: 0, price: 2200 };

  const initialList = [p1, p2, p3, p4];
  const sorted = sortProductsByStockAvailability(initialList);

  // In-stock items (p1, p3) should be at indices 0 and 1
  assert.strictEqual(sorted[0].id, 'p1');
  assert.strictEqual(sorted[1].id, 'p3');

  // Out-of-stock items (p2, p4) should be pushed to the bottom at indices 2 and 3
  assert.strictEqual(sorted[2].id, 'p2');
  assert.strictEqual(sorted[3].id, 'p4');
});

test('sortProductsByStockAvailability restores product position when marked In Stock again', () => {
  const p1 = { id: 'p1', name: 'Sheet 1', inStock: true, stockQuantity: 10, price: 1000 };
  const p2 = { id: 'p2', name: 'Sheet 2', inStock: false, stockQuantity: 0, price: 2000 };

  // Phase 1: p2 is Out of Stock -> pushed to end
  const phase1 = sortProductsByStockAvailability([p1, p2]);
  assert.strictEqual(phase1[0].id, 'p1');
  assert.strictEqual(phase1[1].id, 'p2');

  // Phase 2: Admin restocks p2 (inStock: true, stockQuantity: 12)
  const p2Restocked = { ...p2, inStock: true, stockQuantity: 12 };

  const phase2 = sortProductsByStockAvailability([p1, p2Restocked]);
  // Both are in stock -> relative ordering is maintained
  assert.strictEqual(phase2[0].id, 'p1');
  assert.strictEqual(phase2[1].id, 'p2');
});

test('Secondary sorting applies within In-Stock and Out-of-Stock groups', () => {
  const p1 = { id: 'p1', name: 'In-Stock High Price', inStock: true, stockQuantity: 10, price: 3000 };
  const p2 = { id: 'p2', name: 'In-Stock Low Price', inStock: true, stockQuantity: 10, price: 1000 };
  const p3 = { id: 'p3', name: 'Out-of-Stock High Price', inStock: false, stockQuantity: 0, price: 4000 };
  const p4 = { id: 'p4', name: 'Out-of-Stock Low Price', inStock: false, stockQuantity: 0, price: 2000 };

  const list = [p1, p2, p3, p4];

  // Price Low to High
  const sortedPriceLow = sortProductsByStockAvailability(list, (a, b) => a.price - b.price);

  // In-stock group sorted by price low: p2 (1000), p1 (3000)
  assert.strictEqual(sortedPriceLow[0].id, 'p2');
  assert.strictEqual(sortedPriceLow[1].id, 'p1');

  // Out-of-Stock group sorted by price low: p4 (2000), p3 (4000)
  assert.strictEqual(sortedPriceLow[2].id, 'p4');
  assert.strictEqual(sortedPriceLow[3].id, 'p3');
});
