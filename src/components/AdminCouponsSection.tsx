import React, { useState, useEffect, useMemo } from 'react';
import { BedsheetProduct } from '../data/products';
import { CouponOffer, DiscountType, DiscountScope, INITIAL_COUPONS } from '../data/coupons';
import { getCouponsApi, saveCouponApi, deleteCouponApi } from '../services/api';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Ticket,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Copy,
  Calendar,
  Tag,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  Percent,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface AdminCouponsSectionProps {
  products: BedsheetProduct[];
  onToast: (msg: string) => void;
}

const EMPTY_COUPON: Omit<CouponOffer, 'id' | 'createdAt' | 'updatedAt' | 'usedCount' | 'usedByCustomers'> = {
  code: '',
  title: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  minOrderValue: 0,
  maxDiscountAmount: undefined,
  startDate: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  isActive: true,
  isAutomatic: false,
  maxUses: undefined,
  oneUsePerCustomer: false,
  scope: 'all',
  applicableProductIds: [],
  badgeText: '',
};

export const AdminCouponsSection: React.FC<AdminCouponsSectionProps> = ({
  products,
  onToast,
}) => {
  const [coupons, setCoupons] = useState<CouponOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'automatic' | 'expired'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_COUPON);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load coupons from Firestore with fallback to REST API
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onSnapshot(
        collection(db, 'coupons'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: CouponOffer[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              if (data && data.code) {
                list.push({ id: d.id, ...data } as CouponOffer);
              }
            });
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setCoupons(list);
            setLoading(false);
          } else {
            // If empty, fetch from backend API
            getCouponsApi().then((list) => {
              setCoupons(list);
              setLoading(false);
            });
          }
        },
        (_err) => {
          // If Firestore listener fails, fetch via API
          getCouponsApi().then((list) => {
            setCoupons(list);
            setLoading(false);
          });
        }
      );
    } catch {
      getCouponsApi().then((list) => {
        setCoupons(list);
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return coupons.filter((c) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter
      if (filterType === 'active') return c.isActive && c.expiryDate >= today;
      if (filterType === 'inactive') return !c.isActive;
      if (filterType === 'automatic') return c.isAutomatic;
      if (filterType === 'expired') return c.expiryDate < today;

      return true;
    });
  }, [coupons, searchQuery, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const total = coupons.length;
    const active = coupons.filter((c) => c.isActive && c.expiryDate >= today).length;
    const automatic = coupons.filter((c) => c.isAutomatic && c.isActive).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    return { total, active, automatic, totalRedemptions };
  }, [coupons]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingCouponId(null);
    setFormData(EMPTY_COUPON);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (coupon: CouponOffer) => {
    setEditingCouponId(coupon.id);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue || 0,
      maxDiscountAmount: coupon.maxDiscountAmount,
      startDate: coupon.startDate || new Date().toISOString().split('T')[0],
      expiryDate: coupon.expiryDate,
      isActive: coupon.isActive,
      isAutomatic: coupon.isAutomatic || false,
      maxUses: coupon.maxUses,
      oneUsePerCustomer: coupon.oneUsePerCustomer ?? false,
      scope: coupon.scope || 'all',
      applicableProductIds: coupon.applicableProductIds || [],
      badgeText: coupon.badgeText || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    let cleanCode = formData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-').replace(/-+/g, '-');

    // Auto-generate code if user left it blank
    if (!cleanCode) {
      if (formData.isAutomatic) {
        cleanCode = `AUTO-${Math.floor(100 + Math.random() * 900)}`;
      } else {
        cleanCode = `OFFER${formData.discountValue || 10}-${Math.floor(100 + Math.random() * 900)}`;
      }
      setFormData((prev) => ({ ...prev, code: cleanCode }));
    }

    if (cleanCode) {
      // Check for duplicate code
      const duplicate = coupons.find(
        (c) => c.code.toUpperCase() === cleanCode && c.id !== editingCouponId
      );
      if (duplicate) {
        errors.code = `Code "${cleanCode}" already exists. Please choose a different code.`;
      }
    }

    // Auto-fill title if left blank
    if (!formData.title.trim()) {
      const autoTitle =
        formData.discountType === 'percentage'
          ? `${formData.discountValue || 10}% Off Bedsheets`
          : `Flat ₹${formData.discountValue || 200} Off Bedsheets`;
      setFormData((prev) => ({ ...prev, title: autoTitle }));
    }

    const val = Number(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      errors.discountValue = 'Please enter a discount value greater than 0';
    } else if (formData.discountType === 'percentage' && val > 95) {
      errors.discountValue = 'Percentage discount cannot exceed 95%';
    }

    if (Number(formData.minOrderValue) < 0) {
      errors.minOrderValue = 'Minimum order value cannot be negative';
    }

    if (!formData.expiryDate) {
      errors.expiryDate = 'Please select an expiry date';
    } else if (formData.startDate && formData.expiryDate && formData.startDate > formData.expiryDate) {
      errors.expiryDate = 'Expiry date must be on or after start date';
    }

    setFormErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      onToast(`⚠️ ${firstError}`);
    }
    return isValid;
  };

  // Save Coupon
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      let cleanCode = formData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-').replace(/-+/g, '-');
      if (!cleanCode) {
        cleanCode = formData.isAutomatic
          ? `AUTO-${Math.floor(100 + Math.random() * 900)}`
          : `OFFER${formData.discountValue || 10}-${Math.floor(100 + Math.random() * 900)}`;
      }
      const existing = editingCouponId ? coupons.find((c) => c.id === editingCouponId) : null;
      const safeId =
        editingCouponId ||
        `coupon-${cleanCode.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${Date.now().toString(36)}`;

      const couponToSave: CouponOffer = {
        id: safeId,
        code: cleanCode,
        title:
          formData.title.trim() ||
          (formData.discountType === 'percentage'
            ? `${formData.discountValue || 10}% Off Bedsheets`
            : `Flat ₹${formData.discountValue || 200} Off Bedsheets`),
        description: (formData.description || '').trim(),
        discountType: formData.discountType || 'percentage',
        discountValue: Number(formData.discountValue) || 10,
        minOrderValue: Math.max(0, Number(formData.minOrderValue) || 0),
        maxDiscountAmount: formData.maxDiscountAmount ? Math.max(0, Number(formData.maxDiscountAmount)) : 0,
        startDate: formData.startDate || new Date().toISOString().split('T')[0],
        expiryDate: formData.expiryDate || '2030-12-31',
        isActive: formData.isActive ?? true,
        isAutomatic: Boolean(formData.isAutomatic),
        maxUses: formData.maxUses ? Math.max(0, Number(formData.maxUses)) : 0,
        usedCount: existing ? existing.usedCount || 0 : 0,
        oneUsePerCustomer: Boolean(formData.oneUsePerCustomer),
        usedByCustomers: existing?.usedByCustomers || [],
        scope: formData.scope || 'all',
        applicableProductIds: formData.scope === 'products' ? (formData.applicableProductIds || []) : [],
        badgeText: (formData.badgeText || '').trim(),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const savedResult = await saveCouponApi(couponToSave);

      // Local optimistic update
      setCoupons((prev) => {
        const idx = prev.findIndex((c) => c.id === savedResult.id || c.code === savedResult.code);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedResult;
          return next;
        }
        return [savedResult, ...prev];
      });

      onToast(`Discount offer "${cleanCode}" saved successfully!`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Coupon save error:', err);
      onToast(`Failed to save coupon: ${err.message || 'Please check your inputs and try again'}`);
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Active State
  const handleToggleActive = async (coupon: CouponOffer) => {
    const updated: CouponOffer = {
      ...coupon,
      isActive: !coupon.isActive,
      updatedAt: Date.now(),
    };

    try {
      await saveCouponApi(updated);
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
      onToast(`Coupon ${updated.code} is now ${updated.isActive ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      onToast(`Failed to update status: ${err.message || err}`);
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (couponId: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${code}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(couponId);
    try {
      await deleteCouponApi(couponId);
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      onToast(`Coupon "${code}" deleted permanently.`);
    } catch (err: any) {
      onToast(`Error deleting coupon: ${err.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    onToast(`Coupon code "${code}" copied to clipboard!`);
  };

  // Reset to initial seed coupons if desired
  const handleSeedDefaults = async () => {
    if (!window.confirm('Restore initial Cotton Nest sample coupons (NEST10, COTTON250, PURECOTTON5)?')) {
      return;
    }
    for (const c of INITIAL_COUPONS) {
      await saveCouponApi(c);
    }
    setCoupons(INITIAL_COUPONS);
    onToast('Restored default promotional coupons!');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Overview Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#70252D]/10 text-[#70252D]">
              <Ticket className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-serif-luxury font-bold text-[#2C2420]">
              Coupons &amp; Offers Management
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#6B5D55] mt-1">
            Create discount promo codes, automated bundle offers, customer limits, and product-specific deals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {coupons.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-[#2C2420] text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Add sample coupons"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A8823B]" />
              <span>Load Sample Coupons</span>
            </button>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#70252D] hover:bg-[#5b1e24] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Total Coupons</span>
            <Ticket className="w-4 h-4 text-[#A8823B]" />
          </div>
          <div className="text-2xl font-serif-luxury font-bold text-[#2C2420]">
            {stats.total}
          </div>
          <div className="text-[11px] text-[#A8823B] mt-0.5 font-medium">
            Active in database
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Live &amp; Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif-luxury font-bold text-emerald-800">
            {stats.active}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
            Ready for checkout
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Automatic Offers</span>
            <Sparkles className="w-4 h-4 text-[#B83F60]" />
          </div>
          <div className="text-2xl font-serif-luxury font-bold text-[#B83F60]">
            {stats.automatic}
          </div>
          <div className="text-[11px] text-[#6B5D55] mt-0.5 font-medium">
            Auto-applied in cart
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5] shadow-xs">
          <div className="flex items-center justify-between text-[#6B5D55] mb-1">
            <span className="text-xs font-medium">Total Redemptions</span>
            <TrendingUp className="w-4 h-4 text-[#70252D]" />
          </div>
          <div className="text-2xl font-serif-luxury font-bold text-[#70252D]">
            {stats.totalRedemptions}
          </div>
          <div className="text-[11px] text-[#6B5D55] mt-0.5 font-medium">
            Times used by customers
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8988D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coupon code, offer title, or description..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-[#EAE2D5] text-xs font-medium text-[#2C2420] placeholder-[#A8988D] focus:outline-none focus:border-[#70252D] focus:ring-1 focus:ring-[#70252D]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'automatic', label: 'Auto-applied' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'expired', label: 'Expired' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'bg-white hover:bg-stone-50 text-[#6B5D55] border border-[#EAE2D5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons List */}
      {loading ? (
        <div className="py-12 text-center text-[#6B5D55] text-sm">
          <Clock className="w-6 h-6 mx-auto mb-2 text-[#A8823B] animate-spin" />
          <span>Loading coupons from store database...</span>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border bg-[#FAF7F2] border-[#EAE2D5]">
          <Ticket className="w-10 h-10 mx-auto text-[#A8823B] opacity-60 mb-3" />
          <h3 className="font-serif-luxury text-lg font-semibold text-[#2C2420]">
            No coupons match your filter
          </h3>
          <p className="text-xs text-[#6B5D55] mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No coupons found matching "${searchQuery}". Clear your search or create a new coupon.`
              : 'Start by creating your first promotional discount coupon or automated offer.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-[#70252D] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#5b1e24] cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => {
            const isExpired = coupon.expiryDate < todayStr;
            const isNotYetActive = coupon.startDate > todayStr;
            const isFullyUsed =
              coupon.maxUses !== undefined && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;

            let statusBadge = (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                ACTIVE
              </span>
            );

            if (!coupon.isActive) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-stone-100 text-stone-600 border border-stone-300">
                  INACTIVE
                </span>
              );
            } else if (isExpired) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  EXPIRED
                </span>
              );
            } else if (isNotYetActive) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  SCHEDULED
                </span>
              );
            } else if (isFullyUsed) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  LIMIT REACHED
                </span>
              );
            }

            return (
              <div
                key={coupon.id}
                className="p-5 rounded-2xl border bg-white border-[#EAE2D5] shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                <div>
                  {/* Top Row: Code chip + Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] font-mono font-bold text-xs rounded-lg tracking-wider flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#A8823B]" />
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(coupon.code)}
                        className="p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer rounded"
                        title="Copy coupon code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {coupon.badgeText && (
                        <span className="px-1.5 py-0.5 bg-[#B83F60]/10 text-[#B83F60] font-bold text-[9px] rounded-md tracking-wider">
                          {coupon.badgeText}
                        </span>
                      )}
                      {statusBadge}
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h4 className="font-serif-luxury font-bold text-base text-[#2C2420] leading-snug">
                    {coupon.title}
                  </h4>
                  {coupon.description && (
                    <p className="text-xs text-[#6B5D55] mt-1 line-clamp-2 leading-relaxed">
                      {coupon.description}
                    </p>
                  )}

                  {/* Key Highlights */}
                  <div className="mt-3.5 pt-3.5 border-t border-[#F4EFE6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[#2C2420]">
                      <span className="text-[#6B5D55]">Discount Value:</span>
                      <span className="font-bold text-[#70252D]">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT OFF`}
                        {coupon.discountType === 'percentage' && coupon.maxDiscountAmount && (
                          <span className="text-[10px] text-[#6B5D55] font-normal ml-1">
                            (max ₹{coupon.maxDiscountAmount})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#2C2420]">
                      <span className="text-[#6B5D55]">Min Order Value:</span>
                      <span className="font-semibold">
                        {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : 'No Minimum'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#2C2420]">
                      <span className="text-[#6B5D55]">Applies to:</span>
                      <span className="font-semibold text-right">
                        {coupon.scope === 'all' && 'All Bedsheets'}
                        {coupon.scope === 'products' &&
                          `${coupon.applicableProductIds?.length || 0} specific items`}
                        {coupon.scope === 'collections' && 'Featured collections'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#2C2420]">
                      <span className="text-[#6B5D55]">Validity:</span>
                      <span className="font-medium text-[11px] text-stone-600">
                        {coupon.startDate} to {coupon.expiryDate}
                      </span>
                    </div>

                    {/* Redemptions count & Limit */}
                    <div className="flex items-center justify-between text-[#2C2420]">
                      <span className="text-[#6B5D55]">Usage / Limit:</span>
                      <span className="font-medium text-[11px]">
                        <span className="font-bold text-[#70252D]">{coupon.usedCount || 0}</span>
                        {coupon.maxUses ? ` / ${coupon.maxUses} total` : ' (Unlimited)'}
                      </span>
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap items-center gap-1 pt-1.5">
                      {coupon.isAutomatic && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-semibold flex items-center gap-1 border border-amber-200">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          Auto-applied in cart
                        </span>
                      )}
                      {coupon.oneUsePerCustomer && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold flex items-center gap-1 border border-blue-200">
                          <Users className="w-2.5 h-2.5 text-blue-600" />
                          1 use per customer
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-[#F4EFE6] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Active Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(coupon)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        coupon.isActive
                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      title={coupon.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          coupon.isActive ? 'bg-emerald-600' : 'bg-stone-400'
                        }`}
                      />
                      <span>{coupon.isActive ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(coupon)}
                      className="p-1.5 text-stone-600 hover:text-[#70252D] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                      title="Edit coupon"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                      disabled={deletingId === coupon.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE / EDIT COUPON MODAL                               */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FAF7F2] rounded-3xl border border-[#DEC89B] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-white border-b border-[#EAE2D5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#70252D]/10 text-[#70252D]">
                  <Ticket className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-serif-luxury font-bold text-lg text-[#2C2420]">
                    {editingCouponId ? 'Edit Coupon / Offer' : 'Create New Promotional Coupon'}
                  </h3>
                  <p className="text-xs text-[#6B5D55]">
                    Configure discount rules, order thresholds, and eligibility restrictions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-[#2C2420] rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveCoupon} noValidate className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: Code and Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#2C2420]">
                      Coupon Code <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomSuffix = Math.floor(100 + Math.random() * 900);
                        const code = formData.discountType === 'percentage'
                          ? `COTTON${formData.discountValue || 15}-${randomSuffix}`
                          : `SAVE${formData.discountValue || 200}-${randomSuffix}`;
                        setFormData((prev) => ({ ...prev, code }));
                        if (formErrors.code) {
                          setFormErrors((prev) => ({ ...prev, code: '' }));
                        }
                      }}
                      className="text-[11px] font-semibold text-[#70252D] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-[#A8823B]" />
                      <span>Auto-Generate Code</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => {
                        const codeVal = e.target.value.toUpperCase().replace(/\s+/g, '-');
                        setFormData({
                          ...formData,
                          code: codeVal,
                        });
                        if (formErrors.code) {
                          setFormErrors((prev) => ({ ...prev, code: '' }));
                        }
                      }}
                      placeholder="e.g. FESTIVE20"
                      className={`w-full px-3.5 py-2.5 bg-white rounded-xl border text-xs font-mono font-bold tracking-wider text-[#2C2420] focus:outline-none focus:ring-1 ${
                        formErrors.code
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-[#DEC89B] focus:border-[#70252D] focus:ring-[#70252D]'
                      }`}
                    />
                  </div>
                  {formErrors.code && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.code}
                    </p>
                  )}
                  <p className="text-[10px] text-[#A8988D] mt-0.5">
                    Customers enter this code at checkout (letters, numbers, hyphens).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Offer Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value });
                      if (formErrors.title) {
                        setFormErrors((prev) => ({ ...prev, title: '' }));
                      }
                    }}
                    placeholder="e.g. 20% Festive Savings"
                    className={`w-full px-3.5 py-2.5 bg-white rounded-xl border text-xs font-medium text-[#2C2420] focus:outline-none focus:ring-1 ${
                      formErrors.title
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-[#DEC89B] focus:border-[#70252D] focus:ring-[#70252D]'
                    }`}
                  />
                  {formErrors.title && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.title}</p>
                  )}
                  <p className="text-[10px] text-[#A8988D] mt-0.5">
                    Display name shown to customers in bag &amp; offer banners.
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                  Description / Terms (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Valid on all pure cotton sheets on orders above ₹1,500"
                  className="w-full px-3.5 py-2 bg-white rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                />
              </div>

              {/* Row 2: Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white border border-[#EAE2D5]">
                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1.5">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FAF7F2] rounded-xl border border-[#DEC89B]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: 'percentage' })}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        formData.discountType === 'percentage'
                          ? 'bg-[#70252D] text-white shadow-2xs'
                          : 'text-[#6B5D55] hover:text-[#2C2420]'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>% Off</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: 'fixed' })}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        formData.discountType === 'fixed'
                          ? 'bg-[#70252D] text-white shadow-2xs'
                          : 'text-[#6B5D55] hover:text-[#2C2420]'
                      }`}
                    >
                      <span>₹ Flat</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1.5">
                    {formData.discountType === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discountType === 'percentage' ? 95 : 100000}
                    step="any"
                    value={formData.discountValue || ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value);
                      setFormData({ ...formData, discountValue: v });
                      if (formErrors.discountValue) {
                        setFormErrors((prev) => ({ ...prev, discountValue: '' }));
                      }
                    }}
                    placeholder={formData.discountType === 'percentage' ? '10' : '250'}
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] text-xs font-bold text-[#70252D] focus:outline-none focus:border-[#70252D]"
                  />
                  {formErrors.discountValue && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.discountValue}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1.5">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.minOrderValue || ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                      setFormData({ ...formData, minOrderValue: v });
                    }}
                    placeholder="0 = No minimum"
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                  />
                  <p className="text-[10px] text-[#A8988D] mt-0.5">e.g. 999, 1500, or 0 for any amount</p>
                </div>
              </div>

              {/* Optional Max Cap for Percentage */}
              {formData.discountType === 'percentage' && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-amber-900">
                        Maximum Discount Cap (₹) (Optional)
                      </span>
                      <p className="text-[11px] text-amber-700">
                        Cap the maximum savings a customer can get (e.g. max ₹500 discount on 20% off).
                      </p>
                    </div>
                    <div className="w-32 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={formData.maxDiscountAmount || ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
                          setFormData({
                            ...formData,
                            maxDiscountAmount: v,
                          });
                        }}
                        placeholder="e.g. 500"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-amber-300 text-xs font-semibold text-amber-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3: Validity Dates & Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Expiry Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => {
                      setFormData({ ...formData, expiryDate: e.target.value });
                      if (formErrors.expiryDate) {
                        setFormErrors((prev) => ({ ...prev, expiryDate: '' }));
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                  />
                  {formErrors.expiryDate && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.expiryDate}</p>
                  )}
                </div>
              </div>

              {/* Row 4: Usage Limits & Customer Restrictions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-[#EAE2D5]">
                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Max Total Redemptions (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.maxUses || ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Math.max(1, parseInt(e.target.value, 10));
                      setFormData({
                        ...formData,
                        maxUses: v,
                      });
                    }}
                    placeholder="Unlimited if empty"
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] text-xs font-medium text-[#2C2420] focus:outline-none focus:border-[#70252D]"
                  />
                  <p className="text-[10px] text-[#A8988D] mt-0.5">
                    Leave blank for unlimited storewide uses.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C2420] mb-1">
                    Display Badge (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.badgeText || ''}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value.toUpperCase() })}
                    placeholder="e.g. EXCLUSIVE, FESTIVE, LIMITED"
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] rounded-xl border border-[#DEC89B] text-xs font-semibold text-[#70252D] focus:outline-none focus:border-[#70252D]"
                  />
                  <p className="text-[10px] text-[#A8988D] mt-0.5">
                    Shown as a pill tag next to the code.
                  </p>
                </div>
              </div>

              {/* Row 5: Product Scope Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#2C2420] mb-1.5">
                  Applicable Products / Scope
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope: 'all' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      formData.scope === 'all'
                        ? 'bg-[#70252D] text-white'
                        : 'bg-white text-[#6B5D55] border border-[#DEC89B]'
                    }`}
                  >
                    All Bedsheets
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope: 'products' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      formData.scope === 'products'
                        ? 'bg-[#70252D] text-white'
                        : 'bg-white text-[#6B5D55] border border-[#DEC89B]'
                    }`}
                  >
                    Selected Bedsheets Only
                  </button>
                </div>

                {formData.scope === 'products' && (
                  <div className="p-3 bg-white rounded-2xl border border-[#DEC89B] max-h-48 overflow-y-auto space-y-1.5">
                    <p className="text-[11px] text-[#6B5D55] mb-2 font-medium">
                      Select bedsheets eligible for this coupon:
                    </p>
                    {products.map((p) => {
                      const selected = (formData.applicableProductIds || []).includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                            selected
                              ? 'bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] font-semibold'
                              : 'hover:bg-stone-50 text-[#2C2420]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const prevList = formData.applicableProductIds || [];
                                const nextList = e.target.checked
                                  ? [...prevList, p.id]
                                  : prevList.filter((id) => id !== p.id);
                                setFormData({ ...formData, applicableProductIds: nextList });
                              }}
                              className="w-4 h-4 rounded text-[#70252D] focus:ring-[#70252D]"
                            />
                            <span>{p.name}</span>
                          </div>
                          <span className="text-[#A8823B] font-mono">₹{p.price}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Row 6: Toggles (Automatic & One Use Per Customer & Active) */}
              <div className="space-y-3 p-4 rounded-2xl bg-white border border-[#EAE2D5]">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-[#2C2420] block">
                      Automatic Offer (No code entry needed)
                    </span>
                    <span className="text-[11px] text-[#6B5D55]">
                      When cart meets conditions, apply automatically for customers.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isAutomatic}
                    onChange={(e) => setFormData({ ...formData, isAutomatic: e.target.checked })}
                    className="w-4 h-4 rounded text-[#70252D] focus:ring-[#70252D]"
                  />
                </label>

                <div className="border-t border-[#F4EFE6]" />

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-[#2C2420] block">
                      One Use Per Customer
                    </span>
                    <span className="text-[11px] text-[#6B5D55]">
                      Restrict redemption to once per phone number or email.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.oneUsePerCustomer}
                    onChange={(e) =>
                      setFormData({ ...formData, oneUsePerCustomer: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-[#70252D] focus:ring-[#70252D]"
                  />
                </label>

                <div className="border-t border-[#F4EFE6]" />

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-[#2C2420] block">
                      Active Status
                    </span>
                    <span className="text-[11px] text-[#6B5D55]">
                      Enable or pause this promotion across the store.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-[#70252D] focus:ring-[#70252D]"
                  />
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-[#EAE2D5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#2C2420] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#70252D] hover:bg-[#5b1e24] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingCouponId ? 'Update Coupon' : 'Create Coupon'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
