#!/usr/bin/env bash
# Run ON the VPS (root) when the site does not load — prints a diagnostic report
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
REPORT="/tmp/crownev-diagnose.txt"

{
  echo "=== CROWNEV diagnose $(date -Is) ==="
  echo ""
  echo "--- Network / IP ---"
  hostname -I 2>/dev/null || true
  curl -4 -s ifconfig.me 2>/dev/null && echo " (public IPv4 via ifconfig.me)" || true
  echo ""
  echo "--- Listening ports (80, 443, 3001, 22) ---"
  ss -tlnp | grep -E ':80 |:443 |:3001 |:22 ' || echo "(none matched)"
  echo ""
  echo "--- UFW ---"
  ufw status verbose 2>/dev/null || echo "ufw not active"
  echo ""
  echo "--- Nginx ---"
  systemctl is-active nginx 2>/dev/null || true
  nginx -t 2>&1 || true
  ls -la "${APP_DIR}/frontend/dist/index.html" 2>&1 || echo "MISSING: frontend dist (run deploy-app.sh)"
  echo ""
  echo "--- PM2 ---"
  sudo -u crownev pm2 status 2>/dev/null || pm2 status 2>/dev/null || echo "pm2 not running / no processes"
  echo ""
  echo "--- PM2 logs (last 40 lines) ---"
  sudo -u crownev pm2 logs crownev-backend --lines 40 --nostream 2>/dev/null || pm2 logs crownev-backend --lines 40 --nostream 2>/dev/null || true
  echo ""
  echo "--- Local health ---"
  curl -fsS -m 5 http://127.0.0.1:3001/health 2>&1 || echo "API not responding on :3001"
  curl -fsS -m 5 -o /dev/null -w "nginx localhost HTTP %{http_code}\n" http://127.0.0.1/ 2>&1 || echo "nginx not responding on :80"
  echo ""
  echo "--- Backend .env ---"
  if [[ -f "${APP_DIR}/backend/.env" ]]; then
    echo "backend/.env exists"
    grep -E '^(NODE_ENV|PORT|DATABASE_URL|JWT_SECRET|ALLOWED_ORIGINS)=' "${APP_DIR}/backend/.env" | sed 's/JWT_SECRET=.*/JWT_SECRET=***/; s/DATABASE_URL=postgresql:\/\/[^:]*:[^@]*@/DATABASE_URL=postgresql:\/\/USER:***@/'
  else
    echo "MISSING ${APP_DIR}/backend/.env"
  fi
  echo ""
  echo "--- PostgreSQL ---"
  systemctl is-active postgresql 2>/dev/null || true
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='crown_eve'" 2>/dev/null || true
  echo ""
  echo "=== End ==="
} | tee "${REPORT}"

echo ""
echo "Report saved to ${REPORT}"
echo "Copy this file and send to support / paste in chat for help."
