# GoDaddy cPanel Deployment Guide: Fixing "Site Status: Gateway Error"

If your GoDaddy Node.js app reports **"Site status: Gateway error"** (or returns a `502 / 503 Bad Gateway`), the Node.js application process is crashing or failing to bind to GoDaddy's Phusion Passenger reverse proxy on startup.

Follow this checklist to resolve the error.

---

## 1. Why "Gateway Error" Happens on GoDaddy

There are 5 primary causes for this in cPanel:

1. **Missing Root `app.js`**: GoDaddy cPanel's "Setup Node.js App" looks for `app.js` in your root application folder by default. *(We have now added `app.js` to the root of the repository).*
2. **Missing `node_modules` (NPM packages not installed)**: When cloning via Git, packages (`express`, `mysql2`, etc.) are not included. If you haven't clicked **Run NPM Install**, Node crashes with `Cannot find module 'express'`.
3. **Database Dialect (GoDaddy has MySQL, NOT PostgreSQL)**: GoDaddy shared hosting only supports MySQL. If you don't set `DB_DIALECT=mysql` and `MYSQL_URL`, the app attempts to connect to `postgres://localhost:5432`, fails with `ECONNREFUSED`, and exits.
4. **Missing Environment Variables in Production Mode**: In `NODE_ENV=production`, `server/src/config.js` guards against unsafe setups and halts if `SERVER_SECRET`, `SMTP_URL`, or `APP_URL` are missing.
5. **Node.js Version Too Old**: GoDaddy defaults some accounts to Node.js 14 or 16. ZKSurvey requires **Node.js 18.x or 20.x**.

---

## 2. Step-by-Step GoDaddy cPanel Configuration

### Step A: Create a MySQL Database in cPanel
1. Log in to your **GoDaddy cPanel**.
2. Under **Databases**, open **MySQL Databases**.
3. Create a new database: e.g. `zksurvey` (cPanel full name: `cpaneluser_zksurvey`).
4. Create a MySQL user and a strong password (e.g. `cpaneluser_zkusr`).
5. Add the user to the database and grant **ALL PRIVILEGES**.

---

### Step B: Configure the Node.js Application in cPanel
1. In cPanel, navigate to **Software** &rarr; **Setup Node.js App**.
2. Click **Create Application** (or Edit your existing one).
3. Set the following fields:
   - **Node.js version**: Choose **20.x** (or **18.x** minimum).
   - **Application mode**: Set to **Development** during first setup (switch to **Production** after everything is verified).
   - **Application root**: Path where your repo is cloned (e.g. `zksurvey` or `public_html`).
   - **Application URL**: Your domain or subdomain (e.g. `survey.yourdomain.com`).
   - **Application startup file**: `app.js`
4. Under **Environment variables**, click **Add Variable** and add:

| Name | Value | Description |
|---|---|---|
| `DB_DIALECT` | `mysql` | Directs ZKSurvey to run MySQL dialect |
| `MYSQL_URL` | `mysql://user:password@localhost:3306/dbname` | Replace with your GoDaddy cPanel MySQL credentials |
| `APP_URL` | `https://yourdomain.com` | Your public HTTPS domain |
| `SERVER_SECRET` | *(Random 32+ characters)* | e.g. generate from any password generator |
| `SMTP_URL` | `smtp://user@domain.com:pass@mail.domain.com:587` | Your GoDaddy or external email SMTP |
| `MAIL_FROM` | `ZKSurvey <no-reply@yourdomain.com>` | Verified sender address |
| `PAYMENT_MODE` | `both` (or `upi`) | Indian UPI QR payments & Razorpay |
| `UPI_ID` | `zkandhavel@oksbi` | Your business UPI ID |
| `UPI_NAME` | `ZK Software` | Business payee name |

5. Click **Save** at the top right.

---

### Step C: Run NPM Install
1. In the same cPanel **Setup Node.js App** screen, click **Run NPM Install**.
2. Wait 1–2 minutes until the success notification appears.
3. *Alternative via Terminal:* If you have SSH / cPanel Terminal access, enter the virtual environment command shown at the top of the cPanel page, then run:
   ```bash
   npm install --omit=dev
   ```

---

### Step D: Restart the Application
1. Click the **Restart** button in the cPanel Node.js interface.
2. Click the **Open URL** link.
3. Check `https://yourdomain.com/healthz` — it should return:
   ```json
   { "ok": true, "build": "v13.1", "phase": "7.1" }
   ```

---

## 3. How to View the Error Log if it Still Fails

If "Gateway error" persists:
1. Open cPanel **File Manager**.
2. Go to your application root folder (e.g. `public_html` or `zksurvey`).
3. Look for files named:
   - `stderr.log`
   - `passenger.log`
4. View the last 20 lines — it will show the exact line causing the crash (e.g., MySQL access denied, port binding, or missing dependency).
