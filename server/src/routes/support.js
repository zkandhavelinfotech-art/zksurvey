'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const cfg = require('../config');
const { q } = require('../db');
const { rid, validEmail, HttpError, wrap, clip } = require('../util');
const { event } = require('../core');
const lim = rateLimit({ windowMs: 60 * 60 * 1000, limit: cfg.prod ? 10 : 500, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many messages. Try again later.' } });
router.post('/', lim, wrap(async (req, res) => {
  const b = req.body || {}; const email = clip(b.email, 254).trim();
  if (b.website) return res.json({ ok: true }); // honeypot
  if (!clip(b.name, 120).trim() || !validEmail(email) || !clip(b.subject, 160).trim() || clip(b.message, 4000).trim().length < 10) throw new HttpError(400, 'validation', 'Fill in your name, a valid email, a subject and a message (10+ characters).');
  await q('insert into support_tickets(id,account_id,name,email,subject,message) values ($1,$2,$3,$4,$5,$6)', [rid('tkt'), req.account ? req.account.id : null, clip(b.name, 120).trim(), email, clip(b.subject, 160).trim(), clip(b.message, 4000).trim()]);
  await event('support', 'Support message from ' + email, req.account ? req.account.id : null);
  res.status(201).json({ ok: true });
}));
module.exports = router;
