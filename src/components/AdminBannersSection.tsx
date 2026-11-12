import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Edit3,
  Trash2,
  Copy,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpDown,
  Upload,
  Image as ImageIcon,
  Save,
  X,
  Smartphone,
  Monitor,
  Check,
  Tag,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  HomepageBanner,
  CAMPAIGN_CATEGORIES,
  computeBannerStatus,
} from '../data/banners';
import { HomepageCampaignBanner } from './HomepageCampaignBanner';
import { uploadToCloudinary } from '../services/cloudinary';

interface AdminBannersSectionProps {
  banners: HomepageBanner[];
  onSaveBanner: (banner: HomepageBanner) => Promise<void> | void;
  onDeleteBanner: (bannerId: string) => Promise<void> | void;
  onDuplicateBanner: (banner: HomepageBanner) => Promise<void> | void;
  onSaveAllBanners: (banners: HomepageBanner[]) => Promise<void> | void;
}

export const AdminBannersSection: React.FC<AdminBannersSectionProps> = ({
  banners,
  onSaveBanner,
  onDeleteBanner,
  onDuplicateBanner,
  onSaveAllBanners,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewBanner, setPreviewBanner] = useState<HomepageBanner | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isUploadingDesktop, setIsUploadingDesktop] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Stats calculation
  const now = new Date();
  const totalBanners = banners.length;
  const activeCount = banners.filter((b) => computeBannerStatus(b, now) === 'active').length;
  const scheduledCount = banners.filter((b) => computeBannerStatus(b, now) === 'scheduled').length;
  const expiredCount = banners.filter((b) => computeBannerStatus(b, now) === 'expired').length;
  const draftCount = banners.filter((b) => computeBannerStatus(b, now) === 'draft').length;

  const filteredBanners = banners.filter((banner) => {
    const computedStatus = computeBannerStatus(banner, now);
    if (filterStatus !== 'all' && computedStatus !== filterStatus) return false;
    if (selectedCategory !== 'all' && banner.category !== selectedCategory) return false;
    return true;
  });

  // Sort by priority ascending (1 highest)
  filteredBanners.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  const handleCreateNew = () => {
    const newBanner: HomepageBanner = {
      id: `banner-${Date.now()}`,
      campaignName: 'New Festival Campaign',
      category: 'Diwali',
      heading: 'CELEBRATE WITH COTTON NEST',
      subtitle: 'Pure Cotton Comfort for Your Bedroom',
      description: 'Discover handcrafted pure long-staple cotton bedsheets.',
      ctaText: 'SHOP COLLECTION',
      ctaDestination: 'catalogue',
      secondaryCtaText: 'VISIT STUDIO',
      secondaryCtaDestination: 'store',
      desktopImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1600',
      mobileImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800',
      backgroundColor: '#FAF6F0',
      textColor: '#2C2420',
      textAlignment: 'center',
      festiveEffect: 'gold_sparks',
      priority: banners.length + 1,
      status: 'draft',
      isEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingBanner(newBanner);
    setIsEditorOpen(true);
  };

  const handleSaveEditor = async () => {
    if (!editingBanner) return;
    const bannerToSave = {
      ...editingBanner,
      updatedAt: Date.now(),
    };
    await onSaveBanner(bannerToSave);
    setIsEditorOpen(false);
    setEditingBanner(null);
    setSaveSuccessMsg(`Campaign "${bannerToSave.campaignName}" saved successfully!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleToggleEnable = async (banner: HomepageBanner) => {
    const updated = {
      ...banner,
      isEnabled: !banner.isEnabled,
      status: (!banner.isEnabled ? 'active' : 'disabled') as any,
      updatedAt: Date.now(),
    };
    await onSaveBanner(updated);
  };

  const handleDesktopImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBanner) return;
    setIsUploadingDesktop(true);
    try {
      const res = await uploadToCloudinary(file);
      const url = typeof res === 'string' ? res : (res.url || (res as any).secure_url || '');
      setEditingBanner({ ...editingBanner, desktopImageUrl: url });
    } catch (err) {
      alert('Failed to upload desktop image. Please check Cloudinary configuration or network.');
    } finally {
      setIsUploadingDesktop(false);
    }
  };

  const handleMobileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBanner) return;
    setIsUploadingMobile(true);
    try {
      const res = await uploadToCloudinary(file);
      const url = typeof res === 'string' ? res : (res.url || (res as any).secure_url || '');
      setEditingBanner({ ...editingBanner, mobileImageUrl: url });
    } catch (err) {
      alert('Failed to upload mobile image. Please check Cloudinary configuration or network.');
    } finally {
      setIsUploadingMobile(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    await onDeleteBanner(id);
    setIsDeletingId(null);
  };

  return (
    <div className="space-y-6 font-sans text-[#2C2420]">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/80 border border-[#EAE2D5] shadow-xs backdrop-blur-md">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#70252D]/10 text-[#70252D] text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
            <span>Campaign Manager</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2420]">
            Homepage Banner & Campaign Management
          </h2>
          <p className="text-xs sm:text-sm text-[#7A6458] mt-1">
            Create, schedule, prioritize and publish promotional banners dynamically without code redeployments.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#70252D] hover:bg-[#581C23] text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Campaign Banner</span>
        </button>
      </div>

      {saveSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Campaign Status Metrics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#EAE2D5] shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7A6458]">Total Campaigns</p>
          <p className="font-serif text-2xl font-bold text-[#2C2420] mt-1">{totalBanners}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Active Now</p>
          <p className="font-serif text-2xl font-bold text-emerald-800 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Scheduled</p>
          <p className="font-serif text-2xl font-bold text-amber-800 mt-1">{scheduledCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Drafts</p>
          <p className="font-serif text-2xl font-bold text-slate-800 mt-1">{draftCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Expired / Disabled</p>
          <p className="font-serif text-2xl font-bold text-rose-800 mt-1">{expiredCount}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white/90 border border-[#EAE2D5] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[#7A6458] mr-1">Status:</span>
          {['all', 'active', 'scheduled', 'draft', 'expired', 'disabled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-full capitalize font-medium transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-[#70252D] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF6F0] text-[#7A6458] hover:bg-[#F3E8DC]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-[#7A6458]">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#DEC89B] bg-white text-xs font-medium text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#70252D]"
          >
            <option value="all">All Categories</option>
            {CAMPAIGN_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banners List Grid */}
      {filteredBanners.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-[#EAE2D5] text-[#7A6458]">
          <Sparkles className="w-10 h-10 mx-auto text-[#C29E57] mb-3 opacity-60" />
          <h3 className="font-serif text-lg font-bold text-[#2C2420]">No Campaign Banners Found</h3>
          <p className="text-xs mt-1 max-w-md mx-auto">
            {filterStatus !== 'all' || selectedCategory !== 'all'
              ? 'Try adjusting your filters or category selection.'
              : 'Create your first dynamic homepage banner to publish festive offers or special collections.'}
          </p>
          <button
            type="button"
            onClick={handleCreateNew}
            className="mt-4 px-5 py-2.5 rounded-full bg-[#70252D] text-white text-xs font-semibold shadow-md hover:bg-[#581C23] transition-all cursor-pointer"
          >
            Create Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBanners.map((banner) => {
            const computedStatus = computeBannerStatus(banner, now);

            return (
              <div
                key={banner.id}
                className="p-5 rounded-3xl bg-white border border-[#EAE2D5] shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              >
                {/* Banner Thumbnail & Key Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-20 h-20 sm:w-28 sm:h-20 rounded-2xl overflow-hidden bg-[#FAF6F0] shrink-0 border border-[#EAE2D5] relative group">
                    {banner.desktopImageUrl ? (
                      <img
                        src={banner.desktopImageUrl}
                        alt={banner.heading}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#7A6458]">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 px-2 py-0.5 rounded-md bg-black/70 text-amber-300 text-[9px] font-bold">
                      #{banner.priority}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-lg font-bold text-[#2C2420] truncate">
                        {banner.campaignName}
                      </span>

                      {/* Category Tag */}
                      <span className="px-2.5 py-0.5 rounded-full bg-[#70252D]/10 text-[#70252D] text-[10px] font-semibold uppercase tracking-wider">
                        {banner.category}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          computedStatus === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : computedStatus === 'scheduled'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : computedStatus === 'draft'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {computedStatus}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[#70252D]">
                      {banner.heading}
                    </p>
                    <p className="text-xs text-[#7A6458] truncate">
                      {banner.subtitle}
                    </p>

                    {/* Schedule Dates */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#7A6458] pt-1">
                      {banner.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#A8823B]" />
                          Start: {new Date(banner.startDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                      {banner.expiryDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-rose-600" />
                          Expires: {new Date(banner.expiryDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#EAE2D5] w-full md:w-auto justify-end">
                  {/* Priority Toggle */}
                  <div className="flex items-center gap-1 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#EAE2D5] text-xs font-medium text-[#7A6458]">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#A8823B]" />
                    <span>Priority:</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={banner.priority}
                      onChange={(e) => {
                        const nextPriority = Math.max(1, parseInt(e.target.value) || 1);
                        onSaveBanner({ ...banner, priority: nextPriority });
                      }}
                      className="w-10 px-1 py-0.5 text-center font-bold bg-white rounded-md border border-[#DEC89B] focus:outline-none"
                    />
                  </div>

                  {/* Enable Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnable(banner)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      banner.isEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <span>{banner.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>

                  {/* Preview Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewBanner(banner)}
                    className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F3E8DC] text-[#70252D] transition-colors cursor-pointer"
                    title="Live Preview Banner"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Duplicate Button */}
                  <button
                    type="button"
                    onClick={() => onDuplicateBanner(banner)}
                    className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F3E8DC] text-[#7A6458] transition-colors cursor-pointer"
                    title="Duplicate Campaign"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBanner(banner);
                      setIsEditorOpen(true);
                    }}
                    className="p-2 rounded-xl bg-[#70252D] hover:bg-[#581C23] text-white transition-colors cursor-pointer"
                    title="Edit Campaign Details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setIsDeletingId(banner.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                    title="Delete Banner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeletingId && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-[#EAE2D5]">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-serif text-lg font-bold">Delete Campaign Banner?</h3>
            </div>
            <p className="text-xs text-[#7A6458] leading-relaxed">
              Are you sure you want to delete this promotional banner? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(isDeletingId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Delete Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewBanner && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FAF6F0] rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-[#EAE2D5] space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-[#EAE2D5] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#70252D] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-[#C29E57]" />
                  <span>Live Interactive Preview</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#2C2420]">
                  {previewBanner.campaignName}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Viewport Switcher */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#EAE2D5] text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 cursor-pointer ${
                      previewViewport === 'desktop'
                        ? 'bg-[#70252D] text-white font-semibold'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 cursor-pointer ${
                      previewViewport === 'mobile'
                        ? 'bg-[#70252D] text-white font-semibold'
                        : 'text-[#7A6458] hover:text-[#2C2420]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewBanner(null)}
                  className="p-2 rounded-full bg-white hover:bg-slate-100 text-[#2C2420] border border-[#EAE2D5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="py-4 flex justify-center bg-slate-200/50 rounded-2xl p-4 overflow-hidden min-h-[300px]">
              <div
                className={`transition-all duration-300 w-full ${
                  previewViewport === 'mobile' ? 'max-w-[380px]' : 'max-w-full'
                }`}
              >
                <HomepageCampaignBanner
                  banners={[]}
                  previewBanner={previewBanner}
                  onNavigate={() => alert('CTA link preview clicked!')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#7A6458] pt-2 border-t border-[#EAE2D5]">
              <span>Preview mode reflects exact customer presentation.</span>
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

      {/* Campaign Banner Editor Modal */}
      {isEditorOpen && editingBanner && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-[#EAE2D5] space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[#EAE2D5] pb-4">
              <div>
                <span className="text-xs font-semibold text-[#70252D] uppercase tracking-wider">
                  Campaign Content Editor
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#2C2420]">
                  {editingBanner.id ? `Edit: ${editingBanner.campaignName}` : 'Create New Campaign Banner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditorOpen(false);
                  setEditingBanner(null);
                }}
                className="p-2 rounded-full bg-[#FAF6F0] hover:bg-[#F3E8DC] text-[#2C2420] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              
              {/* Campaign Name */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Campaign Name (Internal Title)*</label>
                <input
                  type="text"
                  value={editingBanner.campaignName}
                  onChange={(e) => setEditingBanner({ ...editingBanner, campaignName: e.target.value })}
                  placeholder="e.g. Diwali Grand Festivities 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Campaign Category*</label>
                <select
                  value={editingBanner.category}
                  onChange={(e) => setEditingBanner({ ...editingBanner, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                >
                  {CAMPAIGN_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Main Heading */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-semibold text-[#2C2420]">Main Banner Heading*</label>
                <input
                  type="text"
                  value={editingBanner.heading}
                  onChange={(e) => setEditingBanner({ ...editingBanner, heading: e.target.value })}
                  placeholder="e.g. HAPPY DIWALI"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] font-serif text-base font-bold focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-semibold text-[#2C2420]">Subtitle Message*</label>
                <input
                  type="text"
                  value={editingBanner.subtitle}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  placeholder="e.g. Celebrate the Festival of Lights with Cotton Nest."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-semibold text-[#2C2420]">Description (Optional Body Copy)</label>
                <textarea
                  rows={2}
                  value={editingBanner.description || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                  placeholder="Optional details or promotional discount details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              {/* Primary CTA */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Primary CTA Button Text*</label>
                <input
                  type="text"
                  value={editingBanner.ctaText}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaText: e.target.value })}
                  placeholder="SHOP NOW"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Primary CTA Destination</label>
                <select
                  value={editingBanner.ctaDestination}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaDestination: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                >
                  <option value="catalogue">Bedsheets Catalogue</option>
                  <option value="seasonal">Seasonal Offers Page</option>
                  <option value="story">Craftsmanship & Story</option>
                  <option value="store">Gurgaon Studio Store</option>
                  <option value="reviews">Customer Reviews</option>
                </select>
              </div>

              {/* Secondary CTA */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Secondary CTA Button Text (Optional)</label>
                <input
                  type="text"
                  value={editingBanner.secondaryCtaText || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, secondaryCtaText: e.target.value })}
                  placeholder="EXPLORE COLLECTION"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Secondary CTA Destination</label>
                <select
                  value={editingBanner.secondaryCtaDestination || 'store'}
                  onChange={(e) => setEditingBanner({ ...editingBanner, secondaryCtaDestination: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] focus:ring-2 focus:ring-[#70252D] focus:outline-none"
                >
                  <option value="store">Gurgaon Studio Store</option>
                  <option value="catalogue">Bedsheets Catalogue</option>
                  <option value="seasonal">Seasonal Offers Page</option>
                  <option value="story">Craftsmanship & Story</option>
                </select>
              </div>

              {/* Desktop Image Upload */}
              <div className="space-y-1.5 md:col-span-2 p-4 rounded-2xl bg-[#FAF6F0] border border-[#EAE2D5]">
                <label className="font-semibold text-[#2C2420] flex items-center justify-between">
                  <span>Desktop Banner Image</span>
                  {isUploadingDesktop && <span className="text-amber-700 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</span>}
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    value={editingBanner.desktopImageUrl || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, desktopImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 w-full px-3 py-2 rounded-xl border border-[#DEC89B] bg-white"
                  />
                  <label className="px-4 py-2 rounded-xl bg-[#70252D] text-white font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#581C23] shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleDesktopImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Mobile Image Upload */}
              <div className="space-y-1.5 md:col-span-2 p-4 rounded-2xl bg-[#FAF6F0] border border-[#EAE2D5]">
                <label className="font-semibold text-[#2C2420] flex items-center justify-between">
                  <span>Mobile Optimised Image (Optional)</span>
                  {isUploadingMobile && <span className="text-amber-700 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</span>}
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    value={editingBanner.mobileImageUrl || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, mobileImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 w-full px-3 py-2 rounded-xl border border-[#DEC89B] bg-white"
                  />
                  <label className="px-4 py-2 rounded-xl bg-[#70252D] text-white font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#581C23] shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Mobile Image</span>
                    <input type="file" accept="image/*" onChange={handleMobileImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Background Color & Text Styling */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editingBanner.backgroundColor || '#FAF6F0'}
                    onChange={(e) => setEditingBanner({ ...editingBanner, backgroundColor: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-[#DEC89B]"
                  />
                  <input
                    type="text"
                    value={editingBanner.backgroundColor}
                    onChange={(e) => setEditingBanner({ ...editingBanner, backgroundColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#DEC89B]"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Text Color Theme</label>
                <select
                  value={editingBanner.textColor}
                  onChange={(e) => setEditingBanner({ ...editingBanner, textColor: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                >
                  <option value="#2C2420">Dark Text (#2C2420)</option>
                  <option value="light">Light White Text (for dark backgrounds)</option>
                </select>
              </div>

              {/* Text Alignment */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Text Alignment</label>
                <select
                  value={editingBanner.textAlignment}
                  onChange={(e) => setEditingBanner({ ...editingBanner, textAlignment: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Festive Effect */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Festive Decorative Accent</label>
                <select
                  value={editingBanner.festiveEffect || 'none'}
                  onChange={(e) => setEditingBanner({ ...editingBanner, festiveEffect: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                >
                  <option value="none">None (Clean Minimal)</option>
                  <option value="gold_sparks">Gold Sparks & Radial Light</option>
                  <option value="diwali_diyas">Diwali Lights Tag</option>
                  <option value="champagne_shimmer">Champagne Shimmer</option>
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Display Priority (1 = Highest)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editingBanner.priority}
                  onChange={(e) => setEditingBanner({ ...editingBanner, priority: parseInt(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Publish Status</label>
                <select
                  value={editingBanner.status}
                  onChange={(e) => setEditingBanner({ ...editingBanner, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                >
                  <option value="active">Active / Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Schedule Start Date & Time (IST)</label>
                <input
                  type="datetime-local"
                  value={editingBanner.startDate || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, startDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2C2420]">Schedule Expiry Date & Time (IST)</label>
                <input
                  type="datetime-local"
                  value={editingBanner.expiryDate || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, expiryDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B]"
                />
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#EAE2D5]">
              <button
                type="button"
                onClick={() => setPreviewBanner(editingBanner)}
                className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Campaign Banner</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    setEditingBanner(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="px-6 py-2.5 rounded-xl bg-[#70252D] hover:bg-[#581C23] text-white text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save & Publish Banner</span>
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
