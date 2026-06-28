#!/usr/bin/env bash
# Fix ERR_SSL_PROTOCOL_ERROR: free port 443 from SSH, install Let's Encrypt cert for nginx
# Run on VPS as root: bash /var/www/crownev/deploy/fix-ssl.sh [email]
set -euo pipefail

DOMAIN="${DOMAIN:-crownevcenter.com}"
EMAIL="${1:-contact@${DOMAIN}}"
NGINX_SITE="/etc/nginx/sites-available/crownev"

echo "==> CROWNEV SSL fix for ${DOMAIN}"

echo "--- Step 1: What is listening on 443? ---"
ss -tlnp | grep ':443 ' || echo "(nothing on 443 yet)"

echo "--- Step 2: Remove SSH from port 443 (common Hostinger misconfig) ---"
mkdir -p /etc/ssh/sshd_config.d
# Drop Hostinger/custom multi-port lines that steal 443 from HTTPS
for f in /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf; do
  [[ -f "$f" ]] || continue
  if grep -qE '^Port\s+(443|1022)' "$f" 2>/dev/null; then
    cp -a "$f" "${f}.bak.$(date +%s)"
    sed -i '/^Port 443/d;/^Port 1022/d' "$f" || true
    echo "Patched: $f"
  fi
done
# Ensure SSH only on 22
if ! grep -rq '^Port 22' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null; then
  echo 'Port 22' > /etc/ssh/sshd_config.d/99-crownev-ssh.conf
fi
grep -r '^Port' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || true
sshd -t
systemctl restart sshd
echo "sshd restarted (SSH should stay on port 22 only)"

echo "--- Step 3: Ensure nginx site exists with domain ---"
if [[ ! -f "$NGINX_SITE" ]]; then
  echo "Missing $NGINX_SITE — copy from repo deploy/nginx/crownev.conf first"
  exit 1
fi
if ! grep -q "${DOMAIN}" "$NGINX_SITE"; then
  sed -i "s/server_name .*/server_name ${DOMAIN} www.${DOMAIN} 62.72.58.96;/" "$NGINX_SITE" || true
fi
nginx -t
systemctl reload nginx

echo "--- Step 4: Install certbot if needed ---"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx
fi

echo "--- Step 5: Obtain SSL certificate ---"
certbot --nginx \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  -m "${EMAIL}" \
  --redirect

echo "--- Step 6: Verify ---"
ss -tlnp | grep -E ':443 |:80 ' || true
curl -fsS -o /dev/null -w "https://${DOMAIN}/ → %{http_code}\n" "https://${DOMAIN}/" || echo "local curl https check failed (DNS from server may differ)"

echo ""
echo "Done. Test in browser: https://${DOMAIN}"
echo "If certbot failed, paste full output — check DNS A records point to this server."
