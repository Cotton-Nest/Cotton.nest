import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Printer,
  Mail,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  MapPin,
  Phone,
  Calendar,
  Package,
} from 'lucide-react';
import { Order } from '../data/orders';
import { COMPANY_DETAILS } from '../data/products';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function buildOrderGmailUrl(order: Order): string {
  const customerEmail = order.customerEmail || '';
  const adminEmail = 'adityaa.451485@gmail.com';
  const recipients = [adminEmail];
  if (customerEmail && customerEmail.includes('@') && !customerEmail.endsWith('@cottonnest.orders')) {
    recipients.unshift(customerEmail);
  }

  const subject = `💐 Order Invoice #${order.id} - Cotton Nest Atelier (₹${Number(order.totalAmount || 0).toLocaleString('en-IN')})`;

  const lines: string[] = [];
  lines.push(`COTTON NEST ATELIER - OFFICIAL ORDER RECEIPT`);
  lines.push(`100% Pure Combed Cotton Bedding | Sector 46, Gurgaon`);
  lines.push(`====================================================`);
  lines.push(`Order ID: #${order.id}`);
  lines.push(`Order Date: ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}`);
  if (order.trackingNumber) lines.push(`Tracking Ref: ${order.trackingNumber}`);
  lines.push(`Customer: ${order.customerName || 'Valued Customer'}`);
  lines.push(`Phone: +91 ${order.customerPhone || 'N/A'}`);
  if (customerEmail) lines.push(`Email: ${customerEmail}`);
  if (order.customerAddress) lines.push(`Delivery Address: ${order.customerAddress}`);
  lines.push(`----------------------------------------------------`);
  lines.push(`ITEMS ORDERED:`);

  (order.items || []).forEach((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const total = qty * price;
    const dims = item.dimensions ? ` (${item.dimensions})` : '';
    const vName = item.variantName ? ` - ${item.variantName}` : '';
    lines.push(`${idx + 1}. ${item.productName}${vName}${dims}`);
    lines.push(`   Quantity: ${qty} | Unit: ₹${price.toLocaleString('en-IN')} | Total: ₹${total.toLocaleString('en-IN')}`);
    if (item.productImage) lines.push(`   Photo: ${item.productImage}`);
  });

  lines.push(`----------------------------------------------------`);
  lines.push(`FINANCIAL SUMMARY:`);
  lines.push(`Merchandise Total: ₹${Number(order.totalAmount || 0).toLocaleString('en-IN')}`);
  if (order.couponDiscount && order.couponDiscount > 0) {
    lines.push(`Coupon Discount (${order.couponCode || 'APPLIED'}): -₹${order.couponDiscount.toLocaleString('en-IN')}`);
  }
  if (order.pointsDiscount && order.pointsDiscount > 0) {
    lines.push(`Nest Points Redeemed: -₹${order.pointsDiscount.toLocaleString('en-IN')}`);
  }
  lines.push(`Delivery Fee: ${order.shippingCost && order.shippingCost > 0 ? `₹${order.shippingCost}` : 'FREE'}`);
  lines.push(`GRAND TOTAL: ₹${Number(order.totalAmount || 0).toLocaleString('en-IN')}`);

  if (order.pointsEarned && order.pointsEarned > 0) {
    lines.push(`🎁 Nest Points Earned: +${order.pointsEarned} pts (5 pts per ₹100 spent)`);
  }

  lines.push(`====================================================`);
  lines.push(`Atelier Address: ${COMPANY_DETAILS.address}`);
  lines.push(`Founder WhatsApp & Helpline: +91 7838625915`);
  lines.push(`Official Gmail: adityaa.451485@gmail.com`);

  const body = lines.join('\n');
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients.join(','))}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, isOpen, onClose }) => {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleResendEmail = async () => {
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          shippingMethod: order.shippingCost ? 'Standard Delivery' : 'Sector 46 Complimentary',
          subtotal: Number(order.totalAmount) || 0,
          couponCode: order.couponCode,
          couponDiscount: Number(order.couponDiscount) || 0,
          pointsUsed: Number(order.pointsUsed) || 0,
          pointsDiscount: Number(order.pointsDiscount) || 0,
          shippingCost: Number(order.shippingCost) || 0,
          finalTotal: Number(order.totalAmount) || 0,
          items: (order.items || []).map((it) => ({
            name: it.productName,
            variantName: it.variantName,
            dimensions: it.dimensions || '108 x 108 inches',
            quantity: Number(it.quantity) || 1,
            price: Number(it.price) || 0,
            imageUrl: it.productImage || '',
          })),
          createdAt: order.createdAt,
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        setSendResult({
          success: true,
          message: data.sentViaSmtp
            ? `Receipt delivered via Gmail SMTP to ${data.recipients?.join(', ') || 'customer and admin'}.`
            : `Invoice generated successfully. Use "Open in Gmail" button below to dispatch.`,
        });
      } else {
        setSendResult({
          success: false,
          message: data.error || 'Failed to dispatch email. Please use the Gmail compose link.',
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Network error while sending email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const gmailComposeUrl = buildOrderGmailUrl(order);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs print:hidden"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl z-10 border border-[#DEC89B] overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0 print:p-0"
        >
          {/* Header Bar (Hidden during print) */}
          <div className="px-5 py-3.5 bg-[#FAF7F2] border-b border-[#EAE2D5] flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8C2E46]" />
              <h3 className="font-serif-luxury text-base font-bold text-[#2C2420]">
                Official Order Invoice #{order.id}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#8C2E46]" />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[#6B5D55] hover:text-[#2C2420] rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Paper Area */}
          <div className="p-6 sm:p-8 overflow-y-auto print:overflow-visible space-y-6 text-[#2C2420]">
            {/* Atelier Brand & Contact */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#EAE2D5] pb-5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8C2E46] block mb-1">
                  100% Pure Long-Staple Cotton Bedding
                </span>
                <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420]">
                  Cotton Nest Atelier
                </h1>
                <p className="text-xs text-[#7A6458] mt-1 max-w-sm">
                  {COMPANY_DETAILS.address}
                </p>
                <p className="text-xs text-[#7A6458] mt-0.5">
                  Phone / WhatsApp: +91 7838625915 · Sector 46 Gurgaon
                </p>
                <p className="text-xs text-[#7A6458]">
                  Official Email: adityaa.451485@gmail.com
                </p>
              </div>

              <div className="sm:text-right bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#EAE2D5] sm:min-w-[190px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C2E46] block">
                  Tax / Order Invoice
                </span>
                <span className="font-mono text-base font-bold text-[#2C2420] block mt-0.5">
                  #{order.id}
                </span>
                <span className="text-xs text-[#7A6458] block mt-1">
                  Date: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN')}
                </span>
                {order.trackingNumber && (
                  <span className="text-[11px] font-mono text-[#8C2E46] block mt-1 font-semibold">
                    Ref: {order.trackingNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Bill To & Delivery Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-1">
                <span className="text-[10px] font-bold text-[#7A6458] uppercase tracking-wider block">
                  Buyer Information
                </span>
                <p className="font-bold text-sm text-[#2C2420]">{order.customerName || 'Valued Customer'}</p>
                <p className="text-[#6B5D55]">Phone: +91 {order.customerPhone || 'N/A'}</p>
                {order.customerEmail && (
                  <p className="text-[#6B5D55]">Email: {order.customerEmail}</p>
                )}
                <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold capitalize">
                  Payment: {order.paymentMethod === 'whatsapp' ? 'WhatsApp Confirmation' : order.paymentMethod}
                </span>
              </div>

              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-1">
                <span className="text-[10px] font-bold text-[#7A6458] uppercase tracking-wider block">
                  Shipping Destination
                </span>
                <p className="text-[#2C2420] font-medium leading-relaxed">
                  {order.customerAddress || 'Sector 46, Gurgaon, Haryana'}
                </p>
                <p className="text-[11px] text-[#7A6458] pt-1">
                  Speed: {order.shippingCost ? 'Standard Express Across India' : 'Sector 46 Complimentary Delivery'}
                </p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-[#EAE2D5] rounded-2xl overflow-hidden">
              <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#EAE2D5] grid grid-cols-12 text-[11px] font-bold text-[#7A6458] uppercase tracking-wider">
                <span className="col-span-7">Bedsheet Specification</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-3 text-right">Amount (INR)</span>
              </div>

              <div className="divide-y divide-[#EAE2D5]">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="p-3.5 grid grid-cols-12 items-center text-xs gap-2">
                    <div className="col-span-7 flex items-center gap-3">
                      {item.productImage && (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-12 h-12 rounded-lg object-cover border border-[#DEC89B] shrink-0"
                        />
                      )}
                      <div>
                        <p className="font-bold text-[#2C2420] text-xs">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-[#7A6458]">
                          {item.dimensions || '108 x 108 inches'} · 100% Combed Cotton
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 text-center font-semibold text-[#2C2420]">
                      {item.quantity}
                    </div>
                    <div className="col-span-3 text-right font-bold text-[#2C2420]">
                      ₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1 max-w-sm">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                  <span>Nest Loyalty Points Earned</span>
                </div>
                <p className="text-[11px] text-amber-900 font-semibold">
                  🎁 +{order.pointsEarned || Math.floor((Number(order.totalAmount || 0) / 100) * 5)} Nest Points credited to customer balance (5 pts / ₹100 spent).
                </p>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#6B5D55]">
                  <span>Subtotal</span>
                  <span>₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {Boolean(order.couponDiscount && order.couponDiscount > 0) && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Coupon Discount</span>
                    <span>-₹{Number(order.couponDiscount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {Boolean(order.pointsDiscount && order.pointsDiscount > 0) && (
                  <div className="flex justify-between text-amber-800 font-medium">
                    <span>Points Redeemed</span>
                    <span>-₹{Number(order.pointsDiscount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#6B5D55]">
                  <span>Shipping &amp; Delivery</span>
                  <span className="text-emerald-700 font-semibold">
                    {order.shippingCost ? `₹${order.shippingCost}` : 'FREE'}
                  </span>
                </div>
                <div className="border-t border-[#DEC89B] pt-2 flex justify-between text-base font-bold text-[#2C2420]">
                  <span>Grand Total</span>
                  <span className="text-[#8C2E46]">
                    ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Reassurance */}
            <div className="border-t border-[#EAE2D5] pt-4 text-center text-[11px] text-[#7A6458] space-y-1">
              <p className="font-semibold text-[#2C2420]">
                Thank you for supporting handcrafted pure cotton bedding!
              </p>
              <p>
                Cotton Nest Atelier · Sector 46 Gurgaon, Haryana · WhatsApp Helpline: +91 7838625915
              </p>
            </div>
          </div>

          {/* Bottom Action Footer (Hidden during print) */}
          <div className="p-4 bg-[#FAF7F2] border-t border-[#EAE2D5] flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grow sm:grow-0 px-4 py-2.5 bg-[#8C2E46] hover:bg-[#722338] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Receipt in Gmail</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </a>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isSending}
                className="grow sm:grow-0 px-3.5 py-2.5 bg-white hover:bg-[#FAF7F2] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5 text-[#8C2E46]" />
                <span>{isSending ? 'Sending Email...' : 'Email Receipt to Buyer'}</span>
              </button>
            </div>

            {sendResult && (
              <p
                className={`text-xs font-semibold ${
                  sendResult.success ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                {sendResult.message}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#7A6458] hover:text-[#2C2420] font-semibold cursor-pointer shrink-0"
            >
              Close Window
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
