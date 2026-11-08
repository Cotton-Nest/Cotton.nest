import nodemailer from 'nodemailer';
import crypto from 'crypto';
import {
  buildCottonNestOtpHtml,
  buildCottonNestOtpText,
  generateVerificationToken,
} from '../otp-service';

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
    const gmailUser = (process.env.GMAIL_USER || 'adityaa.22082011@gmail.com')
      .trim()
      .replace(/^["'`]|["'`]$/g, '')
      .trim();
    const rawPass = (
      process.env.GMAIL_PASS ||
      process.env.GMAIL_APP_PASSWORD ||
      'ocdf vrlp hvvm xuiu'
    )
      .trim()
      .replace(/^["'`]|["'`]$/g, '')
      .trim();
    const gmailPass = rawPass.replace(/[\s-]+/g, ''); // Strip spaces and hyphens from 16-char Google App Password

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

    // 3. Configure Nodemailer transporter specifically for Gmail using an App Password (with port 465 SSL -> 587 STARTTLS fallback)
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

    // 4. Generate stateless verification token for serverless verification across Vercel lambdas
    const verificationToken = generateVerificationToken(cleanEmail, otp);

    console.log(`[Vercel Runtime OTP Success]: OTP dispatched to ${cleanEmail} via ${gmailUser}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent! Look for an email from Cotton Nest with the subject Cotton Nest OTP.',
      verificationToken,
      cooldownSeconds: 60,
    });
  } catch (error: any) {
    // Log exact error details so they are immediately visible in Vercel Runtime Logs
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
