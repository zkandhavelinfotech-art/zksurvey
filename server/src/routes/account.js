'use strict';
const router = require('express').Router();
const { q, tx } = require('../db');
const { hashPassword, verifyPassword, passwordProblem, HttpError, wrap, clip } = require('../util');
const { event, audit, publicAccount, requireAuth, usageOf, COOKIE } = require('../core');

router.use(requireAuth);
router.get('/', wrap(async (req, res) => res.json({ account: publicAccount(req.account) })));

router.patch('/', wrap(async (req, res) => {
  const b = req.body || {}; const sets = [], vals = [req.account.id]; const add = (col, v) => { vals.push(v); sets.push(col + '=$' + vals.length); };
  if (b.name != null) { const n = clip(b.name, 120).trim(); if (!n) throw new HttpError(400, 'validation', 'Name cannot be empty.'); add('name', n); }
  if (b.company != null) add('company', clip(b.company, 160).trim());
  if (b.focus != null) add('focus', clip(b.focus, 60));
  if (b.onboarded != null) add('onboarded', !!b.onboarded);
  if (b.wantedPlan != null) add('wanted_plan', clip(b.wantedPlan, 30));
  if (b.billing != null) {
    const x = b.billing, g = clip(x.gstin, 15).toUpperCase().trim();
    if (g && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) throw new HttpError(400, 'validation', 'GSTIN format looks wrong (15 characters, e.g. 33ABCDE1234F1Z5).');
    add('billing', { legalName: clip(x.legalName, 160), gstin: g, state: clip(x.state, 60), address: clip(x.address, 300) });
  }
  if (sets.length) await q('update accounts set ' + sets.join(',') + ' where id=$1', vals);
  const a = (await q('select * from accounts where id=$1', [req.account.id])).rows[0];
  res.json({ account: publicAccount(a) });
}));

router.post('/password', wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (!(await verifyPassword(clip(current, 200), req.account.password_hash))) throw new HttpError(400, 'bad_password', 'Current password is incorrect.');
  const pp = passwordProblem(next); if (pp) throw new HttpError(400, 'validation', pp);
  await q('update accounts set password_hash=$2 where id=$1', [req.account.id, await hashPassword(next)]);
  await q('delete from sessions where account_id=$1 and id<>$2', [req.account.id, req.sessionId]);
  await audit(req, 'password_change', req.account.id);
  res.json({ ok: true });
}));

/* DPDP: right to access / portability */
router.get('/export', wrap(async (req, res) => {
  const id = req.account.id;
  const [surveys, responses, kv, orders, invoices] = await Promise.all([
    q('select id,name,status,meta,def,created_at,updated_at from surveys where account_id=$1', [id]),
    q('select id,survey_id,at,answers,utm,meta,consent,demo from responses where account_id=$1 order by at', [id]),
    q('select key,value from workspace_kv where account_id=$1', [id]),
    q('select id,plan_id,status,total_paise,created_at,paid_at from orders where account_id=$1', [id]),
    q('select number,issued_at,total_paise from invoices where account_id=$1', [id])]);
  await audit(req, 'data_export', id);
  res.setHeader('Content-Disposition', 'attachment; filename="zksurvey-export-' + id + '.json"');
  res.json({ app: 'ZKSurvey', build: 'v13', exportedAt: new Date().toISOString(), account: publicAccount(req.account), surveys: surveys.rows, responses: responses.rows, workspace: kv.rows, orders: orders.rows, invoices: invoices.rows });
}));

/* DPDP: right to erasure. Deletes the account and every row it owns (cascade). Invoices are legally retained elsewhere — see docs. */
router.delete('/', wrap(async (req, res) => {
  if (req.account.role === 'superadmin') throw new HttpError(403, 'forbidden', 'The platform admin account cannot be deleted here.');
  if (!(await verifyPassword(clip(req.body && req.body.password, 200), req.account.password_hash))) throw new HttpError(400, 'bad_password', 'Password is incorrect.');
  await audit(req, 'account_delete', req.account.id, { email: req.account.email });
  await event('delete', 'Account ' + req.account.email + ' deleted by owner');
  await q('delete from accounts where id=$1', [req.account.id]);
  res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
}));
module.exports = router;
