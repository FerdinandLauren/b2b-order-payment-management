const express = require('express');
const controller = require('../controllers/inventory.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { adjustmentValidator } = require('../validators/inventory.validator');

const router = express.Router();
const VIEW_ROLES = ['sales_staff', 'sales_supervisor', 'warehouse_staff', 'management', 'admin'];
const ADJUST_ROLES = ['warehouse_staff', 'admin'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/movements', requireRole(...VIEW_ROLES), controller.movements);
router.get('/adjustments/new', requireRole(...ADJUST_ROLES), controller.newAdjustment);
router.post(
  '/adjustments',
  requireRole(...ADJUST_ROLES),
  adjustmentValidator,
  validate,
  controller.createAdjustment
);

module.exports = router;
