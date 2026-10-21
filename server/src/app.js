'use strict';
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cfg = require('./config');
const { q } = require('./db');
const { wrap, HttpError } = require('./util');
const core = require('./core');

function createApp() {
  const app = express();
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy === 'true' ? true : (isNaN(cfg.trustProxy) ? cfg.trustProxy : parseInt(cfg.trustProxy, 10)));
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' stays until the page scripts are moved to files (listed in the Phase 7 gap analysis)
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
      frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'cross-origin' } // poster.png must load on social platforms
  }));
  // structured access log
  app.use((req, res, next) => { const t = Date.now(); res.on('finish', () => { if (req.path === '/healthz') return; console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: req.path, s: res.statusCode, ms: Date.now() - t, a: req.account ? req.account.id : undefined })); }); next(); });
  // Razorpay webhook needs the raw body
  app.use('/api/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());
  app.get('/healthz', wrap(async (req, res) => { await q('select 1'); res.json({ ok: true, build: 'v13.1', phase: '7.1' }); }));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60 * 1000, limit: cfg.prod ? 300 : 20000, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Slow down.' } }));
  api.use(core.loadSession);
  api.use(core.csrf);
  api.get('/plans', wrap(async (req, res) => res.json({ plans: await core.getPlans() })));
  api.get('/bootstrap', wrap(async (req, res) => {
    const out = { plans: await core.getPlans(), user: core.publicAccount(req.account), payment: { mode: cfg.paymentMode } };
    res.set('Cache-Control', 'no-store');
    if (req.account && req.account.status === 'active' && !req.query.lite) {
      out.workspace = await require('./routes/workspace').loadWorkspace(req.account.id);
      out.usage = await core.usageOf(req.account.id);
      if (req.account.role === 'superadmin') {
        const admin = require('./routes/admin');
        const accs = await q(`select a.*, (select count(*)::int from surveys s where s.account_id=a.id) surveys,(select count(*)::int from surveys s where s.account_id=a.id and s.status='Published') published,(select count(*)::int from responses x where x.account_id=a.id and not x.demo) responses from accounts a order by a.created_at`);
        out.admin = { accounts: accs.rows.map(a => Object.assign(core.publicAccount(a), { usage: { surveys: a.surveys, published: a.published, responses: a.responses } })),
          events: (await q('select (extract(epoch from at)*1000)::bigint at,type,text from events order by at desc limit 100')).rows.map(e => ({ at: Number(e.at), type: e.type, text: e.text })) };
      }
    }
    res.json(out);
  }));
  api.use('/auth', require('./routes/auth'));
  api.use('/account', require('./routes/account'));
  api.use('/public', require('./routes/public'));
  api.use('/support', require('./routes/support'));
  api.use('/admin', require('./routes/admin'));
  api.use('/', require('./routes/billing'));   // /billing/*, /invoices/*, /webhooks/razorpay
  api.use('/', require('./routes/workspace')); // /workspace, /surveys/*, /kv, /slugs
  if (cfg.devOutbox) api.get('/dev/outbox', wrap(async (req, res) => {
    const r = await q('select id,to_email,subject,body from mail_outbox where ($1::text is null or to_email=$1) order by id desc limit 20', [req.query.to || null]); res.json({ outbox: r.rows });
  }));
  api.use((req, res, next) => next(new HttpError(404, 'not_found', 'No such endpoint.')));
  app.use('/api', api);
  app.use('/s', require('./routes/links'));

  const web = path.join(__dirname, '..', '..', 'web');
  app.use(express.static(web, { extensions: ['html'], setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.setHeader('Cache-Control', 'no-cache'); } }));

  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(JSON.stringify({ level: 'error', p: req.path, err: err.message, stack: String(err.stack).split('\n').slice(0, 3) }));
    if (!req.path.startsWith('/api') && status === 404) return res.status(404).send('Not found');
    res.status(status).json(Object.assign({ error: err.code || (status >= 500 ? 'server_error' : 'error'), message: status >= 500 ? 'Something went wrong. Please try again.' : err.message }, err.errors ? { errors: err.errors } : {}));
  });
  return app;
}
module.exports = createApp;
