const { body } = require('express-validator');

const invoiceValidator = [
  body('deliveryId').isInt({ min: 1 }).withMessage('Select a valid delivered shipment.').toInt(),
  body('invoiceDate')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Enter a valid invoice date.'),
];

const voidValidator = [
  body('reason')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Provide a void reason of at least 3 characters.'),
];

module.exports = { invoiceValidator, voidValidator };
