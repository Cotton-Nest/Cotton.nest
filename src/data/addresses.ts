import { CustomerProfile } from './wishlist';
import { Order } from './orders';

export interface SavedAddress {
  id: string;
  label: string; // 'Home' | 'Work' | 'Other' | 'Profile'
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
  createdAt: number;
  userId?: string;
}

export const SAVED_ADDRESSES_STORAGE_KEY = 'cotton_nest_saved_addresses';

export function getUserAddressStorageKey(userIdentifier?: string | null): string {
  if (!userIdentifier || !userIdentifier.trim()) {
    return `${SAVED_ADDRESSES_STORAGE_KEY}_guest`;
  }
  const clean = userIdentifier.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${SAVED_ADDRESSES_STORAGE_KEY}_user_${clean}`;
}

export function formatFullAddress(addr: {
  addressLine: string;
  city?: string;
  pincode?: string;
}): string {
  const parts: string[] = [];
  if (addr.addressLine && addr.addressLine.trim()) {
    parts.push(addr.addressLine.trim());
  }
  if (addr.city && addr.city.trim()) {
    parts.push(addr.city.trim());
  }
  let str = parts.join(', ');
  if (addr.pincode && addr.pincode.trim()) {
    str += str ? ` – ${addr.pincode.trim()}` : addr.pincode.trim();
  }
  return str;
}

export function parseAddressString(raw: string): { addressLine: string; city: string; pincode: string } {
  const clean = raw.trim();
  if (!clean) return { addressLine: '', city: 'Gurgaon, Haryana', pincode: '122003' };

  // Check if pincode is at end e.g. "..., Gurgaon - 122003" or "..., 122003"
  const pinMatch = clean.match(/(?:–|-|\s)\s*(\d{6})$/);
  const pincode = pinMatch ? pinMatch[1] : '122003';
  let withoutPin = pinMatch ? clean.slice(0, pinMatch.index).trim() : clean;
  withoutPin = withoutPin.replace(/,\s*$/, '').trim();

  // Try extracting city
  const cityMatch = withoutPin.match(/,\s*([^,]+)$/);
  const city = cityMatch ? cityMatch[1].trim() : 'Gurgaon, Haryana';
  const addressLine = cityMatch ? withoutPin.slice(0, cityMatch.index).trim() : withoutPin;

  return {
    addressLine: addressLine || clean,
    city: city || 'Gurgaon, Haryana',
    pincode,
  };
}

function sanitizeName(n?: string): string {
  if (!n) return 'Cotton Nest';
  const lower = n.toLowerCase();
  if (lower.includes('aditya') || lower.includes('adityaa')) {
    return 'Cotton Nest';
  }
  return n;
}

/**
 * Retrieves saved addresses strictly scoped to an individual customer.
 * Previous orders from other customers are NEVER seeded or included.
 */
export function getSavedAddresses(
  profile?: CustomerProfile | null,
  userIdentifierOrOrders?: string | Order[] | null,
  userIdentifier?: string | null
): SavedAddress[] {
  const list: SavedAddress[] = [];
  const seenAddresses = new Set<string>();

  // Determine user identifier for storage isolation
  const resolvedUserKey =
    typeof userIdentifier === 'string' && userIdentifier.trim()
      ? userIdentifier.trim()
      : typeof userIdentifierOrOrders === 'string' && userIdentifierOrOrders.trim()
      ? userIdentifierOrOrders.trim()
      : profile?.email || profile?.id || profile?.phone || null;

  const storageKey = getUserAddressStorageKey(resolvedUserKey);

  // 1. Load custom saved addresses from the customer's isolated localStorage partition
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.id && item.addressLine) {
              const normalized = item.addressLine.toLowerCase().trim();
              if (!seenAddresses.has(normalized)) {
                seenAddresses.add(normalized);
                list.push({
                  id: String(item.id),
                  label: item.label || 'Home',
                  name: sanitizeName(item.name || profile?.name || 'Cotton Nest'),
                  phone: item.phone || profile?.phone || '',
                  addressLine: item.addressLine.trim(),
                  city: item.city?.trim() || 'Gurgaon, Haryana',
                  pincode: item.pincode?.trim() || '122003',
                  isDefault: Boolean(item.isDefault),
                  createdAt: Number(item.createdAt) || Date.now(),
                  userId: resolvedUserKey || undefined,
                });
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error reading customer saved addresses:', err);
  }

  // 2. If profile address exists for this specific individual customer and not in list, seed it
  if (profile && profile.address && profile.address.trim()) {
    const norm = profile.address.toLowerCase().trim();
    if (!seenAddresses.has(norm)) {
      seenAddresses.add(norm);
      list.unshift({
        id: 'addr_profile_primary',
        label: 'Home',
        name: sanitizeName(profile.name || 'Cotton Nest'),
        phone: profile.phone || '',
        addressLine: profile.address.trim(),
        city: profile.city?.trim() || 'Gurgaon, Haryana',
        pincode: profile.pincode?.trim() || '122003',
        isDefault: list.length === 0,
        createdAt: Date.now() - 100000,
        userId: resolvedUserKey || undefined,
      });
    }
  }

  // NOTE: Previous store orders are NEVER merged into saved addresses,
  // guaranteeing that one customer's addresses are never visible to another.
  return list;
}

/**
 * Saves a new address or updates an existing address in the individual customer's address book.
 */
export function saveAddressToBook(
  newAddr: {
    id?: string;
    label?: string;
    name: string;
    phone: string;
    addressLine: string;
    city?: string;
    pincode?: string;
    isDefault?: boolean;
    userId?: string;
  },
  userIdentifier?: string | null
): SavedAddress[] {
  const resolvedUserKey = userIdentifier || newAddr.userId || null;
  const current = getSavedAddresses(null, resolvedUserKey);
  const addressLine = newAddr.addressLine.trim();
  if (!addressLine) return current;

  const id = newAddr.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const label = newAddr.label?.trim() || 'Home';
  const city = newAddr.city?.trim() || 'Gurgaon, Haryana';
  const pincode = newAddr.pincode?.trim() || '122003';
  const isDefault = Boolean(newAddr.isDefault);

  const updatedList: SavedAddress[] = current.map((item) => ({
    ...item,
    isDefault: isDefault ? false : item.isDefault,
  }));

  // Ensure strict uniqueness: remove any existing address with the same normalized addressLine or id
  const filteredList = updatedList.filter(
    (item) =>
      item.id !== id &&
      item.addressLine.toLowerCase().trim() !== addressLine.toLowerCase()
  );

  const entry: SavedAddress = {
    id,
    label,
    name: sanitizeName(newAddr.name.trim() || 'Cotton Nest'),
    phone: newAddr.phone.trim() || '',
    addressLine,
    city,
    pincode,
    isDefault: isDefault || filteredList.length === 0,
    createdAt: Date.now(),
    userId: resolvedUserKey || undefined,
  };

  if (isDefault) {
    filteredList.forEach((item) => {
      item.isDefault = false;
    });
  }

  filteredList.unshift(entry);

  const storageKey = getUserAddressStorageKey(resolvedUserKey);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(filteredList));
    }
  } catch (err) {
    console.warn('Error saving address to localStorage:', err);
  }

  return filteredList;
}

/**
 * Removes an address from the customer's saved address book.
 */
export function deleteSavedAddress(id: string, userIdentifier?: string | null): SavedAddress[] {
  const current = getSavedAddresses(null, userIdentifier);
  const updated = current.filter((a) => a.id !== id);

  if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
    updated[0].isDefault = true;
  }

  const storageKey = getUserAddressStorageKey(userIdentifier);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error deleting address from localStorage:', err);
  }

  return updated;
}

/**
 * Sets a specific address as default for the customer.
 */
export function setDefaultAddress(id: string, userIdentifier?: string | null): SavedAddress[] {
  const current = getSavedAddresses(null, userIdentifier);
  const updated = current.map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));

  const storageKey = getUserAddressStorageKey(userIdentifier);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error setting default address:', err);
  }

  return updated;
}
