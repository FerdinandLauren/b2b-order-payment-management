const { getDb } = require('../config/database');
const { now } = require('../utils/time');

function nextSequence(entity, year = 'GLOBAL') {
  const row = getDb()
    .prepare(
      `INSERT INTO number_counters (entity, year, last_number)
       VALUES (?, ?, 1)
       ON CONFLICT(entity, year) DO UPDATE SET last_number = last_number + 1
       RETURNING last_number`
    )
    .get(entity, String(year));
  return row.last_number;
}

function record(entity, year, lastNumber) {
  getDb()
    .prepare(
      `INSERT INTO number_counters (entity, year, last_number)
       VALUES (?, ?, ?)
       ON CONFLICT(entity, year) DO UPDATE SET last_number = excluded.last_number`
    )
    .run(entity, String(year), lastNumber);
}

module.exports = { nextSequence, record, now };
