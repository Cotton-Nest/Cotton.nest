import { verifyOtp } from '../otp-service.ts';

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

    const tokenToVerify = typeof verificationToken === 'string' && verificationToken.trim()
      ? verificationToken.trim()
      : typeof token === 'string' && token.trim()
      ? token.trim()
      : undefined;

    const result = await verifyOtp(email, otp, tokenToVerify);
    return res.status(result.status).json(result);
  } catch (err: any) {
    console.error('API verify-otp error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while verifying the code. Please try again.',
    });
  }
}
