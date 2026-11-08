import nodemailer from 'nodemailer';

const COTTON_NEST_LOGO_URL = 'https://res.cloudinary.com/ys2sgydi/image/upload/f_auto/q_auto/logo-removebg-preview.png';

function cleanEnvVal(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["'`]|["'`]$/g, '').trim();
}

function calculateEarnedPoints(orderSubtotalInr: number): number {
  const safeSubtotal = Math.max(0, Number(orderSubtotalInr) || 0);
  return Math.floor((safeSubtotal / 100) * 5);
}

interface InvoiceOrderPayload {
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

function buildCottonNestInvoiceHtml(payload: InvoiceOrderPayload): string {
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
  const eligibleAmount = Math.max(0, (Number(payload.finalTotal) || 0) - (Number(payload.shippingCost) || 0));
  const pointsEarned =
    typeof payload.pointsEarned === 'number' && payload.pointsEarned > 0
      ? payload.pointsEarned
      : calculateEarnedPoints(eligibleAmount);
  const pointsWorthInr = Math.floor(pointsEarned * 0.5);

  const couponDiscount = Number(payload.couponDiscount) || 0;
  const pointsDiscount = Number(payload.pointsDiscount) || 0;
  const shippingCost = Number(payload.shippingCost) || 0;
  const finalTotal = Number(payload.finalTotal) || 0;
  const subtotal = Number(payload.subtotal) || finalTotal;

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
        <table role="presentation" width="100%" style="max-width:540px;background-color:#FFFFFF;border-radius:24px;border:1px solid #DEC89B;box-shadow:0 8px 30px rgba(44,36,32,0.06);overflow:hidden;text-align:center;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 28px 24px;background-color:#FAF7F2;border-bottom:1px solid #EAE2D5;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td align="center">
                    <img src="${COTTON_NEST_LOGO_URL}" alt="Cotton Nest Logo" width="68" height="68" style="display:block;width:68px;height:68px;max-width:68px;object-fit:contain;margin:0 auto;border:0;outline:none;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C29E57;font-weight:700;">Handcrafted Luxury Bedding</p>
              <h1 style="margin:0 0 4px;font-size:26px;font-family:Georgia,serif;color:#2C2420;font-weight:bold;letter-spacing:-0.5px;">Cotton Nest</h1>
              <p style="margin:0;font-size:12px;color:#7A6458;letter-spacing:1px;text-transform:uppercase;">Feel The Softness · Sector 46 Gurgaon</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;text-align:left;">
              <h2 style="margin:0 0 14px;font-size:19px;color:#8C2E46;font-family:Georgia,serif;font-weight:600;">Official Sale Invoice &amp; Order Receipt</h2>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4A3B32;">Hello ${payload.customerName || 'Valued Customer'},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A3B32;">
                Thank you for choosing Cotton Nest. Your order for 100% breathable pure cotton bedding has been confirmed by our atelier. Below is your official sale invoice with itemized details and earned Nest Points.
              </p>
              <div style="background-color:#FAF7F2;border:2px dashed #C29E57;border-radius:16px;padding:22px 18px;text-align:center;margin:22px 0;">
                <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7A6458;display:block;margin-bottom:8px;font-weight:600;">Official Sale Invoice Number</span>
                <span style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#8C2E46;font-family:'Courier New',Courier,monospace;display:inline-block;padding:6px 18px;background:#FFFFFF;border-radius:10px;border:1px solid #DEC89B;">
                  #${refId}
                </span>
                <div style="margin-top:10px;font-size:18px;font-weight:bold;color:#2C2420;">
                  Total Amount Paid: ₹${finalTotal.toLocaleString('en-IN')}
                </div>
                <div style="margin-top:6px;display:inline-block;padding:3px 10px;background-color:#E8F5E9;border:1px solid #C8E6C9;border-radius:20px;font-size:11px;color:#2E7D32;font-weight:600;">
                  ✓ Order Confirmed by Cotton Nest Atelier
                </div>
              </div>
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
              <div style="background-color:#FAF7F2;border:1px solid #DEC89B;border-radius:16px;padding:18px 20px;margin-bottom:22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.9;color:#4A3B32;">
                  <tr>
                    <td>Bag Subtotal</td>
                    <td align="right" style="font-weight:600;color:#2C2420;">₹${subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                  ${couponDiscount > 0 ? `<tr><td style="color:#8C2E46;">Coupon Discount (${payload.couponCode || 'Applied'})</td><td align="right" style="color:#8C2E46;font-weight:bold;">-₹${couponDiscount.toLocaleString('en-IN')}</td></tr>` : ''}
                  ${pointsDiscount > 0 ? `<tr><td style="color:#8C2E46;">Nest Points Redeemed</td><td align="right" style="color:#8C2E46;font-weight:bold;">-₹${pointsDiscount.toLocaleString('en-IN')}</td></tr>` : ''}
                  <tr>
                    <td>Delivery &amp; Shipping</td>
                    <td align="right" style="font-weight:600;color:#2C2420;">${shippingCost > 0 ? `₹${shippingCost.toLocaleString('en-IN')}` : 'FREE Express Delivery'}</td>
                  </tr>
                  <tr style="border-top:1px solid #DEC89B;font-size:15px;font-weight:bold;">
                    <td style="padding-top:10px;color:#8C2E46;">Grand Total Paid</td>
                    <td align="right" style="padding-top:10px;color:#8C2E46;font-size:18px;">₹${finalTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
              <div style="background-color:#FFFBF0;border:1.5px solid #DEC89B;border-radius:16px;padding:18px 20px;margin-bottom:22px;text-align:center;">
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
              </div>
              <div style="border-top:1px solid #EAE2D5;padding-top:20px;margin-top:20px;">
                <p style="margin:0;font-size:14px;color:#2C2420;font-weight:600;">Thank you,</p>
                <p style="margin:4px 0 0;font-size:14px;color:#8C2E46;font-weight:600;">Team Cotton Nest</p>
              </div>
            </td>
          </tr>
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

function buildCottonNestInvoiceText(payload: InvoiceOrderPayload): string {
  const refId = payload.orderId.startsWith('CN-') ? payload.orderId : `CN-${payload.orderId}`;
  const finalTotal = Number(payload.finalTotal) || 0;
  return `COTTON NEST - OFFICIAL SALE INVOICE\nSALE INVOICE NUMBER: #${refId}\nCustomer: ${payload.customerName}\nTotal Amount: ₹${finalTotal.toLocaleString('en-IN')}\nStatus: Confirmed by Cotton Nest Atelier\n\nThank you,\nTeam Cotton Nest`;
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
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    if (!payload || !payload.orderId) {
      return res.status(400).json({ success: false, error: 'Invalid invoice payload' });
    }

    const gmailUser = cleanEnvVal(process.env.GMAIL_USER || 'adityaa.22082011@gmail.com');
    const rawPass = cleanEnvVal(
      process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'ocdf vrlp hvvm xuiu'
    );
    const gmailPass = rawPass.replace(/[\s-]+/g, '');

    const recipientEmails = new Set<string>();
    recipientEmails.add('adityaa.451485@gmail.com');
    if (gmailUser) recipientEmails.add(gmailUser.toLowerCase());
    if (
      payload.customerEmail &&
      payload.customerEmail.includes('@') &&
      !payload.customerEmail.endsWith('@cottonnest.orders')
    ) {
      recipientEmails.add(payload.customerEmail.trim().toLowerCase());
    }

    const refId = payload.orderId.startsWith('CN-') ? payload.orderId : `CN-${payload.orderId}`;
    const htmlContent = buildCottonNestInvoiceHtml(payload);
    const textContent = buildCottonNestInvoiceText(payload);
    const recipientsList = Array.from(recipientEmails).join(', ');
    const subject = `Cotton Nest - Order #${refId} Sale Invoice`;

    const mailOptions = {
      from: `"Cotton Nest" <${gmailUser}>`,
      to: recipientsList,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      const transporter465 = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
        tls: { rejectUnauthorized: false },
      });
      await transporter465.sendMail(mailOptions);
    } catch (primaryErr: any) {
      console.warn('[Vercel Runtime Invoice] Port 465 failed, retrying Port 587 STARTTLS:', primaryErr?.message);
      const transporter587 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: gmailUser, pass: gmailPass },
        tls: { rejectUnauthorized: false },
      });
      await transporter587.sendMail(mailOptions);
    }

    return res.status(200).json({
      success: true,
      sentViaSmtp: true,
      message: `Invoice email dispatched to ${recipientsList}`,
      recipients: Array.from(recipientEmails),
    });
  } catch (err: any) {
    console.error('[Vercel Runtime Invoice Email Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send invoice email',
    });
  }
}
