import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  MessageCircle,
  Phone,
  MapPin,
  Mail,
  ExternalLink,
  ZoomIn,
  X,
  Package,
  Send,
  Sparkles,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../data/orders';
import {
  OrderComplaint,
  ComplaintStatus,
  ComplaintRequestType,
  COMPLAINT_STATUSES,
} from '../data/complaints';
import { getComplaintsApi, updateComplaintStatusApi } from '../services/api';
import { resolveBedsheetImage } from '../utils/imageUrl';

interface AdminComplaintsSubsectionProps {
  orders: Order[];
  onShowToast?: (message: string) => void;
  onJumpToOrder?: (orderId: string) => void;
}

export const AdminComplaintsSubsection: React.FC<AdminComplaintsSubsectionProps> = ({
  orders,
  onShowToast,
  onJumpToOrder,
}) => {
  const [complaints, setComplaints] = useState<OrderComplaint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | ComplaintRequestType>('All');

  // Per-complaint draft state for status & admin response
  const [draftStatuses, setDraftStatuses] = useState<Record<string, ComplaintStatus>>({});
  const [draftResponses, setDraftResponses] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Enlarge Photo Lightbox state
  const [enlargedGallery, setEnlargedGallery] = useState<{
    complaint: OrderComplaint;
    index: number;
  } | null>(null);

  // View Original Order Modal state
  const [inspectedOrder, setInspectedOrder] = useState<{
    order: Order | null;
    orderId: string;
    complaint: OrderComplaint;
  } | null>(null);

  const fetchAllComplaints = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const list = await getComplaintsApi();
      setComplaints(list);
    } catch (err) {
      console.warn('Error loading complaints in Admin Panel:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllComplaints(false);

    // Real-time Firestore listener on site_content/complaints_registry
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(
        doc(db, 'site_content', 'complaints_registry'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.items)) {
              const sorted = [...(data.items as OrderComplaint[])].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              setComplaints(sorted);
            }
          }
        },
        () => {}
      );
    } catch {}

    const interval = setInterval(() => {
      fetchAllComplaints(true);
    }, 4000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSaveUpdate = async (complaint: OrderComplaint) => {
    const nextStatus = draftStatuses[complaint.id] || complaint.status;
    const nextResponse =
      draftResponses[complaint.id] !== undefined
        ? draftResponses[complaint.id]
        : complaint.adminResponse || '';

    setSavingId(complaint.id);
    try {
      const updated = await updateComplaintStatusApi(
        complaint.id,
        {
          status: nextStatus,
          adminResponse: nextResponse.trim(),
          respondedBy: 'Cotton Nest Admin',
        },
        complaint
      );

      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      onShowToast?.(
        `Updated Complaint #${complaint.id} to "${updated.status}"${
          nextResponse.trim() ? ' & sent response to customer' : ''
        }`
      );
    } catch (err: any) {
      onShowToast?.(err.message || 'Failed to update complaint.');
    } finally {
      setSavingId(null);
    }
  };

  const handleQuickStatusChange = async (
    complaint: OrderComplaint,
    newStatus: ComplaintStatus
  ) => {
    setDraftStatuses((prev) => ({ ...prev, [complaint.id]: newStatus }));
    setSavingId(complaint.id);
    try {
      const currentResp =
        draftResponses[complaint.id] !== undefined
          ? draftResponses[complaint.id]
          : complaint.adminResponse || '';
      const updated = await updateComplaintStatusApi(
        complaint.id,
        {
          status: newStatus,
          adminResponse: currentResp.trim(),
          respondedBy: 'Cotton Nest Admin',
        },
        complaint
      );
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      onShowToast?.(`Complaint #${complaint.id} status updated to "${newStatus}"`);
    } catch (err: any) {
      onShowToast?.(err.message || 'Failed to update status.');
    } finally {
      setSavingId(null);
    }
  };

  const handleOpenOriginalOrder = (complaint: OrderComplaint) => {
    const found =
      orders.find((o) => o.id?.toLowerCase() === complaint.orderId.toLowerCase()) ||
      null;
    setInspectedOrder({
      order: found,
      orderId: complaint.orderId,
      complaint,
    });
  };

  const getStatusBadgeClasses = (status: ComplaintStatus) => {
    switch (status) {
      case 'New':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Under Review':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Approved':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Exchange Processing':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Resolved':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
    }
  };

  const getRequestBadgeClasses = (type: ComplaintRequestType) => {
    switch (type) {
      case 'Return':
        return 'bg-rose-100 text-[#5E1924] border-rose-300';
      case 'Exchange':
        return 'bg-amber-100 text-amber-950 border-amber-300';
      case 'Product Complaint':
        return 'bg-orange-100 text-orange-950 border-orange-300';
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (typeFilter !== 'All' && c.requestType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = [
        c.id,
        c.orderId,
        c.customerName,
        c.customerPhone,
        c.customerEmail,
        c.productName,
        c.variantName,
        c.requestType,
        c.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const newCount = complaints.filter((c) => c.status === 'New').length;
  const activeReviewCount = complaints.filter(
    (c) =>
      c.status === 'Under Review' ||
      c.status === 'Approved' ||
      c.status === 'Exchange Processing'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;

  return (
    <div className="space-y-6" data-testid="admin-complaints-subsection">
      {/* Summary KPI Row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#DEC89B] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Total Complaints</span>
            <RotateCcw className="w-4 h-4 text-[#5E1924]" />
          </div>
          <div className="text-2xl font-bold font-serif-luxury text-[#2C2420]">
            {complaints.length}
          </div>
          <p className="text-[10px] text-[#7A6458] mt-0.5">Returns, exchanges &amp; defects</p>
        </div>

        <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#DEC89B] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">New Requests</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-serif-luxury text-amber-700">
            {newCount}
          </div>
          <p className="text-[10px] text-[#7A6458] mt-0.5">Awaiting initial review</p>
        </div>

        <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#DEC89B] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">In Progress</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-serif-luxury text-purple-700">
            {activeReviewCount}
          </div>
          <p className="text-[10px] text-[#7A6458] mt-0.5">Review / Exchange Processing</p>
        </div>

        <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#DEC89B] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-serif-luxury text-emerald-700">
            {resolvedCount}
          </div>
          <p className="text-[10px] text-emerald-700 mt-0.5">Completed resolutions</p>
        </div>
      </section>

      {/* Search & Filter Controls */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#EAE2D5]">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C7A70]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search complaint ID, order ID, customer, product..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#DEC89B] rounded-xl text-xs text-[#2C2420] placeholder-[#8C7A70] focus:outline-hidden focus:border-[#5E1924]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Request Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#DEC89B] text-xs font-semibold text-[#2C2420]"
          >
            <option value="All">All Types</option>
            <option value="Return">Return</option>
            <option value="Exchange">Exchange</option>
            <option value="Product Complaint">Product Complaint</option>
          </select>

          {/* Status Filter Pills */}
          {(['All', ...COMPLAINT_STATUSES] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#5E1924] text-[#FAF6F0] shadow-2xs'
                  : 'bg-white text-[#6B5D55] border border-[#EAE2D5] hover:bg-[#FAF6F0]'
              }`}
            >
              {st}
            </button>
          ))}

          <button
            type="button"
            onClick={() => fetchAllComplaints(false)}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#DEC89B] text-xs font-semibold text-[#2C2420] hover:bg-[#FAF6F0] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5E1924] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {/* Complaints List */}
      <section className="space-y-4">
        {filteredComplaints.length > 0 ? (
          filteredComplaints.map((cmp) => {
            const currentDraftStatus = draftStatuses[cmp.id] || cmp.status;
            const currentDraftResponse =
              draftResponses[cmp.id] !== undefined
                ? draftResponses[cmp.id]
                : cmp.adminResponse || '';
            const cleanPhone = String(cmp.customerPhone || '').replace(/\D/g, '');
            const waText = encodeURIComponent(
              `Hello ${cmp.customerName}! Cotton Nest Quality Team here regarding your ${cmp.requestType} request #${cmp.id} for Order #${cmp.orderId} (${cmp.productName}). Current status: ${cmp.status}.`
            );

            return (
              <div
                key={cmp.id}
                data-testid={`admin-complaint-card-${cmp.id}`}
                className="rounded-2xl border border-[#DEC89B] bg-[#FAF6F0] p-4 sm:p-6 shadow-xs space-y-5"
              >
                {/* Header Bar: Complaint ID, Original Order ID, Request Type, Submission Date, Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EAE2D5]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-[#5E1924] bg-white px-3 py-1 rounded-xl border border-[#C5A059]">
                      Complaint #{cmp.id}
                    </span>

                    <button
                      type="button"
                      data-testid={`view-original-order-btn-${cmp.id}`}
                      onClick={() => handleOpenOriginalOrder(cmp)}
                      className="px-3 py-1 rounded-xl bg-[#2C2420] hover:bg-[#3D332D] text-[#FAF6F0] text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="View full original order details"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Original Order #{cmp.orderId}</span>
                    </button>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRequestBadgeClasses(
                        cmp.requestType
                      )}`}
                    >
                      {cmp.requestType}
                    </span>

                    <span className="text-xs text-[#7A6458]">
                      Submitted:{' '}
                      {new Date(cmp.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`admin-complaint-status-badge-${cmp.id}`}
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadgeClasses(
                        cmp.status
                      )}`}
                    >
                      {cmp.status}
                    </span>

                    <select
                      aria-label={`Change status for complaint ${cmp.id}`}
                      data-testid={`admin-status-select-${cmp.id}`}
                      value={currentDraftStatus}
                      onChange={(e) =>
                        handleQuickStatusChange(cmp, e.target.value as ComplaintStatus)
                      }
                      disabled={savingId === cmp.id}
                      className="bg-white border border-[#C5A059] rounded-xl px-3 py-1.5 text-xs font-bold text-[#2C2420] focus:outline-hidden focus:border-[#5E1924] cursor-pointer"
                    >
                      {COMPLAINT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Main 12-Col Grid: Customer Info (Cols 1-4), Product & Complaint Description (Cols 5-8), Cloudinary Defect Photos (Cols 9-12) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Cols 1-4: Customer Details */}
                  <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-[#EAE2D5] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458]">
                        Customer Details
                      </span>
                      <span className="text-[10px] font-mono text-[#5E1924] font-semibold">
                        Order #{cmp.orderId}
                      </span>
                    </div>

                    <div className="font-serif-luxury font-bold text-base text-[#2C2420]">
                      {cmp.customerName}
                    </div>

                    <div className="space-y-1 text-[#6B5D55]">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                        <span>{cmp.customerPhone || 'N/A'}</span>
                      </div>
                      {cmp.customerEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                          <span className="truncate">{cmp.customerEmail}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                        <span className="leading-snug">{cmp.customerAddress}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#EAE2D5]">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Customer</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenOriginalOrder(cmp)}
                        className="px-2.5 py-1.5 bg-[#FAF6F0] hover:bg-[#EAE2D5] text-[#2C2420] border border-[#DEC89B] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5E1924]" />
                        <span>View Order</span>
                      </button>
                    </div>
                  </div>

                  {/* Cols 5-8: Specific Product, Size, Variant & Complaint Description */}
                  <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-[#EAE2D5] space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                        Specific Product, Size &amp; Variant
                      </span>
                      <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] mt-0.5">
                        {cmp.productName}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mt-2 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#EAE2D5] text-[11px]">
                        <div>
                          <span className="text-[#7A6458] block text-[10px]">Size / Dimensions</span>
                          <strong className="text-[#2C2420]">
                            {cmp.productSize || cmp.productDimensions}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#7A6458] block text-[10px]">Variant</span>
                          <strong className="text-[#5E1924]">
                            {cmp.variantName || 'Signature Classic'}
                          </strong>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#7A6458] mt-1.5">
                        <span>Product ID: <code className="font-mono">{cmp.productId}</code></span>
                        <span className="font-bold text-[#2C2420]">
                          Qty: {cmp.productQuantity || 1} · ₹{Number(cmp.productPrice || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#EAE2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block mb-1">
                        {cmp.requestType} Issue Description
                      </span>
                      <p className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EAE2D5] text-[#2C2420] leading-relaxed">
                        {cmp.description}
                      </p>
                    </div>
                  </div>

                  {/* Cols 9-12: Customer-Uploaded Defect Photos (Loaded Directly from Cloudinary) */}
                  <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-[#EAE2D5] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458]">
                        Customer Defect Photos ({cmp.photos?.length || 0})
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Cloudinary Hosted
                      </span>
                    </div>

                    {cmp.photos && cmp.photos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        {cmp.photos.map((photo, pIdx) => (
                          <div
                            key={`${photo.publicId}_${pIdx}`}
                            className="rounded-xl border border-[#DEC89B] overflow-hidden bg-[#FAF6F0] flex flex-col"
                          >
                            <button
                              type="button"
                              data-testid={`admin-enlarge-photo-${cmp.id}-${pIdx}`}
                              onClick={() =>
                                setEnlargedGallery({ complaint: cmp, index: pIdx })
                              }
                              className="relative h-28 w-full group cursor-pointer overflow-hidden"
                              title="Click to enlarge defect photo"
                            >
                              <img
                                src={photo.url}
                                alt={`Customer defect photo ${pIdx + 1} for ${cmp.id}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[11px] font-semibold">
                                <ZoomIn className="w-4 h-4" />
                                <span>Enlarge</span>
                              </div>
                            </button>
                            <div className="px-2 py-1.5 bg-white border-t border-[#EAE2D5] text-[10px] font-mono text-[#7A6458] truncate" title={photo.publicId}>
                              {photo.publicId}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#8C7A70] italic">No defect photos attached.</p>
                    )}
                  </div>
                </div>

                {/* Admin Response & Status Update Action Bar */}
                <div className="bg-white p-4 rounded-2xl border border-[#DEC89B] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label
                      htmlFor={`admin-response-input-${cmp.id}`}
                      className="text-xs font-bold text-[#5E1924] uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Send Response to Customer &amp; Update Status</span>
                    </label>
                    <span className="text-[11px] text-[#7A6458]">
                      Customer sees this response and status live under Order #{cmp.orderId}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <textarea
                      id={`admin-response-input-${cmp.id}`}
                      data-testid={`admin-response-textarea-${cmp.id}`}
                      rows={2}
                      value={currentDraftResponse}
                      onChange={(e) =>
                        setDraftResponses((prev) => ({
                          ...prev,
                          [cmp.id]: e.target.value,
                        }))
                      }
                      placeholder="Write a clear update or resolution message for the customer (e.g., 'Approved for exchange. Our courier partner will pick up and deliver a replacement King bedsheet tomorrow.')..."
                      className="grow p-3 rounded-xl bg-[#FAF6F0] border border-[#DEC89B] text-xs text-[#2C2420] placeholder-[#8C7A70] focus:outline-hidden focus:border-[#5E1924]"
                    />

                    <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`admin-save-complaint-btn-${cmp.id}`}
                        onClick={() => handleSaveUpdate(cmp)}
                        disabled={savingId === cmp.id}
                        className="px-5 py-2.5 bg-[#5E1924] hover:bg-[#48121B] text-[#FAF6F0] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>
                          {savingId === cmp.id ? 'Saving...' : 'Update & Send Response'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Audit History */}
                  {cmp.responseHistory && cmp.responseHistory.length > 0 && (
                    <div className="pt-2 border-t border-[#EAE2D5] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                        Complaint Activity History
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {cmp.responseHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="text-[11px] flex items-start justify-between gap-2 text-[#6B5D55]"
                          >
                            <div>
                              <span className="font-bold text-[#2C2420]">[{entry.status}]</span>{' '}
                              <span>{entry.message}</span>
                            </div>
                            <span className="text-[10px] text-[#8C7A70] shrink-0">
                              {new Date(entry.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-[#FAF6F0] rounded-2xl border border-[#EAE2D5] p-6">
            <RotateCcw className="w-8 h-8 text-[#C5A059] mx-auto mb-2" />
            <p className="font-semibold text-sm text-[#2C2420]">No complaints found</p>
            <p className="text-xs text-[#7A6458] mt-1">
              Customer Return, Exchange, and Product Complaint submissions will appear here in real time.
            </p>
          </div>
        )}
      </section>

      {/* ENLARGE PHOTO LIGHTBOX MODAL */}
      {enlargedGallery && (
        <div
          data-testid="admin-photo-lightbox-modal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
          onClick={() => setEnlargedGallery(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#1C1412] rounded-3xl border border-[#C5A059] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const photos = enlargedGallery.complaint.photos || [];
              const activePhoto = photos[enlargedGallery.index] || photos[0];
              if (!activePhoto) return null;
              return (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 text-white">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#C5A059]">
                          Complaint #{enlargedGallery.complaint.id} · Order #{enlargedGallery.complaint.orderId}
                        </span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded">
                          Photo {enlargedGallery.index + 1} of {photos.length}
                        </span>
                      </div>
                      <p className="text-xs text-white/90 mt-0.5">
                        {enlargedGallery.complaint.productName} ({enlargedGallery.complaint.productSize} · {enlargedGallery.complaint.variantName})
                      </p>
                      <p className="text-[10px] font-mono text-[#C5A059]/90 mt-0.5">
                        Cloudinary Public ID: {activePhoto.publicId}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="close-admin-lightbox-btn"
                      onClick={() => setEnlargedGallery(null)}
                      className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="relative p-4 flex items-center justify-center bg-black min-h-[340px] max-h-[75vh]">
                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEnlargedGallery((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  index: (prev.index - 1 + photos.length) % photos.length,
                                }
                              : null
                          )
                        }
                        className="absolute left-4 p-2.5 rounded-full bg-black/70 text-white hover:bg-black border border-white/20 cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    <img
                      src={activePhoto.url}
                      alt="Enlarged customer uploaded defect"
                      className="max-h-[68vh] w-auto object-contain rounded-xl"
                    />

                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEnlargedGallery((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  index: (prev.index + 1) % photos.length,
                                }
                              : null
                          )
                        }
                        className="absolute right-4 p-2.5 rounded-full bg-black/70 text-white hover:bg-black border border-white/20 cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* VIEW ORIGINAL ORDER INSPECTOR MODAL */}
      {inspectedOrder && (
        <div
          data-testid="admin-original-order-modal"
          className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setInspectedOrder(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#FAF6F0] rounded-3xl border border-[#C5A059] overflow-hidden shadow-2xl text-[#2C2420]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[#5E1924] text-[#FAF6F0]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] block">
                  Linked to Complaint #{inspectedOrder.complaint.id}
                </span>
                <h3 className="font-serif-luxury text-xl font-bold">
                  Original Order #{inspectedOrder.orderId}
                </h3>
              </div>
              <button
                type="button"
                data-testid="close-original-order-modal-btn"
                onClick={() => setInspectedOrder(null)}
                className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[78vh] overflow-y-auto space-y-4 text-xs">
              {inspectedOrder.order ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-white rounded-2xl border border-[#EAE2D5]">
                    <div>
                      <p className="font-bold text-sm text-[#2C2420]">
                        {inspectedOrder.order.customerName}
                      </p>
                      <p className="text-[#6B5D55]">
                        Phone: {inspectedOrder.order.customerPhone} ·{' '}
                        {inspectedOrder.order.customerEmail || 'No email'}
                      </p>
                      <p className="text-[#7A6458] mt-0.5">
                        Address: {inspectedOrder.order.customerAddress}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                        Order Status: {inspectedOrder.order.status}
                      </span>
                      <p className="text-[11px] text-[#7A6458] mt-1">
                        Placed{' '}
                        {new Date(inspectedOrder.order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      Products in Original Order ({inspectedOrder.order.items.length})
                    </span>
                    {inspectedOrder.order.items.map((item, idx) => {
                      const isComplainedProduct =
                        item.productId === inspectedOrder.complaint.productId;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                            isComplainedProduct
                              ? 'bg-amber-50/70 border-[#5E1924]'
                              : 'bg-white border-[#EAE2D5]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveBedsheetImage(item.productImage, item.productId)}
                              alt={item.productName}
                              className="w-12 h-12 rounded-xl object-cover border border-[#DEC89B]"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#2C2420]">
                                  {item.productName}
                                </span>
                                {isComplainedProduct && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5E1924] text-white">
                                    Flagged in #{inspectedOrder.complaint.id}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#6B5D55]">
                                {item.dimensions} · Qty: {item.quantity}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-[#5E1924]">
                            ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-[#EAE2D5] font-bold text-sm">
                    <span>Original Order Total</span>
                    <span className="text-[#5E1924]">
                      ₹{inspectedOrder.order.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-white rounded-2xl border border-[#EAE2D5] space-y-1">
                  <p className="font-bold text-[#2C2420]">
                    Order #{inspectedOrder.orderId} Summary
                  </p>
                  <p className="text-[#6B5D55]">
                    Customer: {inspectedOrder.complaint.customerName} ({inspectedOrder.complaint.customerPhone})
                  </p>
                  <p className="text-[#6B5D55]">
                    Product: {inspectedOrder.complaint.productName} ({inspectedOrder.complaint.productSize})
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {onJumpToOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetOrderId = inspectedOrder.orderId;
                      setInspectedOrder(null);
                      onJumpToOrder(targetOrderId);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#2C2420] text-white text-xs font-semibold cursor-pointer"
                  >
                    Locate in Orders List
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedOrder(null)}
                  className="px-5 py-2 rounded-xl bg-[#5E1924] text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
