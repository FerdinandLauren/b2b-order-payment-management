const { body } = require('express-validator');

const customerValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Customer name must be 2-120 characters.'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .isLength({ max: 30 })
    .withMessage('Phone number is too long.'),
  body('paymentTermsDays')
    .isInt({ min: 0, max: 365 })
    .withMessage('Payment terms must be between 0 and 365 days.')
    .toInt(),
  body('creditLimit')
    .isFloat({ min: 0 })
    .withMessage('Credit limit cannot be negative.')
    .toFloat(),
];

const statusValidator = [
  body('status').isIn(['active', 'inactive']).withMessage('Select a valid status.'),
];

module.exports = { customerValidator, statusValidator };
