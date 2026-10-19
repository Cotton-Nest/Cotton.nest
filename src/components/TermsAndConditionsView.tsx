import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { SiteContent } from '../data/siteContent';

interface TermsAndConditionsViewProps {
  siteContent?: SiteContent;
  onExploreCatalogue?: () => void;
}

export const TermsAndConditionsView: React.FC<TermsAndConditionsViewProps> = ({
  siteContent,
  onExploreCatalogue,
}) => {
  const customTc = siteContent?.termsAndConditions;

  const renderFormattedContent = (rawText: string) => {
    const lines = rawText.split('\n');
    return (
      <div className="space-y-3.5 text-[#2C2420] leading-relaxed text-base sm:text-lg">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }
          // Convert *bold* to <strong>
          const parts = line.split(/(\*[^*]+\*)/g);
          const content = parts.map((part, pIdx) => {
            if (part.startsWith('*') && part.endsWith('*')) {
              return <strong key={pIdx} className="font-bold text-[#2C2420]">{part.slice(1, -1)}</strong>;
            }
            return part;
          });

          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2 text-sm sm:text-base text-[#3C322C]">
                <span className="text-[#C29E57] font-bold text-lg leading-none mt-0.5">•</span>
                <span>{content}</span>
              </div>
            );
          }

          if (trimmed.startsWith('👉')) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2 text-sm sm:text-base text-[#2C2420]">
                <span className="text-lg shrink-0">👉</span>
                <div>{content}</div>
              </div>
            );
          }

          if (trimmed.startsWith('✨') || trimmed.startsWith('🚚')) {
            return (
              <div key={idx} className="pt-4 pb-1 border-t border-[#EAE2D5] text-lg sm:text-xl font-bold font-serif-luxury text-[#2C2420]">
                {content}
              </div>
            );
          }

          return (
            <p key={idx} className="text-[#2C2420]">
              {content}
            </p>
          );
        })}
      </div>
    );
  };
  return (
    <div className="bg-[#FAF7F2] min-h-[75vh] py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDEAF0] text-[#8C2E46] text-xs font-semibold border border-[#FAD1DC]">
            <Sparkles className="w-3.5 h-3.5 text-[#B83F60]" />
            <span>Cotton Nest Store Policies &amp; Guidelines</span>
          </div>
          <h1 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C2420] tracking-tight">
            Terms &amp; Conditions (T&amp;C)
          </h1>
          <p className="text-sm text-[#7A6458] max-w-xl mx-auto">
            Please review our store policies, exchange guidelines, and delivery charges.
          </p>
        </div>

        {/* Main Content Card with Exact Verbatim Text */}
        <div className="bg-white rounded-3xl border border-[#DEC89B] shadow-sm p-6 sm:p-10 lg:p-12 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FDEAF0]/40 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#F4EFE6]/60 rounded-full blur-2xl pointer-events-none" />

          {customTc && customTc.trim() !== '' ? (
            <div className="relative">
              {renderFormattedContent(customTc)}
            </div>
          ) : (
            <div className="relative space-y-7 text-[#2C2420] leading-relaxed text-base sm:text-lg">
              {/* Header Greeting */}
              <div className="pb-6 border-b border-[#EAE2D5] space-y-2">
              <p className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#8C2E46]">
                Hey Cozy Souls! 💖
              </p>
              <p className="text-lg sm:text-xl font-semibold text-[#2C2420]">
                You’re at <span className="font-serif-luxury font-bold text-[#8C2E46]">Cotton Nest – Feel the Softness</span> 🌸
              </p>
              <p className="text-[#6B5D55] font-medium">
                Your soft &amp; stylish bedsheet hub. 🛍️
              </p>
            </div>

            {/* Note on Color Variations */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">🌸</span>
              <p className="text-[#2C2420]">
                <strong className="font-bold text-[#2C2420]">Please Note:</strong> Slight colour variations may occur due to natural lighting/photography. Returns or exchanges are <strong className="font-bold text-[#8C2E46]">not offered for such variations</strong>. Wherever possible, we’ll provide the <strong className="font-bold text-[#2C2420]">original picture vs. catalogue picture</strong> for reference.
              </p>
            </div>

            {/* Read Description Note */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE2D5] flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">🪶</span>
              <p className="text-[#2C2420]">
                We request you to <strong className="font-bold text-[#2C2420]">read the product description carefully</strong> before placing your order.
              </p>
            </div>

            {/* Exchange Policy Section */}
            <div className="pt-2 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#EAE2D5]">
                <span className="text-xl">✨</span>
                <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
                  EXCHANGE POLICY – MANUFACTURING DEFECTS
                </h2>
              </div>

              <ul className="space-y-2.5 text-sm sm:text-base text-[#3C322C] pl-1">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Exchange is applicable <strong className="font-semibold text-[#2C2420]">only for genuine manufacturing defects</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Defect must be reported within <strong className="font-semibold text-[#2C2420]">48 hours of delivery</strong> with clear photos/videos.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Product must be <strong className="font-semibold text-[#2C2420]">unused, unwashed &amp; in original packaging</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Exchange is subject to <strong className="font-semibold text-[#2C2420]">inspection &amp; approval by Cotton Nest</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Minor print/fabric variations, colour differences, washing damage &amp; normal wear are <strong className="font-semibold text-[#2C2420]">not considered defects</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>Approved cases will be exchanged with the <strong className="font-semibold text-[#2C2420]">same/equivalent product, subject to availability</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span>If the exchange product is unavailable, <strong className="font-semibold text-[#2C2420]">store credit for the eligible amount</strong> will be provided, valid for <strong className="font-semibold text-[#2C2420]">2 months from the date of issue</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C29E57] font-bold text-lg leading-none mt-1">•</span>
                  <span><strong className="font-semibold text-[#8C2E46]">No cash refunds</strong> will be provided.</span>
                </li>
              </ul>
            </div>

            {/* Shipping & Delivery Section */}
            <div className="pt-6 border-t border-[#EAE2D5] space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#2C2420]">
                  SHIPPING &amp; DELIVERY
                </h2>
              </div>

              <div className="space-y-3 pl-1 sm:pl-2 text-sm sm:text-base">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg">👉</span>
                  <p className="text-[#2C2420]">
                    Sector 46, Gurgaon: <strong className="font-bold text-[#2E7D46]">Complimentary Delivery</strong>
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-lg">👉</span>
                  <p className="text-[#2C2420]">
                    Rest of Gurgaon: <strong className="font-semibold text-[#2C2420]">Self Pickup or actual delivery charges</strong>
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-lg">👉</span>
                  <p className="text-[#2C2420]">
                    Across India: <strong className="font-bold text-[#2C2420]">₹100</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Outro Greeting */}
            <div className="pt-8 border-t border-[#EAE2D5] text-center space-y-1">
              <p className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#8C2E46]">
                💖 Thank you for shopping with Cotton Nest!
              </p>
              <p className="font-serif-luxury text-lg sm:text-xl font-bold text-[#2C2420]">
                Feel the Softness. 🌸
              </p>
            </div>

          </div>
          )}
        </div>

        {/* Back to Catalogue CTA */}
        {onExploreCatalogue && (
          <div className="text-center pt-2">
            <button
              onClick={onExploreCatalogue}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#2C2420] hover:bg-[#433731] text-[#FAF7F2] rounded-2xl text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            >
              <span>Explore Bedsheet Catalogue</span>
              <ArrowRight className="w-4 h-4 text-[#DEC89B]" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
