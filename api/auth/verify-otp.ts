import crypto from 'crypto';

const MAX_ATTEMPTS = 5;
const usedTokensMemoryCache = new Set<string>();
const tokenAttemptsMemoryCache = new Map<string, number>();

function cleanEnvVal(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["'`]|["'`]$/g, '').trim();
}

function getOtpHmacSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'ocdfvrlphvvmxuiu';
  const cleaned = cleanEnvVal(secret).replace(/[\s-]+/g, '');
  return cleaned || 'cotton_nest_atelier_otp_secure_key_2026';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { email, otp, verificationToken, token } = body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ success: false, error: 'Verification code is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 6-digit verification code.',
      });
    }

    const tokenToVerify =
      typeof verificationToken === 'string' && verificationToken.trim()
        ? verificationToken.trim()
        : typeof token === 'string' && token.trim()
        ? token.trim()
        : undefined;

    if (!tokenToVerify || !tokenToVerify.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'No active verification session found. Please request a new code.',
      });
    }

    const parts = tokenToVerify.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification session. Please request a new code.',
      });
    }

    const [expStr, salt, providedHmac] = parts;
    const expiresAt = Number(expStr);
    const now = Date.now();

    if (isNaN(expiresAt) || now > expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      });
    }

    if (usedTokensMemoryCache.has(providedHmac)) {
      return res.status(400).json({
        success: false,
        error: 'This verification code has already been used. Please request a new code.',
      });
    }

    const attempts = (tokenAttemptsMemoryCache.get(providedHmac) || 0) + 1;
    tokenAttemptsMemoryCache.set(providedHmac, attempts);
    if (attempts > MAX_ATTEMPTS) {
      usedTokensMemoryCache.add(providedHmac);
      return res.status(400).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new verification code.',
      });
    }

    // Check against primary secret AND fallback secret in case env vars changed
    const candidateSecrets = Array.from(
      new Set([
        getOtpHmacSecret(),
        'ocdfvrlphvvmxuiu',
        'cotton_nest_atelier_otp_secure_key_2026',
      ])
    );

    let matched = false;
    const providedBuffer = Buffer.from(providedHmac);

    for (const sec of candidateSecrets) {
      const expectedHmac = crypto
        .createHmac('sha256', sec)
        .update(`${cleanEmail}:${cleanOtp}:${salt}:${expStr}`)
        .digest('hex');
      const expectedBuffer = Buffer.from(expectedHmac);
      if (
        expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        matched = true;
        break;
      }
    }

    if (matched) {
      usedTokensMemoryCache.add(providedHmac);
      return res.status(200).json({
        success: true,
        message: 'Email address verified successfully.',
      });
    } else {
      const remaining = MAX_ATTEMPTS - attempts;
      return res.status(400).json({
        success: false,
        error:
          remaining > 0
            ? `Invalid verification code. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
            : 'Too many incorrect attempts. Please request a new verification code.',
      });
    }
  } catch (err: any) {
    console.error('[Vercel Runtime Verify OTP Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'An unexpected error occurred while verifying the code.',
    });
  }
}
