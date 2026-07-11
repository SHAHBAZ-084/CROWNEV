#!/usr/bin/env bash
# CROWNEV — build & restart (run as root or crownev user with sudo for pm2 startup)
# Env: RUN_DB_SEED=1|0 (default 1), RUN_PARTS_SEED=1|0 (default 0 — slow, run manually once)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
APP_USER="${APP_USER:-crownev}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
RUN_DB_SEED="${RUN_DB_SEED:-0}"
RUN_PARTS_SEED="${RUN_PARTS_SEED:-0}"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  APP_USER="root"
fi

run_as_app() {
  if [[ "$(id -un)" == "${APP_USER}" ]]; then
    bash -lc "cd ${APP_DIR} && $*"
  else
    sudo -u "${APP_USER}" bash -lc "cd ${APP_DIR} && $*"
  fi
}

echo "==> CROWNEV deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Pull latest code (${DEPLOY_BRANCH})"
run_as_app "git fetch origin ${DEPLOY_BRANCH} && git reset --hard origin/${DEPLOY_BRANCH}"
chmod +x "${APP_DIR}/deploy/deploy-app.sh" "${APP_DIR}/deploy/poll-deploy.sh" 2>/dev/null || true

echo "==> Backend install & build"
run_as_app "cd backend && npm ci && npx prisma generate && npm run build"

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "ERROR: ${APP_DIR}/backend/.env missing. Copy deploy/env/backend.production.example first."
  exit 1
fi

echo "==> Database migrations"
if [[ -f "${APP_DIR}/backend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${APP_DIR}/backend/.env"
  set +a
fi
if [[ -n "${DATABASE_URL:-}" ]] && psql "${DATABASE_URL}" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations'" 2>/dev/null | grep -q 1; then
  run_as_app "cd backend && npx prisma migrate deploy"
else
  echo "Skipping prisma migrate deploy (existing DB without _prisma_migrations — schema already applied)"
fi

if [[ "${RUN_DB_SEED}" == "1" ]]; then
  echo "==> Seed (idempotent)"
  run_as_app "cd backend && npm run db:seed"
else
  echo "==> Skipping db:seed (RUN_DB_SEED=0)"
fi

if [[ "${RUN_PARTS_SEED}" == "1" ]]; then
  echo "==> Parts catalog seed (~1300 items, may take a few minutes)"
  run_as_app "cd backend && npm run db:seed-parts"
fi

echo "==> Frontend install & build"
run_as_app "cd frontend && rm -rf dist && NODE_ENV=development npm ci && npm run build"

# ffmpeg-static (dev-only video scripts) downloads ~28MB per npm ci into root cache and never prunes it
rm -rf /root/.cache/ffmpeg-static-nodejs 2>/dev/null || true
if [[ "$(id -un)" != "root" ]]; then
  rm -rf "/home/${APP_USER}/.cache/ffmpeg-static-nodejs" 2>/dev/null || true
fi

echo "==> Frontend dist permissions (nginx runs as www-data)"
chmod -R a+rX "${APP_DIR}/frontend/dist"
find "${APP_DIR}/frontend/dist" -type d -exec chmod 755 {} + 2>/dev/null || true
chown -R root:www-data "${APP_DIR}/frontend/dist" 2>/dev/null || chown -R "${APP_USER}:www-data" "${APP_DIR}/frontend/dist" 2>/dev/null || true

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
