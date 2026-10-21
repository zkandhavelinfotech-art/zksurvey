'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { start, client, newUser, verifyEmail, def, q } = require('./helpers');

let S, base;
test.before(async () => { S = await start(); base = S.base; });
test.after(async () => { await S.close(); });

test('auth: register, session cookie, weak password, duplicate email, wrong password', async () => {
  const u = await newUser(base);
  const me = await u.c.get('/api/account'); assert.equal(me.status, 200); assert.equal(me.data.account.email, u.email); assert.equal(me.data.account.emailVerified, false);
  assert.equal(me.data.account.password_hash, undefined);
  const weak = await client(base).post('/api/auth/register', { name: 'x', email: 'weak@example.com', password: 'abc', terms: true }); assert.equal(weak.status, 400);
  const dup = await client(base).post('/api/auth/register', { name: 'x', email: u.email.toUpperCase(), password: 'Secret123', terms: true }); assert.equal(dup.status, 409);
  const bad = await client(base).post('/api/auth/login', { email: u.email, password: 'nope' }); assert.equal(bad.status, 401);
  const ok = await client(base).post('/api/auth/login', { email: u.email, password: 'Secret123' }); assert.equal(ok.status, 200);
  const anon = await client(base).get('/api/account'); assert.equal(anon.status, 401);
});
test('CSRF: mutating request without header is refused; cross-origin Origin refused', async () => {
  const u = await newUser(base);
  const r = await fetch(base + '/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(r.status, 403);
  const x = await u.c.raw('PATCH', '/api/account', { name: 'Z' }, { origin: 'https://evil.example' }); assert.equal(x.status, 403);
});
test('login lockout after 8 failures', async () => {
  const u = await newUser(base); const c = client(base);
  for (let i = 0; i < 8; i++) await c.post('/api/auth/login', { email: u.email, password: 'wrong' + i });
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Secret123' }); assert.equal(r.status, 429);
});
test('email verification and password reset (sessions revoked, token single-use)', async () => {
  const u = await newUser(base);
  assert.equal((await verifyEmail(u.c, base, u.email)).status, 200);
  assert.equal((await u.c.get('/api/account')).data.account.emailVerified, true);
  await client(base).post('/api/auth/forgot', { email: 'nobody@example.com' });
  assert.equal((await client(base).post('/api/auth/forgot', { email: u.email })).status, 200);
  const o = await u.c.get('/api/dev/outbox?to=' + encodeURIComponent(u.email)); const m = o.data.outbox.find(x => /Reset/.test(x.subject)); const t = /token=([\w-]+)/.exec(m.body)[1];
  assert.equal((await client(base).post('/api/auth/reset', { token: t, password: 'NewSecret456' })).status, 200);
  assert.equal((await client(base).post('/api/auth/reset', { token: t, password: 'Another789' })).status, 400);
  assert.equal((await u.c.get('/api/account')).status, 401);
  assert.equal((await client(base).post('/api/auth/login', { email: u.email, password: 'NewSecret456' })).status, 200);
});
test('tenant isolation: B cannot read, overwrite or delete A\'s survey; workspace is per account', async () => {
  const a = await newUser(base), b = await newUser(base);
  assert.equal((await a.c.put('/api/surveys/s_iso1', { meta: { id: 's_iso1', name: 'A' }, def: def('A') })).status, 200);
  assert.equal((await b.c.put('/api/surveys/s_iso1', { meta: { name: 'hijack' }, def: def('hijack') })).status, 403);
  await b.c.del('/api/surveys/s_iso1');
  const wa = await a.c.get('/api/workspace'); assert.equal(wa.data.list.length, 1); assert.equal(wa.data.defs.s_iso1.details.title, 'A');
  const wb = await b.c.get('/api/workspace'); assert.equal(wb.data.list.length, 0);
  assert.equal((await b.c.put('/api/surveys/s_iso1/starts', { count: 5 })).status, 404);
  assert.equal((await b.c.post('/api/surveys/s_iso1/links', { channel: 'x' })).status, 404);
});
test('plan limits enforced server-side: survey count, publish needs verified email, unique slug, response cap', async () => {
  const a = await newUser(base);
  assert.equal((await a.c.put('/api/surveys/s_l1', { meta: { name: '1' }, def: def('1') })).status, 200);
  const over = await a.c.put('/api/surveys/s_l2', { meta: { name: '2' }, def: def('2') }); assert.equal(over.status, 402); assert.equal(over.data.error, 'limit_surveys');
  const nv = await a.c.put('/api/surveys/s_l1', { meta: { name: '1' }, def: def('1', 'limit-one', 'Published') }); assert.equal(nv.status, 403); assert.equal(nv.data.error, 'verify_email');
  await verifyEmail(a.c, base, a.email);
  assert.equal((await a.c.put('/api/surveys/s_l1', { meta: { name: '1' }, def: def('1', 'bad slug!', 'Published') })).status, 400);
  assert.equal((await a.c.put('/api/surveys/s_l1', { meta: { name: '1' }, def: def('1', 'limit-one', 'Published') })).status, 200);
  const b = await newUser(base); await verifyEmail(b.c, base, b.email);
  const c2 = await b.c.put('/api/surveys/s_l9', { meta: { name: '9' }, def: def('9', 'limit-one', 'Published') }); assert.equal(c2.status, 409); assert.equal(c2.data.error, 'slug_taken');
  assert.equal((await b.c.get('/api/slugs/limit-one')).data.taken, true);
  await q('update plans set limits = jsonb_set(limits,\'{responses}\',\'2\') where id=\'free\'');
  const pub = client(base); let k = 0; const sub = () => pub.post('/api/public/surveys/limit-one/responses', { answers: { q1: 'A', q2: 'n' + (++k) }, consent: { given: true } });
  assert.equal((await sub()).status, 201); assert.equal((await sub()).status, 201);
  const closed = await sub(); assert.equal(closed.status, 409);
  assert.equal((await pub.get('/api/public/surveys/limit-one')).data.closed, 'cap');
  await q('update plans set limits = jsonb_set(limits,\'{responses}\',\'100\') where id=\'free\'');
});
test('public runner: consent required, honeypot, unknown answer keys dropped, UTM + consent stored, anonymous reads', async () => {
  const a = await newUser(base); await verifyEmail(a.c, base, a.email);
  await a.c.put('/api/surveys/s_p1', { meta: { name: 'P' }, def: def('P', 'public-one', 'Published') });
  const pub = client(base); const url = '/api/public/surveys/public-one';
  const g = await pub.get(url); assert.equal(g.status, 200); assert.equal(g.data.watermark, true); assert.equal(g.data.owner.password_hash, undefined);
  assert.equal((await pub.post(url + '/responses', { answers: { q1: 'A' } })).status, 400);
  assert.equal((await pub.post(url + '/responses', { answers: { q1: 'A' }, consent: { given: true }, website: 'spam' })).status, 200);
  const ok = await pub.post(url + '/responses', { answers: { q1: 'B', zzz: 'injected', q2: 'text' }, utm: { utm_source: 'instagram', utm_medium: 'social', evil: 'x' }, consent: { given: true, version: '2026-10' }, elapsedMs: 9000 });
  assert.equal(ok.status, 201);
  const w = await a.c.get('/api/workspace'); const rs = w.data.responses.s_p1; assert.equal(rs.length, 1);
  assert.deepEqual(rs[0].answers, { q1: 'B', q2: 'text' }); assert.equal(rs[0].utm.utm_source, 'instagram'); assert.equal(rs[0].utm.evil, undefined);
  const row = (await q('select consent,ip_hash from responses where id=$1', [rs[0].id])).rows[0]; assert.equal(row.consent.given, true); assert.ok(row.ip_hash && row.ip_hash.length === 24);
  assert.equal((await pub.get('/api/public/surveys/nope-nope')).status, 404);
  assert.equal((await pub.get('/api/account')).status, 401);
});
test('dashboard can only add demo responses; real ones only via public endpoint', async () => {
  const a = await newUser(base); await a.c.put('/api/surveys/s_d1', { meta: { name: 'D' }, def: def('D') });
  assert.equal((await a.c.post('/api/surveys/s_d1/responses/bulk', { responses: [{ id: 'r1', at: Date.now(), answers: {} }] })).status, 400);
  assert.equal((await a.c.post('/api/surveys/s_d1/responses/bulk', { responses: [{ id: 'r1', at: Date.now(), answers: { q1: 'A' }, demo: true }] })).status, 200);
  const w = await a.c.get('/api/workspace'); assert.equal(w.data.responses.s_d1[0].demo, true);
  const me = await a.c.get('/api/bootstrap'); assert.equal(me.data.usage.responses, 0);
});
test('suspended account: cannot sign in, session revoked, public survey closed', async () => {
  const a = await newUser(base); await verifyEmail(a.c, base, a.email);
  await a.c.put('/api/surveys/s_sus', { meta: { name: 'S' }, def: def('S', 'suspend-me', 'Published') });
  const root = client(base); await root.post('/api/auth/login', { email: 'root@zksurvey.test', password: 'RootPass123' });
  assert.equal((await root.patch('/api/admin/accounts/' + a.id, { status: 'suspended' })).status, 200);
  assert.equal((await a.c.get('/api/account')).status, 401);
  assert.equal((await client(base).post('/api/auth/login', { email: a.email, password: 'Secret123' })).status, 403);
  assert.equal((await client(base).get('/api/public/surveys/suspend-me')).data.closed, 'closed');
  assert.equal((await client(base).post('/api/public/surveys/suspend-me/responses', { answers: {}, consent: { given: true } })).status, 409);
});
test('super admin: guarded, plan change, plan edit, overview; owner forbidden', async () => {
  const u = await newUser(base); assert.equal((await u.c.get('/api/admin/accounts')).status, 403); assert.equal((await client(base).get('/api/admin/accounts')).status, 401);
  const root = client(base); await root.post('/api/auth/login', { email: 'root@zksurvey.test', password: 'RootPass123' });
  assert.equal((await root.patch('/api/admin/accounts/' + u.id, { plan: 'growth' })).status, 200);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'growth');
  const ov = await root.get('/api/admin/overview'); assert.ok(ov.data.accounts.length >= 2); assert.ok(ov.data.metrics.accounts >= 2);
  const pl = (await root.get('/api/plans')).data.plans; const free = pl.find(p => p.id === 'free');
  const up = await root.put('/api/admin/plans', { plans: pl.map(p => p.id === 'free' ? Object.assign({}, p, { surveys: 2 }) : p) }); assert.equal(up.status, 200);
  assert.equal((await client(base).get('/api/plans')).data.plans.find(p => p.id === 'free').surveys, 2);
  await root.put('/api/admin/plans', { plans: pl.map(p => p.id === 'free' ? free : p) });
  assert.equal((await root.del('/api/admin/accounts/' + (await q("select id from accounts where role='superadmin'")).rows[0].id)).status, 400);
});
test('billing: checkout needs verified email; mock payment upgrades plan, issues one GST invoice (CGST+SGST in-state, IGST out-of-state), idempotent', async () => {
  const u = await newUser(base);
  assert.equal((await u.c.post('/api/billing/checkout', { planId: 'starter' })).status, 403);
  await verifyEmail(u.c, base, u.email);
  assert.equal((await u.c.post('/api/billing/checkout', { planId: 'free' })).status, 400);
  const co = await u.c.post('/api/billing/checkout', { planId: 'starter' }); assert.equal(co.status, 200); assert.equal(co.data.amount, 79900 + 14382);
  const pay = await u.c.post('/api/billing/mock-pay', { orderId: co.data.orderId }); assert.equal(pay.status, 200); assert.match(pay.data.number, /^ZK\/\d{4}-\d{2}\/\d{5}$/);
  assert.equal((await u.c.post('/api/billing/mock-pay', { orderId: co.data.orderId })).data.already, true);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'starter');
  const inv = (await u.c.get('/api/billing')).data.invoices; assert.equal(inv.length, 1);
  const row = (await q('select * from invoices where id=$1', [inv[0].id])).rows[0];
  assert.equal(row.cgst_paise, 7191); assert.equal(row.sgst_paise, 7191); assert.equal(row.igst_paise, 0); assert.equal(row.total_paise, 94282);
  const html = await u.c.get('/api/invoices/' + inv[0].id + '/html'); assert.match(html.data, /Tax Invoice/); assert.match(html.data, /CGST 9%/);
  const other = await newUser(base); assert.equal((await other.c.get('/api/invoices/' + inv[0].id + '/html')).status, 404);
  await u.c.patch('/api/account', { billing: { legalName: 'Acme Pvt Ltd', gstin: '29ABCDE1234F1Z5', state: 'Karnataka', address: 'Bengaluru' } });
  const co2 = await u.c.post('/api/billing/checkout', { planId: 'growth', months: 12 }); await u.c.post('/api/billing/mock-pay', { orderId: co2.data.orderId });
  const r2 = (await q('select * from invoices where account_id=$1 order by issued_at desc limit 1', [u.id])).rows[0]; assert.equal(r2.igst_paise, Math.round(2499 * 100 * 12 * 0.18)); assert.equal(r2.cgst_paise, 0);
  assert.equal((await u.c.patch('/api/account', { billing: { gstin: 'BADGSTIN' } })).status, 400);
});
test('billing: Razorpay webhook signature verified; checkout signature verified; invoice not duplicated', async () => {
  const u = await newUser(base); await verifyEmail(u.c, base, u.email);
  await q("insert into orders(id,account_id,plan_id,months,amount_paise,gst_paise,total_paise,gateway,gateway_order_id) values ('ord_wh1',$1,'starter',1,99900,17982,117882,'razorpay','order_RZP1')", [u.id]);
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_RZP1' } } } });
  const bad = await fetch(base + '/api/webhooks/razorpay', { method: 'POST', headers: { 'x-razorpay-signature': 'deadbeef', 'content-type': 'application/json' }, body }); assert.equal(bad.status, 400);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex');
  const good = await fetch(base + '/api/webhooks/razorpay', { method: 'POST', headers: { 'x-razorpay-signature': sig, 'content-type': 'application/json' }, body }); assert.equal(good.status, 200);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'starter');
  await fetch(base + '/api/webhooks/razorpay', { method: 'POST', headers: { 'x-razorpay-signature': sig, 'content-type': 'application/json' }, body });
  assert.equal((await q('select count(*)::int n from invoices where account_id=$1', [u.id])).rows[0].n, 1);
  await q("insert into orders(id,account_id,plan_id,months,amount_paise,gst_paise,total_paise,gateway,gateway_order_id) values ('ord_cb1',$1,'growth',1,299900,53982,353882,'razorpay','order_RZP2')", [u.id]);
  const badCb = await u.c.post('/api/billing/verify', { orderId: 'ord_cb1', razorpay_payment_id: 'pay_2', razorpay_signature: 'x'.repeat(64) }); assert.equal(badCb.status, 400);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'starter');
  const s2 = crypto.createHmac('sha256', 'rzp_secret_test').update('order_RZP2|pay_2').digest('hex');
  assert.equal((await u.c.post('/api/billing/verify', { orderId: 'ord_cb1', razorpay_payment_id: 'pay_2', razorpay_signature: s2 })).status, 200);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'growth');
});
test('subscription expiry downgrades after grace; cancellation downgrades at period end', async () => {
  const { expireSubscriptions } = require('../src/routes/billing');
  const u = await newUser(base), v = await newUser(base);
  await q("update accounts set plan_id='starter', plan_period_end=now()-interval '4 days' where id=$1", [u.id]);
  await q("update accounts set plan_id='starter', plan_period_end=now()-interval '1 day', cancel_at_period_end=true where id=$1", [v.id]);
  assert.ok((await expireSubscriptions()) >= 2);
  assert.equal((await u.c.get('/api/account')).data.account.plan, 'free'); assert.equal((await v.c.get('/api/account')).data.account.plan, 'free');
});
test('retention job deletes old real responses per account setting, keeps newer and demo', async () => {
  const { purgeRetention } = require('../src/jobs');
  const a = await newUser(base); await verifyEmail(a.c, base, a.email);
  await a.c.put('/api/surveys/s_ret', { meta: { name: 'R' }, def: def('R', 'retain-one', 'Published') });
  const pub = client(base); await pub.post('/api/public/surveys/retain-one/responses', { answers: { q1: 'A' }, consent: { given: true } }); await pub.post('/api/public/surveys/retain-one/responses', { answers: { q1: 'B' }, consent: { given: true } });
  await q("update responses set at = now() - interval '400 days' where id = (select id from responses where survey_id='s_ret' limit 1)");
  await a.c.put('/api/kv', { entries: { zk_settings_v11: { retentionMonths: 12 } } });
  assert.equal(await purgeRetention() >= 1, true);
  assert.equal((await q("select count(*)::int n from responses where survey_id='s_ret'")).rows[0].n, 1);
});
test('kv store: reserved keys refused, size/shape validated, per-account', async () => {
  const a = await newUser(base), b = await newUser(base);
  assert.equal((await a.c.put('/api/kv', { entries: { zk_defs_v7: {} } })).status, 400);
  assert.equal((await a.c.put('/api/kv', { entries: { 'bad key': 1 } })).status, 400);
  assert.equal((await a.c.put('/api/kv', { entries: { zk_campaigns_v11: [{ id: 'c1' }] } })).status, 200);
  assert.deepEqual((await a.c.get('/api/workspace')).data.kv.zk_campaigns_v11, [{ id: 'c1' }]); assert.equal((await b.c.get('/api/workspace')).data.kv.zk_campaigns_v11, undefined);
});
test('DPDP: export includes own data; delete requires password and erases everything but keeps invoices', async () => {
  const u = await newUser(base); await verifyEmail(u.c, base, u.email);
  await u.c.put('/api/surveys/s_x1', { meta: { name: 'X' }, def: def('X', 'erase-me', 'Published') });
  await client(base).post('/api/public/surveys/erase-me/responses', { answers: { q1: 'A' }, consent: { given: true } });
  const co = await u.c.post('/api/billing/checkout', { planId: 'starter' }); await u.c.post('/api/billing/mock-pay', { orderId: co.data.orderId });
  const ex = await u.c.get('/api/account/export'); assert.equal(ex.status, 200); assert.equal(ex.data.surveys.length, 1); assert.equal(ex.data.responses.length, 1);
  assert.equal((await u.c.del('/api/account', { password: 'wrong' })).status, 400);
  assert.equal((await u.c.del('/api/account', { password: 'Secret123' })).status, 200);
  assert.equal((await q('select count(*)::int n from surveys where account_id=$1', [u.id])).rows[0].n, 0);
  assert.equal((await q('select count(*)::int n from responses where account_id=$1', [u.id])).rows[0].n, 0);
  assert.equal((await q('select count(*)::int n from invoices where account_id is null')).rows[0].n >= 1, true);
  assert.equal((await client(base).get('/api/public/surveys/erase-me')).status, 404);
});
test('short links: per-channel UTM, OG tags with poster, humans counted, bots not', async () => {
  const a = await newUser(base); await verifyEmail(a.c, base, a.email);
  await a.c.put('/api/surveys/s_lnk', { meta: { name: 'L' }, def: Object.assign(def('Face wash research', 'link-one', 'Published'), {}) });
  const l = await a.c.post('/api/surveys/s_lnk/links', { channel: 'instagram', utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'launch' } }); assert.equal(l.status, 200);
  const l2 = await a.c.post('/api/surveys/s_lnk/links', { channel: 'instagram', utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'launch' } }); assert.equal(l2.data.code, l.data.code);
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(200, 1)]);
  assert.equal((await a.c.put('/api/surveys/s_lnk/poster', png, { 'content-type': 'image/png' })).status, 200);
  assert.equal((await a.c.put('/api/surveys/s_lnk/poster', Buffer.from('not a png at all, definitely not'), { 'content-type': 'image/png' })).status, 400);
  const human = await fetch(base + l.data.path, { headers: { 'user-agent': 'Mozilla/5.0' } }); const html = await human.text();
  assert.match(html, /og:image/); assert.match(html, /utm_source=instagram/); assert.match(html, /utm_campaign=launch/);
  await fetch(base + l.data.path, { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
  const stats = (await a.c.get('/api/surveys/s_lnk/links')).data.links[0]; assert.equal(stats.clicks, 1);
  const img = await fetch(base + '/api/public/surveys/link-one/poster.png'); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(base + '/s/doesnotexist')).status, 404);
});
test('support tickets: validation, honeypot, visible to super admin only', async () => {
  const c = client(base);
  assert.equal((await c.post('/api/support', { name: 'A', email: 'bad', subject: 's', message: 'short' })).status, 400);
  assert.equal((await c.post('/api/support', { name: 'Asha', email: 'asha@example.com', subject: 'Help', message: 'I cannot publish my survey.' })).status, 201);
  const root = client(base); await root.post('/api/auth/login', { email: 'root@zksurvey.test', password: 'RootPass123' });
  assert.ok((await root.get('/api/admin/overview')).data.tickets.some(t => t.email === 'asha@example.com'));
});
test('static + health + security headers; no server source exposed', async () => {
  assert.equal((await fetch(base + '/healthz')).status, 200);
  const r = await fetch(base + '/index.html'); assert.equal(r.status, 200); assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal((await fetch(base + '/server/src/config.js')).status, 404); assert.equal((await fetch(base + '/package.json')).status, 404);
});
test('server-side survey validation: required questions enforced, invalid options rejected', async () => {
  const a = await newUser(base); await verifyEmail(a.c, base, a.email);
  await a.c.put('/api/surveys/s_val1', { meta: { name: 'V' }, def: def('V', 'val-survey', 'Published') });
  const pub = client(base); const url = '/api/public/surveys/val-survey/responses';
  const r1 = await pub.post(url, { answers: { q2: 'only why' }, consent: { given: true } });
  assert.equal(r1.status, 400);
  assert.match(r1.data.message, /required/i);
  const r2 = await pub.post(url, { answers: { q1: 'InvalidOption' }, consent: { given: true } });
  assert.equal(r2.status, 400);
  assert.match(r2.data.message, /invalid selection/i);
  const r3 = await pub.post(url, { answers: { q1: 'A', q2: 'Reason' }, consent: { given: true } });
  assert.equal(r3.status, 201);
});
test('billing: UPI checkout returns UPI URI, UTR submission activates plan or marks pending', async () => {
  const u = await newUser(base); await verifyEmail(u.c, base, u.email);
  const co = await u.c.post('/api/billing/checkout', { planId: 'starter', gateway: 'upi' });
  assert.equal(co.status, 200);
  assert.equal(co.data.mode, 'upi');
  assert.ok(co.data.upi.uri.startsWith('upi://pay?'));
  assert.match(co.data.upi.uri, /am=942\.82/);

  const badUtr = await u.c.post('/api/billing/upi-submit', { orderId: co.data.orderId, utrNumber: '12' });
  assert.equal(badUtr.status, 400);

  const sub = await u.c.post('/api/billing/upi-submit', { orderId: co.data.orderId, utrNumber: '429182749102' });
  assert.equal(sub.status, 200);
  assert.ok(sub.data.ok);

  const me = await u.c.get('/api/account');
  assert.equal(me.data.account.plan, 'starter');
  const b = await u.c.get('/api/billing');
  assert.equal(b.data.invoices.length, 1);
  assert.match(b.data.invoices[0].number, /^ZK\/\d{4}-\d{2}\/\d{5}$/);
});
test('billing: UPI manual approval by super admin via /admin/orders/:id/approve', async () => {
  const u = await newUser(base); await verifyEmail(u.c, base, u.email);
  const cfg = require('../src/config');
  const prev = cfg.autoApproveUpi;
  cfg.autoApproveUpi = false;
  try {
    const co = await u.c.post('/api/billing/checkout', { planId: 'growth', gateway: 'upi' });
    const sub = await u.c.post('/api/billing/upi-submit', { orderId: co.data.orderId, utrNumber: '998877665544' });
    assert.equal(sub.data.status, 'pending_verification');
    assert.equal((await u.c.get('/api/account')).data.account.plan, 'free');

    const root = client(base); await root.post('/api/auth/login', { email: 'root@zksurvey.test', password: 'RootPass123' });
    const app = await root.post('/api/admin/orders/' + co.data.orderId + '/approve', {});
    assert.equal(app.status, 200);
    assert.ok(app.data.ok);

    assert.equal((await u.c.get('/api/account')).data.account.plan, 'growth');
  } finally {
    cfg.autoApproveUpi = prev;
  }
});
test('super admin 2FA: requires verification code when SUPER_2FA is enabled', async () => {
  const cfg = require('../src/config');
  cfg.super2FA = true;
  try {
    const c = client(base);
    const r1 = await c.post('/api/auth/login', { email: 'root@zksurvey.test', password: 'RootPass123' });
    assert.equal(r1.status, 200);
    assert.equal(r1.data.twoFactorRequired, true);
    assert.ok(r1.data.tempToken);

    assert.equal((await c.get('/api/admin/overview')).status, 401);

    const m = (await q('select subject from mail_outbox where to_email=$1 order by id desc limit 1', ['root@zksurvey.test'])).rows[0];
    assert.ok(m);
    const code = /(\d{6})/.exec(m.subject)[1];

    const bad = await c.post('/api/auth/verify-2fa', { tempToken: r1.data.tempToken, code: '000000' });
    assert.equal(bad.status, 401);

    const ok = await c.post('/api/auth/verify-2fa', { tempToken: r1.data.tempToken, code });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.account.role, 'superadmin');

    assert.equal((await c.get('/api/admin/overview')).status, 200);
  } finally {
    cfg.super2FA = false;
  }
});




