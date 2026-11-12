const { getDb } = require('../config/database');
const deliveryRepository = require('../repositories/delivery.repository');
const orderRepository = require('../repositories/order.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const warehouseRepository = require('../repositories/warehouse.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { now, today } = require('../utils/time');

const WAREHOUSE_ROLES = ['warehouse_staff'];

function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function remainingForLine(line) {
  return Math.max(
    0,
    roundQuantity(line.quantity - line.cancelled_quantity - (line.committed_quantity || 0))
  );
}

function listDeliveries(filters = {}) {
  return deliveryRepository.list(filters);
}

function getFulfillmentBoard() {
  return {
    orders: deliveryRepository.listFulfillableOrders(),
  };
}

function getDelivery(id) {
  const delivery = deliveryRepository.findById(id);
  if (!delivery) throw new ApiError(404, 'Delivery not found.');

  const lines = deliveryRepository.findLines(id);
  return {
    delivery,
    lines,
    order: orderRepository.findById(delivery.order_id),
    orderLines: orderRepository.findLines(delivery.order_id),
    invoice: deliveryRepository.findInvoiceForDelivery(id),
    billableQuantity: roundQuantity(
      lines.reduce((sum, line) => sum + Math.max(0, line.quantity - line.invoiced_quantity), 0)
    ),
  };
}

function getCreateForm(orderId) {
  const order = orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, 'Sales order not found.');
  if (!deliveryRepository.FULFILLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, 'Deliveries can only be created for approved orders.');
  }

  const lines = orderRepository.findLines(orderId).map((line) => ({
    ...line,
    remaining_quantity: remainingForLine(line),
  }));

  return { order, lines };
}

function normalizeDelivery(body) {
  const orderId = Number(body.orderId);
  const order = orderRepository.findById(orderId);
  if (!order) throw new ApiError(400, 'Select a valid sales order.');
  if (!deliveryRepository.FULFILLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, 'Deliveries can only be created for approved orders.');
  }

  const deliveryDate = String(body.deliveryDate || today()).slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
    Number.isNaN(new Date(`${deliveryDate}T00:00:00Z`).getTime())
  ) {
    throw new ApiError(400, 'Enter a valid delivery date.');
  }

  const orderLines = orderRepository.findLines(orderId);
  const lines = [];

  for (const line of orderLines) {
    const raw = body[`quantity_${line.id}`];
    if (raw === undefined || raw === '') continue;
    const quantity = roundQuantity(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ApiError(400, `Delivery quantity for ${line.product_name} must be zero or greater.`);
    }
    if (quantity === 0) continue;

    const remaining = remainingForLine(line);
    if (quantity > remaining + 1e-9) {
      throw new ApiError(
        400,
        `Cannot deliver ${quantity} of ${line.product_name}; only ${remaining} remains to be delivered.`
      );
    }

    lines.push({
      orderLineId: line.id,
      productId: line.product_id,
      productName: line.product_name,
      quantity,
    });
  }

  if (!lines.length) {
    throw new ApiError(400, 'Enter a delivery quantity for at least one order line.');
  }

  return {
    order,
    deliveryDate,
    notes: String(body.notes || '').trim() || null,
    lines,
  };
}

function createDelivery(body, actor, ipAddress) {
  if (!WAREHOUSE_ROLES.includes(actor.role)) {
    throw new ApiError(403, 'Only Warehouse Staff can create deliveries.');
  }

  const data = normalizeDelivery(body);
  const year = data.deliveryDate.slice(0, 4);
  const db = getDb();

  const create = db.transaction(() => {
    const sequence = numberCounter.nextSequence('delivery', year);
    const deliveryNumber = formatDocument('DN', sequence, year);

    const deliveryId = deliveryRepository.createDelivery(
      {
        deliveryNumber,
        orderId: data.order.id,
        deliveryDate: data.deliveryDate,
        notes: data.notes,
        createdBy: actor.id,
      },
      data.lines
    );

    auditService.record({
      userId: actor.id,
      action: 'delivery_created',
      entityType: 'delivery',
      entityId: deliveryId,
      details: {
        deliveryNumber,
        orderNumber: data.order.order_number,
        deliveryDate: data.deliveryDate,
        lines: data.lines.map((line) => ({
          product: line.productName,
          quantity: line.quantity,
        })),
      },
      ipAddress,
    });

    return deliveryId;
  });

  const deliveryId = create();
  return getDelivery(deliveryId).delivery;
}

function assertWarehouse(actor) {
  if (!WAREHOUSE_ROLES.includes(actor.role)) {
    throw new ApiError(403, 'Only Warehouse Staff can perform delivery operations.');
  }
}

function dispatchDelivery(id, actor, ipAddress) {
  assertWarehouse(actor);
  const { delivery, lines, order } = getDelivery(id);

  if (delivery.status !== 'draft') {
    throw new ApiError(400, 'Only draft deliveries can be dispatched.');
  }
  if (!['approved', 'partially_fulfilled', 'partially_cancelled'].includes(order.status)) {
    throw new ApiError(400, `The sales order is ${order.status} and cannot be dispatched.`);
  }

  for (const line of lines) {
    const limit = Math.max(
      0,
      line.ordered_quantity - line.cancelled_quantity - line.other_committed_quantity
    );
    if (line.quantity > limit + 1e-9) {
      throw new ApiError(
        400,
        `Cannot dispatch ${line.quantity} of ${line.product_name}; only ${limit} remains to be delivered.`
      );
    }
  }

  const warehouseId = warehouseRepository.defaultWarehouseId();
  if (!warehouseId) {
    throw new ApiError(400, 'No default warehouse is configured. Set one before dispatching deliveries.');
  }

  const db = getDb();
  const dispatch = db.transaction(() => {
    for (const line of lines) {
      const balance = inventoryRepository.getBalance(warehouseId, line.product_id);
      const onHand = balance ? Number(balance.on_hand) : 0;
      const reserved = balance ? Number(balance.reserved) : 0;
      if (onHand + 1e-9 < line.quantity) {
        throw new ApiError(
          400,
          `Dispatch blocked: on-hand stock for ${line.product_name} is ${onHand}, but ${line.quantity} is required.`
        );
      }
      if (reserved + 1e-9 < line.quantity) {
        throw new ApiError(
          400,
          `Dispatch blocked: only ${reserved} units of ${line.product_name} are reserved for this order.`
        );
      }

      inventoryRepository.setOnHand(warehouseId, line.product_id, onHand - line.quantity);
      inventoryRepository.changeReserved(warehouseId, line.product_id, -line.quantity);
      inventoryRepository.createMovement({
        productId: line.product_id,
        warehouseId,
        movementType: 'dispatch',
        quantity: -line.quantity,
        referenceType: 'delivery',
        referenceId: delivery.id,
        reason: `Dispatched on ${delivery.delivery_number}`,
        createdBy: actor.id,
        createdAt: now(),
      });
    }

    deliveryRepository.setStatus(delivery.id, 'dispatched', { dispatchedAt: now() });

    auditService.record({
      userId: actor.id,
      action: 'delivery_dispatched',
      entityType: 'delivery',
      entityId: delivery.id,
      details: {
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
        warehouseId,
        lines: lines.map((line) => ({ product: line.product_name, quantity: line.quantity })),
      },
      ipAddress,
    });
  });

  dispatch();
  return getDelivery(id).delivery;
}

function syncOrderStatus(orderId, actor, ipAddress, source) {
  const order = orderRepository.findById(orderId);
  if (!order) return null;

  const lines = orderRepository.findLines(orderId);
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cancelled = lines.reduce((sum, line) => sum + line.cancelled_quantity, 0);
  const delivered = lines.reduce((sum, line) => sum + line.delivered_quantity, 0);
  const remaining = total - cancelled - delivered;

  let status;
  if (delivered <= 1e-9) {
    status = cancelled > 1e-9 ? 'partially_cancelled' : 'approved';
  } else if (remaining <= 1e-9) {
    status = 'fulfilled';
  } else {
    status = 'partially_fulfilled';
  }

  if (status === order.status) return order;

  orderRepository.setStatus(orderId, status);
  auditService.record({
    userId: actor.id,
    action: 'order_fulfillment_updated',
    entityType: 'sales_order',
    entityId: orderId,
    details: {
      orderNumber: order.order_number,
      from: order.status,
      to: status,
      source,
      delivered,
      remaining: Math.max(0, remaining),
    },
    ipAddress,
  });
  return orderRepository.findById(orderId);
}

function confirmDelivery(id, actor, ipAddress) {
  assertWarehouse(actor);
  const { delivery } = getDelivery(id);

  if (delivery.status !== 'dispatched') {
    throw new ApiError(400, 'Only dispatched deliveries can be confirmed as delivered.');
  }

  const db = getDb();
  const confirm = db.transaction(() => {
    deliveryRepository.setStatus(delivery.id, 'delivered', { deliveredAt: now() });
    syncOrderStatus(delivery.order_id, actor, ipAddress, 'delivery_confirmed');
    auditService.record({
      userId: actor.id,
      action: 'delivery_confirmed',
      entityType: 'delivery',
      entityId: delivery.id,
      details: {
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
      },
      ipAddress,
    });
  });

  confirm();
  return getDelivery(id).delivery;
}

function markException(id, body, actor, ipAddress) {
  assertWarehouse(actor);
  const { delivery } = getDelivery(id);

  if (delivery.status !== 'dispatched') {
    throw new ApiError(400, 'Only dispatched deliveries can be marked as an exception.');
  }

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a delivery exception reason of at least 3 characters.');
  }

  const db = getDb();
  const flag = db.transaction(() => {
    deliveryRepository.setStatus(delivery.id, 'delivery_exception', { exceptionReason: reason });
    auditService.record({
      userId: actor.id,
      action: 'delivery_exception',
      entityType: 'delivery',
      entityId: delivery.id,
      details: {
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
        reason,
      },
      ipAddress,
    });
  });

  flag();
  return getDelivery(id).delivery;
}

function resolveException(id, body, actor, ipAddress) {
  assertWarehouse(actor);
  const { delivery, lines } = getDelivery(id);

  if (delivery.status !== 'delivery_exception') {
    throw new ApiError(400, 'Only deliveries in exception status can be resolved.');
  }

  const outcome = String(body.outcome || '').trim();
  if (!['delivered', 'cancelled'].includes(outcome)) {
    throw new ApiError(400, 'Select whether the delivery was delivered or cancelled.');
  }

  const note = String(body.note || '').trim();
  const warehouseId = warehouseRepository.defaultWarehouseId();
  const db = getDb();

  const resolve = db.transaction(() => {
    if (outcome === 'cancelled') {
      if (!warehouseId) {
        throw new ApiError(400, 'No default warehouse is configured. The dispatch cannot be reversed.');
      }

      for (const line of lines) {
        const balance = inventoryRepository.ensureBalance(warehouseId, line.product_id);
        inventoryRepository.setOnHand(
          warehouseId,
          line.product_id,
          Number(balance.on_hand) + line.quantity
        );
        inventoryRepository.changeReserved(warehouseId, line.product_id, line.quantity);
        inventoryRepository.createMovement({
          productId: line.product_id,
          warehouseId,
          movementType: 'dispatch_reversal',
          quantity: line.quantity,
          referenceType: 'delivery',
          referenceId: delivery.id,
          reason: note || 'Delivery exception resolved as cancelled',
          createdBy: actor.id,
          createdAt: now(),
        });
      }

      deliveryRepository.setStatus(delivery.id, 'cancelled');
    } else {
      deliveryRepository.setStatus(delivery.id, 'delivered', { deliveredAt: now() });
    }

    syncOrderStatus(delivery.order_id, actor, ipAddress, `delivery_exception_${outcome}`);
    auditService.record({
      userId: actor.id,
      action: 'delivery_exception_resolved',
      entityType: 'delivery',
      entityId: delivery.id,
      details: {
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
        outcome,
        note: note || null,
      },
      ipAddress,
    });
  });

  resolve();
  return getDelivery(id).delivery;
}

function cancelDelivery(id, body, actor, ipAddress) {
  assertWarehouse(actor);
  const { delivery } = getDelivery(id);

  if (delivery.status !== 'draft') {
    throw new ApiError(400, 'Only draft deliveries can be cancelled.');
  }

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a cancellation reason of at least 3 characters.');
  }

  const db = getDb();
  const cancel = db.transaction(() => {
    deliveryRepository.setStatus(delivery.id, 'cancelled');
    auditService.record({
      userId: actor.id,
      action: 'delivery_cancelled',
      entityType: 'delivery',
      entityId: delivery.id,
      details: {
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
        reason,
      },
      ipAddress,
    });
  });

  cancel();
  return getDelivery(id).delivery;
}

module.exports = {
  listDeliveries,
  getFulfillmentBoard,
  getDelivery,
  getCreateForm,
  createDelivery,
  dispatchDelivery,
  confirmDelivery,
  markException,
  resolveException,
  cancelDelivery,
};
