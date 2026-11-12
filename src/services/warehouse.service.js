const { getDb } = require('../config/database');
const warehouseRepository = require('../repositories/warehouse.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');

function listWarehouses() {
  return warehouseRepository.list();
}

function createWarehouse(input, actor, ipAddress) {
  const code = String(input.code || '').trim().toUpperCase();
  const name = String(input.name || '').trim();

  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    throw new ApiError(400, 'Warehouse code must be 3-20 characters (letters, numbers, hyphen).');
  }
  if (name.length < 2) throw new ApiError(400, 'Warehouse name is required.');
  if (warehouseRepository.findByCode(code)) {
    throw new ApiError(409, 'That warehouse code is already in use.');
  }

  const db = getDb();
  const create = db.transaction(() => {
    const warehouse = warehouseRepository.create({
      code,
      name,
      address: String(input.address || '').trim() || null,
    });

    auditService.record({
      userId: actor.id,
      action: 'warehouse_created',
      entityType: 'warehouse',
      entityId: warehouse.id,
      details: { code: warehouse.code, name: warehouse.name },
      ipAddress,
    });

    return warehouse;
  });

  return create();
}

function updateWarehouse(id, input, actor, ipAddress) {
  const existing = warehouseRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Warehouse not found.');

  const name = String(input.name || '').trim();
  if (name.length < 2) throw new ApiError(400, 'Warehouse name is required.');

  const db = getDb();
  const update = db.transaction(() => {
    const warehouse = warehouseRepository.update(id, {
      name,
      address: String(input.address || '').trim() || null,
    });

    auditService.record({
      userId: actor.id,
      action: 'warehouse_updated',
      entityType: 'warehouse',
      entityId: warehouse.id,
      details: { code: warehouse.code, name: warehouse.name },
      ipAddress,
    });

    return warehouse;
  });

  return update();
}

function setWarehouseStatus(id, status, actor, ipAddress) {
  if (!['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Invalid status.');
  }

  const existing = warehouseRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Warehouse not found.');

  if (status === 'inactive' && warehouseRepository.defaultWarehouseId() === Number(id)) {
    throw new ApiError(400, 'The default warehouse cannot be deactivated.');
  }

  const db = getDb();
  const change = db.transaction(() => {
    const warehouse = warehouseRepository.setStatus(id, status);
    auditService.record({
      userId: actor.id,
      action: 'warehouse_status_changed',
      entityType: 'warehouse',
      entityId: warehouse.id,
      details: { status },
      ipAddress,
    });
    return warehouse;
  });

  return change();
}

module.exports = { listWarehouses, createWarehouse, updateWarehouse, setWarehouseStatus };
