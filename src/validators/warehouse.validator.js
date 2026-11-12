const { body } = require('express-validator');

const warehouseValidator = [
  body('code')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9-]{3,20}$/)
    .withMessage('Warehouse code must be 3-20 characters (letters, numbers, hyphen).'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Warehouse name must be 2-100 characters.'),
  body('address')
    .optional({ values: 'falsy' })
    .isLength({ max: 200 })
    .withMessage('Address is too long.'),
];

const statusValidator = [
  body('status').isIn(['active', 'inactive']).withMessage('Select a valid status.'),
];

module.exports = { warehouseValidator, statusValidator };
