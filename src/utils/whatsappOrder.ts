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
 * On mobile devices (Android / iOS), shares the actual image file natively to WhatsApp.
 * (Only triggers if on a genuine mobile device where the native OS share sheet opens).
 */
export async function shareImageOnMobile(
  imageUrl: string,
  messageText: string,
  fileName: string = 'bedsheet'
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share || !isMobileDevice()) {
    return false;
  }

  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = new File([blob], `${cleanFileName}.${ext}`, { type: mimeType });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Cotton Nest Bedsheet Order',
        text: messageText,
        files: [file],
      });
      return true;
    }
  } catch (err: any) {
    if (err && err.name === 'AbortError') return true;
    console.warn('Mobile native share failed:', err);
  }

  return false;
}

/**
 * Copies an image directly into the system clipboard for desktop users.
 */
export async function copyImageBlobToClipboard(imageUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return false;
  }

  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) return false;
    const blob = await res.blob();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const blobUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width || 800;
    canvas.height = img.height || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return false;
    }

    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(blobUrl);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );

    if (pngBlob) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn('Could not copy image to clipboard:', err);
  }
  return false;
}

/**
 * Downloads the actual bedsheet photo directly to the device as a .jpg file.
 */
export function downloadJpgFile(imageUrl: string, productName: string) {
  try {
    const safeName = productName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.jpg`;

    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      })
      .catch(() => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  } catch (err) {
    console.warn('Could not download image:', err);
  }
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
  variantName?: string;
  dimensions?: string;
  quantity?: number;
  price: number;
  imageUrl: string;
}

/**
 * Sends a single product or variant order to WhatsApp:
 * 1. Generates the exact SKU so no photo paste is strictly required by the client.
 * 2. Pre-fills clean order specifications in WhatsApp.
 * 3. Copies photo to clipboard and downloads JPG.
 * 4. Displays the helper modal with 1-click options.
 */
export async function sendWhatsAppProductOrder(payload: SingleProductOrderPayload): Promise<void> {
  const sku = getProductSku(payload.productName, payload.variantName);
  const qty = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const qtyLine = qty > 1
    ? `🔢 Quantity: ${qty} Sets (includes ${qty * 2} Pillow Covers)`
    : `🔢 Quantity: 1 Set (includes 2 Pillow Covers)`;
  const totalAmount = payload.price * qty;
  const size = payload.dimensions || '108 x 108 inches (274 x 274 cm)';

  const messageLines = [
    `COTTON NEST - BEDSHEET ORDER 🪷`,
    `Hi Cotton Nest! I would like to order:`,
    `✨ Bedsheet: ${payload.productName}`,
    `🏷️ Product SKU: #${sku}`,
    `📏 Size: ${size}`,
    qtyLine,
    `💰 Total Price: ₹${totalAmount.toLocaleString('en-IN')}`,
    ``,
    `I am interested in buying this bedsheet, Please confirm stock availability and payment mode.`,
  ];

  const fullMessage = messageLines.join('\n');

  // Background helper actions
  downloadJpgFile(payload.imageUrl, payload.productName);
  const isCopied = await copyImageBlobToClipboard(payload.imageUrl);

  // Notify UI
  if (globalWhatsAppListener) {
    globalWhatsAppListener({
      productName: payload.productName,
      variantName: payload.variantName,
      sku,
      imageUrl: payload.imageUrl,
      messageText: fullMessage,
      isCopied,
      canMobileShare: isMobileDevice(),
    });
  }

  // Open WhatsApp directly
  openWhatsAppDirectly(fullMessage);
}

export interface CartOrderPayload {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNotes?: string;
  subtotal: number;
  totalSavings?: number;
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
 * Sends complete cart order directly to WhatsApp with SKU references for every single item.
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

  const finalTotal = payload.subtotal + (payload.shippingCost || 0);

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
    `Order Total: ₹${finalTotal.toLocaleString('en-IN')}`,
  ];

  if (payload.totalSavings && payload.totalSavings > 0) {
    messageLines.push(`(Savings Applied: ₹${payload.totalSavings.toLocaleString('en-IN')})`);
  }

  messageLines.push(``);
  messageLines.push(
    `Hello Cotton Nest! I have placed this order on your website, please share the QR code on this number to complete the payment`
  );

  const fullMessage = messageLines.join('\n');

  if (payload.items.length > 0 && payload.items[0].imageUrl) {
    const firstItem = payload.items[0];
    const sku = getProductSku(firstItem.name, firstItem.variantName);
    downloadJpgFile(firstItem.imageUrl, firstItem.name);
    const isCopied = await copyImageBlobToClipboard(firstItem.imageUrl);

    if (globalWhatsAppListener) {
      globalWhatsAppListener({
        productName: firstItem.name,
        variantName: firstItem.variantName,
        sku,
        imageUrl: firstItem.imageUrl,
        messageText: fullMessage,
        isCopied,
        canMobileShare: isMobileDevice(),
      });
    }
  }

  openWhatsAppDirectly(fullMessage);
  return fullMessage;
}
