const {
  request,
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

describe('Master data and inventory management', () => {
  let app;

  beforeAll(() => {
    setupTestDb();
    app = createApp();
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('sales staff can browse the customer list', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const response = await agent.get('/customers').expect(200);
    expect(response.text).toContain('PT Bangun Jaya Konstruksi');
    expect(response.text).toContain('Customers');
  });

  test('warehouse staff cannot access customer records', async () => {
    const agent = await loginAs(app, 'warehouse', 'warehouse123');
    await agent.get('/customers').expect(403);
  });

  test('sales staff can create a customer with a generated code', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const response = await agent
      .post('/customers')
      .type('form')
      .send({
        name: 'PT Uji Coba Nusantara',
        address: 'Jl. Pengujian No. 1',
        city: 'Jakarta',
        phone: '021-555 0101',
        email: 'test@ujicoba.co.id',
        npwp: '09.999.999.9-011.000',
        paymentTermsDays: '30',
        creditLimit: '150000000',
      })
      .expect(302);

    expect(response.headers.location).toMatch(/^\/customers\/\d+$/);

    const detail = await agent.get(response.headers.location).expect(200);
    expect(detail.text).toContain('PT Uji Coba Nusantara');
    expect(detail.text).toContain('CUST-');
    expect(detail.text).toContain('Rp 150.000.000');
  });

  test('customer validation rejects a negative credit limit', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const response = await agent
      .post('/customers')
      .type('form')
      .send({
        name: 'Invalid Customer',
        paymentTermsDays: '30',
        creditLimit: '-1',
      })
      .expect(302);

    const page = await agent.get(response.headers.location).expect(200);
    expect(page.text).toContain('Credit limit cannot be negative');
  });

  test('admin can create a product and non-admin cannot', async () => {
    const sales = await loginAs(app, 'sales', 'sales123');
    await sales.get('/products/new').expect(403);

    const admin = await loginAs(app, 'admin', 'admin123');
    const response = await admin
      .post('/products')
      .type('form')
      .send({
        name: 'Produk Uji Coba',
        categoryId: '1',
        unit: 'pcs',
        unitPrice: '125000',
      })
      .expect(302);

    const detail = await admin.get(response.headers.location).expect(200);
    expect(detail.text).toContain('Produk Uji Coba');
    expect(detail.text).toContain('PRD-');
    expect(detail.text).toContain('Rp 125.000');
  });

  test('warehouse staff can record a stock adjustment and it appears in history', async () => {
    const agent = await loginAs(app, 'warehouse', 'warehouse123');
    const db = getDb();
    const warehouseId = db
      .prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'")
      .get().value;
    const product = db.prepare("SELECT id, sku FROM products WHERE sku = 'SEM-50'").get();
    const before = db
      .prepare('SELECT on_hand FROM inventory_balances WHERE warehouse_id = ? AND product_id = ?')
      .get(warehouseId, product.id).on_hand;

    await agent
      .post('/inventory/adjustments')
      .type('form')
      .send({
        productId: String(product.id),
        warehouseId: String(warehouseId),
        movementType: 'adjustment_in',
        quantity: '25',
        reason: 'Cycle count correction',
      })
      .expect(302);

    const after = db
      .prepare('SELECT on_hand FROM inventory_balances WHERE warehouse_id = ? AND product_id = ?')
      .get(warehouseId, product.id).on_hand;
    expect(after).toBe(before + 25);

    const movements = await agent
      .get(`/inventory/movements?productId=${product.id}`)
      .expect(200);
    expect(movements.text).toContain('Cycle count correction');
    expect(movements.text).toContain('Adjustment In');
  });

  test('an adjustment cannot push on-hand below zero', async () => {
    const agent = await loginAs(app, 'warehouse', 'warehouse123');
    const db = getDb();
    const warehouseId = db
      .prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'")
      .get().value;
    const product = db.prepare("SELECT id FROM products WHERE sku = 'SEM-50'").get();

    const response = await agent
      .post('/inventory/adjustments')
      .type('form')
      .send({
        productId: String(product.id),
        warehouseId: String(warehouseId),
        movementType: 'adjustment_out',
        quantity: '999999',
        reason: 'Invalid negative adjustment',
      })
      .expect(302);

    const page = await agent.get(response.headers.location).expect(200);
    expect(page.text).toContain('on-hand stock negative');
  });

  test('finance staff cannot view inventory balances', async () => {
    const agent = await loginAs(app, 'finance', 'finance123');
    await agent.get('/inventory').expect(403);
  });

  test('admin can create a warehouse and rename a category', async () => {
    const agent = await loginAs(app, 'admin', 'admin123');

    await agent
      .post('/warehouses')
      .type('form')
      .send({ code: 'WH-BDG', name: 'Gudang Bandung', address: 'Jl. Soekarno Hatta 100' })
      .expect(302);

    const warehouses = await agent.get('/warehouses').expect(200);
    expect(warehouses.text).toContain('Gudang Bandung');
    expect(warehouses.text).toContain('WH-BDG');

    await agent
      .post('/categories')
      .type('form')
      .send({ name: 'Test Category' })
      .expect(302);

    const categories = await agent.get('/categories').expect(200);
    expect(categories.text).toContain('Test Category');
  });

  test('the default warehouse cannot be deactivated', async () => {
    const agent = await loginAs(app, 'admin', 'admin123');
    const db = getDb();
    const warehouseId = db
      .prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'")
      .get().value;

    const response = await agent
      .post(`/warehouses/${warehouseId}/status`)
      .type('form')
      .send({ status: 'inactive' })
      .expect(302);

    const page = await agent.get(response.headers.location).expect(200);
    expect(page.text).toContain('default warehouse cannot be deactivated');
  });
});
