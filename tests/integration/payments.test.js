const {
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

async function approvedOrder(sales, supervisor, options = {}) {
  const {
    customerId = '2',
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

async function deliveredInvoice(sales, supervisor, warehouse, finance, options = {}) {
  const orderId = await approvedOrder(sales, supervisor, options);
  const line = linesOf(orderId)[0];

  const deliveryResponse = await warehouse
    .post('/deliveries')
    .type('form')
    .send({
      orderId: String(orderId),
      deliveryDate: '2026-11-12',
      [`quantity_${line.id}`]: options.quantity || '10',
    })
    .expect(302);
  const deliveryId = Number(
    deliveryResponse.headers.location.match(/^\/deliveries\/(\d+)$/)[1]
  );

  await warehouse.post(`/deliveries/${deliveryId}/dispatch`).expect(302);
  await warehouse.post(`/deliveries/${deliveryId}/confirm`).expect(302);

  const invoiceResponse = await finance
    .post('/invoices')
    .type('form')
    .send({ deliveryId: String(deliveryId), invoiceDate: '2026-11-12' })
    .expect(302);
  const invoiceId = Number(
    invoiceResponse.headers.location.match(/^\/invoices\/(\d+)$/)[1]
  );
  await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

  return { orderId, deliveryId, invoiceId, invoice: invoiceOf(invoiceId) };
}

async function recordPayment(finance, options = {}) {
  const response = await finance
    .post('/payments')
    .type('form')
    .send({
      customerId: options.customerId || '2',
      paymentDate: options.paymentDate || '2026-11-12',
      amount: String(options.amount || 100000),
      method: options.method || 'transfer',
      reference: options.reference || '',
      notes: options.notes || '',
    })
    .expect(302);

  const match = response.headers.location.match(/^\/payments\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  return Number(match[1]);
}

function invoiceOf(invoiceId) {
  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

function paymentOf(paymentId) {
  return getDb().prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
}

function allocationsOf(paymentId) {
  return getDb()
    .prepare('SELECT * FROM payment_allocations WHERE payment_id = ? ORDER BY id')
    .all(paymentId);
}

function requiredPayment(paymentId) {
  const payment = paymentOf(paymentId);
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  return payment;
}

describe('Payment recording and invoice allocation', () => {
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

  test('finance records a customer payment with an unallocated amount', async () => {
    const { invoiceId, invoice } = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '8',
      unitPrice: '6800',
    });
    expect(Number(invoice.total)).toBe(54400);

    const paymentId = await recordPayment(finance, {
      customerId: '2',
      amount: 100000,
      reference: 'TRF-2026-0042',
      notes: 'Down payment from customer',
    });

    const payment = paymentOf(paymentId);
    expect(payment.payment_number).toMatch(/^PAY-2026-\d{4}$/);
    expect(payment.status).toBe('recorded');
    expect(Number(payment.amount)).toBe(100000);
    expect(payment.customer_id).toBe(2);

    const detail = await finance.get(`/payments/${paymentId}`).expect(200);
    expect(detail.text).toContain(payment.payment_number);
    expect(detail.text).toContain('Recorded');
    expect(detail.text).toContain('Rp 100.000');
    expect(detail.text).toContain('TRF-2026-0042');
    expect(detail.text).toContain('Allocate to open invoices');
    expect(detail.text).toContain(invoice.invoice_number);
    expect(detail.text).toContain('Rp 54.400');

    const list = await finance.get('/payments').expect(200);
    expect(list.text).toContain(payment.payment_number);
    expect(list.text).toContain('Rp 100.000');
    expect(list.text).toContain('Unallocated');

    const invoices = await finance.get('/invoices').expect(200);
    expect(invoices.text).toContain(invoice.invoice_number);
    expect(invoices.text).toContain('Issued');
  });

  test('a payment can be allocated to multiple invoices and updates their statuses', async () => {
    const first = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '10',
      unitPrice: '6800',
    });
    const second = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '5',
      unitPrice: '6800',
    });
    expect(Number(first.invoice.total)).toBe(68000);
    expect(Number(second.invoice.total)).toBe(34000);

    const paymentId = await recordPayment(finance, {
      customerId: '2',
      amount: 80000,
      reference: 'TRF-MULTI-01',
    });

    const response = await finance
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({
        invoiceId: [String(first.invoiceId), String(second.invoiceId)],
        amount: ['68000', '12000'],
      })
      .expect(302);

    const allocations = allocationsOf(paymentId);
    expect(allocations).toHaveLength(2);
    expect(Number(allocations[0].amount)).toBe(68000);
    expect(Number(allocations[1].amount)).toBe(12000);

    expect(paymentOf(paymentId).status).toBe('fully_allocated');
    expect(invoiceOf(first.invoiceId).status).toBe('paid');
    expect(invoiceOf(second.invoiceId).status).toBe('partially_paid');

    const page = await finance.get(response.headers.location).expect(200);
    expect(page.text).toContain('Fully allocated');
    expect(page.text).toContain(first.invoice.invoice_number);
    expect(page.text).toContain(second.invoice.invoice_number);
    expect(page.text).toContain('Rp 68.000');
    expect(page.text).toContain('Rp 12.000');
    expect(page.text).toContain('Rp 22.000');

    const secondInvoice = await finance.get(`/invoices/${second.invoiceId}`).expect(200);
    expect(secondInvoice.text).toContain('Partially Paid');
    expect(secondInvoice.text).toContain('Rp 22.000');
  });

  test('partial allocation leaves an outstanding invoice balance', async () => {
    const { invoiceId, invoice } = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '5',
      unitPrice: '6800',
    });
    expect(Number(invoice.total)).toBe(34000);

    const paymentId = await recordPayment(finance, {
      customerId: '2',
      amount: 20000,
    });

    await finance
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({ invoiceId: String(invoiceId), amount: '13600' })
      .expect(302);

    expect(invoiceOf(invoiceId).status).toBe('partially_paid');
    expect(paymentOf(paymentId).status).toBe('partially_allocated');
    expect(allocationsOf(paymentId)).toHaveLength(1);

    const detail = await finance.get(`/payments/${paymentId}`).expect(200);
    expect(detail.text).toContain('Rp 6.400');
    expect(detail.text).toContain('Rp 20.400');

    const list = await finance.get('/invoices?status=partially_paid').expect(200);
    expect(list.text).toContain(invoice.invoice_number);
  });

  test('allocations cannot exceed the payment amount or the invoice balance', async () => {
    const { invoiceId, invoice } = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '5',
      unitPrice: '6800',
    });
    expect(Number(invoice.total)).toBe(34000);

    const paymentId = await recordPayment(finance, {
      customerId: '2',
      amount: 10000,
    });

    const overPayment = await finance
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({ invoiceId: String(invoiceId), amount: '15000' })
      .expect(302);
    const overPaymentPage = await finance.get(overPayment.headers.location).expect(200);
    expect(overPaymentPage.text).toContain('exceed the payment unallocated amount');
    expect(allocationsOf(paymentId)).toHaveLength(0);
    expect(paymentOf(paymentId).status).toBe('recorded');
    expect(invoiceOf(invoiceId).status).toBe('issued');

    await finance
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({ invoiceId: String(invoiceId), amount: '10000' })
      .expect(302);
    expect(paymentOf(paymentId).status).toBe('fully_allocated');
    expect(invoiceOf(invoiceId).status).toBe('partially_paid');

    const smallInvoice = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '1',
      unitPrice: '6800',
    });
    const secondPaymentId = await recordPayment(finance, {
      customerId: '2',
      amount: 10000,
    });

    const overInvoice = await finance
      .post(`/payments/${secondPaymentId}/allocations`)
      .type('form')
      .send({ invoiceId: String(smallInvoice.invoiceId), amount: '7000' })
      .expect(302);
    const overInvoicePage = await finance.get(overInvoice.headers.location).expect(200);
    expect(overInvoicePage.text).toContain('exceeds its outstanding balance');
    expect(allocationsOf(secondPaymentId)).toHaveLength(0);
    expect(invoiceOf(smallInvoice.invoiceId).status).toBe('issued');
  });

  test('payments cannot be allocated to another customer or a draft invoice', async () => {
    const { invoiceId, invoice } = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '3',
      unitPrice: '6800',
    });

    const otherCustomerPayment = await recordPayment(finance, {
      customerId: '3',
      amount: 50000,
    });
    const mismatch = await finance
      .post(`/payments/${otherCustomerPayment}/allocations`)
      .type('form')
      .send({ invoiceId: String(invoiceId), amount: '5000' })
      .expect(302);
    const mismatchPage = await finance.get(mismatch.headers.location).expect(200);
    expect(mismatchPage.text).toContain('belongs to a different customer');
    expect(allocationsOf(otherCustomerPayment)).toHaveLength(0);
    expect(invoiceOf(invoiceId).status).toBe('issued');

    const draftOrderId = await approvedOrder(sales, supervisor, {
      customerId: '2',
      quantity: '2',
      unitPrice: '6800',
    });
    const line = linesOf(draftOrderId)[0];
    const deliveryResponse = await warehouse
      .post('/deliveries')
      .type('form')
      .send({
        orderId: String(draftOrderId),
        deliveryDate: '2026-11-12',
        [`quantity_${line.id}`]: '2',
      })
      .expect(302);
    const draftDeliveryId = Number(
      deliveryResponse.headers.location.match(/^\/deliveries\/(\d+)$/)[1]
    );
    await warehouse.post(`/deliveries/${draftDeliveryId}/dispatch`).expect(302);
    await warehouse.post(`/deliveries/${draftDeliveryId}/confirm`).expect(302);

    const draftResponse = await finance
      .post('/invoices')
      .type('form')
      .send({ deliveryId: String(draftDeliveryId), invoiceDate: '2026-11-12' })
      .expect(302);
    const draftInvoiceId = Number(
      draftResponse.headers.location.match(/^\/invoices\/(\d+)$/)[1]
    );
    const draftInvoice = invoiceOf(draftInvoiceId);
    expect(draftInvoice.status).toBe('draft');

    const draftPayment = await recordPayment(finance, {
      customerId: '2',
      amount: 20000,
    });
    const draftPage = await finance.get(`/payments/${draftPayment}`).expect(200);
    expect(draftPage.text).not.toContain(draftInvoice.invoice_number);

    const draftAllocation = await finance
      .post(`/payments/${draftPayment}/allocations`)
      .type('form')
      .send({ invoiceId: String(draftInvoiceId), amount: '5000' })
      .expect(302);
    const draftErrorPage = await finance.get(draftAllocation.headers.location).expect(200);
    expect(draftErrorPage.text).toContain('not open for payment allocation');
    expect(allocationsOf(draftPayment)).toHaveLength(0);
    expect(invoiceOf(draftInvoiceId).status).toBe('draft');
    expect(invoice.invoice_number).toBeTruthy();
  });

  test('payment forms reject invalid input and over-allocation empties are blocked', async () => {
    const invalid = await finance
      .post('/payments')
      .type('form')
      .send({
        customerId: '2',
        paymentDate: '2026-11-12',
        amount: '0',
        method: 'transfer',
      })
      .expect(302);
    const invalidPage = await finance.get(invalid.headers.location).expect(200);
    expect(invalidPage.text).toContain('greater than zero');

    const paymentId = await recordPayment(finance, { customerId: '2', amount: 15000 });
    const empty = await finance
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({ invoiceId: '1', amount: '0' })
      .expect(302);
    const emptyPage = await finance.get(empty.headers.location).expect(200);
    expect(emptyPage.text).toContain('Enter at least one allocation amount');
    expect(requiredPayment(paymentId).status).toBe('recorded');
  });

  test('payment access follows role permissions', async () => {
    await finance.get('/payments').expect(200);
    await finance.get('/payments/new').expect(200);
    await management.get('/payments').expect(200);
    await sales.get('/payments').expect(403);
    await warehouse.get('/payments').expect(403);
    await sales.get('/payments/new').expect(403);

    const paymentId = await recordPayment(finance, { customerId: '2', amount: 25000 });

    await management.get(`/payments/${paymentId}`).expect(200);
    await finance.get(`/payments/${paymentId}`).expect(200);
    await sales.get(`/payments/${paymentId}`).expect(403);
    await warehouse.get(`/payments/${paymentId}`).expect(403);

    await management
      .post(`/payments/${paymentId}/allocations`)
      .type('form')
      .send({ invoiceId: '1', amount: '1000' })
      .expect(403);
    await sales
      .post('/payments')
      .type('form')
      .send({
        customerId: '2',
        paymentDate: '2026-11-12',
        amount: '1000',
        method: 'cash',
      })
      .expect(403);

    const detail = await management.get(`/payments/${paymentId}`).expect(200);
    expect(detail.text).not.toContain('Allocate to open invoices');
  });
});
