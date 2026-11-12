const dashboardRepository = require('../repositories/dashboard.repository');
const customerRepository = require('../repositories/customer.repository');
const auditUtil = require('../utils/audit');
const { ORDER_STATUS, DELIVERY_STATUS, ROLES } = require('../utils/constants');
const { today } = require('../utils/time');

const FINANCE_ROLES = ['sales_staff', 'sales_supervisor', 'finance_staff', 'management', 'admin'];
const INVENTORY_ROLES = ['sales_staff', 'sales_supervisor', 'warehouse_staff', 'management', 'admin'];
const AUDIT_ROLES = ['management', 'admin'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function numeric(value) {
  return Number(value) || 0;
}

function percentage(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!DATE_PATTERN.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : text;
}

function normalizeFilters(query = {}) {
  let dateFrom = normalizeDate(query.dateFrom);
  let dateTo = normalizeDate(query.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }

  const requestedCustomer = Number(query.customerId);
  const customerId = Number.isInteger(requestedCustomer) && requestedCustomer > 0
    ? requestedCustomer
    : null;
  const customer = customerId ? customerRepository.findById(customerId) : null;

  return {
    dateFrom,
    dateTo,
    customerId: customer ? customer.id : null,
    customer,
  };
}

function rangeLabel(filters) {
  if (filters.dateFrom && filters.dateTo) {
    return `${filters.dateFrom} to ${filters.dateTo}`;
  }
  if (filters.dateFrom) return `From ${filters.dateFrom}`;
  if (filters.dateTo) return `Up to ${filters.dateTo}`;
  return 'All transaction dates';
}

function statusDistribution(rows, enumMap, total) {
  const counts = new Map(rows.map((row) => [row.status, row]));
  return Object.keys(enumMap).map((status) => {
    const row = counts.get(status);
    const count = numeric(row && row.count);
    return {
      status,
      label: enumMap[status],
      count,
      value: numeric(row && row.value),
      percent: percentage(count, total),
    };
  });
}

function buildOrders(filters) {
  const summary = dashboardRepository.orderSummary(filters);
  const statuses = statusDistribution(
    dashboardRepository.orderStatusCounts(filters),
    ORDER_STATUS,
    numeric(summary.total)
  );

  return {
    total: numeric(summary.total),
    totalValue: numeric(summary.total_value),
    draft: numeric(summary.draft),
    submitted: numeric(summary.submitted),
    approved: numeric(summary.approved),
    rejected: numeric(summary.rejected),
    partiallyFulfilled: numeric(summary.partially_fulfilled),
    partiallyCancelled: numeric(summary.partially_cancelled),
    fulfilled: numeric(summary.fulfilled),
    cancelled: numeric(summary.cancelled),
    openOrders: numeric(summary.open_orders),
    pendingApprovals: numeric(summary.submitted),
    statuses,
  };
}

function buildFulfillment(filters) {
  const summary = dashboardRepository.deliverySummary(filters);
  const units = dashboardRepository.fulfillmentUnits(filters);
  const total = numeric(summary.total);
  const orderedUnits = numeric(units.ordered_units);
  const deliveredUnits = numeric(units.delivered_units);

  return {
    total,
    draft: numeric(summary.draft),
    dispatched: numeric(summary.dispatched),
    delivered: numeric(summary.delivered),
    exceptions: numeric(summary.delivery_exception),
    cancelled: numeric(summary.cancelled),
    orderedUnits,
    deliveredUnits,
    openUnits: Math.max(0, orderedUnits - deliveredUnits),
    rate: percentage(Math.min(deliveredUnits, orderedUnits), orderedUnits),
    statuses: statusDistribution(
      [
        { status: 'draft', count: summary.draft },
        { status: 'dispatched', count: summary.dispatched },
        { status: 'delivered', count: summary.delivered },
        { status: 'delivery_exception', count: summary.delivery_exception },
        { status: 'cancelled', count: summary.cancelled },
      ],
      DELIVERY_STATUS,
      total
    ),
  };
}

function buildInventory() {
  const summary = dashboardRepository.inventorySummary();
  const onHand = numeric(summary.on_hand);
  const reserved = numeric(summary.reserved);

  return {
    skuCount: numeric(summary.sku_count),
    onHand,
    reserved,
    available: numeric(summary.available),
    outOfStock: numeric(summary.out_of_stock),
    reservedSkus: numeric(summary.reserved_skus),
    utilization: percentage(reserved, onHand),
    topProducts: dashboardRepository.topInventory(6),
  };
}

function buildFinance(filters) {
  const currentDate = today();
  const receivables = dashboardRepository.receivablesSummary(currentDate, filters.customerId);
  const payments = dashboardRepository.paymentSummary(filters);
  const overdueAmount = numeric(receivables.overdue_amount);
  const outstanding = numeric(receivables.outstanding);

  return {
    outstanding,
    openCount: numeric(receivables.open_count),
    overdueAmount,
    overdueCount: numeric(receivables.overdue_count),
    currentAmount: Math.max(0, outstanding - overdueAmount),
    overdueShare: percentage(overdueAmount, outstanding),
    draftInvoices: numeric(dashboardRepository.draftInvoiceCount(filters)),
    paymentsReceived: numeric(payments.total),
    paymentsCount: numeric(payments.count),
    unallocatedPayments: numeric(payments.unallocated),
  };
}

function buildRecentOrders(filters) {
  return dashboardRepository.recentOrders(filters, 6);
}

function buildActivity(limit = 8) {
  return dashboardRepository.recentActivity(limit).map(auditUtil.describe);
}

function getDashboard(actor, query = {}) {
  const filters = normalizeFilters(query);
  const role = actor.role;

  const orders = buildOrders(filters);
  const fulfillment = buildFulfillment(filters);
  const inventory = INVENTORY_ROLES.includes(role) ? buildInventory() : null;
  const finance = FINANCE_ROLES.includes(role) ? buildFinance(filters) : null;
  const overdueInvoices = FINANCE_ROLES.includes(role)
    ? dashboardRepository.overdueInvoices(today(), filters.customerId, 6)
    : [];

  const customers = customerRepository.list({}).map((customer) => ({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    status: customer.status,
  }));

  return {
    filters: {
      dateFrom: filters.dateFrom || '',
      dateTo: filters.dateTo || '',
      customerId: filters.customerId || '',
      customerName: filters.customer ? filters.customer.name : '',
      rangeLabel: rangeLabel(filters),
      isFiltered: Boolean(filters.dateFrom || filters.dateTo || filters.customerId),
    },
    customers,
    orders,
    fulfillment,
    inventory,
    finance,
    overdueInvoices,
    recentOrders: buildRecentOrders(filters),
    activity: buildActivity(8),
    visibility: {
      finance: Boolean(finance),
      inventory: Boolean(inventory),
      audit: AUDIT_ROLES.includes(role),
    },
    roleLabel: ROLES[role],
  };
}

module.exports = {
  FINANCE_ROLES,
  INVENTORY_ROLES,
  AUDIT_ROLES,
  normalizeFilters,
  getDashboard,
};
