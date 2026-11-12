const path = require('path');
require('dotenv').config();

const root = path.resolve(__dirname, '..', '..');
const rawPath = process.env.DATABASE_PATH || './database/b2b.db';

module.exports = {
  root,
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest: (process.env.NODE_ENV || 'development') === 'test',
  sessionSecret: process.env.SESSION_SECRET || 'insecure-development-secret',
  dbPath: rawPath === ':memory:' ? rawPath : path.resolve(root, rawPath),
  companyName: 'PT Maju Bersama',
  appName: 'Order & Payment Management',
};
