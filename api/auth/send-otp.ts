import nodemailer from 'nodemailer';
import crypto from 'crypto';

const OTP_EXPIRY_MS = 5 * 60 * 1000;

function cleanEnvVal(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["'`]|["'`]$/g, '').trim();
}

function getOtpHmacSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'ocdfvrlphvvmxuiu';
  const cleaned = cleanEnvVal(secret).replace(/[\s-]+/g, '');
  return cleaned || 'cotton_nest_atelier_otp_secure_key_2026';
}

function generateVerificationToken(email: string, otp: string): string {
  const cleanEmail = email.trim().toLowerCase();
  const verificationSalt = crypto.randomBytes(16).toString('hex');
  const verificationExpiry = Date.now() + OTP_EXPIRY_MS;
  const hmacSignature = crypto
    .createHmac('sha256', getOtpHmacSecret())
    .update(`${cleanEmail}:${otp}:${verificationSalt}:${verificationExpiry}`)
    .digest('hex');
  return `${verificationExpiry}.${verificationSalt}.${hmacSignature}`;
}

function buildCottonNestOtpHtml(otp: string): string {
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
          <tr>
            <td style="padding:32px 28px 24px;background-color:#FAF7F2;border-bottom:1px solid #EAE2D5;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C29E57;font-weight:700;">Handcrafted Luxury Bedding</p>
              <h1 style="margin:0;font-size:26px;font-family:Georgia,serif;color:#2C2420;font-weight:bold;letter-spacing:-0.5px;">Cotton Nest</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;text-align:left;">
              <h2 style="margin:0 0 16px;font-size:19px;color:#8C2E46;font-family:Georgia,serif;font-weight:600;">Verify Your Email Address</h2>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4A3B32;">Hello,</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A3B32;">
                Thank you for choosing Cotton Nest. Please use the verification code below to verify your email address.
              </p>
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

function buildCottonNestOtpText(otp: string): string {
  return `Cotton Nest\n\nVerify Your Email Address\n\nHello,\n\nThank you for choosing Cotton Nest. Please use the verification code below to verify your email address.\n\n${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this verification code, you can safely ignore this email.\n\nThank you,\nTeam Cotton Nest`;
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

    const { email } = body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Read environment variables (GMAIL_USER and GMAIL_PASS / GMAIL_APP_PASSWORD)
    const gmailUser = cleanEnvVal(process.env.GMAIL_USER || 'adityaa.22082011@gmail.com');
    const rawPass = cleanEnvVal(
      process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'ocdf vrlp hvvm xuiu'
    );
    const gmailPass = rawPass.replace(/[\s-]+/g, '');

    if (!gmailUser || !gmailPass) {
      const missingErr = 'Missing Gmail SMTP environment variables: GMAIL_USER or GMAIL_PASS is not set.';
      console.error('[Vercel Runtime OTP Error]:', missingErr);
      return res.status(503).json({
        success: false,
        error: missingErr,
      });
    }

    // 2. Generate cryptographically secure 6-digit OTP
    const otp = String(crypto.randomInt(100000, 1000000));

    const mailOptions = {
      from: `"Cotton Nest" <${gmailUser}>`,
      to: cleanEmail,
      subject: 'Cotton Nest OTP',
      text: buildCottonNestOtpText(otp),
      html: buildCottonNestOtpHtml(otp),
    };

    // 3. Configure Nodemailer transporter specifically for Gmail using an App Password
    try {
      const transporter465 = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
        tls: { rejectUnauthorized: false },
      });
      await transporter465.sendMail(mailOptions);
    } catch (primaryErr: any) {
      console.warn('[Vercel Runtime OTP] Port 465 failed, retrying Port 587 STARTTLS:', primaryErr?.message);
      const transporter587 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
        tls: { rejectUnauthorized: false },
      });
      await transporter587.sendMail(mailOptions);
    }

    // 4. Generate stateless verification token
    const verificationToken = generateVerificationToken(cleanEmail, otp);

    console.log(`[Vercel Runtime OTP Success]: OTP dispatched to ${cleanEmail} via ${gmailUser}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent! Look for an email from Cotton Nest with the subject Cotton Nest OTP.',
      verificationToken,
      cooldownSeconds: 60,
    });
  } catch (error: any) {
    console.error('[Vercel Runtime OTP Error] Failed to send OTP email:', {
      message: error?.message,
      code: error?.code,
      response: error?.response,
      responseCode: error?.responseCode,
      command: error?.command,
      stack: error?.stack,
    });

    return res.status(500).json({
      success: false,
      error: `Failed to deliver OTP email (${error?.code || error?.responseCode || 'SMTP Error'}: ${error?.message || 'Unknown error'})`,
      details: error?.response || error?.code || null,
    });
  }
}
