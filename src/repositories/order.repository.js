const { getDb } = require('../config/database');
const { now } = require('../utils/time');

function buildFilters({ status, customerId, q, statuses } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('so.status = ?');
    params.push(status);
  } else if (statuses && statuses.length) {
    conditions.push(`so.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (customerId) {
    conditions.push('so.customer_id = ?');
    params.push(customerId);
  }
  if (q) {
    conditions.push('(so.order_number LIKE ? OR c.name LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function list(filters = {}) {
  const { where, params } = buildFilters(filters);
  return getDb()
    .prepare(
      `SELECT so.*, c.name AS customer_name, c.code AS customer_code,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM sales_order_lines sol WHERE sol.order_id = so.id) AS line_count
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = so.created_by
       ${where}
       ORDER BY so.id DESC`
    )
    .all(...params);
}

function findById(id) {
  return (
    getDb()
      .prepare(
        `SELECT so.*, c.name AS customer_name, c.code AS customer_code, c.city AS customer_city,
                c.payment_terms_days, c.credit_limit, c.status AS customer_status,
                u.full_name AS created_by_name
         FROM sales_orders so
         JOIN customers c ON c.id = so.customer_id
         LEFT JOIN users u ON u.id = so.created_by
         WHERE so.id = ?`
      )
      .get(id) || null
  );
}

function findLines(orderId) {
  return getDb()
    .prepare(
      `SELECT sol.*, p.sku, p.name AS product_name, p.unit, p.status AS product_status,
              (SELECT COALESCE(SUM(dl.quantity), 0)
                 FROM delivery_lines dl
                 JOIN deliveries d ON d.id = dl.delivery_id
                WHERE dl.order_line_id = sol.id
                  AND d.status IN ('dispatched', 'delivered')) AS delivered_quantity,
              (SELECT COALESCE(SUM(il.quantity), 0)
                 FROM invoice_lines il
                 JOIN invoices i ON i.id = il.invoice_id
                WHERE i.status <> 'void'
                  AND il.delivery_line_id IN (
                    SELECT id FROM delivery_lines WHERE order_line_id = sol.id
                  )) AS invoiced_quantity
       FROM sales_order_lines sol
       JOIN products p ON p.id = sol.product_id
       WHERE sol.order_id = ?
       ORDER BY sol.id`
    )
    .all(orderId);
}

function listApprovals(orderId) {
  return getDb()
    .prepare(
      `SELECT oa.*, u.full_name AS acted_by_name
       FROM order_approvals oa
       LEFT JOIN users u ON u.id = oa.acted_by
       WHERE oa.order_id = ?
       ORDER BY oa.id DESC`
    )
    .all(orderId);
}

function listDeliveries(orderId) {
  return getDb()
    .prepare(
      `SELECT id, delivery_number, delivery_date, status, created_at
       FROM deliveries WHERE order_id = ? ORDER BY id DESC`
    )
    .all(orderId);
}

function listInvoices(orderId) {
  return getDb()
    .prepare(
      `SELECT id, invoice_number, invoice_date, due_date, status, total
       FROM invoices WHERE order_id = ? ORDER BY id DESC`
    )
    .all(orderId);
}

function createOrder(data, lines) {
  const db = getDb();
  const timestamp = now();

  const result = db
    .prepare(
      `INSERT INTO sales_orders
        (order_number, customer_id, order_date, status, subtotal, total, currency, notes, created_by, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, 'IDR', ?, ?, NULL, ?, ?)`
    )
    .run(
      data.orderNumber,
      data.customerId,
      data.orderDate,
      data.subtotal,
      data.total,
      data.notes || null,
      data.createdBy,
      timestamp,
      timestamp
    );

  const orderId = Number(result.lastInsertRowid);

  const insertLine = db.prepare(
    `INSERT INTO sales_order_lines
      (order_id, product_id, quantity, unit_price, line_total, cancelled_quantity)
     VALUES (?, ?, ?, ?, ?, 0)`
  );

  for (const line of lines) {
    insertLine.run(orderId, line.productId, line.quantity, line.unitPrice, line.lineTotal);
  }

  return orderId;
}

function updateOrder(id, data) {
  const db = getDb();
  const timestamp = now();

  db.prepare(
    `UPDATE sales_orders
     SET customer_id = ?, order_date = ?, subtotal = ?, total = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(data.customerId, data.orderDate, data.subtotal, data.total, data.notes || null, timestamp, id);

  db.prepare('DELETE FROM sales_order_lines WHERE order_id = ?').run(id);

  const insertLine = db.prepare(
    `INSERT INTO sales_order_lines
      (order_id, product_id, quantity, unit_price, line_total, cancelled_quantity)
     VALUES (?, ?, ?, ?, ?, 0)`
  );

  for (const line of data.lines) {
    insertLine.run(id, line.productId, line.quantity, line.unitPrice, line.lineTotal);
  }

  return findById(id);
}

function setStatus(id, status) {
  const timestamp = now();
  getDb()
    .prepare('UPDATE sales_orders SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, timestamp, id);
  return findById(id);
}

function markSubmitted(id) {
  const timestamp = now();
  getDb()
    .prepare(
      `UPDATE sales_orders
       SET status = 'submitted', submitted_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(timestamp, timestamp, id);
  return findById(id);
}

function cancelLine(lineId, cancelledQuantity, reason) {
  const timestamp = now();
  getDb()
    .prepare(
      `UPDATE sales_order_lines
       SET cancelled_quantity = ?, cancellation_reason = ?
       WHERE id = ?`
    )
    .run(cancelledQuantity, reason, lineId);
  return timestamp;
}

function addApproval({ orderId, action, reason, isOverride, actedBy }) {
  getDb()
    .prepare(
      `INSERT INTO order_approvals (order_id, action, reason, is_override, acted_by, acted_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(orderId, action, reason || null, isOverride ? 1 : 0, actedBy || null, now());
}

function hasDispatchedDeliveries(orderId) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM deliveries
       WHERE order_id = ? AND status IN ('dispatched', 'delivered')`
    )
    .get(orderId);
  return row.count > 0;
}

module.exports = {
  list,
  findById,
  findLines,
  listApprovals,
  listDeliveries,
  listInvoices,
  createOrder,
  updateOrder,
  setStatus,
  markSubmitted,
  cancelLine,
  addApproval,
  hasDispatchedDeliveries,
};
