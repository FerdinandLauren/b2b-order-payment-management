const { getDb } = require('../config/database');

const PUBLIC_COLUMNS = 'id, username, full_name, role, status, created_at, updated_at';

function map(row) {
  return row || null;
}

function findByUsername(username) {
  return map(
    getDb()
      .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE username = ?`)
      .get(username)
  );
}

function findById(id) {
  return map(getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id));
}

function findByIdWithPassword(id) {
  return map(
    getDb().prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = ?`).get(id)
  );
}

function list() {
  return getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY role, full_name`).all();
}

function create({ username, passwordHash, fullName, role }) {
  const timestamp = require('../utils/time').now();
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(username, passwordHash, fullName, role, timestamp, timestamp);
  return findById(Number(result.lastInsertRowid));
}

function update(id, { fullName, role, passwordHash }) {
  const timestamp = require('../utils/time').now();
  if (passwordHash) {
    getDb()
      .prepare(
        'UPDATE users SET full_name = ?, role = ?, password_hash = ?, updated_at = ? WHERE id = ?'
      )
      .run(fullName, role, passwordHash, timestamp, id);
  } else {
    getDb()
      .prepare('UPDATE users SET full_name = ?, role = ?, updated_at = ? WHERE id = ?')
      .run(fullName, role, timestamp, id);
  }
  return findById(id);
}

function setStatus(id, status) {
  const timestamp = require('../utils/time').now();
  getDb()
    .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, timestamp, id);
  return findById(id);
}

function countByRole() {
  return getDb()
    .prepare(
      "SELECT role, COUNT(*) AS count FROM users WHERE status = 'active' GROUP BY role ORDER BY role"
    )
    .all();
}

module.exports = {
  findByUsername,
  findById,
  findByIdWithPassword,
  list,
  create,
  update,
  setStatus,
  countByRole,
};
