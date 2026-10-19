import React, { useState } from 'react';
import { X, Check, Copy, Download, MessageCircle, ExternalLink, Share2, Sparkles, ShieldCheck } from 'lucide-react';
import { COMPANY_DETAILS } from '../data/products';
import { copyImageBlobToClipboard, downloadJpgFile, shareImageOnMobile, isMobileDevice } from '../utils/whatsappOrder';

export interface WhatsAppHelperData {
  productName: string;
  variantName?: string;
  sku: string;
  imageUrl: string;
  messageText: string;
  isCopied?: boolean;
  canMobileShare?: boolean;
}

interface WhatsAppPhotoHelperModalProps {
  data: WhatsAppHelperData | null;
  onClose: () => void;
}

export const WhatsAppPhotoHelperModal: React.FC<WhatsAppPhotoHelperModalProps> = ({
  data,
  onClose,
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isSharing, setIsSharing] = useState(false);

  if (!data) return null;

  const isMobile = data.canMobileShare ?? isMobileDevice();

  const handleCopyAgain = async () => {
    try {
      const success = await copyImageBlobToClipboard(data.imageUrl);
      if (success) {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2500);
      } else {
        setCopyStatus('error');
      }
    } catch {
      setCopyStatus('error');
    }
  };

  const handleDownloadAgain = () => {
    downloadJpgFile(data.imageUrl, data.productName);
  };

  const handleOpenWhatsAppAgain = () => {
    const waUrl = COMPANY_DETAILS.whatsappUrl(data.messageText);
    window.open(waUrl, '_blank');
  };

  const handleMobileShare = async () => {
    setIsSharing(true);
    await shareImageOnMobile(data.imageUrl, data.messageText, data.productName);
    setIsSharing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] w-full max-w-md rounded-3xl border border-[#DEC89B] shadow-2xl z-10 text-[#2C2420] overflow-hidden p-6 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#7A6458] hover:text-[#2C2420] rounded-full bg-white/80 border border-[#EAE2D5] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Order Prepared with Unique SKU
          </div>
          <h3 className="font-serif-luxury text-xl font-bold text-[#2C2420] pt-1">
            Bedsheet Order Confirmed
          </h3>
          <p className="text-xs text-[#7A6458]">
            {data.productName} {data.variantName ? `· ${data.variantName}` : ''}
          </p>
          <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#2C2420] text-[#DEC89B] text-[11px] font-mono font-bold tracking-wider">
            Ref SKU: #{data.sku}
          </div>
        </div>

        {/* Photo Preview Card */}
        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-[#DEC89B] bg-[#F4EFE6] shadow-inner">
          <img
            src={data.imageUrl}
            alt={data.productName}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute top-2 left-2 bg-[#2C2420]/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-medium">
            Exact Bedsheet Design
          </div>
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-mono">
            JPG
          </div>
        </div>

        {/* Reassurance Banner: Client doesn't need to do anything! */}
        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-950">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No photo upload required from you!</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-800">
            Your WhatsApp message already includes the design name, color variant, and product code <strong>#{data.sku}</strong>. Cotton Nest will confirm your stock immediately!
          </p>
        </div>

        {/* Optional Photo Attachment Tools for Customer */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold text-[#7A6458] uppercase tracking-wider text-center">
            Want to also send the photo?
          </p>

          {isMobile ? (
            /* Mobile Native Share Button */
            <button
              type="button"
              onClick={handleMobileShare}
              disabled={isSharing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#2C2420] hover:bg-[#3D332D] text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#DEC89B]" />
              <span>{isSharing ? 'Opening Share...' : 'Share Photo directly on WhatsApp (Mobile)'}</span>
            </button>
          ) : (
            /* Desktop Quick Actions */
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={handleCopyAgain}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#F4EFE6] border border-[#DEC89B] rounded-xl font-semibold text-[#2C2420] transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#A8823B]" />
                <span>{copyStatus === 'copied' ? 'Photo Copied!' : 'Copy Photo (Ctrl+V)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAgain}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#F4EFE6] border border-[#DEC89B] rounded-xl font-semibold text-[#2C2420] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#A8823B]" />
                <span>Download JPG</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleOpenWhatsAppAgain}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#B83F60] hover:bg-[#A33452] text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Open WhatsApp Chat Now</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-[#7A6458] hover:text-[#2C2420] transition-colors cursor-pointer text-center"
          >
            I'm Done
          </button>
        </div>

      </div>
    </div>
  );
};
