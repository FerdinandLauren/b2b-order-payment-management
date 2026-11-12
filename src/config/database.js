const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');

let instance = null;

function getDb() {
  if (instance) return instance;

  if (env.dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  }

  instance = new Database(env.dbPath);
  instance.pragma('foreign_keys = ON');
  if (env.dbPath !== ':memory:') {
    instance.pragma('journal_mode = WAL');
  }
  return instance;
}

function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

module.exports = { getDb, closeDb };
