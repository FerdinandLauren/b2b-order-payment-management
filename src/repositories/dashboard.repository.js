const { getDb } = require('../config/database');

function invoiceBalanceExpression(alias = 'i') {
  return `(${alias}.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = ${alias}.id), 0))`;
}

function orderWhere(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('so.order_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('so.order_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.customerId) {
    conditions.push('so.customer_id = ?');
    params.push(filters.customerId);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function orderSummary(filters = {}) {
  const { where, params } = orderWhere(filters);
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(so.total), 0) AS total_value,
              COALESCE(SUM(CASE WHEN so.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
              COALESCE(SUM(CASE WHEN so.status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted,
              COALESCE(SUM(CASE WHEN so.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
              COALESCE(SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
              COALESCE(SUM(CASE WHEN so.status = 'partially_fulfilled' THEN 1 ELSE 0 END), 0) AS partially_fulfilled,
              COALESCE(SUM(CASE WHEN so.status = 'partially_cancelled' THEN 1 ELSE 0 END), 0) AS partially_cancelled,
              COALESCE(SUM(CASE WHEN so.status = 'fulfilled' THEN 1 ELSE 0 END), 0) AS fulfilled,
              COALESCE(SUM(CASE WHEN so.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
              COALESCE(SUM(CASE WHEN so.status IN ('approved', 'partially_fulfilled', 'partially_cancelled')
                                THEN 1 ELSE 0 END), 0) AS open_orders
       FROM sales_orders so
       ${where}`
    )
    .get(...params);
}

function orderStatusCounts(filters = {}) {
  const { where, params } = orderWhere(filters);
  return getDb()
    .prepare(
      `SELECT so.status, COUNT(*) AS count, COALESCE(SUM(so.total), 0) AS value
       FROM sales_orders so
       ${where}
       GROUP BY so.status`
    )
    .all(...params);
}

function recentOrders(filters = {}, limit = 6) {
  const { where, params } = orderWhere(filters);
  return getDb()
    .prepare(
      `SELECT so.id, so.order_number, so.order_date, so.status, so.total,
              c.name AS customer_name, c.code AS customer_code
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       ${where}
       ORDER BY so.id DESC
       LIMIT ?`
    )
    .all(...params, limit);
}

function deliverySummary(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('d.delivery_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('d.delivery_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.customerId) {
    conditions.push('so.customer_id = ?');
    params.push(filters.customerId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN d.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
              COALESCE(SUM(CASE WHEN d.status = 'dispatched' THEN 1 ELSE 0 END), 0) AS dispatched,
              COALESCE(SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
              COALESCE(SUM(CASE WHEN d.status = 'delivery_exception' THEN 1 ELSE 0 END), 0) AS delivery_exception,
              COALESCE(SUM(CASE WHEN d.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
       FROM deliveries d
       JOIN sales_orders so ON so.id = d.order_id
       ${where}`
    )
    .get(...params);
}

function fulfillmentUnits(filters = {}) {
  const { where, params } = orderWhere(filters);
  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(sol.quantity - sol.cancelled_quantity), 0) AS ordered_units,
              COALESCE(SUM(
                (SELECT COALESCE(SUM(dl.quantity), 0)
                   FROM delivery_lines dl
                   JOIN deliveries d ON d.id = dl.delivery_id
                  WHERE dl.order_line_id = sol.id
                    AND d.status = 'delivered')
              ), 0) AS delivered_units
       FROM sales_order_lines sol
       JOIN sales_orders so ON so.id = sol.order_id
       ${where ? `${where} AND` : 'WHERE'} so.status IN
         ('approved', 'partially_fulfilled', 'partially_cancelled', 'fulfilled')`
    )
    .get(...params);
}

function inventorySummary() {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS sku_count,
              COALESCE(SUM(stock.on_hand), 0) AS on_hand,
              COALESCE(SUM(stock.reserved), 0) AS reserved,
              COALESCE(SUM(stock.available), 0) AS available,
              COALESCE(SUM(CASE WHEN stock.available <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock,
              COALESCE(SUM(CASE WHEN stock.reserved > 0 THEN 1 ELSE 0 END), 0) AS reserved_skus
       FROM (
         SELECT p.id,
                SUM(ib.on_hand) AS on_hand,
                SUM(ib.reserved) AS reserved,
                SUM(ib.on_hand - ib.reserved) AS available
         FROM inventory_balances ib
         JOIN products p ON p.id = ib.product_id
         WHERE p.status = 'active'
         GROUP BY p.id
       ) stock`
    )
    .get();
}

function topInventory(limit = 6) {
  return getDb()
    .prepare(
      `SELECT p.id, p.sku, p.name, p.unit,
              SUM(ib.on_hand) AS on_hand,
              SUM(ib.reserved) AS reserved,
              SUM(ib.on_hand - ib.reserved) AS available
       FROM inventory_balances ib
       JOIN products p ON p.id = ib.product_id
       WHERE p.status = 'active'
       GROUP BY p.id
       ORDER BY (SUM(ib.on_hand - ib.reserved) <= 0) DESC, SUM(ib.reserved) DESC, p.name
       LIMIT ?`
    )
    .all(limit);
}

function receivablesSummary(todayDate, customerId) {
  const balance = invoiceBalanceExpression();
  const params = [todayDate, todayDate];
  let customerCondition = '';
  if (customerId) {
    customerCondition = 'AND i.customer_id = ?';
    params.push(customerId);
  }

  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(${balance}), 0) AS outstanding,
              COUNT(*) AS open_count,
              COALESCE(SUM(CASE WHEN i.due_date < ? THEN ${balance} ELSE 0 END), 0) AS overdue_amount,
              COALESCE(SUM(CASE WHEN i.due_date < ? THEN 1 ELSE 0 END), 0) AS overdue_count
       FROM invoices i
       WHERE i.status IN ('issued', 'partially_paid')
         AND ${balance} > 0.005
         ${customerCondition}`
    )
    .get(...params);
}

function draftInvoiceCount(filters = {}) {
  const conditions = ["i.status = 'draft'"];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('i.invoice_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('i.invoice_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.customerId) {
    conditions.push('i.customer_id = ?');
    params.push(filters.customerId);
  }

  return getDb()
    .prepare(`SELECT COUNT(*) AS count FROM invoices i WHERE ${conditions.join(' AND ')}`)
    .get(...params).count;
}

function paymentSummary(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('p.payment_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('p.payment_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.customerId) {
    conditions.push('p.customer_id = ?');
    params.push(filters.customerId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(p.amount), 0) AS total,
              COALESCE(SUM(p.amount - COALESCE(
                (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id), 0
              )), 0) AS unallocated
       FROM payments p
       ${where}`
    )
    .get(...params);
}

function overdueInvoices(todayDate, customerId, limit = 6) {
  const balance = invoiceBalanceExpression();
  const params = [todayDate, todayDate];
  let customerCondition = '';
  if (customerId) {
    customerCondition = 'AND i.customer_id = ?';
    params.push(customerId);
  }
  params.push(limit);

  return getDb()
    .prepare(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, i.total,
              c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
              ${balance} AS balance,
              CAST(julianday(?) - julianday(i.due_date) AS INTEGER) AS days_overdue
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.status IN ('issued', 'partially_paid')
         AND i.due_date < ?
         AND ${balance} > 0.005
         ${customerCondition}
       ORDER BY i.due_date ASC, i.id ASC
       LIMIT ?`
    )
    .all(...params);
}

function recentActivity(limit = 8) {
  return getDb()
    .prepare(
      `SELECT a.*, u.full_name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity_type <> 'auth'
       ORDER BY a.id DESC
       LIMIT ?`
    )
    .all(limit);
}

module.exports = {
  orderSummary,
  orderStatusCounts,
  recentOrders,
  deliverySummary,
  fulfillmentUnits,
  inventorySummary,
  topInventory,
  receivablesSummary,
  draftInvoiceCount,
  paymentSummary,
  overdueInvoices,
  recentActivity,
};
