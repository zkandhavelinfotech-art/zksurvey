'use strict';
const router = require('express').Router();
const crypto = require('crypto');
const cfg = require('../config');
const { q, tx } = require('../db');
const { rid, HttpError, wrap, clip } = require('../util');
const { requireAuth, getPlans, event, audit } = require('../core');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = p => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fyOf(d) { const ist = new Date(d.getTime() + 330 * 60000); const y = ist.getUTCFullYear(), m = ist.getUTCMonth(); const s = m >= 3 ? y : y - 1; return s + '-' + String((s + 1) % 100).padStart(2, '0'); }
function taxSplit(amount, buyerState) {
  const gst = Math.round(amount * cfg.gstRate / 100);
  const intra = !buyerState || buyerState.trim().toLowerCase() === cfg.seller.state.toLowerCase();
  if (intra) { const c = Math.floor(gst / 2); return { gst, cgst: c, sgst: gst - c, igst: 0 }; }
  return { gst, cgst: 0, sgst: 0, igst: gst };
}

async function razorpayCreateOrder(amount, receipt) {
  const auth = Buffer.from(cfg.razorpay.keyId + ':' + cfg.razorpay.keySecret).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, currency: 'INR', receipt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'gateway', 'Payment gateway error: ' + ((j.error && j.error.description) || r.status));
  return j.id;
}

/* Idempotent: safe to call from the browser callback AND the webhook. */
async function fulfil(orderId, paymentId) {
  return tx(async c => {
    const o = (await c.query('select * from orders where id=$1 for update', [orderId])).rows[0];
    if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
    if (o.status === 'paid') return { already: true, order: o };
    await c.query("update orders set status='paid', gateway_payment_id=$2, paid_at=now() where id=$1", [orderId, paymentId || null]);
    const a = (await c.query('select * from accounts where id=$1 for update', [o.account_id])).rows[0];
    if (!a) return { orphan: true };
    const base = (a.plan_id === o.plan_id && a.plan_period_end && new Date(a.plan_period_end) > new Date()) ? new Date(a.plan_period_end) : new Date();
    const end = new Date(base.getTime()); end.setMonth(end.getMonth() + o.months);
    await c.query('update accounts set plan_id=$2, plan_period_end=$3, cancel_at_period_end=false where id=$1', [a.id, o.plan_id, end]);
    const now = new Date(); const fy = fyOf(now);
    await c.query('select pg_advisory_xact_lock(hashtext($1))', ['invoice-' + fy]);
    const n = (await c.query('select count(*)::int n from invoices where number like $1', ['ZK/' + fy + '/%'])).rows[0].n + 1;
    const number = 'ZK/' + fy + '/' + String(n).padStart(5, '0');
    const plan = (await getPlans()).find(p => p.id === o.plan_id);
    const b = a.billing || {};
    const split = taxSplit(o.amount_paise, b.state);
    const buyer = { name: b.legalName || a.company || a.name, email: a.email, gstin: b.gstin || '', state: b.state || '', address: b.address || '' };
    const lines = [{ desc: 'ZKSurvey ' + (plan ? plan.name : o.plan_id) + ' plan — ' + o.months + ' month' + (o.months > 1 ? 's' : ''), sac: cfg.seller.sac, amount_paise: o.amount_paise }];
    await c.query('insert into invoices(id,number,account_id,order_id,buyer,seller,lines,subtotal_paise,cgst_paise,sgst_paise,igst_paise,total_paise) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [rid('inv'), number, a.id, o.id, buyer, cfg.seller, JSON.stringify(lines), o.amount_paise, split.cgst, split.sgst, split.igst, o.amount_paise + split.gst]);
    await c.query("insert into events(type,text,account_id) values ('payment',$1,$2)", [a.email + ' → ' + (plan ? plan.name : o.plan_id) + ' (' + number + ')', a.id]);
    return { ok: true, number };
  });
}

router.post('/webhooks/razorpay', wrap(async (req, res) => {
  const raw = req.body; // Buffer (raw parser mounted in index.js)
  const sig = req.get('x-razorpay-signature') || '';
  if (!cfg.razorpay.webhookSecret) throw new HttpError(503, 'not_configured', 'Webhook secret not configured.');
  const exp = crypto.createHmac('sha256', cfg.razorpay.webhookSecret).update(raw).digest('hex');
  const ok = sig.length === exp.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp));
  if (!ok) throw new HttpError(400, 'bad_signature', 'Invalid signature.');
  const ev = JSON.parse(raw.toString('utf8'));
  if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
    const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
    if (pay && pay.order_id) {
      const o = (await q("select id from orders where gateway='razorpay' and gateway_order_id=$1", [pay.order_id])).rows[0];
      if (o) await fulfil(o.id, pay.id);
    }
  }
  res.json({ ok: true });
}));

router.use(requireAuth);

router.get('/billing', wrap(async (req, res) => {
  const a = req.account;
  const [orders, invoices] = await Promise.all([
    q('select id,plan_id,months,total_paise,status,gateway,created_at,paid_at from orders where account_id=$1 order by created_at desc limit 20', [a.id]),
    q('select id,number,issued_at,total_paise from invoices where account_id=$1 order by issued_at desc', [a.id])]);
  res.json({
    mode: cfg.paymentMode,
    keyId: ['razorpay', 'both'].includes(cfg.paymentMode) ? cfg.razorpay.keyId : '',
    upi: { id: cfg.upi.id, payeeName: cfg.upi.payeeName },
    autoApproveUpi: cfg.autoApproveUpi,
    gstRate: cfg.gstRate,
    taxInvoices: !!cfg.seller.gstin,
    orders: orders.rows,
    invoices: invoices.rows
  });
}));

router.post('/billing/checkout', wrap(async (req, res) => {
  const a = req.account; const { planId, gateway } = req.body || {}; const months = [1, 12].includes(Number(req.body && req.body.months)) ? Number(req.body.months) : 1;
  if (!a.email_verified_at) throw new HttpError(403, 'verify_email', 'Verify your email address before subscribing.');
  const plan = (await getPlans()).find(p => p.id === planId);
  if (!plan || plan.price <= 0) throw new HttpError(400, 'validation', 'Choose a paid plan.');
  const amount = plan.price * 100 * months; const { gst } = taxSplit(amount, (a.billing || {}).state);
  const id = rid('ord');

  // Determine gateway: user-requested or system mode
  let gw = gateway || (cfg.paymentMode === 'both' ? 'upi' : cfg.paymentMode);
  let gid;

  if (gw === 'upi') {
    gid = 'upi_' + id;
  } else if (gw === 'razorpay') {
    gid = await razorpayCreateOrder(amount + gst, id);
  } else if (gw === 'mock' && !cfg.prod) {
    gid = 'mock_' + id;
  } else if (!cfg.prod) {
    gw = 'mock';
    gid = 'mock_' + id;
  } else {
    throw new HttpError(503, 'not_configured', 'Payment gateway not configured.');
  }

  await q('insert into orders(id,account_id,plan_id,months,amount_paise,gst_paise,total_paise,gateway,gateway_order_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, a.id, plan.id, months, amount, gst, amount + gst, gw, gid]);
  await audit(req, 'checkout_created', id, { plan: plan.id, months, gateway: gw });

  const totalPaise = amount + gst;
  const totalRupees = (totalPaise / 100).toFixed(2);
  const upiUri = `upi://pay?pa=${encodeURIComponent(cfg.upi.id)}&pn=${encodeURIComponent(cfg.upi.payeeName)}&am=${totalRupees}&tn=${encodeURIComponent('ZKSurvey-' + id)}&cu=INR`;

  res.json({
    mode: gw,
    orderId: id,
    gatewayOrderId: gid,
    keyId: cfg.razorpay.keyId,
    amount: totalPaise,
    gst,
    plan: plan.name,
    months,
    name: 'ZKSurvey',
    prefill: { name: a.name, email: a.email },
    upi: {
      id: cfg.upi.id,
      payeeName: cfg.upi.payeeName,
      uri: upiUri,
      amountRupees: totalRupees,
      refNote: 'ZKSurvey-' + id
    }
  });
}));

router.post('/billing/upi-submit', wrap(async (req, res) => {
  const { orderId, utrNumber } = req.body || {};
  const utr = clip(utrNumber, 60).trim();
  if (!utr || utr.length < 4) throw new HttpError(400, 'validation', 'Enter a valid UPI Reference / UTR number (at least 4 digits).');
  const o = (await q('select * from orders where id=$1 and account_id=$2', [orderId, req.account.id])).rows[0];
  if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
  if (o.status === 'paid') return res.json({ already: true, order: o });

  if (cfg.autoApproveUpi) {
    await q("update orders set gateway='upi', gateway_payment_id=$2 where id=$1", [o.id, utr]);
    await audit(req, 'upi_submitted', o.id, { utr, autoApprove: true });
    const f = await fulfil(o.id, 'upi_' + utr);
    return res.json(Object.assign({ ok: true, status: 'paid', message: 'UPI payment verified. Plan upgraded!' }, f));
  }

  await q("update orders set gateway='upi', gateway_payment_id=$2, status='pending_verification' where id=$1", [o.id, utr]);
  await audit(req, 'upi_submitted', o.id, { utr, autoApprove: false });
  res.json({ ok: true, status: 'pending_verification', message: 'UTR submitted. Plan will activate upon verification.' });
}));

router.post('/billing/verify', wrap(async (req, res) => {
  const { orderId, razorpay_payment_id: pid, razorpay_signature: sig } = req.body || {};
  const o = (await q('select * from orders where id=$1 and account_id=$2', [orderId, req.account.id])).rows[0];
  if (!o || o.gateway !== 'razorpay') throw new HttpError(404, 'not_found', 'Order not found.');
  const exp = crypto.createHmac('sha256', cfg.razorpay.keySecret).update(o.gateway_order_id + '|' + pid).digest('hex');
  if (typeof sig !== 'string' || sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) throw new HttpError(400, 'bad_signature', 'Payment signature mismatch.');
  res.json(await fulfil(o.id, pid));
}));

/* Development only: completes a mock order. Disabled in production by config.js. */
router.post('/billing/mock-pay', wrap(async (req, res) => {
  if (cfg.paymentMode !== 'mock' || cfg.prod) throw new HttpError(404, 'not_found', 'Not found.');
  const o = (await q('select * from orders where id=$1 and account_id=$2 and gateway=$3', [req.body && req.body.orderId, req.account.id, 'mock'])).rows[0];
  if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
  res.json(await fulfil(o.id, 'mock_pay_' + rid('p')));
}));

router.post('/billing/cancel', wrap(async (req, res) => { await q('update accounts set cancel_at_period_end=true where id=$1', [req.account.id]); await event('cancel', 'Cancellation scheduled', req.account.id); res.json({ ok: true }); }));
router.post('/billing/resume', wrap(async (req, res) => { await q('update accounts set cancel_at_period_end=false where id=$1', [req.account.id]); res.json({ ok: true }); }));

router.get('/invoices/:id/html', wrap(async (req, res) => {
  const i = (await q('select * from invoices where id=$1', [req.params.id])).rows[0];
  if (!i || (i.account_id !== req.account.id && req.account.role !== 'superadmin')) throw new HttpError(404, 'not_found', 'Invoice not found.');
  const s = i.seller, b = i.buyer, tax = !!s.gstin;
  const rows = i.lines.map(l => `<tr><td>${esc(l.desc)}</td><td>${esc(l.sac)}</td><td class="r">${inr(l.amount_paise)}</td></tr>`).join('');
  res.type('html').set('Cache-Control', 'no-store').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(i.number)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0a0d18;color:#e9f1ff;font:15px/1.5 system-ui,sans-serif;padding:32px}.box{max-width:760px;margin:auto;background:#121830;border:1px solid #26305a;border-radius:14px;padding:28px}
h1{margin:0 0 4px;font-size:22px}.m{color:#a9b4d6;font-size:13px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:9px 6px;border-bottom:1px solid #26305a;text-align:left}.r{text-align:right}.tot td{font-weight:700;border-bottom:0}
.g{display:grid;grid-template-columns:1fr 1fr;gap:20px}a{color:#9ce6ff}button{background:#9ce6ff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}
@media print{body{background:#fff;color:#000;padding:0}.box{background:#fff;border-color:#999;color:#000}.m{color:#444}td,th{border-color:#bbb}button{display:none}}</style></head><body><div class="box">
<div style="display:flex;justify-content:space-between;align-items:center"><h1>${tax ? 'Tax Invoice' : 'Payment Receipt'}</h1><button onclick="print()">Print / Save PDF</button></div>
<div class="m">No. <b>${esc(i.number)}</b> · ${new Date(i.issued_at).toLocaleDateString('en-IN')}</div>
<div class="g" style="margin-top:18px"><div><b>${esc(s.name)}</b><div class="m">${esc(s.address)}<br>${tax ? 'GSTIN: ' + esc(s.gstin) : 'GSTIN not configured on this deployment'}<br>State: ${esc(s.state)}</div></div>
<div><b>Billed to</b><div class="m">${esc(b.name)}<br>${esc(b.address)}<br>${b.gstin ? 'GSTIN: ' + esc(b.gstin) + '<br>' : ''}State: ${esc(b.state || '—')}<br>${esc(b.email)}</div></div></div>
<table><thead><tr><th>Description</th><th>SAC</th><th class="r">Amount</th></tr></thead><tbody>${rows}
<tr><td colspan="2" class="r">Subtotal</td><td class="r">${inr(i.subtotal_paise)}</td></tr>
${i.cgst_paise ? `<tr><td colspan="2" class="r">CGST ${cfg.gstRate / 2}%</td><td class="r">${inr(i.cgst_paise)}</td></tr><tr><td colspan="2" class="r">SGST ${cfg.gstRate / 2}%</td><td class="r">${inr(i.sgst_paise)}</td></tr>` : `<tr><td colspan="2" class="r">IGST ${cfg.gstRate}%</td><td class="r">${inr(i.igst_paise)}</td></tr>`}
<tr class="tot"><td colspan="2" class="r">Total (INR)</td><td class="r">${inr(i.total_paise)}</td></tr></tbody></table>
<div class="m">Computer-generated document. ${tax ? '' : 'This is a receipt, not a GST tax invoice, until the seller GSTIN is configured. '}Tax treatment must be confirmed by your chartered accountant.</div></div></body></html>`);
}));

async function expireSubscriptions() {
  const r = await q("update accounts set plan_id='free', cancel_at_period_end=false, plan_period_end=null where plan_id<>'free' and role<>'superadmin' and plan_period_end is not null and plan_period_end < now() - interval '3 days' returning id,email");
  for (const a of r.rows) await event('plan_expired', a.email + ' downgraded to Free (period ended)', a.id);
  const r2 = await q("update accounts set plan_id='free', cancel_at_period_end=false, plan_period_end=null where plan_id<>'free' and role<>'superadmin' and cancel_at_period_end and plan_period_end < now() returning id,email");
  for (const a of r2.rows) await event('plan_cancelled', a.email + ' downgraded to Free (cancelled)', a.id);
  return r.rowCount + r2.rowCount;
}
module.exports = router;
module.exports.fulfil = fulfil;
module.exports.expireSubscriptions = expireSubscriptions;
