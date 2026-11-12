const env = require('./config/env');
const { getDb } = require('./config/database');
const { runMigrations } = require('./database/migrate');
const seed = require('./database/seed');
const { createApp } = require('./app');

const db = getDb();
runMigrations(db);

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  seed(db);
}

const app = createApp();

app.listen(env.port, () => {
  console.log(`${env.companyName} - ${env.appName}`);
  console.log(`Server running at http://localhost:${env.port}`);
});
