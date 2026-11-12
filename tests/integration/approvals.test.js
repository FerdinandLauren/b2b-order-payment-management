const {
  request,
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

async function createOrder(agent, { customerId = '1', productId = '1', quantity = '5', unitPrice = '68000' } = {}) {
  const response = await agent
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
  return Number(match[1]);
}

async function submitOrder(agent, orderId) {
  await agent.post(`/orders/${orderId}/submit`).expect(302);
}

async function submittedOrder(agent, options) {
  const orderId = await createOrder(agent, options);
  await submitOrder(agent, orderId);
  return orderId;
}

function statusOf(orderId) {
  return getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId);
}

function linesOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

function defaultWarehouseId() {
  return Number(
    getDb().prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'").get().value
  );
}

function reservedOf(productId) {
  const row = getDb()
    .prepare('SELECT reserved FROM inventory_balances WHERE warehouse_id = ? AND product_id = ?')
    .get(defaultWarehouseId(), productId);
  return row ? Number(row.reserved) : 0;
}

function approvalsOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM order_approvals WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

function auditOf(orderId, action) {
  return getDb()
    .prepare("SELECT * FROM audit_logs WHERE entity_type = 'sales_order' AND entity_id = ? AND action = ?")
    .all(orderId, action);
}

describe('Order approval and inventory reservation', () => {
  let app;

  beforeAll(() => {
    setupTestDb();
    app = createApp();
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('supervisors see a submitted order in the queue and can review credit and stock', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const orderId = await submittedOrder(sales, { productId: '1', quantity: '5' });
    const order = statusOf(orderId);
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');

    const queue = await supervisor.get('/approvals').expect(200);
    expect(queue.text).toContain(order.order_number);
    expect(queue.text).toContain('Within limit');
    expect(queue.text).toContain('Available');

    const review = await supervisor.get(`/approvals/${orderId}`).expect(200);
    expect(review.text).toContain(order.order_number);
    expect(review.text).toContain('Credit exposure');
    expect(review.text).toContain('Stock availability');
    expect(review.text).toContain('Approve and reserve stock');
    expect(review.text).toContain('Reject order');
  });

  test('non-supervisor roles cannot access the approval queue', async () => {
    for (const [username, password] of [
      ['sales', 'sales123'],
      ['warehouse', 'warehouse123'],
      ['finance', 'finance123'],
      ['admin', 'admin123'],
      ['management', 'management123'],
    ]) {
      const agent = await loginAs(app, username, password);
      await agent.get('/approvals').expect(403);
    }
  });

  test('approval reserves stock, records history, and writes an audit event', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(1);
    const orderId = await submittedOrder(sales, { productId: '1', quantity: '5' });

    await supervisor.post(`/approvals/${orderId}/approve`).type('form').send({}).expect(302);

    const order = statusOf(orderId);
    expect(order.status).toBe('approved');
    expect(reservedOf(1)).toBe(before + 5);

    const movement = getDb()
      .prepare(
        "SELECT * FROM stock_movements WHERE movement_type = 'reservation' AND reference_type = 'sales_order' AND reference_id = ?"
      )
      .get(orderId);
    expect(movement).toBeTruthy();
    expect(movement.quantity).toBe(5);

    const approvals = approvalsOf(orderId);
    const last = approvals[approvals.length - 1];
    expect(last.action).toBe('approved');
    expect(last.is_override).toBe(0);
    expect(last.acted_by).toBeTruthy();

    const audit = auditOf(orderId, 'order_approved');
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].details).creditWarning).toBe(false);

    const detail = await supervisor.get(`/orders/${orderId}`).expect(200);
    expect(detail.text).toContain('Approved');
  });

  test('a supervisor cannot approve an order they created', async () => {
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(7);
    const orderId = await submittedOrder(supervisor, { productId: '7', quantity: '1' });

    const response = await supervisor
      .post(`/approvals/${orderId}/approve`)
      .type('form')
      .send({})
      .expect(302);

    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('cannot approve or reject an order you created');
    expect(statusOf(orderId).status).toBe('submitted');
    expect(reservedOf(7)).toBe(before);
  });

  test('rejection requires a reason and reserves no stock', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(5);
    const orderId = await submittedOrder(sales, { productId: '5', quantity: '10', unitPrice: '6800' });

    const invalid = await supervisor
      .post(`/approvals/${orderId}/reject`)
      .type('form')
      .send({ reason: 'No' })
      .expect(302);
    const invalidPage = await supervisor.get(invalid.headers.location).expect(200);
    expect(invalidPage.text).toContain('at least 3 characters');
    expect(statusOf(orderId).status).toBe('submitted');

    await supervisor
      .post(`/approvals/${orderId}/reject`)
      .type('form')
      .send({ reason: 'Credit terms not agreed with the customer' })
      .expect(302);

    expect(statusOf(orderId).status).toBe('rejected');
    expect(reservedOf(5)).toBe(before);

    const approvals = approvalsOf(orderId);
    const last = approvals[approvals.length - 1];
    expect(last.action).toBe('rejected');
    expect(last.reason).toBe('Credit terms not agreed with the customer');
    expect(auditOf(orderId, 'order_rejected')).toHaveLength(1);
  });

  test('approval is blocked when stock is insufficient', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(2);
    const orderId = await submittedOrder(sales, {
      productId: '2',
      quantity: '500',
      unitPrice: '275000',
    });

    const review = await supervisor.get(`/approvals/${orderId}`).expect(200);
    expect(review.text).toContain('Approval is blocked');

    const response = await supervisor
      .post(`/approvals/${orderId}/approve`)
      .type('form')
      .send({})
      .expect(302);

    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('insufficient stock');
    expect(statusOf(orderId).status).toBe('submitted');
    expect(reservedOf(2)).toBe(before);
  });

  test('credit warnings require an override justification before approval', async () => {
    const db = getDb();
    db.prepare('UPDATE customers SET credit_limit = 10000000 WHERE id = 4').run();

    try {
      const sales = await loginAs(app, 'sales', 'sales123');
      const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
      const before = reservedOf(3);
      const orderId = await submittedOrder(sales, {
        customerId: '4',
        productId: '3',
        quantity: '50',
        unitPrice: '340000',
      });

      const review = await supervisor.get(`/approvals/${orderId}`).expect(200);
      expect(review.text).toContain('exceeds the credit limit by');
      expect(review.text).toContain('Rp 7.000.000');
      expect(review.text).toContain('Credit override justification');

      const blocked = await supervisor
        .post(`/approvals/${orderId}/approve`)
        .type('form')
        .send({})
        .expect(302);
      const blockedPage = await supervisor.get(blocked.headers.location).expect(200);
      expect(blockedPage.text).toContain('Provide an override justification');
      expect(statusOf(orderId).status).toBe('submitted');
      expect(reservedOf(3)).toBe(before);

      await supervisor
        .post(`/approvals/${orderId}/approve`)
        .type('form')
        .send({ overrideReason: 'Approved by the finance director for a strategic project.' })
        .expect(302);

      expect(statusOf(orderId).status).toBe('approved');
      expect(reservedOf(3)).toBe(before + 50);

      const approvals = approvalsOf(orderId);
      const last = approvals[approvals.length - 1];
      expect(last.action).toBe('approved');
      expect(last.is_override).toBe(1);
      expect(last.reason).toBe('Approved by the finance director for a strategic project.');

      const audit = auditOf(orderId, 'order_approved');
      expect(audit).toHaveLength(1);
      expect(JSON.parse(audit[0].details).creditWarning).toBe(true);
    } finally {
      db.prepare('UPDATE customers SET credit_limit = 50000000 WHERE id = 4').run();
    }
  });

  test('partially cancelled submitted orders keep their remaining quantity approvable', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(4);
    const orderId = await submittedOrder(sales, {
      productId: '4',
      quantity: '100',
      unitPrice: '950',
    });

    const line = linesOf(orderId)[0];
    await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({ reason: 'Customer reduced scope', [`cancel_${line.id}`]: '40' })
      .expect(302);

    expect(statusOf(orderId).status).toBe('submitted');
    expect(linesOf(orderId)[0].cancelled_quantity).toBe(40);

    await supervisor.post(`/approvals/${orderId}/approve`).type('form').send({}).expect(302);

    expect(statusOf(orderId).status).toBe('approved');
    expect(reservedOf(4)).toBe(before + 60);
  });

  test('competing approvals cannot reserve more stock than is available', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');

    const balance = getDb()
      .prepare('SELECT on_hand, reserved FROM inventory_balances WHERE warehouse_id = ? AND product_id = 3')
      .get(defaultWarehouseId());
    const available = Number(balance.on_hand) - Number(balance.reserved);
    const firstQuantity = Math.floor(available * 0.75);
    const secondQuantity = available - firstQuantity + 1;

    const firstOrder = await submittedOrder(sales, {
      customerId: '8',
      productId: '3',
      quantity: String(firstQuantity),
      unitPrice: '340000',
    });
    const secondOrder = await submittedOrder(sales, {
      customerId: '8',
      productId: '3',
      quantity: String(secondQuantity),
      unitPrice: '340000',
    });

    // Both orders pass the pre-check while stock is still unreserved.
    await supervisor.get(`/approvals/${firstOrder}`).expect(200);
    await supervisor.get(`/approvals/${secondOrder}`).expect(200);

    await supervisor.post(`/approvals/${firstOrder}/approve`).type('form').send({}).expect(302);
    expect(statusOf(firstOrder).status).toBe('approved');

    const response = await supervisor
      .post(`/approvals/${secondOrder}/approve`)
      .type('form')
      .send({})
      .expect(302);
    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('insufficient stock');
    expect(statusOf(secondOrder).status).toBe('submitted');

    const after = getDb()
      .prepare('SELECT reserved FROM inventory_balances WHERE warehouse_id = ? AND product_id = 3')
      .get(defaultWarehouseId());
    expect(Number(after.reserved)).toBeLessThanOrEqual(Number(balance.on_hand));
  });

  test('an approved order cannot be approved twice', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const before = reservedOf(6);
    const orderId = await submittedOrder(sales, {
      productId: '6',
      quantity: '5',
      unitPrice: '78500',
    });

    await supervisor.post(`/approvals/${orderId}/approve`).type('form').send({}).expect(302);
    expect(reservedOf(6)).toBe(before + 5);

    const response = await supervisor
      .post(`/approvals/${orderId}/approve`)
      .type('form')
      .send({})
      .expect(302);
    const page = await supervisor.get(response.headers.location).expect(200);
    expect(page.text).toContain('Only submitted orders can be approved or rejected');
    expect(reservedOf(6)).toBe(before + 5);
  });
});
