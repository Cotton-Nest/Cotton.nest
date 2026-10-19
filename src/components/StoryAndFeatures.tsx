import React from 'react';
import { Feather, Shield, Droplets, Sparkles, Sun, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { COMPANY_DETAILS } from '../data/products';
import { SiteContent } from '../data/siteContent';

interface StoryAndFeaturesProps {
  onGoToCatalogue: () => void;
  content?: SiteContent;
}

export const StoryAndFeatures: React.FC<StoryAndFeaturesProps> = ({ onGoToCatalogue, content }) => {
  const storyTagline = content?.story.tagline || "The Cotton Nest Story";
  const storyHeading = content?.story.heading || "Honest pure cotton, tailored for Indian bedrooms.";
  const p1 = content?.story.paragraph1 || "At Cotton Nest, based in Sector 46 Gurgaon, we started with a simple belief: bedsheets should never be made with sweaty synthetic microfiber or shrunk down to stingy sizes that untuck the moment you turn in bed.";
  const p2 = content?.story.paragraph2 || "Every single bedsheet in our collection is cut to an expansive King size (108×108 / 100×108 inch), guaranteeing a generous tuck-in under even the thickest modern orthopaedic mattresses.";
  
  const pillar1Title = content?.story.pillar1Title || "Zero Polyester";
  const pillar1Desc = content?.story.pillar1Desc || "Only 100% natural pure cotton yarns that breathe naturally and regulate temperature all night.";
  const pillar2Title = content?.story.pillar2Title || "True 108×108 King Size";
  const pillar2Desc = content?.story.pillar2Desc || "Generously proportioned for deep tuck-in on King and Super King beds without popping loose.";
  const pillar3Title = content?.story.pillar3Title || "Color-Fast Dyes";
  const pillar3Desc = content?.story.pillar3Desc || "Pre-tested reactive dyes that retain their warm cream, soft pink, and muted gold vibrancy after dozens of washes.";
  const pillar4Title = content?.story.pillar4Title || "Gurgaon Studio Direct";
  const pillar4Desc = content?.story.pillar4Desc || "No middleman markups. Shipped directly from Sector 46 Gurgaon with local pickup available.";

  const pillars = [
    {
      title: pillar1Title,
      desc: pillar1Desc,
      icon: Feather,
      iconBg: 'bg-[#FDEAF0] text-[#B83F60]',
    },
    {
      title: pillar2Title,
      desc: pillar2Desc,
      icon: Shield,
      iconBg: 'bg-[#FAF7EE] text-[#A8823B] border border-[#DEC89B]/50',
    },
    {
      title: pillar3Title,
      desc: pillar3Desc,
      icon: Droplets,
      iconBg: 'bg-[#FAF7EE] text-[#A8823B] border border-[#DEC89B]/50',
    },
    {
      title: pillar4Title,
      desc: pillar4Desc,
      icon: Sun,
      iconBg: 'bg-[#FDEAF0] text-[#B83F60]',
    },
  ];

  return (
    <section className="py-12 sm:py-16 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Story Intro with Scroll Reveal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 space-y-5"
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A8823B]">
              <Sparkles className="w-3.5 h-3.5 text-[#C29E57]" />
              {storyTagline}
            </div>

            <h2 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#2C2420] text-balance leading-tight">
              {storyHeading}
            </h2>

            <p className="text-sm sm:text-base text-[#6B5D55] leading-relaxed">
              {p1}
            </p>

            <p className="text-sm sm:text-base text-[#6B5D55] leading-relaxed">
              {p2}
            </p>

            <div className="pt-2">
              <button
                onClick={onGoToCatalogue}
                className="px-6 py-3 bg-[#B83F60] hover:bg-[#A33452] text-white text-xs font-semibold rounded-xl shadow-xs transition-all hover:shadow-md cursor-pointer active:scale-98"
              >
                Browse Our Signature Bedsheets
              </button>
            </div>
          </motion.div>

          {/* Visual Showcase Card with Staggered Pillars */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 bg-[#F4EFE6] rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] space-y-6"
          >
            <h3 className="font-serif-luxury text-2xl font-semibold text-[#2C2420]">
              The Four Pillars of Cotton Nest
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pillars.map((pillar, idx) => {
                const IconComponent = pillar.icon;
                return (
                  <motion.div
                    key={pillar.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15 + idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE2D5] space-y-2 hover:border-[#C29E57]/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pillar.iconBg}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[#2C2420] uppercase tracking-wide">
                      {pillar.title}
                    </h4>
                    <p className="text-xs text-[#6B5D55] leading-relaxed">
                      {pillar.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>

          </motion.div>

        </div>

        {/* The Pure Cotton Difference: Visual Comparison Strip with Scroll Animation */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE2D5] shadow-xs space-y-6"
        >
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-[11px] font-semibold text-[#A8823B] uppercase tracking-wider">
              Material Transparency
            </span>
            <h3 className="font-serif-luxury text-2xl sm:text-3xl font-semibold text-[#2C2420]">
              The 100% Pure Cotton Difference
            </h3>
            <p className="text-xs text-[#6B5D55]">
              Why we strictly say no to synthetic microfiber and cheap polyester blends.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Cotton Nest Pure Cotton */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="p-5 sm:p-6 bg-[#FAF7F2] rounded-2xl border-2 border-[#DEC89B] space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-[#FDEAF0] text-[#B83F60] text-xs font-bold rounded-full">
                  Cotton Nest Pure Cotton
                </span>
                <span className="text-xs font-semibold text-[#3E7D5A] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> 100% Natural
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-[#2C2420]">
                <li className="flex items-start gap-2">
                  <span className="text-[#3E7D5A] font-bold">✓</span>
                  <span><strong>Natural Long-Staple Fibers:</strong> Breathable weave circulates cool air throughout the night.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3E7D5A] font-bold">✓</span>
                  <span><strong>Deep 108×108 King Cut:</strong> Stays securely tucked under 8-12 inch orthopaedic mattresses.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3E7D5A] font-bold">✓</span>
                  <span><strong>Softens Over Time:</strong> Pure cotton yarns bloom and soften with every wash cycle.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3E7D5A] font-bold">✓</span>
                  <span><strong>Zero Microplastics:</strong> Gentle on sensitive skin and allergen-free for peaceful sleep.</span>
                </li>
              </ul>
            </motion.div>

            {/* Conventional Microfiber */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="p-5 sm:p-6 bg-[#F8F8F8] rounded-2xl border border-gray-200 space-y-4 opacity-80"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                  Conventional Microfiber
                </span>
                <span className="text-xs font-medium text-gray-500">
                  Synthetic Polyester
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <span><strong>Traps Body Heat:</strong> Synthetic plastic fibers cause sweaty, uncomfortable wakeups.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <span><strong>Skimpy Dimensions:</strong> Shallow 90×100 sizing untucks easily when turning in bed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <span><strong>Static Cling &amp; Pilling:</strong> Forms rough bobbles and loses softness after 2-3 washes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <span><strong>Chemical Treatments:</strong> Petroleum-derived plastic weave can irritate sensitive skin.</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Washing & Longevity FAQ with Scroll Reveal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="pt-8 border-t border-[#EAE2D5]"
        >
          <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
            <h3 className="font-serif-luxury text-2xl font-semibold text-[#2C2420]">
              Caring for Your Cotton Nest Sheets
            </h3>
            <p className="text-xs text-[#7A6458]">
              Simple instructions to ensure your bedsheets stay soft for years.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="p-4 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] space-y-1.5"
            >
              <p className="font-semibold text-[#2C2420] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#3E7D5A]" /> First Wash Tip
              </p>
              <p className="text-[#6B5D55]">
                Wash separately in cold water on gentle cycle before first use to set the cotton fibers and unlock maximum softness.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="p-4 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] space-y-1.5"
            >
              <p className="font-semibold text-[#2C2420] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#3E7D5A]" /> Detergent &amp; Bleach
              </p>
              <p className="text-[#6B5D55]">
                Use mild liquid laundry detergent. Never use harsh chemical chlorine bleach to preserve the soft pink and muted gold tones.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-4 bg-[#F4EFE6] rounded-xl border border-[#EAE2D5] space-y-1.5"
            >
              <p className="font-semibold text-[#2C2420] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#3E7D5A]" /> Line Dry in Shade
              </p>
              <p className="text-[#6B5D55]">
                Drying in soft breeze or shade protects the cotton natural elasticity. Warm iron for that crisp 5-star hotel look.
              </p>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};
