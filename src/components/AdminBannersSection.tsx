import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Copy,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Clock,
  Save,
  X,
  Smartphone,
  Monitor,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  HomepageBanner,
  BANNER_CATEGORIES,
  COTTON_NEST_BANNER_PALETTES,
  TARGET_AUDIENCE_OPTIONS,
  BannerTargetAudience,
  BannerTextStyle,
  computeBannerStatus,
  formatValidityDate,
  getTargetAudienceLabel,
  splitIstDateTimeParts,
  combineIstDateTimeParts,
  validateBannerValidityPeriod,
} from '../data/banners';
import { CustomerAnnouncementBanner } from './CustomerAnnouncementBanner';

interface AdminBannersSectionProps {
  banners: HomepageBanner[];
  onSaveBanner: (banner: HomepageBanner) => Promise<void> | void;
  onToggleBannerEnabled?: (banner: HomepageBanner, nextEnabled: boolean) => Promise<void> | void;
  onDeleteBanner: (bannerId: string) => Promise<void> | void;
  onDuplicateBanner: (banner: HomepageBanner) => Promise<void> | void;
  onRefreshBanners?: () => Promise<void> | void;
}

export const AdminBannersSection: React.FC<AdminBannersSectionProps> = ({
  banners,
  onSaveBanner,
  onToggleBannerEnabled,
  onDeleteBanner,
  onDuplicateBanner,
  onRefreshBanners,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'disabled'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Separate date & time fields for explicit IST Start/End pickers
  const [startDatePart, setStartDatePart] = useState<string>('');
  const [startTimePart, setStartTimePart] = useState<string>('');
  const [endDatePart, setEndDatePart] = useState<string>('');
  const [endTimePart, setEndTimePart] = useState<string>('');

  const [previewBanner, setPreviewBanner] = useState<HomepageBanner | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState<boolean>(false);
  const [togglingBannerId, setTogglingBannerId] = useState<string | null>(null);
  const [isSavingEditor, setIsSavingEditor] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Local 15s tick updates Scheduled / Active / Expired statuses automatically without Firebase reads
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const now = new Date(nowMs);
  const totalBanners = banners.length;
  const activeCount = banners.filter((b) => computeBannerStatus(b, now) === 'active').length;
  const scheduledCount = banners.filter((b) => computeBannerStatus(b, now) === 'scheduled').length;
  const expiredCount = banners.filter((b) => computeBannerStatus(b, now) === 'expired').length;
  const disabledCount = banners.filter((b) => computeBannerStatus(b, now) === 'disabled').length;

  const filteredBanners = banners
    .filter((banner) => {
      const computedStatus = computeBannerStatus(banner, now);
      if (filterStatus !== 'all' && computedStatus !== filterStatus) return false;
      if (selectedCategory !== 'all' && banner.category !== selectedCategory) return false;
      return true;
    })
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  const openEditorForBanner = (banner: HomepageBanner, creating: boolean) => {
    const startParts = splitIstDateTimeParts(banner.startDate);
    const endParts = splitIstDateTimeParts(banner.expiryDate);
    setStartDatePart(startParts.date);
    setStartTimePart(startParts.time);
    setEndDatePart(endParts.date);
    setEndTimePart(endParts.time);
    setEditingBanner({
      ...banner,
      category: banner.category || 'Announcement',
      accentColor: banner.accentColor || '#8C2E46',
      textStyle: banner.textStyle || 'editorial_serif',
      targetAudience: banner.targetAudience || 'all',
    });
    setIsCreatingNew(creating);
    setIsEditorOpen(true);
  };

  const handleCreateNew = () => {
    const newBanner: HomepageBanner = {
      id: `banner-${Date.now()}`,
      campaignName: 'New Festive Announcement',
      category: 'Festive',
      heading: 'Festive Pure Cotton Collection',
      subtitle: 'Handcrafted 100% pure combed cotton bedsheets from our Gurgaon Atelier.',
      ctaText: 'Shop Collection',
      ctaDestination: 'catalogue',
      backgroundColor: '#FAF7F2',
      textColor: '#2C2420',
      accentColor: '#8C2E46',
      textStyle: 'editorial_serif',
      textAlignment: 'center',
      targetAudience: 'all',
      priority: banners.length + 1,
      status: 'active',
      isEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    openEditorForBanner(newBanner, true);
  };

  // Sync combined startDate / expiryDate whenever pickers change
  const syncEditorDates = (
    nextStartDate: string,
    nextStartTime: string,
    nextEndDate: string,
    nextEndTime: string
  ) => {
    setStartDatePart(nextStartDate);
    setStartTimePart(nextStartTime);
    setEndDatePart(nextEndDate);
    setEndTimePart(nextEndTime);
    if (!editingBanner) return;
    setEditingBanner({
      ...editingBanner,
      startDate: combineIstDateTimeParts(nextStartDate, nextStartTime, '00:00'),
      expiryDate: combineIstDateTimeParts(nextEndDate, nextEndTime, '23:59'),
    });
  };

  const validityCheck = editingBanner
    ? validateBannerValidityPeriod(editingBanner.startDate, editingBanner.expiryDate, {
        startDatePart,
        startTimePart,
        endDatePart,
        endTimePart,
      })
    : { valid: true };

  const editorMissingRequired = Boolean(
    editingBanner &&
      (!editingBanner.campaignName?.trim() || !editingBanner.heading?.trim())
  );

  const handleSaveEditor = async () => {
    if (!editingBanner || isSavingEditor) return;

    if (editorMissingRequired) {
      showFeedback('error', 'Banner name and heading are required.');
      return;
    }

    if (!validityCheck.valid) {
      showFeedback('error', validityCheck.error || 'Invalid validity date range.');
      return;
    }

    setIsSavingEditor(true);
    try {
      const normalizedStart = combineIstDateTimeParts(startDatePart, startTimePart, '00:00');
      const normalizedEnd = combineIstDateTimeParts(endDatePart, endTimePart, '23:59');

      const draftToCompute: HomepageBanner = {
        ...editingBanner,
        campaignName: editingBanner.campaignName.trim(),
        heading: editingBanner.heading.trim(),
        subtitle: (editingBanner.subtitle || '').trim(),
        ctaText: (editingBanner.ctaText || '').trim(),
        priority: Math.max(1, Number(editingBanner.priority) || 1),
        startDate: normalizedStart,
        expiryDate: normalizedEnd,
        status: editingBanner.isEnabled ? 'active' : 'disabled',
        updatedAt: Date.now(),
      };

      const computed = computeBannerStatus(draftToCompute, new Date());
      const bannerToSave: HomepageBanner = {
        ...draftToCompute,
        status: computed,
      };

      await onSaveBanner(bannerToSave);
      setIsEditorOpen(false);
      setEditingBanner(null);
      showFeedback('success', `Banner "${bannerToSave.campaignName}" saved cleanly.`);
    } catch (err: any) {
      showFeedback(
        'error',
        `Failed to save banner to Firebase: ${err?.message || 'Please check permissions and try again.'}`
      );
    } finally {
      setIsSavingEditor(false);
    }
  };

  const handleToggleEnable = async (banner: HomepageBanner) => {
    if (togglingBannerId === banner.id) return;
    setTogglingBannerId(banner.id);

    const nextEnabled = !banner.isEnabled;
    try {
      if (onToggleBannerEnabled) {
        await onToggleBannerEnabled(banner, nextEnabled);
      } else {
        const draftBanner: HomepageBanner = {
          ...banner,
          isEnabled: nextEnabled,
          status: nextEnabled ? 'active' : 'disabled',
          updatedAt: Date.now(),
        };
        draftBanner.status = computeBannerStatus(draftBanner, new Date());
        await onSaveBanner(draftBanner);
      }
      showFeedback(
        'success',
        `"${banner.campaignName}" is now ${nextEnabled ? 'ON (eligible by IST schedule)' : 'OFF (hidden immediately)'}.`
      );
    } catch (err: any) {
      showFeedback(
        'error',
        `Failed to update banner toggle: ${err?.message || 'Permission or network error.'}`
      );
    } finally {
      setTogglingBannerId(null);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    if (isDeletingLoading) return;
    setIsDeletingLoading(true);
    try {
      await onDeleteBanner(id);
      setIsDeletingId(null);
      if (editingBanner?.id === id) {
        setIsEditorOpen(false);
        setEditingBanner(null);
      }
      showFeedback('success', 'Banner deleted permanently.');
    } catch (err: any) {
      showFeedback('error', `Failed to delete banner: ${err?.message || 'Error occurred.'}`);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!onRefreshBanners || isSyncing) return;
    setIsSyncing(true);
    try {
      await onRefreshBanners();
      setNowMs(Date.now());
      showFeedback('success', 'Synced latest banners from Firebase.');
    } catch (err: any) {
      showFeedback('error', `Sync error: ${err?.message || 'Unable to fetch banners.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const applyQuickPresetDates = (hoursFromNowStart: number, durationHours: number) => {
    const startMs = Date.now() + hoursFromNowStart * 3600 * 1000;
    const endMs = startMs + durationHours * 3600 * 1000;
    const startIsoIst = new Date(startMs + 330 * 60 * 1000).toISOString();
    const endIsoIst = new Date(endMs + 330 * 60 * 1000).toISOString();
    syncEditorDates(
      startIsoIst.slice(0, 10),
      startIsoIst.slice(11, 16),
      endIsoIst.slice(0, 10),
      endIsoIst.slice(11, 16)
    );
  };

  return (
    <div className="space-y-6 font-sans text-[#2C2420]">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-white border border-[#EAE2D5]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C2E46]">
            Storefront Promotions · Indian Standard Time (IST)
          </p>
          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2C2420] mt-1">
            Announcement &amp; Festive Banners
          </h2>
          <p className="text-xs sm:text-sm text-[#6B5D55] mt-1">
            Control top announcement &amp; festive banners with instant ON/OFF overrides, IST scheduling, target audiences, and display priority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onRefreshBanners && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE2D5] text-xs font-semibold text-[#2C2420] cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Firebase'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#70252D] hover:bg-[#581C23] text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Banner</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Strip (Tabular Numerals, Single-Elevation Surface) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-[#EAE2D5]">
          <p className="text-xs font-medium text-[#6B5D55]">Total Banners</p>
          <p className="font-serif-luxury text-2xl font-bold text-[#2C2420] tabular-nums mt-1">{totalBanners}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[#EAE2D5]">
          <p className="text-xs font-medium text-emerald-700">Active</p>
          <p className="font-serif-luxury text-2xl font-bold text-emerald-800 tabular-nums mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[#EAE2D5]">
          <p className="text-xs font-medium text-amber-700">Scheduled</p>
          <p className="font-serif-luxury text-2xl font-bold text-amber-800 tabular-nums mt-1">{scheduledCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[#EAE2D5]">
          <p className="text-xs font-medium text-[#6B5D55]">Expired</p>
          <p className="font-serif-luxury text-2xl font-bold text-[#2C2420] tabular-nums mt-1">{expiredCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[#EAE2D5] col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-rose-700">Disabled (OFF)</p>
          <p className="font-serif-luxury text-2xl font-bold text-rose-800 tabular-nums mt-1">{disabledCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-3.5 rounded-xl bg-white border border-[#EAE2D5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FAF7F2] rounded-lg border border-[#EAE2D5]">
          {(
            [
              { id: 'all', label: `All (${totalBanners})` },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'scheduled', label: `Scheduled (${scheduledCount})` },
              { id: 'expired', label: `Expired (${expiredCount})` },
              { id: 'disabled', label: `Disabled (${disabledCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                filterStatus === tab.id
                  ? 'bg-[#70252D] text-white shadow-2xs'
                  : 'text-[#6B5D55] hover:text-[#2C2420]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="banner-cat-filter" className="font-medium text-[#6B5D55] whitespace-nowrap">
            Category:
          </label>
          <select
            id="banner-cat-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#DEC89B] bg-white text-xs font-medium text-[#2C2420] focus:outline-hidden focus:ring-2 focus:ring-[#70252D]"
          >
            <option value="all">All Categories</option>
            {BANNER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Management Table / Empty State */}
      {filteredBanners.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-[#EAE2D5] text-[#6B5D55]">
          <Sparkles className="w-9 h-9 mx-auto text-[#C29E57] mb-3 opacity-70" />
          <h3 className="font-serif-luxury text-lg font-bold text-[#2C2420]">No Matching Banners</h3>
          <p className="text-xs mt-1 max-w-md mx-auto">
            {filterStatus !== 'all' || selectedCategory !== 'all'
              ? 'No banners match the selected status or category filter.'
              : 'Create your first Announcement or Festive banner to schedule promotions cleanly in IST.'}
          </p>
          <button
            type="button"
            onClick={handleCreateNew}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#70252D] text-white text-xs font-semibold hover:bg-[#581C23] cursor-pointer"
          >
            Create Banner
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#EAE2D5] overflow-hidden">
          {/* Desktop Management Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAE2D5] bg-[#FAF7F2] text-[11px] font-semibold uppercase tracking-wider text-[#6B5D55]">
                  <th className="py-3 px-4">Banner Name / Heading</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Toggle</th>
                  <th className="py-3 px-3">Valid From (IST)</th>
                  <th className="py-3 px-3">Valid Until (IST)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D5] text-xs">
                {filteredBanners.map((banner) => {
                  const computedStatus = computeBannerStatus(banner, now);
                  const isToggling = togglingBannerId === banner.id;

                  return (
                    <tr key={banner.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      {/* Banner Name & Heading */}
                      <td className="py-3.5 px-4 max-w-[320px]">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#2C2420] truncate">
                            {banner.campaignName}
                          </div>
                          <div className="text-xs font-medium text-[#70252D] truncate">
                            {banner.heading}
                          </div>
                          {banner.subtitle && (
                            <div className="text-[11px] text-[#6B5D55] truncate">
                              {banner.subtitle}
                            </div>
                          )}
                          <div className="text-[11px] text-[#7A6458] tabular-nums pt-0.5">
                            Priority #{banner.priority} · {getTargetAudienceLabel(banner.targetAudience)}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap font-medium text-[#2C2420]">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: banner.accentColor || '#8C2E46' }}
                          />
                          <span>{banner.category}</span>
                        </span>
                      </td>

                      {/* Individual Enable/Disable ON/OFF Toggle */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={banner.isEnabled}
                          aria-label={`Toggle ${banner.campaignName}`}
                          disabled={isToggling}
                          onClick={() => handleToggleEnable(banner)}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            banner.isEnabled
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {isToggling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span
                              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                banner.isEnabled ? 'bg-emerald-600' : 'bg-stone-400'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  banner.isEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                }`}
                              />
                            </span>
                          )}
                          <span>{isToggling ? 'Saving' : banner.isEnabled ? 'ON' : 'OFF'}</span>
                        </button>
                      </td>

                      {/* Valid From */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-[#2C2420] tabular-nums">
                        {formatValidityDate(banner.startDate)}
                      </td>

                      {/* Valid Until */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-[#2C2420] tabular-nums">
                        {formatValidityDate(banner.expiryDate)}
                      </td>

                      {/* Current Computed Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold capitalize ${
                            computedStatus === 'active'
                              ? 'text-emerald-700'
                              : computedStatus === 'scheduled'
                              ? 'text-amber-700'
                              : computedStatus === 'disabled'
                              ? 'text-rose-700'
                              : 'text-stone-600'
                          }`}
                        >
                          {computedStatus === 'active'
                            ? 'Active'
                            : computedStatus === 'scheduled'
                            ? 'Scheduled'
                            : computedStatus === 'disabled'
                            ? 'Disabled'
                            : 'Expired'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditorForBanner(banner, false)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#70252D] hover:bg-[#581C23] text-white text-xs font-semibold cursor-pointer"
                            title="Edit banner"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewBanner(banner)}
                            className="p-2 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE2D5] text-[#2C2420] cursor-pointer"
                            title="Preview banner"
                            aria-label={`Preview ${banner.campaignName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateBanner(banner)}
                            className="p-2 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE2D5] text-[#6B5D55] cursor-pointer"
                            title="Duplicate banner"
                            aria-label={`Duplicate ${banner.campaignName}`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsDeletingId(banner.id)}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 cursor-pointer"
                            title="Delete banner"
                            aria-label={`Delete ${banner.campaignName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Compact Card Rows */}
          <div className="lg:hidden divide-y divide-[#EAE2D5]">
            {filteredBanners.map((banner) => {
              const computedStatus = computeBannerStatus(banner, now);
              const isToggling = togglingBannerId === banner.id;

              return (
                <div key={banner.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#2C2420] truncate">{banner.campaignName}</p>
                      <p className="text-xs font-medium text-[#70252D] mt-0.5">{banner.heading}</p>
                      {banner.subtitle && (
                        <p className="text-xs text-[#6B5D55] mt-0.5 line-clamp-2">{banner.subtitle}</p>
                      )}
                      <p className="text-[11px] text-[#7A6458] mt-1 tabular-nums">
                        {banner.category} · Priority #{banner.priority} · {getTargetAudienceLabel(banner.targetAudience)}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={banner.isEnabled}
                      disabled={isToggling}
                      onClick={() => handleToggleEnable(banner)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0 cursor-pointer ${
                        banner.isEnabled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      <span>{isToggling ? '...' : banner.isEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#6B5D55] space-y-1 tabular-nums">
                    <div>
                      <span className="font-semibold text-[#2C2420]">Valid From:</span>{' '}
                      {formatValidityDate(banner.startDate)}
                    </div>
                    <div>
                      <span className="font-semibold text-[#2C2420]">Valid Until:</span>{' '}
                      {formatValidityDate(banner.expiryDate)}
                    </div>
                    <div>
                      <span className="font-semibold text-[#2C2420]">Status:</span>{' '}
                      <span
                        className={`font-semibold capitalize ${
                          computedStatus === 'active'
                            ? 'text-emerald-700'
                            : computedStatus === 'scheduled'
                            ? 'text-amber-700'
                            : computedStatus === 'disabled'
                            ? 'text-rose-700'
                            : 'text-stone-600'
                        }`}
                      >
                        {computedStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewBanner(banner)}
                      className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#EAE2D5] text-xs font-medium text-[#2C2420] cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditorForBanner(banner, false)}
                      className="px-3 py-1.5 rounded-lg bg-[#70252D] text-white text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDeletingId(banner.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeletingId && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-[#EAE2D5]">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif-luxury text-lg font-bold">Delete Banner Permanently?</h3>
            </div>
            <p className="text-xs text-[#6B5D55] leading-relaxed">
              This will permanently remove the banner from Firebase. If you only want to hide it temporarily while preserving its schedule and settings, cancel and switch its toggle to <strong>OFF</strong> instead.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeletingId(null)}
                disabled={isDeletingLoading}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(isDeletingId)}
                disabled={isDeletingLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                {isDeletingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Banner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewBanner && (
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FAF7F2] rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-[#EAE2D5] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D5] pb-3.5">
              <div>
                <p className="text-[11px] font-semibold text-[#8C2E46] uppercase tracking-wider">
                  Customer View Preview
                </p>
                <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                  {previewBanner.campaignName}
                </h3>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EAE2D5] text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer ${
                      previewViewport === 'desktop'
                        ? 'bg-[#70252D] text-white font-semibold'
                        : 'text-[#6B5D55] hover:text-[#2C2420]'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer ${
                      previewViewport === 'mobile'
                        ? 'bg-[#70252D] text-white font-semibold'
                        : 'text-[#6B5D55] hover:text-[#2C2420]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewBanner(null)}
                  className="p-2 rounded-full bg-white hover:bg-stone-100 text-[#2C2420] border border-[#EAE2D5] cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Storefront Header Preview */}
            <div className="py-6 px-4 bg-stone-200/60 rounded-xl flex justify-center">
              <div
                className={`w-full bg-white rounded-xl overflow-hidden shadow-md border border-[#EAE2D5] transition-all ${
                  previewViewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
                }`}
              >
                <CustomerAnnouncementBanner
                  banners={[]}
                  previewBanner={previewBanner}
                  onNavigate={() => {}}
                />
                <div className="px-4 py-3 flex items-center justify-between border-b border-[#EAE2D5] bg-white/95 text-xs text-[#6B5D55]">
                  <span className="font-serif-luxury text-base font-bold text-[#2C2420]">Cotton Nest</span>
                  <span className="hidden sm:inline">Home · Bedsheets · Seasonal · Store</span>
                  <span className="font-medium text-[#70252D]">Bag (0)</span>
                </div>
                <div className="p-5 text-center text-xs text-[#7A6458] bg-[#FAF7F2]/50">
                  Existing homepage layout remains unchanged below the Announcement &amp; Festive Banner bar.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B5D55] pt-2 border-t border-[#EAE2D5]">
              <span>
                Target: <strong>{getTargetAudienceLabel(previewBanner.targetAudience)}</strong> · Priority #{previewBanner.priority} · Status:{' '}
                <strong className="capitalize">{computeBannerStatus(previewBanner, now)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="px-5 py-2 rounded-xl bg-[#70252D] text-white font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Banner Modal */}
      {isEditorOpen && editingBanner && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl border border-[#EAE2D5] space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[#EAE2D5] pb-4">
              <div>
                <p className="text-[11px] font-semibold text-[#8C2E46] uppercase tracking-wider">
                  {isCreatingNew ? 'New Storefront Banner' : 'Edit Banner Settings'}
                </p>
                <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
                  {editingBanner.campaignName || 'Announcement & Festive Banner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditorOpen(false);
                  setEditingBanner(null);
                }}
                className="p-2 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#2C2420] cursor-pointer"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Inline Top-Bar Preview */}
            <div className="rounded-xl border border-[#EAE2D5] overflow-hidden">
              <div className="px-3 py-1.5 bg-[#FAF7F2] border-b border-[#EAE2D5] text-[11px] font-medium text-[#6B5D55]">
                Live Customer Bar Preview
              </div>
              <CustomerAnnouncementBanner banners={[]} previewBanner={editingBanner} onNavigate={() => {}} />
            </div>

            {/* Master Enable / Disable Control */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#2C2420]">
                  Admin Enable / Disable Switch
                </p>
                <p className="text-[11px] text-[#6B5D55]">
                  Switching OFF hides the banner immediately on website &amp; mobile, even during active validity dates.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editingBanner.isEnabled}
                onClick={() =>
                  setEditingBanner({
                    ...editingBanner,
                    isEnabled: !editingBanner.isEnabled,
                    status: !editingBanner.isEnabled ? 'active' : 'disabled',
                  })
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0 border ${
                  editingBanner.isEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                    : 'bg-stone-200 hover:bg-stone-300 text-stone-800 border-stone-300'
                }`}
              >
                <span>{editingBanner.isEnabled ? 'Banner ON (Enabled)' : 'Banner OFF (Disabled)'}</span>
              </button>
            </div>

            {/* Core Banner Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Banner Name (Internal)*</label>
                <input
                  type="text"
                  value={editingBanner.campaignName}
                  onChange={(e) => setEditingBanner({ ...editingBanner, campaignName: e.target.value })}
                  placeholder="e.g. Diwali Festive Top Bar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Banner Category*</label>
                <select
                  value={editingBanner.category}
                  onChange={(e) => setEditingBanner({ ...editingBanner, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] bg-white focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                >
                  {BANNER_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {!BANNER_CATEGORIES.includes(editingBanner.category as any) && editingBanner.category && (
                    <option value={editingBanner.category}>{editingBanner.category}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="font-semibold text-[#2C2420]">Banner Heading*</label>
                <input
                  type="text"
                  value={editingBanner.heading}
                  onChange={(e) => setEditingBanner({ ...editingBanner, heading: e.target.value })}
                  placeholder="e.g. HAPPY DIWALI — Festive Pure Cotton Sale"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] font-semibold focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="font-semibold text-[#2C2420]">Supporting Message</label>
                <textarea
                  rows={2}
                  value={editingBanner.subtitle || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  placeholder="e.g. Enjoy free express delivery across Gurgaon on all King cotton bedsheets."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                />
              </div>

              {/* Target Audience & Display Priority */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Target Audience</label>
                <select
                  value={editingBanner.targetAudience || 'all'}
                  onChange={(e) =>
                    setEditingBanner({
                      ...editingBanner,
                      targetAudience: e.target.value as BannerTargetAudience,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] bg-white focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                >
                  {TARGET_AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#6B5D55]">
                  {
                    TARGET_AUDIENCE_OPTIONS.find(
                      (o) => o.value === (editingBanner.targetAudience || 'all')
                    )?.hint
                  }
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Display Priority (1 = Highest)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editingBanner.priority}
                  onChange={(e) =>
                    setEditingBanner({
                      ...editingBanner,
                      priority: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] tabular-nums focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                />
                <p className="text-[11px] text-[#6B5D55]">
                  When multiple banners qualify, only the single lowest priority number (#1 before #2) displays.
                </p>
              </div>

              {/* Optional CTA Link */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Action Link Text (Optional)</label>
                <input
                  type="text"
                  value={editingBanner.ctaText || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaText: e.target.value })}
                  placeholder="e.g. Shop Collection (leave blank for text-only)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Action Destination</label>
                <select
                  value={editingBanner.ctaDestination || 'catalogue'}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, ctaDestination: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] bg-white focus:ring-2 focus:ring-[#70252D] focus:outline-hidden"
                >
                  <option value="catalogue">Bedsheets Catalogue</option>
                  <option value="seasonal">Seasonal Offers Page</option>
                  <option value="story">Our Story</option>
                  <option value="store">Gurgaon Studio</option>
                  <option value="reviews">Customer Reviews</option>
                  <option value="cart">Open Shopping Cart</option>
                </select>
              </div>
            </div>

            {/* Cotton Nest Branding Colour & Text Styling */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#2C2420]">
                  Cotton Nest Colour &amp; Text Styling
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COTTON_NEST_BANNER_PALETTES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setEditingBanner({
                          ...editingBanner,
                          backgroundColor: preset.backgroundColor,
                          textColor: preset.textColor,
                          accentColor: preset.accentColor,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg border border-[#DEC89B] text-[11px] font-medium cursor-pointer flex items-center gap-1.5 hover:opacity-90"
                      style={{
                        backgroundColor: preset.backgroundColor,
                        color: preset.textColor,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/15"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-[#2C2420]">Background</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={editingBanner.backgroundColor || '#FAF7F2'}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, backgroundColor: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg cursor-pointer border border-[#DEC89B]"
                    />
                    <input
                      type="text"
                      value={editingBanner.backgroundColor}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, backgroundColor: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#2C2420]">Text Colour</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={
                        editingBanner.textColor === 'light'
                          ? '#FFFFFF'
                          : editingBanner.textColor || '#2C2420'
                      }
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, textColor: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg cursor-pointer border border-[#DEC89B]"
                    />
                    <input
                      type="text"
                      value={editingBanner.textColor === 'light' ? '#FFFFFF' : editingBanner.textColor}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, textColor: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#2C2420]">Accent Colour</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={editingBanner.accentColor || '#8C2E46'}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, accentColor: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg cursor-pointer border border-[#DEC89B]"
                    />
                    <input
                      type="text"
                      value={editingBanner.accentColor || '#8C2E46'}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, accentColor: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#2C2420]">Text Styling</label>
                  <select
                    value={editingBanner.textStyle || 'editorial_serif'}
                    onChange={(e) =>
                      setEditingBanner({
                        ...editingBanner,
                        textStyle: e.target.value as BannerTextStyle,
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white"
                  >
                    <option value="editorial_serif">Editorial Serif</option>
                    <option value="modern_sans">Modern Sans</option>
                    <option value="bold_display">Bold Festive Uppercase</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#2C2420]">Alignment</label>
                  <select
                    value={editingBanner.textAlignment}
                    onChange={(e) =>
                      setEditingBanner({
                        ...editingBanner,
                        textAlignment: e.target.value as 'left' | 'center' | 'right',
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Banner Validity — Separate Date & Time Pickers (IST) */}
            <div className="p-4 rounded-xl bg-white border border-[#DEC89B] space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#2C2420] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#8C2E46]" />
                    <span>Validity Schedule (Indian Standard Time · IST)</span>
                  </span>
                  <p className="text-[11px] text-[#6B5D55] mt-0.5">
                    Leave blank for immediate continuous display while ON, or set Start/End date &amp; time in IST.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickPresetDates(0, 24)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE2D5] text-[11px] font-medium cursor-pointer"
                  >
                    Start Now (24h)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPresetDates(0, 24 * 7)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE2D5] text-[11px] font-medium cursor-pointer"
                  >
                    Start Now (7 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEditorDates('', '', '', '')}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium cursor-pointer"
                  >
                    Clear Dates
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Valid From */}
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-2.5">
                  <p className="font-semibold text-[#2C2420] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#A8823B]" />
                    <span>Valid From (IST)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label htmlFor="banner-start-date" className="text-[11px] font-medium text-[#6B5D55]">
                        Start Date
                      </label>
                      <input
                        id="banner-start-date"
                        type="date"
                        value={startDatePart}
                        onChange={(e) =>
                          syncEditorDates(e.target.value, startTimePart || '00:00', endDatePart, endTimePart)
                        }
                        className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="banner-start-time" className="text-[11px] font-medium text-[#6B5D55]">
                        Start Time
                      </label>
                      <input
                        id="banner-start-time"
                        type="time"
                        value={startTimePart}
                        onChange={(e) =>
                          syncEditorDates(startDatePart, e.target.value, endDatePart, endTimePart)
                        }
                        className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white tabular-nums"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#6B5D55] tabular-nums">
                    Configured: <strong>{formatValidityDate(editingBanner.startDate)}</strong>
                  </p>
                </div>

                {/* Valid Until */}
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-2.5">
                  <p className="font-semibold text-[#2C2420] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-700" />
                    <span>Valid Until (IST)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label htmlFor="banner-end-date" className="text-[11px] font-medium text-[#6B5D55]">
                        End Date
                      </label>
                      <input
                        id="banner-end-date"
                        type="date"
                        value={endDatePart}
                        onChange={(e) =>
                          syncEditorDates(startDatePart, startTimePart, e.target.value, endTimePart || '23:59')
                        }
                        className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="banner-end-time" className="text-[11px] font-medium text-[#6B5D55]">
                        End Time
                      </label>
                      <input
                        id="banner-end-time"
                        type="time"
                        value={endTimePart}
                        onChange={(e) =>
                          syncEditorDates(startDatePart, startTimePart, endDatePart, e.target.value)
                        }
                        className="w-full px-2.5 py-2 rounded-lg border border-[#DEC89B] bg-white tabular-nums"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#6B5D55] tabular-nums">
                    Configured: <strong>{formatValidityDate(editingBanner.expiryDate)}</strong>
                  </p>
                </div>
              </div>

              {!validityCheck.valid && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validityCheck.error}</span>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EAE2D5]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewBanner(editingBanner)}
                  className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </button>

                {!isCreatingNew && (
                  <button
                    type="button"
                    onClick={() => setIsDeletingId(editingBanner.id)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    setEditingBanner(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEditor || !validityCheck.valid || editorMissingRequired}
                  onClick={handleSaveEditor}
                  className="px-6 py-2.5 rounded-xl bg-[#70252D] hover:bg-[#581C23] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingEditor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBannersSection;
