const { getDb } = require('../config/database');
const orderRepository = require('../repositories/order.repository');
const customerRepository = require('../repositories/customer.repository');
const productRepository = require('../repositories/product.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const warehouseRepository = require('../repositories/warehouse.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { now, today } = require('../utils/time');
const { CANCELLABLE_ORDER_STATUSES } = require('../utils/constants');

const WAREHOUSE_VISIBLE_STATUSES = [
  'approved',
  'partially_fulfilled',
  'partially_cancelled',
  'fulfilled',
];

function canViewAllOrders(user) {
  return user.role !== 'warehouse_staff';
}

function canViewOrder(order, user) {
  if (canViewAllOrders(user)) return true;
  return WAREHOUSE_VISIBLE_STATUSES.includes(order.status);
}

function listOrders(filters, user) {
  const scoped = { ...filters };
  if (!canViewAllOrders(user)) {
    scoped.statuses = WAREHOUSE_VISIBLE_STATUSES;
  }
  return orderRepository.list(scoped);
}

function getOrder(id) {
  const order = orderRepository.findById(id);
  if (!order) throw new ApiError(404, 'Sales order not found.');

  return {
    order,
    lines: orderRepository.findLines(id),
    approvals: orderRepository.listApprovals(id),
    deliveries: orderRepository.listDeliveries(id),
    invoices: orderRepository.listInvoices(id),
  };
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeLines(body) {
  const productIds = toArray(body.productId);
  const quantities = toArray(body.quantity);
  const prices = toArray(body.unitPrice);

  if (!productIds.length) {
    throw new ApiError(400, 'Add at least one product line to the order.');
  }

  const lines = [];
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = Number(productIds[index]);
    if (!productId) continue;

    const product = productRepository.findById(productId);
    if (!product) throw new ApiError(400, 'One of the selected products no longer exists.');
    if (product.status !== 'active') {
      throw new ApiError(400, `Product ${product.name} is inactive and cannot be ordered.`);
    }

    const quantity = Number(quantities[index]);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Enter a quantity greater than zero for ${product.name}.`);
    }

    const rawPrice = prices[index];
    const unitPrice = rawPrice === undefined || rawPrice === '' ? Number(product.unit_price) : Number(rawPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new ApiError(400, `Enter a valid unit price for ${product.name}.`);
    }

    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    lines.push({
      productId,
      quantity,
      unitPrice,
      lineTotal,
      productName: product.name,
    });
  }

  if (!lines.length) {
    throw new ApiError(400, 'Add at least one product line to the order.');
  }

  return lines;
}

function normalizeHeader(body) {
  const customerId = Number(body.customerId);
  const customer = customerRepository.findById(customerId);
  if (!customer) throw new ApiError(400, 'Select a valid customer.');
  if (customer.status !== 'active') {
    throw new ApiError(400, 'Inactive customers cannot be used on new orders.');
  }

  const orderDate = String(body.orderDate || today()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate) || Number.isNaN(new Date(`${orderDate}T00:00:00Z`).getTime())) {
    throw new ApiError(400, 'Enter a valid order date.');
  }

  return {
    customerId,
    orderDate,
    notes: String(body.notes || '').trim() || null,
  };
}

function totalsFor(lines) {
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
  return { subtotal, total: subtotal };
}

function createOrder(body, actor, ipAddress) {
  if (!['sales_staff', 'sales_supervisor'].includes(actor.role)) {
    throw new ApiError(403, 'Your role cannot create sales orders.');
  }

  const header = normalizeHeader(body);
  const lines = normalizeLines(body);
  const totals = totalsFor(lines);
  const year = header.orderDate.slice(0, 4);
  const db = getDb();

  const create = db.transaction(() => {
    const sequence = numberCounter.nextSequence('sales_order', year);
    const orderNumber = formatDocument('SO', sequence, year);

    const orderId = orderRepository.createOrder(
      {
        orderNumber,
        customerId: header.customerId,
        orderDate: header.orderDate,
        subtotal: totals.subtotal,
        total: totals.total,
        notes: header.notes,
        createdBy: actor.id,
      },
      lines
    );

    auditService.record({
      userId: actor.id,
      action: 'order_created',
      entityType: 'sales_order',
      entityId: orderId,
      details: {
        orderNumber,
        customerId: header.customerId,
        total: totals.total,
        lineCount: lines.length,
      },
      ipAddress,
    });

    return orderId;
  });

  const orderId = create();
  return getOrder(orderId).order;
}

function assertCanEdit(order, actor) {
  if (order.status !== 'draft') {
    throw new ApiError(400, 'Only draft orders can be edited.');
  }
  if (actor.role === 'sales_staff' && order.created_by !== actor.id) {
    throw new ApiError(403, 'You can only edit your own draft orders.');
  }
  if (!['sales_staff', 'sales_supervisor'].includes(actor.role)) {
    throw new ApiError(403, 'Your role cannot edit sales orders.');
  }
}

function updateOrder(id, body, actor, ipAddress) {
  const order = orderRepository.findById(id);
  if (!order) throw new ApiError(404, 'Sales order not found.');
  assertCanEdit(order, actor);

  const header = normalizeHeader(body);
  const lines = normalizeLines(body);
  const totals = totalsFor(lines);
  const db = getDb();

  const update = db.transaction(() => {
    orderRepository.updateOrder(id, {
      customerId: header.customerId,
      orderDate: header.orderDate,
      subtotal: totals.subtotal,
      total: totals.total,
      notes: header.notes,
      lines,
    });

    auditService.record({
      userId: actor.id,
      action: 'order_updated',
      entityType: 'sales_order',
      entityId: id,
      details: { orderNumber: order.order_number, total: totals.total, lineCount: lines.length },
      ipAddress,
    });
  });

  update();
  return getOrder(id).order;
}

function submitOrder(id, actor, ipAddress) {
  const { order, lines } = getOrder(id);

  if (!['sales_staff', 'sales_supervisor'].includes(actor.role)) {
    throw new ApiError(403, 'Your role cannot submit sales orders.');
  }
  if (order.status !== 'draft') {
    throw new ApiError(400, 'Only draft orders can be submitted for approval.');
  }
  if (actor.role === 'sales_staff' && order.created_by !== actor.id) {
    throw new ApiError(403, 'You can only submit your own draft orders.');
  }
  if (!lines.length) {
    throw new ApiError(400, 'The order has no lines and cannot be submitted.');
  }
  if (order.customer_status !== 'active') {
    throw new ApiError(400, 'The customer is inactive. Update the order before submitting.');
  }

  const db = getDb();
  const submit = db.transaction(() => {
    orderRepository.markSubmitted(id);
    orderRepository.addApproval({
      orderId: id,
      action: 'submitted',
      reason: null,
      isOverride: false,
      actedBy: actor.id,
    });
    auditService.record({
      userId: actor.id,
      action: 'order_submitted',
      entityType: 'sales_order',
      entityId: id,
      details: { orderNumber: order.order_number, total: order.total },
      ipAddress,
    });
  });

  submit();
  return getOrder(id).order;
}

function canCancel(order, actor) {
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) return false;
  if (actor.role === 'sales_supervisor') return true;
  if (actor.role === 'sales_staff') {
    return order.status === 'draft' && order.created_by === actor.id;
  }
  return false;
}

function remainingQuantity(line) {
  return Math.max(0, line.quantity - line.cancelled_quantity - line.delivered_quantity);
}

function normalizeCancelQuantities(body, lines, order) {
  const requested = {};

  // A draft has not entered fulfillment, so cancelling a draft always cancels the
  // whole order instead of leaving an uneditable partially cancelled draft behind.
  if (order.status === 'draft') {
    for (const line of lines) {
      const remaining = remainingQuantity(line);
      if (remaining > 0) requested[line.id] = { line, quantity: remaining };
    }
    if (!Object.keys(requested).length) {
      throw new ApiError(400, 'This order has no remaining quantity to cancel.');
    }
    return requested;
  }

  for (const line of lines) {
    const raw = body[`cancel_${line.id}`];
    const value = raw === undefined || raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new ApiError(400, 'Cancellation quantities must be zero or greater.');
    }
    if (value > 0) {
      const remaining = remainingQuantity(line);
      if (value > remaining + 1e-9) {
        throw new ApiError(
          400,
          `Cannot cancel ${value} of ${line.product_name}; only ${remaining} remains undelivered.`
        );
      }
      requested[line.id] = { line, quantity: value };
    }
  }

  const total = Object.values(requested).reduce((sum, item) => sum + item.quantity, 0);
  if (total <= 0) {
    throw new ApiError(400, 'Enter a cancellation quantity for at least one line.');
  }

  return requested;
}

function cancelOrder(id, body, actor, ipAddress) {
  const { order, lines } = getOrder(id);

  if (!canCancel(order, actor)) {
    throw new ApiError(403, 'You are not allowed to cancel this order in its current status.');
  }

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a cancellation reason of at least 3 characters.');
  }

  const requested = normalizeCancelQuantities(body, lines, order);
  const db = getDb();
  const reservationActive = ['approved', 'partially_fulfilled', 'partially_cancelled'].includes(
    order.status
  );
  const warehouseId = reservationActive ? warehouseRepository.defaultWarehouseId() : null;

  const cancel = db.transaction(() => {
    for (const { line, quantity } of Object.values(requested)) {
      const nextCancelled = line.cancelled_quantity + quantity;
      orderRepository.cancelLine(line.id, nextCancelled, reason);

      if (reservationActive && warehouseId) {
        const balance = inventoryRepository.getBalance(warehouseId, line.product_id);
        if (balance) {
          const release = Math.min(quantity, balance.reserved);
          if (release > 0) {
            inventoryRepository.changeReserved(warehouseId, line.product_id, -release);
            inventoryRepository.createMovement({
              productId: line.product_id,
              warehouseId,
              movementType: 'reservation_release',
              quantity: -release,
              referenceType: 'sales_order',
              referenceId: order.id,
              reason,
              createdBy: actor.id,
              createdAt: now(),
            });
          }
        }
      }
    }

    const refreshedLines = orderRepository.findLines(id);
    const totalQuantity = refreshedLines.reduce((sum, line) => sum + line.quantity, 0);
    const cancelledTotal = refreshedLines.reduce((sum, line) => sum + line.cancelled_quantity, 0);
    const deliveredTotal = refreshedLines.reduce((sum, line) => sum + line.delivered_quantity, 0);
    const remainingTotal = totalQuantity - cancelledTotal - deliveredTotal;

    let nextStatus;
    if (remainingTotal <= 1e-9) {
      nextStatus = deliveredTotal > 1e-9 ? 'fulfilled' : 'cancelled';
    } else if (order.status === 'submitted') {
      // The remainder still has to pass approval, so a partially cancelled
      // submitted order stays in the queue instead of dropping out of the flow.
      nextStatus = 'submitted';
    } else {
      nextStatus = 'partially_cancelled';
    }

    orderRepository.setStatus(id, nextStatus);
    orderRepository.addApproval({
      orderId: id,
      action: nextStatus === 'cancelled' ? 'cancelled' : 'partially_cancelled',
      reason,
      isOverride: false,
      actedBy: actor.id,
    });

    auditService.record({
      userId: actor.id,
      action: nextStatus === 'cancelled' ? 'order_cancelled' : 'order_partially_cancelled',
      entityType: 'sales_order',
      entityId: id,
      details: {
        orderNumber: order.order_number,
        reason,
        cancelledLines: Object.values(requested).map(({ line, quantity }) => ({
          lineId: line.id,
          product: line.product_name,
          quantity,
        })),
        status: nextStatus,
      },
      ipAddress,
    });

    return nextStatus;
  });

  const status = cancel();
  return { order: getOrder(id).order, status };
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  submitOrder,
  cancelOrder,
  canCancel,
  canViewOrder,
};
