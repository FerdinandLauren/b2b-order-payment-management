const { now } = require('../../utils/time');
const { PRODUCTS } = require('./products.seeder');

const WAREHOUSES = [
  {
    code: 'WH-JKT',
    name: 'Gudang Pusat Jakarta',
    address: 'Jl. Raya Bekasi KM 18, Cakung, Jakarta Timur',
    status: 'active',
  },
];

module.exports = function seedInventory(db) {
  const timestamp = now();

  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (code, name, address, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const warehouseIds = [];
  for (const warehouse of WAREHOUSES) {
    const result = insertWarehouse.run(
      warehouse.code,
      warehouse.name,
      warehouse.address,
      warehouse.status,
      timestamp,
      timestamp
    );
    warehouseIds.push(Number(result.lastInsertRowid));
  }

  const mainWarehouseId = warehouseIds[0];

  const insertBalance = db.prepare(`
    INSERT INTO inventory_balances (warehouse_id, product_id, on_hand, reserved)
    VALUES (?, ?, ?, 0)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements
      (product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
    VALUES (?, ?, 'receipt', ?, 'opening_balance', NULL, 'Opening stock', NULL, ?)
  `);

  for (const product of PRODUCTS) {
    const row = db.prepare('SELECT id FROM products WHERE sku = ?').get(product.sku);
    if (!row) continue;

    insertBalance.run(mainWarehouseId, row.id, product.on_hand);
    insertMovement.run(row.id, mainWarehouseId, product.on_hand, timestamp);
  }

  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES
      ('company_name', 'PT Maju Bersama', ?),
      ('default_warehouse_id', ?, ?),
      ('credit_check_enabled', '1', ?)
  `).run(timestamp, String(mainWarehouseId), timestamp, timestamp);

  return PRODUCTS.length;
};

module.exports.WAREHOUSES = WAREHOUSES;
