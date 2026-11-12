const express = require('express');
const controller = require('../controllers/audit.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('management', 'admin'));

router.get('/', controller.index);

module.exports = router;
