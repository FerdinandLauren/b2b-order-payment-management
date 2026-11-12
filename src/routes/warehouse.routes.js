const express = require('express');
const controller = require('../controllers/warehouse.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  warehouseValidator,
  statusValidator,
} = require('../validators/warehouse.validator');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'warehouse_staff'));

router.get('/', controller.index);
router.get('/new', requireRole('admin'), controller.newForm);
router.post(
  '/',
  requireRole('admin'),
  warehouseValidator,
  validate,
  controller.create
);
router.get('/:id/edit', requireRole('admin'), controller.editForm);
router.post(
  '/:id',
  requireRole('admin'),
  warehouseValidator,
  validate,
  controller.update
);
router.post(
  '/:id/status',
  requireRole('admin'),
  statusValidator,
  validate,
  controller.updateStatus
);

module.exports = router;
