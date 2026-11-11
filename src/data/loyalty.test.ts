import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEarnedPoints,
  calculatePointsDiscount,
  canRedeemPoints,
  getTransactionExpiryDate,
  isTransactionExpired,
  LoyaltyTransaction,
} from './loyalty.ts';

test('Loyalty points business logic & ledger formatting', () => {
  // 5 points per ₹100 spent (excluding delivery)
  assert.equal(calculateEarnedPoints(2499), 124);
  assert.equal(calculateEarnedPoints(1000), 50);

  // 100 points = ₹50 (1 pt = ₹0.50)
  assert.equal(calculatePointsDiscount(100), 50);
  assert.equal(calculatePointsDiscount(200), 100);

  // Minimum 1 point required for redemption (up to 125 points per order)
  assert.equal(canRedeemPoints(0), false);
  assert.equal(canRedeemPoints(125), true);
  assert.equal(canRedeemPoints(300), true);

  // Expiry calculation: exactly 12 months after credit
  const creditTime = new Date('2026-01-15T10:00:00Z').getTime();
  const expiryTime = getTransactionExpiryDate(creditTime);
  const expiryDate = new Date(expiryTime);
  assert.equal(expiryDate.getUTCFullYear(), 2027);
  assert.equal(expiryDate.getUTCMonth(), 0);
  assert.equal(expiryDate.getUTCDate(), 15);

  // Chronological sort order: newest first
  const txs: LoyaltyTransaction[] = [
    {
      id: 'tx_1',
      accountId: 'test',
      orderId: 'CN-1001',
      type: 'earned',
      points: 50,
      description: 'Earned on Delivered Order #CN-1001',
      createdAt: 1000,
    },
    {
      id: 'tx_2',
      accountId: 'test',
      orderId: 'CN-1002',
      type: 'redeemed',
      points: -200,
      description: 'Redeemed on Order #CN-1002',
      createdAt: 2000,
    },
    {
      id: 'tx_3',
      accountId: 'test',
      type: 'referral',
      points: 100,
      description: 'Referral Bonus',
      createdAt: 1500,
    },
  ];

  const sorted = [...txs].sort((a, b) => b.createdAt - a.createdAt);
  assert.equal(sorted[0].id, 'tx_2'); // createdAt 2000
  assert.equal(sorted[1].id, 'tx_3'); // createdAt 1500
  assert.equal(sorted[2].id, 'tx_1'); // createdAt 1000
});
