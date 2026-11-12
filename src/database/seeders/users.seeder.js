const bcrypt = require('bcryptjs');
const { now } = require('../../utils/time');

const USERS = [
  { username: 'sales', password: 'sales123', full_name: 'Siti Nurhaliza', role: 'sales_staff' },
  { username: 'supervisor', password: 'supervisor123', full_name: 'Budi Santoso', role: 'sales_supervisor' },
  { username: 'warehouse', password: 'warehouse123', full_name: 'Agus Prasetyo', role: 'warehouse_staff' },
  { username: 'finance', password: 'finance123', full_name: 'Dewi Lestari', role: 'finance_staff' },
  { username: 'management', password: 'management123', full_name: 'Rudi Hartono', role: 'management' },
  { username: 'admin', password: 'admin123', full_name: 'System Administrator', role: 'admin' },
];

module.exports = function seedUsers(db) {
  const insert = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `);

  const timestamp = now();
  for (const user of USERS) {
    insert.run(
      user.username,
      bcrypt.hashSync(user.password, 10),
      user.full_name,
      user.role,
      timestamp,
      timestamp
    );
  }

  return USERS.length;
};

module.exports.USERS = USERS;
