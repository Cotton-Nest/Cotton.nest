import { useCallback, useEffect, useRef, useState } from 'react';
import {
  lookupIndianPincode,
  PincodeAreaOption,
  PincodeLookupResult,
  sanitizePincodeInput,
} from '../services/pincodeLookup';

export interface AutoFillLocationPayload {
  pincode: string;
  state: string;
  city: string;
  areaName?: string;
}

export interface UsePincodeLookupOptions {
  pincode: string;
  onAutoFill: (payload: AutoFillLocationPayload) => void;
}

export interface UsePincodeLookupReturn {
  cleanPincode: string;
  isLoading: boolean;
  error: string | null;
  errorType?: 'invalid_format' | 'not_found' | 'network';
  lookupResult: PincodeLookupResult | null;
  areas: PincodeAreaOption[];
  selectedAreaIndex: string;
  isStateReadOnly: boolean;
  hasMultipleAreas: boolean;
  hasAmbiguousDistrict: boolean;
  hasAmbiguousState: boolean;
  selectArea: (indexStr: string) => void;
  retryLookup: () => void;
  resetLookupState: () => void;
}

export function usePincodeLookup({
  pincode,
  onAutoFill,
}: UsePincodeLookupOptions): UsePincodeLookupReturn {
  const cleanPincode = sanitizePincodeInput(pincode);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'invalid_format' | 'not_found' | 'network' | undefined>(undefined);
  const [lookupResult, setLookupResult] = useState<PincodeLookupResult | null>(null);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<string>('');
  const [isStateReadOnly, setIsStateReadOnly] = useState(false);

  const onAutoFillRef = useRef(onAutoFill);
  onAutoFillRef.current = onAutoFill;

  const lastTriggeredPinRef = useRef<string>('');
  const activeRequestPinRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const wasAutoFilledRef = useRef<boolean>(false);

  const runLookup = useCallback(async (targetPin: string, bypassCache = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeRequestPinRef.current = targetPin;
    lastTriggeredPinRef.current = targetPin;

    setIsLoading(true);
    setError(null);
    setErrorType(undefined);
    setSelectedAreaIndex('');

    try {
      const result = await lookupIndianPincode(targetPin, {
        signal: controller.signal,
        bypassCache,
      });

      if (controller.signal.aborted || activeRequestPinRef.current !== targetPin) {
        return;
      }

      setLookupResult(result);

      if (result.found) {
        const shouldLockState = !result.hasAmbiguousState && Boolean(result.state);
        setIsStateReadOnly(shouldLockState);
        setError(null);
        setErrorType(undefined);
        wasAutoFilledRef.current = true;

        onAutoFillRef.current({
          pincode: targetPin,
          state: result.state,
          city: result.city,
        });
      } else {
        setIsStateReadOnly(false);
        setError(result.error || 'Could not find location for this PIN code. Please enter State & City manually.');
        setErrorType(result.errorType);
        if (wasAutoFilledRef.current) {
          wasAutoFilledRef.current = false;
          onAutoFillRef.current({
            pincode: targetPin,
            state: '',
            city: '',
          });
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if (activeRequestPinRef.current !== targetPin) return;
      setIsStateReadOnly(false);
      setError('Unable to verify PIN code right now. Please enter State & City manually.');
      setErrorType('network');
      if (wasAutoFilledRef.current) {
        wasAutoFilledRef.current = false;
        onAutoFillRef.current({
          pincode: targetPin,
          state: '',
          city: '',
        });
      }
    } finally {
      if (!controller.signal.aborted && activeRequestPinRef.current === targetPin) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (cleanPincode.length < 6) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (wasAutoFilledRef.current) {
        wasAutoFilledRef.current = false;
        onAutoFillRef.current({
          pincode: cleanPincode,
          state: '',
          city: '',
        });
      }
      lastTriggeredPinRef.current = '';
      activeRequestPinRef.current = '';
      setIsLoading(false);
      setError(null);
      setErrorType(undefined);
      setLookupResult(null);
      setSelectedAreaIndex('');
      setIsStateReadOnly(false);
      return;
    }

    if (cleanPincode === lastTriggeredPinRef.current) {
      return;
    }

    void runLookup(cleanPincode, false);
  }, [cleanPincode, runLookup]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const selectArea = useCallback(
    (indexStr: string) => {
      setSelectedAreaIndex(indexStr);
      if (!lookupResult || !lookupResult.found) return;
      const idx = Number(indexStr);
      if (!Number.isInteger(idx) || idx < 0 || idx >= lookupResult.areas.length) return;
      const area = lookupResult.areas[idx];
      if (!area) return;

      if (area.state) {
        setIsStateReadOnly(true);
      }

      onAutoFillRef.current({
        pincode: lookupResult.pincode,
        state: area.state || lookupResult.state,
        city: area.district || lookupResult.city,
        areaName: area.name,
      });
    },
    [lookupResult]
  );

  const retryLookup = useCallback(() => {
    if (cleanPincode.length === 6) {
      void runLookup(cleanPincode, true);
    }
  }, [cleanPincode, runLookup]);

  const resetLookupState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    lastTriggeredPinRef.current = '';
    activeRequestPinRef.current = '';
    setIsLoading(false);
    setError(null);
    setErrorType(undefined);
    setLookupResult(null);
    setSelectedAreaIndex('');
    setIsStateReadOnly(false);
  }, []);

  return {
    cleanPincode,
    isLoading,
    error,
    errorType,
    lookupResult,
    areas: lookupResult?.areas || [],
    selectedAreaIndex,
    isStateReadOnly,
    hasMultipleAreas: Boolean(lookupResult?.hasMultipleAreas),
    hasAmbiguousDistrict: Boolean(lookupResult?.hasAmbiguousDistrict),
    hasAmbiguousState: Boolean(lookupResult?.hasAmbiguousState),
    selectArea,
    retryLookup,
    resetLookupState,
  };
}
