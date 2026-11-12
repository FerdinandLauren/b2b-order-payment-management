module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/database/**'],
};
