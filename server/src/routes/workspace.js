'use strict';
const router = require('express').Router();
const { q, tx } = require('../db');
const { rid, HttpError, wrap, clip } = require('../util');
const { requireAuth, usageOf, planOf, event } = require('../core');

router.use(requireAuth);
const isSuper = req => req.account.role === 'superadmin';
const ID = /^[A-Za-z0-9_-]{3,60}$/;
const KEY = /^zk_[a-z0-9_]{2,60}$/;
const RESERVED = new Set(['zk_surveys_v7', 'zk_defs_v7', 'zk_responses_v7', 'zk_starts_v7']);
const SLUG = /^[a-z0-9][a-z0-9-]{2,59}$/;

/* Whole workspace for the signed-in account (bridge used by the static UI; see docs for the granular API). */
async function loadWorkspace(accountId) {
  const [s, r, st, kv] = await Promise.all([
    q('select id,name,meta,def from surveys where account_id=$1 order by created_at', [accountId]),
    q('select id,survey_id,(extract(epoch from at)*1000)::bigint at,answers,utm,meta,demo from responses where account_id=$1 order by at', [accountId]),
    q('select st.survey_id,st.count from survey_starts st join surveys s on s.id=st.survey_id where s.account_id=$1', [accountId]),
    q('select key,value from workspace_kv where account_id=$1', [accountId])]);
  const defs = {}, responses = {}, starts = {}, kvo = {};
  s.rows.forEach(x => { defs[x.id] = x.def; });
  r.rows.forEach(x => { (responses[x.survey_id] = responses[x.survey_id] || []).push(Object.assign({ id: x.id, at: Number(x.at), answers: x.answers, utm: x.utm, meta: x.meta }, x.demo ? { demo: true } : {})); });
  st.rows.forEach(x => { starts[x.survey_id] = x.count; });
  kv.rows.forEach(x => { kvo[x.key] = x.value; });
  return { list: s.rows.map(x => Object.assign({ id: x.id, name: x.name }, x.meta)), defs, responses, starts, kv: kvo };
}
router.get('/workspace', wrap(async (req, res) => res.json(await loadWorkspace(req.account.id))));

router.delete('/workspace', wrap(async (req, res) => {
  await q('delete from surveys where account_id=$1', [req.account.id]);
  await q('delete from workspace_kv where account_id=$1', [req.account.id]);
  res.json({ ok: true });
}));

/* ---- surveys ---- */
router.put('/surveys/:id', wrap(async (req, res) => {
  const id = req.params.id; if (!ID.test(id)) throw new HttpError(400, 'validation', 'Bad survey id.');
  const { meta, def } = req.body || {};
  if (!def || typeof def !== 'object' || !def.details || !Array.isArray(def.questions) || !Array.isArray(def.sections)) throw new HttpError(400, 'validation', 'Invalid survey definition.');
  if (JSON.stringify(def).length > 2_000_000) throw new HttpError(413, 'too_large', 'Survey is too large.');
  const name = clip((meta && meta.name) || def.details.title || 'Untitled survey', 200);
  const pub = def.publish || {}; const status = clip(pub.status || 'Draft', 20);
  const slug = status === 'Published' ? clip(pub.slug, 60) : null;
  const sup = isSuper(req);
  await tx(async c => {
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [req.account.id]);
    const ex = (await c.query('select account_id,status,slug from surveys where id=$1', [id])).rows[0];
    if (ex && ex.account_id !== req.account.id) throw new HttpError(403, 'forbidden', 'Not your survey.');
    const plan = await planOf(req.account.plan_id);
    if (!ex && !sup) {
      const u = await usageOf(req.account.id, c);
      if (u.surveys >= plan.surveys) throw new HttpError(402, 'limit_surveys', 'Your ' + plan.name + ' plan allows ' + plan.surveys + ' survey' + (plan.surveys === 1 ? '' : 's') + '. Upgrade to add more.');
    }
    if (status === 'Published' && !(ex && ex.status === 'Published') && !sup) {
      if (!req.account.email_verified_at) throw new HttpError(403, 'verify_email', 'Verify your email address before publishing a survey.');
      const u = await usageOf(req.account.id, c);
      if (u.responses >= plan.responses) throw new HttpError(402, 'limit_responses', 'Your response limit is reached. Upgrade to publish more surveys.');
    }
    if (status === 'Published') {
      if (!SLUG.test(slug || '')) throw new HttpError(400, 'bad_slug', 'Use 3–60 lowercase letters, numbers and hyphens for the survey link.');
      const t = (await c.query('select account_id from surveys where slug=$1 and id<>$2', [slug, id])).rows[0];
      if (t) throw new HttpError(409, 'slug_taken', 'That survey link is already taken. Choose another.');
    }
    const publishedAt = status === 'Published' ? (pub.publishedAt ? new Date(pub.publishedAt) : new Date()) : null;
    await c.query(`insert into surveys(id,account_id,name,status,slug,meta,def,published_at) values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (id) do update set name=$3,status=$4,slug=$5,meta=$6,def=$7,published_at=coalesce($8,surveys.published_at),updated_at=now()`,
      [id, req.account.id, name, status, slug, meta || {}, def, publishedAt]);
  });
  res.json({ ok: true });
}));

router.delete('/surveys/:id', wrap(async (req, res) => {
  await q('delete from surveys where id=$1 and account_id=$2', [req.params.id, req.account.id]); res.json({ ok: true });
}));

router.put('/surveys/:id/starts', wrap(async (req, res) => {
  const n = Math.max(0, Math.min(1e7, parseInt(req.body && req.body.count, 10) || 0));
  const s = await q('select 1 from surveys where id=$1 and account_id=$2', [req.params.id, req.account.id]);
  if (!s.rows[0]) throw new HttpError(404, 'not_found', 'Survey not found.');
  await q('insert into survey_starts(survey_id,count) values ($1,$2) on conflict (survey_id) do update set count=$2', [req.params.id, n]);
  res.json({ ok: true });
}));

/* Sample/demo responses only; real responses can only arrive through the public endpoint. */
router.post('/surveys/:id/responses/bulk', wrap(async (req, res) => {
  const s = await q('select def from surveys where id=$1 and account_id=$2', [req.params.id, req.account.id]);
  if (!s.rows[0]) throw new HttpError(404, 'not_found', 'Survey not found.');
  const arr = Array.isArray(req.body && req.body.responses) ? req.body.responses.slice(0, 1000) : [];
  if (arr.some(r => !r || r.demo !== true)) throw new HttpError(400, 'validation', 'Only sample (demo) responses can be added from the dashboard.');
  const have = (await q('select count(*)::int n from responses where survey_id=$1 and demo', [req.params.id])).rows[0].n;
  if (have + arr.length > 1000) throw new HttpError(400, 'limit_demo', 'Sample data is limited to 1,000 rows per survey.');
  await tx(async c => { for (const r of arr) await c.query('insert into responses(id,survey_id,account_id,at,answers,utm,meta,demo) values ($1,$2,$3,to_timestamp($4/1000.0),$5,$6,$7,true) on conflict (id) do nothing', [clip(r.id, 60) || rid('resp'), req.params.id, req.account.id, Number(r.at) || Date.now(), r.answers || {}, r.utm || {}, r.meta || {}]); });
  res.json({ ok: true, added: arr.length });
}));
router.post('/surveys/:id/responses/delete', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).slice(0, 5000).map(x => clip(x, 60));
  await q('delete from responses where survey_id=$1 and account_id=$2 and id = any($3)', [req.params.id, req.account.id, ids]);
  res.json({ ok: true });
}));

/* ---- generic key/value for the remaining collections (campaigns, segments, strategy, settings…) ---- */
router.put('/kv', wrap(async (req, res) => {
  const e = (req.body && req.body.entries) || {}; const keys = Object.keys(e);
  if (keys.length > 50) throw new HttpError(400, 'validation', 'Too many keys.');
  for (const k of keys) { if (!KEY.test(k) || RESERVED.has(k)) throw new HttpError(400, 'validation', 'Bad key: ' + k); if (JSON.stringify(e[k]).length > 1_000_000) throw new HttpError(413, 'too_large', 'Value too large.'); }
  const n = (await q('select count(*)::int n from workspace_kv where account_id=$1', [req.account.id])).rows[0].n;
  if (n + keys.length > 300) throw new HttpError(400, 'validation', 'Too many stored keys.');
  await tx(async c => { for (const k of keys) await c.query('insert into workspace_kv(account_id,key,value) values ($1,$2,$3) on conflict (account_id,key) do update set value=$3, updated_at=now()', [req.account.id, k, JSON.stringify(e[k])]); });
  res.json({ ok: true });
}));
router.delete('/kv/:key', wrap(async (req, res) => { await q('delete from workspace_kv where account_id=$1 and key=$2', [req.account.id, req.params.key]); res.json({ ok: true }); }));

/* ---- slug availability (used by the builder before publishing) ---- */
router.get('/slugs/:slug', wrap(async (req, res) => {
  const t = (await q('select account_id from surveys where slug=$1', [req.params.slug])).rows[0];
  res.json({ taken: !!t && t.account_id !== req.account.id });
}));

/* ---- share poster (Open Graph image) + tracked short links ---- */
router.put('/surveys/:id/poster', require('express').raw({ type: 'image/png', limit: '3mb' }), wrap(async (req, res) => {
  const b = req.body;
  if (!Buffer.isBuffer(b) || b.length < 100 || b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new HttpError(400, 'validation', 'Send a PNG image.');
  const r = await q('update surveys set poster_png=$3, poster_alt=$4 where id=$1 and account_id=$2', [req.params.id, req.account.id, b, clip(req.get('x-poster-alt'), 200)]);
  if (!r.rowCount) throw new HttpError(404, 'not_found', 'Survey not found.');
  res.json({ ok: true });
}));

router.post('/surveys/:id/links', wrap(async (req, res) => {
  const s = (await q('select id,slug,status from surveys where id=$1 and account_id=$2', [req.params.id, req.account.id])).rows[0];
  if (!s) throw new HttpError(404, 'not_found', 'Survey not found.');
  const channel = clip(req.body && req.body.channel, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'link';
  const utm = {}; const u = (req.body && req.body.utm) || {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => { if (u[k]) utm[k] = clip(u[k], 80); });
  if (!utm.utm_source) utm.utm_source = channel;
  const key = JSON.stringify(utm);
  const ex = (await q('select code from short_links where survey_id=$1 and channel=$2 and utm=$3::jsonb', [s.id, channel, key])).rows[0];
  const code = ex ? ex.code : rid('l', 7).replace('l_', '');
  if (!ex) await q('insert into short_links(code,account_id,survey_id,channel,utm) values ($1,$2,$3,$4,$5)', [code, req.account.id, s.id, channel, utm]);
  res.json({ code, path: '/s/' + code });
}));
router.get('/surveys/:id/links', wrap(async (req, res) => {
  const r = await q('select code,channel,utm,clicks,last_click from short_links where survey_id=$1 and account_id=$2 order by created_at', [req.params.id, req.account.id]);
  res.json({ links: r.rows });
}));

module.exports = router;
module.exports.loadWorkspace = loadWorkspace;
