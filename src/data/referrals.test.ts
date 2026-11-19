import {
  DEFAULT_REFERRAL_REWARDS_CONFIG,
  REFERRAL_CARD_DESCRIPTION,
  REFERRAL_APPLY_BUTTON_LABEL,
  REFERRAL_APPLIED_SUCCESS_MESSAGE,
  validateAndCreateReferralApplication,
  evaluateReferralCheckoutCompatibility,
  evaluateReferralOnOrderPlaced,
  settleReferralRewardOnDelivery,
  reverseReferralOnCancellationOrRefund,
  computeCustomerReferralSummary,
  computeAdminReferralSummary,
  buildWhatsAppReferralShareMessage,
  buildWhatsAppReferralShareUrl,
} from './referrals';
import { LoyaltyAccount } from './loyalty';
import { Order } from './orders';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

const referrerAccount: LoyaltyAccount = {
  id: 'uid_referrer_1',
  userId: 'uid_referrer_1',
  customerName: 'Aarav Sharma',
  email: 'aarav@example.com',
  phone: '9876543210',
  pointsBalance: 250,
  lifetimeEarned: 250,
  lifetimeSpent: 0,
  referralPointsEarned: 100,
  referralCode: 'NEST-AARA123',
  referralCount: 1,
  updatedAt: 1700000000000,
};

const referredAccountBase: LoyaltyAccount = {
  id: 'uid_friend_qual',
  userId: 'uid_friend_qual',
  customerName: 'Priya Verma',
  email: 'priya@example.com',
  phone: '9123456789',
  pointsBalance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  referralPointsEarned: 0,
  referralCode: 'NEST-PRIY456',
  referralCount: 0,
  updatedAt: 1700000000000,
};

console.log('Running Cotton Nest Referral Rewards 14-Scenario Verification Suite...\n');

// 1. Valid referral code application (0 immediate points, status = code_applied)
{
  const res = validateAndCreateReferralApplication({
    referralCodeInput: 'nest-aara123',
    referredUid: 'uid_friend_1',
    referredAccountId: 'uid_friend_1',
    referredName: 'Priya Verma',
    referredEmail: 'priya@example.com',
    referredPhone: '9123456789',
    referredOwnReferralCode: 'NEST-PRIY456',
    referrerAccount,
    customerOrders: [],
    config: DEFAULT_REFERRAL_REWARDS_CONFIG,
  });

  assert(res.valid === true, '1. Valid referral code should succeed');
  assert(res.record?.status === 'code_applied', '1. Initial status must be code_applied');
  assert(res.record?.rewardCredited === false, '1. rewardCredited must be false upon code application');
  assert(res.record?.referrerPointsAwarded === 0, '1. Referrer points must be 0 upon code application');
  assert(res.record?.referredPointsAwarded === 0, '1. Referred points must be 0 upon code application');
  assert(
    res.message === REFERRAL_APPLIED_SUCCESS_MESSAGE,
    '1. Confirmation message must match exact required wording'
  );
  console.log('✓ Scenario 1 passed: Valid referral code application registers code_applied with 0 immediate points');
}

// 2. Invalid referral code rejection
{
  const badFormat = validateAndCreateReferralApplication({
    referralCodeInput: 'INVALID-CODE',
    referredUid: 'uid_friend_1',
    referredAccountId: 'uid_friend_1',
    referredOwnReferralCode: 'NEST-PRIY456',
    referrerAccount: null,
    customerOrders: [],
  });
  assert(badFormat.valid === false, '2a. Non-NEST referral format must be rejected');

  const notFound = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-NONE999',
    referredUid: 'uid_friend_1',
    referredAccountId: 'uid_friend_1',
    referredOwnReferralCode: 'NEST-PRIY456',
    referrerAccount: null,
    customerOrders: [],
  });
  assert(notFound.valid === false, '2b. Unregistered referral code must be rejected');
  console.log('✓ Scenario 2 passed: Invalid or unknown referral codes are rejected');
}

// 3. Self-referral rejection (by code, UID, email, or phone)
{
  const byOwnCode = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_other',
    referredAccountId: 'uid_other',
    referredOwnReferralCode: 'NEST-AARA123',
    referrerAccount,
  });
  assert(byOwnCode.valid === false && Boolean(byOwnCode.error?.includes('own referral code')), '3a. Self-referral by code blocked');

  const bySameUid = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_referrer_1',
    referredAccountId: 'uid_referrer_1',
    referredOwnReferralCode: 'NEST-DIFF999',
    referrerAccount,
  });
  assert(bySameUid.valid === false, '3b. Self-referral by same UID blocked');

  const bySameEmail = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_other_2',
    referredAccountId: 'uid_other_2',
    referredEmail: 'AARAV@example.com',
    referredOwnReferralCode: 'NEST-DIFF999',
    referrerAccount,
  });
  assert(bySameEmail.valid === false, '3c. Self-referral by same email blocked');

  const bySamePhone = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_other_3',
    referredAccountId: 'uid_other_3',
    referredPhone: '+91 98765 43210',
    referredOwnReferralCode: 'NEST-DIFF999',
    referrerAccount,
  });
  assert(bySamePhone.valid === false, '3d. Self-referral by same 10-digit phone blocked');
  console.log('✓ Scenario 3 passed: Self-referrals (code, UID, email, phone) are strictly blocked');
}

// 4. Second referral claim rejection
{
  const firstApp = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_friend_1',
    referredAccountId: 'uid_friend_1',
    referredOwnReferralCode: 'NEST-PRIY456',
    referrerAccount,
  });
  assert(firstApp.valid === true && Boolean(firstApp.record), '4a. First referral application succeeds');

  const secondApp = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-OTHR888',
    referredUid: 'uid_friend_1',
    referredAccountId: 'uid_friend_1',
    referredOwnReferralCode: 'NEST-PRIY456',
    existingReferralForUser: firstApp.record,
    referrerAccount: {
      ...referrerAccount,
      id: 'uid_referrer_2',
      userId: 'uid_referrer_2',
      referralCode: 'NEST-OTHR888',
    },
  });
  assert(secondApp.valid === false, '4b. Second referral code claim by same customer must be rejected');
  console.log('✓ Scenario 4 passed: Second referral claim by the same customer is rejected');
}

// 5. Existing customer rejection (customer already has prior non-cancelled orders)
{
  const existingOrder: Order = {
    id: 'CN-100001',
    userId: 'uid_existing_cust',
    customerName: 'Rohan Mehta',
    customerPhone: '9988776655',
    customerEmail: 'rohan@example.com',
    customerAddress: 'Sector 46, Gurgaon',
    items: [],
    subtotal: 1599,
    totalSavings: 0,
    totalAmount: 1599,
    status: 'delivered',
    paymentMethod: 'whatsapp',
    createdAt: new Date().toISOString(),
  };

  const res = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_existing_cust',
    referredAccountId: 'uid_existing_cust',
    referredEmail: 'rohan@example.com',
    referredPhone: '9988776655',
    referredOwnReferralCode: 'NEST-ROHA777',
    referrerAccount,
    customerOrders: [existingOrder],
  });
  assert(res.valid === false && Boolean(res.error?.includes('first eligible order')), '5. Existing customer with prior orders rejected');
  console.log('✓ Scenario 5 passed: Existing customer with prior non-cancelled order is rejected');
}

// 6. Order below ₹1,299 product subtotal rejection (excluding delivery charges)
{
  const appRes = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_friend_low',
    referredAccountId: 'uid_friend_low',
    referredOwnReferralCode: 'NEST-FLOW111',
    referrerAccount,
  });
  const record = appRes.record!;

  // Product subtotal is ₹1,280 + ₹29 shipping = ₹1,309 total -> must NOT qualify because product subtotal < ₹1,299
  const lowOrder: Order = {
    id: 'CN-LOW1280',
    userId: 'uid_friend_low',
    customerName: 'Friend Low',
    customerPhone: '9111222333',
    customerAddress: 'Delhi',
    items: [
      {
        productId: 'p1',
        productName: 'Cotton Bedsheet',
        productImage: '',
        dimensions: '90x100',
        price: 1280,
        quantity: 1,
      },
    ],
    subtotal: 1280,
    totalSavings: 0,
    shippingCost: 29,
    totalAmount: 1309,
    status: 'pending',
    paymentMethod: 'whatsapp',
    createdAt: new Date().toISOString(),
  };

  const evalLow = evaluateReferralOnOrderPlaced({
    record,
    order: lowOrder,
    priorOrders: [],
  });
  assert(evalLow.isQualifyingOrder === false, '6a. Order with product subtotal ₹1,280 (excluding ₹29 shipping) must not qualify');
  assert(
    evalLow.updatedRecord.status === 'expired_ineligible',
    '6b. First order below ₹1,299 transitions referral record to expired_ineligible'
  );
  console.log('✓ Scenario 6 passed: Order below ₹1,299 product subtotal (excluding delivery) does not qualify');
}

// 7 & 8. Eligible order placed -> Order Pending -> Order delivered and paid -> +100 Nest Points to referrer & +100 Nest Points to referred customer
{
  const appRes = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_friend_qual',
    referredAccountId: 'uid_friend_qual',
    referredName: 'Priya Verma',
    referredEmail: 'priya@example.com',
    referredPhone: '9123456789',
    referredOwnReferralCode: 'NEST-PRIY456',
    referrerAccount,
  });
  const initialRecord = appRes.record!;

  const qualifyingOrder: Order = {
    id: 'CN-QUAL1499',
    userId: 'uid_friend_qual',
    customerName: 'Priya Verma',
    customerEmail: 'priya@example.com',
    customerPhone: '9123456789',
    customerAddress: 'Sector 46, Gurgaon',
    items: [
      {
        productId: 'p2',
        productName: 'King Size Pure Cotton Bedsheet',
        productImage: '',
        dimensions: '108x108',
        price: 1499,
        quantity: 1,
      },
    ],
    subtotal: 1499,
    totalSavings: 0,
    shippingCost: 0,
    totalAmount: 1499,
    status: 'pending',
    paymentMethod: 'whatsapp',
    createdAt: new Date().toISOString(),
  };

  // Scenario 7: Order placed -> Order Pending
  const placedEval = evaluateReferralOnOrderPlaced({
    record: initialRecord,
    order: qualifyingOrder,
    priorOrders: [],
  });
  assert(placedEval.isQualifyingOrder === true, '7a. First order of ₹1,499 without Welcome Offer/Nest Points qualifies');
  assert(placedEval.updatedRecord.status === 'order_pending', '7b. Status transitions to order_pending');
  assert(placedEval.updatedRecord.rewardCredited === false, '7c. Points are NOT credited when order is merely placed');
  console.log('✓ Scenario 7 passed: Eligible order placed transitions referral to Order Pending with 0 points credited');

  // Scenario 8: Order delivered & paid -> +100 pts each
  const deliveredOrder: Order = {
    ...qualifyingOrder,
    status: 'delivered',
    deliveredAt: new Date().toISOString(),
  };
  const settlement = settleReferralRewardOnDelivery({
    record: placedEval.updatedRecord,
    order: deliveredOrder,
    referrerAccount,
    referredAccount: referredAccountBase,
  });
  assert(settlement.settled === true, '8a. Delivered qualifying order must credit referral rewards');
  assert(settlement.updatedRecord.referrerPointsAwarded === 100, '8b. Referrer receives 100 Nest Points (₹50 value)');
  assert(settlement.updatedRecord.referredPointsAwarded === 100, '8c. Referred customer receives 100 Nest Points (₹50 value)');
  assert(settlement.updatedRecord.status === 'reward_earned', '8d. Status transitions to reward_earned');
  assert(settlement.updatedRecord.rewardCredited === true, '8e. rewardCredited flag set to true');
  assert(
    Boolean(settlement.referrerTx?.expiresAt && settlement.referredTx?.expiresAt),
    '8f. Both referral point transactions carry 12-month expiry timestamps'
  );
  console.log('✓ Scenario 8 passed: Delivered & paid order credits +100 Nest Points to referrer and +100 Nest Points to referred customer');

  // Scenario 11: Refresh/re-login/duplicate settlement request -> No duplicate points
  const duplicateAttempt = settleReferralRewardOnDelivery({
    record: settlement.updatedRecord,
    order: deliveredOrder,
    referrerAccount: settlement.updatedReferrerAccount!,
    referredAccount: settlement.updatedReferredAccount!,
  });
  assert(duplicateAttempt.settled === false && duplicateAttempt.alreadyCredited === true, '11a. Duplicate delivery settlement must not credit points again');
  assert(!duplicateAttempt.referrerTx && !duplicateAttempt.referredTx, '11b. 0 new transactions on duplicate request');
  console.log('✓ Scenario 11 passed: Repeated delivery/refresh/re-login requests are idempotent and never award duplicate points');

  // Scenario 10: Order refunded after delivery -> Points reversed safely
  const refundReversal = reverseReferralOnCancellationOrRefund({
    record: settlement.updatedRecord,
    orderId: deliveredOrder.id,
    orderStatus: 'refunded',
    referrerAccount: settlement.updatedReferrerAccount!,
    referredAccount: settlement.updatedReferredAccount!,
  });
  assert(refundReversal.pointsReversed === true, '10a. Refunded order after delivery triggers point reversal');
  assert(refundReversal.updatedRecord.status === 'cancelled', '10b. Refunded referral status becomes cancelled');
  assert(refundReversal.updatedRecord.rewardReversed === true, '10c. rewardReversed flag set to true');
  assert(refundReversal.referrerReversalTx?.points === -100, '10d. Referrer reversal transaction is -100 pts');
  assert(refundReversal.referredReversalTx?.points === -100, '10e. Referred reversal transaction is -100 pts');

  // Ensure repeated refund calls do not double-deduct
  const secondRefundAttempt = reverseReferralOnCancellationOrRefund({
    record: refundReversal.updatedRecord,
    orderId: deliveredOrder.id,
    orderStatus: 'refunded',
    referrerAccount: refundReversal.updatedReferrerAccount,
    referredAccount: refundReversal.updatedReferredAccount,
  });
  assert(
    secondRefundAttempt.pointsReversed === false,
    '10f. Repeated refund reversal calls are idempotent and never double-deduct'
  );
  console.log('✓ Scenario 10 passed: Order refunded after delivery safely reverses referral points once without duplicate deductions');
}

// 9. Order cancelled before delivery -> No points credited, status = cancelled
{
  const appRes = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_friend_cancel',
    referredAccountId: 'uid_friend_cancel',
    referredOwnReferralCode: 'NEST-FCAN222',
    referrerAccount,
  });
  const pendingOrder: Order = {
    id: 'CN-CANCEL1500',
    userId: 'uid_friend_cancel',
    customerName: 'Cancel Test',
    customerPhone: '9222333444',
    customerAddress: 'Gurgaon',
    items: [{ productId: 'p1', productName: 'Bedsheet', productImage: '', dimensions: '108x108', price: 1500, quantity: 1 }],
    subtotal: 1500,
    totalSavings: 0,
    totalAmount: 1500,
    status: 'pending',
    paymentMethod: 'whatsapp',
    createdAt: new Date().toISOString(),
  };
  const placed = evaluateReferralOnOrderPlaced({
    record: appRes.record!,
    order: pendingOrder,
    priorOrders: [],
  });
  const cancelled = reverseReferralOnCancellationOrRefund({
    record: placed.updatedRecord,
    orderId: pendingOrder.id,
    orderStatus: 'cancelled',
    referrerAccount,
    referredAccount: referredAccountBase,
  });
  assert(cancelled.updatedRecord.status === 'cancelled', '9a. Cancelled pending order marks referral as cancelled');
  assert(cancelled.pointsReversed === false, '9b. No point deduction needed since no points were credited yet');
  console.log('✓ Scenario 9 passed: Order cancelled before delivery cancels pending referral with 0 points credited');
}

// 12. Referral + incompatible discount handling (Welcome Offer or Nest Points redemption)
{
  const appRes = validateAndCreateReferralApplication({
    referralCodeInput: 'NEST-AARA123',
    referredUid: 'uid_friend_conflict',
    referredAccountId: 'uid_friend_conflict',
    referredOwnReferralCode: 'NEST-FCON333',
    referrerAccount,
  });
  const record = appRes.record!;

  const conflictWithWelcome = evaluateReferralCheckoutCompatibility({
    referralRecord: record,
    productSubtotal: 1599,
    welcomeOfferApplied: true,
    pointsRedeemed: 0,
    customerOrders: [],
  });
  assert(conflictWithWelcome.hasDiscountConflict === true, '12a. Welcome Offer conflict detected clearly');
  assert(conflictWithWelcome.qualifiesForThisOrder === false, '12b. Does not qualify while Welcome Offer is active');
  assert(Boolean(conflictWithWelcome.statusMessage?.includes('Welcome Offer')), '12c. Conflict explanation mentions Welcome Offer');

  const conflictWithPoints = evaluateReferralCheckoutCompatibility({
    referralRecord: record,
    productSubtotal: 1599,
    welcomeOfferApplied: false,
    pointsRedeemed: 100,
    customerOrders: [],
  });
  assert(conflictWithPoints.hasDiscountConflict === true, '12d. Nest Points redemption conflict detected clearly');

  const compatibleOrder = evaluateReferralCheckoutCompatibility({
    referralRecord: record,
    productSubtotal: 1599,
    welcomeOfferApplied: false,
    pointsRedeemed: 0,
    customerOrders: [],
  });
  assert(compatibleOrder.hasDiscountConflict === false && compatibleOrder.qualifiesForThisOrder === true, '12e. Qualifies when incompatible discounts are not used');
  console.log('✓ Scenario 12 passed: Incompatible discounts (Welcome Offer / Nest Points) are detected and explained without silent removal');
}

// 13. Copy Code and WhatsApp sharing
{
  assert(
    REFERRAL_CARD_DESCRIPTION ===
      'Invite your friends to Cotton Nest! When your friend completes their first eligible order of ₹1,299 or more, you both earn 100 Nest Points (worth ₹50 each) after successful delivery and payment.',
    '13a. Referral card description matches exact required text'
  );
  assert(REFERRAL_APPLY_BUTTON_LABEL === 'Apply Referral Code', '13b. Button label is Apply Referral Code');

  const msg = buildWhatsAppReferralShareMessage('NEST-AARA123');
  assert(msg.includes('🎁 Join me on Cotton Nest!'), '13c. WhatsApp message includes greeting');
  assert(msg.includes('Use my referral code: NEST-AARA123'), '13d. WhatsApp message includes customer personal referral code');
  assert(
    msg.includes('Complete your first eligible order of ₹1,299 or more, and we both earn 100 Nest Points worth ₹50 each after delivery and payment!'),
    '13e. WhatsApp message includes qualifying rules'
  );
  assert(msg.includes('Shop here: https://cottonnest.in'), '13f. WhatsApp message includes https://cottonnest.in');

  const waUrl = buildWhatsAppReferralShareUrl('NEST-AARA123');
  assert(waUrl.startsWith('https://wa.me/?text=') && waUrl.includes('NEST-AARA123'), '13g. WhatsApp share URL is valid');
  console.log('✓ Scenario 13 passed: Referral card wording and WhatsApp share message match specification');
}

// 14. Existing referral codes, legacy balances, and Admin Panel summary remain intact
{
  const summary = computeCustomerReferralSummary({
    config: DEFAULT_REFERRAL_REWARDS_CONFIG,
    myReferralCode: referrerAccount.referralCode || 'NEST-AARA123',
    myLoyaltyAccount: referrerAccount,
    appliedReferral: null,
    referralsMadeByMe: [],
  });
  assert(summary.myReferralCode === 'NEST-AARA123', '14a. Existing personal referral code preserved');
  assert(summary.earnedRewardsPoints === 100, '14b. Previously earned referral points preserved');
  assert(summary.successfulReferralsCount === 1, '14c. Previously completed referral count preserved');

  const adminSummary = computeAdminReferralSummary({
    config: DEFAULT_REFERRAL_REWARDS_CONFIG,
    records: [
      {
        id: 'u1',
        referralCode: 'NEST-AARA123',
        referrerUid: 'r1',
        referrerAccountId: 'r1',
        referredUid: 'u1',
        referredAccountId: 'u1',
        status: 'code_applied',
        rewardCredited: false,
        rewardReversed: false,
        referrerPointsAwarded: 0,
        referredPointsAwarded: 0,
        appliedAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'u2',
        referralCode: 'NEST-AARA123',
        referrerUid: 'r1',
        referrerAccountId: 'r1',
        referredUid: 'u2',
        referredAccountId: 'u2',
        status: 'order_pending',
        rewardCredited: false,
        rewardReversed: false,
        referrerPointsAwarded: 0,
        referredPointsAwarded: 0,
        appliedAt: 2000,
        updatedAt: 2000,
      },
      {
        id: 'u3',
        referralCode: 'NEST-AARA123',
        referrerUid: 'r1',
        referrerAccountId: 'r1',
        referredUid: 'u3',
        referredAccountId: 'u3',
        status: 'reward_earned',
        rewardCredited: true,
        rewardReversed: false,
        referrerPointsAwarded: 100,
        referredPointsAwarded: 100,
        appliedAt: 3000,
        updatedAt: 3000,
      },
      {
        id: 'u4',
        referralCode: 'NEST-AARA123',
        referrerUid: 'r1',
        referrerAccountId: 'r1',
        referredUid: 'u4',
        referredAccountId: 'u4',
        status: 'cancelled',
        rewardCredited: false,
        rewardReversed: false,
        referrerPointsAwarded: 0,
        referredPointsAwarded: 0,
        appliedAt: 4000,
        updatedAt: 4000,
      },
    ],
  });
  assert(adminSummary.stats.totalCodesApplied === 4, '14d. Admin totalCodesApplied = 4');
  assert(adminSummary.stats.pendingReferralsCount === 2, '14e. Admin pendingReferralsCount = 2 (code_applied + order_pending)');
  assert(adminSummary.stats.successfulReferralsCount === 1, '14f. Admin successfulReferralsCount = 1');
  assert(adminSummary.stats.totalNestPointsAwarded === 200, '14g. Admin totalNestPointsAwarded = 200 (100 referrer + 100 referred)');
  assert(adminSummary.stats.cancelledOrIneligibleCount === 1, '14h. Admin cancelledOrIneligibleCount = 1');
  console.log('✓ Scenario 14 passed: Existing referral codes, legacy Nest Points balances, and Admin Panel metrics remain intact');
}

console.log('\n🎉 All 14 Cotton Nest Referral Rewards test scenarios passed!');
