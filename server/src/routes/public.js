'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const cfg = require('../config');
const { q, tx } = require('../db');
const { rid, HttpError, wrap, clip } = require('../util');
const { planOf, usageOf } = require('../core');

const submitLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: cfg.prod ? 40 : 2000, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many submissions from this network. Please try again later.' } });
const ipHash = ip => crypto.createHmac('sha256', cfg.serverSecret).update(String(ip || '')).digest('hex').slice(0, 24);

async function loadPublic(slug) {
  const r = await q(`select s.id, s.def, s.status, a.id acct, a.status astatus, a.plan_id, a.role, a.company
     from surveys s join accounts a on a.id=s.account_id where s.slug=$1`, [slug]);
  return r.rows[0];
}
async function closedReason(row) {
  if (row.status !== 'Published') return 'unpublished';
  if (row.astatus !== 'active') return 'closed';
  if (row.role !== 'superadmin') { const plan = await planOf(row.plan_id); const u = await usageOf(row.acct); if (u.responses >= plan.responses) return 'cap'; }
  return null;
}

router.get('/surveys/:slug', wrap(async (req, res) => {
  const row = await loadPublic(req.params.slug);
  if (!row || row.status !== 'Published') return res.status(404).json({ error: 'not_found', message: 'This survey is not available.' });
  const plan = await planOf(row.plan_id);
  res.set('Cache-Control', 'no-store');
  res.json({ id: row.id, def: row.def, owner: { company: row.company }, watermark: row.role !== 'superadmin' && !!plan.watermark, closed: await closedReason(row) });
}));

router.get('/surveys/:slug/poster.png', wrap(async (req, res) => {
  const r = await q("select poster_png from surveys where slug=$1 and status='Published' and poster_png is not null", [req.params.slug]);
  if (!r.rows[0]) return res.status(404).end();
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' }).send(r.rows[0].poster_png);
}));

router.post('/surveys/:slug/start', submitLimit, wrap(async (req, res) => {
  const row = await loadPublic(req.params.slug);
  if (!row || (await closedReason(row))) return res.json({ ok: false });
  await q('insert into survey_starts(survey_id,count) values ($1,1) on conflict (survey_id) do update set count=survey_starts.count+1', [row.id]);
  res.json({ ok: true });
}));

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
router.post('/surveys/:slug/responses', submitLimit, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });                       // honeypot: pretend success, store nothing
  const row = await loadPublic(req.params.slug);
  if (!row) throw new HttpError(404, 'not_found', 'This survey is not available.');
  const reason = await closedReason(row);
  if (reason) throw new HttpError(409, 'closed', 'This survey is no longer accepting responses.');
  if (!b.consent || b.consent.given !== true) throw new HttpError(400, 'consent_required', 'Please accept the consent notice to submit.');
  const { validateSurveySubmission } = require('../survey-validation');
  const answers = validateSurveySubmission(row.def, b.answers);
  const qids = new Set((row.def.questions || []).map(x => x.id));
  if (JSON.stringify(answers).length > 60000) throw new HttpError(413, 'too_large', 'Response is too large.');
  const utm = {}; UTM.forEach(k => { if (b.utm && b.utm[k]) utm[k] = clip(b.utm[k], 80); });
  const flags = []; if (typeof b.elapsedMs === 'number' && b.elapsedMs < 1500 && qids.size >= 3) flags.push('too_fast');
  const meta = { runner: 'run.html', lang: clip(b.meta && b.meta.lang, 20), flags };
  const ih = ipHash(req.ip);
  const out = await tx(async c => {
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [row.acct]);
    if (row.role !== 'superadmin') { const plan = await planOf(row.plan_id); const u = await usageOf(row.acct, c); if (u.responses >= plan.responses) throw new HttpError(409, 'closed', 'This survey is no longer accepting responses.'); }
    const dup = await c.query("select 1 from responses where survey_id=$1 and ip_hash=$2 and at > now() - interval '30 seconds' and answers=$3::jsonb limit 1", [row.id, ih, JSON.stringify(answers)]);
    if (dup.rows[0]) return { duplicate: true };
    const id = rid('resp');
    await c.query('insert into responses(id,survey_id,account_id,answers,utm,meta,consent,ip_hash) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, row.id, row.acct, answers, utm, meta, { given: true, at: new Date().toISOString(), version: clip(b.consent.version, 20) || '2026-10' }, ih]);
    return { id };
  });
  res.status(201).json({ ok: true });
}));
module.exports = router;
