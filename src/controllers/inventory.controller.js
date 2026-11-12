const inventoryService = require('../services/inventory.service');
const productService = require('../services/product.service');
const warehouseService = require('../services/warehouse.service');
const { setFlash } = require('../middleware/flash.middleware');

function index(req, res) {
  res.render('inventory/index', {
    title: 'Inventory',
    balances: inventoryService.listInventory({
      q: req.query.q,
      warehouseId: req.query.warehouseId ? Number(req.query.warehouseId) : null,
    }),
    warehouses: warehouseService.listWarehouses(),
    filters: { q: req.query.q || '', warehouseId: req.query.warehouseId || '' },
  });
}

function movements(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const filters = {
    productId: req.query.productId ? Number(req.query.productId) : null,
    warehouseId: req.query.warehouseId ? Number(req.query.warehouseId) : null,
    movementType: req.query.movementType || null,
    limit,
    offset: (page - 1) * limit,
  };

  const result = inventoryService.listMovements(filters);

  res.render('inventory/movements', {
    title: 'Stock movements',
    movements: result.rows,
    total: result.total,
    page,
    limit,
    warehouses: warehouseService.listWarehouses(),
    filters: {
      productId: req.query.productId || '',
      warehouseId: req.query.warehouseId || '',
      movementType: req.query.movementType || '',
    },
  });
}

function newAdjustment(req, res) {
  res.render('inventory/adjustment', {
    title: 'Stock adjustment',
    products: productService.listProducts({ status: 'active' }),
    warehouses: warehouseService.listWarehouses().filter((warehouse) => warehouse.status === 'active'),
  });
}

function createAdjustment(req, res, next) {
  try {
    inventoryService.adjustStock(
      {
        productId: req.body.productId,
        warehouseId: req.body.warehouseId,
        movementType: req.body.movementType,
        quantity: req.body.quantity,
        reason: req.body.reason,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Stock adjustment recorded.');
    res.redirect('/inventory');
  } catch (error) {
    next(error);
  }
}

module.exports = { index, movements, newAdjustment, createAdjustment };
