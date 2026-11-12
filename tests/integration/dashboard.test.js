const {
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

function statValue(html, label) {
  const pattern = new RegExp(
    `<div class="stat-label">${label}</div>\\s*<div class="stat-value[^"]*">([^<]*)</div>`
  );
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function tableBody(html) {
  const match = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  return match ? match[1] : '';
}

function linesOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

async function createOrder(sales, options = {}) {
  const {
    customerId = '2',
    orderDate = '2026-11-12',
    productId = '5',
    quantity = '10',
    unitPrice = '6800',
  } = options;

  const response = await sales
    .post('/orders')
    .type('form')
    .send({
      customerId,
      orderDate,
      productId: [productId],
      quantity: [quantity],
      unitPrice: [unitPrice],
    })
    .expect(302);

  const match = response.headers.location.match(/^\/orders\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  return Number(match[1]);
}

async function deliveredInvoice(sales, supervisor, warehouse, finance, options = {}) {
  const orderId = await createOrder(sales, options);
  await sales.post(`/orders/${orderId}/submit`).expect(302);
  await supervisor.post(`/approvals/${orderId}/approve`).type('form').send({}).expect(302);

  const line = linesOf(orderId)[0];
  const deliveryResponse = await warehouse
    .post('/deliveries')
    .type('form')
    .send({
      orderId: String(orderId),
      deliveryDate: options.deliveryDate || '2026-11-12',
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
    .send({
      deliveryId: String(deliveryId),
      invoiceDate: options.invoiceDate || '2026-11-12',
    })
    .expect(302);
  const invoiceId = Number(
    invoiceResponse.headers.location.match(/^\/invoices\/(\d+)$/)[1]
  );
  await finance.post(`/invoices/${invoiceId}/issue`).expect(302);

  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

describe('Dashboard and audit trail', () => {
  let app;
  let sales;
  let supervisor;
  let warehouse;
  let finance;
  let management;
  let admin;

  beforeAll(async () => {
    setupTestDb();
    app = createApp();
    sales = await loginAs(app, 'sales', 'sales123');
    supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    finance = await loginAs(app, 'finance', 'finance123');
    management = await loginAs(app, 'management', 'management123');
    admin = await loginAs(app, 'admin', 'admin123');
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('sales dashboard renders live order KPIs and role guidance', async () => {
    await createOrder(sales, { customerId: '2', quantity: '10', unitPrice: '6800' });

    const response = await sales.get('/dashboard').expect(200);
    expect(response.text).toContain('Sales workspace');
    expect(response.text).toContain('Order status distribution');
    expect(response.text).toContain('CV Sinar Abadi');
    expect(statValue(response.text, 'Sales orders')).toBe('1');
    expect(response.text).toContain('Rp 68.000 total order value');
    expect(response.text).toContain('Live data from actual transactions');
  });

  test('date and customer filters narrow the dashboard KPIs', async () => {
    await createOrder(sales, {
      customerId: '1',
      orderDate: '2026-10-01',
      quantity: '5',
      unitPrice: '6800',
    });

    const november = await sales
      .get('/dashboard?dateFrom=2026-11-01&dateTo=2026-11-30')
      .expect(200);
    expect(statValue(november.text, 'Sales orders')).toBe('1');
    expect(november.text).toContain('2026-11-01 to 2026-11-30');

    const october = await sales
      .get('/dashboard?dateFrom=2026-10-01&dateTo=2026-10-31')
      .expect(200);
    expect(statValue(october.text, 'Sales orders')).toBe('1');

    const customerOne = await sales.get('/dashboard?customerId=1').expect(200);
    expect(statValue(customerOne.text, 'Sales orders')).toBe('1');
    expect(customerOne.text).toContain('PT Bangun Jaya Konstruksi');

    const empty = await sales
      .get('/dashboard?dateFrom=2026-12-01&dateTo=2026-12-31')
      .expect(200);
    expect(statValue(empty.text, 'Sales orders')).toBe('0');
    expect(empty.text).toContain('No sales orders match the current filters.');

    const invalid = await sales.get('/dashboard?dateFrom=not-a-date').expect(200);
    expect(statValue(invalid.text, 'Sales orders')).toBe('2');
  });

  test('role visibility controls finance, inventory, and audit sections', async () => {
    const warehouseView = await warehouse.get('/dashboard').expect(200);
    expect(warehouseView.text).toContain('Fulfillment workspace');
    expect(warehouseView.text).toContain('Inventory overview');
    expect(warehouseView.text).not.toContain('Outstanding receivables');
    expect(warehouseView.text).not.toContain('Overdue invoices');

    const financeView = await finance.get('/dashboard').expect(200);
    expect(financeView.text).toContain('Finance workspace');
    expect(financeView.text).toContain('Outstanding receivables');
    expect(financeView.text).not.toContain('Inventory overview');
    expect(financeView.text).not.toContain('/audit');

    const managementView = await management.get('/dashboard').expect(200);
    expect(managementView.text).toContain('Management overview');
    expect(managementView.text).toContain('Inventory overview');
    expect(managementView.text).toContain('Outstanding receivables');
    expect(managementView.text).toContain('href="/audit"');

    const adminView = await admin.get('/dashboard').expect(200);
    expect(adminView.text).toContain('Administration');
    expect(adminView.text).toContain('href="/audit"');
  });

  test('supervisor dashboard highlights orders awaiting approval', async () => {
    const orderId = await createOrder(sales, { customerId: '3', quantity: '4' });
    await sales.post(`/orders/${orderId}/submit`).expect(302);

    const response = await supervisor.get('/dashboard').expect(200);
    expect(response.text).toContain('Sales supervision');
    expect(statValue(response.text, 'Pending approval')).toBe('1');
    expect(response.text).toContain('awaiting approval');
  });

  test('dashboard shows receivables and overdue invoices as of today', async () => {
    const invoice = await deliveredInvoice(sales, supervisor, warehouse, finance, {
      customerId: '2',
      quantity: '10',
      unitPrice: '6800',
      invoiceDate: '2026-09-01',
    });
    expect(Number(invoice.total)).toBe(68000);

    const response = await finance.get('/dashboard').expect(200);
    expect(response.text).toContain('Outstanding receivables');
    expect(response.text).toContain('Rp 68.000');
    expect(response.text).toContain('Overdue invoices');
    expect(response.text).toContain(invoice.invoice_number);
    expect(response.text).toContain('Rp 68.000');
    expect(response.text).toMatch(/1<\/strong> overdue invoice/);

    // Date filters apply to transaction dates, not to receivables balances.
    const filtered = await finance
      .get('/dashboard?dateFrom=2026-11-01&dateTo=2026-11-30')
      .expect(200);
    expect(filtered.text).toContain('Outstanding receivables');
    expect(filtered.text).toContain('Rp 68.000');
  });

  test('audit trail is restricted to management and admin', async () => {
    await sales.get('/audit').expect(403);
    await warehouse.get('/audit').expect(403);
    await finance.get('/audit').expect(403);
    await supervisor.get('/audit').expect(403);

    const managementView = await management.get('/audit').expect(200);
    expect(managementView.text).toContain('Audit trail');
    expect(tableBody(managementView.text)).toContain('Sales order created');

    const adminView = await admin.get('/audit').expect(200);
    expect(adminView.text).toContain('Audit trail');
    expect(tableBody(adminView.text)).toContain('Sales order created');
  });

  test('audit trail filters by entity, action, and date', async () => {
    const orders = await management.get('/audit?entityType=sales_order').expect(200);
    const ordersBody = tableBody(orders.text);
    expect(ordersBody).toContain('Sales order created');
    expect(ordersBody).not.toContain('Invoice issued');

    const invoices = await management.get('/audit?entityType=invoice').expect(200);
    const invoicesBody = tableBody(invoices.text);
    expect(invoicesBody).toContain('Invoice issued');
    expect(invoicesBody).not.toContain('Sales order created');

    const created = await management
      .get('/audit?entityType=sales_order&action=order_created')
      .expect(200);
    const createdBody = tableBody(created.text);
    expect(createdBody).toContain('created with');
    expect(createdBody).not.toContain('submitted for supervisor approval');

    const empty = await management
      .get('/audit?dateFrom=2000-01-01&dateTo=2000-01-02')
      .expect(200);
    expect(empty.text).toContain('No audit records match');

    const invalid = await management
      .get('/audit?entityType=not-an-entity&action=not-an-action')
      .expect(200);
    expect(tableBody(invalid.text)).toContain('Sales order created');
  });
});
