const express = require('express');
const controller = require('../controllers/delivery.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  deliveryValidator,
  exceptionValidator,
  resolveValidator,
  cancelValidator,
} = require('../validators/delivery.validator');

const router = express.Router();
const VIEW_ROLES = [
  'sales_staff',
  'sales_supervisor',
  'warehouse_staff',
  'finance_staff',
  'management',
  'admin',
];
const WAREHOUSE = ['warehouse_staff'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/new', requireRole(...WAREHOUSE), controller.newForm);
router.post('/', requireRole(...WAREHOUSE), deliveryValidator, validate, controller.create);
router.get('/:id', requireRole(...VIEW_ROLES), controller.show);
router.post('/:id/dispatch', requireRole(...WAREHOUSE), controller.dispatch);
router.post('/:id/confirm', requireRole(...WAREHOUSE), controller.confirm);
router.post('/:id/exception', requireRole(...WAREHOUSE), exceptionValidator, validate, controller.exception);
router.post('/:id/resolve', requireRole(...WAREHOUSE), resolveValidator, validate, controller.resolve);
router.post('/:id/cancel', requireRole(...WAREHOUSE), cancelValidator, validate, controller.cancel);

module.exports = router;
