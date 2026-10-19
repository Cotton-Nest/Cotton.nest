import React from 'react';
import { MapPin, Phone, MessageCircle, Clock, Navigation, CheckCircle2, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { COMPANY_DETAILS } from '../data/products';

export const StoreLocation: React.FC = () => {
  const [inquiryName, setInquiryName] = React.useState('');
  const [inquiryPhone, setInquiryPhone] = React.useState('');
  const [inquiryMsg, setInquiryMsg] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmitVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullMsg = `Hi Cotton Nest! My name is ${inquiryName} (${inquiryPhone}). I would like to visit your Sector 46 Gurgaon store to see bedsheets. Note: ${inquiryMsg || 'Please share directions & visiting slot.'}`;
    window.open(COMPANY_DETAILS.whatsappUrl(fullMsg), '_blank');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <section id="store-location" className="py-12 sm:py-16 bg-[#F4EFE6]/60 border-t border-[#EAE2D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Scroll Reveal */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto mb-10 space-y-2"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A8823B] uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-[#C29E57]" />
            Flagship Experience Studio
          </div>
          <h2 className="font-serif-luxury text-3xl sm:text-4xl font-semibold text-[#2C2420]">
            Visit Cotton Nest in Gurgaon
          </h2>
          <p className="text-sm text-[#6B5D55]">
            Prefer feeling the texture and softness before buying? 
            Visit our studio at Sector 46 or request a video walkthrough.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Direct Address & Contact Information Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            
            {/* Main Physical Address Card */}
            <div className="bg-[#FAF7F2] p-6 sm:p-7 rounded-2xl border border-[#EAE2D5] shadow-xs space-y-5">
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#FDEAF0] text-[#B83F60] rounded-xl border border-[#F9D3DE] shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#A8823B] uppercase tracking-wider">
                    Official Studio Address
                  </p>
                  <h3 className="font-serif-luxury text-xl sm:text-2xl font-semibold text-[#2C2420]">
                    Cotton Nest Bedding Studio
                  </h3>
                  <p className="text-sm sm:text-base text-[#4A3E38] font-medium leading-relaxed">
                    House Number 2508, Ground Floor,<br />
                    Sector 46, Gurgaon, Haryana — 122003
                  </p>
                  <p className="text-xs text-[#7A6458] pt-1">
                    Easy ground floor access · Ample visitor parking available
                  </p>
                </div>
              </div>

              {/* Action Buttons for Map & Call */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#EAE2D5]">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${COMPANY_DETAILS.mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#DEC89B] text-[#2C2420] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-[#C29E57]" />
                  <span>Google Maps</span>
                </a>

                <a
                  href={COMPANY_DETAILS.callUrl}
                  className="py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#EAE2D5] text-[#2C2420] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-[#B83F60]" />
                  <span>+91 7838625915</span>
                </a>

                <a
                  href={COMPANY_DETAILS.whatsappUrl("Hello Cotton Nest! I would like to get directions to your Sector 46 Gurgaon store.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Chat</span>
                </a>
              </div>

            </div>

            {/* Timings and Visiting Guidelines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="p-5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#A8823B] uppercase">
                  <Clock className="w-4 h-4 text-[#C29E57]" />
                  Visiting Hours
                </div>
                <p className="text-sm font-semibold text-[#2C2420]">
                  Monday to Sunday (Open 7 Days)
                </p>
                <p className="text-xs text-[#6B5D55]">
                  10:00 AM – 8:30 PM (IST)
                </p>
                <p className="text-[11px] text-[#7A6458] pt-1 border-t border-[#EAE2D5]/70">
                  Walk-ins welcome, or call ahead for dedicated fabric showing.
                </p>
              </div>

              <div className="p-5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#B83F60] uppercase">
                  <CheckCircle2 className="w-4 h-4 text-[#B83F60]" />
                  Gurgaon Local Perks
                </div>
                <p className="text-sm font-semibold text-[#2C2420]">
                  Same-Day Gurgaon Delivery
                </p>
                <p className="text-xs text-[#6B5D55]">
                  Instant express delivery to Sectors 45, 46, 47, 50, Cyber City &amp; Golf Course.
                </p>
                <p className="text-[11px] text-[#7A6458] pt-1 border-t border-[#EAE2D5]/70">
                  Orders confirmed &amp; dispatched directly over WhatsApp.
                </p>
              </div>

            </div>

          </motion.div>

          {/* Right Column: Book a Studio Visit or WhatsApp Swatch Request */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="bg-[#FAF7F2] p-6 sm:p-7 rounded-2xl border border-[#EAE2D5] shadow-xs space-y-4">
              
              <div>
                <span className="text-xs font-semibold uppercase text-[#A8823B] tracking-wider">
                  Personal Bedding Consultation
                </span>
                <h3 className="font-serif-luxury text-xl font-semibold text-[#2C2420] mt-1">
                  Plan a Visit or Request Swatches
                </h3>
                <p className="text-xs text-[#6B5D55] mt-1">
                  Drop your details and we will immediately connect with you via WhatsApp or phone call.
                </p>
              </div>

              <form onSubmit={handleSubmitVisit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Kapoor"
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4EFE6] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder:text-[#9B8C83] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4EFE6] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder:text-[#9B8C83] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2C2420] mb-1">
                    What would you like to inquire about?
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. I want to see the Gulabi Bagh Rose and Shivaura Trellis bedsheets in person this Saturday..."
                    value={inquiryMsg}
                    onChange={(e) => setInquiryMsg(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4EFE6] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder:text-[#9B8C83] focus:outline-none focus:border-[#C29E57]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#B83F60] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Direct WhatsApp Message</span>
                </button>

                {submitted && (
                  <p className="text-xs text-center text-emerald-700 font-medium">
                    Opening WhatsApp to connect you with Cotton Nest studio!
                  </p>
                )}
              </form>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-[#7A6458]">
                  Or direct call us anytime:{' '}
                  <a href={COMPANY_DETAILS.callUrl} className="font-semibold text-[#B83F60] hover:underline">
                    +91 7838625915
                  </a>
                </p>
              </div>

            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
};
