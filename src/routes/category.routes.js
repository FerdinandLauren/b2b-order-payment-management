const express = require('express');
const controller = require('../controllers/category.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { categoryValidator } = require('../validators/product.validator');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.index);
router.post('/', categoryValidator, validate, controller.create);
router.post('/:id', categoryValidator, validate, controller.rename);

module.exports = router;
