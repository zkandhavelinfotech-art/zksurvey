'use strict';
const cfg = require('./config');
const { q } = require('./db');
let transport = null;
function getTransport() {
  if (transport || !cfg.smtpUrl) return transport;
  transport = require('nodemailer').createTransport(cfg.smtpUrl);
  return transport;
}
/* Every message is written to mail_outbox first; delivery failure never breaks the request. */
async function sendMail(to, subject, body) {
  const { rows } = await q('insert into mail_outbox(to_email,subject,body) values ($1,$2,$3) returning id', [to, subject, body]);
  const id = rows[0].id;
  const t = getTransport();
  if (!t) { if (!cfg.prod) console.log(JSON.stringify({ level: 'info', msg: 'mail (no SMTP, outbox only)', to, subject })); return; }
  try { await t.sendMail({ from: cfg.mailFrom, to, subject, text: body }); await q('update mail_outbox set sent_at=now() where id=$1', [id]); }
  catch (e) { await q('update mail_outbox set error=$2 where id=$1', [id, String(e.message).slice(0, 300)]); console.error(JSON.stringify({ level: 'error', msg: 'mail failed', to, err: e.message })); }
}
const verifyMail = (name, link) => ['Verify your ZKSurvey email', `Hi ${name},\n\nConfirm your email to publish surveys and subscribe to a plan:\n${link}\n\nThe link is valid for 24 hours. If you did not create this account, ignore this message.\n\n— ZKSurvey (Zlandavel Infotech Pvt Ltd, Chennai)`];
const resetMail = (name, link) => ['Reset your ZKSurvey password', `Hi ${name},\n\nUse this link to choose a new password:\n${link}\n\nIt is valid for 1 hour and works once. If you did not ask for this, ignore this message — your password is unchanged.\n\n— ZKSurvey`];
module.exports = { sendMail, verifyMail, resetMail };
