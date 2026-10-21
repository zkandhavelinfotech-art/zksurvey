'use strict';
const { q } = require('./db');
const { event } = require('./core');
/* Deletes real responses older than each account's retention period (Settings → retentionMonths). Runs daily. */
async function purgeRetention() {
  const r = await q("select account_id, (value->>'retentionMonths')::int months from workspace_kv where key='zk_settings_v11' and (value->>'retentionMonths') ~ '^[0-9]+$'");
  let total = 0;
  for (const row of r.rows) {
    if (!(row.months > 0)) continue;
    const d = await q("delete from responses where account_id=$1 and not demo and at < now() - ($2 || ' months')::interval", [row.account_id, String(row.months)]);
    if (d.rowCount) { total += d.rowCount; await event('retention', d.rowCount + ' response(s) older than ' + row.months + ' months deleted', row.account_id); }
  }
  return total;
}
module.exports = { purgeRetention };
