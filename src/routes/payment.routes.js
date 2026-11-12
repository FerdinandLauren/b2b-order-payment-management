const express = require('express');
const controller = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { paymentValidator } = require('../validators/payment.validator');

const router = express.Router();
const VIEW_ROLES = ['finance_staff', 'management', 'admin'];
const FINANCE = ['finance_staff'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/new', requireRole(...FINANCE), controller.newForm);
router.post('/', requireRole(...FINANCE), paymentValidator, validate, controller.create);
router.get('/:id', requireRole(...VIEW_ROLES), controller.show);
router.post('/:id/allocations', requireRole(...FINANCE), controller.allocate);

module.exports = router;
