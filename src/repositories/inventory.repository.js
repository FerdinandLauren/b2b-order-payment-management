const { getDb } = require('../config/database');
const { now } = require('../utils/time');

function listBalances({ q, warehouseId } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term);
  }
  if (warehouseId) {
    conditions.push('ib.warehouse_id = ?');
    params.push(warehouseId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDb()
    .prepare(
      `SELECT ib.warehouse_id, ib.product_id, ib.on_hand, ib.reserved,
              (ib.on_hand - ib.reserved) AS available,
              p.sku, p.name AS product_name, p.unit, p.status AS product_status,
              c.name AS category_name, w.name AS warehouse_name, w.code AS warehouse_code
       FROM inventory_balances ib
       JOIN products p ON p.id = ib.product_id
       LEFT JOIN product_categories c ON c.id = p.category_id
       JOIN warehouses w ON w.id = ib.warehouse_id
       ${where}
       ORDER BY p.name`
    )
    .all(...params);
}

function getBalance(warehouseId, productId) {
  return (
    getDb()
      .prepare('SELECT * FROM inventory_balances WHERE warehouse_id = ? AND product_id = ?')
      .get(warehouseId, productId) || null
  );
}

function ensureBalance(warehouseId, productId) {
  getDb()
    .prepare(
      `INSERT INTO inventory_balances (warehouse_id, product_id, on_hand, reserved)
       VALUES (?, ?, 0, 0)
       ON CONFLICT(warehouse_id, product_id) DO NOTHING`
    )
    .run(warehouseId, productId);
  return getBalance(warehouseId, productId);
}

function setOnHand(warehouseId, productId, onHand) {
  getDb()
    .prepare(
      'UPDATE inventory_balances SET on_hand = ? WHERE warehouse_id = ? AND product_id = ?'
    )
    .run(onHand, warehouseId, productId);
}

function changeReserved(warehouseId, productId, delta) {
  getDb()
    .prepare(
      `UPDATE inventory_balances SET reserved = reserved + ?
       WHERE warehouse_id = ? AND product_id = ?`
    )
    .run(delta, warehouseId, productId);
}

function createMovement(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO stock_movements
        (product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.productId,
      data.warehouseId,
      data.movementType,
      data.quantity,
      data.referenceType || null,
      data.referenceId || null,
      data.reason || null,
      data.createdBy || null,
      data.createdAt || now()
    );
  return Number(result.lastInsertRowid);
}

function listMovements({ productId, warehouseId, movementType, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (productId) {
    conditions.push('m.product_id = ?');
    params.push(productId);
  }
  if (warehouseId) {
    conditions.push('m.warehouse_id = ?');
    params.push(warehouseId);
  }
  if (movementType) {
    conditions.push('m.movement_type = ?');
    params.push(movementType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = getDb()
    .prepare(
      `SELECT m.*, p.name AS product_name, p.sku, w.name AS warehouse_name, u.full_name AS user_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN warehouses w ON w.id = m.warehouse_id
       LEFT JOIN users u ON u.id = m.created_by
       ${where}
       ORDER BY m.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const total = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM stock_movements m ${where}`)
    .get(...params).count;

  return { rows, total };
}

function movementSummary() {
  return getDb()
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN movement_type = 'receipt' THEN quantity ELSE 0 END), 0) AS receipts,
        COALESCE(SUM(CASE WHEN movement_type = 'dispatch' THEN quantity ELSE 0 END), 0) AS dispatched,
        COUNT(*) AS movement_count
       FROM stock_movements`
    )
    .get();
}

module.exports = {
  listBalances,
  getBalance,
  ensureBalance,
  setOnHand,
  changeReserved,
  createMovement,
  listMovements,
  movementSummary,
};
