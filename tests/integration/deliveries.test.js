const {
  request,
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

async function approvedOrder(sales, supervisor, options = {}) {
  const {
    customerId = '8',
    productId = '4',
    quantity = '10',
    unitPrice = '950',
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

  const order = getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId);
  if (order.status !== 'approved') {
    throw new Error(`Order ${orderId} was not approved: ${order.status}`);
  }
  return orderId;
}

function linesOf(orderId) {
  return getDb()
    .prepare('SELECT * FROM sales_order_lines WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

function statusOf(orderId) {
  return getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId);
}

function deliveryOf(deliveryId) {
  return getDb().prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
}

function deliveryLinesOf(deliveryId) {
  return getDb()
    .prepare('SELECT * FROM delivery_lines WHERE delivery_id = ? ORDER BY id')
    .all(deliveryId);
}

function defaultWarehouseId() {
  return Number(
    getDb().prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'").get().value
  );
}

function balanceOf(productId) {
  const row = getDb()
    .prepare('SELECT on_hand, reserved FROM inventory_balances WHERE warehouse_id = ? AND product_id = ?')
    .get(defaultWarehouseId(), productId);
  return {
    onHand: row ? Number(row.on_hand) : 0,
    reserved: row ? Number(row.reserved) : 0,
  };
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

async function dispatch(warehouse, deliveryId) {
  await warehouse.post(`/deliveries/${deliveryId}/dispatch`).expect(302);
}

async function confirm(warehouse, deliveryId) {
  await warehouse.post(`/deliveries/${deliveryId}/confirm`).expect(302);
}

describe('Delivery and fulfillment management', () => {
  let app;

  beforeAll(() => {
    setupTestDb();
    app = createApp();
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('the warehouse sees approved orders ready for fulfillment', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { quantity: '10' });
    const order = statusOf(orderId);

    const index = await warehouse.get('/deliveries').expect(200);
    expect(index.text).toContain('Ready to fulfill');
    expect(index.text).toContain(order.order_number);

    const form = await warehouse.get(`/deliveries/new?orderId=${orderId}`).expect(200);
    expect(form.text).toContain(order.order_number);
    expect(form.text).toContain('Delivery lines');
    expect(form.text).toContain('Create delivery');
  });

  test('only warehouse staff can create deliveries and over-delivery is rejected', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { quantity: '10' });
    const line = linesOf(orderId)[0];

    await sales
      .post('/deliveries')
      .type('form')
      .send({ orderId: String(orderId), deliveryDate: '2026-11-12', [`quantity_${line.id}`]: '5' })
      .expect(403);

    const response = await warehouse
      .post('/deliveries')
      .type('form')
      .send({ orderId: String(orderId), deliveryDate: '2026-11-12', [`quantity_${line.id}`]: '11' })
      .expect(302);

    const page = await warehouse.get(response.headers.location).expect(200);
    expect(page.text).toContain('only 10 remains to be delivered');
    expect(
      getDb().prepare('SELECT COUNT(*) AS count FROM deliveries WHERE order_id = ?').get(orderId).count
    ).toBe(0);
  });

  test('dispatch issues stock and confirmation updates the order fulfillment status', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '5', quantity: '20', unitPrice: '6800' });
    const before = balanceOf(5);

    const deliveryId = await createDelivery(warehouse, orderId, 8);
    expect(deliveryOf(deliveryId).status).toBe('draft');

    await dispatch(warehouse, deliveryId);

    const afterDispatch = balanceOf(5);
    expect(afterDispatch.onHand).toBe(before.onHand - 8);
    expect(afterDispatch.reserved).toBe(before.reserved - 8);
    expect(deliveryOf(deliveryId).status).toBe('dispatched');
    expect(statusOf(orderId).status).toBe('approved');

    const movement = getDb()
      .prepare(
        "SELECT * FROM stock_movements WHERE movement_type = 'dispatch' AND reference_type = 'delivery' AND reference_id = ?"
      )
      .get(deliveryId);
    expect(movement).toBeTruthy();
    expect(movement.quantity).toBe(-8);

    await confirm(warehouse, deliveryId);

    expect(deliveryOf(deliveryId).status).toBe('delivered');
    expect(statusOf(orderId).status).toBe('partially_fulfilled');

    const orderPage = await warehouse.get(`/orders/${orderId}`).expect(200);
    expect(orderPage.text).toContain('Partially Fulfilled');

    const secondDelivery = await createDelivery(warehouse, orderId, 12);
    await dispatch(warehouse, secondDelivery);
    await confirm(warehouse, secondDelivery);

    expect(statusOf(orderId).status).toBe('fulfilled');
    const afterAll = balanceOf(5);
    expect(afterAll.onHand).toBe(before.onHand - 20);
  });

  test('a delivery exception can be resolved as delivered', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '14', quantity: '5', unitPrice: '56000' });

    const deliveryId = await createDelivery(warehouse, orderId, 5);
    await dispatch(warehouse, deliveryId);

    await warehouse
      .post(`/deliveries/${deliveryId}/exception`)
      .type('form')
      .send({ reason: 'Customer was closed on the delivery day' })
      .expect(302);

    expect(deliveryOf(deliveryId).status).toBe('delivery_exception');
    expect(deliveryOf(deliveryId).exception_reason).toBe('Customer was closed on the delivery day');

    await warehouse
      .post(`/deliveries/${deliveryId}/resolve`)
      .type('form')
      .send({ outcome: 'delivered', note: 'Redelivered the next morning' })
      .expect(302);

    expect(deliveryOf(deliveryId).status).toBe('delivered');
    expect(statusOf(orderId).status).toBe('fulfilled');
  });

  test('resolving an exception as cancelled reverses the dispatch and restores stock', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '1', quantity: '6', unitPrice: '68000' });
    const before = balanceOf(1);

    const deliveryId = await createDelivery(warehouse, orderId, 6);
    await dispatch(warehouse, deliveryId);
    expect(balanceOf(1).onHand).toBe(before.onHand - 6);

    await warehouse
      .post(`/deliveries/${deliveryId}/exception`)
      .type('form')
      .send({ reason: 'Goods damaged in transit' })
      .expect(302);

    await warehouse
      .post(`/deliveries/${deliveryId}/resolve`)
      .type('form')
      .send({ outcome: 'cancelled', note: 'Goods returned to the warehouse' })
      .expect(302);

    expect(deliveryOf(deliveryId).status).toBe('cancelled');
    expect(balanceOf(1).onHand).toBe(before.onHand);
    expect(balanceOf(1).reserved).toBe(before.reserved);
    expect(statusOf(orderId).status).toBe('approved');

    const reversal = getDb()
      .prepare(
        "SELECT * FROM stock_movements WHERE movement_type = 'dispatch_reversal' AND reference_type = 'delivery' AND reference_id = ?"
      )
      .get(deliveryId);
    expect(reversal).toBeTruthy();
    expect(reversal.quantity).toBe(6);

    const replacement = await createDelivery(warehouse, orderId, 6);
    expect(deliveryOf(replacement).status).toBe('draft');
  });

  test('an open draft delivery blocks order cancellation until it is cancelled', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '5', quantity: '10', unitPrice: '6800' });
    const line = linesOf(orderId)[0];

    const deliveryId = await createDelivery(warehouse, orderId, 4);

    const blocked = await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({ reason: 'Customer cancelled the order', [`cancel_${line.id}`]: '10' })
      .expect(302);
    const blockedPage = await supervisor.get(blocked.headers.location).expect(200);
    expect(blockedPage.text).toContain('Cancel open draft deliveries');
    expect(statusOf(orderId).status).toBe('approved');

    await warehouse
      .post(`/deliveries/${deliveryId}/cancel`)
      .type('form')
      .send({ reason: 'Delivery not required' })
      .expect(302);

    expect(deliveryOf(deliveryId).status).toBe('cancelled');

    await supervisor
      .post(`/orders/${orderId}/cancel`)
      .type('form')
      .send({ reason: 'Customer cancelled the order', [`cancel_${line.id}`]: '10' })
      .expect(302);

    expect(statusOf(orderId).status).toBe('cancelled');
  });

  test('non-warehouse roles cannot dispatch or confirm deliveries', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '5', quantity: '3', unitPrice: '6800' });
    const deliveryId = await createDelivery(warehouse, orderId, 3);

    await sales.post(`/deliveries/${deliveryId}/dispatch`).expect(403);
    await supervisor.post(`/deliveries/${deliveryId}/dispatch`).expect(403);
    await sales.post(`/deliveries/${deliveryId}/confirm`).expect(403);

    expect(deliveryOf(deliveryId).status).toBe('draft');
  });

  test('dispatch is blocked when reserved stock is no longer available', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    const supervisor = await loginAs(app, 'supervisor', 'supervisor123');
    const warehouse = await loginAs(app, 'warehouse', 'warehouse123');
    const orderId = await approvedOrder(sales, supervisor, { productId: '6', quantity: '5', unitPrice: '78500' });
    const deliveryId = await createDelivery(warehouse, orderId, 5);
    const before = balanceOf(6);

    getDb()
      .prepare('UPDATE inventory_balances SET reserved = 0 WHERE warehouse_id = ? AND product_id = 6')
      .run(defaultWarehouseId());

    const response = await warehouse.post(`/deliveries/${deliveryId}/dispatch`).expect(302);
    const page = await warehouse.get(response.headers.location).expect(200);
    expect(page.text).toContain('are reserved for this order');
    expect(deliveryOf(deliveryId).status).toBe('draft');
    expect(balanceOf(6).onHand).toBe(before.onHand);

    getDb()
      .prepare('UPDATE inventory_balances SET reserved = 5 WHERE warehouse_id = ? AND product_id = 6')
      .run(defaultWarehouseId());
  });
});
