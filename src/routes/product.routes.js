const express = require('express');
const controller = require('../controllers/product.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  productValidator,
  statusValidator,
} = require('../validators/product.validator');

const router = express.Router();
const VIEW_ROLES = ['sales_staff', 'sales_supervisor', 'warehouse_staff', 'management', 'admin'];
const MANAGE_ROLES = ['admin'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/new', requireRole(...MANAGE_ROLES), controller.newForm);
router.post('/', requireRole(...MANAGE_ROLES), productValidator, validate, controller.create);
router.get('/:id', requireRole(...VIEW_ROLES), controller.show);
router.get('/:id/edit', requireRole(...MANAGE_ROLES), controller.editForm);
router.post('/:id', requireRole(...MANAGE_ROLES), productValidator, validate, controller.update);
router.post(
  '/:id/status',
  requireRole(...MANAGE_ROLES),
  statusValidator,
  validate,
  controller.updateStatus
);

module.exports = router;
