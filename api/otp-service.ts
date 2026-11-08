import 'dotenv/config';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const EARN_POINTS_PER_100_INR = 5;
function calculateEarnedPoints(orderSubtotalInr: number): number {
  const safeSubtotal = Math.max(0, Number(orderSubtotalInr) || 0);
  return Math.floor((safeSubtotal / 100) * EARN_POINTS_PER_100_INR);
}

export interface OtpRecord {
  hashedOtp: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  lastRequestedAt: number;
}

export interface RateLimitRecord {
  count: number;
  firstRequestAt: number;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000; // Exactly 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_ATTEMPTS = 5; // 5 incorrect attempts before invalidating
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

// In-memory caches
const otpMemoryCache = new Map<string, OtpRecord>();
const rateLimitMemoryCache = new Map<string, RateLimitRecord>();
const usedTokensMemoryCache = new Set<string>();
const tokenAttemptsMemoryCache = new Map<string, number>();

function cleanEnvVal(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["'`]|["'`]$/g, '').trim();
}

export function getOtpHmacSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.GMAIL_APP_PASSWORD || '';
  const cleaned = cleanEnvVal(secret).replace(/\s+/g, '');
  return cleaned || 'cotton_nest_atelier_otp_secure_key_2026';
}

/**
 * Generates a signed, stateless verification token that encapsulates
 * the expiry timestamp, random salt, and HMAC signature of (email + otp + salt + expiry).
 * The raw OTP is NEVER included in the token or returned to the client.
 */
export function generateVerificationToken(
  email: string,
  otp: string,
  durationMs: number = OTP_EXPIRY_MS
): string {
  const cleanEmail = email.trim().toLowerCase();
  const verificationSalt = crypto.randomBytes(16).toString('hex');
  const verificationExpiry = Date.now() + durationMs;
  const hmacSignature = crypto
    .createHmac('sha256', getOtpHmacSecret())
    .update(`${cleanEmail}:${otp}:${verificationSalt}:${verificationExpiry}`)
    .digest('hex');
  return `${verificationExpiry}.${verificationSalt}.${hmacSignature}`;
}

// Persistent temporary file cache for cross-invocation resilience in serverless / container reloads
const TMP_CACHE_FILE = path.join(os.tmpdir(), 'cotton_nest_otp_store.json');

function loadCache(): void {
  try {
    if (fs.existsSync(TMP_CACHE_FILE)) {
      const raw = fs.readFileSync(TMP_CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && (v as any).expiresAt > now) {
            otpMemoryCache.set(k, v as OtpRecord);
          }
        }
      }
    }
  } catch {}
}

function persistCache(): void {
  try {
    const obj: Record<string, OtpRecord> = {};
    const now = Date.now();
    for (const [k, v] of otpMemoryCache.entries()) {
      if (v.expiresAt > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(TMP_CACHE_FILE, JSON.stringify(obj), 'utf-8');
  } catch {}
}

export interface AuthErrorDetails {
  senderEmail: string;
  fullSenderEmail: string;
  passLength: number;
  is16Chars: boolean;
  helpUrl: string;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 4) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
}

/**
 * Gets and validates the Gmail SMTP configuration from environment variables.
 */
export function getGmailConfig(): {
  user: string;
  pass: string;
  rawPassLength: number;
  isLikelyAppPassword: boolean;
} | null {
  let user = cleanEnvVal(process.env.GMAIL_USER);
  if (!user) return null;
  if (!user.includes('@')) {
    user = `${user}@gmail.com`;
  }
  user = user.toLowerCase();

  // Support both process.env.GMAIL_PASS and process.env.GMAIL_APP_PASSWORD
  const rawPass = cleanEnvVal(process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD);
  // Google App Passwords are 16 letters (e.g. 'abcd efgh ijkl mnop' or 'abcd-efgh-ijkl-mnop').
  // Remove all whitespace, hyphens, and quotes:
  const pass = rawPass.replace(/[\s-]+/g, '').replace(/["'`]/g, '');

  if (!pass) {
    return null;
  }
  return {
    user,
    pass,
    rawPassLength: pass.length,
    isLikelyAppPassword: pass.length === 16 && /^[a-zA-Z]+$/.test(pass),
  };
}

/**
 * Creates a Nodemailer transporter specifically configured for Gmail with an App Password.
 */
export function createGmailTransporter(config: { user: string; pass: string }, port = 465) {
  if (port === 587) {
    return nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
      requireTLS: true,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    });
  }

  // Default: Gmail SMTP with App Password over Direct SSL port 465
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
}

/**
 * Generates a branded, responsive HTML email for Cotton Nest OTP.
 */
export function buildCottonNestOtpHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotton Nest OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2420;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#FFFFFF;border-radius:24px;border:1px solid #DEC89B;box-shadow:0 8px 30px rgba(44,36,32,0.06);overflow:hidden;text-align:center;" cellpadding="0" cellspacing="0">
          <!-- Header Banner -->
          <tr>
            <td style="padding:32px 28px 24px;background-color:#FAF7F2;border-bottom:1px solid #EAE2D5;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C29E57;font-weight:700;">Handcrafted Luxury Bedding</p>
              <h1 style="margin:0;font-size:26px;font-family:Georgia,serif;color:#2C2420;font-weight:bold;letter-spacing:-0.5px;">Cotton Nest</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:left;">
              <h2 style="margin:0 0 16px;font-size:19px;color:#8C2E46;font-family:Georgia,serif;font-weight:600;">Verify Your Email Address</h2>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4A3B32;">Hello,</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A3B32;">
                Thank you for choosing Cotton Nest. Please use the verification code below to verify your email address.
              </p>

              <!-- OTP Display Box -->
              <div style="background-color:#FAF7F2;border:2px dashed #C29E57;border-radius:16px;padding:22px 16px;text-align:center;margin:24px 0;">
                <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7A6458;display:block;margin-bottom:8px;font-weight:600;">Your 6-Digit Verification Code</span>
                <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#8C2E46;font-family:'Courier New',Courier,monospace;display:inline-block;padding:4px 16px;background:#FFFFFF;border-radius:10px;border:1px solid #DEC89B;">
                  ${otp}
                </span>
              </div>

              <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#8C7A70;font-weight:500;">
                ⏱ This code expires in <strong>5 minutes</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#8C7A70;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
              <div style="border-top:1px solid #EAE2D5;padding-top:20px;margin-top:20px;">
                <p style="margin:0;font-size:14px;color:#2C2420;font-weight:600;">Thank you,</p>
                <p style="margin:4px 0 0;font-size:14px;color:#8C2E46;font-weight:600;">Team Cotton Nest</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;background-color:#FAF7F2;border-top:1px solid #EAE2D5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#A89890;line-height:1.5;">
                Cotton Nest Atelier · Sector 46, Gurgaon, Haryana · 100% Breathable Pure Cotton
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text alternative for non-HTML email clients.
 */
export function buildCottonNestOtpText(otp: string): string {
  return `Cotton Nest

Verify Your Email Address

Hello,

Thank you for choosing Cotton Nest. Please use the verification code below to verify your email address.

${otp}

This code expires in 5 minutes.

If you did not request this verification code, you can safely ignore this email.

Thank you,
Team Cotton Nest`;
}

/**
 * Normalizes email address for lookups.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Generates and stores a cryptographically secure 6-digit OTP, then sends it via Gmail SMTP.
 */
export async function sendOtpEmail(email: string): Promise<{
  success: boolean;
  message?: string;
  verificationToken?: string;
  cooldownSeconds?: number;
  error?: string;
  authErrorDetails?: AuthErrorDetails;
  status: number;
}> {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return {
      success: false,
      error: 'Please enter a valid email address.',
      status: 400,
    };
  }

  // 1. Check Rate Limits (Max 5 requests per 15 minutes)
  const now = Date.now();
  const rateLimit = rateLimitMemoryCache.get(cleanEmail);
  if (rateLimit) {
    if (now - rateLimit.firstRequestAt < RATE_LIMIT_WINDOW_MS) {
      if (rateLimit.count >= MAX_REQUESTS_PER_WINDOW) {
        return {
          success: false,
          error: 'Too many OTP requests. Please wait a few minutes before trying again.',
          status: 429,
        };
      }
      rateLimit.count += 1;
    } else {
      rateLimitMemoryCache.set(cleanEmail, { count: 1, firstRequestAt: now });
    }
  } else {
    rateLimitMemoryCache.set(cleanEmail, { count: 1, firstRequestAt: now });
  }

  // 2. Check Resend Cooldown (60 seconds)
  if (!otpMemoryCache.has(cleanEmail)) {
    loadCache();
  }
  const existingOtp = otpMemoryCache.get(cleanEmail);
  if (existingOtp && now < existingOtp.expiresAt) {
    const elapsed = now - existingOtp.lastRequestedAt;
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        cooldownSeconds: waitSeconds,
        status: 429,
      };
    }
  }

  // 3. Verify Gmail SMTP credentials
  const config = getGmailConfig();
  if (!config) {
    console.error('[OTP Runtime Error] Gmail SMTP credentials missing: process.env.GMAIL_USER and process.env.GMAIL_PASS (or GMAIL_APP_PASSWORD) are not set.');
    return {
      success: false,
      error: 'Gmail SMTP credentials are not configured on the server. Please set GMAIL_USER and GMAIL_PASS in your backend environment variables.',
      status: 503,
    };
  }

  // 4. Generate cryptographically secure 6-digit OTP
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedOtp = crypto.createHash('sha256').update(rawOtp + salt).digest('hex');

  // 5. Send via Gmail SMTP with dual-port fallback (Port 465 SSL primary, Port 587 STARTTLS fallback)
  try {
    const mailOptions = {
      from: `"Cotton Nest" <${config.user}>`,
      to: cleanEmail,
      subject: 'Cotton Nest OTP', // Exact subject required
      text: buildCottonNestOtpText(rawOtp),
      html: buildCottonNestOtpHtml(rawOtp),
    };

    let sendError: any = null;
    try {
      const transporter465 = createGmailTransporter(config, 465);
      await transporter465.sendMail(mailOptions);
    } catch (primaryErr: any) {
      sendError = primaryErr;
      console.error('[OTP SMTP Port 465 Error]:', primaryErr.message || primaryErr);
      // If network/connection error on port 465, retry on port 587 STARTTLS
      if (
        primaryErr.code === 'ECONNREFUSED' ||
        primaryErr.code === 'ETIMEDOUT' ||
        primaryErr.code === 'ESOCKETTIMEDOUT' ||
        primaryErr.code === 'ENOTFOUND'
      ) {
        try {
          const transporter587 = createGmailTransporter(config, 587);
          await transporter587.sendMail(mailOptions);
          sendError = null;
        } catch (fallbackErr: any) {
          console.error('[OTP SMTP Port 587 Fallback Error]:', fallbackErr.message || fallbackErr);
          sendError = fallbackErr;
        }
      }
    }

    if (sendError) {
      throw sendError;
    }

    // 6. Save hashed OTP in store only after successful dispatch
    otpMemoryCache.set(cleanEmail, {
      hashedOtp,
      salt,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0,
      createdAt: now,
      lastRequestedAt: now,
    });
    persistCache();

    // 7. Generate stateless cryptographic HMAC verification token
    const verificationToken = generateVerificationToken(cleanEmail, rawOtp, OTP_EXPIRY_MS);

    return {
      success: true,
      message: 'OTP sent! Look for an email from Cotton Nest with the subject Cotton Nest OTP.',
      verificationToken,
      cooldownSeconds: 60,
      status: 200,
    };
  } catch (err: any) {
    console.error('[Vercel Runtime OTP Email Error] Exact failure reason:', {
      message: err?.message,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
      command: err?.command,
      stack: err?.stack,
    });

    const isAuthError =
      err.code === 'EAUTH' ||
      err.responseCode === 535 ||
      String(err.message || '').includes('535') ||
      String(err.message || '').includes('Username and Password not accepted');

    let clientMessage = 'Failed to deliver OTP email. Please verify your address and try again.';
    let authErrorDetails: AuthErrorDetails | undefined = undefined;

    if (isAuthError) {
      const masked = maskEmail(config.user);
      authErrorDetails = {
        senderEmail: masked,
        fullSenderEmail: config.user,
        passLength: config.pass.length,
        is16Chars: config.pass.length === 16,
        helpUrl: 'https://myaccount.google.com/apppasswords',
      };

      if (config.pass.length !== 16) {
        clientMessage = `Gmail SMTP login failed for sender ${masked}. The configured App Password is ${config.pass.length} characters long, but Google App Passwords must be exactly 16 letters (from myaccount.google.com/apppasswords). Personal account passwords cannot be used for SMTP.`;
      } else {
        clientMessage = `Gmail SMTP authentication failed for sender ${masked}. Google rejected the 16-character App Password. Please check: 1) The App Password was generated specifically under ${masked}. 2) 2-Step Verification is active on that Google account.`;
      }
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      clientMessage = 'Connection to Gmail SMTP timed out. Please check network connection and try again.';
    } else if (err.code === 'ECONNREFUSED') {
      clientMessage = 'Unable to establish secure connection with Gmail SMTP servers.';
    }

    return {
      success: false,
      error: clientMessage,
      authErrorDetails,
      status: isAuthError ? 401 : 500,
    };
  }
}

/**
 * Securely verifies a customer's entered OTP against the hashed store or stateless cryptographic token.
 */
export async function verifyOtp(
  email: string,
  enteredOtp: string,
  verificationToken?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  status: number;
}> {
  const cleanEmail = normalizeEmail(email);
  const cleanOtp = (enteredOtp || '').trim();

  if (!cleanEmail) {
    return {
      success: false,
      error: 'Email address is required.',
      status: 400,
    };
  }

  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit verification code.',
      status: 400,
    };
  }

  const now = Date.now();

  // Method 1: Cryptographic HMAC Verification Token (Stateless, 100% resilient across serverless instances)
  if (verificationToken && typeof verificationToken === 'string' && verificationToken.includes('.')) {
    const parts = verificationToken.split('.');
    if (parts.length === 3) {
      const [expStr, salt, providedHmac] = parts;
      const expiresAt = Number(expStr);

      if (isNaN(expiresAt) || now > expiresAt) {
        return {
          success: false,
          error: 'Verification code has expired. Please request a new code.',
          status: 400,
        };
      }

      if (usedTokensMemoryCache.has(providedHmac)) {
        return {
          success: false,
          error: 'This verification code has already been used. Please request a new code.',
          status: 400,
        };
      }

      const attempts = (tokenAttemptsMemoryCache.get(providedHmac) || 0) + 1;
      tokenAttemptsMemoryCache.set(providedHmac, attempts);
      if (attempts > MAX_ATTEMPTS) {
        usedTokensMemoryCache.add(providedHmac);
        return {
          success: false,
          error: 'Too many incorrect attempts. Please request a new verification code.',
          status: 400,
        };
      }

      const expectedHmac = crypto
        .createHmac('sha256', getOtpHmacSecret())
        .update(`${cleanEmail}:${cleanOtp}:${salt}:${expStr}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedHmac);
      const providedBuffer = Buffer.from(providedHmac);

      if (
        expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        // Success! Invalidate token immediately
        usedTokensMemoryCache.add(providedHmac);
        otpMemoryCache.delete(cleanEmail);
        persistCache();

        return {
          success: true,
          message: 'Email address verified successfully.',
          status: 200,
        };
      } else {
        const remaining = MAX_ATTEMPTS - attempts;
        return {
          success: false,
          error:
            remaining > 0
              ? `Invalid verification code. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
              : 'Too many incorrect attempts. Please request a new verification code.',
          status: 400,
        };
      }
    }
  }

  // Method 2: In-Memory / Temporary Disk Cache (for single-process development or requests without token)
  if (!otpMemoryCache.has(cleanEmail)) {
    loadCache();
  }

  const record = otpMemoryCache.get(cleanEmail);

  if (!record) {
    return {
      success: false,
      error: 'No active OTP found for this email. Please request a new code.',
      status: 400,
    };
  }

  // Check Expiry
  if (now > record.expiresAt) {
    otpMemoryCache.delete(cleanEmail);
    persistCache();
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
      status: 400,
    };
  }

  // Increment Attempts
  record.attempts += 1;
  if (record.attempts > MAX_ATTEMPTS) {
    otpMemoryCache.delete(cleanEmail);
    persistCache();
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
      status: 400,
    };
  }
  persistCache();

  // Check Hash
  const computedHash = crypto.createHash('sha256').update(cleanOtp + record.salt).digest('hex');

  if (computedHash !== record.hashedOtp) {
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      error:
        remaining > 0
          ? `Invalid verification code. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
          : 'Too many incorrect attempts. Please request a new verification code.',
      status: 400,
    };
  }

  // Success! Invalidate OTP immediately to prevent reuse
  otpMemoryCache.delete(cleanEmail);
  persistCache();

  return {
    success: true,
    message: 'Email address verified successfully.',
    status: 200,
  };
}

export const COTTON_NEST_LOGO_URL = 'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png';

export interface InvoiceOrderPayload {
  orderId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingMethod?: string;
  subtotal: number;
  totalSavings?: number;
  couponCode?: string;
  couponDiscount?: number;
  pointsUsed?: number;
  pointsDiscount?: number;
  shippingCost?: number;
  finalTotal: number;
  pointsEarned?: number;
  items: Array<{
    name: string;
    variantName?: string;
    dimensions?: string;
    quantity: number;
    price: number;
    imageUrl: string;
  }>;
  createdAt?: string;
}

export function buildCottonNestInvoiceHtml(payload: InvoiceOrderPayload): string {
  const dateStr = payload.createdAt
    ? new Date(payload.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const refId = payload.orderId.startsWith('CN-') ? payload.orderId : `CN-${payload.orderId}`;
  const eligibleAmount = Math.max(0, payload.finalTotal - (payload.shippingCost || 0));
  const pointsEarned = typeof payload.pointsEarned === 'number' && payload.pointsEarned > 0
    ? payload.pointsEarned
    : calculateEarnedPoints(eligibleAmount);
  const pointsWorthInr = Math.floor(pointsEarned * 0.5);

  const couponDiscount = payload.couponDiscount || 0;
  const pointsDiscount = payload.pointsDiscount || 0;
  const shippingCost = payload.shippingCost || 0;

  const itemRowsHtml = (payload.items || [])
    .map((item) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const lineTotal = price * qty;
      const imgUrl = item.imageUrl || 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const variantText = item.variantName ? `<span style="color:#7A6458;font-size:12px;"> · ${item.variantName}</span>` : '';
      const dimsText = item.dimensions ? `<br/><span style="color:#8C7A70;font-size:11px;">Size: ${item.dimensions}</span>` : '';

      return `<tr>
        <td style="padding:14px 12px;border-bottom:1px solid #EAE2D5;vertical-align:middle;width:68px;">
          <img src="${imgUrl}" alt="${item.name}" width="60" height="60" style="object-fit:cover;border-radius:12px;border:1px solid #DEC89B;display:block;width:60px;height:60px;" />
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #EAE2D5;vertical-align:middle;">
          <strong style="color:#2C2420;font-size:13px;line-height:1.4;display:block;">${item.name}${variantText}</strong>
          ${dimsText}
          <div style="color:#C29E57;font-size:10px;margin-top:3px;font-weight:600;letter-spacing:0.3px;">☁️ 100% Pure Combed Cotton</div>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #EAE2D5;vertical-align:middle;text-align:center;color:#2C2420;font-weight:600;font-size:13px;">
          ${qty}
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #EAE2D5;vertical-align:middle;text-align:right;color:#2C2420;font-weight:bold;font-size:13px;">
          ₹${lineTotal.toLocaleString('en-IN')}
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotton Nest Sale Invoice #${refId}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2420;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" style="max-width:540px;background-color:#FFFFFF;border-radius:24px;border:1px solid #DEC89B;box-shadow:0 8px 30px rgba(44,36,32,0.06);overflow:hidden;text-align:center;" cellpadding="0" cellspacing="0">
          
          <!-- Header Banner with Store Logo -->
          <tr>
            <td style="padding:32px 28px 24px;background-color:#FAF7F2;border-bottom:1px solid #EAE2D5;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td align="center">
                    <a href="https://cottonnest.in" target="_blank" style="text-decoration:none;display:inline-block;">
                      <img
                        src="${COTTON_NEST_LOGO_URL}"
                        alt="Cotton Nest Logo"
                        width="68"
                        height="68"
                        style="display:block;width:68px;height:68px;max-width:68px;object-fit:contain;margin:0 auto;border:0;outline:none;"
                      />
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C29E57;font-weight:700;">Handcrafted Luxury Bedding</p>
              <h1 style="margin:0 0 4px;font-size:26px;font-family:Georgia,serif;color:#2C2420;font-weight:bold;letter-spacing:-0.5px;">Cotton Nest</h1>
              <p style="margin:0;font-size:12px;color:#7A6458;letter-spacing:1px;text-transform:uppercase;">Feel The Softness · Sector 46 Gurgaon</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px 28px 24px;text-align:left;">
              <h2 style="margin:0 0 14px;font-size:19px;color:#8C2E46;font-family:Georgia,serif;font-weight:600;">Official Sale Invoice &amp; Order Receipt</h2>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4A3B32;">Hello ${payload.customerName || 'Valued Customer'},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A3B32;">
                Thank you for choosing Cotton Nest. Your order for 100% breathable pure cotton bedding has been confirmed by our atelier. Below is your official sale invoice with itemized details and earned Nest Points.
              </p>

              <!-- Order Number & Status Highlight Box -->
              <div style="background-color:#FAF7F2;border:2px dashed #C29E57;border-radius:16px;padding:22px 18px;text-align:center;margin:22px 0;">
                <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7A6458;display:block;margin-bottom:8px;font-weight:600;">Official Sale Invoice Number</span>
                <span style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#8C2E46;font-family:'Courier New',Courier,monospace;display:inline-block;padding:6px 18px;background:#FFFFFF;border-radius:10px;border:1px solid #DEC89B;">
                  #${refId}
                </span>
                <div style="margin-top:10px;font-size:18px;font-weight:bold;color:#2C2420;">
                  Total Amount Paid: ₹${payload.finalTotal.toLocaleString('en-IN')}
                </div>
                <div style="margin-top:6px;display:inline-block;padding:3px 10px;background-color:#E8F5E9;border:1px solid #C8E6C9;border-radius:20px;font-size:11px;color:#2E7D32;font-weight:600;">
                  ✓ Order Confirmed by Cotton Nest Atelier
                </div>
              </div>

              <!-- Customer & Delivery Details -->
              <div style="background-color:#FAF7F2;border:1px solid #EAE2D5;border-radius:14px;padding:16px 18px;margin-bottom:22px;">
                <span style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8C7A70;font-weight:700;display:block;margin-bottom:8px;">
                  Customer &amp; Delivery Details
                </span>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;color:#4A3B32;">
                  <tr><td style="padding-bottom:3px;"><strong>Date &amp; Time:</strong> ${dateStr}</td></tr>
                  <tr><td style="padding-bottom:3px;"><strong>Recipient Name:</strong> ${payload.customerName}</td></tr>
                  ${payload.customerPhone ? `<tr><td style="padding-bottom:3px;"><strong>Phone / WhatsApp:</strong> +91 ${payload.customerPhone}</td></tr>` : ''}
                  ${payload.customerEmail ? `<tr><td style="padding-bottom:3px;"><strong>Email:</strong> ${payload.customerEmail}</td></tr>` : ''}
                  ${payload.customerAddress ? `<tr><td style="padding-bottom:3px;"><strong>Delivery Address:</strong> ${payload.customerAddress}</td></tr>` : ''}
                  ${payload.shippingMethod ? `<tr><td><strong>Shipping Speed:</strong> ${payload.shippingMethod}</td></tr>` : ''}
                </table>
              </div>

              <!-- Summary of Purchased Items Table -->
              <span style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8C7A70;font-weight:700;display:block;margin-bottom:8px;">
                Summary of Purchased Items
              </span>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:22px;border:1px solid #EAE2D5;border-radius:14px;overflow:hidden;width:100%;">
                <thead>
                  <tr style="background-color:#FAF7F2;border-bottom:1px solid #DEC89B;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8C7A70;">
                    <th style="padding:10px 12px;" colspan="2">Item Description</th>
                    <th style="padding:10px 12px;text-align:center;">Qty</th>
                    <th style="padding:10px 12px;text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                </tbody>
              </table>

              <!-- Financial Summary Box -->
              <div style="background-color:#FAF7F2;border:1px solid #DEC89B;border-radius:16px;padding:18px 20px;margin-bottom:22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.9;color:#4A3B32;">
                  <tr>
                    <td>Bag Subtotal</td>
                    <td align="right" style="font-weight:600;color:#2C2420;">₹${payload.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                  ${couponDiscount > 0 ? `<tr>
                    <td style="color:#8C2E46;">Coupon Discount (${payload.couponCode || 'Applied'})</td>
                    <td align="right" style="color:#8C2E46;font-weight:bold;">-₹${couponDiscount.toLocaleString('en-IN')}</td>
                  </tr>` : ''}
                  ${pointsDiscount > 0 ? `<tr>
                    <td style="color:#8C2E46;">Nest Points Redeemed</td>
                    <td align="right" style="color:#8C2E46;font-weight:bold;">-₹${pointsDiscount.toLocaleString('en-IN')}</td>
                  </tr>` : ''}
                  <tr>
                    <td>Delivery &amp; Shipping</td>
                    <td align="right" style="font-weight:600;color:#2C2420;">${shippingCost > 0 ? `₹${shippingCost.toLocaleString('en-IN')}` : 'FREE Express Delivery'}</td>
                  </tr>
                  <tr style="border-top:1px solid #DEC89B;font-size:15px;font-weight:bold;">
                    <td style="padding-top:10px;color:#8C2E46;">Grand Total Paid</td>
                    <td align="right" style="padding-top:10px;color:#8C2E46;font-size:18px;">₹${payload.finalTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>

              <!-- Loyalty Points Earned Feature Card -->
              <div style="background-color:#FFFBF0;border:1.5px solid #DEC89B;border-radius:16px;padding:18px 20px;margin-bottom:22px;text-align:center;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <div style="display:inline-block;padding:6px 14px;background-color:#FAF7F2;border:1px solid #C29E57;border-radius:20px;font-size:11px;font-weight:700;color:#8C2E46;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">
                        ✨ NEST REWARDS LOYALTY CLUB
                      </div>
                      <h3 style="margin:0 0 6px;font-size:18px;color:#8C2E46;font-family:Georgia,serif;font-weight:bold;">
                        🎁 +${pointsEarned} Nest Points Earned!
                      </h3>
                      <p style="margin:0 0 8px;font-size:13px;color:#4A3B32;line-height:1.5;">
                        You have earned <strong>5 Nest Points for every ₹100 spent</strong> on this purchase (excluding shipping).
                      </p>
                      <div style="display:inline-block;background-color:#FFFFFF;border:1px solid #DEC89B;border-radius:10px;padding:6px 14px;font-size:12px;color:#2C2420;font-weight:600;">
                        Worth ₹${pointsWorthInr} discount on your next handcrafted bedsheet order
                      </div>
                      <p style="margin:8px 0 0;font-size:11px;color:#7A6458;">
                        Points are credited instantly to your account and valid for 12 months.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Fabric Reassurance & Care -->
              <div style="background-color:#FAF7F2;border-radius:12px;padding:12px 16px;margin-bottom:20px;">
                <p style="margin:0;font-size:12px;color:#4A3B32;line-height:1.6;">
                  🌿 <strong>Atelier Quality Guarantee:</strong> Handcrafted with long-staple 100% breathable cotton at Sector 46 Gurgaon. Machine wash cold with mild detergent, avoid bleach.
                </p>
              </div>

              <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#8C7A70;">
                For order tracking or exchange support, call or WhatsApp our atelier at <strong>+91 7838625915</strong> or reply directly to this email.
              </p>

              <!-- Sign-off -->
              <div style="border-top:1px solid #EAE2D5;padding-top:20px;margin-top:20px;">
                <p style="margin:0;font-size:14px;color:#2C2420;font-weight:600;">Thank you,</p>
                <p style="margin:4px 0 0;font-size:14px;color:#8C2E46;font-weight:600;">Team Cotton Nest</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px;background-color:#FAF7F2;border-top:1px solid #EAE2D5;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:#7A6458;font-weight:600;">
                Cotton Nest Atelier · Sector 46, Gurgaon, Haryana
              </p>
              <p style="margin:0;font-size:11px;color:#A89890;line-height:1.5;">
                100% Breathable Pure Cotton · Handcrafted in India · Helpline: +91 7838625915
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildCottonNestInvoiceText(payload: InvoiceOrderPayload): string {
  const refId = payload.orderId.startsWith('CN-') ? payload.orderId : `CN-${payload.orderId}`;
  const dateStr = payload.createdAt
    ? new Date(payload.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const eligibleAmount = Math.max(0, payload.finalTotal - (payload.shippingCost || 0));
  const pointsEarned = typeof payload.pointsEarned === 'number' && payload.pointsEarned > 0
    ? payload.pointsEarned
    : calculateEarnedPoints(eligibleAmount);
  const pointsWorthInr = Math.floor(pointsEarned * 0.5);

  const lines = [
    `COTTON NEST - OFFICIAL SALE INVOICE`,
    `Feel The Softness · Sector 46, Gurgaon, Haryana`,
    `Logo: ${COTTON_NEST_LOGO_URL}`,
    ``,
    `Hello ${payload.customerName || 'Valued Customer'},`,
    ``,
    `Thank you for choosing Cotton Nest. Your order has been confirmed by our atelier.`,
    ``,
    `====================================================`,
    `SALE INVOICE NUMBER: #${refId}`,
    `Order Date & Time: ${dateStr}`,
    `Status: Confirmed by Cotton Nest Atelier`,
    `Total Amount: ₹${payload.finalTotal.toLocaleString('en-IN')}`,
    `====================================================`,
    `CUSTOMER & DELIVERY DETAILS:`,
    `Name: ${payload.customerName}`,
  ];

  if (payload.customerEmail) lines.push(`Email: ${payload.customerEmail}`);
  if (payload.customerPhone) lines.push(`Phone / WhatsApp: +91 ${payload.customerPhone}`);
  if (payload.customerAddress) lines.push(`Delivery Address: ${payload.customerAddress}`);
  if (payload.shippingMethod) lines.push(`Shipping Speed: ${payload.shippingMethod}`);

  lines.push(`----------------------------------------------------`);
  lines.push(`SUMMARY OF PURCHASED ITEMS:`);

  (payload.items || []).forEach((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const total = qty * price;
    const variantStr = item.variantName ? ` (${item.variantName})` : '';
    const dimsStr = item.dimensions ? ` - Size: ${item.dimensions}` : '';
    lines.push(`${idx + 1}. ${item.name}${variantStr}${dimsStr}`);
    lines.push(`   Quantity: ${qty} Set(s) | Price: ₹${price.toLocaleString('en-IN')} | Total: ₹${total.toLocaleString('en-IN')}`);
    if (item.imageUrl) {
      lines.push(`   Photo: ${item.imageUrl}`);
    }
  });

  lines.push(`----------------------------------------------------`);
  lines.push(`FINANCIAL SUMMARY:`);
  lines.push(`Bag Subtotal: ₹${payload.subtotal.toLocaleString('en-IN')}`);

  if (payload.couponDiscount && payload.couponDiscount > 0) {
    lines.push(`Coupon Discount (${payload.couponCode || 'Applied'}): -₹${payload.couponDiscount.toLocaleString('en-IN')}`);
  }
  if (payload.pointsDiscount && payload.pointsDiscount > 0) {
    lines.push(`Nest Loyalty Points Redeemed: -₹${payload.pointsDiscount.toLocaleString('en-IN')}`);
  }
  lines.push(`Delivery & Shipping: ${payload.shippingCost && payload.shippingCost > 0 ? `+₹${payload.shippingCost.toLocaleString('en-IN')}` : 'FREE Express Delivery'}`);
  lines.push(`GRAND TOTAL AMOUNT: ₹${payload.finalTotal.toLocaleString('en-IN')}`);
  lines.push(`----------------------------------------------------`);
  lines.push(`🎁 NEST LOYALTY POINTS EARNED:`);
  lines.push(`+${pointsEarned} Points Credited (worth ₹${pointsWorthInr} discount on future orders)`);
  lines.push(`Earning Rate: 5 Nest Points per ₹100 spent (excluding shipping)`);
  lines.push(`----------------------------------------------------`);
  lines.push(``);
  lines.push(`Thank you,`);
  lines.push(`Team Cotton Nest`);
  lines.push(``);
  lines.push(`Cotton Nest Atelier · Sector 46, Gurgaon, Haryana · 100% Breathable Pure Cotton`);

  return lines.join('\n');
}

export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendOrderInvoiceEmail(payload: InvoiceOrderPayload): Promise<{
  success: boolean;
  sentViaSmtp: boolean;
  message?: string;
  recipients?: string[];
  gmailComposeUrl?: string;
  html?: string;
  text?: string;
  error?: string;
}> {
  try {
    const config = getGmailConfig();
    const recipientEmails = new Set<string>();

    // Always include store admin email
    recipientEmails.add('adityaa.451485@gmail.com');
    if (config?.user) {
      recipientEmails.add(config.user.toLowerCase());
    }
    // Include customer/buyer email if provided
    if (payload.customerEmail && payload.customerEmail.includes('@') && !payload.customerEmail.endsWith('@cottonnest.orders')) {
      recipientEmails.add(payload.customerEmail.trim().toLowerCase());
    }

    const refId = payload.orderId.startsWith('CN-') ? payload.orderId : `CN-${payload.orderId}`;
    const htmlContent = buildCottonNestInvoiceHtml(payload);
    const textContent = buildCottonNestInvoiceText(payload);
    const recipientsList = Array.from(recipientEmails).join(', ');
    const subject = `Cotton Nest - Order #${refId} Sale Invoice`;
    const gmailComposeUrl = buildGmailComposeUrl(recipientsList, subject, textContent);

    if (config) {
      const mailOptions = {
        from: `"Cotton Nest" <${config.user}>`, // Identical sender identity as OTP email
        to: recipientsList,
        subject,
        text: textContent,
        html: htmlContent,
      };

      let sendError: any = null;
      try {
        // Primary port: 465 (SSL)
        const transporter465 = createGmailTransporter(config, 465);
        await transporter465.sendMail(mailOptions);
      } catch (primaryErr: any) {
        sendError = primaryErr;
        console.warn('[INVOICE EMAIL] Primary Port 465 failed, attempting Port 587 STARTTLS fallback...', primaryErr.code || primaryErr.message);
        if (
          primaryErr.code === 'ECONNREFUSED' ||
          primaryErr.code === 'ETIMEDOUT' ||
          primaryErr.code === 'ESOCKETTIMEDOUT' ||
          primaryErr.code === 'ENOTFOUND'
        ) {
          try {
            const transporter587 = createGmailTransporter(config, 587);
            await transporter587.sendMail(mailOptions);
            sendError = null;
            console.log('[INVOICE EMAIL] Port 587 STARTTLS fallback succeeded');
          } catch (fallbackErr: any) {
            sendError = fallbackErr;
          }
        }
      }

      if (sendError) {
        throw sendError;
      }

      console.log(`[INVOICE EMAIL] Sent successfully via Gmail SMTP to: ${recipientsList}`);
      return {
        success: true,
        sentViaSmtp: true,
        message: `Invoice email dispatched to ${recipientsList}`,
        recipients: Array.from(recipientEmails),
        gmailComposeUrl,
        html: htmlContent,
        text: textContent,
      };
    } else {
      console.warn(`[INVOICE EMAIL] SMTP credentials not configured in environment. Generated invoice for #${payload.orderId} to: ${recipientsList}`);
      return {
        success: true,
        sentViaSmtp: false,
        message: `Invoice generated for Order #${payload.orderId}`,
        recipients: Array.from(recipientEmails),
        gmailComposeUrl,
        html: htmlContent,
        text: textContent,
      };
    }
  } catch (err: any) {
    console.error('Failed to send order invoice email:', err);
    return {
      success: false,
      sentViaSmtp: false,
      error: err.message || 'Failed to send invoice email',
    };
  }
}
