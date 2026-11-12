const { getDb } = require('../config/database');
const { now } = require('../utils/time');

const COMMITTED_STATUSES = ['draft', 'dispatched', 'delivered', 'delivery_exception'];
const DISPATCHED_STATUSES = ['dispatched', 'delivered', 'delivery_exception'];
const FULFILLABLE_ORDER_STATUSES = ['approved', 'partially_fulfilled', 'partially_cancelled'];

function committedPlaceholders() {
  return COMMITTED_STATUSES.map(() => '?').join(', ');
}

function buildFilters({ status, q, orderId } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('d.status = ?');
    params.push(status);
  }
  if (orderId) {
    conditions.push('d.order_id = ?');
    params.push(orderId);
  }
  if (q) {
    conditions.push('(d.delivery_number LIKE ? OR so.order_number LIKE ? OR c.name LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term, term);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function list(filters = {}) {
  const { where, params } = buildFilters(filters);
  return getDb()
    .prepare(
      `SELECT d.*, so.order_number, c.name AS customer_name, c.code AS customer_code,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM delivery_lines dl WHERE dl.delivery_id = d.id) AS line_count,
              (SELECT COALESCE(SUM(dl.quantity), 0) FROM delivery_lines dl WHERE dl.delivery_id = d.id) AS total_quantity
       FROM deliveries d
       JOIN sales_orders so ON so.id = d.order_id
       JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = d.created_by
       ${where}
       ORDER BY d.id DESC`
    )
    .all(...params);
}

function findById(id) {
  return (
    getDb()
      .prepare(
        `SELECT d.*, so.order_number, so.status AS order_status, so.order_date,
                so.customer_id, c.name AS customer_name, c.code AS customer_code,
                c.city AS customer_city, c.payment_terms_days,
                u.full_name AS created_by_name
         FROM deliveries d
         JOIN sales_orders so ON so.id = d.order_id
         JOIN customers c ON c.id = so.customer_id
         LEFT JOIN users u ON u.id = d.created_by
         WHERE d.id = ?`
      )
      .get(id) || null
  );
}

function findLines(deliveryId) {
  return getDb()
    .prepare(
      `SELECT dl.*, sol.quantity AS ordered_quantity, sol.cancelled_quantity,
              sol.unit_price, sol.line_total,
              p.sku, p.name AS product_name, p.unit,
              (SELECT COALESCE(SUM(other.quantity), 0)
                 FROM delivery_lines other
                 JOIN deliveries od ON od.id = other.delivery_id
                WHERE other.order_line_id = dl.order_line_id
                  AND od.id <> dl.delivery_id
                  AND od.status IN (${DISPATCHED_STATUSES.map(() => '?').join(', ')})) AS other_committed_quantity
       FROM delivery_lines dl
       JOIN sales_order_lines sol ON sol.id = dl.order_line_id
       JOIN products p ON p.id = dl.product_id
       WHERE dl.delivery_id = ?
       ORDER BY dl.id`
    )
    .all(...DISPATCHED_STATUSES, deliveryId);
}

function listFulfillableOrders() {
  return getDb()
    .prepare(
      `SELECT so.id, so.order_number, so.order_date, so.status,
              c.name AS customer_name, c.code AS customer_code,
              SUM(sol.quantity - sol.cancelled_quantity) AS order_quantity,
              SUM((
                SELECT COALESCE(SUM(dl.quantity), 0)
                FROM delivery_lines dl
                JOIN deliveries d ON d.id = dl.delivery_id
                WHERE dl.order_line_id = sol.id
                  AND d.status IN (${committedPlaceholders()})
              )) AS committed_quantity
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       JOIN sales_order_lines sol ON sol.order_id = so.id
       WHERE so.status IN (${FULFILLABLE_ORDER_STATUSES.map(() => '?').join(', ')})
       GROUP BY so.id
       HAVING order_quantity - committed_quantity > 0.000000001
       ORDER BY so.order_date ASC, so.id ASC`
    )
    .all(...COMMITTED_STATUSES, ...FULFILLABLE_ORDER_STATUSES);
}

function createDelivery(data, lines) {
  const db = getDb();
  const timestamp = now();

  const result = db
    .prepare(
      `INSERT INTO deliveries
        (delivery_number, order_id, delivery_date, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
    )
    .run(
      data.deliveryNumber,
      data.orderId,
      data.deliveryDate,
      data.notes || null,
      data.createdBy,
      timestamp,
      timestamp
    );

  const deliveryId = Number(result.lastInsertRowid);
  const insertLine = db.prepare(
    `INSERT INTO delivery_lines (delivery_id, order_line_id, product_id, quantity, invoiced_quantity)
     VALUES (?, ?, ?, ?, 0)`
  );
  for (const line of lines) {
    insertLine.run(deliveryId, line.orderLineId, line.productId, line.quantity);
  }

  return deliveryId;
}

function setStatus(id, status, extra = {}) {
  const timestamp = now();
  getDb()
    .prepare(
      `UPDATE deliveries
       SET status = ?, dispatched_at = COALESCE(?, dispatched_at),
           delivered_at = COALESCE(?, delivered_at),
           exception_reason = COALESCE(?, exception_reason),
           updated_at = ?
       WHERE id = ?`
    )
    .run(
      status,
      extra.dispatchedAt || null,
      extra.deliveredAt || null,
      extra.exceptionReason || null,
      timestamp,
      id
    );
  return findById(id);
}

function openDeliveriesForOrder(orderId) {
  return getDb()
    .prepare(
      `SELECT id, delivery_number, status
       FROM deliveries
       WHERE order_id = ? AND status IN ('draft', 'delivery_exception')
       ORDER BY id`
    )
    .all(orderId);
}

function findInvoiceForDelivery(deliveryId) {
  return (
    getDb()
      .prepare(
        `SELECT id, invoice_number, invoice_date, due_date, status, total
         FROM invoices
         WHERE delivery_id = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(deliveryId) || null
  );
}

module.exports = {
  COMMITTED_STATUSES,
  FULFILLABLE_ORDER_STATUSES,
  list,
  findById,
  findLines,
  listFulfillableOrders,
  createDelivery,
  setStatus,
  openDeliveriesForOrder,
  findInvoiceForDelivery,
};
