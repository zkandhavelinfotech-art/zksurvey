'use strict';
const cfg = require('./config');

let pool, q, tx;

if (cfg.dbDialect === 'mysql') {
  const mysql = require('mysql2/promise');
  const myPool = mysql.createPool({
    uri: cfg.databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
  });
  myPool.on('error', e => console.error(JSON.stringify({ level: 'error', msg: 'mysql pool error', err: e.message })));

  function convertSql(text, params = []) {
    let sql = text;
    const newParams = [];

    // Replace $1, $2 with corresponding parameters
    sql = sql.replace(/\$([0-9]+)/g, (match, num) => {
      const idx = parseInt(num, 10) - 1;
      newParams.push(params[idx]);
      return '?';
    });

    // Remove Postgres typecasts
    sql = sql.replace(/::(int|bigint|text|jsonb|interval)/gi, '');

    // Aggregates filter (PostgreSQL -> MySQL equivalent)
    sql = sql.replace(/count\(\*\)\s+filter\s*\(where\s+([^)]+)\)/gi, 'sum(case when $1 then 1 else 0 end)');

    // Timestamps
    sql = sql.replace(/\(extract\(epoch\s+from\s+([a-zA-Z0-9_.]+)\)\s*\*\s*1000\)/gi, 'round(unix_timestamp($1)*1000)');
    sql = sql.replace(/extract\(epoch\s+from\s+([a-zA-Z0-9_.]+)\)\s*\*\s*1000/gi, 'round(unix_timestamp($1)*1000)');
    sql = sql.replace(/to_timestamp\(([^)]+)\/1000\.0\)/gi, 'from_unixtime($1 / 1000)');

    // Intervals
    sql = sql.replace(/now\(\)\s*\+\s*\(\s*\?\s*\|\|\s*' days'\s*\)/gi, 'date_add(now(), interval ? day)');
    sql = sql.replace(/now\(\)\s*\+\s*\(\s*\?\s*\|\|\s*' hours'\s*\)/gi, 'date_add(now(), interval ? hour)');
    sql = sql.replace(/now\(\)\s*-\s*\(\s*\?\s*\|\|\s*' months'\s*\)/gi, 'date_sub(now(), interval ? month)');
    sql = sql.replace(/now\(\)\s*\+\s*interval\s*'1 hour'/gi, "date_add(now(), interval 1 hour)");
    sql = sql.replace(/now\(\)\s*\+\s*interval\s*'15 minutes'/gi, "date_add(now(), interval 15 minute)");
    sql = sql.replace(/now\(\)\s*-\s*interval\s*'3 days'/gi, "date_sub(now(), interval 3 day)");
    sql = sql.replace(/now\(\)\s*-\s*interval\s*'30 seconds'/gi, "date_sub(now(), interval 30 second)");

    // Array / ANY comparison
    sql = sql.replace(/=\s*any\(\?\)/gi, 'in (?)');

    // Advisory lock
    sql = sql.replace(/pg_advisory_xact_lock\(hashtext\(\?\)\)/gi, 'get_lock(?, 5)');

    // ON CONFLICT (x) DO UPDATE SET -> ON DUPLICATE KEY UPDATE
    sql = sql.replace(/on\s+conflict\s*\([^)]+\)\s+do\s+update\s+set/gi, 'on duplicate key update');
    sql = sql.replace(/on\s+conflict\s*\([^)]+\)\s+do\s+nothing/gi, 'on duplicate key update id=id');
    sql = sql.replace(/coalesce\(excluded\.([a-zA-Z0-9_]+),\s*([^)]+)\)/gi, 'coalesce(values($1), $2)');
    sql = sql.replace(/excluded\.([a-zA-Z0-9_]+)/gi, 'values($1)');

    // Strip RETURNING for standard MySQL
    const returningMatch = sql.match(/\s+returning\s+([a-zA-Z0-9_, ]+)$/i);
    if (returningMatch) {
      sql = sql.replace(/\s+returning\s+([a-zA-Z0-9_, ]+)$/i, '');
    }

    // Format params for MySQL JSON columns: objects/arrays to JSON strings
    const finalParams = newParams.map(p => {
      if (p !== null && typeof p === 'object' && !Buffer.isBuffer(p) && !(p instanceof Date)) {
        return JSON.stringify(p);
      }
      return p;
    });

    return { sql, params: finalParams, returning: returningMatch ? returningMatch[1].trim() : null };
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      const out = {};
      for (const k of Object.keys(r)) {
        let v = r[k];
        if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
          try { v = JSON.parse(v); } catch (_) {}
        }
        out[k] = v;
      }
      return out;
    });
  }

  async function myQuery(conn, text, params = []) {
    const { sql, params: finalParams, returning } = convertSql(text, params);
    const [result] = await conn.query(sql, finalParams);
    if (Array.isArray(result)) {
      return { rows: normalizeRows(result), rowCount: result.length };
    }
    const rowCount = result.affectedRows || 0;
    const rows = [];
    if (returning && result.insertId) {
      rows.push({ [returning]: result.insertId });
    }
    return { rows, rowCount, insertId: result.insertId };
  }

  q = (text, params) => myQuery(myPool, text, params);
  tx = async (fn) => {
    const conn = await myPool.getConnection();
    try {
      await conn.beginTransaction();
      const wrapped = {
        query: (text, params) => myQuery(conn, text, params)
      };
      const r = await fn(wrapped);
      await conn.commit();
      return r;
    } catch (e) {
      try { await conn.rollback(); } catch (_) {}
      throw e;
    } finally {
      conn.release();
    }
  };
  pool = myPool;
} else {
  const { Pool } = require('pg');
  const pgPool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
  pgPool.on('error', e => console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', err: e.message })));
  q = (text, params) => pgPool.query(text, params);
  tx = async function(fn) {
    const c = await pgPool.connect();
    try {
      await c.query('begin');
      const r = await fn(c);
      await c.query('commit');
      return r;
    } catch (e) {
      try { await c.query('rollback'); } catch (_) {}
      throw e;
    } finally {
      c.release();
    }
  };
  pool = pgPool;
}

module.exports = { pool, q, tx, dialect: cfg.dbDialect };
