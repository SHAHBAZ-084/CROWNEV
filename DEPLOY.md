# CROWNEV — Production deploy (Hostinger KVM2 / Ubuntu)

Target stack: **Nginx** → **React static** + **Express API (PM2)** + **PostgreSQL 16**

| Item | Value |
|------|--------|
| VPS IP | `62.72.58.96` |
| Domain | `crownevcenter.com` |
| App path | `/var/www/crownev` |
| API port | `3001` (internal only) |

---

## Before you start

1. In **Hostinger hPanel → VPS → SSH access** — confirm SSH is enabled.
2. Point DNS **A records** for `@` and `www` to `62.72.58.96`.
3. Have **Resend API key** ready (SMTP) after domain verification.
4. **Change the root password** after first login (never share it in chat).

---

## Step 1 — SSH into the VPS

From your PC (PowerShell or terminal):

```bash
ssh root@62.72.58.96
```

If connection times out, check Hostinger firewall / SSH toggle in hPanel.

---

## Step 2 — Bootstrap the server (once)

```bash
apt-get update && apt-get install -y git
git clone https://github.com/SHAHBAZ-084/CROWNEV.git /var/www/crownev
bash /var/www/crownev/deploy/setup-vps.sh crownevcenter.com
```

This installs Node 20, PostgreSQL 16, Nginx, PM2, UFW, clones the repo, and creates the database user.

DB password is saved to `/root/crownev-db-password.txt` (root only).

---

## Step 3 — Configure environment

```bash
cp /var/www/crownev/deploy/env/backend.production.example /var/www/crownev/backend/.env
nano /var/www/crownev/backend/.env
```

Set at minimum:

| Variable | How to set |
|----------|------------|
| `DATABASE_URL` | Use password from `/root/crownev-db-password.txt` |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `SMTP_PASS` | Your Resend API key |
| `ALLOWED_ORIGINS` | `https://crownevcenter.com,https://www.crownevcenter.com` |

Optional frontend env:

```bash
cp /var/www/crownev/deploy/env/frontend.production.example /var/www/crownev/frontend/.env.production
```

---

## Step 4 — Deploy the app

```bash
bash /var/www/crownev/deploy/deploy-app.sh
```

This runs migrations, seed, builds frontend/backend, and starts PM2.

Verify:

```bash
curl http://127.0.0.1:3001/health
curl -I http://crownevcenter.com
```

---

## Step 5 — SSL (HTTPS)

After DNS propagates:

```bash
certbot --nginx -d crownevcenter.com -d www.crownevcenter.com
```

Certbot updates Nginx automatically. Renewals are scheduled via systemd timer.

---

## Step 6 — Security hardening

```bash
# SSH key login (on your PC)
ssh-copy-id root@62.72.58.96

# On VPS — disable password login after keys work
nano /etc/ssh/sshd_config   # PasswordAuthentication no
systemctl restart sshd

passwd   # set a new strong root password
```

Create a non-root deploy user (optional):

```bash
adduser deploy
usermod -aG sudo deploy
```

---

## Updates (re-deploy)

```bash
bash /var/www/crownev/deploy/deploy-app.sh
```

---

## Demo logins (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@crown-eve.com` | `Admin@123` |
| Branch owner | `owner.hadi@crown-eve.com` | `Owner@123` |

Change these passwords immediately in production.

---

## Optional — parts catalog import

Large import (~1,300 parts); run once after deploy:

```bash
sudo -u crownev bash -lc 'cd /var/www/crownev/backend && npm run db:seed-parts'
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `502 Bad Gateway` | `pm2 logs crownev-api` — check `.env` and Postgres |
| CORS errors | `ALLOWED_ORIGINS` must match exact site URL (https) |
| Email OTP fails | Verify domain in Resend; set `EMAIL_FROM` |
| Uploads 404 | Ensure `backend/uploads` exists and PM2 cwd is `backend/` |
| DB connection | `sudo -u postgres psql -c '\l'` — check `crown_eve` exists |

Logs:

```bash
pm2 logs crownev-api
tail -f /var/log/nginx/error.log
```
