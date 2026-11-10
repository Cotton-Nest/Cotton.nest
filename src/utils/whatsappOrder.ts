import {
  COMPANY_DETAILS,
  normalizeSkuCode,
  getBaseProductSkuFromName,
  stripSequentialSkuSuffix,
  formatSequentialSku,
  auditAndEnsureUniqueProductSkus,
  generateUniqueProductSku,
  getHistoricallyAssignedSkus,
  recordHistoricallyAssignedSkus,
} from '../data/products';

export {
  normalizeSkuCode,
  getBaseProductSkuFromName,
  stripSequentialSkuSuffix,
  formatSequentialSku,
  auditAndEnsureUniqueProductSkus,
  generateUniqueProductSku,
  getHistoricallyAssignedSkus,
  recordHistoricallyAssignedSkus,
};

type WhatsAppListener = (data: {
  productName: string;
  variantName?: string;
  sku: string;
  imageUrl: string;
  messageText: string;
  isCopied?: boolean;
  canMobileShare?: boolean;
}) => void;

let globalWhatsAppListener: WhatsAppListener | null = null;

export function setWhatsAppListener(listener: WhatsAppListener | null) {
  globalWhatsAppListener = listener;
}

/**
 * Checks if the current user is visiting from a mobile phone (Android/iOS)
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generates an unmistakable, memorable SKU code for each bedsheet and color variant.
 * Example: Gulabi Bagh + Blush Rose -> CN-ROSE-BLUSH-108K
 * If an explicit productSku is provided, preserves that unique SKU.
 */
export function getProductSku(productName: string, variantName?: string, explicitProductSku?: string): string {
  const cleanExplicit = normalizeSkuCode(explicitProductSku);
  if (cleanExplicit) {
    if (!variantName) return cleanExplicit;
    const vCode = variantName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
    return vCode ? `${cleanExplicit}-${vCode}` : cleanExplicit;
  }
  return getBaseProductSkuFromName(productName, variantName);
}

/**
 * Resolves the authoritative unique primary SKU for a product record.
 * Always prioritizes the product's permanent `sku` field.
 */
export function resolveProductPrimarySku(product: { id?: string; sku?: string; name?: string }): string {
  const explicit = normalizeSkuCode(product?.sku);
  if (explicit) return explicit;
  return getBaseProductSkuFromName(product?.name || product?.id || 'Bedsheet');
}

/**
 * Returns all searchable SKU tokens strictly belonging to this specific product
 * (its unique primary SKU and any variant-specific SKUs derived from its unique primary SKU).
 * Never mixes another product's base SKU onto a sequential SKU product.
 */
export function getAllProductSkus(product: {
  id?: string;
  sku?: string;
  name?: string;
  variants?: Array<{ name?: string; sku?: string }>;
}): string[] {
  const primary = resolveProductPrimarySku(product);
  const skus = new Set<string>([primary]);

  if (Array.isArray(product?.variants)) {
    for (const v of product.variants) {
      if (!v) continue;
      const vSku = normalizeSkuCode(v.sku);
      if (vSku) {
        skus.add(vSku);
      } else if (v.name) {
        const vCode = v.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
        if (vCode) {
          skus.add(`${primary}-${vCode}`);
        }
      }
    }
  }
  return Array.from(skus);
}

/**
 * Opens WhatsApp directly using the official wa.me universal URL.
 */
export function openWhatsAppDirectly(message: string): void {
  const waUrl = COMPANY_DETAILS.whatsappUrl(message);
  if (typeof window !== 'undefined') {
    const win = window.open(waUrl, '_blank');
    if (!win && window.location) {
      window.location.href = waUrl;
    }
  }
}

export interface SingleProductOrderPayload {
  productName: string;
  sku?: string;
  variantName?: string;
  dimensions?: string;
  quantity?: number;
  price: number;
  imageUrl: string;
}

/**
 * Sends a single product or variant enquiry to WhatsApp:
 * 1. Uses the product's unique SKU (or generates the fallback SKU).
 * 2. Pre-fills clean product specifications in WhatsApp.
 * (No invoice is generated or sent on product enquiry.)
 */
export async function sendWhatsAppProductOrder(payload: SingleProductOrderPayload): Promise<void> {
  const sku = getProductSku(payload.productName, payload.variantName, payload.sku);
  const qty = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const qtyLine = qty > 1
    ? `🔢 Quantity: ${qty} Sets (includes ${qty * 2} Pillow Covers)`
    : `🔢 Quantity: 1 Set (includes 2 Pillow Covers)`;
  const totalAmount = payload.price * qty;
  const size = payload.dimensions || '108 x 108 inches (274 x 274 cm)';

  const messageLines = [
    `COTTON NEST - BEDSHEET ENQUIRY 🪷`,
    `Hi Cotton Nest! I would like to enquire about:`,
    `✨ Bedsheet: ${payload.productName}${payload.variantName ? ` (${payload.variantName})` : ''}`,
    `🏷️ Product SKU: #${sku}`,
    `📏 Size: ${size}`,
    qtyLine,
    `💰 Price: ₹${totalAmount.toLocaleString('en-IN')}`,
    ``,
    `I am interested in this bedsheet. Please confirm stock availability and details.`,
  ];

  const fullMessage = messageLines.join('\n');

  // Open WhatsApp directly
  openWhatsAppDirectly(fullMessage);
}

export interface CartOrderPayload {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail?: string;
  subtotal: number;
  totalSavings?: number;
  couponCode?: string;
  couponDiscount?: number;
  pointsUsed?: number;
  pointsDiscount?: number;
  pointsEarned?: number;
  shippingMethod?: string;
  shippingCost?: number;
  items: Array<{
    name: string;
    sku?: string;
    variantName?: string;
    dimensions: string;
    quantity: number;
    price: number;
    imageUrl: string;
  }>;
}

/**
 * Sends complete cart order directly to WhatsApp with SKU references for every item.
 * IMPORTANT: Do NOT generate or send an invoice when an order is placed.
 * The invoice is generated and emailed strictly when the Admin confirms the order.
 */
export async function sendWhatsAppCartOrder(payload: CartOrderPayload): Promise<string> {
  const itemsText = payload.items.map((item, idx) => {
    const sku = getProductSku(item.name, item.variantName, item.sku);
    return [
      `${idx + 1}. ${item.name}`,
      `   • SKU: #${sku}`,
      `   • Size: ${item.dimensions || '108 x 108 inches (274 x 274 cm)'}`,
      `   • Qty: ${item.quantity} · Price: ₹${(item.price * item.quantity).toLocaleString('en-IN')}`,
    ].join('\n');
  }).join('\n');

  const refId = payload.orderId.startsWith('CN-')
    ? payload.orderId
    : `CN-${payload.orderId}`;

  const couponDiscount = payload.couponDiscount || 0;
  const pointsDiscount = payload.pointsDiscount || 0;
  const finalTotal = Math.max(0, payload.subtotal - couponDiscount - pointsDiscount) + (payload.shippingCost || 0);

  const customerLines = [
    `* Name: ${payload.customerName}`,
    `* WhatsApp Phone: ${payload.customerPhone}`,
    `* Delivery Address: ${payload.customerAddress}`,
  ];
  if (payload.shippingMethod) {
    customerLines.push(`* Shipping: ${payload.shippingMethod}`);
  }

  const messageLines = [
    `NEW ORDER - COTTON NEST 🪷`,
    `Order Ref: #${refId}`,
    `Customer Details:`,
    ...customerLines,
    `Bedsheets Ordered:`,
    itemsText,
    `--------------------------`,
    `Bag Subtotal: ₹${payload.subtotal.toLocaleString('en-IN')}`,
  ];

  if (payload.couponCode && couponDiscount > 0) {
    messageLines.push(`🎟️ Coupon Applied: ${payload.couponCode} (-₹${couponDiscount.toLocaleString('en-IN')})`);
  }

  if (payload.pointsUsed && payload.pointsUsed > 0 && pointsDiscount > 0) {
    messageLines.push(`✨ Loyalty Points Redeemed: ${payload.pointsUsed} pts (-₹${pointsDiscount.toLocaleString('en-IN')})`);
  }

  if (payload.shippingCost && payload.shippingCost > 0) {
    messageLines.push(`🚚 Shipping: +₹${payload.shippingCost.toLocaleString('en-IN')}`);
  } else if (payload.shippingMethod) {
    messageLines.push(`🚚 Shipping: Free (${payload.shippingMethod})`);
  }

  messageLines.push(`💰 Final Total: ₹${finalTotal.toLocaleString('en-IN')}`);

  if (payload.pointsEarned && payload.pointsEarned > 0) {
    messageLines.push(`🎁 Nest Points to Earn: +${payload.pointsEarned} pts (5 pts per ₹100 · credited after delivery & payment)`);
  }

  if (payload.totalSavings && payload.totalSavings > 0) {
    const totalAllSavings = payload.totalSavings + couponDiscount + pointsDiscount;
    messageLines.push(`(Total Savings: ₹${totalAllSavings.toLocaleString('en-IN')})`);
  }

  messageLines.push(``);
  messageLines.push(
    `Please confirm the availability of this bedsheet and share the QR code to complete the payment`
  );

  const fullMessage = messageLines.join('\n');

  openWhatsAppDirectly(fullMessage);
  return fullMessage;
}

