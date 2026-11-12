const {
  request,
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

async function createOrder(agent, overrides = {}) {
  const response = await agent
    .post('/orders')
    .type('form')
    .send({
      customerId: '1',
      orderDate: '2026-11-12',
      notes: 'Integration test order',
      productId: ['1', '2'],
      quantity: ['5', '3'],
      unitPrice: ['68000', '95000'],
      ...overrides,
    })
    .expect(302);

  const match = response.headers.location.match(/^\/orders\/(\d+)$/);
  if (!match) throw new Error(`Unexpected redirect: ${response.headers.location}`);
  return Number(match[1]);
}

function linesOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

function statusOf(orderId) {
  return getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId);
}

describe('Sales order management', () => {
  let app;

  beforeAll(() => {
    setupTestDb();
    app = createApp();
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('sales staff can open the order form', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const response = await agent.get('/orders/new').expect(200);

    expect(response.text).toContain('New sales order');
    expect(response.text).toContain('data-order-form');
    expect(response.text).toContain('id="order-data"');
    expect(response.text).toContain('/js/orders.js');
  });

  test('finance and warehouse staff cannot open the order form', async () => {
    const finance = await loginAs(app, 'finance', 'finance123');
    await finance.get('/orders/new').expect(403);

    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    await warehouse.get('/orders/new').expect(403);
  });

  test('sales staff can create a draft order with multiple lines and computed totals', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(agent);

    const order = statusOf(orderId);
    expect(order.status).toBe('draft');
    expect(order.subtotal).toBe(625000);
    expect(order.total).toBe(625000);
    expect(order.currency).toBe('IDR');

    const lines = linesOf(orderId);
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(5);
    expect(lines[0].unit_price).toBe(68000);
    expect(lines[0].line_total).toBe(340000);
    expect(lines[1].line_total).toBe(285000);

    const detail = await agent.get(`/orders/${orderId}`).expect(200);
    expect(detail.text).toContain(order.order_number);
    expect(detail.text).toContain('Rp 625.000');
    expect(detail.text).toContain('Draft');
    expect(detail.text).toContain('Submit for approval');
  });

  test('order creation rejects an empty line set and a zero quantity', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const db = getDb();
    const before = db.prepare('SELECT COUNT(*) AS count FROM sales_orders').get().count;

    await agent
      .post('/orders')
      .type('form')
      .send({ customerId: '1', orderDate: '2026-11-12' })
      .expect(302);

    await agent
      .post('/orders')
      .type('form')
      .send({
        customerId: '1',
        orderDate: '2026-11-12',
        productId: ['1'],
        quantity: ['0'],
        unitPrice: ['68000'],
      })
      .expect(302);

    const after = db.prepare('SELECT COUNT(*) AS count FROM sales_orders').get().count;
    expect(after).toBe(before);
  });

  test('inactive customers cannot be used on a new order', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const db = getDb();
    db.prepare("UPDATE customers SET status = 'inactive' WHERE id = 3").run();

    try {
      const response = await agent
        .post('/orders')
        .type('form')
        .send({
          customerId: '3',
          orderDate: '2026-11-12',
          productId: ['1'],
          quantity: ['1'],
          unitPrice: ['68000'],
        })
        .expect(302);

      const page = await agent.get(response.headers.location).expect(200);
      expect(page.text).toContain('Inactive customers cannot be used on new orders');
    } finally {
      db.prepare("UPDATE customers SET status = 'active' WHERE id = 3").run();
    }
  });

  test('a draft order can be edited and recalculates totals', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(agent);

    await agent
      .post(`/orders/${orderId}`)
      .type('form')
      .send({
        customerId: '2',
        orderDate: '2026-11-13',
        notes: 'Revised',
        productId: ['2'],
        quantity: ['10'],
        unitPrice: ['90000'],
      })
      .expect(302);

    const order = statusOf(orderId);
    expect(order.customer_id).toBe(2);
    expect(order.order_date).toBe('2026-11-13');
    expect(order.notes).toBe('Revised');
    expect(order.total).toBe(900000);

    const lines = linesOf(orderId);
    expect(lines).toHaveLength(1);
    expect(lines[0].product_id).toBe(2);
    expect(lines[0].quantity).toBe(10);

    const editPage = await agent.get(`/orders/${orderId}/edit`).expect(200);
    expect(editPage.text).toContain('Edit ' + order.order_number);
    expect(editPage.text).toContain('value="90000"');
  });

  test('sales staff can submit a draft order for approval', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(agent);

    await agent.post(`/orders/${orderId}/submit`).expect(302);

    const order = statusOf(orderId);
    expect(order.status).toBe('submitted');
    expect(order.submitted_at).toBeTruthy();

    const approvals = getDb()
      .prepare('SELECT * FROM order_approvals WHERE order_id = ? ORDER BY id')
      .all(orderId);
    expect(approvals).toHaveLength(1);
    expect(approvals[0].action).toBe('submitted');

    const detail = await agent.get(`/orders/${orderId}`).expect(200);
    expect(detail.text).toContain('Submitted');

    await agent.get(`/orders/${orderId}/edit`).expect(400);
  });

  test('sales staff cannot cancel an order they have already submitted', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(agent);
    await agent.post(`/orders/${orderId}/submit`).expect(302);

    const response = await agent
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({ reason: 'Customer changed their mind' })
      .expect(302);

    const page = await agent.get(response.headers.location).expect(200);
    expect(page.text).toContain('not allowed to cancel');

    expect(statusOf(orderId).status).toBe('submitted');
  });

  test('a supervisor can partially cancel a submitted order', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(sales);
    await sales.post(`/orders/${orderId}/submit`).expect(302);

    const lines = linesOf(orderId);
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');

    const response = await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({
        reason: 'Customer reduced the order scope',
        [`cancel_${lines[0].id}`]: '2',
        [`cancel_${lines[1].id}`]: '1',
      })
      .expect(302);

    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('partial cancellation');
    expect(page.text).toContain('Submitted');
    expect(page.text).toContain('Customer reduced the order scope');

    const updated = linesOf(orderId);
    expect(updated[0].cancelled_quantity).toBe(2);
    expect(updated[0].cancellation_reason).toBe('Customer reduced the order scope');
    expect(updated[1].cancelled_quantity).toBe(1);
    expect(statusOf(orderId).status).toBe('submitted');

    const approvals = getDb()
      .prepare("SELECT * FROM order_approvals WHERE order_id = ? AND action = 'partially_cancelled'")
      .all(orderId);
    expect(approvals).toHaveLength(1);
    expect(approvals[0].reason).toBe('Customer reduced the order scope');
  });

  test('a cancellation cannot exceed the remaining undelivered quantity', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(sales);
    await sales.post(`/orders/${orderId}/submit`).expect(302);

    const lines = linesOf(orderId);
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');

    const response = await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({
        reason: 'Attempting too much',
        [`cancel_${lines[0].id}`]: '99',
      })
      .expect(302);

    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('only 5 remains undelivered');

    const updated = linesOf(orderId);
    expect(updated[0].cancelled_quantity).toBe(0);
    expect(statusOf(orderId).status).toBe('submitted');
  });

  test('a supervisor can cancel all remaining quantity and close the order', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(sales);
    await sales.post(`/orders/${orderId}/submit`).expect(302);

    const lines = linesOf(orderId);
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');

    await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({
        reason: 'No longer required by the customer',
        [`cancel_${lines[0].id}`]: '5',
        [`cancel_${lines[1].id}`]: '3',
      })
      .expect(302);

    expect(statusOf(orderId).status).toBe('cancelled');

    const updated = linesOf(orderId);
    expect(updated[0].cancelled_quantity).toBe(5);
    expect(updated[1].cancelled_quantity).toBe(3);
  });

  test('cancelling a draft cancels the whole order even without quantities', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const orderId = await createOrder(agent);

    await agent
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({ reason: 'Duplicate draft' })
      .expect(302);

    expect(statusOf(orderId).status).toBe('cancelled');
    const lines = linesOf(orderId);
    expect(lines[0].cancelled_quantity).toBe(5);
    expect(lines[1].cancelled_quantity).toBe(3);
  });

  test('warehouse staff only see orders that have entered fulfillment', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const draftId = await createOrder(sales);
    const draft = statusOf(draftId);

    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const list = await warehouse.get('/orders').expect(200);
    expect(list.text).not.toContain(draft.order_number);

    await warehouse.get(`/orders/${draftId}`).expect(403);

    await sales.post(`/orders/${draftId}/submit`).expect(302);
    const submitted = await warehouse.get('/orders').expect(200);
    // Submitted orders are not part of the warehouse queue either.
    expect(submitted.text).not.toContain(draft.order_number);
  });

  test('admin and warehouse roles cannot create sales orders', async () => {
    const admin = await loginAs(app, 'admin', 'admin123');
    await admin.get('/orders/new').expect(403);

    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    await warehouse.get('/orders/new').expect(403);
  });
});
