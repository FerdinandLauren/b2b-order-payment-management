const { getDb } = require('../config/database');
const orderService = require('./order.service');
const orderRepository = require('../repositories/order.repository');
const approvalRepository = require('../repositories/approval.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const warehouseRepository = require('../repositories/warehouse.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { now } = require('../utils/time');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function remainingQuantity(line) {
  return Math.max(
    0,
    line.quantity - line.cancelled_quantity - (line.committed_quantity || 0)
  );
}

function creditAssessment(order, lines) {
  const existing = approvalRepository.customerExposure(order.customer_id, order.id);
  const currentOrder = roundMoney(
    lines.reduce((sum, line) => sum + remainingQuantity(line) * line.unit_price, 0)
  );
  const existingExposure = roundMoney(existing.outstanding + existing.openOrders);
  const projectedExposure = roundMoney(existingExposure + currentOrder);
  const creditLimit = Number(order.credit_limit) || 0;
  const exceeds = creditLimit > 0 && projectedExposure > creditLimit + 1e-9;

  return {
    creditLimit,
    hasLimit: creditLimit > 0,
    outstanding: roundMoney(existing.outstanding),
    openOrders: roundMoney(existing.openOrders),
    existingExposure,
    currentOrder,
    projectedExposure,
    exceeds,
    excess: exceeds ? roundMoney(projectedExposure - creditLimit) : 0,
    headroom: creditLimit > 0 ? roundMoney(Math.max(0, creditLimit - projectedExposure)) : null,
  };
}

function stockAssessment(lines) {
  const warehouseId = warehouseRepository.defaultWarehouseId();
  const warehouse = warehouseId ? warehouseRepository.findById(warehouseId) : null;

  const items = lines
    .map((line) => {
      const requested = remainingQuantity(line);
      const balance = warehouseId
        ? inventoryRepository.getBalance(warehouseId, line.product_id)
        : null;
      const onHand = balance ? Number(balance.on_hand) : 0;
      const reserved = balance ? Number(balance.reserved) : 0;
      const available = roundMoney(onHand - reserved);

      return {
        lineId: line.id,
        productId: line.product_id,
        productName: line.product_name,
        sku: line.sku,
        unit: line.unit,
        requested,
        onHand: roundMoney(onHand),
        reserved: roundMoney(reserved),
        available,
        ok: requested <= 0 || available + 1e-9 >= requested,
      };
    })
    .filter((item) => item.requested > 0);

  return {
    warehouseId,
    warehouseName: warehouse ? warehouse.name : null,
    items,
    shortages: items.filter((item) => !item.ok),
    hasShortage: items.some((item) => !item.ok),
  };
}

function listQueue() {
  return approvalRepository.listPending().map((order) => {
    const lines = orderRepository.findLines(order.id);
    return {
      order,
      credit: creditAssessment(order, lines),
      stock: stockAssessment(lines),
    };
  });
}

function getReview(orderId, actor) {
  const data = orderService.getOrder(orderId);
  if (data.order.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted orders can be reviewed for approval.');
  }

  return {
    ...data,
    credit: creditAssessment(data.order, data.lines),
    stock: stockAssessment(data.lines),
    isOwnOrder: data.order.created_by === actor.id,
  };
}

function assertSupervisor(actor) {
  if (actor.role !== 'sales_supervisor') {
    throw new ApiError(403, 'Only a Sales Supervisor can approve or reject orders.');
  }
}

function assertReviewable(order, actor) {
  assertSupervisor(actor);
  if (order.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted orders can be approved or rejected.');
  }
  if (order.created_by === actor.id) {
    throw new ApiError(403, 'You cannot approve or reject an order you created.');
  }
  if (order.customer_status !== 'active') {
    throw new ApiError(400, 'The customer is inactive. The order cannot be approved.');
  }
}

function approveOrder(orderId, body, actor, ipAddress) {
  const { order, lines } = orderService.getOrder(orderId);
  assertReviewable(order, actor);

  const credit = creditAssessment(order, lines);
  const justification = String(body.overrideReason || '').trim();

  if (credit.exceeds && justification.length < 3) {
    throw new ApiError(
      400,
      'This order exceeds the customer credit limit. Provide an override justification of at least 3 characters.'
    );
  }

  const stock = stockAssessment(lines);
  if (stock.hasShortage) {
    const detail = stock.shortages
      .map(
        (item) =>
          `${item.productName} (requested ${item.requested}, available ${item.available})`
      )
      .join('; ');
    throw new ApiError(400, `Approval blocked: insufficient stock for ${detail}.`);
  }

  const db = getDb();
  const approve = db.transaction(() => {
    if (!stock.warehouseId) {
      throw new ApiError(400, 'No default warehouse is configured. Set one before approving orders.');
    }

    for (const item of stock.items) {
      const balance = inventoryRepository.ensureBalance(stock.warehouseId, item.productId);
      const available = Number(balance.on_hand) - Number(balance.reserved);
      if (available + 1e-9 < item.requested) {
        throw new ApiError(
          400,
          `Approval blocked: stock for ${item.productName} changed. Requested ${item.requested}, available ${available}.`
        );
      }

      inventoryRepository.changeReserved(stock.warehouseId, item.productId, item.requested);
      inventoryRepository.createMovement({
        productId: item.productId,
        warehouseId: stock.warehouseId,
        movementType: 'reservation',
        quantity: item.requested,
        referenceType: 'sales_order',
        referenceId: order.id,
        reason: 'Reserved on order approval',
        createdBy: actor.id,
        createdAt: now(),
      });
    }

    orderRepository.setStatus(order.id, 'approved');
    orderRepository.addApproval({
      orderId: order.id,
      action: 'approved',
      reason: credit.exceeds ? justification : null,
      isOverride: credit.exceeds,
      actedBy: actor.id,
    });

    auditService.record({
      userId: actor.id,
      action: 'order_approved',
      entityType: 'sales_order',
      entityId: order.id,
      details: {
        orderNumber: order.order_number,
        total: order.total,
        warehouseId: stock.warehouseId,
        reservedLines: stock.items.map((item) => ({
          product: item.productName,
          quantity: item.requested,
        })),
        creditWarning: credit.exceeds,
        projectedExposure: credit.projectedExposure,
        creditLimit: credit.creditLimit,
        overrideReason: credit.exceeds ? justification : null,
      },
      ipAddress,
    });
  });

  approve();
  return getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(order.id);
}

function rejectOrder(orderId, body, actor, ipAddress) {
  const { order } = orderService.getOrder(orderId);
  assertReviewable(order, actor);

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a rejection reason of at least 3 characters.');
  }

  const db = getDb();
  const reject = db.transaction(() => {
    orderRepository.setStatus(order.id, 'rejected');
    orderRepository.addApproval({
      orderId: order.id,
      action: 'rejected',
      reason,
      isOverride: false,
      actedBy: actor.id,
    });

    auditService.record({
      userId: actor.id,
      action: 'order_rejected',
      entityType: 'sales_order',
      entityId: order.id,
      details: { orderNumber: order.order_number, reason },
      ipAddress,
    });
  });

  reject();
  return getDb().prepare('SELECT * FROM sales_orders WHERE id = ?').get(order.id);
}

module.exports = {
  listQueue,
  getReview,
  creditAssessment,
  stockAssessment,
  approveOrder,
  rejectOrder,
};
