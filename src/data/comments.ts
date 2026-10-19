export interface CommentReply {
  author: string;
  role: string;
  text: string;
  date: number;
}

export interface CommentItem {
  id: string;
  authorName: string;
  authorCity: string;
  authorRole?: string; // e.g. "Verified Buyer", "Interior Designer", "Gurgaon Resident"
  avatar?: string;
  content: string;
  productId?: string;  // specific bedsheet id or 'general'
  productName?: string;
  category: 'general' | 'question' | 'styling' | 'care' | 'order';
  createdAt: number;
  likesCount: number;
  reply?: CommentReply;
}

export const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: "cmt-1",
    authorName: "Pooja Varma",
    authorCity: "DLF Phase 5, Gurgaon",
    authorRole: "Verified Buyer",
    content: "Does the genuine 108×108 inch King size tuck securely under a 12-inch high pocket-spring mattress? Most market sheets slip out.",
    productId: "gulabi-bagh-rose",
    productName: "Nandini (Gulabi Bagh English Rose)",
    category: "question",
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    likesCount: 14,
    reply: {
      author: "Cotton Nest Atelier",
      role: "Founder & Textile Specialist",
      text: "Hello Pooja! Yes, absolutely. Our 108×108 inch (274×274 cm) true square drop leaves 12 to 14 inches of extra fabric on all 4 sides, ensuring a deep, tight tuck-in under even 12-14 inch heavy spring mattresses without coming undone.",
      date: Date.now() - 1 * 24 * 60 * 60 * 1000
    }
  },
  {
    id: "cmt-2",
    authorName: "Gaurav & Megha Chhabra",
    authorCity: "Sector 57, Gurgaon",
    authorRole: "Atelier Visitor",
    content: "Stopped by their Sector 46 atelier yesterday afternoon to feel the swatches in person. You can immediately feel the weight and zero-polyester natural cool touch. Picked up the Pastel Sage Mint and Lavender Garland on the spot!",
    productId: "mint-meadow-sage",
    productName: "Nandini (Pastel Sage Mint Rose)",
    category: "styling",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    likesCount: 19
  },
  {
    id: "cmt-3",
    authorName: "Shreya Iyer",
    authorCity: "Vasant Vihar, New Delhi",
    authorRole: "Architect & Stylist",
    content: "The botanical floral print on Nandini Rose is so understated and refined. It pairs wonderfully with warm teak wood and off-white linen curtains. Are you planning matching king-size duvet covers or quilts soon?",
    productId: "gulabi-bagh-rose",
    productName: "Nandini (Gulabi Bagh English Rose)",
    category: "styling",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    likesCount: 11,
    reply: {
      author: "Cotton Nest Atelier",
      role: "Design Studio",
      text: "Thank you Shreya! Matching reversible pure cotton dohar quilts and duvet covers in the Gulabi Bagh Rose and Sage Mint motifs are in craft sampling right now. We'll announce on WhatsApp once ready!",
      date: Date.now() - 4 * 24 * 60 * 60 * 1000
    }
  },
  {
    id: "cmt-4",
    authorName: "Dr. Tarun Sachdeva",
    authorCity: "Nirvana Country, Sector 50, Gurgaon",
    authorRole: "Verified Buyer",
    content: "How should we wash these for the first time? Any special detergent recommended to maintain the crispness?",
    productId: "general",
    productName: "All 100% Cotton Bedsheets",
    category: "care",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    likesCount: 8,
    reply: {
      author: "Cotton Nest Atelier",
      role: "Care Team",
      text: "Machine wash cold (30°C) with standard liquid detergent. Do not bleach or dry-clean. Hang dry in shade. The pure cotton fibers soften up beautifully with every wash!",
      date: Date.now() - 6 * 24 * 60 * 60 * 1000
    }
  },
  {
    id: "cmt-5",
    authorName: "Ritu & Vikram Malhotra",
    authorCity: "Golf Course Extension Road, Gurgaon",
    authorRole: "Verified Buyer",
    content: "Ordered at 11 AM via WhatsApp and it was hand-delivered to our high-rise apartment in Sector 65 by 3 PM! Outstanding same-day Gurgaon service, and the box packaging was so neat.",
    productId: "petals-print-marigold",
    productName: "The Petals Print Golden Sprig",
    category: "order",
    createdAt: Date.now() - 9 * 24 * 60 * 60 * 1000,
    likesCount: 15
  },
  {
    id: "cmt-6",
    authorName: "Kavita Ramaswamy",
    authorCity: "Indiranagar, Bengaluru",
    authorRole: "Online Buyer",
    content: "Can we order directly for delivery to Bangalore or South India? How many days does courier take?",
    productId: "general",
    productName: "All 100% Cotton Bedsheets",
    category: "order",
    createdAt: Date.now() - 11 * 24 * 60 * 60 * 1000,
    likesCount: 6,
    reply: {
      author: "Cotton Nest Atelier",
      role: "Dispatch Desk",
      text: "Yes Kavita! We ship pan-India via express air couriers (BlueDart / Delhivery) for just ₹100 flat. Bangalore delivery takes 3 to 4 business days with live tracking provided.",
      date: Date.now() - 10 * 24 * 60 * 60 * 1000
    }
  }
];

export const COMMENTS_STORAGE_KEY = 'cotton_nest_comments';

export function getLocalComments(): CommentItem[] {
  try {
    const saved = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_COMMENTS;
}

export function saveLocalComments(comments: CommentItem[]): void {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
  } catch (err) {
    console.warn('Failed to save comments locally:', err);
  }
}
