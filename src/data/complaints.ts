import { Order, OrderItem } from './orders';

export const COMPLAINT_REQUEST_TYPES = ['Exchange', 'Product Complaint'] as const;

export type ComplaintRequestType = (typeof COMPLAINT_REQUEST_TYPES)[number] | 'Return';

export type ComplaintStatus =
  | 'New'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Exchange Processing'
  | 'Resolved';

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'New',
  'Under Review',
  'Approved',
  'Rejected',
  'Exchange Processing',
  'Resolved',
];

export interface ComplaintPhoto {
  url: string;
  publicId: string;
  orderId: string;
  productId: string;
  complaintId?: string;
  uploadedAt: number;
  width?: number;
  height?: number;
  format?: string;
}

export interface ComplaintResponseEntry {
  id: string;
  status: ComplaintStatus;
  message: string;
  respondedBy: string;
  createdAt: string;
}

export interface OrderComplaint {
  id: string;
  orderId: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  productId: string;
  productName: string;
  productSize: string;
  productDimensions: string;
  variantId?: string;
  variantName: string;
  productPrice: number;
  productQuantity: number;
  requestType: ComplaintRequestType;
  description: string;
  photos: ComplaintPhoto[];
  status: ComplaintStatus;
  adminResponse?: string;
  responseHistory: ComplaintResponseEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintSubmissionInput {
  id?: string;
  orderId: string;
  productId: string;
  variantId?: string;
  variantName?: string;
  requestType: ComplaintRequestType;
  description: string;
  photos: Array<{
    url: string;
    publicId: string;
    orderId?: string;
    productId?: string;
    uploadedAt?: number;
    width?: number;
    height?: number;
    format?: string;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  userId?: string;
}

/**
 * Checks if a string is a raw base64 data URI or temporary blob URL.
 * Database records must NEVER store base64 or blob URLs.
 */
export function isBase64OrBlobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.includes(';base64,')
  );
}

/**
 * Checks if a URL is a catalogue asset placeholder rather than a customer-uploaded defect photo.
 */
export function isCatalogueAssetUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/images/exact_sheet') ||
    trimmed.startsWith('/src/assets/images/') ||
    trimmed.includes('exact_sheet1_pink_rose')
  );
}

/**
 * Validates that a complaint photo object has a permanent Cloudinary/upload URL and a publicId,
 * and is never a base64 data URI or catalogue image.
 */
export function isValidComplaintPhoto(photo: any): { valid: boolean; error?: string } {
  if (!photo || typeof photo !== 'object') {
    return { valid: false, error: 'Invalid photo object.' };
  }
  const url = typeof photo.url === 'string' ? photo.url.trim() : '';
  const publicId = typeof photo.publicId === 'string' ? photo.publicId.trim() : '';

  if (!url) {
    return { valid: false, error: 'Photo URL is required.' };
  }
  if (isBase64OrBlobUrl(url)) {
    return {
      valid: false,
      error: 'Base64 or temporary blob images are not permitted. Photos must be uploaded to Cloudinary first.',
    };
  }
  if (isCatalogueAssetUrl(url)) {
    return {
      valid: false,
      error: 'Catalogue product images cannot be substituted for customer defect photos.',
    };
  }
  if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('/uploads/')) {
    return {
      valid: false,
      error: 'Photo URL must be a valid Cloudinary HTTPS URL.',
    };
  }
  if (!publicId) {
    return {
      valid: false,
      error: 'Photo Cloudinary publicId is required for every uploaded defect image.',
    };
  }
  return { valid: true };
}

/**
 * Extracts structured size and variant metadata from an OrderItem.
 */
export function extractProductSizeAndVariant(item: OrderItem): {
  cleanProductName: string;
  size: string;
  dimensions: string;
  variantName: string;
  variantId?: string;
} {
  const rawName = (item.productName || 'Cotton Nest Bedsheet').trim();
  let cleanProductName = rawName;
  let inferredVariant = item.variantName?.trim() || '';

  if (!inferredVariant && rawName.includes(' - ')) {
    const parts = rawName.split(' - ');
    cleanProductName = parts[0].trim();
    inferredVariant = parts.slice(1).join(' - ').trim();
  }

  const dimensions = (item.dimensions || '108 x 108 inches').trim();
  let size = (item.size || '').trim();
  if (!size) {
    const dimLower = dimensions.toLowerCase();
    if (dimLower.includes('108') || dimLower.includes('king')) size = 'King (108 × 108 in)';
    else if (dimLower.includes('90') || dimLower.includes('queen') || dimLower.includes('double')) size = 'Queen / Double (90 × 100 in)';
    else if (dimLower.includes('60') || dimLower.includes('single')) size = 'Single (60 × 90 in)';
    else size = dimensions;
  }

  return {
    cleanProductName,
    size,
    dimensions,
    variantName: inferredVariant || 'Signature Classic',
    variantId: item.variantId,
  };
}

/**
 * Normalizes a phone number to its last 10 digits for reliable customer ownership comparison.
 */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Verifies that the customer submitting a complaint actually owns the target order.
 */
export function verifyOrderOwnership(
  order: Order | null | undefined,
  claimant: { userId?: string; customerEmail?: string; customerPhone?: string; orderId?: string }
): { valid: boolean; error?: string } {
  if (!order || !order.id) {
    return { valid: false, error: 'Original order not found.' };
  }

  if (claimant.orderId && order.id.toLowerCase() !== claimant.orderId.trim().toLowerCase()) {
    return { valid: false, error: 'Order ID mismatch.' };
  }

  const orderEmail = (order.customerEmail || '').trim().toLowerCase();
  const orderPhone = normalizePhoneDigits(order.customerPhone);
  const orderUserId = (order.userId || '').trim();

  const claimEmail = (claimant.customerEmail || '').trim().toLowerCase();
  const claimPhone = normalizePhoneDigits(claimant.customerPhone);
  const claimUserId = (claimant.userId || '').trim();

  // If the order has a userId, email, or phone, at least one provided claimant identifier must match
  const hasAnyClaimantIdentity = Boolean(claimEmail || claimPhone || claimUserId);
  if (!hasAnyClaimantIdentity) {
    return {
      valid: false,
      error: 'Customer verification details (phone, email, or account ID) are required to submit a complaint.',
    };
  }

  const matchesUserId = Boolean(orderUserId && claimUserId && orderUserId === claimUserId);
  const matchesEmail = Boolean(orderEmail && claimEmail && orderEmail === claimEmail);
  const matchesPhone = Boolean(orderPhone && claimPhone && orderPhone === claimPhone);

  if (matchesUserId || matchesEmail || matchesPhone) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Order ownership verification failed. The provided customer account does not match this order.',
  };
}

/**
 * Verifies that the selected product belongs to the specified order.
 */
export function verifyProductMembershipInOrder(
  order: Order | null | undefined,
  productId: string,
  variantName?: string
): { valid: boolean; matchedItem?: OrderItem; error?: string } {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return { valid: false, error: 'Order has no items.' };
  }
  const cleanProdId = (productId || '').trim();
  if (!cleanProdId) {
    return { valid: false, error: 'Please select a product from your order.' };
  }

  const candidates = order.items.filter((it) => it.productId === cleanProdId);
  if (candidates.length === 0) {
    return {
      valid: false,
      error: `Selected product (${cleanProdId}) is not part of Order #${order.id}.`,
    };
  }

  if (variantName && candidates.length > 1) {
    const exactVariant = candidates.find((it) => {
      const parsed = extractProductSizeAndVariant(it);
      return parsed.variantName.toLowerCase() === variantName.trim().toLowerCase();
    });
    if (exactVariant) {
      return { valid: true, matchedItem: exactVariant };
    }
  }

  return { valid: true, matchedItem: candidates[0] };
}

/**
 * Validates a full complaint submission payload against the original order and returns
 * a sanitized OrderComplaint ready for persistence.
 */
export function validateComplaintSubmission(
  input: ComplaintSubmissionInput,
  order: Order | null | undefined
): { valid: boolean; error?: string; complaint?: OrderComplaint } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid complaint submission payload.' };
  }

  // 1. Verify order exists and ownership matches
  const ownershipCheck = verifyOrderOwnership(order, {
    orderId: input.orderId,
    userId: input.userId,
    customerEmail: input.customerEmail || order?.customerEmail,
    customerPhone: input.customerPhone || order?.customerPhone,
  });
  if (!ownershipCheck.valid || !order) {
    return { valid: false, error: ownershipCheck.error || 'Order verification failed.' };
  }

  // 2. Verify request type (Cotton Nest policy: Exchange or Product Complaint only; returns not accepted)
  if (!COMPLAINT_REQUEST_TYPES.includes(input.requestType as any)) {
    return {
      valid: false,
      error: 'Invalid request type. As per Cotton Nest Terms & Conditions, we offer Defect Exchanges or Product Complaints only (no returns/refunds).',
    };
  }

  // 3. Verify product membership in the order
  const membershipCheck = verifyProductMembershipInOrder(order, input.productId, input.variantName);
  if (!membershipCheck.valid || !membershipCheck.matchedItem) {
    return {
      valid: false,
      error: membershipCheck.error || 'Selected product does not belong to this order.',
    };
  }

  // 4. Verify issue description
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 5) {
    return {
      valid: false,
      error: 'Please describe the issue with the product (at least 5 characters).',
    };
  }

  // 5. Verify at least 1 customer-uploaded Cloudinary photo (never base64, never catalogue image)
  if (!Array.isArray(input.photos) || input.photos.length === 0) {
    return {
      valid: false,
      error: 'Please upload at least one photo of the actual defective or damaged product you received.',
    };
  }

  const complaintId =
    input.id && /^CMP-[A-Z0-9-]+$/i.test(input.id.trim())
      ? input.id.trim().toUpperCase()
      : `CMP-${Math.floor(100000 + Math.random() * 900000)}`;

  const nowIso = new Date().toISOString();
  const validatedPhotos: ComplaintPhoto[] = [];

  for (const rawPhoto of input.photos) {
    const check = isValidComplaintPhoto(rawPhoto);
    if (!check.valid) {
      return { valid: false, error: check.error };
    }
    validatedPhotos.push({
      url: rawPhoto.url.trim(),
      publicId: rawPhoto.publicId.trim(),
      orderId: order.id,
      productId: membershipCheck.matchedItem.productId,
      complaintId,
      uploadedAt: Number(rawPhoto.uploadedAt) || Date.now(),
      ...(rawPhoto.width ? { width: Number(rawPhoto.width) } : {}),
      ...(rawPhoto.height ? { height: Number(rawPhoto.height) } : {}),
      ...(rawPhoto.format ? { format: String(rawPhoto.format) } : {}),
    });
  }

  const itemMeta = extractProductSizeAndVariant(membershipCheck.matchedItem);

  const complaint: OrderComplaint = {
    id: complaintId,
    orderId: order.id,
    ...(order.userId || input.userId ? { userId: (order.userId || input.userId)!.trim() } : {}),
    customerName: (order.customerName || input.customerName || 'Cotton Nest Customer').trim(),
    customerPhone: (order.customerPhone || input.customerPhone || '').trim(),
    ...(order.customerEmail || input.customerEmail
      ? { customerEmail: (order.customerEmail || input.customerEmail)!.trim() }
      : {}),
    customerAddress: (order.customerAddress || 'Gurgaon').trim(),
    productId: membershipCheck.matchedItem.productId,
    productName: itemMeta.cleanProductName,
    productSize: itemMeta.size,
    productDimensions: itemMeta.dimensions,
    ...(input.variantId || itemMeta.variantId ? { variantId: input.variantId || itemMeta.variantId } : {}),
    variantName: input.variantName?.trim() || itemMeta.variantName,
    productPrice: Number(membershipCheck.matchedItem.price) || 0,
    productQuantity: Number(membershipCheck.matchedItem.quantity) || 1,
    requestType: input.requestType,
    description,
    photos: validatedPhotos,
    status: 'New',
    responseHistory: [
      {
        id: `resp_${Date.now()}`,
        status: 'New',
        message: `${input.requestType} request submitted by customer with ${validatedPhotos.length} product photo(s).`,
        respondedBy: 'Customer',
        createdAt: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return { valid: true, complaint };
}

/**
 * Applies an admin status update and/or response message to an existing complaint,
 * preserving full complaint history and image links.
 */
export function applyAdminComplaintUpdate(
  existing: OrderComplaint,
  update: {
    status?: ComplaintStatus;
    adminResponse?: string;
    respondedBy?: string;
  }
): { valid: boolean; error?: string; complaint?: OrderComplaint } {
  if (!existing || !existing.id) {
    return { valid: false, error: 'Existing complaint record is required.' };
  }

  const nextStatus = update.status || existing.status;
  if (!COMPLAINT_STATUSES.includes(nextStatus)) {
    return { valid: false, error: `Invalid complaint status: ${nextStatus}` };
  }

  const trimmedMessage = typeof update.adminResponse === 'string' ? update.adminResponse.trim() : '';
  const nowIso = new Date().toISOString();
  const prevHistory = Array.isArray(existing.responseHistory) ? [...existing.responseHistory] : [];

  const statusChanged = nextStatus !== existing.status;
  const hasNewMessage = Boolean(trimmedMessage && trimmedMessage !== existing.adminResponse);

  if (statusChanged || hasNewMessage) {
    prevHistory.push({
      id: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: nextStatus,
      message:
        trimmedMessage ||
        `Status updated to "${nextStatus}" by Cotton Nest Atelier.`,
      respondedBy: update.respondedBy?.trim() || 'Cotton Nest Admin',
      createdAt: nowIso,
    });
  }

  const updatedComplaint: OrderComplaint = {
    ...existing,
    status: nextStatus,
    ...(trimmedMessage
      ? { adminResponse: trimmedMessage }
      : existing.adminResponse
      ? { adminResponse: existing.adminResponse }
      : {}),
    responseHistory: prevHistory,
    updatedAt: nowIso,
  };

  return { valid: true, complaint: updatedComplaint };
}
