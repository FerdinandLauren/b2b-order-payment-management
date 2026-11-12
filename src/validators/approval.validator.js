const { body } = require('express-validator');

const approveValidator = [
  body('overrideReason')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('The override justification is too long.'),
];

const rejectValidator = [
  body('reason')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Provide a rejection reason of at least 3 characters.'),
];

module.exports = { approveValidator, rejectValidator };
