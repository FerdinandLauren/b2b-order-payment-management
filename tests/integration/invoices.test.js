const {
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');
const approvalRepository = require('../../src/repositories/approval.repository');

async function approvedOrder(sales, supervisor, options = {}) {
  const {
    customerId = '8',
    productId = '5',
    quantity = '10',
    unitPrice = '6800',
  } = options;

  const response = await sales
    .post('/orders')
    .type('form')
    .send({
      customerId,
      orderDate: '2026-11-12',
      productId: [productId],
      quantity: [quantity],
      unitPrice: [unitPrice],
    })
    .expect(302);

  const match = response.headers.location.match(/^\/orders\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  const orderId = Number(match[1]);

  await sales.post(`/orders/${orderId}/submit`).expect(302);
  await supervisor.post(`/approvals/${orderId}/approve`).type('form').send({}).expect(302);

  return orderId;
}

function linesOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

async function createDelivery(warehouse, orderId, quantity) {
  const line = linesOf(orderId)[0];
  const response = await warehouse
    .post('/deliveries')
    .type('form')
    .send({
      orderId: String(orderId),
      deliveryDate: '2026-11-12',
      [`quantity_${line.id}`]: String(quantity),
    })
    .expect(302);

  const match = response.headers.location.match(/^\/deliveries\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  return Number(match[1]);
}

async function deliveredOrder(sales, supervisor, warehouse, options = {}) {
  const orderId = await approvedOrder(sales, supervisor, options);
  const deliveryId = await createDelivery(warehouse, orderId, options.quantity || '10');
  await warehouse.post(`/deliveries/${deliveryId}/dispatch`).expect(302);
  await warehouse.post(`/deliveries/${deliveryId}/confirm`).expect(302);
  return { orderId, deliveryId };
}

async function generateInvoice(finance, deliveryId, invoiceDate = '2026-11-12') {
  const response = await finance
    .post('/invoices')
    .type('form')
    .send({ deliveryId: String(deliveryId), invoiceDate })
    .expect(302);

  const match = response.headers.location.match(/^\/invoices\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  return Number(match[1]);
}

function invoiceOf(invoiceId) {
  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

function invoiceLinesOf(invoiceId) {
  return getDb()
    .prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id')
    .all(invoiceId);
}

function deliveryLinesOf(deliveryId) {
  return getDb()
    .prepare('SELECT * FROM delivery_lines WHERE delivery_id = ? ORDER BY id')
    .all(deliveryId);
}

describe('Invoice and accounts receivable management', () => {
  let app;
  let sales;
  let supervisor;
  let warehouse;
  let finance;
  let management;

  beforeAll(async () => {
    setupTestDb();
    app = createApp();
    sales = await loginAs(app, 'sales', 'sales123');
    supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    finance = await loginAs(app, 'finance', 'finance123');
    management = await loginAs(app, 'management', 'management123');
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('finance generates an invoice from a delivered shipment with correct totals and due date', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      customerId: '2',
      quantity: '8',
      unitPrice: '6800',
    });
    const delivery = getDb().prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);

    const list = await finance.get('/invoices/new').expect(200);
    expect(list.text).toContain(delivery.delivery_number);

    const preview = await finance.get(`/invoices/new?deliveryId=${deliveryId}`).expect(200);
    expect(preview.text).toContain('Generate invoice');
    expect(preview.text).toContain('Bata Ringan Hebel 7.5 cm');

    const invoiceId = await generateInvoice(finance, deliveryId, '2026-11-12');
    const invoice = invoiceOf(invoiceId);

    expect(invoice.invoice_number).toMatch(/^INV-2026-\d{4}$/);
    expect(invoice.status).toBe('draft');
    expect(invoice.customer_id).toBe(2);
    expect(invoice.delivery_id).toBe(deliveryId);
    expect(Number(invoice.subtotal)).toBe(54400);
    expect(Number(invoice.total)).toBe(54400);
    expect(invoice.invoice_date).toBe('2026-11-12');
    expect(invoice.due_date).toBe('2026-11-26');

    const lines = invoiceLinesOf(invoiceId);
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].quantity)).toBe(8);
    expect(Number(lines[0].unit_price)).toBe(6800);
    expect(Number(lines[0].line_total)).toBe(54400);

    expect(Number(deliveryLinesOf(deliveryId)[0].invoiced_quantity)).toBe(8);

    const page = await finance.get(`/invoices/${invoiceId}`).expect(200);
    expect(page.text).toContain(invoice.invoice_number);
    expect(page.text).toContain('Draft');
    expect(page.text).toContain('Rp 54.400');
    expect(page.text).toContain('Bata Ringan Hebel 7.5 cm');
    expect(page.text).toContain('Issue invoice');
  });

  test('a delivery cannot generate duplicate invoices', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '5',
      unitPrice: '6800',
    });
    const invoiceId = await generateInvoice(finance, deliveryId);

    const preview = await finance.get(`/invoices/new?deliveryId=${deliveryId}`).expect(400);
    expect(preview.text).toContain('already has an invoice');

    const duplicate = await finance
      .post('/invoices')
      .type('form')
      .send({ deliveryId: String(deliveryId), invoiceDate: '2026-11-12' })
      .expect(302);
    const page = await finance.get(duplicate.headers.location).expect(200);
    expect(page.text).toContain('already has an invoice');

    const list = await finance.get('/invoices/new').expect(200);
    const delivery = getDb().prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    expect(list.text).not.toContain(delivery.delivery_number);

    expect(getDb().prepare('SELECT COUNT(*) AS count FROM invoices WHERE delivery_id = ?').get(deliveryId).count).toBe(1);
    expect(invoiceOf(invoiceId).status).toBe('draft');
  });

  test('finance can issue an invoice and issuing twice is blocked', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '4',
      unitPrice: '6800',
    });
    const invoiceId = await generateInvoice(finance, deliveryId);

    await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

    const invoice = invoiceOf(invoiceId);
    expect(invoice.status).toBe('issued');
    expect(invoice.issued_at).toBeTruthy();

    const page = await finance.get(`/invoices/${invoiceId}`).expect(200);
    expect(page.text).toContain('Issued');
    expect(page.text).toContain('Rp 27.200');

    const again = await finance.post(`/invoices/${invoiceId}/issue`).expect(302);
    const errorPage = await finance.get(again.headers.location).expect(200);
    expect(errorPage.text).toContain('Only draft invoices can be issued');
    expect(invoiceOf(invoiceId).status).toBe('issued');
  });

  test('voiding requires a reason and releases the delivery for re-invoicing', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '6',
      unitPrice: '6800',
    });
    const firstInvoiceId = await generateInvoice(finance, deliveryId);
    await finance.post(`/invoices/${firstInvoiceId}/issue`).expect(302);

    const missingReason = await finance
      .post(`/invoices/${firstInvoiceId}/void`)
      .type('form')
      .send({ reason: '' })
      .expect(302);
    const missingReasonPage = await finance.get(missingReason.headers.location).expect(200);
    expect(missingReasonPage.text).toContain('void reason');

    await finance
      .post(`/invoices/${firstInvoiceId}/void`)
      .type('form')
      .send({ reason: 'Wrong billing address; reissuing the invoice' })
      .expect(302);

    const voided = invoiceOf(firstInvoiceId);
    expect(voided.status).toBe('void');
    expect(voided.void_reason).toBe('Wrong billing address; reissuing the invoice');
    expect(voided.voided_at).toBeTruthy();
    expect(Number(deliveryLinesOf(deliveryId)[0].invoiced_quantity)).toBe(0);

    const page = await finance.get(`/invoices/${firstInvoiceId}`).expect(200);
    expect(page.text).toContain('Invoice voided');
    expect(page.text).toContain('Wrong billing address');

    const preview = await finance.get(`/invoices/new?deliveryId=${deliveryId}`).expect(200);
    expect(preview.text).toContain('Generate invoice');

    const secondInvoiceId = await generateInvoice(finance, deliveryId);
    expect(secondInvoiceId).not.toBe(firstInvoiceId);
    expect(Number(invoiceOf(secondInvoiceId).total)).toBe(40800);
    expect(Number(deliveryLinesOf(deliveryId)[0].invoiced_quantity)).toBe(6);
  });

  test('invoices with payment allocations cannot be voided', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '3',
      unitPrice: '6800',
    });
    const invoiceId = await generateInvoice(finance, deliveryId);
    await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

    const invoice = invoiceOf(invoiceId);
    const timestamp = '2026-11-12 10:00:00';
    const payment = getDb()
      .prepare(
        `INSERT INTO payments
          (payment_number, customer_id, payment_date, amount, method, reference, status, created_at, updated_at)
         VALUES ('PAY-TEST-0001', ?, '2026-11-12', 5000, 'transfer', 'TEST-REF', 'recorded', ?, ?)`
      )
      .run(invoice.customer_id, timestamp, timestamp);
    getDb()
      .prepare(
        `INSERT INTO payment_allocations (payment_id, invoice_id, amount, created_at)
         VALUES (?, ?, 5000, ?)`
      )
      .run(Number(payment.lastInsertRowid), invoiceId, timestamp);

    const response = await finance
      .post(`/invoices/${invoiceId}/void`)
      .type('form')
      .send({ reason: 'Attempting to void a paid invoice' })
      .expect(302);
    const page = await finance.get(response.headers.location).expect(200);
    expect(page.text).toContain('cannot be voided');
    expect(invoiceOf(invoiceId).status).toBe('issued');

    const detail = await finance.get(`/invoices/${invoiceId}`).expect(200);
    expect(detail.text).toContain('PAY-TEST-0001');
    expect(detail.text).toContain('Rp 5.000');
    expect(detail.text).toContain('Rp 15.400');
  });

  test('overdue invoices are identified in the list and on the detail page', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '7',
      unitPrice: '6800',
    });
    const invoiceId = await generateInvoice(finance, deliveryId, '2026-11-01');
    await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

    getDb()
      .prepare('UPDATE invoices SET due_date = ? WHERE id = ?')
      .run('2026-11-01', invoiceId);

    const invoice = invoiceOf(invoiceId);
    const all = await finance.get('/invoices').expect(200);
    expect(all.text).toContain(invoice.invoice_number);
    expect(all.text).toContain('Overdue');

    const overdue = await finance.get('/invoices?overdue=1').expect(200);
    expect(overdue.text).toContain(invoice.invoice_number);

    const detail = await finance.get(`/invoices/${invoiceId}`).expect(200);
    expect(detail.text).toContain('Overdue by');
    expect(detail.text).toContain('Rp 47.600');
  });

  test('invoice generation keeps credit exposure unchanged until the invoice is issued', async () => {
    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      customerId: '2',
      quantity: '5',
      unitPrice: '6800',
    });
    const before = approvalRepository.customerExposure(2);

    const invoiceId = await generateInvoice(finance, deliveryId);

    const afterDraft = approvalRepository.customerExposure(2);
    expect(Number(afterDraft.openOrders)).toBeCloseTo(Number(before.openOrders), 2);
    expect(Number(afterDraft.outstanding)).toBeCloseTo(Number(before.outstanding), 2);

    await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

    const afterIssue = approvalRepository.customerExposure(2);
    expect(Number(afterIssue.openOrders)).toBeCloseTo(Number(before.openOrders) - 34000, 2);
    expect(Number(afterIssue.outstanding)).toBeCloseTo(Number(before.outstanding) + 34000, 2);
  });

  test('invoice access follows role permissions', async () => {
    await management.get('/invoices').expect(200);
    await sales.get('/invoices').expect(200);
    await warehouse.get('/invoices').expect(403);

    const { deliveryId } = await deliveredOrder(sales, supervisor, warehouse, {
      quantity: '2',
      unitPrice: '6800',
    });

    await sales.get('/invoices/new').expect(403);
    await sales
      .post('/invoices')
      .type('form')
      .send({ deliveryId: String(deliveryId), invoiceDate: '2026-11-12' })
      .expect(403);

    const invoiceId = await generateInvoice(finance, deliveryId);
    await sales.post(`/invoices/${invoiceId}/issue`).expect(403);
    await warehouse.post(`/invoices/${invoiceId}/issue`).expect(403);
    await sales
      .post(`/invoices/${invoiceId}/void`)
      .type('form')
      .send({ reason: 'Sales staff cannot void invoices' })
      .expect(403);
    await management
      .post(`/invoices/${invoiceId}/void`)
      .type('form')
      .send({ reason: 'Management cannot void invoices' })
      .expect(403);

    expect(invoiceOf(invoiceId).status).toBe('draft');
    const detail = await sales.get(`/invoices/${invoiceId}`).expect(200);
    expect(detail.text).toContain(invoiceOf(invoiceId).invoice_number);
    expect(detail.text).not.toContain('Issue invoice');
  });
});
