const express = require('express');

const router = express.Router();

router.use('/', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/', require('./dashboard.routes'));

module.exports = router;
