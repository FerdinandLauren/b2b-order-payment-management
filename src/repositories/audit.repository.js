const { getDb } = require('../config/database');

function create({ userId, action, entityType, entityId, details, ipAddress, createdAt }) {
  const result = getDb()
    .prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId || null,
      action,
      entityType,
      entityId || null,
      details ? JSON.stringify(details) : null,
      ipAddress || null,
      createdAt
    );
  return Number(result.lastInsertRowid);
}

function list({ entityType, action, userId, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (entityType) {
    conditions.push('a.entity_type = ?');
    params.push(entityType);
  }
  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }
  if (userId) {
    conditions.push('a.user_id = ?');
    params.push(userId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = getDb()
    .prepare(
      `SELECT a.*, u.full_name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const total = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM audit_logs a ${where}`)
    .get(...params).count;

  return { rows, total };
}

function recent(limit = 8) {
  return getDb()
    .prepare(
      `SELECT a.*, u.full_name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.id DESC
       LIMIT ?`
    )
    .all(limit);
}

function countByAction(action, sinceDate) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM audit_logs WHERE action = ? AND created_at >= ?`
    )
    .get(action, sinceDate).count;
}

module.exports = { create, list, recent, countByAction };
