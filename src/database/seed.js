const { runMigrations } = require('./migrate');
const { getDb } = require('../config/database');
const seedUsers = require('./seeders/users.seeder');
const seedCustomers = require('./seeders/customers.seeder');
const seedProducts = require('./seeders/products.seeder');
const seedInventory = require('./seeders/inventory.seeder');

function seed(db = getDb()) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (existing.count > 0) {
    console.log('Seed skipped: database already contains users.');
    return false;
  }

  const run = db.transaction(() => {
    seedUsers(db);
    seedCustomers(db);
    seedProducts(db);
    seedInventory(db);
  });

  run();
  console.log('Seed completed: users, customers, products, inventory.');
  return true;
}

if (require.main === module) {
  runMigrations();
  seed();
}

module.exports = seed;
