import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFullAddress,
  parseAddressString,
  getSavedAddresses,
  saveAddressToBook,
  getUserAddressStorageKey,
} from './addresses';

test('formatFullAddress combines addressLine, city and pincode cleanly', () => {
  const result = formatFullAddress({
    addressLine: 'Flat 402, Magnolia Towers, Sector 46',
    city: 'Gurgaon, Haryana',
    pincode: '122003',
  });
  assert.equal(result, 'Flat 402, Magnolia Towers, Sector 46, Gurgaon, Haryana – 122003');
});

test('formatFullAddress handles missing city or pincode gracefully', () => {
  const result = formatFullAddress({
    addressLine: 'Sector 46, Gurgaon',
  });
  assert.equal(result, 'Sector 46, Gurgaon');
});

test('parseAddressString extracts pincode and city from standard Indian address format', () => {
  const parsed = parseAddressString('Flat 204, Orchid Island, Sector 51, Gurgaon – 122018');
  assert.equal(parsed.pincode, '122018');
  assert.equal(parsed.city, 'Gurgaon');
  assert.equal(parsed.addressLine, 'Flat 204, Orchid Island, Sector 51');
});

test('getSavedAddresses returns empty list if no addresses saved for a customer', () => {
  const addresses = getSavedAddresses(null, 'brand_new_customer_test@gmail.com');
  assert.equal(addresses.length, 0);
});

test('getSavedAddresses incorporates customerProfile address when provided', () => {
  const profile = {
    id: 'cust_123',
    name: 'Ananya Sharma',
    phone: '+91 9876543210',
    address: 'Villa 12, Nirvana Country, Sector 50',
    city: 'Gurgaon, Haryana',
    pincode: '122018',
  };
  const list = getSavedAddresses(profile);
  const found = list.find((a) => a.addressLine.includes('Nirvana Country'));
  assert.ok(found, 'Profile address should be present in saved addresses list');
  assert.equal(found?.name, 'Ananya Sharma');
});

test('getUserAddressStorageKey properly isolates customer partitions', () => {
  const key1 = getUserAddressStorageKey('userA@gmail.com');
  const key2 = getUserAddressStorageKey('userB@gmail.com');
  assert.notEqual(key1, key2);
  assert.ok(key1.includes('usera_gmail_com'));
  assert.ok(key2.includes('userb_gmail_com'));
});

test('formatFullAddress formats separate city and state cleanly without duplication', () => {
  const withSeparateState = formatFullAddress({
    addressLine: 'B-402, Sea Breeze Apartments, Worli',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400018',
  });
  assert.equal(withSeparateState, 'B-402, Sea Breeze Apartments, Worli, Mumbai, Maharashtra – 400018');

  const withoutDuplicateState = formatFullAddress({
    addressLine: 'Flat 12, DLF Phase 2',
    city: 'Gurgaon, Haryana',
    state: 'Haryana',
    pincode: '122002',
  });
  assert.equal(withoutDuplicateState, 'Flat 12, DLF Phase 2, Gurgaon, Haryana – 122002');
});

