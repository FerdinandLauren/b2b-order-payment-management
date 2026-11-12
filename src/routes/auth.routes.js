const express = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth, requireGuest } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { loginValidator } = require('../validators/auth.validator');

const router = express.Router();

router.get('/login', requireGuest, controller.showLogin);
router.post('/login', requireGuest, loginValidator, validate, controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/forbidden', requireAuth, controller.showForbidden);

module.exports = router;
