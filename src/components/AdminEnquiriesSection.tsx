import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Phone,
  MessageCircle,
  Mail,
  Search,
  Calendar,
  ShoppingBag,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  X,
  Plus,
  FileText,
  ArrowRight,
  Package,
  User,
  Filter,
  Save,
  Sparkles,
  Check,
  MapPin,
} from 'lucide-react';
import { BedsheetProduct } from '../data/products';
import { Order } from '../data/orders';
import {
  EnquiryRecord,
  EnquiryStatus,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_STATUS_OPTIONS,
  generateEnquiryId,
} from '../data/enquiries';
import {
  subscribeToEnquiries,
  saveEnquiryApi,
  updateEnquiryApi,
  deleteEnquiryApi,
  saveOrder,
} from '../services/api';
import { resolveBedsheetImage } from '../utils/imageUrl';

interface AdminEnquiriesSectionProps {
  products: BedsheetProduct[];
  shippingFee?: number;
  onOrderConverted?: (newOrder: Order) => void;
  onNavigateToOrders?: () => void;
  onToast: (msg: string) => void;
}

export const AdminEnquiriesSection: React.FC<AdminEnquiriesSectionProps> = ({
  products,
  shippingFee = 29,
  onOrderConverted,
  onNavigateToOrders,
  onToast,
}) => {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Modal states
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryRecord | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<EnquiryRecord | null>(null);

  // Convert to Order modal state
  const [convertTarget, setConvertTarget] = useState<EnquiryRecord | null>(null);
  const [convertCustomerName, setConvertCustomerName] = useState<string>('');
  const [convertCustomerPhone, setConvertCustomerPhone] = useState<string>('');
  const [convertCustomerEmail, setConvertCustomerEmail] = useState<string>('');
  const [convertCustomerAddress, setConvertCustomerAddress] = useState<string>('');
  const [convertProductId, setConvertProductId] = useState<string>('');
  const [convertQuantity, setConvertQuantity] = useState<number>(1);
  const [convertUnitPrice, setConvertUnitPrice] = useState<number>(1899);
  const [convertShippingCost, setConvertShippingCost] = useState<number>(shippingFee);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'whatsapp' | 'cod' | 'upi'>('whatsapp');
  const [convertOrderNotes, setConvertOrderNotes] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Manual Log New Enquiry modal state
  const [isAddEnquiryModalOpen, setIsAddEnquiryModalOpen] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>('');
  const [newProductId, setNewProductId] = useState<string>(products[0]?.id || 'sheet-1');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newMessage, setNewMessage] = useState<string>('');
  const [newAdminNotes, setNewAdminNotes] = useState<string>('');

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToEnquiries((list) => {
      setEnquiries(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Keep selectedEnquiry in sync with real-time updates
  useEffect(() => {
    if (selectedEnquiry) {
      const updated = enquiries.find((e) => e.id === selectedEnquiry.id);
      if (updated) {
        setSelectedEnquiry(updated);
      }
    }
  }, [enquiries]);

  // Dashboard Summary Metrics
  const summary = useMemo(() => {
    const total = enquiries.length;
    const newCount = enquiries.filter((e) => e.status === 'new').length;
    const contactedCount = enquiries.filter(
      (e) => e.status === 'contacted' || e.status === 'negotiation'
    ).length;
    const convertedCount = enquiries.filter((e) => e.status === 'converted').length;
    const closedCount = enquiries.filter((e) => e.status === 'closed').length;
    return { total, newCount, contactedCount, convertedCount, closedCount };
  }, [enquiries]);

  // Unique products represented in enquiries + catalog
  const productFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p && p.id) map.set(p.id, p.name);
    });
    enquiries.forEach((e) => {
      if (e && e.productId && !map.has(e.productId)) {
        map.set(e.productId, e.productName || e.productId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products, enquiries]);

  // Filtered Enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      if (!item) return false;

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (productFilter !== 'all' && item.productId !== productFilter) {
        return false;
      }

      if (dateFilter !== 'all') {
        const createdTime = new Date(item.createdAt || 0).getTime();
        const now = Date.now();
        if (dateFilter === 'today') {
          const todayStr = new Date().toISOString().slice(0, 10);
          const itemStr = new Date(item.createdAt || 0).toISOString().slice(0, 10);
          if (todayStr !== itemStr) return false;
        } else if (dateFilter === '7days') {
          if (now - createdTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateFilter === '30days') {
          if (now - createdTime > 30 * 24 * 60 * 60 * 1000) return false;
        } else if (dateFilter === 'custom' && customDate) {
          const itemDateStr = new Date(item.createdAt || 0).toISOString().slice(0, 10);
          if (itemDateStr !== customDate) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          String(item.id || '').toLowerCase().includes(q) ||
          String(item.customerName || '').toLowerCase().includes(q) ||
          String(item.customerPhone || '').toLowerCase().includes(q) ||
          String(item.customerEmail || '').toLowerCase().includes(q) ||
          String(item.productName || '').toLowerCase().includes(q) ||
          String(item.productId || '').toLowerCase().includes(q) ||
          String(item.message || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [enquiries, statusFilter, productFilter, dateFilter, customDate, searchQuery]);

  const formatDateTime = (isoOrTimestamp?: string | number) => {
    if (!isoOrTimestamp) return '—';
    const d = new Date(isoOrTimestamp);
    if (isNaN(d.getTime())) return String(isoOrTimestamp);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClasses = (status: EnquiryStatus) => {
    switch (status) {
      case 'new':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'contacted':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'negotiation':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'converted':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'closed':
        return 'bg-stone-100 text-stone-600 border-stone-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const buildCustomerWhatsAppUrl = (enq: EnquiryRecord) => {
    const rawDigits = String(enq.customerPhone || '').replace(/\D/g, '');
    const normalizedPhone =
      rawDigits.length === 10
        ? `91${rawDigits}`
        : rawDigits.length > 10
        ? rawDigits
        : '917838625915';
    const msg = [
      `Hello ${enq.customerName || 'there'}! 🪷`,
      `Greetings from *Cotton Nest Bedding Atelier* (Sector 46, Gurgaon).`,
      ``,
      `We received your enquiry (*#${enq.id}*) regarding:`,
      `• *Bedsheet:* ${enq.productName} (ID: ${enq.productId})`,
      `• *Quantity:* ${enq.quantity} Set(s)`,
      ``,
      `This piece is available at our studio. How may we assist you with your order?`,
    ].join('\n');
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(msg)}`;
  };

  const buildCustomerCallUrl = (phone?: string) => {
    const digits = String(phone || '').replace(/[^\d+]/g, '');
    return `tel:${digits || '+917838625915'}`;
  };

  const handleStatusChange = async (enq: EnquiryRecord, nextStatus: EnquiryStatus) => {
    if (enq.status === nextStatus) return;
    setEnquiries((prev) =>
      prev.map((item) =>
        item.id === enq.id ? { ...item, status: nextStatus, updatedAt: Date.now() } : item
      )
    );
    await updateEnquiryApi(enq.id, { status: nextStatus });
    onToast(`Enquiry #${enq.id} status updated to "${ENQUIRY_STATUS_LABELS[nextStatus]}"`);
  };

  const handleOpenDetails = (enq: EnquiryRecord) => {
    setSelectedEnquiry(enq);
    setNotesDraft(enq.adminNotes || '');
  };

  const handleSaveAdminNotes = async (enqId: string, notesText: string) => {
    setIsSavingNotes(true);
    try {
      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === enqId ? { ...item, adminNotes: notesText, updatedAt: Date.now() } : item
        )
      );
      await updateEnquiryApi(enqId, { adminNotes: notesText });
      onToast(`Internal admin notes saved for Enquiry #${enqId}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setEnquiries((prev) => prev.filter((e) => e.id !== id));
    if (selectedEnquiry?.id === id) {
      setSelectedEnquiry(null);
    }
    setDeleteTarget(null);
    await deleteEnquiryApi(id);
    onToast(`Enquiry #${id} deleted.`);
  };

  const handleOpenConvertModal = (enq: EnquiryRecord) => {
    const matchedProd = products.find((p) => p.id === enq.productId);
    setConvertTarget(enq);
    setConvertCustomerName(enq.customerName || '');
    setConvertCustomerPhone(
      enq.customerPhone && !enq.customerPhone.includes('Not provided') ? enq.customerPhone : ''
    );
    setConvertCustomerEmail(enq.customerEmail || '');
    setConvertCustomerAddress(enq.customerAddress || 'Sector 46, Gurgaon, Haryana');
    setConvertProductId(matchedProd ? matchedProd.id : enq.productId || products[0]?.id || 'sheet-1');
    setConvertQuantity(Math.max(1, Number(enq.quantity) || 1));
    setConvertUnitPrice(Number(enq.productPrice || matchedProd?.price) || 1899);
    setConvertShippingCost(shippingFee);
    setConvertPaymentMethod('whatsapp');
    setConvertOrderNotes(
      `Converted from Customer Enquiry #${enq.id}. Customer message: "${enq.message || ''}"`
    );
  };

  const handleExecuteConvertToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget) return;
    if (!convertCustomerName.trim() || !convertCustomerPhone.trim()) {
      onToast('Please enter customer name and mobile/WhatsApp number to create the order.');
      return;
    }

    setIsConverting(true);
    try {
      const matchedProd = products.find((p) => p.id === convertProductId);
      const nowIso = new Date().toISOString();
      const dateCode = `${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`;
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const newOrderId = `CN-ORD-${dateCode}-${randomDigits}`;

      const qty = Math.max(1, Number(convertQuantity) || 1);
      const unitPrice = Math.max(0, Number(convertUnitPrice) || 1899);
      const origPrice = matchedProd ? Math.max(unitPrice, Number(matchedProd.originalPrice) || unitPrice) : unitPrice;
      const subtotal = unitPrice * qty;
      const ship = Math.max(0, Number(convertShippingCost) || 0);
      const totalAmount = subtotal + ship;
      const totalSavings = Math.max(0, (origPrice - unitPrice) * qty);

      const newOrder: Order = {
        id: newOrderId,
        createdAt: nowIso,
        customerName: convertCustomerName.trim(),
        customerPhone: convertCustomerPhone.trim(),
        customerEmail: convertCustomerEmail.trim() || undefined,
        customerAddress: convertCustomerAddress.trim() || 'Sector 46, Gurgaon',
        paymentMethod: convertPaymentMethod,
        items: [
          {
            productId: matchedProd ? matchedProd.id : convertTarget.productId,
            productName: matchedProd ? matchedProd.name : convertTarget.productName,
            productImage: matchedProd
              ? resolveBedsheetImage(matchedProd.image, matchedProd.id)
              : convertTarget.productImage,
            dimensions:
              matchedProd?.dimensions ||
              convertTarget.productDimensions ||
              '108 x 108 inches (274 x 274 cm)',
            size: matchedProd?.size || 'King',
            variantName: convertTarget.variantName,
            price: unitPrice,
            quantity: qty,
          },
        ],
        subtotal,
        shippingCost: ship,
        totalAmount,
        totalSavings,
        status: 'pending',
        sourceEnquiryId: convertTarget.id,
        notes: convertOrderNotes.trim() || `Converted from Enquiry #${convertTarget.id}`,
      };

      // 1. Save regular order to regular orders collection
      await saveOrder(newOrder);

      // 2. Mark original enquiry as "Converted to Order" and maintain reference
      const enqUpdates: Partial<EnquiryRecord> = {
        status: 'converted',
        convertedOrderId: newOrder.id,
        convertedAt: nowIso,
        customerName: convertCustomerName.trim(),
        customerPhone: convertCustomerPhone.trim(),
        customerEmail: convertCustomerEmail.trim() || convertTarget.customerEmail,
        customerAddress: convertCustomerAddress.trim(),
      };

      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === convertTarget.id ? { ...item, ...enqUpdates, updatedAt: Date.now() } : item
        )
      );
      await updateEnquiryApi(convertTarget.id, enqUpdates);

      if (onOrderConverted) {
        onOrderConverted(newOrder);
      }

      onToast(
        `Enquiry #${convertTarget.id} converted to Regular Order #${newOrder.id}!`
      );
      setConvertTarget(null);
    } catch (err: any) {
      onToast(`Failed to convert enquiry: ${err?.message || 'Error'}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleCreateManualEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      onToast('Please enter customer name and mobile/WhatsApp number.');
      return;
    }
    const matchedProd = products.find((p) => p.id === newProductId) || products[0];
    const created = await saveEnquiryApi({
      id: generateEnquiryId(),
      customerName: newCustomerName.trim(),
      customerPhone: newCustomerPhone.trim(),
      customerEmail: newCustomerEmail.trim() || undefined,
      productId: matchedProd ? matchedProd.id : newProductId,
      productName: matchedProd ? matchedProd.name : 'Cotton Nest Pure Cotton Bedsheet',
      productImage: matchedProd
        ? resolveBedsheetImage(matchedProd.image, matchedProd.id)
        : '/images/exact_sheet1_pink_rose_1790997736396.jpg',
      productPrice: matchedProd ? Number(matchedProd.price) || 1899 : 1899,
      productDimensions: matchedProd?.dimensions || '108 x 108 inches (274 x 274 cm)',
      quantity: Math.max(1, Number(newQuantity) || 1),
      message:
        newMessage.trim() ||
        `Interested in ${matchedProd?.name || 'bedsheet'} (Qty: ${newQuantity}).`,
      adminNotes: newAdminNotes.trim(),
      status: 'new',
      source: 'enquiry_tab',
    });

    setEnquiries((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    setIsAddEnquiryModalOpen(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewQuantity(1);
    setNewMessage('');
    setNewAdminNotes('');
    onToast(`Enquiry #${created.id} logged in Enquiry Orders.`);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EAE2D5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C2E46]">
              Dedicated Enquiry Management
            </span>
            <span className="text-xs text-[#7A6458]">·</span>
            <span className="text-xs text-[#7A6458] font-medium">
              Separate from Regular Checkout Orders
            </span>
          </div>
          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420]">
            Enquiry Orders Dashboard
          </h2>
          <p className="text-xs text-[#7A6458]">
            Manage customer product &amp; studio enquiries, follow up via WhatsApp or phone, add internal notes, and convert qualified enquiries into regular orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddEnquiryModalOpen(true)}
            className="px-4 py-2.5 bg-[#70252D] hover:bg-[#5a1d24] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Log Customer Enquiry</span>
          </button>
        </div>
      </div>

      {/* 6. Dashboard Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[#2C2420] text-white border-[#2C2420] shadow-sm'
              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-[#DEC89B]'
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              statusFilter === 'all' ? 'text-[#DEC89B]' : 'text-[#7A6458]'
            }`}
          >
            Total Enquiries
          </p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums">
            {summary.total}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              statusFilter === 'all' ? 'text-[#EAE2D5]/80' : 'text-[#8C7A70]'
            }`}
          >
            All recorded enquiries
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'new'
              ? 'bg-amber-700 text-white border-amber-700 shadow-sm'
              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-amber-300'
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              statusFilter === 'new' ? 'text-amber-100' : 'text-amber-700'
            }`}
          >
            New Enquiries
          </p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums">
            {summary.newCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              statusFilter === 'new' ? 'text-amber-100/90' : 'text-[#8C7A70]'
            }`}
          >
            Awaiting response
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('contacted')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'contacted' || statusFilter === 'negotiation'
              ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-blue-300'
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              statusFilter === 'contacted' || statusFilter === 'negotiation'
                ? 'text-blue-100'
                : 'text-blue-700'
            }`}
          >
            Contacted
          </p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums">
            {summary.contactedCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              statusFilter === 'contacted' || statusFilter === 'negotiation'
                ? 'text-blue-100/90'
                : 'text-[#8C7A70]'
            }`}
          >
            In active follow-up
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('converted')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'converted'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-emerald-300'
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              statusFilter === 'converted' ? 'text-emerald-100' : 'text-emerald-700'
            }`}
          >
            Converted to Orders
          </p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums">
            {summary.convertedCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              statusFilter === 'converted' ? 'text-emerald-100/90' : 'text-[#8C7A70]'
            }`}
          >
            Moved to regular orders
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('closed')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === 'closed'
              ? 'bg-stone-700 text-white border-stone-700 shadow-sm'
              : 'bg-white text-[#2C2420] border-[#EAE2D5] hover:border-stone-300'
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              statusFilter === 'closed' ? 'text-stone-200' : 'text-stone-600'
            }`}
          >
            Closed Enquiries
          </p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums">
            {summary.closedCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              statusFilter === 'closed' ? 'text-stone-200/90' : 'text-[#8C7A70]'
            }`}
          >
            Closed / Not interested
          </p>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE2D5] shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, Enquiry ID, product..."
              className="w-full pl-9 pr-8 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7A70] hover:text-[#2C2420] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Product Filter */}
          <div className="lg:col-span-3">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
            >
              <option value="all">All Bedsheet Products</option>
              {productFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} ({opt.id})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="lg:col-span-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Specific Date</option>
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
            >
              <option value="all">All Statuses</option>
              {ENQUIRY_STATUS_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-1">
            <Calendar className="w-4 h-4 text-[#8C2E46]" />
            <span className="text-xs font-medium text-[#6B5D55]">Select Enquiry Date:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 bg-[#FAF7F2] border border-[#DEC89B] rounded-lg text-xs text-[#2C2420]"
            />
          </div>
        )}

        {/* Interactive Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#70252D] text-white'
                : 'bg-[#FAF7F2] text-[#6B5D55] hover:text-[#2C2420]'
            }`}
          >
            All ({enquiries.length})
          </button>
          {ENQUIRY_STATUS_OPTIONS.map((opt) => {
            const count = enquiries.filter((e) => e.status === opt.value).length;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  statusFilter === opt.value
                    ? 'bg-[#70252D] text-white'
                    : 'bg-[#FAF7F2] text-[#6B5D55] hover:text-[#2C2420]'
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Enquiries List / Table */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-[#EAE2D5] space-y-3">
          <div className="w-8 h-8 border-2 border-[#70252D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#7A6458]">Loading customer enquiries...</p>
        </div>
      ) : filteredEnquiries.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-[#EAE2D5] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-center justify-center mx-auto text-[#8C2E46]">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
              No Matching Customer Enquiries
            </h3>
            <p className="text-xs text-[#7A6458] leading-relaxed">
              {enquiries.length === 0
                ? 'Customer enquiries submitted from the website Enquiry tab or product cards will appear here in real time.'
                : 'No enquiries match your current search or filter criteria.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            {(searchQuery || statusFilter !== 'all' || productFilter !== 'all' || dateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setProductFilter('all');
                  setDateFilter('all');
                }}
                className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] text-xs font-semibold rounded-xl border border-[#DEC89B] cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddEnquiryModalOpen(true)}
              className="px-4 py-2 bg-[#70252D] hover:bg-[#5a1d24] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Enquiry</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEnquiries.map((enq) => {
            const matchedProduct = products.find((p) => p.id === enq.productId);
            const displayImage = enq.productImage || (matchedProduct ? resolveBedsheetImage(matchedProduct.image, matchedProduct.id) : '/images/exact_sheet1_pink_rose_1790997736396.jpg');

            return (
              <div
                key={enq.id}
                className="bg-white rounded-3xl p-4 sm:p-6 border border-[#EAE2D5] shadow-xs hover:border-[#DEC89B] transition-all space-y-4"
              >
                {/* Top Row: ID, Timestamp, Status Selector & Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4EFE6]">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#2C2420] bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#EAE2D5]">
                      #{enq.id}
                    </span>
                    <span className="text-[#8C7A70]">·</span>
                    <span className="text-[#6B5D55] font-mono tabular-nums flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C29E57]" />
                      {formatDateTime(enq.createdAt)}
                    </span>
                    {enq.convertedOrderId && (
                      <>
                        <span className="text-[#8C7A70]">·</span>
                        <button
                          type="button"
                          onClick={() => onNavigateToOrders && onNavigateToOrders()}
                          className="text-emerald-800 font-semibold underline hover:text-emerald-950 cursor-pointer flex items-center gap-1 font-mono"
                          title="View Converted Regular Order"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Order #{enq.convertedOrderId}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Status Dropdown & View/Delete Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Status for Enquiry ${enq.id}`}
                      value={enq.status}
                      onChange={(e) => handleStatusChange(enq, e.target.value as EnquiryStatus)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer focus:outline-none ${getStatusBadgeClasses(
                        enq.status
                      )}`}
                    >
                      {ENQUIRY_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white text-[#2C2420]">
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(enq)}
                      className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] border border-[#EAE2D5] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Details &amp; Notes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(enq)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                      title="Delete Enquiry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Middle Row: Product Details + Customer Info + Enquiry Message */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Product Image & Info (4 cols) */}
                  <div className="lg:col-span-4 flex items-start gap-3.5 bg-[#FAF7F2] p-3 rounded-2xl border border-[#EAE2D5]">
                    <img
                      src={displayImage}
                      alt={enq.productName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          '/images/exact_sheet1_pink_rose_1790997736396.jpg';
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-[#DEC89B] shrink-0 bg-stone-100"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-[#2C2420] leading-snug">
                        {enq.productName}
                      </p>
                      <p className="text-[11px] text-[#7A6458] font-mono">
                        Product ID: <span className="font-semibold text-[#2C2420]">{enq.productId}</span>
                        {enq.variantName ? ` · ${enq.variantName}` : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-mono tabular-nums">
                        <span className="font-bold text-[#8C2E46]">
                          Qty: {enq.quantity}
                        </span>
                        <span className="text-[#8C7A70]">·</span>
                        <span className="font-semibold text-[#2C2420]">
                          ₹{((Number(enq.productPrice) || 1899) * (Number(enq.quantity) || 1)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Contact Details (3 cols) */}
                  <div className="lg:col-span-3 space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A70]">
                      Customer Details
                    </p>
                    <p className="font-bold text-[#2C2420] text-sm flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#C29E57] shrink-0" />
                      <span className="truncate">{enq.customerName || 'Website Visitor'}</span>
                    </p>
                    <p className="text-[#4A3E38] font-mono tabular-nums flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{enq.customerPhone || 'Not provided'}</span>
                    </p>
                    {enq.customerEmail && (
                      <p className="text-[#6B5D55] flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-[#8C2E46] shrink-0" />
                        <span className="truncate">{enq.customerEmail}</span>
                      </p>
                    )}
                  </div>

                  {/* Customer Enquiry Message & Internal Notes Preview (5 cols) */}
                  <div className="lg:col-span-5 space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A70] mb-1">
                        Customer&apos;s Enquiry Message
                      </p>
                      <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-[#2C2420] leading-relaxed">
                        {enq.message || 'Interested in this bedsheet. Please confirm availability.'}
                      </div>
                    </div>

                    {enq.adminNotes && (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 text-[11px]">
                        <span className="font-bold">Admin Note: </span>
                        <span>{enq.adminNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar: WhatsApp, Call, Notes, Convert to Order */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#F4EFE6]">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={buildCustomerWhatsAppUrl(enq)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (enq.status === 'new') {
                          handleStatusChange(enq, 'contacted');
                        }
                      }}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Customer</span>
                    </a>

                    <a
                      href={buildCustomerCallUrl(enq.customerPhone)}
                      className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#8C2E46]" />
                      <span>Call Customer</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(enq)}
                      className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#6B5D55] hover:text-[#2C2420] border border-[#EAE2D5] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#C29E57]" />
                      <span>{enq.adminNotes ? 'Edit Admin Notes' : 'Add Admin Note'}</span>
                    </button>
                  </div>

                  {/* Convert to Order Button */}
                  <div>
                    {enq.status === 'converted' && enq.convertedOrderId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5 font-mono">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Converted to #{enq.convertedOrderId}</span>
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenConvertModal(enq)}
                        className="px-4 py-2 bg-[#70252D] hover:bg-[#5a1d24] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Convert to Order</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: VIEW COMPLETE ENQUIRY DETAILS & INTERNAL ADMIN NOTES         */}
      {/* ===================================================================== */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setSelectedEnquiry(null)} />
          <div className="relative bg-[#FAF7F2] w-full max-w-2xl rounded-3xl border border-[#DEC89B] shadow-2xl p-6 sm:p-7 z-10 text-[#2C2420] max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EAE2D5]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#8C2E46]">
                    Enquiry #{selectedEnquiry.id}
                  </span>
                  <span className="text-xs text-[#8C7A70]">·</span>
                  <span className="text-xs text-[#6B5D55] font-mono tabular-nums">
                    {formatDateTime(selectedEnquiry.createdAt)}
                  </span>
                </div>
                <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420] mt-1">
                  Complete Enquiry Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="p-1.5 rounded-full hover:bg-[#EAE2D5] text-[#7A6458] hover:text-[#2C2420] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Card inside Detail Modal */}
            <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img
                src={selectedEnquiry.productImage}
                alt={selectedEnquiry.productName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    '/images/exact_sheet1_pink_rose_1790997736396.jpg';
                }}
                className="w-20 h-20 rounded-2xl object-cover border border-[#DEC89B] shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                  {selectedEnquiry.productName}
                </h4>
                <p className="text-xs text-[#6B5D55] font-mono">
                  Product ID: <strong>{selectedEnquiry.productId}</strong>
                  {selectedEnquiry.variantName ? ` · Variant: ${selectedEnquiry.variantName}` : ''}
                </p>
                <p className="text-xs text-[#7A6458]">
                  Dimensions: {selectedEnquiry.productDimensions || '108 x 108 inches (274 x 274 cm)'}
                </p>
              </div>
              <div className="text-left sm:text-right font-mono tabular-nums shrink-0">
                <p className="text-xs text-[#7A6458]">Quantity: <strong>{selectedEnquiry.quantity}</strong></p>
                <p className="text-base font-bold text-[#8C2E46]">
                  ₹{((Number(selectedEnquiry.productPrice) || 1899) * (Number(selectedEnquiry.quantity) || 1)).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Customer Details & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A70]">
                  Customer Information
                </p>
                <p className="font-bold text-sm text-[#2C2420]">{selectedEnquiry.customerName}</p>
                <p className="font-mono text-[#4A3E38]">Phone / WhatsApp: {selectedEnquiry.customerPhone}</p>
                <p className="text-[#6B5D55]">
                  Email: {selectedEnquiry.customerEmail || 'Not provided'}
                </p>
                {selectedEnquiry.customerAddress && (
                  <p className="text-[#6B5D55]">Address: {selectedEnquiry.customerAddress}</p>
                )}
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A70]">
                  Enquiry Status
                </p>
                <select
                  value={selectedEnquiry.status}
                  onChange={(e) =>
                    handleStatusChange(selectedEnquiry, e.target.value as EnquiryStatus)
                  }
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${getStatusBadgeClasses(
                    selectedEnquiry.status
                  )}`}
                >
                  {ENQUIRY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white text-[#2C2420]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {selectedEnquiry.convertedOrderId && (
                  <p className="text-emerald-800 font-semibold font-mono text-[11px]">
                    Converted Order Ref: #{selectedEnquiry.convertedOrderId}
                  </p>
                )}
              </div>
            </div>

            {/* Customer Enquiry Message */}
            <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A70]">
                Customer&apos;s Enquiry Message
              </p>
              <p className="text-xs sm:text-sm text-[#2C2420] leading-relaxed whitespace-pre-line">
                {selectedEnquiry.message}
              </p>
            </div>

            {/* Internal Admin Notes Editor */}
            <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#2C2420]">
                  Internal Admin Notes (Private to Atelier)
                </label>
                <button
                  type="button"
                  disabled={isSavingNotes}
                  onClick={() => handleSaveAdminNotes(selectedEnquiry.id, notesDraft)}
                  className="px-3 py-1.5 bg-[#2C2420] hover:bg-[#433731] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#DEC89B]" />
                  <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add internal follow-up notes, preferred delivery slot, custom discount discussed, etc..."
                className="w-full p-3 bg-[#FAF7F2] border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#70252D]"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EAE2D5]">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={buildCustomerWhatsAppUrl(selectedEnquiry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Reply on WhatsApp</span>
                </a>
                <a
                  href={buildCustomerCallUrl(selectedEnquiry.customerPhone)}
                  className="px-4 py-2.5 bg-white hover:bg-[#F4EFE6] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-[#8C2E46]" />
                  <span>Call Customer</span>
                </a>
              </div>

              {selectedEnquiry.status !== 'converted' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedEnquiry;
                    setSelectedEnquiry(null);
                    handleOpenConvertModal(target);
                  }}
                  className="px-5 py-2.5 bg-[#70252D] hover:bg-[#5a1d24] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Convert to Regular Order</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CONVERT ENQUIRY TO REGULAR ORDER                             */}
      {/* ===================================================================== */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setConvertTarget(null)} />
          <div className="relative bg-[#FAF7F2] w-full max-w-xl rounded-3xl border border-[#DEC89B] shadow-2xl p-6 sm:p-7 z-10 text-[#2C2420] max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EAE2D5]">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8C2E46]">
                  Convert Enquiry #{convertTarget.id}
                </span>
                <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420] mt-0.5">
                  Create Regular Checkout Order
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Generates a unique regular Order ID and links it to Enquiry #{convertTarget.id}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConvertTarget(null)}
                className="p-1.5 rounded-full hover:bg-[#EAE2D5] text-[#7A6458] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteConvertToOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={convertCustomerName}
                    onChange={(e) => setConvertCustomerName(e.target.value)}
                    placeholder="Customer full name"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Mobile / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={convertCustomerPhone}
                    onChange={(e) => setConvertCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Customer Email (for Invoice)
                  </label>
                  <input
                    type="email"
                    value={convertCustomerEmail}
                    onChange={(e) => setConvertCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Payment Method
                  </label>
                  <select
                    value={convertPaymentMethod}
                    onChange={(e) => setConvertPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  >
                    <option value="whatsapp">WhatsApp Direct / UPI QR</option>
                    <option value="upi">UPI Instant Pay</option>
                    <option value="cod">Cash on Delivery (COD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#2C2420] mb-1">
                  Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  value={convertCustomerAddress}
                  onChange={(e) => setConvertCustomerAddress(e.target.value)}
                  placeholder="House/Flat No, Sector, City, Pincode"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Bedsheet Product
                  </label>
                  <select
                    value={convertProductId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setConvertProductId(nextId);
                      const found = products.find((p) => p.id === nextId);
                      if (found) {
                        setConvertUnitPrice(Number(found.price) || 1899);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={convertQuantity}
                    onChange={(e) => setConvertQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={convertUnitPrice}
                    onChange={(e) => setConvertUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-[#EAE2D5] flex items-center justify-between font-mono text-xs tabular-nums">
                <span className="text-[#6B5D55]">
                  Order Total ({convertQuantity} × ₹{convertUnitPrice.toLocaleString('en-IN')} + ₹{convertShippingCost} shipping):
                </span>
                <span className="text-base font-bold text-[#8C2E46]">
                  ₹{(convertQuantity * convertUnitPrice + Number(convertShippingCost || 0)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#EAE2D5]">
                <button
                  type="button"
                  onClick={() => setConvertTarget(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="px-5 py-2.5 bg-[#70252D] hover:bg-[#5a1d24] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isConverting ? 'Creating Order...' : 'Confirm & Create Regular Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: DELETE ENQUIRY CONFIRMATION                                  */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-rose-200 shadow-2xl z-10 text-[#2C2420]">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                  Delete Enquiry #{deleteTarget.id}?
                </h3>
                <p className="text-xs text-[#7A6458] mt-0.5">
                  This will permanently remove the enquiry from {deleteTarget.customerName} for &ldquo;{deleteTarget.productName}&rdquo;.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Enquiry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: MANUALLY LOG A NEW CUSTOMER ENQUIRY                          */}
      {/* ===================================================================== */}
      {isAddEnquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddEnquiryModalOpen(false)} />
          <div className="relative bg-[#FAF7F2] w-full max-w-lg rounded-3xl border border-[#DEC89B] shadow-2xl p-6 sm:p-7 z-10 text-[#2C2420] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE2D5]">
              <div>
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  Log Customer Enquiry
                </h3>
                <p className="text-xs text-[#7A6458]">
                  Record a direct WhatsApp, phone, or studio enquiry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEnquiryModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#EAE2D5] text-[#7A6458] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualEnquiry} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Ritu Sharma"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Mobile / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="+91 98100 12345"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="ritu@example.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2C2420] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#2C2420] mb-1">
                  Product
                </label>
                <select
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id} · ₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2C2420] mb-1">
                  Customer&apos;s Enquiry Message
                </label>
                <textarea
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Customer's question or customization request..."
                  className="w-full p-3 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C2420] mb-1">
                  Internal Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newAdminNotes}
                  onChange={(e) => setNewAdminNotes(e.target.value)}
                  placeholder="Internal note for studio staff..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#EAE2D5]">
                <button
                  type="button"
                  onClick={() => setIsAddEnquiryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#70252D] hover:bg-[#5a1d24] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Enquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
