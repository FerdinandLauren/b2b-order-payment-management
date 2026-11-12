const ACTION_META = {
  login: { label: 'Signed in', tone: 'neutral' },
  logout: { label: 'Signed out', tone: 'neutral' },
  order_created: { label: 'Sales order created', tone: 'primary' },
  order_updated: { label: 'Sales order updated', tone: 'primary' },
  order_submitted: { label: 'Sales order submitted', tone: 'warning' },
  order_approved: { label: 'Sales order approved', tone: 'success' },
  order_rejected: { label: 'Sales order rejected', tone: 'danger' },
  order_cancelled: { label: 'Sales order cancelled', tone: 'danger' },
  order_partially_cancelled: { label: 'Sales order partially cancelled', tone: 'warning' },
  order_fulfillment_updated: { label: 'Order fulfillment updated', tone: 'info' },
  delivery_created: { label: 'Delivery created', tone: 'primary' },
  delivery_dispatched: { label: 'Delivery dispatched', tone: 'info' },
  delivery_confirmed: { label: 'Delivery confirmed', tone: 'success' },
  delivery_exception: { label: 'Delivery exception recorded', tone: 'danger' },
  delivery_exception_resolved: { label: 'Delivery exception resolved', tone: 'success' },
  delivery_cancelled: { label: 'Delivery cancelled', tone: 'danger' },
  invoice_generated: { label: 'Invoice generated', tone: 'primary' },
  invoice_issued: { label: 'Invoice issued', tone: 'info' },
  invoice_voided: { label: 'Invoice voided', tone: 'danger' },
  payment_recorded: { label: 'Payment recorded', tone: 'primary' },
  payment_allocated: { label: 'Payment allocated', tone: 'success' },
  inventory_adjusted: { label: 'Inventory adjusted', tone: 'warning' },
  customer_created: { label: 'Customer created', tone: 'primary' },
  customer_updated: { label: 'Customer updated', tone: 'primary' },
  customer_status_changed: { label: 'Customer status changed', tone: 'warning' },
  product_created: { label: 'Product created', tone: 'primary' },
  product_updated: { label: 'Product updated', tone: 'primary' },
  product_status_changed: { label: 'Product status changed', tone: 'warning' },
  category_created: { label: 'Category created', tone: 'primary' },
  category_renamed: { label: 'Category renamed', tone: 'primary' },
  warehouse_created: { label: 'Warehouse created', tone: 'primary' },
  warehouse_updated: { label: 'Warehouse updated', tone: 'primary' },
  warehouse_status_changed: { label: 'Warehouse status changed', tone: 'warning' },
  user_created: { label: 'User created', tone: 'primary' },
  user_updated: { label: 'User updated', tone: 'primary' },
  user_status_changed: { label: 'User status changed', tone: 'warning' },
};

const ENTITY_LABELS = {
  auth: 'Authentication',
  category: 'Product category',
  customer: 'Customer',
  delivery: 'Delivery',
  inventory: 'Inventory',
  invoice: 'Invoice',
  payment: 'Payment',
  product: 'Product',
  sales_order: 'Sales order',
  user: 'User',
  warehouse: 'Warehouse',
};

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function metaFor(action) {
  return ACTION_META[action] || { label: humanize(action), tone: 'neutral' };
}

function entityLabel(entityType) {
  return ENTITY_LABELS[entityType] || humanize(entityType);
}

function parseDetails(row) {
  if (!row || !row.details) return {};
  if (typeof row.details === 'object') return row.details;
  try {
    return JSON.parse(row.details);
  } catch (error) {
    return {};
  }
}

function linkFor(entityType, entityId) {
  if (!entityId) return null;
  switch (entityType) {
    case 'sales_order':
      return `/orders/${entityId}`;
    case 'delivery':
      return `/deliveries/${entityId}`;
    case 'invoice':
      return `/invoices/${entityId}`;
    case 'payment':
      return `/payments/${entityId}`;
    case 'customer':
      return `/customers/${entityId}`;
    case 'product':
      return `/products/${entityId}`;
    case 'user':
      return `/users/${entityId}/edit`;
    case 'warehouse':
      return `/warehouses/${entityId}/edit`;
    case 'inventory':
      return '/inventory';
    case 'category':
      return '/categories';
    default:
      return null;
  }
}

function referenceOf(details) {
  return (
    details.orderNumber ||
    details.deliveryNumber ||
    details.invoiceNumber ||
    details.paymentNumber ||
    null
  );
}

function summarize(row) {
  const details = parseDetails(row);
  const reference = referenceOf(details);
  const refText = reference ? `${reference}` : '';

  switch (row.action) {
    case 'order_created':
      return `${refText} created with ${details.lineCount || 0} line(s).`;
    case 'order_updated':
      return `${refText} updated with ${details.lineCount || 0} line(s).`;
    case 'order_submitted':
      return `${refText} submitted for supervisor approval.`;
    case 'order_approved':
      return details.creditWarning
        ? `${refText} approved with a credit limit override.`
        : `${refText} approved and stock reserved.`;
    case 'order_rejected':
      return `${refText} rejected${details.reason ? `: ${details.reason}` : '.'}`;
    case 'order_cancelled':
    case 'order_partially_cancelled':
      return `${refText} ${row.action === 'order_cancelled' ? 'cancelled' : 'partially cancelled'}${
        details.reason ? `: ${details.reason}` : '.'
      }`;
    case 'order_fulfillment_updated':
      return `${refText} moved to ${humanize(details.to)}.`;
    case 'delivery_created':
      return `${refText} created from ${details.orderNumber || 'a sales order'}.`;
    case 'delivery_dispatched':
      return `${refText} dispatched from ${details.orderNumber || 'a sales order'}.`;
    case 'delivery_confirmed':
      return `${refText} confirmed as delivered.`;
    case 'delivery_exception':
      return `${refText} reported an exception${details.reason ? `: ${details.reason}` : '.'}`;
    case 'delivery_exception_resolved':
      return `${refText} exception resolved as ${humanize(details.outcome)}.`;
    case 'delivery_cancelled':
      return `${refText} cancelled${details.reason ? `: ${details.reason}` : '.'}`;
    case 'invoice_generated':
      return `${refText} generated from ${details.deliveryNumber || 'a delivery'}.`;
    case 'invoice_issued':
      return `${refText} issued to ${details.customer || 'the customer'}.`;
    case 'invoice_voided':
      return `${refText} voided${details.reason ? `: ${details.reason}` : '.'}`;
    case 'payment_recorded':
      return `${refText} recorded from ${details.customer || 'a customer'}.`;
    case 'payment_allocated': {
      const count = Array.isArray(details.allocations) ? details.allocations.length : 0;
      return `${refText} allocated to ${count} invoice(s).`;
    }
    case 'inventory_adjusted':
      return `${humanize(details.movementType)} of ${details.quantity || 0} unit(s).`;
    case 'customer_created':
    case 'customer_updated':
    case 'customer_status_changed':
      return `${details.name || details.code || 'Customer'}${
        details.status ? ` is now ${details.status}` : ''
      }.`;
    case 'product_created':
    case 'product_updated':
    case 'product_status_changed':
      return `${details.name || details.sku || 'Product'}${
        details.status ? ` is now ${details.status}` : ''
      }.`;
    case 'user_created':
    case 'user_updated':
    case 'user_status_changed':
      return `${details.username || 'User'}${details.role ? ` (${details.role})` : ''}${
        details.status ? ` is now ${details.status}` : ''
      }.`;
    case 'login':
    case 'logout':
      return `${details.username || 'User'} ${row.action === 'login' ? 'signed in' : 'signed out'}.`;
    default:
      return refText ? `${refText}.` : `${entityLabel(row.entity_type)} activity.`;
  }
}

function describe(row) {
  return {
    id: row.id,
    action: row.action,
    label: metaFor(row.action).label,
    tone: metaFor(row.action).tone,
    entityType: row.entity_type,
    entityLabel: entityLabel(row.entity_type),
    entityId: row.entity_id,
    href: linkFor(row.entity_type, row.entity_id),
    summary: summarize(row),
    userName: row.user_name || 'System',
    createdAt: row.created_at,
    ipAddress: row.ip_address,
  };
}

module.exports = {
  ACTION_META,
  ENTITY_LABELS,
  metaFor,
  entityLabel,
  parseDetails,
  linkFor,
  summarize,
  describe,
};
