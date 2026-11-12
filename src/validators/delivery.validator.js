const { body } = require('express-validator');

const deliveryValidator = [
  body('orderId').isInt({ min: 1 }).withMessage('Select a valid sales order.').toInt(),
  body('deliveryDate')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Enter a valid delivery date.'),
  body('notes').optional({ values: 'falsy' }).isLength({ max: 500 }).withMessage('Notes are too long.'),
];

const exceptionValidator = [
  body('reason')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Provide a delivery exception reason of at least 3 characters.'),
];

const resolveValidator = [
  body('outcome').isIn(['delivered', 'cancelled']).withMessage('Select a valid resolution.'),
  body('note').optional({ values: 'falsy' }).isLength({ max: 300 }).withMessage('The note is too long.'),
];

const cancelValidator = [
  body('reason')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Provide a cancellation reason of at least 3 characters.'),
];

module.exports = { deliveryValidator, exceptionValidator, resolveValidator, cancelValidator };
