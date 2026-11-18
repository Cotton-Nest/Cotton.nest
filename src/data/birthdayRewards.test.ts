import assert from 'node:assert/strict';
import {
  DEFAULT_BIRTHDAY_REWARDS_CONFIG,
  istWallClockToTimestampMs,
  getBirthdayWindowTimestampsIst,
  getLastDayOfMonth,
  generateBirthdayCouponCode,
  isBirthdayCouponCodeFormat,
  createCustomerBirthdayProfile,
  evaluateBirthdayRewardStatus,
  validateBirthdayCouponForCheckout,
} from './birthdayRewards.ts';

function runVerificationSuite() {
  console.log('Running Cotton Nest Birthday Rewards Club Verification Suite (14 Test Cases)...');

  const config = { ...DEFAULT_BIRTHDAY_REWARDS_CONFIG };
  const uidA = 'user_cotton_nest_alice_001';
  const uidB = 'user_cotton_nest_bob_002';

  // 1. Saving a birthday month (requires sign-in, valid 1..12 month, explicit consent, blocks self-service overwrite)
  {
    const noAuth = createCustomerBirthdayProfile({
      uid: '',
      birthdayMonth: 5,
      consentAccepted: true,
      nowMs: istWallClockToTimestampMs(2026, 3, 10),
    });
    assert.equal(noAuth.success, false, 'Guest without UID must be rejected');

    const noConsent = createCustomerBirthdayProfile({
      uid: uidA,
      birthdayMonth: 5,
      consentAccepted: false,
      nowMs: istWallClockToTimestampMs(2026, 3, 10),
    });
    assert.equal(noConsent.success, false, 'Registration without explicit consent must be rejected');

    const regMayInMarch = createCustomerBirthdayProfile({
      uid: uidA,
      email: 'alice@example.com',
      customerName: 'Alice Sharma',
      birthdayMonth: 5, // May
      consentAccepted: true,
      nowMs: istWallClockToTimestampMs(2026, 3, 10, 14, 0, 0),
    });
    assert.equal(regMayInMarch.success, true);
    assert.equal(regMayInMarch.profile?.birthdayMonth, 5);
    assert.equal(regMayInMarch.profile?.birthdayMonthName, 'May');
    assert.equal(regMayInMarch.profile?.eligibleFromYear, 2026);

    // Attempt self-service overwrite to another month must be blocked
    const selfOverwrite = createCustomerBirthdayProfile({
      uid: uidA,
      birthdayMonth: 4,
      consentAccepted: true,
      nowMs: istWallClockToTimestampMs(2026, 4, 16),
      existingProfile: regMayInMarch.profile,
    });
    assert.equal(selfOverwrite.success, false, 'Self-service month change must be blocked');
    console.log('✓ Test 1 Passed: Birthday month registration, consent enforcement, and overwrite protection');
  }

  // Build Alice's profile registered on 10 May 2026 (before the 15th of May)
  const aliceRegRes = createCustomerBirthdayProfile({
    uid: uidA,
    email: 'alice@example.com',
    customerName: 'Alice Sharma',
    birthdayMonth: 5, // May
    consentAccepted: true,
    nowMs: istWallClockToTimestampMs(2026, 5, 10, 10, 30, 0),
  });
  assert.ok(aliceRegRes.profile);
  let aliceProfile = aliceRegRes.profile!;

  // 2. Viewing state before the 15th
  {
    const statusBefore15th = evaluateBirthdayRewardStatus({
      profile: aliceProfile,
      config,
      nowMs: istWallClockToTimestampMs(2026, 5, 14, 23, 59, 59), // 14 May 2026 11:59:59 PM IST
    });
    assert.equal(statusBefore15th.uiState, 'waiting_until_15th');
    assert.equal(statusBefore15th.headline, 'Your birthday surprise unlocks on 15 May!');
    assert.equal(statusBefore15th.activeCoupon, null);
    console.log('✓ Test 2 Passed: Viewing state before the 15th of birthday month');
  }

  // 3. Coupon availability at 12:00 AM IST on the 15th
  {
    const statusOn15th = evaluateBirthdayRewardStatus({
      profile: aliceProfile,
      config,
      nowMs: istWallClockToTimestampMs(2026, 5, 15, 0, 0, 0), // 15 May 2026 12:00:00 AM IST
    });
    assert.equal(statusOn15th.uiState, 'active_available');
    assert.equal(statusOn15th.headline, '🎉 Your Birthday Reward is Here!');
    assert.ok(statusOn15th.activeCoupon);
    assert.ok(statusOn15th.newlyIssuedCoupon);
    assert.equal(statusOn15th.activeCoupon?.discountAmount, 100);
    assert.equal(statusOn15th.activeCoupon?.minOrderValue, 1299);
    assert.ok(isBirthdayCouponCodeFormat(statusOn15th.activeCoupon!.code));
    assert.equal(statusOn15th.activeCoupon?.code, generateBirthdayCouponCode(uidA, 2026));
    console.log('✓ Test 3 Passed: Coupon unlocks at 12:00 AM IST on the 15th');
  }

  // 4. Customer logging in later in the month after the 15th (on-demand evaluation without cron)
  {
    const statusOn24th = evaluateBirthdayRewardStatus({
      profile: aliceProfile, // Note: no coupon persisted yet prior to login on 24th
      config,
      nowMs: istWallClockToTimestampMs(2026, 5, 24, 18, 15, 0), // 24 May 2026 6:15 PM IST
    });
    assert.equal(statusOn24th.uiState, 'active_available');
    assert.ok(statusOn24th.newlyIssuedCoupon, 'Coupon must be issued on-demand when logging in on 24th');
    // Persist the newly issued coupon on Alice's profile
    aliceProfile = {
      ...aliceProfile,
      annualCoupons: {
        '2026': statusOn24th.newlyIssuedCoupon!,
      },
    };
    console.log('✓ Test 4 Passed: Customer logging in later in the month after the 15th receives reward on-demand');
  }

  // 5. Coupon expiry after month-end (11:59:59 PM IST on last day of month + Feb 28/29 leap-year handling)
  {
    assert.equal(getLastDayOfMonth(2026, 2), 28, '2026 is non-leap year (Feb 28)');
    assert.equal(getLastDayOfMonth(2028, 2), 29, '2028 is leap year (Feb 29)');
    const feb2028Window = getBirthdayWindowTimestampsIst(2028, 2);
    assert.equal(feb2028Window.lastDay, 29);

    // At 11:59:59 PM IST on 31 May 2026 -> still active
    const statusAtLastSecond = evaluateBirthdayRewardStatus({
      profile: aliceProfile,
      config,
      nowMs: istWallClockToTimestampMs(2026, 5, 31, 23, 59, 59, 0),
    });
    assert.equal(statusAtLastSecond.uiState, 'active_available');

    // On 1 June 2026 12:00:01 AM IST -> expired
    const statusAfterMonthEnd = evaluateBirthdayRewardStatus({
      profile: aliceProfile,
      config,
      nowMs: istWallClockToTimestampMs(2026, 6, 1, 0, 0, 1),
    });
    assert.equal(statusAfterMonthEnd.uiState, 'expired_this_year');
    assert.equal(
      statusAfterMonthEnd.headline,
      'Your birthday reward has expired. Your next gift arrives next year!'
    );

    const checkoutAfterExpiry = validateBirthdayCouponForCheckout({
      couponCode: aliceProfile.annualCoupons['2026'].code,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1800,
      nowMs: istWallClockToTimestampMs(2026, 6, 1, 0, 0, 1),
    });
    assert.equal(checkoutAfterExpiry.valid, false, 'Expired coupon must be rejected at checkout');
    console.log('✓ Test 5 Passed: Coupon expires at 11:59:59 PM IST on month-end (including Feb 28/29)');
  }

  // 6. Registering on or after the 15th of the current month -> must wait until next year
  {
    const lateReg = createCustomerBirthdayProfile({
      uid: uidB,
      email: 'bob@example.com',
      customerName: 'Bob Verma',
      birthdayMonth: 5, // May
      consentAccepted: true,
      nowMs: istWallClockToTimestampMs(2026, 5, 15, 0, 0, 0), // Registered ON 15 May 2026
    });
    assert.equal(lateReg.success, true);
    assert.equal(lateReg.profile?.eligibleFromYear, 2027, 'Must qualify starting 2027, not 2026');

    const bobStatus2026 = evaluateBirthdayRewardStatus({
      profile: lateReg.profile!,
      config,
      nowMs: istWallClockToTimestampMs(2026, 5, 20, 12, 0, 0),
    });
    assert.equal(bobStatus2026.uiState, 'waiting_until_next_year');
    assert.equal(bobStatus2026.activeCoupon, null);
    assert.equal(bobStatus2026.nextUnlockYear, 2027);

    // Next year on 15 May 2027, Bob unlocks his 2027 birthday coupon
    const bobStatus2027 = evaluateBirthdayRewardStatus({
      profile: lateReg.profile!,
      config,
      nowMs: istWallClockToTimestampMs(2027, 5, 16, 12, 0, 0),
    });
    assert.equal(bobStatus2027.uiState, 'active_available');
    assert.ok(bobStatus2027.activeCoupon);
    console.log('✓ Test 6 Passed: Registering on or after the 15th waits until the following year');
  }

  // 7. Preventing double redemption
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 20, 15, 0, 0);
    const aliceCode = aliceProfile.annualCoupons['2026'].code;

    // Valid first checkout validation
    const firstValidation = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1599,
      nowMs: activeNowMs,
    });
    assert.equal(firstValidation.valid, true);
    assert.equal(firstValidation.discountAmount, 100);

    // Mark redeemed on order confirmation
    const redeemedProfile = {
      ...aliceProfile,
      annualCoupons: {
        '2026': {
          ...aliceProfile.annualCoupons['2026'],
          status: 'redeemed' as const,
          redeemedAt: activeNowMs,
          redeemedOrderId: 'CN-900100',
        },
      },
    };

    const statusAfterRedeem = evaluateBirthdayRewardStatus({
      profile: redeemedProfile,
      config,
      nowMs: activeNowMs,
    });
    assert.equal(statusAfterRedeem.uiState, 'redeemed_this_year');
    assert.equal(statusAfterRedeem.headline, 'Birthday Reward Used — See you next year!');

    const secondAttempt = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: redeemedProfile,
      config,
      productSubtotal: 1800,
      nowMs: activeNowMs,
    });
    assert.equal(secondAttempt.valid, false, 'Double redemption must be rejected');
    console.log('✓ Test 7 Passed: Double redemption prevented and UI updates to "Birthday Reward Used — See you next year!"');
  }

  // 8. Preventing use by another customer account
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 20, 15, 0, 0);
    const aliceCode = aliceProfile.annualCoupons['2026'].code;

    const crossAccountAttempt = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidB, // Bob trying to use Alice's code
      profile: aliceProfile,
      config,
      productSubtotal: 1999,
      nowMs: activeNowMs,
    });
    assert.equal(crossAccountAttempt.valid, false, 'Another account must not be able to use Alice coupon');
    console.log('✓ Test 8 Passed: Account-bound coupon cannot be used by another customer account');
  }

  // 9, 10, 11. Preventing stacking with Welcome Offer, Nest Points, or other coupons
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 20, 15, 0, 0);
    const aliceCode = aliceProfile.annualCoupons['2026'].code;

    const stackWelcome = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1599,
      nowMs: activeNowMs,
      hasWelcomeOfferApplied: true,
    });
    assert.equal(stackWelcome.valid, false, 'Cannot stack with Welcome Offer');

    const stackPoints = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1599,
      nowMs: activeNowMs,
      pointsUsed: 100,
    });
    assert.equal(stackPoints.valid, false, 'Cannot stack with Nest Points');

    const stackOtherCoupon = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1599,
      nowMs: activeNowMs,
      hasOtherCouponApplied: true,
    });
    assert.equal(stackOtherCoupon.valid, false, 'Cannot stack with another coupon');
    console.log('✓ Tests 9, 10, 11 Passed: Strict mutual exclusivity with Welcome Offer, Nest Points, and other coupons');
  }

  // 12. Rejecting invalid checkout totals (< ₹1,299 product subtotal before delivery)
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 20, 15, 0, 0);
    const aliceCode = aliceProfile.annualCoupons['2026'].code;

    const belowMinSubtotal = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1298, // ₹1 short of ₹1,299 (even if delivery fee would add ₹29)
      nowMs: activeNowMs,
    });
    assert.equal(belowMinSubtotal.valid, false, 'Subtotal ₹1,298 must be rejected');

    const exactMinSubtotal = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config,
      productSubtotal: 1299,
      nowMs: activeNowMs,
    });
    assert.equal(exactMinSubtotal.valid, true, 'Subtotal ₹1,299 must be accepted');
    console.log('✓ Test 12 Passed: Minimum eligible order subtotal ₹1,299 enforced excluding delivery fees');
  }

  // 13. Prospective admin configuration changes & disabled programme policy
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 20, 15, 0, 0);
    const aliceCode = aliceProfile.annualCoupons['2026'].code;

    // Admin prospectively changes config to ₹150 OFF on ₹1,999
    const updatedConfig = {
      ...config,
      discountAmount: 150,
      minOrderValue: 1999,
    };

    // Alice's already-issued 2026 coupon retains its snapshot ₹100 OFF on ₹1,299
    const checkExistingIssued = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config: updatedConfig,
      productSubtotal: 1350,
      nowMs: activeNowMs,
    });
    assert.equal(checkExistingIssued.valid, true);
    assert.equal(checkExistingIssued.discountAmount, 100);

    // Admin disables programme with allowAlreadyIssuedWhenDisabled = false
    const hardDisabledConfig = {
      ...config,
      enabled: false,
      allowAlreadyIssuedWhenDisabled: false,
    };
    const checkWhenHardDisabled = validateBirthdayCouponForCheckout({
      couponCode: aliceCode,
      userId: uidA,
      profile: aliceProfile,
      config: hardDisabledConfig,
      productSubtotal: 1500,
      nowMs: activeNowMs,
    });
    assert.equal(checkWhenHardDisabled.valid, false);
    console.log('✓ Test 13 Passed: Prospective config changes preserve already-issued coupons & disabled policy works');
  }

  // 14. Order cancellation prior to delivery coupon reversal policy
  {
    const activeNowMs = istWallClockToTimestampMs(2026, 5, 22, 11, 0, 0);
    const coupon2026 = aliceProfile.annualCoupons['2026'];
    const restoredStatusDuringWindow = activeNowMs <= coupon2026.expiresAt ? 'issued' : 'expired';
    assert.equal(restoredStatusDuringWindow, 'issued');

    const restoredProfile = {
      ...aliceProfile,
      annualCoupons: {
        '2026': {
          ...coupon2026,
          status: restoredStatusDuringWindow as 'issued',
          redeemedAt: undefined,
          redeemedOrderId: undefined,
          reversedAt: activeNowMs,
          reversedOrderId: 'CN-900100',
        },
      },
    };
    const reEval = evaluateBirthdayRewardStatus({
      profile: restoredProfile,
      config,
      nowMs: activeNowMs,
    });
    assert.equal(reEval.uiState, 'active_available', 'Coupon restored when order cancelled prior to delivery');
    console.log('✓ Test 14 Passed: Order cancellation prior to delivery safely restores un-delivered birthday coupon');
  }

  console.log('\n🎉 All 14 Cotton Nest Birthday Rewards Club test cases passed!');
}

runVerificationSuite();
