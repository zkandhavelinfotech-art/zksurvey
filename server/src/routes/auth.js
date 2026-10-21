'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const cfg = require('../config');
const { q, tx } = require('../db');
const { rid, sha256, token, hashPassword, verifyPassword, validEmail, passwordProblem, HttpError, wrap, clip } = require('../util');
const { event, audit, getPlans, startSession, publicAccount, requireAuth, COOKIE } = require('../core');
const { sendMail, verifyMail, resetMail } = require('../mail');

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: cfg.prod ? 20 : 400, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } });

async function issueToken(accountId, purpose, hours) {
  const t = token();
  await q('insert into email_tokens(token_hash,account_id,purpose,expires_at) values ($1,$2,$3,now() + ($4 || \' hours\')::interval)', [sha256(t), accountId, purpose, String(hours)]);
  return t;
}
async function sendVerify(a) { const t = await issueToken(a.id, 'verify', 24); const [s, b] = verifyMail(a.name, cfg.appUrl + '/verify.html?token=' + t); await sendMail(a.email, s, b); }

router.post('/register', authLimit, wrap(async (req, res) => {
  const b = req.body || {}; const errs = [];
  const email = clip(b.email, 254).trim().toLowerCase(), name = clip(b.name, 120).trim();
  if (!name) errs.push('Enter your name.');
  if (!validEmail(email)) errs.push('Enter a valid email address.');
  const pp = passwordProblem(b.password); if (pp) errs.push(pp);
  if (!b.terms) errs.push('Please accept the terms to continue.');
  if (errs.length) throw Object.assign(new HttpError(400, 'validation', errs[0]), { errors: errs });
  const plans = await getPlans(); const wanted = plans.some(p => p.id === b.plan) ? b.plan : 'free';
  const id = rid('acct'); const hash = await hashPassword(b.password);
  try {
    await q('insert into accounts(id,email,name,company,focus,password_hash,role,plan_id,wanted_plan) values ($1,$2,$3,$4,$5,$6,\'owner\',\'free\',$7)', [id, email, name, clip(b.company, 160).trim() || name, clip(b.focus, 60), hash, wanted]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new HttpError(409, 'email_taken', 'An account with this email already exists. Sign in instead.'), { errors: ['An account with this email already exists. Sign in instead.'] });
    throw e;
  }
  const { rows } = await q('select * from accounts where id=$1', [id]);
  await event('signup', name + ' (' + rows[0].company + ') registered', id);
  await sendVerify(rows[0]);
  const req2 = Object.assign(Object.create(req), { account: rows[0] }); await audit(req2, 'register', id);
  await startSession(req, res, id);
  res.status(201).json({ account: publicAccount(rows[0]) });
}));

router.post('/login', authLimit, wrap(async (req, res) => {
  const email = clip(req.body && req.body.email, 254).trim().toLowerCase(), pw = clip(req.body && req.body.password, 200);
  const { rows } = await q('select * from accounts where lower(email)=$1', [email]);
  const a = rows[0]; const bad = new HttpError(401, 'bad_credentials', 'Email or password is incorrect.');
  if (!a) { await verifyPassword(pw, 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'); throw bad; }
  if (a.locked_until && new Date(a.locked_until) > new Date()) throw new HttpError(429, 'locked', 'Too many failed attempts. Try again in 15 minutes.');
  if (!(await verifyPassword(pw, a.password_hash))) {
    const n = a.failed_logins + 1;
    await q('update accounts set failed_logins = case when $2 >= 8 then 0 else $2 end, locked_until = case when $2 >= 8 then now() + interval \'15 minutes\' else null end where id=$1', [a.id, n]);
    throw bad;
  }
  if (a.status !== 'active') throw new HttpError(403, 'suspended', 'This account is suspended. Contact support.');

  if (a.role === 'superadmin' && cfg.super2FA) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tempToken = token();
    await q("insert into email_tokens(token_hash,account_id,purpose,expires_at) values ($1,$2,'2fa',now() + interval '10 minutes')", [sha256(tempToken + ':' + code), a.id]);
    await sendMail(a.email, 'Your ZKSurvey Super Admin 2FA Code: ' + code, 'Hi ' + a.name + ',\n\nYour 6-digit Super Admin verification code is: ' + code + '\n\nThis code expires in 10 minutes.\n\n— ZKSurvey Security');
    await audit(req, 'admin_2fa_issued', a.id);
    return res.json({ twoFactorRequired: true, tempToken, email: a.email, message: 'Enter the 6-digit 2FA code sent to your email.' });
  }

  await q('update accounts set failed_logins=0, locked_until=null, last_login_at=now() where id=$1', [a.id]);
  await startSession(req, res, a.id);
  const fresh = (await q('select * from accounts where id=$1', [a.id])).rows[0];
  res.json({ account: publicAccount(fresh) });
}));

router.post('/verify-2fa', authLimit, wrap(async (req, res) => {
  const tempToken = clip(req.body && req.body.tempToken, 200);
  const code = clip(req.body && req.body.code, 10).trim();
  if (!tempToken || !code) throw new HttpError(400, 'validation', 'Enter the 6-digit verification code.');
  const hash = sha256(tempToken + ':' + code);
  const r = await q("update email_tokens set used_at=now() where token_hash=$1 and purpose='2fa' and used_at is null and expires_at>now() returning account_id", [hash]);
  if (!r.rows[0]) throw new HttpError(401, 'bad_2fa_code', 'Invalid or expired 2FA code. Try signing in again.');
  const id = r.rows[0].account_id;
  await q('update accounts set failed_logins=0, locked_until=null, last_login_at=now() where id=$1', [id]);
  await startSession(req, res, id);
  const fresh = (await q('select * from accounts where id=$1', [id])).rows[0];
  await audit(req, 'login_2fa_verified', id);
  res.json({ account: publicAccount(fresh) });
}));

router.post('/logout', wrap(async (req, res) => {
  if (req.sessionId) await q('delete from sessions where id=$1', [req.sessionId]);
  res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
}));

router.post('/verify', authLimit, wrap(async (req, res) => {
  const t = clip(req.body && req.body.token, 200);
  const r = await q("update email_tokens set used_at=now() where token_hash=$1 and purpose='verify' and used_at is null and expires_at>now() returning account_id", [sha256(t)]);
  if (!r.rows[0]) throw new HttpError(400, 'bad_token', 'This verification link is invalid or has expired. Request a new one from Settings.');
  await q('update accounts set email_verified_at=coalesce(email_verified_at,now()) where id=$1', [r.rows[0].account_id]);
  await event('verify', 'Email verified', r.rows[0].account_id);
  res.json({ ok: true });
}));

router.post('/resend-verification', requireAuth, authLimit, wrap(async (req, res) => {
  if (req.account.email_verified_at) return res.json({ ok: true, already: true });
  await sendVerify(req.account); res.json({ ok: true });
}));

router.post('/forgot', authLimit, wrap(async (req, res) => {
  const email = clip(req.body && req.body.email, 254).trim().toLowerCase();
  const { rows } = await q('select * from accounts where lower(email)=$1 and status=\'active\'', [email]);
  if (rows[0]) { const t = await issueToken(rows[0].id, 'reset', 1); const [s, b] = resetMail(rows[0].name, cfg.appUrl + '/reset.html?token=' + t); await sendMail(rows[0].email, s, b); await event('reset_request', 'Password reset requested', rows[0].id); }
  res.json({ ok: true }); // identical answer whether or not the account exists
}));

router.post('/reset', authLimit, wrap(async (req, res) => {
  const t = clip(req.body && req.body.token, 200), pw = req.body && req.body.password;
  const pp = passwordProblem(pw); if (pp) throw new HttpError(400, 'validation', pp);
  await tx(async c => {
    const r = await c.query("update email_tokens set used_at=now() where token_hash=$1 and purpose='reset' and used_at is null and expires_at>now() returning account_id", [sha256(t)]);
    if (!r.rows[0]) throw new HttpError(400, 'bad_token', 'This reset link is invalid or has expired. Request a new one.');
    const id = r.rows[0].account_id;
    await c.query('update accounts set password_hash=$2, failed_logins=0, locked_until=null, email_verified_at=coalesce(email_verified_at,now()) where id=$1', [id, await hashPassword(pw)]);
    await c.query('delete from sessions where account_id=$1', [id]); // sign out everywhere
  });
  res.json({ ok: true });
}));

module.exports = router;
