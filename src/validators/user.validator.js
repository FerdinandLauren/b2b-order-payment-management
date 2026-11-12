const { body } = require('express-validator');
const { ROLE_LIST } = require('../utils/constants');

const createUserValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3-32 characters.')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Username may only contain letters, numbers, dots, underscores, and hyphens.'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Full name must be 2-80 characters.'),
  body('role').isIn(ROLE_LIST).withMessage('Select a valid role.'),
  body('password')
    .isLength({ min: 6, max: 72 })
    .withMessage('Password must be at least 6 characters.'),
];

const updateUserValidator = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Full name must be 2-80 characters.'),
  body('role').isIn(ROLE_LIST).withMessage('Select a valid role.'),
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: 6, max: 72 })
    .withMessage('New password must be at least 6 characters.'),
];

const statusValidator = [
  body('status').isIn(['active', 'inactive']).withMessage('Select a valid status.'),
];

module.exports = { createUserValidator, updateUserValidator, statusValidator };
