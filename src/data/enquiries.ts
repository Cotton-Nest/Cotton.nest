export type EnquiryStatus =
  | 'new'
  | 'contacted'
  | 'negotiation'
  | 'converted'
  | 'closed';

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  negotiation: 'Negotiation in Progress',
  converted: 'Converted to Order',
  closed: 'Closed / Not Interested',
};

export const ENQUIRY_STATUS_OPTIONS: Array<{ value: EnquiryStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'negotiation', label: 'Negotiation in Progress' },
  { value: 'converted', label: 'Converted to Order' },
  { value: 'closed', label: 'Closed / Not Interested' },
];

export interface EnquiryRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  productDimensions?: string;
  variantName?: string;
  quantity: number;
  message: string;
  status: EnquiryStatus;
  adminNotes?: string;
  convertedOrderId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: number;
  source?: 'product_enquiry' | 'enquiry_tab' | 'store_visit' | 'wishlist_enquiry';
}

export function generateEnquiryId(): string {
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ENQ-${datePart}-${randomPart}`;
}
