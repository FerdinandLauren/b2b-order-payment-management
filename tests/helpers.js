const request = require('supertest');
const { getDb, closeDb } = require('../src/config/database');
const { runMigrations } = require('../src/database/migrate');
const seed = require('../src/database/seed');
const { createApp } = require('../src/app');

function setupTestDb() {
  const db = getDb();
  runMigrations(db);
  seed(db);
  return db;
}

function teardownTestDb() {
  closeDb();
}

async function loginAs(app, username, password) {
  const agent = request.agent(app);
  const response = await agent.post('/login').type('form').send({ username, password });
  if (response.status !== 302) {
    throw new Error(`Login failed for ${username}: status ${response.status}`);
  }
  return agent;
}

module.exports = {
  request,
  createApp,
  getDb,
  setupTestDb,
  teardownTestDb,
  loginAs,
};
