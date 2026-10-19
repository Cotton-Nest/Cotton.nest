export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  dimensions: string;
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
  totalAmount: number;
  totalSavings: number;
  status: OrderStatus;
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  timeline?: OrderTimelineStep[];
}

// Clean, empty initial orders list (no mock/fake orders)
export const INITIAL_ORDERS: Order[] = [];
