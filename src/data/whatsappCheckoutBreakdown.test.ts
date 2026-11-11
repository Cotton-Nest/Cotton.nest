import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCentralizedCheckoutBreakdown,
  DEFAULT_WELCOME_OFFER_CONFIG,
  formatRupeeAmount,
} from './welcomeOffer';
import { sendWhatsAppCartOrder } from '../utils/whatsappOrder';

test('Scenario 1: No discount applied', () => {
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2000,
    shippingCost: 0,
    selectedBenefit: 'none',
    availableNestPoints: 0,
  });

  assert.equal(breakdown.productSubtotal, 2000);
  assert.equal(breakdown.welcomeOfferApplied, false);
  assert.equal(breakdown.welcomeDiscount, 0);
  assert.equal(breakdown.pointsDiscount, 0);
  assert.equal(breakdown.couponDiscount, 0);
  assert.equal(breakdown.totalDiscount, 0);
  assert.equal(breakdown.finalPayableAmount, 2000);
});

test('Scenario 2: Welcome 10% applied with ₹200 cap', () => {
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2400,
    shippingCost: 0,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 400,
    config: DEFAULT_WELCOME_OFFER_CONFIG,
  });

  assert.equal(breakdown.welcomeOfferApplied, true);
  assert.equal(breakdown.welcomeDiscount, 200); // 10% of 2400 = 240 capped at 200
  assert.equal(breakdown.pointsDiscount, 0); // Nest Points must not be redeemed
  assert.equal(breakdown.pointsEarned, 0); // Zero points earned with Welcome Offer
  assert.equal(breakdown.totalDiscount, 200);
  assert.equal(breakdown.finalPayableAmount, 2200);
});

test('Scenario 3: Nest Points redeemed (respecting max redemption limit of 125 pts)', () => {
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2400,
    shippingCost: 0,
    selectedBenefit: 'nest_points',
    isCustomerEligibleForWelcome: false,
    availableNestPoints: 200, // Capped at LOYALTY_MAX_REDEMPTION_POINTS (125 pts = ₹62.50)
  });

  assert.equal(breakdown.welcomeOfferApplied, false);
  assert.equal(breakdown.welcomeDiscount, 0);
  assert.equal(breakdown.pointsRedeemed, 125);
  assert.equal(breakdown.pointsDiscount, 62.5);
  assert.equal(breakdown.totalDiscount, 62.5);
  assert.equal(breakdown.finalPayableAmount, 2337.5);
});

test('Scenario 4: Different coupon applied', () => {
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2000,
    shippingCost: 0,
    selectedBenefit: 'coupon',
    couponCode: 'FESTIVE150',
    couponDiscountAmount: 150,
    availableNestPoints: 200,
  });

  assert.equal(breakdown.welcomeOfferApplied, false);
  assert.equal(breakdown.pointsDiscount, 0);
  assert.equal(breakdown.couponCode, 'FESTIVE150');
  assert.equal(breakdown.couponDiscount, 150);
  assert.equal(breakdown.totalDiscount, 150);
  assert.equal(breakdown.finalPayableAmount, 1850);
});

test('Scenario 5: Welcome Offer removed immediately restores full payable amount', () => {
  // Step A: Applied
  const applied = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2400,
    shippingCost: 0,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });
  assert.equal(applied.welcomeDiscount, 200);
  assert.equal(applied.finalPayableAmount, 2200);

  // Step B: Removed
  const removed = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2400,
    shippingCost: 0,
    selectedBenefit: 'none',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });
  assert.equal(removed.welcomeDiscount, 0);
  assert.equal(removed.totalDiscount, 0);
  assert.equal(removed.finalPayableAmount, 2400);
});

test('Scenario 6: Nest Points removed immediately restores full payable amount', () => {
  // Step A: Points selected
  const withPoints = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2000,
    shippingCost: 0,
    selectedBenefit: 'nest_points',
    availableNestPoints: 200,
  });
  assert.equal(withPoints.pointsDiscount, 62.5);
  assert.equal(withPoints.finalPayableAmount, 1937.5);

  // Step B: Points unselected
  const withoutPoints = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2000,
    shippingCost: 0,
    selectedBenefit: 'none',
    availableNestPoints: 200,
  });
  assert.equal(withoutPoints.pointsDiscount, 0);
  assert.equal(withoutPoints.finalPayableAmount, 2000);
});

test('Scenario 7: Multiple products with different original and selling prices', () => {
  // Product 1: MRP 1,500, Selling 1,200, Qty 2 -> Original: 3,000, Selling: 2,400
  // Product 2: MRP 1,000, Selling 1,000, Qty 1 -> Original: 1,000, Selling: 1,000
  const items = [
    { name: 'Gulabi Bagh', originalPrice: 1500, price: 1200, qty: 2 },
    { name: 'Sage Mint', originalPrice: 1000, price: 1000, qty: 1 },
  ];

  const originalProductPrice = items.reduce((s, i) => s + i.originalPrice * i.qty, 0); // 4000
  const discountedProductSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0);    // 3400
  const catalogSavings = originalProductPrice - discountedProductSubtotal;             // 600

  assert.equal(originalProductPrice, 4000);
  assert.equal(discountedProductSubtotal, 3400);
  assert.equal(catalogSavings, 600);

  // Apply Welcome Offer on selling price subtotal
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: discountedProductSubtotal,
    shippingCost: 29,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });

  const totalSavings = catalogSavings + breakdown.totalDiscount; // 600 + 200 = 800
  const finalPayable = breakdown.finalPayableAmount; // 3400 - 200 + 29 = 3229

  assert.equal(breakdown.welcomeDiscount, 200);
  assert.equal(totalSavings, 800);
  assert.equal(finalPayable, 3229);

  // Mathematical integrity: Original (4000) - Total Savings (800) + Shipping (29) === Final Payable (3229)
  assert.equal(originalProductPrice - totalSavings + 29, finalPayable);
});

test('Scenario 8: Product quantity changed dynamically recalculates all price breakdown totals', () => {
  // Qty = 1
  const b1 = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1300,
    shippingCost: 0,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });
  assert.equal(b1.welcomeDiscount, 130); // 10% of 1300 = 130
  assert.equal(b1.finalPayableAmount, 1170);

  // Qty updated to 2
  const b2 = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2600,
    shippingCost: 0,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });
  assert.equal(b2.welcomeDiscount, 200); // 10% of 2600 capped at 200
  assert.equal(b2.finalPayableAmount, 2400);
});

test('Scenario 9: Final payable amount strictly matches WhatsApp message and button amount', async () => {
  const subtotal = 2400;
  const shippingCost = 29;
  const breakdown = calculateCentralizedCheckoutBreakdown({
    productSubtotal: subtotal,
    shippingCost,
    selectedBenefit: 'welcome_offer',
    isCustomerEligibleForWelcome: true,
    availableNestPoints: 0,
  });

  const finalTotal = breakdown.finalPayableAmount; // 2400 - 200 + 29 = 2229
  assert.equal(finalTotal, 2229);

  const message = await sendWhatsAppCartOrder({
    orderId: 'CN-TEST-WA-01',
    customerName: 'Aditi Sharma',
    customerPhone: '9876543210',
    customerAddress: 'House 42, Sector 46, Gurgaon',
    subtotal,
    finalTotal,
    totalSavings: 200,
    benefitType: 'welcome_offer',
    welcomeOfferApplied: true,
    welcomeDiscount: 200,
    shippingMethod: 'Across India Delivery (₹29)',
    shippingCost,
    items: [
      {
        name: 'Gulabi Bagh Jaipuri Bedsheet',
        quantity: 1,
        price: 2400,
        dimensions: '108 x 108 inches',
        imageUrl: 'https://example.com/bedsheet.jpg',
      },
    ],
  });

  // Check that the WhatsApp message contains the exact Final Total
  assert.ok(
    message.includes('Final Total: ₹2,229'),
    `Message should contain exact formatted final total, got: ${message}`
  );
  assert.ok(
    message.includes('Bag Subtotal: ₹2,400'),
    'Message should contain correct subtotal'
  );
  assert.ok(
    message.includes('10% OFF): -₹200'),
    'Message should contain correct Welcome Offer discount'
  );
  assert.ok(
    message.includes('Shipping: +₹29'),
    'Message should contain correct shipping fee'
  );
});
