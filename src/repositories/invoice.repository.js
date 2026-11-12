const { getDb } = require('../config/database');
const { now } = require('../utils/time');

const BILLABLE_INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid'];

function allocatedExpression() {
  return `COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)`;
}

function buildFilters(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('i.status = ?');
    params.push(filters.status);
  }
  if (filters.customerId) {
    conditions.push('i.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.q) {
    conditions.push(
      '(i.invoice_number LIKE ? OR so.order_number LIKE ? OR d.delivery_number LIKE ? OR c.name LIKE ?)'
    );
    const term = `%${filters.q}%`;
    params.push(term, term, term, term);
  }
  if (filters.overdue) {
    conditions.push(
      `i.due_date < ? AND i.status IN ('issued', 'partially_paid')
       AND i.total - ${allocatedExpression()} > 0.005`
    );
    params.push(filters.overdueDate);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function list(filters = {}, todayDate) {
  const { where, params } = buildFilters(filters);
  return getDb()
    .prepare(
      `SELECT i.*, c.name AS customer_name, c.code AS customer_code,
              c.payment_terms_days, so.order_number, d.delivery_number,
              u.full_name AS created_by_name,
              ${allocatedExpression()} AS allocated,
              i.total - ${allocatedExpression()} AS balance,
              CASE WHEN i.due_date < ? AND i.status IN ('issued', 'partially_paid')
                        AND i.total - ${allocatedExpression()} > 0.005
                   THEN 1 ELSE 0 END AS is_overdue
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       JOIN sales_orders so ON so.id = i.order_id
       JOIN deliveries d ON d.id = i.delivery_id
       LEFT JOIN users u ON u.id = i.created_by
       ${where}
       ORDER BY i.id DESC`
    )
    .all(todayDate, ...params);
}

function findById(id, todayDate) {
  return (
    getDb()
      .prepare(
        `SELECT i.*, c.name AS customer_name, c.code AS customer_code,
                c.address AS customer_address, c.city AS customer_city,
                c.payment_terms_days, c.credit_limit,
                so.order_number, so.order_date,
                d.delivery_number, d.delivery_date, d.status AS delivery_status,
                u.full_name AS created_by_name,
                ${allocatedExpression()} AS allocated,
                i.total - ${allocatedExpression()} AS balance,
                CASE WHEN i.due_date < ? AND i.status IN ('issued', 'partially_paid')
                          AND i.total - ${allocatedExpression()} > 0.005
                     THEN 1 ELSE 0 END AS is_overdue
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         JOIN sales_orders so ON so.id = i.order_id
         JOIN deliveries d ON d.id = i.delivery_id
         LEFT JOIN users u ON u.id = i.created_by
         WHERE i.id = ?`
      )
      .get(todayDate, id) || null
  );
}

function findLines(invoiceId) {
  return getDb()
    .prepare(
      `SELECT il.*, p.sku, p.name AS product_name, p.unit,
              dl.quantity AS delivered_quantity, dl.invoiced_quantity,
              sol.quantity AS ordered_quantity, sol.unit_price AS order_unit_price
       FROM invoice_lines il
       JOIN products p ON p.id = il.product_id
       JOIN delivery_lines dl ON dl.id = il.delivery_line_id
       JOIN sales_order_lines sol ON sol.id = dl.order_line_id
       WHERE il.invoice_id = ?
       ORDER BY il.id`
    )
    .all(invoiceId);
}

function listAllocations(invoiceId) {
  return getDb()
    .prepare(
      `SELECT pa.*, p.payment_number, p.payment_date, p.method, p.reference
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       WHERE pa.invoice_id = ?
       ORDER BY pa.id`
    )
    .all(invoiceId);
}

function allocatedTotal(invoiceId) {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(amount), 0) AS value FROM payment_allocations WHERE invoice_id = ?')
    .get(invoiceId);
  return Number(row.value) || 0;
}

function listEligibleDeliveries() {
  const placeholders = BILLABLE_INVOICE_STATUSES.map(() => '?').join(', ');
  return getDb()
    .prepare(
      `SELECT d.id, d.delivery_number, d.delivery_date, d.delivered_at,
              so.id AS order_id, so.order_number,
              c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
              c.payment_terms_days,
              SUM(dl.quantity - dl.invoiced_quantity) AS billable_quantity,
              SUM((dl.quantity - dl.invoiced_quantity) * sol.unit_price) AS billable_value
       FROM deliveries d
       JOIN sales_orders so ON so.id = d.order_id
       JOIN customers c ON c.id = so.customer_id
       JOIN delivery_lines dl ON dl.delivery_id = d.id
       JOIN sales_order_lines sol ON sol.id = dl.order_line_id
       WHERE d.status = 'delivered'
         AND dl.quantity - dl.invoiced_quantity > 0.000000001
         AND NOT EXISTS (
           SELECT 1 FROM invoices i
           WHERE i.delivery_id = d.id AND i.status IN (${placeholders})
         )
       GROUP BY d.id
       ORDER BY d.delivery_date ASC, d.id ASC`
    )
    .all(...BILLABLE_INVOICE_STATUSES);
}

function findBillableDelivery(deliveryId) {
  return (
    getDb()
      .prepare(
        `SELECT d.*, so.id AS order_id, so.order_number, so.order_date,
                so.status AS order_status,
                c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
                c.address AS customer_address, c.city AS customer_city,
                c.payment_terms_days, c.status AS customer_status
         FROM deliveries d
         JOIN sales_orders so ON so.id = d.order_id
         JOIN customers c ON c.id = so.customer_id
         WHERE d.id = ?`
      )
      .get(deliveryId) || null
  );
}

function findBillableLines(deliveryId) {
  return getDb()
    .prepare(
      `SELECT dl.id AS delivery_line_id, dl.product_id, dl.quantity, dl.invoiced_quantity,
              (dl.quantity - dl.invoiced_quantity) AS billable_quantity,
              sol.unit_price, p.sku, p.name AS product_name, p.unit
       FROM delivery_lines dl
       JOIN sales_order_lines sol ON sol.id = dl.order_line_id
       JOIN products p ON p.id = dl.product_id
       WHERE dl.delivery_id = ?
         AND dl.quantity - dl.invoiced_quantity > 0.000000001
       ORDER BY dl.id`
    )
    .all(deliveryId);
}

function hasActiveInvoiceForDelivery(deliveryId) {
  const placeholders = BILLABLE_INVOICE_STATUSES.map(() => '?').join(', ');
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM invoices
       WHERE delivery_id = ? AND status IN (${placeholders})`
    )
    .get(deliveryId, ...BILLABLE_INVOICE_STATUSES);
  return row.count > 0;
}

function findLatestInvoiceForDelivery(deliveryId) {
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

function createInvoice(data, lines) {
  const db = getDb();
  const timestamp = now();

  const result = db
    .prepare(
      `INSERT INTO invoices
        (invoice_number, customer_id, order_id, delivery_id, invoice_date, due_date,
         status, subtotal, tax_rate, tax_amount, total, currency, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, 0, 0, ?, 'IDR', ?, ?, ?)`
    )
    .run(
      data.invoiceNumber,
      data.customerId,
      data.orderId,
      data.deliveryId,
      data.invoiceDate,
      data.dueDate,
      data.subtotal,
      data.total,
      data.createdBy,
      timestamp,
      timestamp
    );

  const invoiceId = Number(result.lastInsertRowid);
  const insertLine = db.prepare(
    `INSERT INTO invoice_lines (invoice_id, delivery_line_id, product_id, quantity, unit_price, line_total)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const markInvoiced = db.prepare(
    'UPDATE delivery_lines SET invoiced_quantity = invoiced_quantity + ? WHERE id = ?'
  );

  for (const line of lines) {
    insertLine.run(
      invoiceId,
      line.deliveryLineId,
      line.productId,
      line.quantity,
      line.unitPrice,
      line.lineTotal
    );
    markInvoiced.run(line.quantity, line.deliveryLineId);
  }

  return invoiceId;
}

function setStatus(id, status, extra = {}) {
  getDb()
    .prepare(
      `UPDATE invoices
       SET status = ?, issued_at = COALESCE(?, issued_at),
           voided_at = COALESCE(?, voided_at),
           void_reason = COALESCE(?, void_reason),
           updated_at = ?
       WHERE id = ?`
    )
    .run(status, extra.issuedAt || null, extra.voidedAt || null, extra.voidReason || null, now(), id);
}

function resetDeliveryInvoiced(deliveryId) {
  getDb()
    .prepare('UPDATE delivery_lines SET invoiced_quantity = 0 WHERE delivery_id = ?')
    .run(deliveryId);
}

function countAllocations(invoiceId) {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM payment_allocations WHERE invoice_id = ?')
    .get(invoiceId);
  return row.count;
}

module.exports = {
  BILLABLE_INVOICE_STATUSES,
  list,
  findById,
  findLines,
  listAllocations,
  allocatedTotal,
  listEligibleDeliveries,
  findBillableDelivery,
  findBillableLines,
  hasActiveInvoiceForDelivery,
  findLatestInvoiceForDelivery,
  createInvoice,
  setStatus,
  resetDeliveryInvoiced,
  countAllocations,
};
