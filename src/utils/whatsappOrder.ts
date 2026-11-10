import { COMPANY_DETAILS } from '../data/products';

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
 * This guarantees the store owner in Sector 46 Gurgaon knows 100% which bedsheet
 * is being ordered without needing the customer to upload or attach any file.
 */
export function getProductSku(productName: string, variantName?: string): string {
  const pCode = productName.toLowerCase();
  let base = 'CN-BS';
  if (pCode.includes('gulabi') || pCode.includes('rose')) base = 'CN-ROSE';
  else if (pCode.includes('sage') || pCode.includes('meadow')) base = 'CN-SAGE';
  else if (pCode.includes('garland') || pCode.includes('cream')) base = 'CN-GARLAND';
  else if (pCode.includes('petal') || pCode.includes('botanical')) base = 'CN-PETALS';
  else if (pCode.includes('shivaura') || pCode.includes('trellis')) base = 'CN-TRELLIS';
  else if (pCode.includes('poppy') || pCode.includes('milky')) base = 'CN-POPPY';
  else if (pCode.includes('amber') || pCode.includes('orchid')) base = 'CN-ORCHID';
  else if (pCode.includes('peacock') || pCode.includes('teal')) base = 'CN-PEACOCK';
  else if (pCode.includes('sapphire') || pCode.includes('blue')) base = 'CN-BLUE-ROSE';

  const vCode = variantName
    ? `-${variantName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase()}`
    : '';

  return `${base}${vCode}-108K`;
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
  productId?: string;
  productName: string;
  variantName?: string;
  dimensions?: string;
  quantity?: number;
  price: number;
  imageUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  message?: string;
  source?: 'product_enquiry' | 'enquiry_tab' | 'store_visit' | 'wishlist_enquiry';
}

function resolveSavedCustomerInfo(): { name?: string; phone?: string; email?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const rawUser = localStorage.getItem('cotton_nest_user_session');
    const rawProfile = localStorage.getItem('cotton_nest_customer_profile');
    const u = rawUser ? JSON.parse(rawUser) : {};
    const p = rawProfile ? JSON.parse(rawProfile) : {};
    return {
      name: u?.name || p?.name || undefined,
      phone: u?.phone || p?.phone || undefined,
      email: u?.email || p?.email || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Sends a single product or variant enquiry to WhatsApp:
 * 1. Generates the exact SKU.
 * 2. Pre-fills clean product specifications in WhatsApp.
 * 3. Automatically logs the enquiry into the 'enquiries' collection for Admin Enquiry Orders tracking.
 * (No invoice is generated or sent on product enquiry.)
 */
export async function sendWhatsAppProductOrder(payload: SingleProductOrderPayload): Promise<void> {
  const sku = getProductSku(payload.productName, payload.variantName);
  const qty = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const qtyLine = qty > 1
    ? `🔢 Quantity: ${qty} Sets (includes ${qty * 2} Pillow Covers)`
    : `🔢 Quantity: 1 Set (includes 2 Pillow Covers)`;
  const totalAmount = payload.price * qty;
  const size = payload.dimensions || '108 x 108 inches (274 x 274 cm)';

  const savedCustomer = resolveSavedCustomerInfo();
  const cName = payload.customerName || savedCustomer.name || 'Cotton Nest Visitor';
  const cPhone = payload.customerPhone || savedCustomer.phone || 'Not provided (WhatsApp Chat)';
  const cEmail = payload.customerEmail || savedCustomer.email || undefined;
  const defaultEnquiryNote = payload.message || 'I am interested in this bedsheet. Please confirm stock availability and details.';

  const messageLines = [
    `COTTON NEST - BEDSHEET ENQUIRY 🪷`,
    `Hi Cotton Nest! I would like to enquire about:`,
    `✨ Bedsheet: ${payload.productName}${payload.variantName ? ` (${payload.variantName})` : ''}`,
    `🏷️ Product SKU: #${sku}`,
    `📏 Size: ${size}`,
    qtyLine,
    `💰 Price: ₹${totalAmount.toLocaleString('en-IN')}`,
    ``,
    defaultEnquiryNote,
  ];

  const fullMessage = messageLines.join('\n');

  // Persist enquiry record asynchronously without blocking WhatsApp launch
  import('../services/api')
    .then(({ saveEnquiryApi }) =>
      saveEnquiryApi({
        customerName: cName,
        customerPhone: cPhone,
        customerEmail: cEmail,
        productId: payload.productId || sku,
        productName: payload.productName,
        productImage: payload.imageUrl,
        productPrice: payload.price,
        productDimensions: size,
        variantName: payload.variantName,
        quantity: qty,
        message: defaultEnquiryNote,
        source: payload.source || 'product_enquiry',
      })
    )
    .catch(() => {});

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
    const sku = getProductSku(item.name, item.variantName);
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

