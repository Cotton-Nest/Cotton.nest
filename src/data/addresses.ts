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
}

export const SAVED_ADDRESSES_STORAGE_KEY = 'cotton_nest_saved_addresses';

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
 * Retrieves saved addresses from localStorage, automatically merging profile address
 * and previous orders if the address book is empty.
 */
export function getSavedAddresses(
  profile?: CustomerProfile | null,
  orders?: Order[]
): SavedAddress[] {
  const list: SavedAddress[] = [];
  const seenAddresses = new Set<string>();

  // 1. Load custom saved addresses from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAVED_ADDRESSES_STORAGE_KEY);
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
                });
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error reading saved addresses:', err);
  }

  // 2. If profile address exists and not in list, seed as default profile address
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
      });
    }
  }

  // 3. If list is still empty, seed default Sector 46 Gurgaon atelier address
  if (list.length === 0) {
    list.push({
      id: 'addr_default_sec46',
      label: 'Home / Studio',
      name: sanitizeName(profile?.name || 'Cotton Nest'),
      phone: profile?.phone || '+91 7838625915',
      addressLine: 'House Number 2508, Ground Floor, Sector 46',
      city: 'Gurgaon, Haryana',
      pincode: '122003',
      isDefault: true,
      createdAt: Date.now() - 200000,
    });
  }

  // 4. Optionally seed from recent orders (up to 2 recent distinct addresses)
  if (orders && orders.length > 0) {
    orders.forEach((ord) => {
      if (ord.customerAddress && ord.customerAddress.trim()) {
        const parsed = parseAddressString(ord.customerAddress);
        const norm = parsed.addressLine.toLowerCase().trim();
        if (norm && !seenAddresses.has(norm) && list.length < 5) {
          seenAddresses.add(norm);
          list.push({
            id: `addr_order_${ord.id}`,
            label: 'Previous Order',
            name: sanitizeName(ord.customerName || profile?.name || 'Cotton Nest'),
            phone: ord.customerPhone || profile?.phone || '',
            addressLine: parsed.addressLine,
            city: parsed.city,
            pincode: parsed.pincode,
            isDefault: false,
            createdAt: typeof ord.createdAt === 'number' ? ord.createdAt : Date.now(),
          });
        }
      }
    });
  }

  return list;
}

/**
 * Saves a new address or updates an existing address in the saved address book.
 */
export function saveAddressToBook(newAddr: {
  id?: string;
  label?: string;
  name: string;
  phone: string;
  addressLine: string;
  city?: string;
  pincode?: string;
  isDefault?: boolean;
}): SavedAddress[] {
  const current = getSavedAddresses();
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
  };

  if (isDefault) {
    filteredList.forEach((item) => {
      item.isDefault = false;
    });
  }

  filteredList.unshift(entry);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(filteredList));
    }
  } catch (err) {
    console.warn('Error saving address to localStorage:', err);
  }

  return filteredList;
}

/**
 * Removes an address from the saved address book.
 */
export function deleteSavedAddress(id: string): SavedAddress[] {
  const current = getSavedAddresses();
  const updated = current.filter((a) => a.id !== id);

  // Ensure at least one default if list is not empty
  if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
    updated[0].isDefault = true;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error deleting address from localStorage:', err);
  }

  return updated;
}

/**
 * Sets a specific address as default.
 */
export function setDefaultAddress(id: string): SavedAddress[] {
  const current = getSavedAddresses();
  const updated = current.map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error setting default address:', err);
  }

  return updated;
}
