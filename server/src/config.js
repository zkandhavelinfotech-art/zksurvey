'use strict';
const env = process.env;
const prod = env.NODE_ENV === 'production';
const dbUrl = env.MYSQL_URL || env.DATABASE_URL || 'postgres://zk:zk@localhost:5432/zksurvey';
const isMySql = env.DB_DIALECT === 'mysql' || /^mysql(2)?:/i.test(dbUrl) || !!env.MYSQL_URL;

const cfg = {
  prod,
  port: /^\d+$/.test(String(env.PORT || '3000').trim()) ? parseInt(env.PORT || '3000', 10) : (env.PORT || '3000'),
  dbDialect: isMySql ? 'mysql' : 'postgres',
  databaseUrl: dbUrl,
  appUrl: (env.APP_URL || 'http://localhost:' + (env.PORT || '3000')).replace(/\/$/, ''),
  sessionDays: parseInt(env.SESSION_DAYS || '14', 10),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : prod,
  trustProxy: env.TRUST_PROXY || (prod ? '1' : ''),
  serverSecret: env.SERVER_SECRET || 'dev-only-secret-change-me',
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || 'ZKSurvey <no-reply@zksurvey.local>',
  devOutbox: env.DEV_OUTBOX ? env.DEV_OUTBOX === 'true' : !prod,
  paymentMode: env.PAYMENT_MODE || (prod ? 'both' : 'mock'), // 'mock' | 'razorpay' | 'upi' | 'both'
  upi: {
    id: env.UPI_ID || 'zksoftware@upi',
    payeeName: env.UPI_PAYEE_NAME || env.SELLER_NAME || 'Zlandavel Infotech Pvt Ltd'
  },
  autoApproveUpi: env.AUTO_APPROVE_UPI ? env.AUTO_APPROVE_UPI === 'true' : !prod,
  razorpay: { keyId: env.RAZORPAY_KEY_ID || '', keySecret: env.RAZORPAY_KEY_SECRET || '', webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '' },
  gstRate: parseFloat(env.GST_RATE || '18'),
  seller: {
    name: env.SELLER_NAME || 'Zlandavel Infotech Pvt Ltd',
    gstin: env.SELLER_GSTIN || '',
    state: env.SELLER_STATE || 'Tamil Nadu',
    address: env.SELLER_ADDRESS || 'Chennai, Tamil Nadu, India',
    sac: env.SELLER_SAC || '998439'
  },
  superEmail: env.SUPER_EMAIL || '',
  superPassword: env.SUPER_PASSWORD || '',
  super2FA: env.SUPER_2FA === 'false' ? false : true,
  super2FASecret: env.SUPER_2FA_SECRET || ''
};
if (prod) {
  const bad = [];
  if (cfg.serverSecret === 'dev-only-secret-change-me') bad.push('SERVER_SECRET must be set');
  if (cfg.paymentMode === 'mock') bad.push('PAYMENT_MODE=mock is not allowed in production');
  if (['razorpay', 'both'].includes(cfg.paymentMode) && (!cfg.razorpay.keyId || !cfg.razorpay.keySecret)) {
    // If only UPI is intended, user can set PAYMENT_MODE=upi
    if (cfg.paymentMode === 'razorpay') bad.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are required when PAYMENT_MODE=razorpay');
  }
  if (!cfg.smtpUrl) bad.push('SMTP_URL is required (verification and reset emails)');
  if (!/^https:/.test(cfg.appUrl)) bad.push('APP_URL must be https://');
  if (bad.length) { throw new Error('Unsafe production configuration:\n - ' + bad.join('\n - ')); }
}
module.exports = cfg;
