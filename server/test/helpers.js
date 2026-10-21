'use strict';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://zk:zk@localhost:5432/zksurvey_test';
process.env.NODE_ENV = 'test';
process.env.SUPER_EMAIL = 'root@zksurvey.test';
process.env.SUPER_PASSWORD = 'RootPass123';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_test';
process.env.SELLER_GSTIN = '33AAAAA0000A1Z5';
process.env.SUPER_2FA = 'false';
const migrate = require('../src/migrate');
const { pool, q } = require('../src/db');
const createApp = require('../src/app');
const { ensureSuper } = require('../src/create-super');

async function start() {
  await migrate();
  await q('truncate accounts, events, audit_log, mail_outbox, support_tickets, invoices, orders restart identity cascade');
  await ensureSuper(true);
  const app = createApp(); const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  return { base, server, close: async () => { await new Promise(r => server.close(r)); await pool.end(); } };
}
/* tiny cookie-keeping client */
function client(base) {
  let cookie = '';
  async function call(method, path, body, headers) {
    const h = Object.assign({ 'x-zk-csrf': '1' }, headers || {}); if (cookie) h.cookie = cookie;
    let payload; if (body !== undefined) { if (Buffer.isBuffer(body)) payload = body; else { h['content-type'] = 'application/json'; payload = JSON.stringify(body); } }
    const r = await fetch(base + path, { method, headers: h, body: payload, redirect: 'manual' });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; sc.forEach(c => { const kv = c.split(';')[0]; if (/=;?$/.test(kv) || /Expires=Thu, 01 Jan 1970/.test(c)) cookie = ''; else cookie = kv; });
    const ct = r.headers.get('content-type') || ''; const data = ct.includes('json') ? await r.json() : await r.text();
    return { status: r.status, data, headers: r.headers };
  }
  return { get: (p, h) => call('GET', p, undefined, h), post: (p, b, h) => call('POST', p, b === undefined ? {} : b, h), put: (p, b, h) => call('PUT', p, b, h), patch: (p, b) => call('PATCH', p, b), del: (p, b) => call('DELETE', p, b || {}), raw: call, hasCookie: () => !!cookie };
}
let n = 0;
async function newUser(base, over) {
  const c = client(base); const email = 'u' + (++n) + '_' + Date.now() + '@example.com';
  const r = await c.post('/api/auth/register', Object.assign({ name: 'User ' + n, email, password: 'Secret123', terms: true, company: 'Co ' + n }, over || {}));
  if (r.status !== 201) throw new Error('register failed ' + JSON.stringify(r.data));
  return { c, email, id: r.data.account.id };
}
async function verifyEmail(c, base, email) {
  const o = await c.get('/api/dev/outbox?to=' + encodeURIComponent(email)); const m = o.data.outbox.find(x => /Verify/.test(x.subject));
  const t = /token=([\w-]+)/.exec(m.body)[1]; return client(base).post('/api/auth/verify', { token: t });
}
const def = (title, slug, status) => ({ details: { title, type: 'Market Research', language: 'English', time: '2 min' }, sections: [{ id: 'sec1', name: 'General' }],
  questions: [{ id: 'q1', text: 'Pick', type: 'Single Choice', sectionId: 'sec1', required: true, options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }] }, { id: 'q2', text: 'Why', type: 'Text', sectionId: 'sec1' }, { id: 'q3', text: 'Rate', type: 'Rating', sectionId: 'sec1' }],
  rules: [], publish: { status: status || 'Draft', slug: slug || '', publishedAt: status === 'Published' ? Date.now() : null } });
module.exports = { start, client, newUser, verifyEmail, def, q };
