const { getDb } = require('../config/database');

const STOCK_SUBQUERY = `
  (SELECT COALESCE(SUM(ib.on_hand), 0) FROM inventory_balances ib WHERE ib.product_id = p.id) AS on_hand,
  (SELECT COALESCE(SUM(ib.reserved), 0) FROM inventory_balances ib WHERE ib.product_id = p.id) AS reserved
`;

function list({ q, categoryId, status } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term);
  }
  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDb()
    .prepare(
      `SELECT p.*, c.name AS category_name, ${STOCK_SUBQUERY}
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.name`
    )
    .all(...params);
}

function findById(id) {
  return getDb()
    .prepare(
      `SELECT p.*, c.name AS category_name, ${STOCK_SUBQUERY}
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id) || null;
}

function findBySku(sku) {
  return getDb().prepare('SELECT * FROM products WHERE sku = ?').get(sku) || null;
}

function create(data) {
  const timestamp = require('../utils/time').now();
  const result = getDb()
    .prepare(
      `INSERT INTO products (sku, name, category_id, unit, unit_price, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(
      data.sku,
      data.name,
      data.categoryId || null,
      data.unit,
      data.unitPrice,
      timestamp,
      timestamp
    );
  return findById(Number(result.lastInsertRowid));
}

function update(id, data) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare(
      `UPDATE products
       SET name = ?, category_id = ?, unit = ?, unit_price = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      data.name,
      data.categoryId || null,
      data.unit,
      data.unitPrice,
      timestamp,
      id
    );
  return findById(id);
}

function setStatus(id, status) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, timestamp, id);
  return findById(id);
}

function activeCount() {
  return getDb().prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'active'").get().count;
}

/* Categories */
function listCategories() {
  return getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM product_categories c ORDER BY c.name`
    )
    .all();
}

function findCategoryById(id) {
  return getDb().prepare('SELECT * FROM product_categories WHERE id = ?').get(id) || null;
}

function findCategoryByName(name) {
  return getDb()
    .prepare('SELECT * FROM product_categories WHERE lower(name) = lower(?)')
    .get(name) || null;
}

function createCategory(name) {
  const timestamp = require('../utils/time').now();
  const result = getDb()
    .prepare('INSERT INTO product_categories (name, created_at) VALUES (?, ?)')
    .run(name, timestamp);
  return findCategoryById(Number(result.lastInsertRowid));
}

function renameCategory(id, name) {
  getDb().prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(name, id);
  return findCategoryById(id);
}

module.exports = {
  list,
  findById,
  findBySku,
  create,
  update,
  setStatus,
  activeCount,
  listCategories,
  findCategoryById,
  findCategoryByName,
  createCategory,
  renameCategory,
};
