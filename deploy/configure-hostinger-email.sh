#!/usr/bin/env bash
# Configure CROWNEV production email via Hostinger mailbox SMTP.
# Usage (on VPS as root):
#   bash /var/www/crownev/deploy/configure-hostinger-email.sh 'YOUR_MAILBOX_PASSWORD'
#
# Uses contact@crownevcenter.com by default. Override with:
#   MAILBOX=info@crownevcenter.com bash ... 'password'
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
ENV_FILE="${APP_DIR}/backend/.env"
MAILBOX="${MAILBOX:-contact@crownevcenter.com}"
PASS="${1:-}"

if [[ -z "$PASS" ]]; then
  echo "Usage: $0 'mailbox-password'"
  echo "Example: $0 'MySecureEmailPass123'"
  echo ""
  echo "Get the password from Hostinger → Emails → ${MAILBOX} → Configuration."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — deploy the app first."
  exit 1
fi

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"

set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$ENV_FILE"
  else
    echo "${key}=\"${val}\"" >> "$ENV_FILE"
  fi
}

set_env SMTP_HOST "smtp.hostinger.com"
set_env SMTP_PORT "465"
set_env SMTP_USER "contact@crownevcenter.com"
set_env SMTP_PASS "$PASS"
set_env EMAIL_FROM "contact@crownevcenter.com"
set_env CONTACT_INBOX_EMAIL "contact@crownevcenter.com"
set_env BOOKING_SMTP_USER "info@crownevcenter.com"
set_env BOOKING_EMAIL_FROM "info@crownevcenter.com"
set_env BOOKING_SMTP_PASS "$PASS"

echo "Updated $ENV_FILE for Hostinger SMTP (contact@ + info@ booking)."
echo "Testing delivery..."

cd "${APP_DIR}/backend"
npm run email:test -- "$MAILBOX" || {
  echo ""
  echo "SMTP test failed. Check the mailbox password in Hostinger hPanel."
  echo "Restore backup: ls ${ENV_FILE}.bak.*"
  exit 1
}

pm2 restart crownev-backend --update-env
echo "Done — crownev-backend restarted. OTP/contact use contact@; bookings use info@."
