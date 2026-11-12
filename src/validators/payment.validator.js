const { body } = require('express-validator');
const { PAYMENT_METHOD } = require('../utils/constants');

const paymentValidator = [
  body('customerId').isInt({ min: 1 }).withMessage('Select a valid customer.').toInt(),
  body('paymentDate')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Enter a valid payment date.'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Enter a payment amount greater than zero.')
    .toFloat(),
  body('method')
    .isIn(Object.keys(PAYMENT_METHOD))
    .withMessage('Select a valid payment method.'),
  body('reference')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 })
    .withMessage('The payment reference is too long.'),
  body('notes')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Payment notes are too long.'),
];

module.exports = { paymentValidator };
