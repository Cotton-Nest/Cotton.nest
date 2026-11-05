import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

function cleanEnvVal(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Gets and validates the Gmail SMTP configuration from environment variables.
 */
export function getGmailConfig(): { user: string; pass: string } | null {
  const user = cleanEnvVal(process.env.GMAIL_USER);
  // Google App Passwords are 16 characters often presented as 'xxxx xxxx xxxx xxxx'.
  // Strip all whitespace to ensure correct authentication.
  const pass = cleanEnvVal(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }
  return { user, pass };
}

/**
 * Creates a Nodemailer transporter for Gmail SMTP on port 465 (SSL).
 */
export function createGmailTransporter(config: { user: string; pass: string }) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 SSL
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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
  cooldownSeconds?: number;
  error?: string;
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
    console.error('OTP Send Error: GMAIL_USER or GMAIL_APP_PASSWORD is not set in backend environment.');
    return {
      success: false,
      error: 'Gmail SMTP credentials are not configured on the server. Please set GMAIL_USER and GMAIL_APP_PASSWORD in your backend environment variables.',
      status: 503,
    };
  }

  // 4. Generate cryptographically secure 6-digit OTP
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedOtp = crypto.createHash('sha256').update(rawOtp + salt).digest('hex');

  // 5. Send via Gmail SMTP
  try {
    const transporter = createGmailTransporter(config);

    const mailOptions = {
      from: `"Cotton Nest" <${config.user}>`,
      to: cleanEmail,
      subject: 'Cotton Nest OTP', // Exact subject required
      text: buildCottonNestOtpText(rawOtp),
      html: buildCottonNestOtpHtml(rawOtp),
    };

    await transporter.sendMail(mailOptions);

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

    return {
      success: true,
      message: 'OTP sent! Look for an email from Cotton Nest with the subject Cotton Nest OTP.',
      cooldownSeconds: 60,
      status: 200,
    };
  } catch (err: any) {
    console.error('Failed to send OTP via Gmail SMTP:', err.message || err);

    let clientMessage = 'Failed to deliver OTP email. Please verify your address and try again.';

    if (err.code === 'EAUTH' || err.responseCode === 535) {
      clientMessage = 'Gmail SMTP authentication failed. Please verify that your GMAIL_USER and Gmail App Password are correct.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      clientMessage = 'Connection to Gmail SMTP timed out. Please check network connection and try again.';
    } else if (err.code === 'ECONNREFUSED') {
      clientMessage = 'Unable to establish secure connection with Gmail SMTP servers.';
    }

    return {
      success: false,
      error: clientMessage,
      status: 500,
    };
  }
}

/**
 * Securely verifies a customer's entered OTP against the hashed store.
 */
export async function verifyOtp(email: string, enteredOtp: string): Promise<{
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

  const now = Date.now();

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
      error: remaining > 0
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
