#!/usr/bin/env bash
# CROWNEV — build & restart (run as root or crownev user with sudo for pm2 startup)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
APP_USER="${APP_USER:-crownev}"

run_as_app() {
  if [[ "$(id -un)" == "${APP_USER}" ]]; then
    bash -lc "$*"
  else
    sudo -u "${APP_USER}" bash -lc "cd ${APP_DIR} && $*"
  fi
}

echo "==> Pull latest code"
run_as_app "git pull --ff-only origin main"

echo "==> Backend install & build"
run_as_app "cd backend && npm ci && npx prisma generate && npm run build"

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "ERROR: ${APP_DIR}/backend/.env missing. Copy deploy/env/backend.production.example first."
  exit 1
fi

echo "==> Database migrations"
run_as_app "cd backend && npx prisma migrate deploy"

echo "==> Seed (idempotent — safe to re-run)"
run_as_app "cd backend && npm run db:seed"

echo "==> Frontend install & build"
run_as_app "cd frontend && npm ci && npm run build"

echo "==> PM2 restart"
cd "${APP_DIR}/backend"
if [[ "$(id -un)" == "${APP_USER}" ]]; then
  pm2 startOrReload "${APP_DIR}/deploy/ecosystem.config.cjs" --env production
  pm2 save
else
  sudo -u "${APP_USER}" pm2 startOrReload "${APP_DIR}/deploy/ecosystem.config.cjs" --env production
  sudo -u "${APP_USER}" pm2 save
fi

# Register PM2 on boot (run once as root)
if [[ "$(id -un)" == "root" ]] && ! systemctl is-enabled pm2-"${APP_USER}" >/dev/null 2>&1; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" || true
fi

nginx -t && systemctl reload nginx

echo "==> Health check"
sleep 2
curl -fsS "http://127.0.0.1:3001/health" && echo ""
echo "Deploy complete."
