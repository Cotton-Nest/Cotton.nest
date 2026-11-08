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
  let line = (addr.addressLine || '').trim();
  const city = (addr.city || 'Gurgaon, Haryana').trim();
  const pincode = (addr.pincode || '122003').trim();

  // Clean trailing repeated city/pincode if present in addressLine
  line = line.replace(/,\s*Gurgaon,\s*Haryana\s*–\s*122003/gi, '').trim();

  if (pincode && line.includes(pincode)) {
    return line;
  }
  if (city && line.toLowerCase().includes(city.toLowerCase())) {
    if (pincode && !line.includes(pincode)) {
      return `${line} – ${pincode}`;
    }
    return line;
  }

  const parts = [line];
  if (city) parts.push(city);
  let str = parts.join(', ');
  if (pincode) {
    str += ` – ${pincode}`;
  }
  return str;
}

export function parseAddressString(raw: string): { addressLine: string; city: string; pincode: string } {
  const clean = raw.trim();
  if (!clean) return { addressLine: '', city: 'Gurgaon, Haryana', pincode: '122003' };

  const pinMatch = clean.match(/(?:–|-|\s)\s*(\d{6})$/);
  const pincode = pinMatch ? pinMatch[1] : '122003';
  let withoutPin = pinMatch ? clean.slice(0, pinMatch.index).trim() : clean;
  withoutPin = withoutPin.replace(/,\s*$/, '').trim();

  const cityMatch = withoutPin.match(/,\s*([^,]+)$/);
  const city = cityMatch ? cityMatch[1].trim() : 'Gurgaon, Haryana';
  const addressLine = cityMatch ? withoutPin.slice(0, cityMatch.index).trim() : withoutPin;

  return {
    addressLine: addressLine || clean,
    city: city || 'Gurgaon, Haryana',
    pincode,
  };
}

function isStudioPlaceholderAddress(addressLine?: string): boolean {
  if (!addressLine) return true;
  const norm = addressLine.toLowerCase().trim();
  return (
    norm === 'house number 2508 ground floor, sector 46' ||
    norm === 'house 2508, ground floor, sector 46' ||
    norm === 'house no. 2508, ground floor, sector 46'
  );
}

/**
 * Retrieves saved addresses strictly scoped to the current user, with strict deduplication.
 */
export function getSavedAddresses(
  profile?: CustomerProfile | null,
  userIdentifierOrOrders?: string | Order[] | null,
  userIdentifier?: string | null
): SavedAddress[] {
  const list: SavedAddress[] = [];
  const seenNormAddresses = new Set<string>();

  const resolvedUserKey =
    typeof userIdentifier === 'string' && userIdentifier.trim()
      ? userIdentifier.trim()
      : typeof userIdentifierOrOrders === 'string' && userIdentifierOrOrders.trim()
      ? userIdentifierOrOrders.trim()
      : profile?.email || profile?.id || profile?.phone || null;

  const primaryStorageKey = getUserAddressStorageKey(resolvedUserKey);
  const candidateKeys = [primaryStorageKey];
  if (!resolvedUserKey || resolvedUserKey.startsWith('guest_')) {
    candidateKeys.push(`${SAVED_ADDRESSES_STORAGE_KEY}_guest`);
  }

  const uniqueKeys = Array.from(new Set(candidateKeys));

  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of uniqueKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (
                item &&
                item.id &&
                typeof item.addressLine === 'string' &&
                item.addressLine.trim() &&
                !isStudioPlaceholderAddress(item.addressLine)
              ) {
                const cleanLine = item.addressLine.replace(/,\s*Gurgaon,\s*Haryana\s*–\s*122003/gi, '').trim();
                const cleanCity = item.city?.trim() || 'Gurgaon, Haryana';
                const cleanPin = item.pincode?.trim() || '122003';
                const normKey = `${cleanLine.toLowerCase().replace(/\s+/g, ' ')}_${cleanCity.toLowerCase()}_${cleanPin}`;

                if (!seenNormAddresses.has(normKey)) {
                  seenNormAddresses.add(normKey);
                  const cleanName =
                    item.name && item.name.trim() && item.name.trim() !== 'Cotton Nest' && item.name.trim() !== 'Atelier Guest'
                      ? item.name.trim()
                      : profile?.name && profile.name !== 'Atelier Guest'
                      ? profile.name
                      : item.name?.trim() || 'Customer';

                  list.push({
                    id: String(item.id),
                    label: item.label || 'Home',
                    name: cleanName,
                    phone: item.phone || profile?.phone || '',
                    addressLine: cleanLine,
                    city: cleanCity,
                    pincode: cleanPin,
                    isDefault: Boolean(item.isDefault),
                    createdAt: Number(item.createdAt) || Date.now(),
                    userId: resolvedUserKey || undefined,
                  });
                }
              }
            });
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('Error reading saved addresses:', err);
  }

  // Persist cleaned deduplicated list back to storage so duplicates are permanently removed
  if (resolvedUserKey && list.length > 0) {
    try {
      localStorage.setItem(primaryStorageKey, JSON.stringify(list));
    } catch {}
  }

  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list[0].isDefault = true;
  }

  return list;
}

function persistAddressesToStorage(list: SavedAddress[], resolvedUserKey?: string | null) {
  const primaryKey = getUserAddressStorageKey(resolvedUserKey);
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(list);
      localStorage.setItem(primaryKey, serialized);
      if (!resolvedUserKey || resolvedUserKey.startsWith('guest_')) {
        localStorage.setItem(`${SAVED_ADDRESSES_STORAGE_KEY}_guest`, serialized);
      }
    }
  } catch (err) {
    console.warn('Error saving address book to localStorage:', err);
  }
}

/**
 * Saves a new address or updates an existing address in the customer's address book with strict duplicate prevention.
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
  const addressLine = (newAddr.addressLine || '').replace(/,\s*Gurgaon,\s*Haryana\s*–\s*122003/gi, '').trim();
  if (!addressLine) return current;

  const city = newAddr.city?.trim() || 'Gurgaon, Haryana';
  const pincode = newAddr.pincode?.trim() || '122003';
  const isDefault = Boolean(newAddr.isDefault);

  // Normalize address fields (trim spaces and handle case differences) before comparison
  const normAddressLine = addressLine.toLowerCase().replace(/\s+/g, ' ').trim();
  const normCity = city.toLowerCase().replace(/\s+/g, ' ').trim();
  const normPincode = pincode.trim();

  // Check if identical address already exists for that user's UID / identifier
  const existingIndex = current.findIndex((item) => {
    const itemLine = item.addressLine.toLowerCase().replace(/\s+/g, ' ').trim();
    const itemCity = (item.city || 'Gurgaon, Haryana').toLowerCase().replace(/\s+/g, ' ').trim();
    const itemPin = (item.pincode || '122003').trim();
    return itemLine === normAddressLine && itemCity === normCity && itemPin === normPincode;
  });

  if (existingIndex !== -1) {
    // Reuse existing record instead of creating a duplicate
    const existing = current[existingIndex];
    const updatedList = current.map((item, idx) => ({
      ...item,
      name: newAddr.name?.trim() ? newAddr.name.trim() : item.name,
      phone: newAddr.phone?.trim() ? newAddr.phone.trim() : item.phone,
      label: newAddr.label?.trim() ? newAddr.label.trim() : item.label,
      isDefault: isDefault ? idx === existingIndex : item.isDefault,
    }));
    persistAddressesToStorage(updatedList, resolvedUserKey);
    return updatedList;
  }

  const id = newAddr.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const label = newAddr.label?.trim() || 'Home';
  const name = newAddr.name.trim() || 'Customer';
  const phone = newAddr.phone.trim() || '';

  const updatedList: SavedAddress[] = current.map((item) => ({
    ...item,
    isDefault: isDefault ? false : item.isDefault,
  }));

  const entry: SavedAddress = {
    id,
    label,
    name,
    phone,
    addressLine,
    city,
    pincode,
    isDefault: isDefault || updatedList.length === 0,
    createdAt: Date.now(),
    userId: resolvedUserKey || undefined,
  };

  if (entry.isDefault) {
    updatedList.forEach((item) => {
      item.isDefault = false;
    });
  }

  updatedList.unshift(entry);
  persistAddressesToStorage(updatedList, resolvedUserKey);

  return updatedList;
}

export function deleteSavedAddress(id: string, userIdentifier?: string | null): SavedAddress[] {
  const current = getSavedAddresses(null, userIdentifier);
  const updated = current.filter((a) => a.id !== id);

  if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
    updated[0].isDefault = true;
  }

  persistAddressesToStorage(updated, userIdentifier);

  return updated;
}

export function setDefaultAddress(id: string, userIdentifier?: string | null): SavedAddress[] {
  const current = getSavedAddresses(null, userIdentifier);
  const updated = current.map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));

  persistAddressesToStorage(updated, userIdentifier);

  return updated;
}
