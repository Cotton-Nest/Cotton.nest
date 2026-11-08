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
 * Retrieves saved addresses strictly scoped to the current user.
 * Filters out any hardcoded studio placeholder addresses and ensures a default address is marked.
 */
export function getSavedAddresses(
  profile?: CustomerProfile | null,
  userIdentifierOrOrders?: string | Order[] | null,
  userIdentifier?: string | null
): SavedAddress[] {
  const list: SavedAddress[] = [];
  const seenAddresses = new Set<string>();

  const resolvedUserKey =
    typeof userIdentifier === 'string' && userIdentifier.trim()
      ? userIdentifier.trim()
      : typeof userIdentifierOrOrders === 'string' && userIdentifierOrOrders.trim()
      ? userIdentifierOrOrders.trim()
      : profile?.email || profile?.id || profile?.phone || null;

  const primaryStorageKey = getUserAddressStorageKey(resolvedUserKey);

  // Check primary key first; also check guest/legacy keys on this device so addresses saved before sign-in aren't lost
  const candidateKeys = [
    primaryStorageKey,
    `${SAVED_ADDRESSES_STORAGE_KEY}_guest`,
    SAVED_ADDRESSES_STORAGE_KEY,
  ];
  if (profile?.id) {
    candidateKeys.push(getUserAddressStorageKey(profile.id));
  }
  if (profile?.email) {
    candidateKeys.push(getUserAddressStorageKey(profile.email));
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
                const normalized = item.addressLine.toLowerCase().trim();
                if (!seenAddresses.has(normalized)) {
                  seenAddresses.add(normalized);
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
        } catch {
          // ignore malformed entry
        }
      }
    }
  } catch (err) {
    console.warn('Error reading customer saved addresses:', err);
  }

  // If the user explicitly saved a custom profile address (not the studio placeholder), include it
  if (
    profile &&
    profile.address &&
    profile.address.trim() &&
    !isStudioPlaceholderAddress(profile.address)
  ) {
    const norm = profile.address.toLowerCase().trim();
    if (!seenAddresses.has(norm)) {
      seenAddresses.add(norm);
      list.unshift({
        id: 'addr_profile_primary',
        label: 'Home',
        name:
          profile.name && profile.name !== 'Atelier Guest'
            ? profile.name
            : 'Customer',
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

  // Ensure exactly one default address is marked when saved addresses exist
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
      localStorage.setItem(`${SAVED_ADDRESSES_STORAGE_KEY}_guest`, serialized);
      localStorage.setItem(SAVED_ADDRESSES_STORAGE_KEY, serialized);
    }
  } catch (err) {
    console.warn('Error saving address book to localStorage:', err);
  }
}

/**
 * Saves a new address or updates an existing address in the customer's address book.
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
    name: newAddr.name.trim() || 'Customer',
    phone: newAddr.phone.trim() || '',
    addressLine,
    city,
    pincode,
    isDefault: isDefault || filteredList.length === 0,
    createdAt: Date.now(),
    userId: resolvedUserKey || undefined,
  };

  if (entry.isDefault) {
    filteredList.forEach((item) => {
      item.isDefault = false;
    });
  }

  filteredList.unshift(entry);
  persistAddressesToStorage(filteredList, resolvedUserKey);

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

  persistAddressesToStorage(updated, userIdentifier);

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

  persistAddressesToStorage(updated, userIdentifier);

  return updated;
}
