'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const rid = (p, n = 9) => p + '_' + crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, 'x').slice(0, n).toLowerCase();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$16384$' + salt.toString('base64') + '$' + h.toString('base64');
}
async function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const h = await scrypt(pw, Buffer.from(salt, 'base64'), 64, { N: parseInt(n, 10), r: 8, p: 1 });
  const b = Buffer.from(hash, 'base64');
  return b.length === h.length && crypto.timingSafeEqual(b, h);
}
const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password needs at least one letter and one number.';
  return '';
}
class HttpError extends Error { constructor(status, code, message) { super(message || code); this.status = status; this.code = code; } }
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
module.exports = { rid, sha256, token, hashPassword, verifyPassword, validEmail, passwordProblem, HttpError, wrap, clip };
