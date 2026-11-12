const { getDb } = require('../config/database');

function list() {
  return getDb()
    .prepare(
      `SELECT w.*,
              (SELECT COUNT(*) FROM inventory_balances ib WHERE ib.warehouse_id = w.id) AS product_count,
              (SELECT COALESCE(SUM(ib.on_hand), 0) FROM inventory_balances ib WHERE ib.warehouse_id = w.id) AS on_hand
       FROM warehouses w ORDER BY w.name`
    )
    .all();
}

function findById(id) {
  return getDb().prepare('SELECT * FROM warehouses WHERE id = ?').get(id) || null;
}

function findByCode(code) {
  return getDb().prepare('SELECT * FROM warehouses WHERE code = ?').get(code) || null;
}

function create(data) {
  const timestamp = require('../utils/time').now();
  const result = getDb()
    .prepare(
      `INSERT INTO warehouses (code, name, address, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`
    )
    .run(data.code, data.name, data.address || null, timestamp, timestamp);
  return findById(Number(result.lastInsertRowid));
}

function update(id, data) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare('UPDATE warehouses SET name = ?, address = ?, updated_at = ? WHERE id = ?')
    .run(data.name, data.address || null, timestamp, id);
  return findById(id);
}

function setStatus(id, status) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare('UPDATE warehouses SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, timestamp, id);
  return findById(id);
}

function defaultWarehouseId() {
  const setting = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'default_warehouse_id'")
    .get();
  if (setting && setting.value) return Number(setting.value);

  const warehouse = getDb()
    .prepare("SELECT id FROM warehouses WHERE status = 'active' ORDER BY id LIMIT 1")
    .get();
  return warehouse ? warehouse.id : null;
}

module.exports = {
  list,
  findById,
  findByCode,
  create,
  update,
  setStatus,
  defaultWarehouseId,
};
