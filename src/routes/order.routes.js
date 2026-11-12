const express = require('express');
const controller = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { orderValidator, cancelValidator } = require('../validators/order.validator');

const router = express.Router();
const VIEW_ROLES = ['sales_staff', 'sales_supervisor', 'warehouse_staff', 'finance_staff', 'management', 'admin'];
const SALES_ROLES = ['sales_staff', 'sales_supervisor'];
const CANCEL_ROLES = ['sales_staff', 'sales_supervisor'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/new', requireRole(...SALES_ROLES), controller.newForm);
router.post('/', requireRole(...SALES_ROLES), orderValidator, validate, controller.create);
router.get('/:id', requireRole(...VIEW_ROLES), controller.show);
router.get('/:id/edit', requireRole(...SALES_ROLES), controller.editForm);
router.post('/:id', requireRole(...SALES_ROLES), orderValidator, validate, controller.update);
router.post('/:id/submit', requireRole(...SALES_ROLES), controller.submit);
router.post('/:id/cancel', requireRole(...CANCEL_ROLES), cancelValidator, validate, controller.cancel);

module.exports = router;
