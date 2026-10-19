export interface QualityAspects {
  fabricSoftness?: number; // 1-5
  fitAndDrop?: number;     // 1-5
  colorAccuracy?: number;  // 1-5
}

export interface ProductReview {
  id: string;
  productId: string;        // 'gulabi-bagh-rose' or 'all'
  productName: string;      // Name of the bedsheet
  customerName: string;     // e.g. "Pooja Sharma"
  customerCity: string;     // e.g. "Sector 57, Gurgaon"
  rating: number;           // 1 - 5 stars
  title: string;            // e.g. "Genuinely 108x108 inches, didn't shrink after wash"
  comment: string;          // Detailed feedback
  verifiedPurchase: boolean;// Verified buyer badge
  recommended: boolean;     // "I recommend this product"
  createdAt: number;        // Epoch timestamp
  helpfulCount?: number;
  qualityAspects?: QualityAspects;
}

export type Review = ProductReview;

export const INITIAL_REVIEWS: ProductReview[] = [
  {
    id: "rev-1",
    productId: "gulabi-bagh-rose",
    productName: "Nandini (Gulabi Bagh English Rose)",
    customerName: "Dr. Ananya Mukherjee",
    customerCity: "DLF Phase 4, Gurgaon",
    rating: 5,
    title: "Pure cotton breathability & genuine 108×108 inch King size drop",
    comment: "I visited their Sector 46 atelier in Gurgaon before buying. Most brands claim King size but give 90x100 which pulls out of a 10-inch mattress. This bedsheet has a huge, generous tuck-in on all four sides. The rose block prints are subtle and soothing, not garish at all. Machine washed twice, zero shrinkage or color bleeding.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    helpfulCount: 14,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-2",
    productId: "mint-meadow-sage",
    productName: "Nandini (Pastel Sage Mint Rose)",
    customerName: "Radhika Singhania",
    customerCity: "Nirvana Country, Sector 50, Gurgaon",
    rating: 5,
    title: "Subtle vintage elegance, makes bedroom look like a boutique hotel",
    comment: "The sage mint color is so calming. What impressed me the most is the zero-polyester natural feel. In Gurgaon summers you can immediately tell pure cotton from poly-cotton blends. This stays cool all night. The matching pillow shams with piped borders look very luxurious.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
    helpfulCount: 9,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-3",
    productId: "petals-print-marigold",
    productName: "The Petals Print Golden Sprig",
    customerName: "Vikram Malhotra",
    customerCity: "Vasant Kunj, New Delhi",
    rating: 5,
    title: "Crisp percale weave with cheerful golden marigold accents",
    comment: "Ordered via WhatsApp after founder shared unboxing video. Delivery was prompt. The fabric has that crisp, crisp luxury hotel bed feeling and softens up beautifully upon wash. Pillow covers have secure flap tucks so the pillows don't slide out.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 9 * 24 * 60 * 60 * 1000,
    helpfulCount: 11,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-4",
    productId: "milky-white-poppy",
    productName: "Milky White (Poppy Meadow & Grid)",
    customerName: "Meenakshi Sundaram",
    customerCity: "Indiranagar, Bengaluru",
    rating: 5,
    title: "Organic botanical aesthetic with checkered pillow shams",
    comment: "The contrast between the warm milky white poppy field and the sage green checkered pillow covers is perfection. It gives a cottagecore, artisanal Indian feel without being overwhelming. Delivered all the way to Bengaluru in pristine box packaging.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    helpfulCount: 8,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-5",
    productId: "shivaura-trellis-slate",
    productName: "The Petals (Shivaura Chevron Trellis)",
    customerName: "Siddharth & Neha Verma",
    customerCity: "Golf Course Extension Road, Gurgaon",
    rating: 5,
    title: "Heavyweight combed cotton that stays wrinkle-free on the bed",
    comment: "This bedsheet has great weight to it. The chevron trellis pattern with subtle golden linework looks very modern. Slept on it for a week and it barely creased. Will definitely pick up 2 more sets for our guest rooms.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    helpfulCount: 16,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-6",
    productId: "peacock-teal-paisley",
    productName: "Batik (Royal Paisley Peacock Teal)",
    customerName: "Kavita Rathi",
    customerCity: "Bandra West, Mumbai",
    rating: 5,
    title: "Artisanal Sanganeri block print with deep, fade-resistant teal",
    comment: "I was looking for authentic Rajasthani block print style without scratchy starch or color bleed. Hand washed the first time with salt water as suggested - absolutely zero color bleeding! The indigo-teal shade is rich and majestic.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 18 * 24 * 60 * 60 * 1000,
    helpfulCount: 7,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-7",
    productId: "amber-orchid-medallion",
    productName: "Heritage (Centerpiece Orchid Medallion)",
    customerName: "Preeti Agarwal",
    customerCity: "Sector 46, Gurgaon",
    rating: 5,
    title: "Bought locally in Sector 46 - centerpiece looks stunning on king bed",
    comment: "Living right in Sector 46, I walked into their house atelier. The owner was extremely courteous and let me unfold the sheets to check the weave. The central floral motif lands right in the middle of our 6.5x6.5 bed. Incredible value at ₹1000.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000,
    helpfulCount: 12,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-8",
    productId: "rosemary-blue-rose-100x108",
    productName: "Rosemary Royal Blue Rose",
    customerName: "Tarun Chawla",
    customerCity: "South Extension, New Delhi",
    rating: 5,
    title: "Vibrant royal cobalt blue, gingham pillow covers are a treat",
    comment: "The blue rose print against crisp white gives such a fresh, clean look to the bedroom. The pillow shams with gingham checks are super stylish. 100% natural cotton that feels cool against the skin.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    helpfulCount: 6,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  },
  {
    id: "rev-9",
    productId: "ivory-garland-wreath",
    productName: "Nandini (Ivory Garland Wreath)",
    customerName: "Shalini Bansal",
    customerCity: "Civil Lines, Jaipur",
    rating: 5,
    title: "Authentic garland symmetry, soothing natural cream tone",
    comment: "Hailing from Jaipur, I am very picky about bedsheet fabric quality. Cotton Nest has nailed the combed cotton texture. The antique pink and soft apricot blossoms create such a tranquil atmosphere in the room.",
    verifiedPurchase: true,
    recommended: true,
    createdAt: Date.now() - 28 * 24 * 60 * 60 * 1000,
    helpfulCount: 10,
    qualityAspects: {
      fabricSoftness: 5,
      fitAndDrop: 5,
      colorAccuracy: 5
    }
  }
];

export function getProductRatingSummary(productId: string, reviews: ProductReview[]) {
  const productReviews = reviews.filter((r) => r.productId === productId || r.productId === 'all');
  if (productReviews.length === 0) {
    return {
      average: 4.9,
      count: 12,
      reviews: []
    };
  }
  const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
  const average = Number((sum / productReviews.length).toFixed(1));
  return {
    average,
    count: productReviews.length,
    reviews: productReviews
  };
}

export function getOverallRatingSummary(reviews: ProductReview[]) {
  if (!reviews || reviews.length === 0) {
    return {
      average: 4.9,
      totalCount: INITIAL_REVIEWS.length,
      fiveStarCount: INITIAL_REVIEWS.filter(r => r.rating === 5).length,
      recommendationPercent: 99
    };
  }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = Number((sum / reviews.length).toFixed(1));
  const fiveStars = reviews.filter(r => r.rating === 5).length;
  const recommended = reviews.filter(r => r.recommended).length;
  const recommendationPercent = Math.round((recommended / reviews.length) * 100);

  return {
    average,
    totalCount: reviews.length,
    fiveStarCount: fiveStars,
    recommendationPercent
  };
}
