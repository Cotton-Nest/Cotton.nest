export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  dimensions: string;
  size?: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderTimelineStep {
  status: OrderStatus;
  timestamp: string;
  title: string;
  description: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  userId?: string;
  customerAddress: string;
  paymentMethod: 'whatsapp' | 'cod' | 'upi';
  items: OrderItem[];
  subtotal?: number;
  totalAmount: number;
  shippingCost?: number;
  totalSavings: number;
  couponCode?: string;
  couponDiscount?: number;
  benefitType?: 'welcome_offer' | 'nest_points' | 'coupon' | 'none';
  welcomeOfferApplied?: boolean;
  welcomeCouponCode?: string;
  welcomeDiscount?: number;
  pointsUsed?: number;
  pointsDiscount?: number;
  pointsEarned?: number;
  pointsCredited?: boolean;
  pointsRefunded?: boolean;
  status: OrderStatus;
  deliveredAt?: string;
  updatedAt?: number;
  invoiceNumber?: string;
  invoiceGenerated?: boolean;
  invoiceGeneratedAt?: string;
  invoiceSent?: boolean;
  invoiceSentAt?: string;
  invoiceStatus?: 'pending_confirmation' | 'generated' | 'cancelled_before_confirmation' | 'failed';
  invoiceMessage?: string;
  invoiceResult?: any;
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  timeline?: OrderTimelineStep[];
}

// Clean, empty initial orders list (no mock/fake orders)
export const INITIAL_ORDERS: Order[] = [];

