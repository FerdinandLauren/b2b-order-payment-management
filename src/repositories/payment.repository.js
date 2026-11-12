const { getDb } = require('../config/database');
const { now } = require('../utils/time');

const OPEN_INVOICE_STATUSES = ['issued', 'partially_paid'];

function allocatedExpression(paymentAlias = 'p') {
  return `COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = ${paymentAlias}.id), 0)`;
}

function invoiceAllocatedExpression(invoiceAlias = 'i') {
  return `COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = ${invoiceAlias}.id), 0)`;
}

function buildFilters({ status, q, customerId } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (customerId) {
    conditions.push('p.customer_id = ?');
    params.push(customerId);
  }
  if (q) {
    conditions.push(
      '(p.payment_number LIKE ? OR p.reference LIKE ? OR c.name LIKE ? OR c.code LIKE ?)'
    );
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function list(filters = {}) {
  const { where, params } = buildFilters(filters);
  const allocated = allocatedExpression();
  return getDb()
    .prepare(
      `SELECT p.*, c.name AS customer_name, c.code AS customer_code,
              u.full_name AS created_by_name,
              ${allocated} AS allocated,
              p.amount - ${allocated} AS unallocated,
              (SELECT COUNT(*) FROM payment_allocations pa WHERE pa.payment_id = p.id) AS allocation_count
       FROM payments p
       JOIN customers c ON c.id = p.customer_id
       LEFT JOIN users u ON u.id = p.created_by
       ${where}
       ORDER BY p.id DESC`
    )
    .all(...params);
}

function findById(id) {
  const allocated = allocatedExpression();
  return (
    getDb()
      .prepare(
        `SELECT p.*, c.name AS customer_name, c.code AS customer_code,
                c.address AS customer_address, c.city AS customer_city,
                c.phone AS customer_phone, c.email AS customer_email,
                u.full_name AS created_by_name,
                ${allocated} AS allocated,
                p.amount - ${allocated} AS unallocated
         FROM payments p
         JOIN customers c ON c.id = p.customer_id
         LEFT JOIN users u ON u.id = p.created_by
         WHERE p.id = ?`
      )
      .get(id) || null
  );
}

function findAllocations(paymentId, today) {
  return getDb()
    .prepare(
      `SELECT pa.*, i.invoice_number, i.invoice_date, i.due_date,
              i.status AS invoice_status, i.total AS invoice_total,
              i.total - ${invoiceAllocatedExpression()} AS invoice_balance,
              CASE WHEN i.due_date < ?
                        AND i.total - ${invoiceAllocatedExpression()} > 0.005
                   THEN 1 ELSE 0 END AS is_overdue,
              so.order_number, d.delivery_number
       FROM payment_allocations pa
       JOIN invoices i ON i.id = pa.invoice_id
       JOIN sales_orders so ON so.id = i.order_id
       JOIN deliveries d ON d.id = i.delivery_id
       WHERE pa.payment_id = ?
       ORDER BY pa.id`
    )
    .all(today, paymentId);
}

function listOpenInvoices(customerId, today) {
  return getDb()
    .prepare(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, i.total,
              so.order_number, so.id AS order_id,
              ${invoiceAllocatedExpression()} AS allocated,
              i.total - ${invoiceAllocatedExpression()} AS balance,
              CASE WHEN i.due_date < ? THEN 1 ELSE 0 END AS is_overdue
       FROM invoices i
       JOIN sales_orders so ON so.id = i.order_id
       WHERE i.customer_id = ?
         AND i.status IN ('issued', 'partially_paid')
         AND i.total - ${invoiceAllocatedExpression()} > 0.005
       ORDER BY i.due_date ASC, i.id ASC`
    )
    .all(today, customerId);
}

function createPayment(data) {
  const timestamp = now();
  const result = getDb()
    .prepare(
      `INSERT INTO payments
        (payment_number, customer_id, payment_date, amount, method, reference, status, notes,
         created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?)`
    )
    .run(
      data.paymentNumber,
      data.customerId,
      data.paymentDate,
      data.amount,
      data.method,
      data.reference || null,
      data.notes || null,
      data.createdBy,
      timestamp,
      timestamp
    );
  return Number(result.lastInsertRowid);
}

function createAllocation(paymentId, invoiceId, amount) {
  const timestamp = now();
  getDb()
    .prepare(
      `INSERT INTO payment_allocations (payment_id, invoice_id, amount, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(paymentId, invoiceId, amount, timestamp);
}

function setStatus(id, status) {
  getDb()
    .prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now(), id);
}

function allocatedTotal(paymentId) {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(amount), 0) AS value FROM payment_allocations WHERE payment_id = ?')
    .get(paymentId);
  return Number(row.value) || 0;
}

module.exports = {
  OPEN_INVOICE_STATUSES,
  list,
  findById,
  findAllocations,
  listOpenInvoices,
  createPayment,
  createAllocation,
  setStatus,
  allocatedTotal,
};
