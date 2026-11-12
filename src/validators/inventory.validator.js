const { body } = require('express-validator');

const adjustmentValidator = [
  body('productId').isInt({ min: 1 }).withMessage('Select a product.').toInt(),
  body('warehouseId').isInt({ min: 1 }).withMessage('Select a warehouse.').toInt(),
  body('movementType')
    .isIn(['adjustment_in', 'adjustment_out'])
    .withMessage('Select a valid adjustment type.'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be greater than zero.')
    .toFloat(),
  body('reason')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Provide a reason of at least 3 characters.'),
];

module.exports = { adjustmentValidator };
