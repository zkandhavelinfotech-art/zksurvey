'use strict';
const router = require('express').Router();
const { q, tx } = require('../db');
const { rid, HttpError, wrap, clip } = require('../util');
const { requireSuper, requireAuth, getPlans, publicAccount, event, audit } = require('../core');
const { sendMail, resetMail } = require('../mail');
const cfg = require('../config');
const { sha256, token } = require('../util');

router.use(requireSuper);

async function accountsWithUsage() {
  const r = await q(`select a.*, (select count(*)::int from surveys s where s.account_id=a.id) surveys,
      (select count(*)::int from surveys s where s.account_id=a.id and s.status='Published') published,
      (select count(*)::int from responses x where x.account_id=a.id and not x.demo) responses from accounts a order by a.created_at`);
  return r.rows.map(a => Object.assign(publicAccount(a), { usage: { surveys: a.surveys, published: a.published, responses: a.responses } }));
}
router.get('/accounts', wrap(async (req, res) => res.json({ accounts: await accountsWithUsage() })));
router.get('/overview', wrap(async (req, res) => {
  const [events, tickets, orders] = await Promise.all([
    q('select (extract(epoch from at)*1000)::bigint at,type,text from events order by at desc limit 100'),
    q("select id,name,email,subject,message,status,(extract(epoch from created_at)*1000)::bigint at from support_tickets order by created_at desc limit 50"),
    q("select o.id,o.account_id,o.plan_id,o.months,o.total_paise,o.status,o.gateway,o.gateway_payment_id,(extract(epoch from o.created_at)*1000)::bigint at,a.email,a.name from orders o left join accounts a on a.id=o.account_id order by o.created_at desc limit 50")
  ]);
  const m = await q(`select (select count(*)::int from accounts) accounts,(select count(*)::int from surveys) surveys,(select count(*)::int from responses where not demo) responses,
     (select count(*)::int from orders where status='paid') paid_orders,(select coalesce(sum(total_paise),0)::bigint from orders where status='paid') revenue_paise,(select count(*)::int from mail_outbox where error is not null) mail_errors`);
  res.json({
    accounts: await accountsWithUsage(),
    events: events.rows.map(e => ({ at: Number(e.at), type: e.type, text: e.text })),
    tickets: tickets.rows.map(t => Object.assign({}, t, { at: Number(t.at) })),
    orders: orders.rows.map(o => Object.assign({}, o, { at: Number(o.at) })),
    metrics: m.rows[0]
  });
}));

router.post('/orders/:id/approve', wrap(async (req, res) => {
  const o = (await q('select * from orders where id=$1', [req.params.id])).rows[0];
  if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
  if (o.status === 'paid') return res.json({ already: true });
  const { fulfil } = require('./billing');
  const result = await fulfil(o.id, o.gateway_payment_id || ('admin_approved_' + rid('p')));
  await audit(req, 'admin_order_approved', o.id, { total: o.total_paise });
  await event('payment', 'Order ' + o.id + ' approved by admin', o.account_id);
  res.json(result);
}));

router.post('/orders/:id/reject', wrap(async (req, res) => {
  const o = (await q('select * from orders where id=$1', [req.params.id])).rows[0];
  if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
  await q("update orders set status='failed' where id=$1", [o.id]);
  await audit(req, 'admin_order_rejected', o.id);
  res.json({ ok: true });
}));

router.patch('/accounts/:id', wrap(async (req, res) => {
  const a = (await q('select * from accounts where id=$1', [req.params.id])).rows[0];
  if (!a) throw new HttpError(404, 'not_found', 'Account not found.');
  if (a.role === 'superadmin' && req.body && req.body.status === 'suspended') throw new HttpError(400, 'validation', 'The platform admin cannot be suspended.');
  const sets = [], vals = [a.id]; const add = (c, v) => { vals.push(v); sets.push(c + '=$' + vals.length); };
  const b = req.body || {};
  if (b.plan) { if (!(await getPlans()).some(p => p.id === b.plan)) throw new HttpError(400, 'validation', 'Unknown plan.'); add('plan_id', b.plan); if (b.plan !== a.plan_id) add('plan_period_end', null); }
  if (b.status) { if (!['active', 'suspended'].includes(b.status)) throw new HttpError(400, 'validation', 'Bad status.'); add('status', b.status); if (b.status === 'suspended') await q('delete from sessions where account_id=$1', [a.id]); }
  if (b.emailVerified === true) add('email_verified_at', new Date());
  if (sets.length) await q('update accounts set ' + sets.join(',') + ' where id=$1', vals);
  await audit(req, 'admin_account_update', a.id, b); await event('admin', a.email + ' updated by admin: ' + JSON.stringify(b), a.id);
  res.json({ ok: true });
}));
router.delete('/accounts/:id', wrap(async (req, res) => {
  const a = (await q('select * from accounts where id=$1', [req.params.id])).rows[0];
  if (!a) throw new HttpError(404, 'not_found', 'Account not found.');
  if (a.role === 'superadmin') throw new HttpError(400, 'validation', 'The platform admin cannot be deleted.');
  await audit(req, 'admin_account_delete', a.id, { email: a.email }); await event('delete', 'Account ' + a.email + ' deleted by admin');
  await q('delete from accounts where id=$1', [a.id]); res.json({ ok: true });
}));
router.post('/accounts/:id/reset-link', wrap(async (req, res) => {
  const a = (await q("select * from accounts where id=$1 and status='active'", [req.params.id])).rows[0];
  if (!a) throw new HttpError(404, 'not_found', 'Account not found.');
  const t = token(); await q("insert into email_tokens(token_hash,account_id,purpose,expires_at) values ($1,$2,'reset',now()+interval '1 hour')", [sha256(t), a.id]);
  const [s, b] = resetMail(a.name, cfg.appUrl + '/reset.html?token=' + t); await sendMail(a.email, s, b); await audit(req, 'admin_reset_link', a.id);
  res.json({ ok: true });
}));
router.put('/plans', wrap(async (req, res) => {
  const arr = Array.isArray(req.body && req.body.plans) ? req.body.plans : [];
  if (!arr.length) throw new HttpError(400, 'validation', 'No plans.');
  await tx(async c => { for (const p of arr) {
    const n = x => Math.max(0, parseInt(x, 10) || 0);
    const lim = { surveys: n(p.surveys), responses: n(p.responses), formats: Math.min(5, Math.max(1, n(p.formats))), watermark: !!p.watermark, ads: !!p.ads, clients: !!p.clients, seats: Math.max(1, n(p.seats)) };
    const r = await c.query('update plans set name=$2, price=$3, limits=$4, blurb=$5 where id=$1', [p.id, clip(p.name, 40), n(p.price), lim, clip(p.blurb, 160)]);
    if (!r.rowCount) throw new HttpError(400, 'validation', 'Unknown plan ' + p.id);
  } });
  await audit(req, 'plans_update', null); await event('admin', 'Plans updated');
  res.json({ plans: await getPlans() });
}));
router.patch('/tickets/:id', wrap(async (req, res) => { await q('update support_tickets set status=$2 where id=$1', [req.params.id, req.body && req.body.status === 'closed' ? 'closed' : 'open']); res.json({ ok: true }); }));
router.get('/audit', wrap(async (req, res) => { const r = await q('select (extract(epoch from at)*1000)::bigint at,actor_id,action,target,ip,meta from audit_log order by at desc limit 200'); res.json({ audit: r.rows.map(x => Object.assign({}, x, { at: Number(x.at) })) }); }));
router.get('/outbox', wrap(async (req, res) => { const r = await q('select id,(extract(epoch from at)*1000)::bigint at,to_email,subject,sent_at is not null sent,error from mail_outbox order by id desc limit 50'); res.json({ outbox: r.rows }); }));
module.exports = router;
