#!/usr/bin/env bash
# CROWNEV — one-time Hostinger KVM2 / Ubuntu VPS bootstrap (run as root)
# Usage: bash setup-vps.sh [domain] [git-repo-url]
set -euo pipefail

DOMAIN="${1:-crownevcenter.com}"
REPO="${2:-https://github.com/SHAHBAZ-084/CROWNEV.git}"
APP_USER="crownev"
APP_DIR="/var/www/crownev"
DB_NAME="crown_eve"
DB_USER="crownev"
NODE_MAJOR=20

echo "==> CROWNEV VPS setup — domain: ${DOMAIN}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw fail2ban \
  build-essential ca-certificates gnupg lsb-release

# Node.js LTS
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

# PostgreSQL 16
if ! command -v psql >/dev/null 2>&1; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-16 postgresql-client-16
fi

# App user + directories
id -u "${APP_USER}" >/dev/null 2>&1 || useradd -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}" /var/log/crownev
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" /var/log/crownev

# Database (random password written to root-only file)
DB_PASS_FILE="/root/crownev-db-password.txt"
if [[ ! -f "${DB_PASS_FILE}" ]]; then
  DB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
  echo "${DB_PASS}" > "${DB_PASS_FILE}"
  chmod 600 "${DB_PASS_FILE}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
  echo "Database password saved to ${DB_PASS_FILE}"
else
  DB_PASS="$(cat "${DB_PASS_FILE}")"
  echo "Using existing DB password from ${DB_PASS_FILE}"
fi

# Clone app (first time)
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git clone "${REPO}" "${APP_DIR}"
fi

# Placeholder frontend so nginx can start before first deploy build
mkdir -p "${APP_DIR}/frontend/dist"
if [[ ! -f "${APP_DIR}/frontend/dist/index.html" ]]; then
  echo '<!DOCTYPE html><html><body><h1>CROWNEV</h1><p>Deploy in progress. Run: bash /var/www/crownev/deploy/deploy-app.sh</p></body></html>' \
    > "${APP_DIR}/frontend/dist/index.html"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/frontend/dist"
fi

# Firewall — Hostinger also has a cloud firewall in hPanel; open 22, 80, 443 there too
ufw allow OpenSSH
ufw allow 22/tcp
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Nginx site
sed "s/__DOMAIN__/${DOMAIN}/g" "${APP_DIR}/deploy/nginx/crownev.conf" \
  > "/etc/nginx/sites-available/crownev"
ln -sf /etc/nginx/sites-available/crownev /etc/nginx/sites-enabled/crownev
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "=============================================="
echo "Bootstrap complete."
echo "Next steps (as root):"
echo "  1. Create ${APP_DIR}/backend/.env from deploy/env/backend.production.example"
echo "  2. Set JWT_SECRET, SMTP_PASS, DATABASE_URL password from ${DB_PASS_FILE}"
echo "  3. Run: bash ${APP_DIR}/deploy/deploy-app.sh"
echo "  4. Point DNS A record for ${DOMAIN} and www.${DOMAIN} to this server IP"
echo "  5. Run: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo "  6. Change root password and use SSH keys only"
echo "=============================================="
