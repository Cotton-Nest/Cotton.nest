import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Check, X, AlertCircle, Wand2, Info, Layers, ShieldCheck } from 'lucide-react';
import { generateProductDescriptionApi, AiDescriptionPayload, AiDescriptionResult } from '../services/api';

export type DescriptionStyle = 'elegant' | 'luxurious' | 'minimal' | 'detailed' | 'playful';

interface AiDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  productContext: {
    name?: string;
    fabric?: string;
    colorTone?: string;
    pattern?: string;
    dimensions?: string;
    threadCount?: string;
    pillowCovers?: string;
    collection?: string;
    features?: string[];
    currentDescription?: string;
    imageUrl?: string;
  };
  onInsertDescription: (description: string) => void;
}

function checkIsKidsContext(ctx: AiDescriptionModalProps['productContext']): boolean {
  const text = `${ctx.name || ''} ${ctx.pattern || ''} ${ctx.collection || ''}`.toLowerCase();
  return ['kid', 'child', 'baby', 'nursery', 'safari', 'animal', 'dino', 'cartoon', 'teddy', 'cute', 'star', 'bear', 'bunny', 'jungle'].some(
    (w) => text.includes(w)
  );
}

export const AiDescriptionModal: React.FC<AiDescriptionModalProps> = ({
  isOpen,
  onClose,
  productContext,
  onInsertDescription,
}) => {
  const isKidsDetected = checkIsKidsContext(productContext);
  const [selectedStyle, setSelectedStyle] = useState<DescriptionStyle>(isKidsDetected ? 'playful' : 'elegant');
  const [customNotes, setCustomNotes] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] = useState<AiDescriptionResult | null>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  // Initialize or reset draft when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      const kids = checkIsKidsContext(productContext);
      const initialStyle: DescriptionStyle = kids ? 'playful' : 'elegant';
      setSelectedStyle(initialStyle);

      if (!hasGeneratedOnce) {
        if (productContext.currentDescription && productContext.currentDescription.trim()) {
          setGeneratedDraft(productContext.currentDescription);
        } else {
          handleGenerate(initialStyle);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (styleToUse: DescriptionStyle = selectedStyle) => {
    setIsGenerating(true);
    setErrorMessage(null);

    const payload: AiDescriptionPayload = {
      name: productContext.name,
      fabric: productContext.fabric,
      colorTone: productContext.colorTone,
      pattern: productContext.pattern,
      dimensions: productContext.dimensions,
      threadCount: productContext.threadCount,
      pillowCovers: productContext.pillowCovers,
      collection: productContext.collection,
      features: productContext.features,
      style: styleToUse,
      customNotes: customNotes.trim() || undefined,
      imageUrl: productContext.imageUrl || undefined,
    };

    try {
      const result = await generateProductDescriptionApi(payload);
      if (result && result.description) {
        setGeneratedDraft(result.description);
        setGenerationMeta(result);
        setHasGeneratedOnce(true);
      } else {
        setErrorMessage('Could not generate description. Please check your network or try again.');
      }
    } catch (err: any) {
      console.warn('AI generation error:', err);
      setErrorMessage(err.message || 'Generation failed. Manual description entry remains available.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStyleChange = (style: DescriptionStyle) => {
    setSelectedStyle(style);
    handleGenerate(style);
  };

  const handleApply = () => {
    if (!generatedDraft.trim()) {
      setErrorMessage('Please generate or enter a description before inserting.');
      return;
    }
    onInsertDescription(generatedDraft.trim());
    onClose();
  };

  const wordCount = generatedDraft.trim() ? generatedDraft.trim().split(/\s+/).length : 0;
  const charCount = generatedDraft.length;

  const styleOptions: Array<{ id: DescriptionStyle; label: string; desc: string; icon: string }> = [
    {
      id: 'playful',
      label: 'Kids & Cute',
      desc: 'Playful characters, cute prints & child-safe soft cotton',
      icon: '🧸',
    },
    {
      id: 'elegant',
      label: 'Elegant',
      desc: 'Graceful, serene, sensory & calming tone',
      icon: '✨',
    },
    {
      id: 'luxurious',
      label: 'Luxurious',
      desc: 'Opulent, royal Indian heritage & heirloom comfort',
      icon: '👑',
    },
    {
      id: 'minimal',
      label: 'Minimal',
      desc: 'Crisp, contemporary & uncluttered simplicity',
      icon: '🌿',
    },
    {
      id: 'detailed',
      label: 'Detailed',
      desc: 'In-depth weave, tuck-in specs & pillow shams',
      icon: '📏',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#EAE2D5] overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-200"
        style={{ color: '#2C2420' }}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAE2D5] flex items-center justify-between bg-gradient-to-r from-[#FAF7F2] via-white to-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FDEAF0] text-[#8C2E46] flex items-center justify-center border border-[#FAD1DC] shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#8C2E46] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury font-bold text-base sm:text-lg text-[#2C2420]">
                  AI Bedsheet Description Studio
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#8C2E46] text-white px-2 py-0.5 rounded-full shadow-2xs">
                  Gemini AI
                </span>
              </div>
              <p className="text-[11px] text-[#7A6458]">
                Generate attractive, brand-tailored luxury descriptions using your exact product details.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C7A70] hover:text-[#2C2420] rounded-full hover:bg-[#F4EFE6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          
          {/* Active Product Context Pills */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#C29E57]" />
                <span>Captured Product Specifications</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                Zero Spec Invention
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                <strong>Name:</strong> {productContext.name || 'Handcrafted Bedsheet'}
              </span>
              {productContext.fabric && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Fabric:</strong> {productContext.fabric}
                </span>
              )}
              {productContext.colorTone && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Color:</strong> {productContext.colorTone}
                </span>
              )}
              {productContext.pattern && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Pattern:</strong> {productContext.pattern}
                </span>
              )}
              {productContext.threadCount && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Thread Count:</strong> {productContext.threadCount}
                </span>
              )}
              {productContext.dimensions && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Size:</strong> {productContext.dimensions}
                </span>
              )}
              {productContext.pillowCovers && (
                <span className="px-2.5 py-1 bg-white rounded-lg border border-[#EAE2D5] text-[11px] font-medium text-[#2C2420]">
                  <strong>Pillows:</strong> {productContext.pillowCovers}
                </span>
              )}
            </div>
          </div>

          {/* Style / Tone Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#2C2420] uppercase tracking-wider">
              Choose Brand Copy Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {styleOptions.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStyleChange(st.id)}
                  disabled={isGenerating}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedStyle === st.id
                      ? 'border-[#8C2E46] bg-[#FDEAF0]/60 ring-2 ring-[#8C2E46]/30 shadow-xs'
                      : 'border-[#EAE2D5] bg-white hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{st.icon}</span>
                    <span className="font-bold text-xs text-[#2C2420]">{st.label}</span>
                  </div>
                  <p className="text-[10px] text-[#7A6458] leading-tight line-clamp-2">
                    {st.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Focus / Custom Request */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#6B5D55]">
              Optional Focus Instruction (e.g. emphasize summer cooling, anti-pilling, or festive gifting)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Highlight cool crisp percale texture and easy machine wash..."
                className="flex-1 px-3 py-2 bg-white border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerate(selectedStyle);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleGenerate(selectedStyle)}
                disabled={isGenerating}
                className="px-3.5 py-2 bg-[#2C2420] hover:bg-[#3D332D] text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Generating...' : 'Apply'}</span>
              </button>
            </div>
          </div>

          {/* Error Message banner if generation failed */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  You can type your description manually in the editor below or try regenerating.
                </p>
              </div>
            </div>
          )}

          {/* Generated Preview & Direct Refine Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#2C2420] flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#8C2E46]" />
                <span>Generated Description (Preview &amp; Editable)</span>
              </label>

              <div className="flex items-center gap-2 text-[10px]">
                {generationMeta?.source === 'gemini' ? (
                  <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Gemini Live AI ({generationMeta.model || '3.8-flash'})
                  </span>
                ) : generationMeta?.source === 'atelier_engine' ? (
                  <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>✨</span>
                    Cotton Nest Atelier Copy Engine
                  </span>
                ) : null}

                <span className="text-[#8C7A70]">
                  {wordCount} words · {charCount} chars
                </span>
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={generatedDraft}
                onChange={(e) => setGeneratedDraft(e.target.value)}
                placeholder="Click Generate to compose an attractive description matching Cotton Nest's luxury brand aesthetic..."
                className="w-full px-3.5 py-3 bg-white border border-[#DEC89B] rounded-2xl text-xs text-[#2C2420] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#8C2E46]/20 focus:border-[#8C2E46] transition-all shadow-inner"
              />

              {isGenerating && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 text-[#8C2E46] animate-spin" />
                  <p className="font-semibold text-xs text-[#8C2E46]">
                    Composing luxury description with Gemini AI...
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#7A6458]">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-[#C29E57]" />
                <span>You can edit this text directly before inserting it into your bedsheet listing.</span>
              </span>
              <button
                type="button"
                onClick={() => handleGenerate(selectedStyle)}
                disabled={isGenerating}
                className="font-semibold text-[#8C2E46] hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate Variant</span>
              </button>
            </div>
          </div>

          {/* Safe Reassurance Notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Owner Protection:</strong> Your product description will <em>not</em> be overwritten until you explicitly click "Insert Description".
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EAE2D5] bg-[#FAF7F2] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#EAE2D5] bg-white text-xs font-semibold text-[#6B5D55] hover:text-[#2C2420] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
          >
            Cancel / Keep Existing
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerate(selectedStyle)}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl border border-[#DEC89B] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#8C2E46] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isGenerating || !generatedDraft.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#8C2E46] hover:bg-[#732438] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Insert Description</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
