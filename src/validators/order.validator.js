const { body } = require('express-validator');

const orderValidator = [
  body('customerId').isInt({ min: 1 }).withMessage('Select a valid customer.').toInt(),
  body('orderDate')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Enter a valid order date.'),
  body('notes').optional({ values: 'falsy' }).isLength({ max: 500 }).withMessage('Notes are too long.'),
];

const cancelValidator = [
  body('reason')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Provide a cancellation reason of at least 3 characters.'),
];

module.exports = { orderValidator, cancelValidator };
