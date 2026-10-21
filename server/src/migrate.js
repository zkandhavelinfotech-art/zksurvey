'use strict';
const fs = require('fs'), path = require('path');
const cfg = require('./config');
const { pool, q } = require('./db');

async function migrate() {
  if (cfg.dbDialect === 'mysql') {
    await q(`create table if not exists schema_migrations (
      name varchar(100) primary key,
      applied_at datetime(3) not null default current_timestamp(3)
    ) engine=InnoDB default charset=utf8mb4`);

    const dir = path.join(__dirname, '..', 'migrations', 'mysql');
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const done = new Set((await q('select name from schema_migrations')).rows.map(r => r.name));

    for (const f of files) {
      if (done.has(f)) continue;
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const stmts = content
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const sql of stmts) {
        if (!sql) continue;
        await q(sql);
      }
      await q('insert into schema_migrations(name) values (?)', [f]);
      console.log('applied mysql migration', f);
    }
  } else {
    await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const dir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const done = new Set((await pool.query('select name from schema_migrations')).rows.map(r => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const c = await pool.connect();
      try {
        await c.query('begin');
        await c.query(sql);
        await c.query('insert into schema_migrations(name) values ($1)', [f]);
        await c.query('commit');
        console.log('applied postgres migration', f);
      } catch (e) {
        await c.query('rollback');
        throw e;
      } finally {
        c.release();
      }
    }
  }
}

module.exports = migrate;
if (require.main === module) migrate().then(() => pool.end && pool.end()).catch(e => { console.error(e); process.exit(1); });
