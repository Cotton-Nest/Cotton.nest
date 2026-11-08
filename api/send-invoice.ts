import { sendOrderInvoiceEmail } from './otp-service';

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
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    if (!payload || !payload.orderId) {
      return res.status(400).json({ success: false, error: 'Invalid invoice payload' });
    }

    const result = await sendOrderInvoiceEmail(payload);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (err: any) {
    console.error('[Vercel Runtime Invoice Email Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send invoice email',
    });
  }
}
