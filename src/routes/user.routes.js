const express = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  createUserValidator,
  updateUserValidator,
  statusValidator,
} = require('../validators/user.validator');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.index);
router.get('/new', controller.newForm);
router.post('/', createUserValidator, validate, controller.create);
router.get('/:id/edit', controller.editForm);
router.post('/:id', updateUserValidator, validate, controller.update);
router.post('/:id/status', statusValidator, validate, controller.updateStatus);

module.exports = router;
