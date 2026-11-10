export interface SiteContent {
  company: {
    name: string;
    tagline: string;
    phone: string;
    rawPhone: string;
    address: string;
    city: string;
    pincode: string;
    operatingHours: string;
  };
  announcement: {
    enabled: boolean;
    text: string;
    badge: string;
  };
  hero: {
    kicker: string;
    headline: string;
    subheadline: string;
    ctaButtonText: string;
    secondaryButtonText: string;
  };
  story: {
    tagline: string;
    heading: string;
    paragraph1: string;
    paragraph2: string;
    pillar1Title: string;
    pillar1Desc: string;
    pillar2Title: string;
    pillar2Desc: string;
    pillar3Title: string;
    pillar3Desc: string;
    pillar4Title: string;
    pillar4Desc: string;
  };
  termsAndConditions: string;
  shippingFeeIndia?: number;
  isMaintenanceMode?: boolean;
  maintenanceNotice?: string;
}

export const ACROSS_INDIA_SHIPPING_FEE_INR = 29;

export function normalizeShippingFee(rawFee?: unknown): number {
  const num = typeof rawFee === 'number' ? rawFee : Number(rawFee);
  if (rawFee === undefined || rawFee === null || rawFee === '' || isNaN(num) || num < 0 || num === 100) {
    return ACROSS_INDIA_SHIPPING_FEE_INR;
  }
  return Math.round(num);
}

export const INITIAL_SITE_CONTENT: SiteContent = {
  isMaintenanceMode: false,
  maintenanceNotice: "We're making some improvements! Cotton Nest will be back shortly. Thank you for your patience.",
  company: {
    name: "Cotton Nest",
    tagline: "Pure Cotton Comfort, Everyday Elegance",
    phone: "+91 7838625915",
    rawPhone: "917838625915",
    address: "House Number 2508, Ground Floor, Sector 46, Gurgaon, Haryana",
    city: "Gurgaon, Haryana",
    pincode: "122003",
    operatingHours: "Monday - Sunday · 10:00 AM - 8:30 PM IST",
  },
  announcement: {
    enabled: true,
    text: "Experience 100% Pure Combed Cotton · Direct From Sector 46 Gurgaon Atelier",
    badge: "Gurgaon Atelier Exclusive",
  },
  hero: {
    kicker: "Handcrafted Pure Cotton Bedding · Gurgaon Atelier",
    headline: "The touch of pure cotton, woven for serene mornings.",
    subheadline: "Welcome to Cotton Nest. Discover our curated collection of King size bedsheets — tailored from 100% natural long-staple cotton with breathable comfort, delicate florals, and subtle muted golden accents.",
    ctaButtonText: "View Bedsheets Catalogue",
    secondaryButtonText: "Visit Gurgaon Studio",
  },
  story: {
    tagline: "The Cotton Nest Story",
    heading: "Honest pure cotton, tailored for Indian bedrooms.",
    paragraph1: "At Cotton Nest, based in Sector 46 Gurgaon, we started with a simple belief: bedsheets should never be made with sweaty synthetic microfiber or shrunk down to stingy sizes that untuck the moment you turn in bed.",
    paragraph2: "Every single bedsheet in our collection is cut to an expansive King size (108×108 / 100×108 inch), guaranteeing a generous tuck-in under even the thickest modern orthopaedic mattresses.",
    pillar1Title: "100% Natural Breathable Cotton",
    pillar1Desc: "Zero polyester blends. Completely breathable and cool against the skin during Indian summers.",
    pillar2Title: "No Untucking Generous Drop",
    pillar2Desc: "Expansive 108×108 inch proportion ensures mattress corners remain neatly tucked all night.",
    pillar3Title: "Color-Fast Reactive Inks",
    pillar3Desc: "Wash after domestic wash, florals and geometric linework retain their rich clarity.",
    pillar4Title: "Gurgaon Local Studio Reassurance",
    pillar4Desc: "Direct support, prompt exchange assistance, and open touch-and-feel visits in Sector 46.",
  },
  shippingFeeIndia: ACROSS_INDIA_SHIPPING_FEE_INR,
  termsAndConditions: `*Hey Cozy Souls! 💖*
You’re at *Cotton Nest – Feel the Softness* 🌸
Your soft & stylish bedsheet hub. 🛍️

🌸 *Please Note:* Slight colour variations may occur due to natural lighting/photography. Returns or exchanges are *not offered for such variations*. Wherever possible, we’ll provide the *original picture vs. catalogue picture* for reference.

🪶 We request you to *read the product description carefully* before placing your order.

✨ *EXCHANGE POLICY – MANUFACTURING DEFECTS*
• Exchange is applicable *only for genuine manufacturing defects*.
• Defect must be reported within *48 hours of delivery* with clear photos/videos.
• Product must be *unused, unwashed & in original packaging*.
• Exchange is subject to *inspection & approval by Cotton Nest*.
• Minor print/fabric variations, colour differences, washing damage & normal wear are *not considered defects*.
• Approved cases will be exchanged with the *same/equivalent product, subject to availability*.
• If the exchange product is unavailable, *store credit for the eligible amount* will be provided, valid for *2 months from the date of issue*.
• *No cash refunds* will be provided.

🚚 *SHIPPING & DELIVERY*
👉 Sector 46, Gurgaon: *Complimentary Delivery*
👉 Rest of Gurgaon: *Self Pickup or actual delivery charges*
👉 Across India: *₹29*

🎁 *LOYALTY REWARDS & NEST POINTS TERMS*
• Earn *5 Nest Points for every ₹100 spent* on pure cotton bedsheets and bedding.
• *Redemption Value:* *100 Nest Points = ₹50* instant discount at checkout.
• *Minimum 200 points required for redemption* (equivalent to ₹100 discount).
• *Points credited only after successful delivery and full payment.*
• *No points on delivery charges.*
• *Points expire after 12 months* from the date of credit.
• *Points cannot be exchanged for cash.*

🛡️ *Additional Terms & Conditions for Nest Points Redemption*
1. Nest Points are account-specific and non-transferable. They can only be redeemed by the registered customer to whom they were credited.
2. Nest Points cannot be exchanged for cash or transferred to another account.
3. Redemption is permitted only on eligible purchases.
4. Maximum redemption is capped at 125 Nest Points per order.
5. Customers must have sufficient available points at checkout to redeem them.
6. Once an order is successfully placed using Nest Points, the redeemed points must be deducted from the available balance.
7. If an order is cancelled or refunded, redeemed points must be reinstated after verification, according to the applicable refund process.
8. Cotton Nest reserves the right to reverse points credited incorrectly or obtained through fraudulent transactions.
9. Nest Points have no independent cash value and cannot be redeemed outside the Cotton Nest website.
10. Cotton Nest reserves the right to modify or discontinue the loyalty programme with reasonable notice.

💖 *Thank you for shopping with Cotton Nest!*
*Feel the Softness. 🌸*`,
};

const UPDATED_LOYALTY_TC_BLOCK = `🎁 *LOYALTY REWARDS & NEST POINTS TERMS*
• Earn *5 Nest Points for every ₹100 spent* on pure cotton bedsheets and bedding.
• *Redemption Value:* *100 Nest Points = ₹50* instant discount at checkout.
• *Minimum 200 points required for redemption* (equivalent to ₹100 discount).
• *Points credited only after successful delivery and full payment.*
• *No points on delivery charges.*
• *Points expire after 12 months* from the date of credit.
• *Points cannot be exchanged for cash.*

🛡️ *Additional Terms & Conditions for Nest Points Redemption*
1. Nest Points are account-specific and non-transferable. They can only be redeemed by the registered customer to whom they were credited.
2. Nest Points cannot be exchanged for cash or transferred to another account.
3. Redemption is permitted only on eligible purchases.
4. Maximum redemption is capped at 125 Nest Points per order.
5. Customers must have sufficient available points at checkout to redeem them.
6. Once an order is successfully placed using Nest Points, the redeemed points must be deducted from the available balance.
7. If an order is cancelled or refunded, redeemed points must be reinstated after verification, according to the applicable refund process.
8. Cotton Nest reserves the right to reverse points credited incorrectly or obtained through fraudulent transactions.
9. Nest Points have no independent cash value and cannot be redeemed outside the Cotton Nest website.
10. Cotton Nest reserves the right to modify or discontinue the loyalty programme with reasonable notice.`;

export function normalizeShippingInTerms(rawText?: string): string {
  const base = typeof rawText === 'string' && rawText.trim() !== ''
    ? rawText
    : INITIAL_SITE_CONTENT.termsAndConditions;

  let normalized = base
    .replace(/Across India:\s*\*?(?:₹|Rs\.?\s*)?100(?:\s*(?:rs|INR|\/-))?\*?/gi, 'Across India: *₹29*')
    .replace(/Rest of India:\s*\*?(?:₹|Rs\.?\s*)?100(?:\s*(?:rs|INR|\/-))?\*?/gi, 'Rest of India: *₹29*')
    .replace(/for just\s*(?:₹|Rs\.?\s*)?100\s*flat/gi, 'for just ₹29 flat')
    .replace(/flat\s*(?:₹|Rs\.?\s*)?100\s*(?:dispatch|shipping|delivery|courier)/gi, 'flat ₹29 dispatch')
    .replace(
      /Shipping charges shall be levied as applicable at the time of order placement\./gi,
      'Flat ₹29 Across India (shipping charges applied at order placement: ₹29).'
    );

  // Replace legacy loyalty block or normalize with the authoritative block including the 10 redemption terms
  if (/🎁\s*\*?LOYALTY REWARDS[\s\S]*?(?=\n\s*💖|$)/i.test(normalized)) {
    normalized = normalized.replace(
      /🎁\s*\*?LOYALTY REWARDS[\s\S]*?(?=\n\s*💖|$)/i,
      UPDATED_LOYALTY_TC_BLOCK
    );
  } else if (!normalized.includes('Additional Terms & Conditions for Nest Points Redemption')) {
    normalized = normalized.replace(
      /(?=\n\s*💖|$)/i,
      `\n\n${UPDATED_LOYALTY_TC_BLOCK}\n\n`
    );
  }

  return normalized;
}
