const express = require('express');

const router = express.Router();

router.use('/', require('./auth.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/products', require('./product.routes'));
router.use('/categories', require('./category.routes'));
router.use('/warehouses', require('./warehouse.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/orders', require('./order.routes'));
router.use('/approvals', require('./approval.routes'));
router.use('/deliveries', require('./delivery.routes'));
router.use('/invoices', require('./invoice.routes'));
router.use('/users', require('./user.routes'));
router.use('/', require('./dashboard.routes'));

module.exports = router;
