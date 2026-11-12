const express = require('express');
const controller = require('../controllers/approval.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { approveValidator, rejectValidator } = require('../validators/approval.validator');

const router = express.Router();

router.use(requireAuth, requireRole('sales_supervisor'));

router.get('/', controller.index);
router.get('/:id', controller.show);
router.post('/:id/approve', approveValidator, validate, controller.approve);
router.post('/:id/reject', rejectValidator, validate, controller.reject);

module.exports = router;
