import React, { useId } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, MapPin, RefreshCw } from 'lucide-react';
import { usePincodeLookup } from '../hooks/usePincodeLookup';
import { INDIAN_STATES_AND_UTS, sanitizePincodeInput } from '../services/pincodeLookup';

export interface PincodeAddressFieldsProps {
  pincode: string;
  city: string;
  state: string;
  onPincodeChange: (cleanPin: string) => void;
  onCityChange: (city: string) => void;
  onStateChange: (state: string) => void;
  onAutoFillLocation: (updates: { pincode: string; city: string; state: string; areaName?: string }) => void;
  compact?: boolean;
  required?: boolean;
}

export const PincodeAddressFields: React.FC<PincodeAddressFieldsProps> = ({
  pincode,
  city,
  state,
  onPincodeChange,
  onCityChange,
  onStateChange,
  onAutoFillLocation,
  compact = false,
  required = true,
}) => {
  const datalistId = useId();

  const {
    cleanPincode,
    isLoading,
    error,
    errorType,
    lookupResult,
    areas,
    selectedAreaIndex,
    isStateReadOnly,
    hasMultipleAreas,
    hasAmbiguousDistrict,
    hasAmbiguousState,
    selectArea,
    retryLookup,
  } = usePincodeLookup({
    pincode,
    onAutoFill: ({ pincode: resolvedPin, city: resolvedCity, state: resolvedState, areaName }) => {
      onAutoFillLocation({
        pincode: resolvedPin,
        city: resolvedCity,
        state: resolvedState,
        areaName,
      });
    },
  });

  const inputPadding = compact ? 'px-2.5 py-1.5 rounded-lg' : 'px-3 py-2 rounded-xl';
  const isVerified = Boolean(lookupResult?.found && !error && !isLoading);

  return (
    <div className="space-y-2">
      {/* Row 1: 6-Digit PIN Code Input + Status Feedback */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-semibold text-[#7A6458]">
            PIN Code {required ? '*' : ''}
          </label>
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8C2E46]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Detecting location...</span>
            </span>
          )}
          {!isLoading && isVerified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              <span>Location detected</span>
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="Enter 6-digit PIN (e.g. 122003)"
            value={pincode}
            onChange={(e) => onPincodeChange(sanitizePincodeInput(e.target.value))}
            required={required}
            className={`w-full ${inputPadding} pr-9 bg-white border text-xs text-[#2C2420] focus:outline-none transition-colors ${
              error
                ? 'border-rose-300 focus:border-rose-500'
                : isVerified
                ? 'border-emerald-300 focus:border-[#C29E57]'
                : 'border-[#EAE2D5] focus:border-[#C29E57]'
            }`}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-[#8C2E46] animate-spin" />
            ) : isVerified ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : error ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-[#B8A89A]" />
            )}
          </div>
        </div>

        {cleanPincode.length > 0 && cleanPincode.length < 6 && (
          <p className="mt-1 text-[10px] text-[#7A6458]">
            Enter all 6 digits to auto-detect State &amp; City ({cleanPincode.length}/6)
          </p>
        )}

        {error && (
          <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
            {errorType === 'network' && (
              <button
                type="button"
                onClick={retryLookup}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8C2E46] hover:underline shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Multi-area / Multi-district disambiguation dropdown when multiple Post Offices match */}
      {isVerified && hasMultipleAreas && areas.length > 1 && (
        <div
          className={`p-2 rounded-xl border text-xs space-y-1 ${
            hasAmbiguousDistrict || hasAmbiguousState
              ? 'bg-amber-50/90 border-amber-300'
              : 'bg-white/80 border-[#EAE2D5]'
          }`}
        >
          <label className="block text-[10px] font-semibold text-[#5C4C42]">
            {hasAmbiguousDistrict || hasAmbiguousState
              ? `Multiple areas/districts match PIN ${cleanPincode} — select your locality:`
              : `Locality / Post Office (${areas.length} areas under PIN ${cleanPincode} · optional):`}
          </label>
          <select
            value={selectedAreaIndex}
            onChange={(e) => selectArea(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#EAE2D5] rounded-lg text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57] cursor-pointer"
          >
            <option value="">
              {hasAmbiguousDistrict || hasAmbiguousState
                ? '-- Choose exact locality / district --'
                : '-- Select your locality / post office (optional) --'}
            </option>
            {areas.map((area, idx) => (
              <option key={`${area.name}-${area.district}-${idx}`} value={String(idx)}>
                {area.name}
                {area.district && area.district.toLowerCase() !== area.name.toLowerCase()
                  ? ` — ${area.district}`
                  : ''}
                {hasAmbiguousState && area.state ? `, ${area.state}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row 2: City / District (editable) + State (read-only when auto-detected, editable if lookup fails) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-[#7A6458] mb-1">
            City / District {required ? '*' : ''}
          </label>
          <input
            type="text"
            placeholder={hasAmbiguousDistrict ? 'Select area or type city' : 'e.g. Gurgaon / Mumbai'}
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            required={required}
            className={`w-full ${inputPadding} bg-white border border-[#EAE2D5] text-xs text-[#2C2420] focus:outline-none focus:border-[#C29E57]`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] font-semibold text-[#7A6458]">
              State {required ? '*' : ''}
            </label>
            {isStateReadOnly ? (
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                <Lock className="w-2.5 h-2.5" />
                <span>Auto-detected</span>
              </span>
            ) : error ? (
              <span className="text-[9.5px] font-medium text-[#8C2E46]">Manual entry</span>
            ) : null}
          </div>
          <input
            type="text"
            list={!isStateReadOnly ? datalistId : undefined}
            readOnly={isStateReadOnly}
            aria-readonly={isStateReadOnly}
            title={
              isStateReadOnly
                ? 'State is automatically detected from your 6-digit PIN code. Change PIN code to update.'
                : 'Enter State name'
            }
            placeholder={isStateReadOnly ? 'Auto-detected from PIN' : 'Enter or choose State'}
            value={state}
            onChange={(e) => {
              if (!isStateReadOnly) {
                onStateChange(e.target.value);
              }
            }}
            required={required}
            className={`w-full ${inputPadding} border text-xs focus:outline-none transition-colors ${
              isStateReadOnly
                ? 'bg-[#F6F2EA] border-[#DEC89B] text-[#4A3B32] font-medium cursor-not-allowed'
                : 'bg-white border-[#EAE2D5] text-[#2C2420] focus:border-[#C29E57]'
            }`}
          />
          {!isStateReadOnly && (
            <datalist id={datalistId}>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st} />
              ))}
            </datalist>
          )}
        </div>
      </div>
    </div>
  );
};
