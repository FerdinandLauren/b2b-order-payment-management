const { getDb } = require('../config/database');

function buildFilters({ q, status } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(c.name LIKE ? OR c.code LIKE ? OR c.city LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term, term);
  }
  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function list(filters = {}) {
  const { where, params } = buildFilters(filters);
  return getDb()
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM sales_orders so WHERE so.customer_id = c.id) AS order_count
       FROM customers c
       ${where}
       ORDER BY c.name`
    )
    .all(...params);
}

function findById(id) {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) || null;
}

function findByCode(code) {
  return getDb().prepare('SELECT * FROM customers WHERE code = ?').get(code) || null;
}

function create(data) {
  const timestamp = require('../utils/time').now();
  const result = getDb()
    .prepare(
      `INSERT INTO customers
        (code, name, address, city, phone, email, npwp, payment_terms_days, credit_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(
      data.code,
      data.name,
      data.address || null,
      data.city || null,
      data.phone || null,
      data.email || null,
      data.npwp || null,
      data.paymentTermsDays,
      data.creditLimit,
      timestamp,
      timestamp
    );
  return findById(Number(result.lastInsertRowid));
}

function update(id, data) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare(
      `UPDATE customers
       SET name = ?, address = ?, city = ?, phone = ?, email = ?, npwp = ?,
           payment_terms_days = ?, credit_limit = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      data.name,
      data.address || null,
      data.city || null,
      data.phone || null,
      data.email || null,
      data.npwp || null,
      data.paymentTermsDays,
      data.creditLimit,
      timestamp,
      id
    );
  return findById(id);
}

function setStatus(id, status) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare('UPDATE customers SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, timestamp, id);
  return findById(id);
}

function summary(customerId, today) {
  return getDb()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sales_orders
          WHERE customer_id = ? AND status IN ('draft', 'submitted', 'approved', 'partially_fulfilled')) AS open_orders,
        (SELECT COALESCE(SUM(total), 0) FROM sales_orders
          WHERE customer_id = ? AND status IN ('approved', 'partially_fulfilled')) AS open_order_value,
        (SELECT COALESCE(SUM(
            i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)
          ), 0)
          FROM invoices i
          WHERE i.customer_id = ? AND i.status IN ('issued', 'partially_paid')) AS outstanding,
        (SELECT COUNT(*) FROM invoices i
          WHERE i.customer_id = ? AND i.status IN ('issued', 'partially_paid')
            AND i.due_date < ?
            AND (i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)) > 0) AS overdue_count`
    )
    .get(customerId, customerId, customerId, customerId, today);
}

function recentOrders(customerId, limit = 5) {
  return getDb()
    .prepare(
      `SELECT id, order_number, order_date, status, total
       FROM sales_orders WHERE customer_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(customerId, limit);
}

function recentInvoices(customerId, limit = 5) {
  return getDb()
    .prepare(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, i.total,
              (i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)) AS balance
       FROM invoices i WHERE i.customer_id = ?
       ORDER BY i.id DESC LIMIT ?`
    )
    .all(customerId, limit);
}

module.exports = {
  list,
  findById,
  findByCode,
  create,
  update,
  setStatus,
  summary,
  recentOrders,
  recentInvoices,
};
