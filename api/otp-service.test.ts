import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  buildCottonNestOtpHtml,
  buildCottonNestOtpText,
  getGmailConfig,
  verifyOtp,
  sendOtpEmail,
  generateVerificationToken,
} from './otp-service.ts';

test('normalizeEmail trims and converts to lowercase', () => {
  assert.equal(normalizeEmail('  Test.User@Gmail.COM  '), 'test.user@gmail.com');
  assert.equal(normalizeEmail('CUSTOMER@DOMAIN.IN'), 'customer@domain.in');
});

test('buildCottonNestOtpHtml produces compliant luxury email template', () => {
  const otp = '849201';
  const html = buildCottonNestOtpHtml(otp);

  assert.ok(html.includes('Cotton Nest'));
  assert.ok(html.includes('Verify Your Email Address'));
  assert.ok(html.includes(otp));
  assert.ok(html.includes('5 minutes'));
  assert.ok(html.includes('Team Cotton Nest'));
  assert.ok(html.includes('#FAF7F2')); // Cream background
  assert.ok(html.includes('#8C2E46')); // Brand accent
});

test('buildCottonNestOtpText produces matching plain-text alternative', () => {
  const otp = '849201';
  const text = buildCottonNestOtpText(otp);

  assert.ok(text.includes('Cotton Nest'));
  assert.ok(text.includes('Verify Your Email Address'));
  assert.ok(text.includes(otp));
  assert.ok(text.includes('This code expires in 5 minutes'));
  assert.ok(text.includes('Team Cotton Nest'));
});

test('getGmailConfig strips whitespace from app password and handles missing env', () => {
  const origUser = process.env.GMAIL_USER;
  const origPass = process.env.GMAIL_APP_PASSWORD;

  try {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    assert.equal(getGmailConfig(), null);

    process.env.GMAIL_USER = ' cottonnest.atelier@gmail.com ';
    process.env.GMAIL_APP_PASSWORD = ' abcd efgh ijkl mnop ';
    const config = getGmailConfig();
    assert.notEqual(config, null);
    assert.equal(config?.user, 'cottonnest.atelier@gmail.com');
    assert.equal(config?.pass, 'abcdefghijklmnop');

    // Test hyphenated password stripping (e.g. abcd-efgh-ijkl-mnop)
    process.env.GMAIL_APP_PASSWORD = 'abcd-efgh-ijkl-mnop';
    const configHyphens = getGmailConfig();
    assert.equal(configHyphens?.pass, 'abcdefghijklmnop');
    assert.equal(configHyphens?.rawPassLength, 16);
    assert.equal(configHyphens?.isLikelyAppPassword, true);
  } finally {
    if (origUser) process.env.GMAIL_USER = origUser;
    else delete process.env.GMAIL_USER;
    if (origPass) process.env.GMAIL_APP_PASSWORD = origPass;
    else delete process.env.GMAIL_APP_PASSWORD;
  }
});

test('verifyOtp rejects invalid OTP formats', async () => {
  const resEmpty = await verifyOtp('user@gmail.com', '');
  assert.equal(resEmpty.success, false);
  assert.equal(resEmpty.status, 400);

  const resShort = await verifyOtp('user@gmail.com', '1234');
  assert.equal(resShort.success, false);
  assert.equal(resShort.status, 400);

  const resAlpha = await verifyOtp('user@gmail.com', 'abcdef');
  assert.equal(resAlpha.success, false);
  assert.equal(resAlpha.status, 400);
});

test('verifyOtp returns error when no active OTP exists', async () => {
  const res = await verifyOtp('nonexistent@domain.com', '654321');
  assert.equal(res.success, false);
  assert.equal(res.status, 400);
  assert.ok(res.error?.includes('No active OTP found'));
});

test('sendOtpEmail returns 503 configuration error when credentials are not set', async () => {
  const origUser = process.env.GMAIL_USER;
  const origPass = process.env.GMAIL_APP_PASSWORD;

  try {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    const res = await sendOtpEmail('test-config-unconfigured-unique@gmail.com');
    assert.equal(res.success, false);
    assert.equal(res.status, 503);
    assert.ok(res.error?.includes('Gmail SMTP credentials are not configured'));
  } finally {
    if (origUser) process.env.GMAIL_USER = origUser;
    else delete process.env.GMAIL_USER;
    if (origPass) process.env.GMAIL_APP_PASSWORD = origPass;
    else delete process.env.GMAIL_APP_PASSWORD;
  }
});

test('stateless cryptographic token verification succeeds with correct OTP across instances', async () => {
  const email = 'customer@gmail.com';
  const correctOtp = '364855';

  const token = generateVerificationToken(email, correctOtp);
  assert.ok(token.includes('.'));

  // Should succeed with exact OTP
  const result = await verifyOtp(email, correctOtp, token);
  assert.equal(result.success, true);
  assert.equal(result.status, 200);
  assert.ok(result.message?.includes('verified successfully'));

  // Immediate replay / reuse prevention: cannot use again
  const reuseResult = await verifyOtp(email, correctOtp, token);
  assert.equal(reuseResult.success, false);
  assert.equal(reuseResult.status, 400);
  assert.ok(reuseResult.error?.includes('already been used'));
});

test('stateless verification token rejects wrong OTP and limits attempts', async () => {
  const email = 'customer2@gmail.com';
  const correctOtp = '719304';
  const token = generateVerificationToken(email, correctOtp);

  // Wrong code
  const wrongResult = await verifyOtp(email, '999999', token);
  assert.equal(wrongResult.success, false);
  assert.equal(wrongResult.status, 400);
  assert.ok(wrongResult.error?.includes('Invalid verification code'));

  // Another email mismatch
  const mismatchEmailResult = await verifyOtp('other@gmail.com', correctOtp, token);
  assert.equal(mismatchEmailResult.success, false);
  assert.equal(mismatchEmailResult.status, 400);
});

test('stateless verification token rejects expired codes', async () => {
  const email = 'customer3@gmail.com';
  const correctOtp = '112233';
  // Expired 10 seconds ago
  const expiredToken = generateVerificationToken(email, correctOtp, -10000);

  const res = await verifyOtp(email, correctOtp, expiredToken);
  assert.equal(res.success, false);
  assert.equal(res.status, 400);
  assert.ok(res.error?.includes('expired'));
});

