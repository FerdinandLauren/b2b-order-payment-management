const express = require('express');
const controller = require('../controllers/invoice.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { invoiceValidator, voidValidator } = require('../validators/invoice.validator');

const router = express.Router();
const VIEW_ROLES = [
  'sales_staff',
  'sales_supervisor',
  'finance_staff',
  'management',
  'admin',
];
const FINANCE = ['finance_staff'];

router.use(requireAuth);

router.get('/', requireRole(...VIEW_ROLES), controller.index);
router.get('/new', requireRole(...FINANCE), controller.newForm);
router.post('/', requireRole(...FINANCE), invoiceValidator, validate, controller.create);
router.get('/:id', requireRole(...VIEW_ROLES), controller.show);
router.post('/:id/issue', requireRole(...FINANCE), controller.issue);
router.post('/:id/void', requireRole(...FINANCE), voidValidator, validate, controller.voidInvoice);

module.exports = router;
