const { getDb } = require('../config/database');

const OPEN_ORDER_STATUSES = [
  'approved',
  'partially_fulfilled',
  'partially_cancelled',
  'fulfilled',
];

function listPending() {
  return getDb()
    .prepare(
      `SELECT so.*, c.name AS customer_name, c.code AS customer_code,
              c.credit_limit, c.payment_terms_days, c.status AS customer_status,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM sales_order_lines sol WHERE sol.order_id = so.id) AS line_count
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = so.created_by
       WHERE so.status = 'submitted'
       ORDER BY so.submitted_at ASC, so.id ASC`
    )
    .all();
}

function openOrderValue(orderId) {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM((quantity - cancelled_quantity) * unit_price), 0) AS value
       FROM sales_order_lines
       WHERE order_id = ?`
    )
    .get(orderId);
  return Number(row.value) || 0;
}

function customerExposure(customerId, excludeOrderId = 0) {
  const placeholders = OPEN_ORDER_STATUSES.map(() => '?').join(', ');

  const outstanding = getDb()
    .prepare(
      `SELECT COALESCE(SUM(
          i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)
        ), 0) AS value
       FROM invoices i
       WHERE i.customer_id = ?
         AND i.status IN ('issued', 'partially_paid')`
    )
    .get(customerId).value;

  const openOrders = getDb()
    .prepare(
      `SELECT COALESCE(SUM(v.open_value), 0) AS value
       FROM (
         SELECT so.id,
                SUM((sol.quantity - sol.cancelled_quantity) * sol.unit_price)
                - COALESCE((
                    SELECT SUM(il.line_total)
                    FROM invoice_lines il
                    JOIN invoices i ON i.id = il.invoice_id
                    JOIN delivery_lines dl ON dl.id = il.delivery_line_id
                    WHERE dl.order_line_id = sol.id
                      AND i.status IN ('issued', 'partially_paid', 'paid')
                  ), 0) AS open_value
         FROM sales_orders so
         JOIN sales_order_lines sol ON sol.order_id = so.id
         WHERE so.customer_id = ?
           AND so.id <> ?
           AND so.status IN (${placeholders})
         GROUP BY so.id
       ) v
       WHERE v.open_value > 0`
    )
    .get(customerId, excludeOrderId, ...OPEN_ORDER_STATUSES).value;

  return {
    outstanding: Number(outstanding) || 0,
    openOrders: Number(openOrders) || 0,
  };
}

module.exports = {
  listPending,
  openOrderValue,
  customerExposure,
};
