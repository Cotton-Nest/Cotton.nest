export interface WishlistItem {
  id: string; // Unique ID, e.g. `${customerId}_${productId}`
  customerId: string; // Unique ID (authenticated email/phone or persistent guest ID)
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  productPrice: number;
  productOriginalPrice: number;
  productImage: string;
  productDimensions?: string;
  collection?: string;
  threadCount?: string;
  fabric?: string;
  selectedVariantId?: string;
  selectedVariantName?: string;
  note?: string;
  createdAt: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  pincode?: string;
  isGuest?: boolean;
}

const CUSTOMER_PROFILE_KEY = 'cotton_nest_customer_profile';
const WISHLIST_LOCAL_KEY = 'cotton_nest_local_wishlist';

/**
 * Retrieves the current customer profile from localStorage or generates an initial guest profile.
 */
const PROTECTED_ADMIN_EMAILS = [
  'adityaa.451485@gmail.com',
  'adityaa.22082011@gmail.com',
  'cottonnest.atelier@gmail.com',
];

export function getCurrentCustomerProfile(): CustomerProfile {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        const cleanEmail = (parsed.email || '').trim().toLowerCase();
        if (cleanEmail && PROTECTED_ADMIN_EMAILS.includes(cleanEmail)) {
          // Purge any cached admin email from customer profile storage
          const sanitizedGuest: CustomerProfile = {
            id: 'guest_' + Math.random().toString(36).substring(2, 10),
            name: 'Atelier Guest',
            isGuest: true,
          };
          localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(sanitizedGuest));
          return sanitizedGuest;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading customer profile from localStorage:', err);
  }

  // Generate anonymous guest customer profile
  const guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
  const guestProfile: CustomerProfile = {
    id: guestId,
    name: 'Atelier Guest',
    isGuest: true,
  };

  try {
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(guestProfile));
  } catch {}

  return guestProfile;
}

/**
 * Saves or updates customer profile in localStorage.
 */
export function saveCurrentCustomerProfile(profile: Partial<CustomerProfile> & { name: string }): CustomerProfile {
  const current = getCurrentCustomerProfile();
  const updated: CustomerProfile = {
    ...current,
    ...profile,
    id: profile.id || current.id,
    isGuest: !profile.email && !profile.phone,
  };

  try {
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving customer profile to localStorage:', err);
  }

  return updated;
}

/**
 * Local cache of wishlisted items for fast optimistic UI.
 */
export function getLocalWishlist(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(WISHLIST_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

export function saveLocalWishlist(items: WishlistItem[]): void {
  try {
    localStorage.setItem(WISHLIST_LOCAL_KEY, JSON.stringify(items));
  } catch {}
}
