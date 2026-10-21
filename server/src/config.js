'use strict';
const env = process.env;
const prod = env.NODE_ENV === 'production';
// Support discrete MySQL env variables (common in cPanel / shared hosting)
const mysqlHost = env.MYSQL_HOST || env.DB_HOST || '127.0.0.1';
const mysqlPort = env.MYSQL_PORT || env.DB_PORT || '3306';
const mysqlUser = env.MYSQL_USER || env.DB_USER;
const mysqlPass = env.MYSQL_PASSWORD || env.MYSQL_PASS || env.DB_PASSWORD || env.DB_PASS || '';
const mysqlDb = env.MYSQL_DATABASE || env.MYSQL_DB || env.DB_NAME;

let dbUrl = env.MYSQL_URL || env.DATABASE_URL;
let isMySql = env.DB_DIALECT === 'mysql' || /^mysql(2)?:/i.test(dbUrl || '') || !!env.MYSQL_URL;

if (!dbUrl && (mysqlUser && mysqlDb)) {
  dbUrl = `mysql://${encodeURIComponent(mysqlUser)}:${encodeURIComponent(mysqlPass)}@${mysqlHost}:${mysqlPort}/${mysqlDb}`;
  isMySql = true;
}

if (!dbUrl) {
  if (env.DB_DIALECT === 'mysql') {
    dbUrl = 'mysql://root:@127.0.0.1:3306/zksurvey';
    isMySql = true;
  } else {
    dbUrl = 'postgres://zk:zk@localhost:5432/zksurvey';
  }
}

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
