const fs = require('fs');
const env = require('../config/env');

if (env.dbPath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${env.dbPath}${suffix}`;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

const { runMigrations } = require('./migrate');
const seed = require('./seed');

runMigrations();
seed();
console.log('Database reset completed.');
