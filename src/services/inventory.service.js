const { getDb } = require('../config/database');
const inventoryRepository = require('../repositories/inventory.repository');
const productRepository = require('../repositories/product.repository');
const warehouseRepository = require('../repositories/warehouse.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { now } = require('../utils/time');

function listInventory(filters) {
  return inventoryRepository.listBalances(filters);
}

function listMovements(filters) {
  return inventoryRepository.listMovements(filters);
}

function adjustStock(input, actor, ipAddress) {
  const productId = Number(input.productId);
  const warehouseId = Number(input.warehouseId);
  const quantity = Number(input.quantity);
  const movementType = input.movementType;
  const reason = String(input.reason || '').trim();

  if (!productRepository.findById(productId)) throw new ApiError(400, 'Select a valid product.');
  const warehouse = warehouseRepository.findById(warehouseId);
  if (!warehouse) throw new ApiError(400, 'Select a valid warehouse.');
  if (warehouse.status !== 'active') throw new ApiError(400, 'The selected warehouse is inactive.');

  if (!['adjustment_in', 'adjustment_out'].includes(movementType)) {
    throw new ApiError(400, 'Select a valid adjustment type.');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Adjustment quantity must be greater than zero.');
  }
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a reason for the adjustment.');
  }

  const db = getDb();
  const adjust = db.transaction(() => {
    const balance = inventoryRepository.ensureBalance(warehouseId, productId);
    const delta = movementType === 'adjustment_in' ? quantity : -quantity;
    const nextOnHand = balance.on_hand + delta;

    if (nextOnHand < 0) {
      throw new ApiError(400, 'Adjustment would make on-hand stock negative.');
    }
    if (nextOnHand < balance.reserved) {
      throw new ApiError(
        400,
        `Adjustment blocked: ${balance.reserved} units are reserved for approved orders.`
      );
    }

    inventoryRepository.setOnHand(warehouseId, productId, nextOnHand);
    inventoryRepository.createMovement({
      productId,
      warehouseId,
      movementType,
      quantity: delta,
      referenceType: 'adjustment',
      referenceId: null,
      reason,
      createdBy: actor.id,
      createdAt: now(),
    });

    auditService.record({
      userId: actor.id,
      action: 'inventory_adjusted',
      entityType: 'inventory',
      entityId: productId,
      details: { productId, warehouseId, movementType, quantity, reason },
      ipAddress,
    });

    return inventoryRepository.getBalance(warehouseId, productId);
  });

  return adjust();
}

module.exports = { listInventory, listMovements, adjustStock };
