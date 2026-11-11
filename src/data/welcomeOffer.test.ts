import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWelcomeOfferDiscount,
  evaluateCustomerWelcomeEligibility,
  calculateCentralizedCheckoutBreakdown,
  formatRupeeAmount,
  DEFAULT_WELCOME_OFFER_CONFIG,
  WelcomeOfferCustomerRecord,
} from './welcomeOffer.ts';
import type { Order } from './orders.ts';

test('Welcome Offer discount calculation table & precision (MIN(ROUND(Subtotal * 10%, 2), 200))', () => {
  // 1. ₹999 -> Not eligible -> ₹0 discount -> ₹999 payable
  const case999 = calculateWelcomeOfferDiscount(999);
  assert.equal(case999.meetsMinOrder, false);
  assert.equal(case999.discountAmount, 0);
  assert.equal(case999.shortfallAmount, 300);

  // 2. ₹1,299 -> ₹129.90 discount -> ₹1,169.10 payable
  const case1299 = calculateWelcomeOfferDiscount(1299);
  assert.equal(case1299.meetsMinOrder, true);
  assert.equal(case1299.discountAmount, 129.9);
  assert.equal(formatRupeeAmount(case1299.discountAmount), '129.90');
  assert.equal(Math.round((1299 - case1299.discountAmount) * 100) / 100, 1169.1);
  assert.equal(formatRupeeAmount(1299 - case1299.discountAmount), '1,169.10');

  // 3. ₹1,500 -> ₹150 discount -> ₹1,350 payable
  const case1500 = calculateWelcomeOfferDiscount(1500);
  assert.equal(case1500.meetsMinOrder, true);
  assert.equal(case1500.discountAmount, 150);
  assert.equal(1500 - case1500.discountAmount, 1350);

  // 4. ₹1,999 -> ₹199.90 discount -> ₹1,799.10 payable
  const case1999 = calculateWelcomeOfferDiscount(1999);
  assert.equal(case1999.meetsMinOrder, true);
  assert.equal(case1999.discountAmount, 199.9);
  assert.equal(formatRupeeAmount(case1999.discountAmount), '199.90');
  assert.equal(Math.round((1999 - case1999.discountAmount) * 100) / 100, 1799.1);
  assert.equal(formatRupeeAmount(1999 - case1999.discountAmount), '1,799.10');

  // 5. ₹2,000 -> ₹200 discount -> ₹1,800 payable
  const case2000 = calculateWelcomeOfferDiscount(2000);
  assert.equal(case2000.meetsMinOrder, true);
  assert.equal(case2000.discountAmount, 200);
  assert.equal(2000 - case2000.discountAmount, 1800);

  // 6. ₹3,500 -> ₹200 cap -> ₹3,300 payable
  const case3500 = calculateWelcomeOfferDiscount(3500);
  assert.equal(case3500.meetsMinOrder, true);
  assert.equal(case3500.discountAmount, 200);
  assert.equal(3500 - case3500.discountAmount, 3300);
});

test('Delivery charges are strictly excluded from minimum order and discount calculations', () => {
  const eligibleCustomer = evaluateCustomerWelcomeEligibility({
    userId: 'uid_new_customer_1',
    authProvider: 'google',
    email: 'newcustomer@example.com',
    orders: [],
  });
  assert.equal(eligibleCustomer.eligible, true);

  // Subtotal ₹1,200 + ₹150 delivery = ₹1,350 total, but product subtotal is below ₹1,299
  const breakdownBelowMin = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1200,
    shippingCost: 150,
    eligibility: eligibleCustomer,
    availableNestPoints: 0,
    selectedBenefit: 'welcome_offer',
  });

  assert.equal(breakdownBelowMin.welcomeOfferApplied, false);
  assert.equal(breakdownBelowMin.welcomeDiscount, 0);
  assert.equal(breakdownBelowMin.finalTotal, 1350);

  // Subtotal ₹1,299 + ₹100 delivery -> discount is 10% of ₹1,299 (₹129.90), not ₹1,399
  const breakdownAtMin = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1299,
    shippingCost: 100,
    eligibility: eligibleCustomer,
    availableNestPoints: 0,
    selectedBenefit: 'welcome_offer',
  });

  assert.equal(breakdownAtMin.welcomeOfferApplied, true);
  assert.equal(breakdownAtMin.welcomeDiscount, 129.9);
  assert.equal(breakdownAtMin.netMerchandiseAmount, 1169.1);
  assert.equal(breakdownAtMin.finalTotal, 1269.1);
});

test('Customer eligibility verification, reservation locking, and cancellation restoration', () => {
  // 1. Guest user -> ineligible
  const guestResult = evaluateCustomerWelcomeEligibility({
    userId: null,
    authProvider: null,
    orders: [],
  });
  assert.equal(guestResult.eligible, false);
  assert.equal(guestResult.status, 'ineligible_not_google_auth');

  // 2. Non-Google user -> ineligible
  const phoneAuthResult = evaluateCustomerWelcomeEligibility({
    userId: 'uid_phone_1',
    authProvider: 'phone',
    orders: [],
  });
  assert.equal(phoneAuthResult.eligible, false);
  assert.equal(phoneAuthResult.status, 'ineligible_not_google_auth');

  // 3. New Google user with no orders -> eligible
  const newGoogleUser = evaluateCustomerWelcomeEligibility({
    userId: 'uid_google_1',
    authProvider: 'google',
    email: 'firsttime@example.com',
    phone: '9876543210',
    orders: [],
  });
  assert.equal(newGoogleUser.eligible, true);
  assert.equal(newGoogleUser.status, 'eligible');

  // 4. Customer with an active pending/confirmed Welcome Offer order -> reserved (blocks second simultaneous order)
  const pendingWelcomeOrder: Order = {
    id: 'CN-PEND-1',
    userId: 'uid_google_1',
    customerName: 'Priya Sharma',
    customerPhone: '9876543210',
    customerEmail: 'firsttime@example.com',
    customerAddress: 'Sector 46, Gurgaon',
    items: [],
    subtotal: 1500,
    shippingCost: 0,
    totalAmount: 1350,
    totalSavings: 150,
    paymentMethod: 'upi',
    status: 'pending',
    benefitType: 'welcome_offer',
    welcomeOfferApplied: true,
    welcomeDiscount: 150,
    pointsEarned: 0,
    pointsUsed: 0,
    pointsDiscount: 0,
    createdAt: new Date().toISOString(),
  };

  const reservedCheck = evaluateCustomerWelcomeEligibility({
    userId: 'uid_google_1',
    authProvider: 'google',
    email: 'firsttime@example.com',
    phone: '9876543210',
    orders: [pendingWelcomeOrder],
  });
  assert.equal(reservedCheck.eligible, false);
  assert.equal(reservedCheck.status, 'reserved');
  assert.equal(reservedCheck.reservedOrderId, 'CN-PEND-1');

  // 5. If that order is cancelled -> customer eligibility is restored!
  const cancelledWelcomeOrder: Order = {
    ...pendingWelcomeOrder,
    status: 'cancelled',
  };
  const restoredCheck = evaluateCustomerWelcomeEligibility({
    userId: 'uid_google_1',
    authProvider: 'google',
    email: 'firsttime@example.com',
    phone: '9876543210',
    orders: [cancelledWelcomeOrder],
  });
  assert.equal(restoredCheck.eligible, true);
  assert.equal(restoredCheck.status, 'eligible');

  // 6. Once any order is delivered -> permanently ineligible / redeemed
  const deliveredOrder: Order = {
    ...pendingWelcomeOrder,
    status: 'delivered',
  };
  const redeemedCheck = evaluateCustomerWelcomeEligibility({
    userId: 'uid_google_1',
    authProvider: 'google',
    email: 'firsttime@example.com',
    phone: '9876543210',
    orders: [deliveredOrder],
  });
  assert.equal(redeemedCheck.eligible, false);
  assert.equal(redeemedCheck.status, 'redeemed');

  // 7. Existing customer who had a normal delivered order (without Welcome Offer) -> ineligible_existing_customer
  const normalDeliveredOrder: Order = {
    ...pendingWelcomeOrder,
    id: 'CN-NORM-1',
    benefitType: 'none',
    welcomeOfferApplied: false,
    welcomeDiscount: 0,
    status: 'delivered',
  };
  const existingCustomerCheck = evaluateCustomerWelcomeEligibility({
    userId: 'uid_google_2',
    authProvider: 'google',
    email: 'existing@example.com',
    phone: '9876543210',
    orders: [normalDeliveredOrder],
  });
  assert.equal(existingCustomerCheck.eligible, false);
  assert.equal(existingCustomerCheck.status, 'ineligible_existing_customer');
});

test('Smart Checkout comparison, mutual exclusivity, and mandatory Nest Points rules', () => {
  const eligibility = evaluateCustomerWelcomeEligibility({
    userId: 'uid_smart_1',
    authProvider: 'google',
    email: 'smart@example.com',
    orders: [],
  });

  // Customer has 300 Nest Points (max 125 pts redeemable per order = ₹62.50) and ₹1,500 cart subtotal
  // Option A (Welcome Offer): ₹150 OFF, 0 pts earned, 0 pts redeemed
  // Option B (Nest Points): 125 pts = ₹62.50 OFF, earns 5 pts per ₹100 on net merchandise (₹1,437.50 -> 71 pts)
  const whenWelcomeSelected = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1500,
    shippingCost: 0,
    eligibility,
    availableNestPoints: 300,
    selectedBenefit: 'welcome_offer',
  });

  // Verify comparison summary
  assert.equal(whenWelcomeSelected.comparison.welcomeOfferDiscount, 150);
  assert.equal(whenWelcomeSelected.comparison.maxRedeemablePoints, 125);
  assert.equal(whenWelcomeSelected.comparison.maxNestPointsDiscount, 62.5);
  assert.equal(whenWelcomeSelected.comparison.recommendedBenefit, 'welcome_offer');
  assert.equal(whenWelcomeSelected.comparison.savingsDifference, 87.5);
  assert.match(
    whenWelcomeSelected.comparison.recommendationHeadline,
    /Recommendation: Welcome Offer \(WELCOME10\) saves ₹87\.50 more\./
  );

  // Verify Mandatory Rules 6A & 6B when Welcome Offer is selected:
  // - ZERO Nest Points earned
  // - ZERO Nest Points redeemed
  // - ZERO coupon discount
  assert.equal(whenWelcomeSelected.welcomeOfferApplied, true);
  assert.equal(whenWelcomeSelected.welcomeDiscount, 150);
  assert.equal(whenWelcomeSelected.pointsEarned, 0);
  assert.equal(whenWelcomeSelected.pointsUsed, 0);
  assert.equal(whenWelcomeSelected.pointsDiscount, 0);
  assert.equal(whenWelcomeSelected.couponDiscount, 0);
  assert.equal(whenWelcomeSelected.finalTotal, 1350);

  // Verify Rule 6C: Switching to Nest Points removes Welcome Offer and restores normal loyalty earning & redemption
  const whenNestPointsSelected = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1500,
    shippingCost: 0,
    eligibility,
    availableNestPoints: 300,
    selectedBenefit: 'nest_points',
    requestedPointsToRedeem: 125,
  });

  assert.equal(whenNestPointsSelected.selectedBenefit, 'nest_points');
  assert.equal(whenNestPointsSelected.welcomeOfferApplied, false);
  assert.equal(whenNestPointsSelected.welcomeDiscount, 0);
  assert.equal(whenNestPointsSelected.pointsUsed, 125);
  assert.equal(whenNestPointsSelected.pointsDiscount, 62.5);
  assert.equal(whenNestPointsSelected.netMerchandiseAmount, 1437.5);
  assert.equal(whenNestPointsSelected.finalTotal, 1437.5);
  assert.equal(whenNestPointsSelected.pointsEarned, 71); // floor(1437.5 / 100) * 5 = 14 * 5 = 70 or floor((1437.5 * 5)/100) = 71

  // Verify when cart subtotal is ₹1,000 (< ₹1,299) and customer has 300 Nest Points:
  // Welcome Offer is not eligible for this cart size, so Nest Points is recommended
  const belowMinCartWithPoints = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1000,
    shippingCost: 0,
    eligibility,
    availableNestPoints: 300,
    selectedBenefit: 'nest_points',
  });
  assert.equal(belowMinCartWithPoints.comparison.welcomeOfferDiscount, 0);
  assert.equal(belowMinCartWithPoints.comparison.maxNestPointsDiscount, 62.5);
  assert.equal(belowMinCartWithPoints.comparison.recommendedBenefit, 'nest_points');
});

test('WELCOME10 coupon code: automatic & manual application share identical offer and never duplicate discounts', () => {
  assert.equal(DEFAULT_WELCOME_OFFER_CONFIG.couponCode, 'WELCOME10');

  const newCustomerEligibility = evaluateCustomerWelcomeEligibility({
    userId: 'uid_welcome10_new',
    authProvider: 'google',
    email: 'newcustomer10@example.com',
    orders: [],
  });
  assert.equal(newCustomerEligibility.eligible, true);

  // 1. Automatic application via selectedBenefit = 'welcome_offer'
  const autoApplied = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1800,
    shippingCost: 0,
    eligibility: newCustomerEligibility,
    availableNestPoints: 200,
    selectedBenefit: 'welcome_offer',
  });
  assert.equal(autoApplied.selectedBenefit, 'welcome_offer');
  assert.equal(autoApplied.welcomeOfferApplied, true);
  assert.equal(autoApplied.welcomeCouponCode, 'WELCOME10');
  assert.equal(autoApplied.welcomeDiscount, 180);
  assert.equal(autoApplied.couponDiscount, 0);
  assert.equal(autoApplied.pointsEarned, 0);
  assert.equal(autoApplied.pointsUsed, 0);
  assert.equal(autoApplied.finalTotal, 1620);

  // 2. Manual entry of WELCOME10 via selectedBenefit = 'coupon' + couponCode = 'WELCOME10'
  // Must unify into the exact same 'welcome_offer' state and never stack/double-discount
  const manualApplied = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1800,
    shippingCost: 0,
    eligibility: newCustomerEligibility,
    availableNestPoints: 200,
    selectedBenefit: 'coupon',
    couponCode: 'welcome10',
    couponDiscountAmount: 180,
  });
  assert.equal(manualApplied.selectedBenefit, 'welcome_offer');
  assert.equal(manualApplied.welcomeOfferApplied, true);
  assert.equal(manualApplied.welcomeCouponCode, 'WELCOME10');
  assert.equal(manualApplied.welcomeDiscount, 180);
  assert.equal(manualApplied.couponDiscount, 0);
  assert.equal(manualApplied.netMerchandiseAmount, 1620);
  assert.equal(manualApplied.finalTotal, 1620);
  assert.equal(manualApplied.pointsEarned, 0);
  assert.equal(manualApplied.pointsUsed, 0);

  // 3. Existing customer manually entering WELCOME10 is rejected (₹0 discount)
  const existingCustomerOrder: Order = {
    id: 'CN-EXIST-100',
    userId: 'uid_existing_customer',
    customerName: 'Existing Buyer',
    customerPhone: '9876543210',
    customerEmail: 'existing10@example.com',
    customerAddress: 'Sector 46, Gurgaon',
    items: [],
    subtotal: 2000,
    shippingCost: 0,
    totalAmount: 2000,
    totalSavings: 0,
    paymentMethod: 'upi',
    status: 'delivered',
    createdAt: new Date().toISOString(),
  };

  const existingEligibility = evaluateCustomerWelcomeEligibility({
    userId: 'uid_existing_customer',
    authProvider: 'google',
    email: 'existing10@example.com',
    orders: [existingCustomerOrder],
  });
  assert.equal(existingEligibility.eligible, false);

  const rejectedManual = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 1800,
    shippingCost: 0,
    eligibility: existingEligibility,
    availableNestPoints: 200,
    selectedBenefit: 'coupon',
    couponCode: 'WELCOME10',
    couponDiscountAmount: 180,
  });
  assert.equal(rejectedManual.welcomeOfferApplied, false);
  assert.equal(rejectedManual.welcomeDiscount, 0);
  assert.equal(rejectedManual.couponDiscount, 0);
  assert.equal(rejectedManual.finalTotal, 1800);

  // 4. Admin-configured custom coupon code (e.g. FIRST10) works identically
  const customConfig = {
    ...DEFAULT_WELCOME_OFFER_CONFIG,
    couponCode: 'FIRST10',
  };
  const customManual = calculateCentralizedCheckoutBreakdown({
    productSubtotal: 2500,
    shippingCost: 0,
    eligibility: newCustomerEligibility,
    availableNestPoints: 0,
    selectedBenefit: 'coupon',
    couponCode: 'FIRST10',
    config: customConfig,
  });
  assert.equal(customManual.selectedBenefit, 'welcome_offer');
  assert.equal(customManual.welcomeOfferApplied, true);
  assert.equal(customManual.welcomeCouponCode, 'FIRST10');
  assert.equal(customManual.welcomeDiscount, 200); // capped at ₹200
  assert.equal(customManual.finalTotal, 2300);
});

