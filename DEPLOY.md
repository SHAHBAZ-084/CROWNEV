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

## Auto-deploy on `git push` (GitHub Actions)

Every push to **`main`** can deploy automatically to **https://crownevcenter.com**.

### One-time setup (about 5 minutes)

**1. Generate a deploy SSH key on your PC** (do not use your personal SSH key):

```bash
ssh-keygen -t ed25519 -C "github-actions-crownev" -f ~/.ssh/crownev_deploy -N ""
```

**2. Add the public key to the VPS** (SSH as root):

```bash
ssh root@62.72.58.96
bash /var/www/crownev/deploy/setup-cicd.sh "$(cat ~/.ssh/crownev_deploy.pub)"
```

Or copy the `.pub` file to the server and run `bash setup-cicd.sh /root/crownev-github-actions.pub`.

**3. Add GitHub repository secrets**

Open **https://github.com/SHAHBAZ-084/CROWNEV/settings/secrets/actions** and create:

| Secret | Value |
|--------|--------|
| `VPS_HOST` | `62.72.58.96` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Entire contents of `~/.ssh/crownev_deploy` (private key) |
| `VPS_PORT` | `22` (optional) |

**4. Push the workflow file**

Commit and push `.github/workflows/deploy-production.yml` to `main`. The first deploy runs automatically.

### What the workflow does

1. SSH into the VPS as `root`
2. Runs `deploy/deploy-app.sh` which:
   - `git fetch` + `reset --hard origin/main`
   - `npm ci`, build backend + frontend
   - Prisma migrations + idempotent seed
   - PM2 restart + nginx reload

Parts catalog (`db:seed-parts`) is **not** run on every push (too slow). Run once manually on the server if needed.

### Manual deploy trigger

GitHub → **Actions** → **Deploy Production** → **Run workflow**.

### Private repo

If the repo is private, on the VPS as user `crownev`:

```bash
# Add a read-only deploy key in GitHub → Settings → Deploy keys, then:
sudo -u crownev ssh-keygen -t ed25519 -f /home/crownev/.ssh/github_deploy -N ""
cat /home/crownev/.ssh/github_deploy.pub   # add to GitHub Deploy keys
sudo -u crownev git -C /var/www/crownev remote set-url origin git@github.com:SHAHBAZ-084/CROWNEV.git
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

### `ERR_CONNECTION_TIMED_OUT` (browser shows IP, site never loads)

**This is not an app code bug** — nothing is answering on port 80/443 from the internet.

| Cause | Fix |
|-------|-----|
| Deploy never finished | Run `setup-vps.sh` then `deploy-app.sh` on the VPS |
| **Hostinger cloud firewall** | hPanel → VPS → **Firewall** → allow inbound **TCP 22, 80, 443** |
| SSH wrong port | Use port **22**: `ssh root@62.72.58.96` (not 443 or 1022) |
| VPS stopped | Start the VPS in hPanel |
| Nginx not running | `systemctl start nginx && systemctl status nginx` |

**Run on the VPS** (use hPanel **Browser terminal** if SSH from PC fails):

```bash
bash /var/www/crownev/deploy/diagnose.sh
cat /tmp/crownev-diagnose.txt
```

Paste that file here for help — it includes PM2 logs, nginx, and health checks.

### Other issues

| Issue | Fix |
|-------|-----|
| `502 Bad Gateway` | `pm2 logs crownev-backend` — check `.env` and Postgres |
| CORS errors | `ALLOWED_ORIGINS` must match exact site URL (https) |
| Email OTP / contact form fails | See **Email (SMTP)** below — Resend domain must be verified **or** use Hostinger mailbox SMTP |
| Uploads 404 | Ensure `backend/uploads` exists and PM2 cwd is `backend/` |
| DB connection | `sudo -u postgres psql -c '\l'` — check `crown_eve` exists |

Logs:

```bash
pm2 logs crownev-backend
tail -f /var/log/nginx/error.log
```

### Email (SMTP) — contact form, OTP, confirmations

**Symptom:** Contact form shows “Message Received” but nothing in `contact@crownevcenter.com`; OTP never arrives.

**Cause (current production):** Backend uses **Resend** with `EMAIL_FROM=contact@crownevcenter.com`, but **crownevcenter.com is not verified** in Resend. PM2 logs show:

`550 The crownevcenter.com domain is not verified`

**Fix A — Hostinger mailbox SMTP (recommended)** — you already have `contact@crownevcenter.com` in Hostinger Mail:

1. hPanel → **Emails** → `contact@crownevcenter.com` → note the mailbox password (or reset it).
2. On the VPS:

```bash
bash /var/www/crownev/deploy/configure-hostinger-email.sh 'YOUR_MAILBOX_PASSWORD'
```

3. Test: `cd /var/www/crownev/backend && npm run email:test -- contact@crownevcenter.com`

**Fix B — Resend with verified domain**

1. Add **crownevcenter.com** at [resend.com/domains](https://resend.com/domains).
2. Add the DNS records (TXT/MX) in Hostinger → **DNS** for `crownevcenter.com`.
3. Wait until Resend shows **Verified**, then set in `backend/.env`:

```env
SMTP_HOST="smtp.resend.com"
SMTP_USER="resend"
SMTP_PASS="re_..."
EMAIL_FROM="contact@crownevcenter.com"
CONTACT_INBOX_EMAIL="contact@crownevcenter.com"
```

4. `pm2 restart crownev-backend --update-env`

**Note:** Resend sandbox (`onboarding@resend.dev`) only delivers to the Resend account owner email until a domain is verified — not suitable for customer OTP or contact confirmations.
