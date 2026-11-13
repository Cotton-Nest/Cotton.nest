import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  Monitor,
  Smartphone,
  Sparkles,
  Save,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Power,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import {
  BannerSlot,
  BannerSlotId,
  BannerSlotCategory,
  FestivalType,
  BannerCtaTarget,
  DEFAULT_BANNER_SLOTS,
  BANNER_CATEGORY_LABELS,
  BANNER_BACKGROUND_TEMPLATES,
  FESTIVAL_OPTIONS,
  normalizeBannerSlots,
  getBannerTemplateById,
  getFestivalOptionById,
  computeSlotStatus,
  getActiveStorefrontBanner,
  applyFestivalSelectionToSlot,
  applyTemplateSelectionToSlot,
  toIstDateTimeParts,
  fromIstDateTimeParts,
  formatIstDisplay,
  validateValidityWindow,
} from '../data/bannerSlots';
import { PrebuiltBannerDisplay } from './PrebuiltBannerDisplay';

interface AdminBannerSlotsSectionProps {
  bannerSlots?: BannerSlot[];
  onSaveBannerSlots: (updatedSlots: BannerSlot[]) => Promise<void>;
  onToast: (message: string) => void;
}

export const AdminBannerSlotsSection: React.FC<AdminBannerSlotsSectionProps> = ({
  bannerSlots,
  onSaveBannerSlots,
  onToast,
}) => {
  const normalizedSavedSlots = useMemo(() => normalizeBannerSlots(bannerSlots), [bannerSlots]);

  const [selectedSlotId, setSelectedSlotId] = useState<BannerSlotId>('welcome');
  const [draftSlot, setDraftSlot] = useState<BannerSlot>(() => normalizedSavedSlots[0]);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [templateFilter, setTemplateFilter] = useState<'recommended' | 'all'>('recommended');
  const [isSaving, setIsSaving] = useState(false);
  const [togglingSlotId, setTogglingSlotId] = useState<BannerSlotId | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync draft when switching slots or when authoritative Firebase slots update
  useEffect(() => {
    const match = normalizedSavedSlots.find((s) => s.id === selectedSlotId) || normalizedSavedSlots[0];
    setDraftSlot(match);
    setValidationError(null);
  }, [selectedSlotId, normalizedSavedSlots]);

  const activeBannerOnStorefront = useMemo(
    () => getActiveStorefrontBanner(normalizedSavedSlots, new Date()),
    [normalizedSavedSlots]
  );

  const fromParts = useMemo(() => toIstDateTimeParts(draftSlot.validFrom), [draftSlot.validFrom]);
  const untilParts = useMemo(() => toIstDateTimeParts(draftSlot.validUntil), [draftSlot.validUntil]);

  const selectedTemplate = useMemo(
    () => getBannerTemplateById(draftSlot.templateId),
    [draftSlot.templateId]
  );

  const filteredTemplates = useMemo(() => {
    if (templateFilter === 'all') return BANNER_BACKGROUND_TEMPLATES;
    if (draftSlot.category === 'festive') {
      return BANNER_BACKGROUND_TEMPLATES.filter(
        (t) => t.category === 'festive' || t.id === draftSlot.templateId
      );
    }
    return BANNER_BACKGROUND_TEMPLATES.filter(
      (t) => t.category === draftSlot.category || t.id === draftSlot.templateId
    );
  }, [templateFilter, draftSlot.category, draftSlot.templateId]);

  const handleToggleSlotInstant = async (slotId: BannerSlotId) => {
    if (togglingSlotId) return;
    setTogglingSlotId(slotId);
    try {
      const nextSlots = normalizedSavedSlots.map((slot) => {
        if (slot.id !== slotId) return slot;
        // If user is currently editing this slot, carry over draft toggle cleanly
        const nextEnabled = !slot.enabled;
        return {
          ...slot,
          enabled: nextEnabled,
          updatedAt: Date.now(),
        };
      });
      await onSaveBannerSlots(nextSlots);
      const toggled = nextSlots.find((s) => s.id === slotId);
      if (toggled) {
        if (selectedSlotId === slotId) {
          setDraftSlot((prev) => ({ ...prev, enabled: toggled.enabled }));
        }
        onToast(`${toggled.slotLabel} turned ${toggled.enabled ? 'ON' : 'OFF'}.`);
      }
    } catch {
      onToast('Could not update banner status. Please verify owner sign-in.');
    } finally {
      setTogglingSlotId(null);
    }
  };

  const handleValidityChange = (
    boundary: 'from' | 'until',
    field: 'date' | 'time',
    value: string
  ) => {
    const current = boundary === 'from' ? fromParts : untilParts;
    const nextDate = field === 'date' ? value : current.date;
    const nextTime = field === 'time' ? value : current.time || (boundary === 'from' ? '00:00' : '23:59');

    const nextIso = nextDate ? fromIstDateTimeParts(nextDate, nextTime) : null;
    const updatedDraft: BannerSlot =
      boundary === 'from'
        ? { ...draftSlot, validFrom: nextIso }
        : { ...draftSlot, validUntil: nextIso };

    setDraftSlot(updatedDraft);
    const check = validateValidityWindow(updatedDraft.validFrom, updatedDraft.validUntil);
    setValidationError(check.valid ? null : check.error || null);
  };

  const handleSaveDraft = async () => {
    if (!draftSlot.heading.trim()) {
      setValidationError('Please enter a banner heading.');
      return;
    }

    const check = validateValidityWindow(draftSlot.validFrom, draftSlot.validUntil);
    if (!check.valid) {
      setValidationError(check.error || 'Invalid validity date/time range.');
      return;
    }

    setValidationError(null);
    setIsSaving(true);
    try {
      const nextSlots = normalizedSavedSlots.map((slot) =>
        slot.id === draftSlot.id
          ? {
              ...draftSlot,
              heading: draftSlot.heading.trim(),
              supportingMessage: draftSlot.supportingMessage.trim(),
              ctaText: draftSlot.ctaText.trim(),
              updatedAt: Date.now(),
            }
          : slot
      );
      await onSaveBannerSlots(nextSlots);
      onToast(`Saved changes to ${draftSlot.slotLabel}.`);
    } catch {
      onToast('Failed to save banner changes to Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSlotToDefault = () => {
    const fallback =
      DEFAULT_BANNER_SLOTS.find((s) => s.id === selectedSlotId) || DEFAULT_BANNER_SLOTS[0];
    setDraftSlot({ ...fallback, enabled: draftSlot.enabled });
    setValidationError(null);
    onToast(`Restored default copy and background for ${fallback.slotLabel}. Click Save Changes to apply.`);
  };

  const statusMeta = (status: ReturnType<typeof computeSlotStatus>) => {
    switch (status) {
      case 'active':
        return { label: 'Active', className: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
      case 'scheduled':
        return { label: 'Scheduled', className: 'text-amber-800 bg-amber-50 border-amber-200' };
      case 'expired':
        return { label: 'Expired', className: 'text-rose-800 bg-rose-50 border-rose-200' };
      default:
        return { label: 'Disabled', className: 'text-stone-600 bg-stone-100 border-stone-200' };
    }
  };

  const draftStatus = computeSlotStatus(draftSlot, new Date());
  const draftStatusBadge = statusMeta(draftStatus);

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
              Pre-Built Storefront Banners
            </h2>
            <p className="text-xs sm:text-sm text-[#6B5D55] mt-1">
              Manage the 5 predefined banner slots with curated Cotton Nest &amp; Indian festive background photography, IST scheduling, and instant ON/OFF control.
            </p>
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] text-xs shrink-0">
            <Eye className="w-4 h-4 text-[#8C2E46] shrink-0" />
            <div>
              <span className="text-[#7A6458] block text-[11px]">Currently Live on Storefront</span>
              <span className="font-semibold text-[#2C2420]">
                {activeBannerOnStorefront
                  ? `${activeBannerOnStorefront.slotLabel} (Priority #${activeBannerOnStorefront.priority})`
                  : 'None active (all 5 slots disabled or outside schedule)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: 5 Fixed Slots Sidebar + Selected Slot Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 5 Predefined Slots List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-[#EAE2D5] p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#F2ECE1]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B5D55]">
                5 Predefined Banner Slots
              </h3>
              <span className="text-[11px] text-[#8C7A70] tabular-nums">
                {normalizedSavedSlots.filter((s) => computeSlotStatus(s) === 'active').length}/5 Active
              </span>
            </div>

            {normalizedSavedSlots.map((slot) => {
              const status = computeSlotStatus(slot, new Date());
              const meta = statusMeta(status);
              const tpl = getBannerTemplateById(slot.templateId);
              const isSelected = slot.id === selectedSlotId;
              const isLiveTop = activeBannerOnStorefront?.id === slot.id;

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSlotId(slot.id);
                    }
                  }}
                  className={`rounded-xl border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#8C2E46] bg-[#FFF9FB] shadow-xs'
                      : 'border-[#EAE2D5] bg-white hover:border-[#DEC89B] hover:bg-[#FAF7F2]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-10 rounded-lg overflow-hidden border border-[#EAE2D5] shrink-0 bg-[#FAF7F2] relative">
                      <img
                        src={tpl.imageUrl}
                        alt={tpl.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#2C2420] truncate">
                          {slot.slotLabel}
                        </p>
                        {/* Instant ON/OFF Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSlotInstant(slot.id);
                          }}
                          disabled={togglingSlotId === slot.id}
                          aria-label={`${slot.enabled ? 'Disable' : 'Enable'} ${slot.slotLabel}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 cursor-pointer border ${
                            slot.enabled
                              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                              : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{slot.enabled ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-[#7A6458]">
                        <span className={`font-semibold px-1.5 py-0.2 rounded border text-[10px] ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span className="tabular-nums">Priority #{slot.priority}</span>
                        {slot.category === 'festive' && slot.festivalId && (
                          <span>· {getFestivalOptionById(slot.festivalId).label}</span>
                        )}
                        {isLiveTop && (
                          <span className="text-[#8C2E46] font-bold">· Live Now</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Slot Full Editor + Live Preview */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-2xl border border-[#EAE2D5] p-5 sm:p-6 shadow-2xs space-y-6">
            {/* Editor Header + Master Enable Switch */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#F2ECE1]">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                    {draftSlot.slotLabel}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${draftStatusBadge.className}`}>
                    {draftStatusBadge.label}
                  </span>
                </div>
                <p className="text-xs text-[#7A6458] mt-0.5">
                  Template: <strong className="text-[#2C2420]">{selectedTemplate.name}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDraftSlot({ ...draftSlot, enabled: !draftSlot.enabled })}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                    draftSlot.enabled
                      ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{draftSlot.enabled ? 'Banner Enabled (ON)' : 'Banner Disabled (OFF)'}</span>
                </button>
              </div>
            </div>

            {/* Live Preview with Actual Background Image & Text */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B5D55] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#8C2E46]" />
                  Live Banner Preview
                </span>

                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FAF7F2] border border-[#EAE2D5]">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      previewViewport === 'desktop'
                        ? 'bg-white text-[#2C2420] shadow-2xs'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      previewViewport === 'mobile'
                        ? 'bg-white text-[#2C2420] shadow-2xs'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5]">
                <PrebuiltBannerDisplay
                  slot={draftSlot}
                  previewMode={previewViewport}
                  isPreview
                />
              </div>
            </div>

            {/* Category & Festival Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#F2ECE1]">
              <div>
                <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                  Banner Category
                </label>
                <select
                  value={draftSlot.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as BannerSlotCategory;
                    if (nextCategory === 'festive') {
                      const nextFest = draftSlot.festivalId || 'diwali';
                      setDraftSlot(applyFestivalSelectionToSlot(draftSlot, nextFest));
                    } else {
                      const matching = BANNER_BACKGROUND_TEMPLATES.find((t) => t.category === nextCategory);
                      setDraftSlot({
                        ...draftSlot,
                        category: nextCategory,
                        templateId: matching ? matching.id : draftSlot.templateId,
                      });
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                >
                  {(Object.keys(BANNER_CATEGORY_LABELS) as BannerSlotCategory[]).map((catKey) => (
                    <option key={catKey} value={catKey}>
                      {BANNER_CATEGORY_LABELS[catKey]}
                    </option>
                  ))}
                </select>
              </div>

              {draftSlot.category === 'festive' ? (
                <div>
                  <label className="text-xs font-semibold text-[#2C2420] flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
                    Select Festival (Auto-Pairs Background)
                  </label>
                  <select
                    value={draftSlot.festivalId || 'diwali'}
                    onChange={(e) =>
                      setDraftSlot(
                        applyFestivalSelectionToSlot(draftSlot, e.target.value as FestivalType)
                      )
                    }
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                  >
                    {FESTIVAL_OPTIONS.map((fest) => (
                      <option key={fest.id} value={fest.id}>
                        {fest.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#7A6458] mt-1">
                    Automatically pairs the matching festive image while keeping your text and ON/OFF approval untouched.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                    Display Priority (1 = Highest)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={draftSlot.priority}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(5, Number(e.target.value) || 1));
                      setDraftSlot({ ...draftSlot, priority: val });
                    }}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] tabular-nums focus:outline-hidden focus:border-[#8C2E46]"
                  />
                </div>
              )}
            </div>

            {draftSlot.category === 'festive' && (
              <div className="max-w-xs">
                <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                  Display Priority (1 = Highest)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={draftSlot.priority}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(5, Number(e.target.value) || 1));
                    setDraftSlot({ ...draftSlot, priority: val });
                  }}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] tabular-nums focus:outline-hidden focus:border-[#8C2E46]"
                />
              </div>
            )}

            {/* Text Content & Optional Action CTA */}
            <div className="space-y-4 pt-2 border-t border-[#F2ECE1]">
              <div>
                <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                  Banner Heading
                </label>
                <input
                  type="text"
                  value={draftSlot.heading}
                  onChange={(e) => setDraftSlot({ ...draftSlot, heading: e.target.value })}
                  placeholder="Enter banner heading..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-sm font-medium text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                  Supporting Message
                </label>
                <textarea
                  rows={2}
                  value={draftSlot.supportingMessage}
                  onChange={(e) => setDraftSlot({ ...draftSlot, supportingMessage: e.target.value })}
                  placeholder="Enter concise supporting copy..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs sm:text-sm text-[#2C2420] leading-relaxed focus:outline-hidden focus:border-[#8C2E46]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                    Button Destination
                  </label>
                  <select
                    value={draftSlot.ctaTarget}
                    onChange={(e) =>
                      setDraftSlot({ ...draftSlot, ctaTarget: e.target.value as BannerCtaTarget })
                    }
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                  >
                    <option value="catalogue">Bedsheets Catalogue</option>
                    <option value="seasonal">Seasonal Offers Page</option>
                    <option value="store">Gurgaon Studio Page</option>
                    <option value="none">No Action Button (Text-Only Banner)</option>
                  </select>
                </div>

                {draftSlot.ctaTarget !== 'none' && (
                  <div>
                    <label className="text-xs font-semibold text-[#2C2420] block mb-1.5">
                      Button Label
                    </label>
                    <input
                      type="text"
                      value={draftSlot.ctaText}
                      onChange={(e) => setDraftSlot({ ...draftSlot, ctaText: e.target.value })}
                      placeholder="e.g. Explore Catalogue"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EAE2D5] rounded-xl text-xs font-medium text-[#2C2420] focus:outline-hidden focus:border-[#8C2E46]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Pre-designed Background Templates Picker */}
            <div className="space-y-3 pt-2 border-t border-[#F2ECE1]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B5D55] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#8C2E46]" />
                    Background Image Templates
                  </span>
                  <p className="text-[11px] text-[#7A6458] mt-0.5">
                    Choose any pre-designed background without modifying your heading or supporting text.
                  </p>
                </div>

                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FAF7F2] border border-[#EAE2D5]">
                  <button
                    type="button"
                    onClick={() => setTemplateFilter('recommended')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      templateFilter === 'recommended'
                        ? 'bg-white text-[#2C2420] shadow-2xs'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    Matching Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      templateFilter === 'all'
                        ? 'bg-white text-[#2C2420] shadow-2xs'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    All Templates ({BANNER_BACKGROUND_TEMPLATES.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredTemplates.map((tpl) => {
                  const isActiveTpl = draftSlot.templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setDraftSlot(applyTemplateSelectionToSlot(draftSlot, tpl.id))}
                      className={`group text-left rounded-xl border overflow-hidden transition-all cursor-pointer ${
                        isActiveTpl
                          ? 'border-[#8C2E46] ring-2 ring-[#8C2E46]/25 shadow-sm bg-[#FFF9FB]'
                          : 'border-[#EAE2D5] hover:border-[#DEC89B] bg-white'
                      }`}
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#FAF7F2]">
                        <img
                          src={tpl.imageUrl}
                          alt={tpl.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          style={{ objectPosition: tpl.objectPosition || 'center center' }}
                        />
                        {isActiveTpl && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8C2E46] text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-[#2C2420] truncate">{tpl.name}</p>
                        <p className="text-[11px] text-[#7A6458] line-clamp-1 mt-0.5">
                          {tpl.tone === 'dark' ? 'Dark contrast · Ivory text' : 'Light canvas · Espresso text'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* IST Validity Scheduling (Exact Hour & Minute Precision) */}
            <div className="space-y-4 pt-2 border-t border-[#F2ECE1]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B5D55] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C29E57]" />
                    Validity Schedule (Indian Standard Time · IST)
                  </span>
                  <p className="text-[11px] text-[#7A6458] mt-0.5">
                    Leave empty for open-ended display while enabled, or set exact IST start and end minutes.
                  </p>
                </div>
                {(draftSlot.validFrom || draftSlot.validUntil) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSlot({ ...draftSlot, validFrom: null, validUntil: null });
                      setValidationError(null);
                    }}
                    className="text-xs font-semibold text-[#8C2E46] hover:underline cursor-pointer"
                  >
                    Clear Schedule
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Valid From */}
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8C2E46]" />
                      Valid From (IST)
                    </span>
                    <span className="text-[11px] text-[#7A6458]">
                      {formatIstDisplay(draftSlot.validFrom)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={fromParts.date}
                      onChange={(e) => handleValidityChange('from', 'date', e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                    />
                    <input
                      type="time"
                      step={60}
                      value={fromParts.time}
                      onChange={(e) => handleValidityChange('from', 'time', e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                    />
                  </div>
                </div>

                {/* Valid Until */}
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8C2E46]" />
                      Valid Until (IST)
                    </span>
                    <span className="text-[11px] text-[#7A6458]">
                      {formatIstDisplay(draftSlot.validUntil)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={untilParts.date}
                      onChange={(e) => handleValidityChange('until', 'date', e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                    />
                    <input
                      type="time"
                      step={60}
                      value={untilParts.time}
                      onChange={(e) => handleValidityChange('until', 'time', e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420]"
                    />
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Footer Save / Reset Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EAE2D5]">
              <button
                type="button"
                onClick={handleResetSlotToDefault}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#EAE2D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#6B5D55] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Slot Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving || Boolean(validationError)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#70252D] hover:bg-[#5A1D24] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 animate-pulse" />
                    <span>Saving...</span>
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
    </div>
  );
};
