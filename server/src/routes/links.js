'use strict';
/* GET /s/:code — tracked short link. Serves Open Graph tags (so Facebook / WhatsApp / X / LinkedIn show the poster),
   counts human clicks only, then forwards the visitor to the survey with the channel's UTM tags. */
const router = require('express').Router();
const cfg = require('../config');
const { q } = require('../db');
const { wrap } = require('../util');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOT = /facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|linkedinbot|telegrambot|discordbot|googlebot|bingbot|applebot|embedly|pinterest/i;

router.get('/:code', wrap(async (req, res) => {
  const r = await q(`select l.code,l.utm,s.slug,s.status,s.def,(s.poster_png is not null) has_poster from short_links l join surveys s on s.id=l.survey_id where l.code=$1`, [req.params.code]);
  const l = r.rows[0];
  if (!l || l.status !== 'Published' || !l.slug) return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>Survey not available</title><body style="background:#0a0d18;color:#e9f1ff;font-family:sans-serif;padding:40px"><h2>This survey is not available</h2><p>The link may be old or the survey is closed.</p>');
  const ua = req.get('user-agent') || '';
  if (!BOT.test(ua)) await q('update short_links set clicks=clicks+1,last_click=now() where code=$1', [l.code]);
  const qs = new URLSearchParams(Object.assign({ s: l.slug }, l.utm)).toString();
  const target = cfg.appUrl + '/public/run.html?' + qs;
  const d = l.def.details || {};
  const title = d.title || 'Survey', desc = d.intro || d.description || 'Take this short survey.';
  const img = l.has_poster ? cfg.appUrl + '/api/public/surveys/' + encodeURIComponent(l.slug) + '/poster.png' : '';
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(cfg.appUrl + '/s/' + l.code)}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head><body style="background:#0a0d18;color:#e9f1ff;font-family:sans-serif;padding:40px"><p>Opening the survey… <a style="color:#9ce6ff" href="${esc(target)}">Continue</a></p></body></html>`);
}));
module.exports = router;
