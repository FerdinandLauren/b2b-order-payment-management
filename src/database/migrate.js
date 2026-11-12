const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/database');
const { now } = require('../utils/time');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function runMigrations(db = getDb()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT filename FROM schema_migrations').all().map((row) => row.filename)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)').run(
        file,
        now()
      );
    });

    apply();
    console.log(`Applied migration: ${file}`);
  }

  return files.length;
}

if (require.main === module) {
  runMigrations();
  console.log('Database migrated successfully.');
}

module.exports = { runMigrations };
