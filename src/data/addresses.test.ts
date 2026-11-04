import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFullAddress,
  parseAddressString,
  getSavedAddresses,
  saveAddressToBook,
  SavedAddress,
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

test('getSavedAddresses returns fallback Sector 46 studio if localStorage and profile are empty', () => {
  // Clear any mock localStorage if environment has it
  const addresses = getSavedAddresses(null);
  assert.ok(addresses.length > 0);
  assert.ok(addresses[0].addressLine.includes('Sector 46'));
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
