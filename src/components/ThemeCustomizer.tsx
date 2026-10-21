import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Save,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  BookmarkCheck,
  ShieldCheck,
  Sliders,
  Check,
  Info,
  HelpCircle,
  ExternalLink,
  Laptop,
  Smartphone
} from 'lucide-react';
import {
  ThemeColors,
  ThemePreset,
  WebsiteThemeConfig,
  CLASSIC_COTTON_NEST_COLORS,
  FESTIVAL_THEME_PRESETS,
  isValidHex,
  normalizeHex,
  getContrastRatio,
  getContrastTextColor,
  applyThemeToDom,
  getStoredDraftTheme,
  saveStoredDraftTheme,
  clearStoredDraftTheme,
  getStoredCustomPresets,
  saveStoredCustomPreset,
  deleteStoredCustomPreset,
} from '../data/theme';
import { savePublishedThemeApi } from '../services/api';

interface ThemeCustomizerProps {
  currentTheme: WebsiteThemeConfig;
  onThemePublished: (newTheme: WebsiteThemeConfig) => void;
  isOwnerAuthenticated?: boolean;
  onRequestOwnerAuth?: () => void;
}

interface ColorFieldMeta {
  key: keyof ThemeColors;
  label: string;
  description: string;
  exampleElement: string;
  category: 'core' | 'layout' | 'typography';
}

const COLOR_FIELDS: ColorFieldMeta[] = [
  {
    key: 'primary',
    label: 'Primary Colour',
    description: 'Buttons, links, active navigation items, badges, and focal interactive elements.',
    exampleElement: 'Add to Bag button, Catalogue tab active indicator, price tag',
    category: 'core',
  },
  {
    key: 'secondary',
    label: 'Secondary Colour',
    description: 'Supporting interface elements, secondary buttons, and subtle hover borders.',
    exampleElement: 'Secondary buttons, variant rings, outline badges',
    category: 'core',
  },
  {
    key: 'accent',
    label: 'Accent Colour',
    description: 'Decorative highlights, metallic borders, star ratings, and premium details.',
    exampleElement: 'Muted gold badges, sparkle icons, luxury dividers',
    category: 'core',
  },
  {
    key: 'background',
    label: 'Page Background Colour',
    description: 'Main background behind catalogue grids, story section, and page container.',
    exampleElement: 'Store page canvas, body background',
    category: 'layout',
  },
  {
    key: 'surface',
    label: 'Surface / Card Background',
    description: 'Bedsheet product cards, modals, checkout drawer, and dropdown surfaces.',
    exampleElement: 'Product cards, review popups, modal panels',
    category: 'layout',
  },
  {
    key: 'header',
    label: 'Header / Navbar Colour',
    description: 'Top navigation bar and announcement ribbon backdrop.',
    exampleElement: 'Sticky top navbar, mobile brand header',
    category: 'layout',
  },
  {
    key: 'footer',
    label: 'Footer Background Colour',
    description: 'Bottom footer area containing store location and atelier hours.',
    exampleElement: 'Bottom store info, copyright section',
    category: 'layout',
  },
  {
    key: 'text',
    label: 'Main Text Colour',
    description: 'Primary headings, bedsheet titles, prices, and high-emphasis copy.',
    exampleElement: 'Hero headline, product names, price numbers',
    category: 'typography',
  },
  {
    key: 'textSecondary',
    label: 'Secondary Text Colour',
    description: 'Thread count, dimensions, descriptions, pillow details, and timestamps.',
    exampleElement: 'Specifications, subtitled copy, delivery notes',
    category: 'typography',
  },
];

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  currentTheme,
  onThemePublished,
  isOwnerAuthenticated = true,
  onRequestOwnerAuth,
}) => {
  // Working draft colors
  const [draftColors, setDraftColors] = useState<ThemeColors>(() => {
    const savedDraft = getStoredDraftTheme();
    return savedDraft || currentTheme.colors || CLASSIC_COTTON_NEST_COLORS;
  });

  // Track raw input string for each hex field to allow typing before validation
  const [hexInputs, setHexInputs] = useState<Record<string, string>>(() => {
    const initialColors = getStoredDraftTheme() || currentTheme.colors || CLASSIC_COTTON_NEST_COLORS;
    const inputs: Record<string, string> = {};
    Object.entries(initialColors).forEach(([key, val]) => {
      inputs[key] = String(val);
    });
    return inputs;
  });

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active preset selection
  const [selectedPresetId, setSelectedPresetId] = useState<string>(currentTheme.activeThemeId || 'classic');
  const [themeName, setThemeName] = useState<string>(currentTheme.themeName || 'Classic Cotton Nest');

  // Custom presets
  const [customPresets, setCustomPresets] = useState<ThemePreset[]>(() => getStoredCustomPresets());
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);

  // States
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(true);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Apply preview on mount and whenever draft colors change (if preview mode is active)
  useEffect(() => {
    if (isPreviewActive) {
      applyThemeToDom(draftColors);
    } else {
      applyThemeToDom(currentTheme.colors);
    }
  }, [draftColors, isPreviewActive, currentTheme.colors]);

  // Clean up preview on unmount if draft wasn't published
  useEffect(() => {
    return () => {
      applyThemeToDom(currentTheme.colors);
    };
  }, [currentTheme.colors]);

  // Handle color change (from visual picker or hex input)
  const handleColorChange = (key: keyof ThemeColors, rawValue: string) => {
    setHexInputs((prev) => ({ ...prev, [key]: rawValue }));

    const trimmed = rawValue.trim();
    if (isValidHex(trimmed)) {
      const normalized = normalizeHex(trimmed);
      setDraftColors((prev) => {
        const updated = { ...prev, [key]: normalized };
        // Save draft locally so work is never lost
        saveStoredDraftTheme(updated);
        return updated;
      });
      // Clear error for this field
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setErrors((prev) => ({
        ...prev,
        [key]: `Invalid HEX format. Use #RRGGBB (e.g. #70252D or #FFF).`,
      }));
    }
  };

  // Select a preset
  const handleSelectPreset = (preset: ThemePreset) => {
    setSelectedPresetId(preset.id);
    setThemeName(preset.name);
    setDraftColors(preset.colors);
    
    // Update inputs
    const newInputs: Record<string, string> = {};
    Object.entries(preset.colors).forEach(([key, val]) => {
      newInputs[key] = String(val);
    });
    setHexInputs(newInputs);
    setErrors({});

    // Save draft
    saveStoredDraftTheme(preset.colors);

    // Apply live preview immediately
    if (isPreviewActive) {
      applyThemeToDom(preset.colors);
    }

    setStatusMessage({
      type: 'info',
      text: `Loaded preset "${preset.name}". Preview is active. Click "Publish Theme" when ready to make it live for customers.`,
    });
  };

  // Action 1: Toggle Preview
  const handleTogglePreview = () => {
    const nextState = !isPreviewActive;
    setIsPreviewActive(nextState);
    if (nextState) {
      applyThemeToDom(draftColors);
      setStatusMessage({
        type: 'info',
        text: 'Live preview enabled: You are previewing your draft colours across the website.',
      });
    } else {
      applyThemeToDom(currentTheme.colors);
      setStatusMessage({
        type: 'info',
        text: 'Live preview paused: Showing customer live published theme.',
      });
    }
  };

  // Action 2: Save Draft
  const handleSaveDraft = () => {
    saveStoredDraftTheme(draftColors);
    setStatusMessage({
      type: 'success',
      text: 'Draft theme saved locally! Visitors will continue seeing your active published theme until you click "Publish Theme".',
    });
  };

  // Action 3: Publish Theme to Firebase & Production
  const handlePublishTheme = async () => {
    // Validate all fields
    const hasErrors = Object.keys(errors).length > 0;
    const invalidFields = COLOR_FIELDS.filter((f) => !isValidHex(draftColors[f.key] || ''));

    if (hasErrors || invalidFields.length > 0) {
      setStatusMessage({
        type: 'error',
        text: 'Cannot publish theme: Please fix all invalid HEX colour fields before publishing.',
      });
      return;
    }

    if (!isOwnerAuthenticated && onRequestOwnerAuth) {
      onRequestOwnerAuth();
      return;
    }

    setIsPublishing(true);
    setStatusMessage(null);

    const newThemeConfig: WebsiteThemeConfig = {
      activeThemeId: selectedPresetId,
      themeName: themeName || 'Custom Website Theme',
      colors: {
        ...draftColors,
        primaryContrast: getContrastTextColor(draftColors.primary),
        secondaryContrast: getContrastTextColor(draftColors.secondary),
        headerText: draftColors.headerText || getContrastTextColor(draftColors.header),
        footerText: draftColors.footerText || getContrastTextColor(draftColors.footer),
      },
      updatedAt: Date.now(),
      updatedBy: 'admin',
      version: (currentTheme.version || 1) + 1,
    };

    try {
      // 1. Save to server API (persisted to store_db.json file)
      await savePublishedThemeApi(newThemeConfig);

      // 2. Clear draft since it is now published
      clearStoredDraftTheme();

      // 3. Apply permanently to DOM
      applyThemeToDom(newThemeConfig.colors);

      // 4. Notify parent app
      onThemePublished(newThemeConfig);

      setStatusMessage({
        type: 'success',
        text: `Theme "${newThemeConfig.themeName}" published successfully! All visitors across phones, tablets, and desktops will now see this theme.`,
      });
    } catch (err: any) {
      console.error('Failed to publish theme:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to publish theme: ${err?.message || 'Server error'}. Please try again.`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Action 4: Reset Draft
  const handleResetDraft = () => {
    clearStoredDraftTheme();
    setDraftColors(currentTheme.colors);
    const resetInputs: Record<string, string> = {};
    Object.entries(currentTheme.colors).forEach(([key, val]) => {
      resetInputs[key] = String(val);
    });
    setHexInputs(resetInputs);
    setErrors({});
    setSelectedPresetId(currentTheme.activeThemeId);
    setThemeName(currentTheme.themeName);
    applyThemeToDom(currentTheme.colors);

    setStatusMessage({
      type: 'info',
      text: 'Draft discarded. Reverted all colours to the currently published live theme.',
    });
  };

  // Action 5: Restore Original Classic Theme
  const handleRestoreOriginal = async () => {
    const originalConfig: WebsiteThemeConfig = {
      activeThemeId: 'classic',
      themeName: 'Classic Cotton Nest',
      colors: CLASSIC_COTTON_NEST_COLORS,
      updatedAt: Date.now(),
      updatedBy: 'admin',
    };

    setIsPublishing(true);
    try {
      await savePublishedThemeApi(originalConfig);
      clearStoredDraftTheme();

      setDraftColors(CLASSIC_COTTON_NEST_COLORS);
      const resetInputs: Record<string, string> = {};
      Object.entries(CLASSIC_COTTON_NEST_COLORS).forEach(([key, val]) => {
        resetInputs[key] = String(val);
      });
      setHexInputs(resetInputs);
      setErrors({});
      setSelectedPresetId('classic');
      setThemeName('Classic Cotton Nest');

      applyThemeToDom(CLASSIC_COTTON_NEST_COLORS);
      onThemePublished(originalConfig);

      setStatusMessage({
        type: 'success',
        text: 'Successfully restored and published the original Classic Cotton Nest theme!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error restoring original theme: ${err?.message || 'Database error'}`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Save Custom Preset
  const handleSaveAsCustomPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: ThemePreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      description: 'Custom customized store color palette.',
      festivalTag: 'Custom',
      badge: 'Custom Preset',
      colors: { ...draftColors },
      isCustom: true,
    };
    const updated = saveStoredCustomPreset(newPreset);
    setCustomPresets(updated);
    setSelectedPresetId(newPreset.id);
    setThemeName(newPreset.name);
    setNewPresetName('');
    setShowSavePresetModal(false);

    setStatusMessage({
      type: 'success',
      text: `Saved "${newPreset.name}" to your Custom Presets library!`,
    });
  };

  const handleDeleteCustomPreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteStoredCustomPreset(presetId);
    setCustomPresets(updated);
    if (selectedPresetId === presetId) {
      setSelectedPresetId('classic');
    }
  };

  // Calculate WCAG contrast indicators for live feedback
  const primaryOnSurfaceContrast = getContrastRatio(draftColors.primary, draftColors.surface);
  const textOnBackgroundContrast = getContrastRatio(draftColors.text, draftColors.background);
  const buttonTextContrast = getContrastRatio(
    draftColors.primaryContrast || getContrastTextColor(draftColors.primary),
    draftColors.primary
  );
  const headerContrast = getContrastRatio(
    draftColors.headerText || getContrastTextColor(draftColors.header),
    draftColors.header
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner & Control Deck */}
      <div className="bg-white rounded-3xl border border-[#EAE2D5] shadow-xs p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#EAE2D5]/70">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-9 h-9 rounded-2xl bg-[#FDEAF0] text-[#70252D] flex items-center justify-center border border-[#FAD1DC] shadow-2xs">
                <Palette className="w-5 h-5" />
              </span>
              <h2 className="font-serif-luxury text-2xl lg:text-3xl font-bold text-[#2C2420]">
                Website Appearance & Festival Colours
              </h2>
            </div>
            <p className="text-sm text-[#7A6458] max-w-2xl leading-relaxed">
              Customize Cotton Nest branding and festival celebrations (Diwali, Holi, Christmas, Eid, Independence Day).
              Colours update in real-time preview instantly. Publish whenever you are ready.
            </p>
          </div>

          {/* Quick Active Badge & Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Preview Toggle */}
            <button
              type="button"
              onClick={handleTogglePreview}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                isPreviewActive
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
              title="Toggle live website preview of draft edits"
            >
              {isPreviewActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <Eye className="w-4 h-4 text-amber-700" />
                  <span>Previewing Draft</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-stone-500" />
                  <span>Preview Paused</span>
                </>
              )}
            </button>

            {/* Save Draft */}
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#FAF7F2] text-[#2C2420] border border-[#DEC89B] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
              title="Save changes as a private draft without publishing to customers"
            >
              <Save className="w-4 h-4 text-[#C29E57]" />
              <span>Save Draft</span>
            </button>

            {/* Reset Draft */}
            <button
              type="button"
              onClick={handleResetDraft}
              className="px-3 py-2 rounded-xl text-xs font-medium text-[#7A6458] hover:text-[#2C2420] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
              title="Discard draft changes and revert to published theme"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Draft</span>
            </button>

            {/* Publish Theme to Firestore */}
            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublishTheme}
              className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                isPublishing
                  ? 'bg-[#70252D]/70 text-white cursor-wait'
                  : 'bg-[#70252D] hover:bg-[#5C1E25] text-white hover:shadow-md'
              }`}
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing to Firestore...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish Theme Live</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status notification toast */}
        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-2xl flex items-start gap-3 text-xs leading-relaxed transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border border-red-200'
                : 'bg-amber-50/90 text-amber-900 border border-amber-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-stone-600 text-sm font-bold leading-none cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Live Published Meta Strip */}
        <div className="mt-5 pt-4 border-t border-[#EAE2D5]/50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-[#7A6458]">
            <span className="font-semibold text-[#2C2420]">Active Live Theme:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] font-bold">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
              {currentTheme.themeName}
            </span>
            <span className="text-stone-400">·</span>
            <span className="text-[11px] text-[#A8988D]">
              Last updated: {new Date(currentTheme.updatedAt).toLocaleDateString()} at{' '}
              {new Date(currentTheme.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRestoreOriginal}
            className="text-xs text-[#70252D] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Restore Original Cotton Nest Theme
          </button>
        </div>
      </div>

      {/* SECTION 2: FESTIVAL THEME PRESETS */}
      <div className="bg-white rounded-3xl border border-[#EAE2D5] shadow-xs p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C29E57]" />
              <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                Festival Theme Presets
              </h3>
            </div>
            <p className="text-xs text-[#7A6458] mt-0.5">
              Select a preset to load curated palettes. You can edit any colour before publishing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSavePresetModal(true)}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B] hover:bg-[#F4EFE6] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Current as Custom Preset</span>
          </button>
        </div>

        {/* Standard Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FESTIVAL_THEME_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer group text-left ${
                  isSelected
                    ? 'border-[#70252D] bg-[#FFFBFB] shadow-sm ring-1 ring-[#70252D]/20'
                    : 'border-[#EAE2D5] hover:border-[#DEC89B] bg-white hover:shadow-2xs'
                }`}
              >
                {/* Header tag */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#70252D] border border-[#DEC89B]/50">
                    {preset.badge || preset.festivalTag}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[#70252D] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420] group-hover:text-[#70252D] transition-colors">
                  {preset.name}
                </h4>
                <p className="text-xs text-[#7A6458] mt-1 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>

                {/* Color Swatch Strip */}
                <div className="mt-3 pt-3 border-t border-[#EAE2D5]/70 flex items-center justify-between">
                  <div className="flex items-center -space-x-1.5">
                    <span
                      title={`Primary: ${preset.colors.primary}`}
                      className="w-5 h-5 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.colors.primary }}
                    />
                    <span
                      title={`Secondary: ${preset.colors.secondary}`}
                      className="w-5 h-5 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.colors.secondary }}
                    />
                    <span
                      title={`Accent: ${preset.colors.accent}`}
                      className="w-5 h-5 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.colors.accent }}
                    />
                    <span
                      title={`Background: ${preset.colors.background}`}
                      className="w-5 h-5 rounded-full border border-stone-200 shadow-2xs"
                      style={{ backgroundColor: preset.colors.background }}
                    />
                    <span
                      title={`Footer: ${preset.colors.footer}`}
                      className="w-5 h-5 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.colors.footer }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[#70252D] group-hover:underline">
                    Load Preset →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Saved Presets Section if any */}
        {customPresets.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[#EAE2D5]">
            <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookmarkCheck className="w-3.5 h-3.5 text-[#C29E57]" />
              Your Custom Presets ({customPresets.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPresetId === preset.id
                      ? 'border-[#70252D] bg-[#FFFBFB]'
                      : 'border-[#EAE2D5] bg-[#FAF7F2]/60 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="flex -space-x-1 shrink-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white"
                        style={{ backgroundColor: preset.colors.primary }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white"
                        style={{ backgroundColor: preset.colors.accent }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#2C2420] truncate">
                      {preset.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Delete custom preset"
                    onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                    className="p-1 text-stone-400 hover:text-red-600 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: PALETTE CUSTOMIZER & REAL-TIME PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (7 cols): Full Color Input Controls */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#EAE2D5] shadow-xs p-6 lg:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sliders className="w-4 h-4 text-[#70252D]" />
              <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
                Custom Colour Controls
              </h3>
            </div>
            <p className="text-xs text-[#7A6458]">
              Modify individual colors using the visual color picker or enter exact HEX values (e.g.{' '}
              <span className="font-mono font-semibold text-[#70252D]">#70252D</span>).
            </p>
          </div>

          {/* Theme Display Name input */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] space-y-2">
            <label className="text-xs font-bold text-[#2C2420] uppercase tracking-wider block">
              Theme Display Name
            </label>
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="e.g. Cotton Nest Festive Edition"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] bg-white text-sm font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#70252D]"
            />
            <p className="text-[11px] text-[#7A6458]">
              Displayed in the administrative audit logs and theme presets badge.
            </p>
          </div>

          {/* All Configurable Color Fields */}
          <div className="space-y-4">
            {COLOR_FIELDS.map((field) => {
              const currentHex = draftColors[field.key] || '#000000';
              const rawInput = hexInputs[field.key] ?? currentHex;
              const hasError = !!errors[field.key];
              const valid = isValidHex(rawInput);

              return (
                <div
                  key={field.key}
                  className={`p-4 rounded-2xl border transition-all ${
                    hasError
                      ? 'border-red-300 bg-red-50/20'
                      : 'border-[#EAE2D5] bg-[#FAF7F2]/40 hover:bg-[#FAF7F2]/80 hover:border-[#DEC89B]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Label & Description */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-[#2C2420] uppercase tracking-wide">
                          {field.label}
                        </label>
                        <span className="text-[10px] text-[#A8988D] uppercase font-semibold">
                          ({field.key})
                        </span>
                      </div>
                      <p className="text-xs text-[#7A6458] mt-0.5 leading-relaxed">
                        {field.description}
                      </p>
                      <p className="text-[11px] text-[#9E8B7F] mt-0.5 italic">
                        Applies to: {field.exampleElement}
                      </p>
                    </div>

                    {/* Right: Color Picker + HEX input */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Visual Color Picker input */}
                      <div className="relative group/picker">
                        <input
                          type="color"
                          value={valid ? normalizeHex(rawInput) : '#000000'}
                          onChange={(e) => handleColorChange(field.key, e.target.value.toUpperCase())}
                          className="w-10 h-10 rounded-xl cursor-pointer border border-[#DEC89B] p-0.5 bg-white shadow-2xs hover:scale-105 transition-transform"
                          title={`Click to pick visual colour for ${field.label}`}
                        />
                      </div>

                      {/* Manual HEX text input */}
                      <div className="relative w-28">
                        <input
                          type="text"
                          maxLength={7}
                          value={rawInput}
                          onChange={(e) => handleColorChange(field.key, e.target.value)}
                          placeholder="#70252D"
                          className={`w-full px-2.5 py-2 text-xs font-mono font-bold uppercase rounded-xl border text-center tracking-wider focus:outline-hidden ${
                            hasError
                              ? 'border-red-400 bg-red-50 text-red-900 focus:border-red-600'
                              : 'border-[#DEC89B] bg-white text-[#2C2420] focus:border-[#70252D]'
                          }`}
                        />
                      </div>

                      {/* Swatch preview */}
                      <div
                        className="w-6 h-6 rounded-lg border border-black/10 shadow-inner shrink-0"
                        style={{ backgroundColor: valid ? normalizeHex(rawInput) : 'transparent' }}
                      />
                    </div>
                  </div>

                  {/* Inline Error Message */}
                  {hasError && (
                    <div className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1.5 animate-in fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors[field.key]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contrast Health Check Summary */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2C2420] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Readability & WCAG Contrast Check
              </span>
              <span className="text-[11px] text-stone-500">Auto-Validated</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="bg-white p-2 rounded-xl border border-stone-200 text-center">
                <div className="text-stone-500">Button Text</div>
                <div className="font-bold text-xs text-[#2C2420] mt-0.5">
                  {buttonTextContrast}:1
                </div>
                <div className={buttonTextContrast >= 4.5 ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                  {buttonTextContrast >= 4.5 ? '✓ Pass (AA)' : '⚠ Notice'}
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-stone-200 text-center">
                <div className="text-stone-500">Body Readability</div>
                <div className="font-bold text-xs text-[#2C2420] mt-0.5">
                  {textOnBackgroundContrast}:1
                </div>
                <div className={textOnBackgroundContrast >= 4.5 ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                  {textOnBackgroundContrast >= 4.5 ? '✓ Pass (AA)' : '⚠ Notice'}
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-stone-200 text-center">
                <div className="text-stone-500">Card Surface</div>
                <div className="font-bold text-xs text-[#2C2420] mt-0.5">
                  {primaryOnSurfaceContrast}:1
                </div>
                <div className={primaryOnSurfaceContrast >= 3.0 ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                  {primaryOnSurfaceContrast >= 3.0 ? '✓ Pass' : '⚠ Soft'}
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-stone-200 text-center">
                <div className="text-stone-500">Navbar Contrast</div>
                <div className="font-bold text-xs text-[#2C2420] mt-0.5">
                  {headerContrast}:1
                </div>
                <div className={headerContrast >= 4.5 ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                  {headerContrast >= 4.5 ? '✓ Pass' : '⚠ Check'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Interactive Miniature Store Simulation */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl border border-[#EAE2D5] shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif-luxury text-lg font-bold text-[#2C2420]">
                  Live Component Simulation
                </h4>
                <p className="text-xs text-[#7A6458]">
                  Immediate visual preview of how customer UI renders these colours.
                </p>
              </div>

              {/* Device view switcher */}
              <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#EAE2D5]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-white shadow-2xs text-[#70252D]' : 'text-[#7A6458]'
                  }`}
                  title="Desktop Preview"
                >
                  <Laptop className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-white shadow-2xs text-[#70252D]' : 'text-[#7A6458]'
                  }`}
                  title="Mobile Preview"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated Live Viewport Frame */}
            <div
              className={`rounded-2xl border border-stone-300 shadow-inner overflow-hidden transition-all ${
                previewDevice === 'mobile' ? 'max-w-xs mx-auto' : 'w-full'
              }`}
              style={{
                backgroundColor: draftColors.background,
                color: draftColors.text,
              }}
            >
              {/* Simulated Header */}
              <div
                className="px-3.5 py-2.5 border-b flex items-center justify-between"
                style={{
                  backgroundColor: draftColors.header,
                  borderColor: draftColors.border || '#EAE2D5',
                }}
              >
                <span
                  className="font-serif-luxury font-bold text-base"
                  style={{ color: draftColors.text }}
                >
                  Cotton Nest
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: draftColors.primary,
                      color: draftColors.primaryContrast || getContrastTextColor(draftColors.primary),
                    }}
                  >
                    Bag (2)
                  </span>
                </div>
              </div>

              {/* Simulated Hero Snippet */}
              <div className="p-4 text-center space-y-1.5 border-b border-black/5">
                <span
                  className="text-[9px] uppercase tracking-wider font-bold inline-flex items-center gap-1"
                  style={{ color: draftColors.accent }}
                >
                  <Sparkles className="w-2.5 h-2.5" /> Handcrafted In Gurgaon
                </span>
                <h5
                  className="font-serif-luxury text-base font-bold leading-tight"
                  style={{ color: draftColors.text }}
                >
                  Pure Combed Cotton Sheets
                </h5>
                <p
                  className="text-[10px] leading-relaxed line-clamp-1"
                  style={{ color: draftColors.textSecondary }}
                >
                  100% natural long-staple cotton for Indian weather
                </p>
              </div>

              {/* Simulated Product Card */}
              <div className="p-3">
                <div
                  className="rounded-xl border p-3 shadow-2xs space-y-2.5"
                  style={{
                    backgroundColor: draftColors.surface,
                    borderColor: draftColors.border || '#EAE2D5',
                  }}
                >
                  {/* Photo mockup */}
                  <div className="h-28 rounded-lg bg-stone-200/80 relative overflow-hidden flex items-center justify-center">
                    <img
                      src="/images/royal-heritage.jpg"
                      alt="Product preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div
                      className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs"
                      style={{
                        backgroundColor: draftColors.surface,
                        color: draftColors.primary,
                      }}
                    >
                      King 108×108
                    </div>
                  </div>

                  {/* Card Title & Specs */}
                  <div>
                    <span
                      className="text-[9px] uppercase font-bold tracking-wider"
                      style={{ color: draftColors.accent }}
                    >
                      Heritage Sateen
                    </span>
                    <h6
                      className="font-serif-luxury font-bold text-xs"
                      style={{ color: draftColors.text }}
                    >
                      Royal Heritage Floral Bedsheet
                    </h6>
                    <p
                      className="text-[9px] mt-0.5"
                      style={{ color: draftColors.textSecondary }}
                    >
                      Includes 2 Envelope Pillow Covers
                    </p>
                  </div>

                  {/* Price & CTA Button */}
                  <div className="pt-1 flex items-center justify-between">
                    <div>
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color: draftColors.text }}
                      >
                        ₹1,399
                      </span>
                      <span
                        className="text-[9px] line-through ml-1.5"
                        style={{ color: draftColors.textSecondary }}
                      >
                        ₹1,899
                      </span>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs flex items-center gap-1"
                      style={{
                        backgroundColor: draftColors.primary,
                        color: draftColors.primaryContrast || getContrastTextColor(draftColors.primary),
                      }}
                    >
                      Add to Bag
                    </button>
                  </div>
                </div>
              </div>

              {/* Simulated Footer */}
              <div
                className="px-3.5 py-3 border-t text-[10px] flex items-center justify-between"
                style={{
                  backgroundColor: draftColors.footer,
                  color: draftColors.footerText || getContrastTextColor(draftColors.footer),
                }}
              >
                <span>House 2508, Sector 46 Gurgaon</span>
                <span className="font-semibold">+91 7838625915</span>
              </div>
            </div>

            {/* Publish Callout Box */}
            <div className="p-4 rounded-2xl bg-[#FDEAF0]/60 border border-[#FAD1DC] space-y-2">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#70252D]" />
                <h5 className="text-xs font-bold text-[#70252D]">Ready to Go Live?</h5>
              </div>
              <p className="text-[11px] text-[#7A6458] leading-relaxed">
                Clicking <strong>“Publish Theme Live”</strong> persists the theme to your Google Cloud Firestore
                database so all customers and visitors immediately experience the festive ambience.
              </p>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublishTheme}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#70252D] hover:bg-[#5C1E25] text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing Theme...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Publish Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Save Custom Preset Modal Dialog */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#EAE2D5] p-6 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="font-serif-luxury text-xl font-bold text-[#2C2420]">
              Save as Custom Preset
            </h4>
            <p className="text-xs text-[#7A6458] leading-relaxed">
              Name this color arrangement so you can reapply it for upcoming seasonal promotions or festival sales.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2C2420] uppercase tracking-wider block">
                Preset Name
              </label>
              <input
                type="text"
                autoFocus
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g. Navratri Special or Gurgaon Spring"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEC89B] text-sm font-semibold text-[#2C2420] focus:outline-hidden focus:border-[#70252D]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#7A6458] hover:bg-[#FAF7F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newPresetName.trim()}
                onClick={handleSaveAsCustomPreset}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#70252D] text-white hover:bg-[#5C1E25] disabled:opacity-50"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
