import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Upload,
  Camera,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ZoomIn,
  MessageSquare,
  Package,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderItem } from '../data/orders';
import {
  OrderComplaint,
  ComplaintRequestType,
  ComplaintStatus,
  ComplaintPhoto,
  COMPLAINT_REQUEST_TYPES,
  extractProductSizeAndVariant,
} from '../data/complaints';
import {
  getComplaintsApi,
  submitComplaintApi,
  uploadComplaintPhotoToCloudinary,
  deleteFromCloudinary,
} from '../services/api';

interface OrderComplaintSectionProps {
  order: Order;
  compact?: boolean;
  onComplaintSubmitted?: (complaint: OrderComplaint) => void;
}

export const OrderComplaintSection: React.FC<OrderComplaintSectionProps> = ({
  order,
  compact = false,
  onComplaintSubmitted,
}) => {
  const [complaints, setComplaints] = useState<OrderComplaint[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form state - Default to Exchange as per Cotton Nest 48-hour defect exchange policy
  const [requestType, setRequestType] = useState<ComplaintRequestType>('Exchange');
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<ComplaintPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState<boolean>(false);
  const [uploadingSlotIndex, setUploadingSlotIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<OrderComplaint | null>(null);

  // Lightbox preview state
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    publicId: string;
    caption?: string;
  } | null>(null);

  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const orderItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const selectedItem: OrderItem | undefined = orderItems[selectedItemIndex] || orderItems[0];

  // Fetch complaints for this order
  const loadOrderComplaints = async (silent = false) => {
    if (!silent) setIsLoadingComplaints(true);
    try {
      const list = await getComplaintsApi({ orderId: order.id });
      setComplaints(list);
    } catch (err) {
      console.warn('Could not fetch order complaints:', err);
    } finally {
      if (!silent) setIsLoadingComplaints(false);
    }
  };

  useEffect(() => {
    loadOrderComplaints(false);

    // Real-time Firestore listener on site_content/complaints_registry
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(
        doc(db, 'site_content', 'complaints_registry'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.items)) {
              const forOrder = (data.items as OrderComplaint[])
                .filter((c) => c && c.orderId?.toLowerCase() === order.id.toLowerCase())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setComplaints(forOrder);
            }
          }
        },
        () => {}
      );
    } catch {}

    // Also poll backend every 4 seconds for instant status updates
    const interval = setInterval(() => {
      loadOrderComplaints(true);
    }, 4000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [order.id]);

  const handleOpenModal = () => {
    setFormError(null);
    setSubmitSuccess(null);
    setRequestType('Exchange');
    setDescription('');
    setUploadedPhotos([]);

    // Default to first product in the order that doesn't already have a complaint, or index 0
    const uncomplainedIdx = orderItems.findIndex(
      (it) => !complaints.some((c) => c.productId === it.productId)
    );
    setSelectedItemIndex(uncomplainedIdx >= 0 ? uncomplainedIdx : 0);
    setIsModalOpen(true);
  };

  // Upload one or more newly selected customer defect photos directly to Cloudinary
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedItem) return;

    setFormError(null);
    setIsUploadingPhotos(true);

    try {
      const fileArray = Array.from(files);
      const newlyUploaded: ComplaintPhoto[] = [];

      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" is not a valid image file. Please upload JPG, PNG, or WEBP photos.`);
        }
        const uploaded = await uploadComplaintPhotoToCloudinary(
          file,
          order.id,
          selectedItem.productId
        );
        newlyUploaded.push({
          url: uploaded.url,
          publicId: uploaded.publicId,
          orderId: order.id,
          productId: selectedItem.productId,
          uploadedAt: uploaded.uploadedAt,
          width: uploaded.width,
          height: uploaded.height,
          format: uploaded.format,
        });
      }

      setUploadedPhotos((prev) => [...prev, ...newlyUploaded]);
    } catch (err: any) {
      setFormError(err.message || 'Failed to upload photo to Cloudinary. Please try again.');
    } finally {
      setIsUploadingPhotos(false);
      if (addFileInputRef.current) {
        addFileInputRef.current.value = '';
      }
    }
  };

  // Replace an existing photo at `replaceIndex` before submitting
  const handleTriggerReplacePhoto = (idx: number) => {
    setReplaceIndex(idx);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleReplacePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null || !selectedItem) return;

    setFormError(null);
    setUploadingSlotIndex(replaceIndex);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error(`"${file.name}" is not an image file.`);
      }
      const oldPhoto = uploadedPhotos[replaceIndex];
      const uploaded = await uploadComplaintPhotoToCloudinary(
        file,
        order.id,
        selectedItem.productId
      );

      const replacement: ComplaintPhoto = {
        url: uploaded.url,
        publicId: uploaded.publicId,
        orderId: order.id,
        productId: selectedItem.productId,
        uploadedAt: uploaded.uploadedAt,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
      };

      setUploadedPhotos((prev) =>
        prev.map((p, i) => (i === replaceIndex ? replacement : p))
      );

      // Best-effort delete old replaced image from Cloudinary
      if (oldPhoto?.publicId) {
        deleteFromCloudinary(oldPhoto.publicId).catch(() => {});
      }
    } catch (err: any) {
      setFormError(err.message || 'Could not replace photo. Please try again.');
    } finally {
      setUploadingSlotIndex(null);
      setReplaceIndex(null);
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = '';
      }
    }
  };

  // Remove a photo before submitting
  const handleRemovePhoto = (idx: number) => {
    const target = uploadedPhotos[idx];
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
    if (target?.publicId) {
      deleteFromCloudinary(target.publicId).catch(() => {});
    }
  };

  // Submit the Return / Exchange / Complaint
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedItem) {
      setFormError('Please select the product from your order.');
      return;
    }
    if (description.trim().length < 5) {
      setFormError('Please describe the issue with the product you received (at least 5 characters).');
      return;
    }
    if (uploadedPhotos.length === 0) {
      setFormError('Please upload at least one photo of the actual defective or damaged product you received.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemMeta = extractProductSizeAndVariant(selectedItem);
      const created = await submitComplaintApi(
        {
          orderId: order.id,
          productId: selectedItem.productId,
          variantId: itemMeta.variantId,
          variantName: itemMeta.variantName,
          requestType,
          description: description.trim(),
          photos: uploadedPhotos.map((p) => ({
            url: p.url,
            publicId: p.publicId,
            orderId: order.id,
            productId: selectedItem.productId,
            uploadedAt: p.uploadedAt,
            width: p.width,
            height: p.height,
            format: p.format,
          })),
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          userId: order.userId,
        },
        order
      );

      setComplaints((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setSubmitSuccess(created);
      onComplaintSubmitted?.(created);
    } catch (err: any) {
      setFormError(err.message || 'Could not submit your request. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status: ComplaintStatus) => {
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

  const getRequestTypeBadgeStyle = (type: ComplaintRequestType) => {
    switch (type) {
      case 'Exchange':
        return 'bg-amber-50 text-amber-950 border-amber-300';
      case 'Product Complaint':
        return 'bg-orange-50 text-orange-950 border-orange-300';
      default:
        return 'bg-neutral-50 text-[#70252D] border-[#DEC89B]';
    }
  };

  const getStatusProgressStep = (status: ComplaintStatus): number => {
    switch (status) {
      case 'New':
        return 1;
      case 'Under Review':
        return 2;
      case 'Approved':
      case 'Exchange Processing':
      case 'Rejected':
        return 3;
      case 'Resolved':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="pt-4 border-t border-[#EAE2D5] space-y-4">
      {/* Exchange / Complaint Action Bar underneath every Order Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#DEC89B]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5E1924]/10 border border-[#C5A059]/40 flex items-center justify-center text-[#5E1924] shrink-0">
            <RefreshCw className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#2C2420]">
                Defect Exchange &amp; Complaint Desk
              </span>
              {complaints.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5E1924] text-[#FAF6F0]">
                  {complaints.length} Submitted
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B5D55]">
              Received a damaged or defective bedsheet in Order #{order.id}? Request an exchange under our 48-Hour Guarantee.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid={`return-exchange-btn-${order.id}`}
          onClick={handleOpenModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#5E1924] hover:bg-[#48121B] text-[#FAF6F0] text-xs font-semibold rounded-xl border border-[#C5A059]/50 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>{complaints.length > 0 ? 'New Exchange / Complaint' : 'Request Exchange'}</span>
        </button>
      </div>

      {/* Customer Tracking Cards for Submitted Complaints under this Order */}
      {!isLoadingComplaints && complaints.length > 0 && (
        <div className="space-y-3" data-testid={`order-complaints-list-${order.id}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#5E1924] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Submitted Exchange &amp; Complaint Tracking ({complaints.length})</span>
            </p>
            <span className="text-[10px] text-[#7A6458]">Live status synced with Cotton Nest Admin</span>
          </div>

          {complaints.map((cmp) => {
            const stepNum = getStatusProgressStep(cmp.status);
            return (
              <div
                key={cmp.id}
                data-testid={`customer-complaint-card-${cmp.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DEC89B] shadow-xs space-y-4"
              >
                {/* Top Row: ID, Request Type, Date, Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAE2D5]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#2C2420] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#DEC89B]">
                      Complaint #{cmp.id}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getRequestTypeBadgeStyle(
                        cmp.requestType
                      )}`}
                    >
                      {cmp.requestType}
                    </span>
                    <span className="text-[11px] text-[#7A6458]">
                      Submitted{' '}
                      {new Date(cmp.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <span
                    data-testid={`customer-complaint-status-${cmp.id}`}
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadgeStyle(
                      cmp.status
                    )}`}
                  >
                    Status: {cmp.status}
                  </span>
                </div>

                {/* 4-Stage Visual Progress Bar */}
                {!compact && (
                  <div className="grid grid-cols-4 gap-2 pt-1 text-[10px]">
                    {[
                      { step: 1, label: 'New Request' },
                      { step: 2, label: 'Under Review' },
                      {
                        step: 3,
                        label:
                          cmp.status === 'Rejected'
                            ? 'Rejected'
                            : cmp.status === 'Exchange Processing'
                            ? 'Exchange Processing'
                            : 'Approved / Action',
                      },
                      { step: 4, label: 'Resolved' },
                    ].map((s) => {
                      const active = stepNum >= s.step;
                      const isRejectedStep = cmp.status === 'Rejected' && s.step === 3;
                      return (
                        <div key={s.step} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isRejectedStep
                                ? 'bg-rose-500'
                                : active
                                ? 'bg-[#5E1924]'
                                : 'bg-[#EAE2D5]'
                            }`}
                          />
                          <p
                            className={`font-semibold truncate ${
                              active ? 'text-[#2C2420]' : 'text-[#8C7A70]'
                            }`}
                          >
                            {s.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Product & Issue Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start text-xs">
                  <div className="md:col-span-7 space-y-2">
                    <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EAE2D5] space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458]">
                        Product in Order #{cmp.orderId}
                      </div>
                      <div className="font-serif-luxury font-bold text-sm text-[#2C2420]">
                        {cmp.productName}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B5D55]">
                        <span>
                          <strong>Size:</strong> {cmp.productSize || cmp.productDimensions}
                        </span>
                        <span>·</span>
                        <span>
                          <strong>Variant:</strong> {cmp.variantName || 'Signature Classic'}
                        </span>
                        <span>·</span>
                        <span>
                          <strong>Price:</strong> ₹{Number(cmp.productPrice || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                        Reported Issue Description
                      </span>
                      <p className="text-xs text-[#2C2420] bg-[#FAF7F2] p-3 rounded-xl border border-[#EAE2D5] leading-relaxed">
                        {cmp.description}
                      </p>
                    </div>
                  </div>

                  {/* Customer-Uploaded Defect Photos from Cloudinary */}
                  <div className="md:col-span-5 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block">
                      Uploaded Defect Photos ({cmp.photos?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(cmp.photos || []).map((photo, pIdx) => (
                        <button
                          key={`${photo.publicId}_${pIdx}`}
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              url: photo.url,
                              publicId: photo.publicId,
                              caption: `${cmp.productName} (${cmp.requestType} · #${cmp.id})`,
                            })
                          }
                          className="group relative w-20 h-20 rounded-xl overflow-hidden border border-[#DEC89B] bg-[#FAF6F0] shadow-2xs cursor-pointer"
                          title="Click to enlarge defect photo"
                        >
                          <img
                            src={photo.url}
                            alt={`Customer uploaded defect photo ${pIdx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Admin Response Box */}
                <div
                  data-testid={`customer-complaint-response-${cmp.id}`}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    cmp.adminResponse
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-[#FAF6F0] border-[#EAE2D5] text-[#6B5D55]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#5E1924]" />
                      <span>Cotton Nest Atelier Response</span>
                    </span>
                    <span className="text-[10px] opacity-80">
                      Updated{' '}
                      {new Date(cmp.updatedAt || cmp.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  {cmp.adminResponse ? (
                    <p className="font-medium text-xs leading-relaxed text-[#2C2420]">
                      {cmp.adminResponse}
                    </p>
                  ) : (
                    <p className="text-[11px] italic">
                      Our quality team is reviewing your {cmp.requestType.toLowerCase()} request and uploaded product photos. Any status change or response from our team will appear here automatically.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EXCHANGE / COMPLAINT SUBMISSION MODAL - PORTALED DIRECTLY TO BODY FOR RELIABLE MOBILE STACKING */}
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isSubmitting && !isUploadingPhotos) setIsModalOpen(false);
              }}
            />

            <div
              data-testid="return-exchange-modal"
              className="relative bg-[#FAF6F0] w-full max-w-2xl max-h-[92vh] rounded-3xl border border-[#C5A059] shadow-2xl z-10 flex flex-col overflow-hidden text-[#2C2420]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[#5E1924] text-[#FAF6F0] border-b border-[#C5A059]/40 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#C5A059]">
                      Order #{order.id} · Atelier Resolution Desk
                    </span>
                  </div>
                  <h3 className="font-serif-luxury text-xl font-bold mt-0.5">
                    Exchange Request or Product Complaint
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full text-[#FAF6F0]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Cotton Nest 48-Hour Policy Note */}
                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Cotton Nest 48-Hour Defect Exchange Policy</span>
                  </div>
                  <p className="text-[11px] text-[#7A6458] leading-relaxed">
                    Under our Terms &amp; Conditions, pure cotton bedsheets with transit damage, stitching defects, or printing irregularities reported within 48 hours are eligible for prompt replacement exchanges. No returns or cash refunds are offered.
                  </p>
                </div>

                {submitSuccess ? (
                  <div
                    data-testid="complaint-submit-success"
                    className="bg-white rounded-2xl border border-emerald-300 p-6 text-center space-y-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#DEC89B] text-[#5E1924]">
                        Complaint ID: #{submitSuccess.id}
                      </span>
                      <h4 className="font-serif-luxury text-2xl font-bold text-[#2C2420] pt-2">
                        {submitSuccess.requestType} Request Submitted
                      </h4>
                      <p className="text-xs text-[#6B5D55] max-w-md mx-auto leading-relaxed">
                        Your request for <strong>{submitSuccess.productName}</strong> ({submitSuccess.productSize} · {submitSuccess.variantName}) along with {submitSuccess.photos.length} product photo(s) has been permanently linked to Order <strong>#{submitSuccess.orderId}</strong>.
                      </p>
                    </div>

                    {/* Preview of uploaded Cloudinary defect photos */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      {submitSuccess.photos.map((p, i) => (
                        <img
                          key={i}
                          src={p.url}
                          alt="Uploaded defect"
                          className="w-16 h-16 rounded-xl object-cover border border-[#C5A059]"
                        />
                      ))}
                    </div>

                    <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitSuccess(null);
                            setDescription('');
                            setUploadedPhotos([]);
                          }}
                          className="px-4 py-2.5 bg-[#FAF6F0] hover:bg-[#EAE2D5] text-[#2C2420] border border-[#DEC89B] rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Submit for Another Product in This Order
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="close-complaint-success-btn"
                        onClick={() => setIsModalOpen(false)}
                        className="px-6 py-2.5 bg-[#5E1924] hover:bg-[#48121B] text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        View Live Tracking Under Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitComplaint} className="space-y-5">
                    {/* 1. Choose Request Type (Exchange or Product Complaint only) */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E1924] block">
                        1. Select Request Type *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {COMPLAINT_REQUEST_TYPES.map((type) => {
                          const active = requestType === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              data-testid={`request-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                              onClick={() => setRequestType(type)}
                              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                active
                                  ? 'bg-[#5E1924] text-[#FAF6F0] border-[#C5A059] shadow-sm'
                                  : 'bg-white text-[#2C2420] border-[#DEC89B] hover:bg-[#FAF6F0]'
                              }`}
                            >
                              <div className="font-bold text-xs flex items-center justify-between">
                                <span>{type}</span>
                                {active && <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />}
                              </div>
                              <p
                                className={`text-[10px] mt-1 leading-snug ${
                                  active ? 'text-[#FAF6F0]/80' : 'text-[#7A6458]'
                                }`}
                              >
                                {type === 'Exchange'
                                  ? 'Replace with a fresh inspected bedsheet (48-hr defect policy)'
                                  : 'Report quality, stitching, fabric, or print issues with photo proof'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Select Specific Product from Order */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E1924] block">
                        2. Select Specific Product from Order #{order.id} *
                      </label>
                    <div className="space-y-2">
                      {orderItems.map((item, idx) => {
                        const isSelected = idx === selectedItemIndex;
                        const meta = extractProductSizeAndVariant(item);
                        const existingForProduct = complaints.find(
                          (c) => c.productId === item.productId
                        );
                        return (
                          <div
                            key={`${item.productId}_${idx}`}
                            data-testid={`select-order-product-${item.productId}`}
                            onClick={() => setSelectedItemIndex(idx)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-white border-[#5E1924] ring-2 ring-[#5E1924]/20 shadow-xs'
                                : 'bg-white/70 border-[#EAE2D5] hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-[#5E1924] bg-[#5E1924] text-white'
                                    : 'border-[#C5A059]'
                                }`}
                              >
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-serif-luxury font-bold text-sm text-[#2C2420]">
                                    {meta.cleanProductName}
                                  </span>
                                  {existingForProduct && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                      Request #{existingForProduct.id} ({existingForProduct.status})
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#6B5D55]">
                                  Size: <strong>{meta.size}</strong> · Variant:{' '}
                                  <strong>{meta.variantName}</strong> · Qty: {item.quantity}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#5E1924] shrink-0">
                              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Describe the Issue */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`complaint-desc-${order.id}`}
                      className="text-xs font-bold uppercase tracking-wider text-[#5E1924] block"
                    >
                      3. Describe the Issue in Detail *
                    </label>
                    <textarea
                      id={`complaint-desc-${order.id}`}
                      data-testid="complaint-description-input"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please describe the exact defect, damage, or issue with the product you received (e.g., torn border seam, color mark on pillow cover, wrong size received)..."
                      className="w-full p-3.5 rounded-2xl bg-white border border-[#DEC89B] text-xs text-[#2C2420] placeholder-[#8C7A70] focus:outline-hidden focus:border-[#5E1924]"
                      required
                    />
                  </div>

                  {/* 4. Upload Multiple Photos of Actual Defective / Damaged Product (Cloudinary) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E1924] block">
                          4. Upload Photos of Actual Defective / Damaged Product *
                        </label>
                        <p className="text-[11px] text-[#6B5D55]">
                          At least 1 photo of the actual product you received is required. You can preview, replace, or remove photos before submitting.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-[#DEC89B] text-[#5E1924]">
                        {uploadedPhotos.length} Photo{uploadedPhotos.length === 1 ? '' : 's'} Uploaded
                      </span>
                    </div>

                    {/* Hidden File Inputs for Add & Replace */}
                    <input
                      ref={addFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      data-testid="complaint-photo-file-input"
                      onChange={handleAddPhotos}
                      className="hidden"
                    />
                    <input
                      ref={replaceFileInputRef}
                      type="file"
                      accept="image/*"
                      data-testid="complaint-photo-replace-input"
                      onChange={handleReplacePhotoChange}
                      className="hidden"
                    />

                    {/* Uploaded Photo Cards with Preview, Replace & Remove */}
                    {uploadedPhotos.length > 0 && (
                      <div
                        data-testid="complaint-uploaded-photos-grid"
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                      >
                        {uploadedPhotos.map((photo, idx) => (
                          <div
                            key={`${photo.publicId}_${idx}`}
                            data-testid={`uploaded-defect-photo-${idx}`}
                            className="bg-white rounded-2xl border border-[#DEC89B] overflow-hidden shadow-2xs flex flex-col"
                          >
                            <div className="relative h-28 bg-[#FAF6F0] group">
                              <img
                                src={photo.url}
                                alt={`Defect preview ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {uploadingSlotIndex === idx && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[11px] font-semibold">
                                  Replacing...
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxPhoto({
                                    url: photo.url,
                                    publicId: photo.publicId,
                                    caption: `Defect Photo #${idx + 1}`,
                                  })
                                }
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                                title="Enlarge preview"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="p-2.5 space-y-2 text-[10px]">
                              <div className="truncate font-mono text-[#7A6458]" title={photo.publicId}>
                                ID: {photo.publicId}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`replace-photo-btn-${idx}`}
                                  onClick={() => handleTriggerReplacePhoto(idx)}
                                  disabled={uploadingSlotIndex === idx}
                                  className="flex-1 px-2 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EAE2D5] text-[#2C2420] border border-[#DEC89B] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Replace</span>
                                </button>
                                <button
                                  type="button"
                                  data-testid={`remove-photo-btn-${idx}`}
                                  onClick={() => handleRemovePhoto(idx)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Trigger Dropzone Button */}
                    <button
                      type="button"
                      data-testid="trigger-upload-defect-photo-btn"
                      onClick={() => addFileInputRef.current?.click()}
                      disabled={isUploadingPhotos}
                      className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-[#C5A059] bg-white hover:bg-[#FAF6F0] transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isUploadingPhotos ? (
                        <>
                          <RefreshCw className="w-6 h-6 text-[#5E1924] animate-spin" />
                          <span className="text-xs font-bold text-[#5E1924]">
                            Uploading actual product photo(s) to Cloudinary...
                          </span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-[#5E1924]" />
                          <span className="text-xs font-bold text-[#2C2420]">
                            {uploadedPhotos.length > 0
                              ? '+ Upload Additional Defect Photos'
                              : 'Click to Upload Photos of Defective / Damaged Product'}
                          </span>
                          <span className="text-[11px] text-[#7A6458]">
                            Direct secure Cloudinary upload · Supports multiple photos (JPG, PNG, WEBP)
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {formError && (
                    <div
                      data-testid="complaint-form-error"
                      className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Submit Footer */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#EAE2D5]">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#DEC89B] text-xs font-semibold text-[#2C2420] hover:bg-[#EAE2D5] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="submit-complaint-btn"
                      disabled={isSubmitting || isUploadingPhotos}
                      className="px-6 py-2.5 rounded-xl bg-[#5E1924] hover:bg-[#48121B] text-[#FAF6F0] text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />
                          <span>Submit {requestType} Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ENLARGED DEFECT PHOTO LIGHTBOX MODAL */}
      {lightboxPhoto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="defect-photo-lightbox"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
            onClick={() => setLightboxPhoto(null)}
          >
            <div
              className="relative max-w-3xl w-full bg-[#1C1412] rounded-3xl border border-[#C5A059] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 text-white">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {lightboxPhoto.caption || 'Customer Uploaded Defect Photo'}
                  </p>
                  <p className="text-[10px] font-mono text-[#C5A059] truncate">
                    Cloudinary Public ID: {lightboxPhoto.publicId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center bg-black max-h-[75vh]">
                <img
                  src={lightboxPhoto.url}
                  alt="Enlarged customer defect"
                  className="max-h-[70vh] w-auto object-contain rounded-xl"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
