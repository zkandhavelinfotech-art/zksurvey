# Railway Deployment Guide: ZKSurvey v13.1 (MySQL 8.0+ & Node.js)

This guide provides step-by-step instructions for deploying ZKSurvey to **Railway** using a managed **MySQL** database instead of PostgreSQL.

---

## 1. Why MySQL on Railway?
- Railway offers managed MySQL 8.0 instances with 1-click provisioning.
- Connection pooling and auto-restarts are handled natively.
- ZKSurvey v13.1 features a dialect translation layer in `server/src/db.js` that automatically executes parameter conversions (`?` vs `$N`), type casts, row normalization, and migrations for MySQL 8.0+.

---

## 2. Step-by-Step Railway Deployment

### Step A: Provision MySQL on Railway
1. Log in to [Railway](https://railway.app/).
2. Create a **New Project** (or open your existing project).
3. Click **+ New** &rarr; **Database** &rarr; **Add MySQL**.
4. Railway will create a MySQL 8 container with persistent volume storage.

### Step B: Connect ZKSurvey GitHub Repository
1. In the same Railway project, click **+ New** &rarr; **GitHub Repo**.
2. Select your repository: `zkandhavelinfotech-art/zksurvey`.
3. Set the branch to `main`.

### Step C: Configure Environment Variables
In your ZKSurvey service settings on Railway, navigate to the **Variables** tab and configure:

| Variable | Recommended Value / Reference | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security guards |
| `PORT` | `3000` | Railway maps this to your public domain |
| `DB_DIALECT` | `mysql` | Directs ZKSurvey to run MySQL dialect |
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` | Uses Railway's reference variable to the MySQL service |
| `APP_URL` | `https://your-app.up.railway.app` | Your generated Railway domain (or custom domain) |
| `TRUST_PROXY` | `true` | Required behind Railway reverse proxy |
| `SERVER_SECRET` | *(64-char random hex)* | `openssl rand -hex 32` |
| `SUPER_EMAIL` | `admin@yourdomain.com` | First super administrator |
| `SUPER_PASSWORD` | *(Strong temporary password)* | Remove after first successful login |
| `SUPER_2FA` | `true` | Enforces 6-digit email OTP for super admin |
| `SMTP_URL` | `smtps://user:pass@smtp.mailersend.net:465` | Required for password resets and 2FA OTP |
| `MAIL_FROM` | `ZKSurvey <no-reply@yourdomain.com>` | Verified sender address |
| `PAYMENT_MODE` | `both` (or `upi`) | Supports UPI QR codes + Razorpay |
| `UPI_ID` | `zkandhavel@oksbi` | Business UPI ID for Google Pay / PhonePe |
| `UPI_NAME` | `ZK Software` | Business payee name |
| `AUTO_APPROVE_UPI` | `false` | Super admin reviews UTR in Platform dashboard |
| `SELLER_NAME` | `Zkandhavel Infotech Pvt Ltd` | Appears on GST invoices |
| `SELLER_GSTIN` | `33AAAAA0000A1Z5` | Registered GST number |
| `SELLER_STATE` | `Tamil Nadu` | Registered state |

### Step D: Build & Deploy Settings
Under **Settings** &rarr; **Deploy**:
- **Build Command**: `npm install`
- **Pre-deploy / Custom Start Command**:
  ```bash
  npm run migrate && npm run create-super && npm start
  ```
  *(ZKSurvey also automatically runs pending migrations in `server/migrations/mysql/*.sql` on startup if `npm start` is executed directly).*

---

## 3. Verifying the Deployment

1. Check the Railway deploy log:
   ```
   [db] dialect: mysql
   [migrate] applying mysql migration 001_init.sql
   [migrate] applying mysql migration 002_upi_and_2fa.sql
   [migrate] applying mysql migration 003_pricing_update.sql
   [boot] listening on port 3000 (production)
   ```
2. Open `https://<your-railway-app>.up.railway.app/healthz`.
   Expected response:
   ```json
   { "ok": true, "build": "v13.1", "phase": "7.1" }
   ```
3. Navigate to `https://<your-railway-app>.up.railway.app/login.html` and sign in with `SUPER_EMAIL` and `SUPER_PASSWORD`.
4. Enter the 6-digit 2FA code delivered to `SUPER_EMAIL`.
5. Access the **Platform Overview** at `/admin/platform.html` to manage accounts, plans, and pending UPI payments.
