'use strict';
/* Creates the platform Super Admin from SUPER_EMAIL / SUPER_PASSWORD. There is no built-in default login. */
const cfg = require('./config');
const { q, pool } = require('./db');
const { rid, hashPassword, validEmail, passwordProblem } = require('./util');
async function ensureSuper(force) {
  const have = (await q("select 1 from accounts where role='superadmin' limit 1")).rows[0];
  if (have && !force) return false;
  if (!cfg.superEmail || !cfg.superPassword) { if (force) throw new Error('Set SUPER_EMAIL and SUPER_PASSWORD'); console.log(JSON.stringify({ level: 'warn', msg: 'No Super Admin exists. Set SUPER_EMAIL and SUPER_PASSWORD and run: npm run create-super' })); return false; }
  if (!validEmail(cfg.superEmail)) throw new Error('SUPER_EMAIL is not a valid email');
  const pp = passwordProblem(cfg.superPassword); if (pp) throw new Error('SUPER_PASSWORD: ' + pp);
  const hash = await hashPassword(cfg.superPassword);
  const ex = (await q('select id from accounts where lower(email)=lower($1)', [cfg.superEmail])).rows[0];
  if (ex) await q("update accounts set role='superadmin', plan_id='agency', password_hash=$2, status='active', email_verified_at=coalesce(email_verified_at,now()), onboarded=true where id=$1", [ex.id, hash]);
  else await q("insert into accounts(id,email,name,company,password_hash,role,plan_id,email_verified_at,onboarded) values ($1,$2,'Platform Admin','Zlandavel Infotech Pvt Ltd',$3,'superadmin','agency',now(),true)", [rid('acct'), cfg.superEmail.toLowerCase(), hash]);
  console.log(JSON.stringify({ level: 'info', msg: 'Super Admin ready', email: cfg.superEmail }));
  return true;
}
module.exports = { ensureSuper };
if (require.main === module) require('./migrate')().then(() => ensureSuper(true)).then(() => pool.end()).catch(e => { console.error(e.message); process.exit(1); });
