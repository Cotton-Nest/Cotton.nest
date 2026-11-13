import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPincodeCache,
  isValidIndianPincodeFormat,
  lookupIndianPincode,
  parseIndiaPostPayload,
  sanitizePincodeInput,
} from './pincodeLookup';

test('sanitizePincodeInput strips non-digits and caps at 6 digits', () => {
  assert.equal(sanitizePincodeInput('122-003abc'), '122003');
  assert.equal(sanitizePincodeInput('123456789'), '123456');
  assert.equal(sanitizePincodeInput('11 00 01'), '110001');
});

test('isValidIndianPincodeFormat validates standard 6-digit Indian PIN codes', () => {
  assert.equal(isValidIndianPincodeFormat('122003'), true);
  assert.equal(isValidIndianPincodeFormat('110001'), true);
  assert.equal(isValidIndianPincodeFormat('012345'), false);
  assert.equal(isValidIndianPincodeFormat('12200'), false);
  assert.equal(isValidIndianPincodeFormat('12200a'), false);
});

test('parseIndiaPostPayload resolves single-district multi-area PIN cleanly (e.g. 122003)', () => {
  const result = parseIndiaPostPayload('122003', [
    {
      Status: 'Success',
      PostOffice: [
        { Name: 'Gurgaon Sector 45', District: 'Gurgaon', State: 'Haryana', Block: 'Sector -45' },
        { Name: 'Wazirabad', District: 'Gurgaon', State: 'Haryana', Block: 'NA' },
        { Name: 'Jharsa', District: 'Gurgaon', State: 'Haryana', Block: 'NA' },
      ],
    },
  ]);

  assert.equal(result.found, true);
  assert.equal(result.state, 'Haryana');
  assert.equal(result.city, 'Gurgaon');
  assert.equal(result.hasMultipleAreas, true);
  assert.equal(result.hasAmbiguousDistrict, false);
  assert.equal(result.hasAmbiguousState, false);
  assert.equal(result.areas.length, 3);
});

test('parseIndiaPostPayload avoids picking an incorrect district when a PIN spans multiple districts (e.g. 400001)', () => {
  const result = parseIndiaPostPayload('400001', [
    {
      Status: 'Success',
      PostOffice: [
        { Name: 'Bazargate', District: 'Mumbai', State: 'Maharashtra', Block: 'Mumbai' },
        { Name: 'Elephanta Caves Po', District: 'Raigarh(MH)', State: 'Maharashtra', Block: 'Uran' },
      ],
    },
  ]);

  assert.equal(result.found, true);
  assert.equal(result.state, 'Maharashtra');
  assert.equal(result.city, '');
  assert.equal(result.hasMultipleAreas, true);
  assert.equal(result.hasAmbiguousDistrict, true);
  assert.equal(result.hasAmbiguousState, false);
  assert.deepEqual(result.uniqueDistricts, ['Mumbai', 'Raigarh(MH)']);
});

test('parseIndiaPostPayload avoids guessing state when border PIN spans multiple states', () => {
  const result = parseIndiaPostPayload('123456', [
    {
      Status: 'Success',
      PostOffice: [
        { Name: 'Area A', District: 'District A', State: 'State A' },
        { Name: 'Area B', District: 'District B', State: 'State B' },
      ],
    },
  ]);

  assert.equal(result.found, true);
  assert.equal(result.state, '');
  assert.equal(result.city, '');
  assert.equal(result.hasAmbiguousState, true);
  assert.equal(result.hasAmbiguousDistrict, true);
});

test('lookupIndianPincode returns friendly validation error for PIN starting with 0 without calling fetch', async () => {
  clearPincodeCache();
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('Should not be called');
  }) as typeof fetch;

  try {
    const res = await lookupIndianPincode('000000');
    assert.equal(res.found, false);
    assert.equal(res.errorType, 'invalid_format');
    assert.ok(res.error && res.error.length > 10);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('lookupIndianPincode caches successful results and avoids repeated API calls', async () => {
  clearPincodeCache();
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify([
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Gurgaon South City II', District: 'Gurgaon', State: 'Haryana', Block: 'NA' },
          ],
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const first = await lookupIndianPincode('122018');
    const second = await lookupIndianPincode('122018');

    assert.equal(first.found, true);
    assert.equal(first.state, 'Haryana');
    assert.equal(first.city, 'Gurgaon');
    assert.equal(second.found, true);
    assert.equal(second.source, 'cache');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearPincodeCache();
  }
});

test('lookupIndianPincode returns friendly error when PIN is not found or network fails', async () => {
  clearPincodeCache();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([{ Status: 'Error', Message: 'No records found', PostOffice: null }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  try {
    const notFound = await lookupIndianPincode('999999');
    assert.equal(notFound.found, false);
    assert.equal(notFound.errorType, 'not_found');
    assert.ok(notFound.error?.includes('999999'));

    clearPincodeCache();
    globalThis.fetch = (async () => {
      throw new Error('Network offline');
    }) as typeof fetch;

    const netErr = await lookupIndianPincode('560001');
    assert.equal(netErr.found, false);
    assert.equal(netErr.errorType, 'network');
    assert.ok(netErr.error && netErr.error.toLowerCase().includes('manually'));
  } finally {
    globalThis.fetch = originalFetch;
    clearPincodeCache();
  }
});
