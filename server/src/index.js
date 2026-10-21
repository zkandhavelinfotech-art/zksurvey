'use strict';
const cfg = require('./config');
const migrate = require('./migrate');
const createApp = require('./app');
const { pool } = require('./db');
const { ensureSuper } = require('./create-super');
const { expireSubscriptions } = require('./routes/billing');
const { purgeRetention } = require('./jobs');

async function main() {
  await migrate();
  await ensureSuper(false);
  const app = createApp();
  const server = app.listen(cfg.port, () => console.log(JSON.stringify({ level: 'info', msg: 'ZKSurvey v13 listening', port: cfg.port, appUrl: cfg.appUrl, payment: cfg.paymentMode })));
  const timer = setInterval(() => expireSubscriptions().catch(e => console.error('expiry job', e.message)), 3600 * 1000); timer.unref();
  const t2 = setInterval(() => purgeRetention().catch(e => console.error('retention job', e.message)), 24 * 3600 * 1000); t2.unref();
  const stop = () => { server.close(() => pool.end().then(() => process.exit(0))); setTimeout(() => process.exit(1), 8000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
function logDbHelp(e) {
  if ((e.code === 'EACCES' || e.code === 'ECONNREFUSED') && (e.port === 5432 || /5432/.test(e.message))) {
    console.error('\n' + '='.repeat(68));
    console.error('DATABASE ERROR: Attempted to connect to PostgreSQL on port 5432.');
    console.error('If you are on GoDaddy or cPanel shared hosting, PostgreSQL is not supported.');
    console.error('Please configure your cPanel Environment Variables to use MySQL:');
    console.error('  DB_DIALECT=mysql');
    console.error('  MYSQL_URL=mysql://<db_user>:<db_pass>@127.0.0.1:3306/<db_name>');
    console.error('='.repeat(68) + '\n');
  }
}

if (require.main === module) {
  main().catch(e => {
    logDbHelp(e);
    console.error(e);
    process.exit(1);
  });
}
module.exports = { main, logDbHelp };
