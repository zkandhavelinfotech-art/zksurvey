'use strict';
const cfg = require('./config');
const { q } = require('./db');
const { sha256, HttpError } = require('./util');

async function event(type, text, accountId) { try { await q('insert into events(type,text,account_id) values ($1,$2,$3)', [type, String(text).slice(0, 300), accountId || null]); } catch (e) { console.error('event failed', e.message); } }
async function audit(req, action, target, meta) {
  try { await q('insert into audit_log(actor_id,action,target,ip,meta) values ($1,$2,$3,$4,$5)', [req && req.account ? req.account.id : null, action, target || null, req ? req.ip : null, meta || {}]); } catch (e) { console.error('audit failed', e.message); }
}

async function getPlans() {
  const { rows } = await q('select * from plans where active order by sort');
  return rows.map(p => Object.assign({ id: p.id, name: p.name, price: p.price, blurb: p.blurb }, p.limits));
}
async function planOf(id) { const p = (await getPlans()).find(x => x.id === id); return p || (await getPlans())[0]; }

/* Usage counts only real (non-demo) responses against the plan cap. */
async function usageOf(accountId, c) {
  const run = (c || { query: q }).query.bind(c || { query: q });
  const s = await run("select count(*)::int n, count(*) filter (where status='Published')::int p from surveys where account_id=$1", [accountId]);
  const r = await run('select count(*)::int n from responses where account_id=$1 and demo=false', [accountId]);
  return { surveys: s.rows[0].n, published: s.rows[0].p, responses: r.rows[0].n };
}

function publicAccount(a) {
  if (!a) return null;
  return { id: a.id, name: a.name, email: a.email, company: a.company, focus: a.focus, role: a.role, plan: a.plan_id, wantedPlan: a.wanted_plan,
    planPeriodEnd: a.plan_period_end ? new Date(a.plan_period_end).getTime() : null, cancelAtPeriodEnd: !!a.cancel_at_period_end,
    status: a.status, emailVerified: !!a.email_verified_at, onboarded: !!a.onboarded, billing: a.billing || {},
    createdAt: new Date(a.created_at).getTime(), lastLoginAt: a.last_login_at ? new Date(a.last_login_at).getTime() : null };
}

const COOKIE = 'zk_sid';
function cookieOpts() { return { httpOnly: true, sameSite: 'lax', secure: cfg.cookieSecure, path: '/', maxAge: cfg.sessionDays * 86400000 }; }
async function startSession(req, res, accountId) {
  const { token } = require('./util');
  const t = token();
  await q('insert into sessions(id,account_id,expires_at,ip,ua) values ($1,$2,now() + ($3 || \' days\')::interval,$4,$5)', [sha256(t), accountId, String(cfg.sessionDays), req.ip, String(req.headers['user-agent'] || '').slice(0, 200)]);
  res.cookie(COOKIE, t, cookieOpts());
}
async function loadSession(req, res, next) {
  req.account = null;
  const t = req.cookies && req.cookies[COOKIE];
  if (t) {
    try {
      const { rows } = await q('select a.* from sessions s join accounts a on a.id=s.account_id where s.id=$1 and s.expires_at>now()', [sha256(t)]);
      if (rows[0]) { req.account = rows[0]; req.sessionId = sha256(t); }
    } catch (e) { return next(e); }
  }
  next();
}
const requireAuth = (req, res, next) => req.account ? (req.account.status !== 'active' ? next(new HttpError(403, 'suspended', 'This account is suspended. Contact support.')) : next()) : next(new HttpError(401, 'auth_required', 'Please sign in.'));
const requireSuper = (req, res, next) => (req.account && req.account.role === 'superadmin' && req.account.status === 'active') ? next() : next(new HttpError(req.account ? 403 : 401, req.account ? 'forbidden' : 'auth_required', 'Not allowed.'));

/* CSRF: mutating API calls must carry a custom header (cannot be set cross-site without CORS) and, if present, a same-origin Origin. */
function csrf(req, res, next) {
  if (/^(GET|HEAD|OPTIONS)$/.test(req.method)) return next();
  if (req.path.startsWith('/webhooks/')) return next();
  if (req.get('x-zk-csrf') !== '1') return next(new HttpError(403, 'csrf', 'Missing CSRF header.'));
  const o = req.get('origin');
  if (o) { try { if (new URL(o).host !== req.get('host')) return next(new HttpError(403, 'csrf', 'Cross-origin request blocked.')); } catch (e) { return next(new HttpError(403, 'csrf', 'Bad origin.')); } }
  next();
}
module.exports = { event, audit, getPlans, planOf, usageOf, publicAccount, startSession, loadSession, requireAuth, requireSuper, csrf, COOKIE };
