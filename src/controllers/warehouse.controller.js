const warehouseService = require('../services/warehouse.service');
const { setFlash } = require('../middleware/flash.middleware');
const ApiError = require('../utils/ApiError');

function index(req, res) {
  res.render('warehouses/index', {
    title: 'Warehouses',
    warehouses: warehouseService.listWarehouses(),
  });
}

function newForm(req, res) {
  res.render('warehouses/form', { title: 'New warehouse', mode: 'create', warehouse: null });
}

function create(req, res, next) {
  try {
    warehouseService.createWarehouse(
      { code: req.body.code, name: req.body.name, address: req.body.address },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Warehouse created.');
    res.redirect('/warehouses');
  } catch (error) {
    next(error);
  }
}

function editForm(req, res, next) {
  try {
    const warehouse = warehouseService
      .listWarehouses()
      .find((item) => item.id === Number(req.params.id));
    if (!warehouse) throw new ApiError(404, 'Warehouse not found.');

    res.render('warehouses/form', {
      title: 'Edit warehouse',
      mode: 'edit',
      warehouse,
    });
  } catch (error) {
    next(error);
  }
}

function update(req, res, next) {
  try {
    warehouseService.updateWarehouse(
      Number(req.params.id),
      { name: req.body.name, address: req.body.address },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Warehouse updated.');
    res.redirect('/warehouses');
  } catch (error) {
    next(error);
  }
}

function updateStatus(req, res, next) {
  try {
    warehouseService.setWarehouseStatus(
      Number(req.params.id),
      req.body.status,
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Warehouse status updated.');
    res.redirect('/warehouses');
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, editForm, update, updateStatus };
