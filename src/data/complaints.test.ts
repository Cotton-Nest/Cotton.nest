import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBase64OrBlobUrl,
  isValidComplaintPhoto,
  extractProductSizeAndVariant,
  verifyOrderOwnership,
  verifyProductMembershipInOrder,
  validateComplaintSubmission,
  applyAdminComplaintUpdate,
} from './complaints.ts';
import { Order } from './orders.ts';
import {
  buildComplaintNotificationForCustomer,
  buildComplaintNotificationForAdmin,
  buildOrderStatusNotification,
} from './notifications.ts';

const SAMPLE_ORDER: Order = {
  id: 'CN-551234',
  createdAt: '2026-03-10T10:00:00.000Z',
  customerName: 'Aarav Sharma',
  customerPhone: '+91 9876543210',
  customerEmail: 'aarav@example.com',
  userId: 'usr_aarav_1',
  customerAddress: 'Sector 46, Gurgaon, Haryana – 122003',
  paymentMethod: 'whatsapp',
  totalAmount: 2790,
  totalSavings: 400,
  status: 'delivered',
  items: [
    {
      productId: 'sheet-jaipuri-1',
      productName: 'Royal Jaipuri Floral - Crimson Gold',
      productImage: '/images/exact_sheet1_pink_rose_1790997736396.jpg',
      dimensions: '108 x 108 inches (King Size)',
      price: 1395,
      quantity: 1,
    },
    {
      productId: 'sheet-linen-2',
      productName: 'Ivory Botanical Breeze - Sage Leaf',
      productImage: '/images/exact_sheet2_white_floral_1790997740050.jpg',
      dimensions: '90 x 100 inches (Queen)',
      price: 1395,
      quantity: 1,
    },
  ],
};

test('rejects base64 and blob URLs and catalogue placeholders for complaint photos', () => {
  assert.equal(isBase64OrBlobUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true);
  assert.equal(isBase64OrBlobUrl('blob:http://localhost:3000/abc-123'), true);
  assert.equal(
    isBase64OrBlobUrl('https://res.cloudinary.com/ys2sgydi/image/upload/v1793/cotton_nest/complaints/cmp1.jpg'),
    false
  );

  const base64Check = isValidComplaintPhoto({
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    publicId: 'cmp_1',
  });
  assert.equal(base64Check.valid, false);

  const catalogueCheck = isValidComplaintPhoto({
    url: '/images/exact_sheet1_pink_rose_1790997736396.jpg',
    publicId: 'catalogue_1',
  });
  assert.equal(catalogueCheck.valid, false);

  const missingPublicIdCheck = isValidComplaintPhoto({
    url: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1/cotton_nest/complaints/defect1.jpg',
    publicId: '',
  });
  assert.equal(missingPublicIdCheck.valid, false);

  const validCloudinaryCheck = isValidComplaintPhoto({
    url: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1/cotton_nest/complaints/defect1.jpg',
    publicId: 'cotton_nest/complaints/defect1',
  });
  assert.equal(validCloudinaryCheck.valid, true);
});

test('extracts product size and variant from OrderItem', () => {
  const meta = extractProductSizeAndVariant(SAMPLE_ORDER.items[0]);
  assert.equal(meta.cleanProductName, 'Royal Jaipuri Floral');
  assert.equal(meta.variantName, 'Crimson Gold');
  assert.equal(meta.size, 'King (108 × 108 in)');
});

test('verifies order ownership and product membership', () => {
  const validOwner = verifyOrderOwnership(SAMPLE_ORDER, {
    orderId: 'CN-551234',
    customerPhone: '9876543210',
  });
  assert.equal(validOwner.valid, true);

  const wrongOwner = verifyOrderOwnership(SAMPLE_ORDER, {
    orderId: 'CN-551234',
    customerPhone: '9999900000',
    customerEmail: 'other@example.com',
  });
  assert.equal(wrongOwner.valid, false);

  const validMember = verifyProductMembershipInOrder(SAMPLE_ORDER, 'sheet-jaipuri-1');
  assert.equal(validMember.valid, true);

  const invalidMember = verifyProductMembershipInOrder(SAMPLE_ORDER, 'sheet-non-existent');
  assert.equal(invalidMember.valid, false);
});

test('validates full complaint submission and supports multiple complaints for different products in one order', () => {
  // Returns are rejected as per Cotton Nest 48-Hour Defect Exchange Policy
  const returnRejectedRes = validateComplaintSubmission(
    {
      orderId: 'CN-551234',
      productId: 'sheet-jaipuri-1',
      requestType: 'Return' as any,
      description: 'Customer requested refund return.',
      photos: [
        {
          url: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1794001/cotton_nest/complaints/defect_hem.jpg',
          publicId: 'cotton_nest/complaints/defect_hem',
        },
      ],
      customerPhone: '9876543210',
    },
    SAMPLE_ORDER
  );
  assert.equal(returnRejectedRes.valid, false);
  assert.ok(returnRejectedRes.error?.includes('Cotton Nest Terms & Conditions'));

  // Missing photos should fail
  const noPhotoRes = validateComplaintSubmission(
    {
      orderId: 'CN-551234',
      productId: 'sheet-jaipuri-1',
      requestType: 'Exchange',
      description: 'Stitching on corner seam came undone on arrival.',
      photos: [],
      customerPhone: '9876543210',
    },
    SAMPLE_ORDER
  );
  assert.equal(noPhotoRes.valid, false);

  // First product complaint (Exchange)
  const firstRes = validateComplaintSubmission(
    {
      orderId: 'CN-551234',
      productId: 'sheet-jaipuri-1',
      requestType: 'Exchange',
      description: 'Received with a small tear along the border hem.',
      photos: [
        {
          url: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1794001/cotton_nest/complaints/defect_hem.jpg',
          publicId: 'cotton_nest/complaints/defect_hem',
        },
      ],
      customerPhone: '9876543210',
    },
    SAMPLE_ORDER
  );
  assert.equal(firstRes.valid, true);
  assert.ok(firstRes.complaint);
  assert.equal(firstRes.complaint.orderId, 'CN-551234');
  assert.equal(firstRes.complaint.productId, 'sheet-jaipuri-1');
  assert.equal(firstRes.complaint.variantName, 'Crimson Gold');
  assert.equal(firstRes.complaint.status, 'New');
  assert.equal(firstRes.complaint.photos[0].orderId, 'CN-551234');
  assert.equal(firstRes.complaint.photos[0].productId, 'sheet-jaipuri-1');

  // Second product complaint in the same order (Product Complaint)
  const secondRes = validateComplaintSubmission(
    {
      orderId: 'CN-551234',
      productId: 'sheet-linen-2',
      requestType: 'Product Complaint',
      description: 'Color stain on one pillow cover.',
      photos: [
        {
          url: 'https://res.cloudinary.com/ys2sgydi/image/upload/v1794002/cotton_nest/complaints/pillow_stain.jpg',
          publicId: 'cotton_nest/complaints/pillow_stain',
        },
      ],
      customerEmail: 'aarav@example.com',
    },
    SAMPLE_ORDER
  );
  assert.equal(secondRes.valid, true);
  assert.ok(secondRes.complaint);
  assert.equal(secondRes.complaint.productId, 'sheet-linen-2');
  assert.equal(secondRes.complaint.variantName, 'Sage Leaf');

  // Admin updates status and sends response
  const updatedRes = applyAdminComplaintUpdate(firstRes.complaint, {
    status: 'Exchange Processing',
    adminResponse: 'We have approved your exchange and dispatched a fresh Royal Jaipuri Floral King bedsheet.',
    respondedBy: 'Cotton Nest Quality Team',
  });
  assert.equal(updatedRes.valid, true);
  assert.equal(updatedRes.complaint?.status, 'Exchange Processing');
  assert.equal(
    updatedRes.complaint?.adminResponse,
    'We have approved your exchange and dispatched a fresh Royal Jaipuri Floral King bedsheet.'
  );
  assert.equal(updatedRes.complaint?.responseHistory.length, 2);

  // Verify customer notification builder for complaint submission & admin response
  const submittedNotif = buildComplaintNotificationForCustomer(firstRes.complaint, 'submitted');
  assert.equal(submittedNotif.type, 'complaint_update');
  assert.equal(submittedNotif.category, 'orders');
  assert.equal(submittedNotif.metadata?.complaintId, firstRes.complaint.id);
  assert.equal(submittedNotif.metadata?.orderId, 'CN-551234');

  const adminNotif = buildComplaintNotificationForAdmin(firstRes.complaint);
  assert.equal(adminNotif.type, 'admin_complaint');
  assert.equal(adminNotif.category, 'admin');

  const respondedNotif = buildComplaintNotificationForCustomer(updatedRes.complaint!, 'admin_responded');
  assert.equal(respondedNotif.type, 'complaint_update');
  assert.ok(respondedNotif.title.includes('Cotton Nest Responded'));
  assert.ok(respondedNotif.message.includes('Exchange Processing'));
  assert.ok(respondedNotif.message.includes('We have approved your exchange'));
  assert.equal(respondedNotif.metadata?.complaintStatus, 'Exchange Processing');

  const orderStatusNotif = buildOrderStatusNotification('CN-551234', 'Aarav Sharma', 'aarav@example.com', 'shipped');
  assert.equal(orderStatusNotif.type, 'order_status');
  assert.equal(orderStatusNotif.metadata?.orderId, 'CN-551234');
});

