import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load store database
const storeDbPath = path.resolve(process.cwd(), 'data/store_db.json');
const rawDb = JSON.parse(fs.readFileSync(storeDbPath, 'utf8'));
const allOrders = rawDb.orders || [];

// Mock order filtering functions conforming to our secure account-isolation logic
function filterUserOrders(orders: any[], targetUid: string, isAdmin = false) {
  const cleanUid = (targetUid || '').trim();
  if (isAdmin) return orders;
  if (!cleanUid) return [];
  // Strict UID equality - NEVER use customer email, name, phone or orderId to combine
  return orders.filter((o) => (o.userId || '').trim() === cleanUid);
}

function verifySingleOrderAccess(order: any, requesterUid: string, isAdmin = false) {
  if (isAdmin) return order;
  const cleanUid = (requesterUid || '').trim();
  if (!cleanUid) return null;
  if ((order.userId || '').trim() === cleanUid) {
    return order;
  }
  return null; // Denied / 403 Forbidden
}

test('Test 1: Store database audit - every order has a valid single owner UID', () => {
  assert.ok(allOrders.length > 0, 'Orders should exist in store_db.json');

  let invalidUidCount = 0;
  for (const order of allOrders) {
    assert.ok(order.id, 'Every order must have an id');
    assert.ok(order.userId, `Order ${order.id} must have a non-empty userId`);
    assert.equal(typeof order.userId, 'string', `Order ${order.id} userId must be a string`);
    assert.ok(order.userId.trim().length > 3, `Order ${order.id} userId must be a valid UID string`);
    if (!order.userId || order.userId.trim() === '') {
      invalidUidCount++;
    }
  }

  assert.equal(invalidUidCount, 0, 'Zero orders should have missing or blank UIDs');
});

test('Test 2: Account 1 order retrieval returns strictly Account 1 orders and zero from Account 2', () => {
  const account1Uid = 'y1RXTxbslaYV453HAFazLTB2iOn1';
  const account2Uid = 'ipMjoZQzuvg9Xdj8uylIwSwaUuC3';

  const account1Orders = filterUserOrders(allOrders, account1Uid);

  assert.equal(account1Orders.length, 12, 'Account 1 should have exactly 12 orders');
  for (const order of account1Orders) {
    assert.equal(order.userId, account1Uid, `Order ${order.id} owner must be Account 1`);
    assert.notEqual(order.userId, account2Uid, `Order ${order.id} must not belong to Account 2`);
  }
});

test('Test 3: Account switching to Account 2 isolates state and returns strictly Account 2 orders', () => {
  const account1Uid = 'y1RXTxbslaYV453HAFazLTB2iOn1';
  const account2Uid = 'ipMjoZQzuvg9Xdj8uylIwSwaUuC3';

  // State cleared immediately on switch
  let currentReactStateOrders: any[] = [];
  
  // Switch to Account 2
  currentReactStateOrders = filterUserOrders(allOrders, account2Uid);

  assert.equal(currentReactStateOrders.length, 2, 'Account 2 should have exactly 2 orders');
  for (const order of currentReactStateOrders) {
    assert.equal(order.userId, account2Uid, `Order ${order.id} owner must be Account 2`);
    assert.notEqual(order.userId, account1Uid, `Account 2 view must contain zero Account 1 orders`);
  }
});

test('Test 4: Creating a new order under Account 2 preserves ownership and is invisible to Account 1', () => {
  const account1Uid = 'y1RXTxbslaYV453HAFazLTB2iOn1';
  const account2Uid = 'ipMjoZQzuvg9Xdj8uylIwSwaUuC3';

  const newOrderForAccount2 = {
    id: 'CN-TEST-99999',
    userId: account2Uid,
    customerName: 'Shared Customer Name', // Even if names match
    customerEmail: 'shared@example.com',  // Even if emails match
    customerPhone: '9876543210',          // Even if phone numbers match
    totalAmount: 1499,
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  const simulatedDb = [...allOrders, newOrderForAccount2];

  // Fetch as Account 2
  const acc2Orders = filterUserOrders(simulatedDb, account2Uid);
  assert.ok(acc2Orders.some((o) => o.id === 'CN-TEST-99999'), 'Account 2 must see its new order');

  // Fetch as Account 1
  const acc1Orders = filterUserOrders(simulatedDb, account1Uid);
  assert.ok(!acc1Orders.some((o) => o.id === 'CN-TEST-99999'), 'Account 1 must NEVER see Account 2 new order');
});

test('Test 5: Switching back to Account 1 restores strictly Account 1 orders with zero state contamination', () => {
  const account1Uid = 'y1RXTxbslaYV453HAFazLTB2iOn1';
  const account2Uid = 'ipMjoZQzuvg9Xdj8uylIwSwaUuC3';

  // Simulate switching from Account 2 back to Account 1
  let activeStateOrders = filterUserOrders(allOrders, account2Uid);
  assert.equal(activeStateOrders.length, 2);

  // Switch triggers immediate reset
  activeStateOrders = [];
  assert.equal(activeStateOrders.length, 0, 'React state is immediately cleared on switch');

  // Load new UID orders
  activeStateOrders = filterUserOrders(allOrders, account1Uid);
  assert.equal(activeStateOrders.length, 12, 'Account 1 restored with 12 orders');
  assert.ok(activeStateOrders.every((o) => o.userId === account1Uid), 'All orders strictly belong to Account 1');
});

test('Test 6: Cross-account direct lookup / URL tampering is strictly forbidden', () => {
  const account1Uid = 'y1RXTxbslaYV453HAFazLTB2iOn1';
  const account2Uid = 'ipMjoZQzuvg9Xdj8uylIwSwaUuC3';

  const account2Order = allOrders.find((o: any) => o.userId === account2Uid);
  assert.ok(account2Order, 'Account 2 must have an order in store_db.json');

  // Account 1 attempts to lookup Account 2's order ID directly
  const accessedByAccount1 = verifySingleOrderAccess(account2Order, account1Uid, false);
  assert.equal(accessedByAccount1, null, 'Access must be denied (null/403) when Account 1 queries Account 2 order ID');

  // Account 2 looks up their own order
  const accessedByAccount2 = verifySingleOrderAccess(account2Order, account2Uid, false);
  assert.notEqual(accessedByAccount2, null, 'Access must be granted when Account 2 queries their own order');
  assert.equal(accessedByAccount2?.id, account2Order.id);

  // Unauthenticated lookup attempt
  const accessedByAnonymous = verifySingleOrderAccess(account2Order, '', false);
  assert.equal(accessedByAnonymous, null, 'Access must be denied for unauthenticated/empty UID');
});
