export interface SeasonalItemDiscount {
  productId: string;
  discountPercentage?: number; // e.g. 25 for 25% off
  discountPrice?: number; // e.g. 1099
  customBadge?: string; // e.g. "Festive Deal", "Limited Stock", "Bestseller"
}

export interface SeasonalConfig {
  enabled: boolean;
  name: string; // e.g. "Diwali Fest", "Summer Sale", "Monsoon Festive Collection"
  badge: string; // e.g. "Festive Special", "Limited Edition", "Special Offer"
  tagline: string; // e.g. "Exclusive Festive Savings - Pure 100% Combed Cotton Bedsheets"
  description: string; // promotional description
  bannerNotice?: string; // e.g. "✨ Special Festive Pricing Active · Free 2-Hour Delivery in Gurgaon"
  discountLabel?: string; // e.g. "Up to 35% OFF"
  items: SeasonalItemDiscount[]; // list of bedsheets included with discounts
  updatedAt?: number;
}

export const INITIAL_SEASONAL_CONFIG: SeasonalConfig = {
  enabled: true,
  name: "Diwali Fest",
  badge: "Festive Exclusive",
  tagline: "Exclusive Festive Savings - 100% Pure Combed Cotton King Bedsheets",
  description: "Celebrate the season of joy with our handcrafted natural cotton bedsheets. Each festive set includes 1 King bedsheet (108″×108″) and 2 coordinating pillow covers (45×70 cm) at special celebratory prices.",
  bannerNotice: "✨ Festive Season Offer: Special Discounted Rates & Free Express Delivery in Gurgaon",
  discountLabel: "Up to 35% OFF",
  items: [
    {
      productId: "amber-orchid-medallion",
      discountPrice: 850,
      discountPercentage: 15,
      customBadge: "Festive Bestseller",
    },
    {
      productId: "bedsheet-mvg72tgo",
      discountPrice: 999,
      discountPercentage: 20,
      customBadge: "Special Offer",
    },
    {
      productId: "gulabi-bagh-rose",
      discountPrice: 1050,
      discountPercentage: 20,
      customBadge: "Festive Pick",
    },
    {
      productId: "milky-white-poppy",
      discountPrice: 950,
      discountPercentage: 21,
      customBadge: "Pure White Special",
    },
    {
      productId: "rosemary-blue-rose-100x108",
      discountPrice: 899,
      discountPercentage: 18,
      customBadge: "Festive Classic",
    },
  ],
  updatedAt: Date.now(),
};
