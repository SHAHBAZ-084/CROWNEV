#!/usr/bin/env bash
# Full hosting audit — run on VPS as root: bash /var/www/crownev/deploy/hosting-audit.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
REPORT="/tmp/crownev-hosting-audit.txt"

{
  echo "=== CROWNEV HOSTING AUDIT $(date -Is) ==="
  echo ""
  echo "--- Identity ---"
  hostname
  curl -4 -s --connect-timeout 5 ifconfig.me 2>/dev/null && echo " (public IPv4)"
  echo ""
  echo "--- systemd ---"
  for s in nginx postgresql docker; do
    printf "%-14s %s\n" "$s:" "$(systemctl is-active "$s" 2>/dev/null || echo n/a)"
  done
  echo ""
  echo "--- PM2 ---"
  pm2 status 2>/dev/null || echo "pm2 not available"
  echo ""
  echo "--- Listening (22, 80, 443, 3001, 5432) ---"
  ss -tlnp | grep -E ':22 |:80 |:443 |:3001 |:5432 ' || echo "(no matches)"
  echo ""
  echo "--- HTTP checks ---"
  curl -fsS -o /dev/null -w "127.0.0.1:3001/health → %{http_code}\n" http://127.0.0.1:3001/health || echo "API health FAILED"
  curl -fsS -o /dev/null -w "127.0.0.1/ → %{http_code}\n" http://127.0.0.1/ || echo "nginx root FAILED"
  curl -fsS -o /dev/null -w "Host crownevcenter.com → %{http_code}\n" -H "Host: crownevcenter.com" http://127.0.0.1/ || echo "domain vhost FAILED"
  PUB_IP="$(curl -4 -s --connect-timeout 5 ifconfig.me 2>/dev/null || true)"
  if [[ -n "$PUB_IP" ]]; then
    curl -fsS -o /dev/null -w "http://${PUB_IP}/ → %{http_code}\n" --connect-timeout 5 "http://${PUB_IP}/" || echo "curl to public IP from server FAILED"
  fi
  echo ""
  echo "--- Nginx ---"
  nginx -t 2>&1
  grep -E '^\s*(listen|server_name)' /etc/nginx/sites-enabled/crownev 2>/dev/null | head -6
  echo ""
  echo "--- UFW ---"
  ufw status verbose 2>/dev/null | head -20
  echo ""
  echo "--- Backend .env (non-secret keys) ---"
  if [[ -f "$APP_DIR/backend/.env" ]]; then
    grep -E '^(NODE_ENV|PORT|APP_URL|ALLOWED_ORIGINS|EMAIL_FROM|CONTACT_INBOX)=' "$APP_DIR/backend/.env" || true
  else
    echo "MISSING $APP_DIR/backend/.env"
  fi
  echo ""
  echo "--- Frontend ---"
  ls -la "$APP_DIR/frontend/dist/index.html" 2>&1 || echo "frontend dist MISSING — run deploy-app.sh"
  echo ""
  echo "--- PM2 logs (last 20, no stream) ---"
  pm2 logs crownev-backend --lines 20 --nostream 2>/dev/null || true
  echo ""
  echo "--- Security notes ---"
  grep -r '^Port' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || echo "sshd: default port 22"
  ss -tlnp | grep ':5432' || true
  echo ""
  echo "--- Resources ---"
  df -h / | tail -1
  free -h | head -2
  echo ""
  echo "=== END ==="
} | tee "$REPORT"

echo ""
echo "Saved: $REPORT"
