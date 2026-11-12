const { body } = require('express-validator');
const { UNITS } = require('../utils/constants');

const productValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Product name must be 2-120 characters.'),
  body('categoryId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('unit').isIn(UNITS).withMessage('Select a valid unit of measure.'),
  body('unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price cannot be negative.')
    .toFloat(),
];

const categoryValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Category name must be 2-60 characters.'),
];

const statusValidator = [
  body('status').isIn(['active', 'inactive']).withMessage('Select a valid status.'),
];

module.exports = { productValidator, categoryValidator, statusValidator };
