export interface PincodeAreaOption {
  name: string;
  district: string;
  state: string;
  block?: string;
  branchType?: string;
  deliveryStatus?: string;
}

export interface PincodeLookupResult {
  found: boolean;
  pincode: string;
  state: string;
  city: string;
  areas: PincodeAreaOption[];
  uniqueStates: string[];
  uniqueDistricts: string[];
  hasMultipleAreas: boolean;
  hasAmbiguousDistrict: boolean;
  hasAmbiguousState: boolean;
  error?: string;
  errorType?: 'invalid_format' | 'not_found' | 'network';
  source: 'api' | 'cache' | 'validation';
}

export const INDIAN_STATES_AND_UTS: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const SESSION_CACHE_KEY = 'cn_pincode_lookup_cache_v1';
const LOOKUP_TIMEOUT_MS = 7000;

const memoryCache = new Map<string, PincodeLookupResult>();
const inFlightRequests = new Map<string, Promise<PincodeLookupResult>>();

export function sanitizePincodeInput(raw: string): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 6);
}

export function isValidIndianPincodeFormat(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode.trim());
}

function cleanPostalField(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (upper === 'NA' || upper === 'N/A' || upper === 'NULL') return '';
  return trimmed;
}

interface RawIndiaPostOffice {
  Name?: unknown;
  BranchType?: unknown;
  DeliveryStatus?: unknown;
  District?: unknown;
  Division?: unknown;
  Region?: unknown;
  Block?: unknown;
  State?: unknown;
}

interface RawIndiaPostResponseItem {
  Status?: unknown;
  Message?: unknown;
  PostOffice?: unknown;
}

export function parseIndiaPostPayload(pincode: string, payload: unknown): PincodeLookupResult {
  const firstItem: RawIndiaPostResponseItem | undefined = Array.isArray(payload)
    ? (payload[0] as RawIndiaPostResponseItem | undefined)
    : undefined;

  const status = typeof firstItem?.Status === 'string' ? firstItem.Status.trim().toLowerCase() : '';
  const rawOffices = Array.isArray(firstItem?.PostOffice)
    ? (firstItem.PostOffice as RawIndiaPostOffice[])
    : [];

  if (status !== 'success' || rawOffices.length === 0) {
    return {
      found: false,
      pincode,
      state: '',
      city: '',
      areas: [],
      uniqueStates: [],
      uniqueDistricts: [],
      hasMultipleAreas: false,
      hasAmbiguousDistrict: false,
      hasAmbiguousState: false,
      error: `PIN code ${pincode} was not found. Please check the digits or enter State & City manually.`,
      errorType: 'not_found',
      source: 'api',
    };
  }

  const areas: PincodeAreaOption[] = [];
  const seenAreaKeys = new Set<string>();
  const uniqueStates: string[] = [];
  const seenStates = new Set<string>();
  const uniqueDistricts: string[] = [];
  const seenDistricts = new Set<string>();

  for (const po of rawOffices) {
    if (!po || typeof po !== 'object') continue;
    const state = cleanPostalField(po.State);
    const block = cleanPostalField(po.Block);
    const district =
      cleanPostalField(po.District) ||
      block ||
      cleanPostalField(po.Division) ||
      cleanPostalField(po.Region);
    const name = cleanPostalField(po.Name) || district || block;

    if (!state && !district && !name) continue;

    if (state) {
      const stateKey = state.toLowerCase();
      if (!seenStates.has(stateKey)) {
        seenStates.add(stateKey);
        uniqueStates.push(state);
      }
    }

    if (district) {
      const districtKey = district.toLowerCase();
      if (!seenDistricts.has(districtKey)) {
        seenDistricts.add(districtKey);
        uniqueDistricts.push(district);
      }
    }

    const areaKey = `${name.toLowerCase()}|${district.toLowerCase()}|${state.toLowerCase()}`;
    if (!seenAreaKeys.has(areaKey)) {
      seenAreaKeys.add(areaKey);
      areas.push({
        name,
        district,
        state,
        block: block || undefined,
        branchType: cleanPostalField(po.BranchType) || undefined,
        deliveryStatus: cleanPostalField(po.DeliveryStatus) || undefined,
      });
    }
  }

  if (areas.length === 0 || (uniqueStates.length === 0 && uniqueDistricts.length === 0)) {
    return {
      found: false,
      pincode,
      state: '',
      city: '',
      areas: [],
      uniqueStates: [],
      uniqueDistricts: [],
      hasMultipleAreas: false,
      hasAmbiguousDistrict: false,
      hasAmbiguousState: false,
      error: `Location details for PIN code ${pincode} are unavailable. Please enter State & City manually.`,
      errorType: 'not_found',
      source: 'api',
    };
  }

  const hasMultipleAreas = areas.length > 1;
  const hasAmbiguousState = uniqueStates.length > 1;
  const hasAmbiguousDistrict = uniqueDistricts.length > 1;

  // Never guess a wrong location when multiple states or multiple districts match the PIN.
  const resolvedState = !hasAmbiguousState && uniqueStates.length === 1 ? uniqueStates[0] : '';
  const resolvedCity = !hasAmbiguousDistrict && uniqueDistricts.length === 1 ? uniqueDistricts[0] : '';

  return {
    found: true,
    pincode,
    state: resolvedState,
    city: resolvedCity,
    areas,
    uniqueStates,
    uniqueDistricts,
    hasMultipleAreas,
    hasAmbiguousDistrict,
    hasAmbiguousState,
    source: 'api',
  };
}

function readSessionCache(pincode: string): PincodeLookupResult | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, PincodeLookupResult>;
    const hit = parsed?.[pincode];
    if (hit && hit.found && hit.pincode === pincode) {
      return { ...hit, source: 'cache' };
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return null;
}

function writeSessionCache(pincode: string, result: PincodeLookupResult): void {
  if (!result.found) return;
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    const parsed: Record<string, PincodeLookupResult> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(parsed);
    if (keys.length > 40) {
      delete parsed[keys[0]];
    }
    parsed[pincode] = { ...result, source: 'cache' };
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore quota/storage errors
  }
}

export function clearPincodeCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
    }
  } catch {
    // Ignore
  }
}

export async function lookupIndianPincode(
  rawPincode: string,
  options?: { signal?: AbortSignal; bypassCache?: boolean }
): Promise<PincodeLookupResult> {
  const pincode = sanitizePincodeInput(rawPincode);

  if (!isValidIndianPincodeFormat(pincode)) {
    return {
      found: false,
      pincode,
      state: '',
      city: '',
      areas: [],
      uniqueStates: [],
      uniqueDistricts: [],
      hasMultipleAreas: false,
      hasAmbiguousDistrict: false,
      hasAmbiguousState: false,
      error:
        pincode.length === 6
          ? 'Please enter a valid 6-digit Indian PIN code (cannot start with 0).'
          : 'Please enter a complete 6-digit PIN code.',
      errorType: 'invalid_format',
      source: 'validation',
    };
  }

  if (!options?.bypassCache) {
    const memHit = memoryCache.get(pincode);
    if (memHit) {
      return { ...memHit, source: 'cache' };
    }
    const sessionHit = readSessionCache(pincode);
    if (sessionHit) {
      memoryCache.set(pincode, sessionHit);
      return sessionHit;
    }
  }

  const existingInFlight = inFlightRequests.get(pincode);
  if (existingInFlight && !options?.bypassCache) {
    return existingInFlight;
  }

  const fetchPromise = (async (): Promise<PincodeLookupResult> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    const onExternalAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          found: false,
          pincode,
          state: '',
          city: '',
          areas: [],
          uniqueStates: [],
          uniqueDistricts: [],
          hasMultipleAreas: false,
          hasAmbiguousDistrict: false,
          hasAmbiguousState: false,
          error: 'Could not verify PIN code right now. Please enter your State & City manually.',
          errorType: 'network',
          source: 'api',
        };
      }

      const payload = await response.json();
      const parsed = parseIndiaPostPayload(pincode, payload);

      // Cache successful responses and definitive not_found results in memory; only persist valid hits to sessionStorage.
      if (parsed.found) {
        memoryCache.set(pincode, parsed);
        writeSessionCache(pincode, parsed);
      } else if (parsed.errorType === 'not_found') {
        memoryCache.set(pincode, parsed);
      }

      return parsed;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && options?.signal?.aborted) {
        throw err;
      }
      return {
        found: false,
        pincode,
        state: '',
        city: '',
        areas: [],
        uniqueStates: [],
        uniqueDistricts: [],
        hasMultipleAreas: false,
        hasAmbiguousDistrict: false,
        hasAmbiguousState: false,
        error: 'Unable to reach PIN code service. Please enter your State & City manually.',
        errorType: 'network',
        source: 'api',
      };
    } finally {
      clearTimeout(timeoutId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
      inFlightRequests.delete(pincode);
    }
  })();

  inFlightRequests.set(pincode, fetchPromise);
  return fetchPromise;
}
