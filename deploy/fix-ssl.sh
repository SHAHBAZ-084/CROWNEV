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

echo "--- Step 2: Remove SSH from port 443 and 1022 (supporting leading whitespace/tabs) ---"
mkdir -p /etc/ssh/sshd_config.d /etc/systemd/system/ssh.socket.d
# Recursively find ssh configuration files and patch any Port 443 or Port 1022 definition
find /etc/ssh -type f | while read -r f; do
  [[ -f "$f" ]] || continue
  if grep -qiE '^\s*port\s+(443|1022)' "$f" 2>/dev/null; then
    cp -a "$f" "${f}.bak.$(date +%s)"
    # Comment out Port 443 and Port 1022
    sed -i -E 's/^(\s*[Pp]ort\s+(443|1022))/## \1/g' "$f" || true
    echo "Patched: $f"
  fi
done
echo 'Port 22' > /etc/ssh/sshd_config.d/99-crownev-ssh.conf

# Clean up any old 99-crownev drop-in files to prevent duplicate/conflicting configurations
rm -f /etc/systemd/system/ssh.socket.d/99-crownev.conf
rm -f /etc/systemd/system/ssh.socket.d/99-crownev-ssl.conf

# Prevent ssh.socket generator from re-adding extra ports.
# Naming it zz-crownev-override.conf ensures it loads AFTER Hostinger's addresses.conf
# because systemd processes drop-in files alphabetically (numbers come before letters).
cat > /etc/systemd/system/ssh.socket.d/zz-crownev-override.conf << 'EOF'
[Socket]
ListenStream=
ListenStream=0.0.0.0:22
ListenStream=[::]:22
EOF
grep -riE '^\s*port' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || true
sshd -t
systemctl daemon-reload
systemctl restart ssh.socket ssh
sleep 2
ss -tlnp | grep -E ':443 |:22 ' || true
echo "sshd should be on 22 only; 443 must be free for nginx"

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
