/**
 * Demo transaction seed.
 *
 * Rebuilds the database from migrations + master data, then creates a
 * realistic Order-to-Cash history through the same services used by the app.
 * Using the services preserves reservations, invoiced quantities, invoice
 * balances, statuses, and audit records.
 *
 * Usage: stop the development server, then run `npm run db:demo`.
 */

const fs = require('fs');

const env = require('../src/config/env');

if (env.dbPath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${env.dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

const { runMigrations } = require('../src/database/migrate');
const seed = require('../src/database/seed');
const { getDb } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
const orderService = require('../src/services/order.service');
const approvalService = require('../src/services/approval.service');
const deliveryService = require('../src/services/delivery.service');
const invoiceService = require('../src/services/invoice.service');
const paymentService = require('../src/services/payment.service');

runMigrations();
seed();

const db = getDb();
const IP = '127.0.0.1';

const actor = {
  sales: userRepository.findByUsername('sales'),
  supervisor: userRepository.findByUsername('supervisor'),
  warehouse: userRepository.findByUsername('warehouse'),
  finance: userRepository.findByUsername('finance'),
};

function customerId(code) {
  const row = db.prepare('SELECT id FROM customers WHERE code = ?').get(code);
  if (!row) throw new Error(`Customer ${code} not found`);
  return row.id;
}

function productId(sku) {
  const row = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
  if (!row) throw new Error(`Product ${sku} not found`);
  return row.id;
}

function orderLines(orderId) {
  return db.prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id').all(orderId);
}

function createOrder({ customer, date, lines }) {
  return orderService.createOrder(
    {
      customerId: customerId(customer),
      orderDate: date,
      productId: lines.map((line) => productId(line.sku)),
      quantity: lines.map((line) => line.quantity),
      notes: '',
    },
    actor.sales,
    IP
  );
}

function submit(order) {
  return orderService.submitOrder(order.id, actor.sales, IP);
}

function approve(order, overrideReason) {
  return approvalService.approveOrder(
    order.id,
    overrideReason ? { overrideReason } : {},
    actor.supervisor,
    IP
  );
}

function createDelivery(order, date, quantities) {
  const body = { orderId: order.id, deliveryDate: date };
  for (const line of orderLines(order.id)) {
    const quantity = quantities[line.product_id];
    if (quantity !== undefined) body[`quantity_${line.id}`] = quantity;
  }
  return deliveryService.createDelivery(body, actor.warehouse, IP);
}

function dispatch(delivery) {
  return deliveryService.dispatchDelivery(delivery.id, actor.warehouse, IP);
}

function confirm(delivery) {
  return deliveryService.confirmDelivery(delivery.id, actor.warehouse, IP);
}

function invoice(delivery, date) {
  const created = invoiceService.createInvoice(
    { deliveryId: delivery.id, invoiceDate: date },
    actor.finance,
    IP
  );
  return invoiceService.issueInvoice(created.id, actor.finance, IP);
}

function recordPayment({ customer, date, amount, method, reference, notes }) {
  return paymentService.createPayment(
    {
      customerId: customerId(customer),
      paymentDate: date,
      amount,
      method,
      reference,
      notes,
    },
    actor.finance,
    IP
  );
}

function allocate(payment, pairs) {
  return paymentService.allocatePayment(
    payment.id,
    {
      invoiceId: pairs.map((pair) => pair.invoiceId),
      amount: pairs.map((pair) => pair.amount),
    },
    actor.finance,
    IP
  );
}

const summary = [];

// 1. Fulfilled order, invoiced, partially paid and overdue.
const orderA = createOrder({
  customer: 'CUST-0001',
  date: '2026-09-15',
  lines: [
    { sku: 'SEM-50', quantity: 150 },
    { sku: 'BSI-12', quantity: 40 },
  ],
});
submit(orderA);
approve(orderA);
const deliveryA = createDelivery(orderA, '2026-09-18', {
  [productId('SEM-50')]: 150,
  [productId('BSI-12')]: 40,
});
dispatch(deliveryA);
confirm(deliveryA);
const invoiceA = invoice(deliveryA, '2026-09-20');
summary.push(`Invoice ${invoiceA.invoice_number} (${invoiceA.status}) - ${invoiceA.total}`);

// 2. Fulfilled order, invoiced and fully paid.
const orderB = createOrder({
  customer: 'CUST-0002',
  date: '2026-10-20',
  lines: [
    { sku: 'HBL-075', quantity: 60 },
    { sku: 'MTR-40', quantity: 20 },
  ],
});
submit(orderB);
approve(orderB);
const deliveryB = createDelivery(orderB, '2026-11-02', {
  [productId('HBL-075')]: 60,
  [productId('MTR-40')]: 20,
});
dispatch(deliveryB);
confirm(deliveryB);
const invoiceB = invoice(deliveryB, '2026-11-02');
summary.push(`Invoice ${invoiceB.invoice_number} (${invoiceB.status}) - ${invoiceB.total}`);

// 3. Partial delivery, partially invoiced, still open.
const orderC = createOrder({
  customer: 'CUST-0003',
  date: '2026-11-03',
  lines: [
    { sku: 'CAT-25', quantity: 25 },
    { sku: 'PIP-3', quantity: 30 },
  ],
});
submit(orderC);
approve(orderC);
const deliveryC = createDelivery(orderC, '2026-11-06', {
  [productId('CAT-25')]: 6,
  [productId('PIP-3')]: 30,
});
dispatch(deliveryC);
confirm(deliveryC);
const invoiceC = invoice(deliveryC, '2026-11-06');
summary.push(`Invoice ${invoiceC.invoice_number} (${invoiceC.status}) - ${invoiceC.total}`);

// 4. Dispatched shipment with an unresolved delivery exception.
const orderD = createOrder({
  customer: 'CUST-0004',
  date: '2026-11-05',
  lines: [{ sku: 'SEM-50', quantity: 120 }],
});
submit(orderD);
approve(orderD);
const deliveryD = createDelivery(orderD, '2026-11-08', {
  [productId('SEM-50')]: 120,
});
dispatch(deliveryD);
deliveryService.markException(
  deliveryD.id,
  { reason: 'Recipient warehouse closed on arrival. Redelivery scheduled for the next working day.' },
  actor.warehouse,
  IP
);
summary.push(`Delivery ${deliveryD.delivery_number} flagged as an exception`);

// 5. Approved order waiting for fulfillment.
const orderE = createOrder({
  customer: 'CUST-0005',
  date: '2026-11-07',
  lines: [
    { sku: 'BSP-12', quantity: 10 },
    { sku: 'TPL-09', quantity: 20 },
  ],
});
submit(orderE);
approve(orderE);
summary.push(`Order ${orderE.order_number} approved and awaiting delivery`);

// 6. Large approved order that required a credit-limit override.
const orderF = createOrder({
  customer: 'CUST-0004',
  date: '2026-11-08',
  lines: [
    { sku: 'SEM-50', quantity: 300 },
    { sku: 'BSI-12', quantity: 100 },
    { sku: 'CAT-25', quantity: 50 },
  ],
});
submit(orderF);
approve(
  orderF,
  'Strategic contractor tender. Management approved a temporary exposure increase until the first progress payment clears.'
);
summary.push(`Order ${orderF.order_number} approved with a credit-limit override`);

// 7. Submitted order waiting for supervisor approval.
const orderG = createOrder({
  customer: 'CUST-0006',
  date: '2026-11-09',
  lines: [{ sku: 'SRG-KRJ', quantity: 40 }],
});
submit(orderG);
summary.push(`Order ${orderG.order_number} submitted and awaiting approval`);

// 8. Draft order still being prepared by Sales.
const orderH = createOrder({
  customer: 'CUST-0007',
  date: '2026-11-10',
  lines: [{ sku: 'LMP-PVC', quantity: 20 }],
});
summary.push(`Draft order ${orderH.order_number} saved`);

// 9. Rejected order with a reason.
const orderI = createOrder({
  customer: 'CUST-0008',
  date: '2026-11-11',
  lines: [{ sku: 'TPL-09', quantity: 10 }],
});
submit(orderI);
approvalService.rejectOrder(
  orderI.id,
  { reason: 'Delivery location is outside the current service coverage area.' },
  actor.supervisor,
  IP
);
summary.push(`Order ${orderI.order_number} rejected`);

// Payments: one partial, one full, one unallocated.
const paymentA = recordPayment({
  customer: 'CUST-0001',
  date: '2026-10-25',
  amount: 6000000,
  method: 'transfer',
  reference: 'TRF-BCA-1025-001',
  notes: 'Progress payment for September delivery.',
});
allocate(paymentA, [{ invoiceId: invoiceA.id, amount: 6000000 }]);

const paymentB = recordPayment({
  customer: 'CUST-0002',
  date: '2026-11-10',
  amount: Number(invoiceB.total),
  method: 'transfer',
  reference: 'TRF-MDR-1110-014',
  notes: 'Settlement of invoice ' + invoiceB.invoice_number,
});
allocate(paymentB, [{ invoiceId: invoiceB.id, amount: Number(invoiceB.total) }]);

recordPayment({
  customer: 'CUST-0003',
  date: '2026-11-11',
  amount: 1000000,
  method: 'cheque',
  reference: 'CHQ-BNI-2211',
  notes: 'Advance received; to be allocated after the invoice review.',
});

console.log('');
console.log('Demo transaction seed completed.');
for (const line of summary) console.log(` - ${line}`);
console.log('');
console.log(
  `Orders: ${db.prepare('SELECT COUNT(*) AS c FROM sales_orders').get().c}; ` +
    `deliveries: ${db.prepare('SELECT COUNT(*) AS c FROM deliveries').get().c}; ` +
    `invoices: ${db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c}; ` +
    `payments: ${db.prepare('SELECT COUNT(*) AS c FROM payments').get().c}.`
);
