#!/usr/bin/env bash
# One-time: prepare VPS for GitHub Actions auto-deploy (run as root on VPS)
# Usage: bash /var/www/crownev/deploy/setup-cicd.sh [path-to-github-actions-public-key]
set -euo pipefail

APP_USER="${APP_USER:-crownev}"
APP_DIR="${APP_DIR:-/var/www/crownev}"
DEPLOY_KEY="/root/crownev-github-actions.pub"

echo "==> CROWNEV CI/CD setup"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "ERROR: ${APP_DIR} is not a git repo. Run setup-vps.sh first."
  exit 1
fi

# Allow crownev user to pull from GitHub (public repo = HTTPS is fine)
sudo -u "${APP_USER}" git -C "${APP_DIR}" remote set-url origin https://github.com/SHAHBAZ-084/CROWNEV.git
sudo -u "${APP_USER}" git -C "${APP_DIR}" config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true

# Install GitHub Actions SSH public key for root (used by workflow)
PUBKEY="${1:-}"
if [[ -z "${PUBKEY}" && -f "${DEPLOY_KEY}" ]]; then
  PUBKEY="$(cat "${DEPLOY_KEY}")"
fi

if [[ -n "${PUBKEY}" ]]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  AUTH=/root/.ssh/authorized_keys
  touch "${AUTH}"
  if ! grep -qF "${PUBKEY}" "${AUTH}" 2>/dev/null; then
    echo "${PUBKEY}" >> "${AUTH}"
    echo "Added GitHub Actions key to /root/.ssh/authorized_keys"
  else
    echo "GitHub Actions key already in authorized_keys"
  fi
  chmod 600 "${AUTH}"
else
  echo ""
  echo "No deploy public key provided."
  echo "Generate on your PC:"
  echo "  ssh-keygen -t ed25519 -C github-actions-crownev -f ~/.ssh/crownev_deploy -N \"\""
  echo "Then either:"
  echo "  1) scp ~/.ssh/crownev_deploy.pub root@62.72.58.96:/root/crownev-github-actions.pub"
  echo "  2) bash setup-cicd.sh \"\$(cat ~/.ssh/crownev_deploy.pub)\""
  echo ""
  echo "Add the PRIVATE key (~/.ssh/crownev_deploy) to GitHub → Settings → Secrets → VPS_SSH_KEY"
fi

# Ensure deploy script is executable
chmod +x "${APP_DIR}/deploy/deploy-app.sh" "${APP_DIR}/deploy/setup-cicd.sh" 2>/dev/null || true

echo ""
echo "==> GitHub repository secrets (Settings → Secrets and variables → Actions)"
echo "  VPS_HOST     = 62.72.58.96"
echo "  VPS_USER     = root"
echo "  VPS_SSH_KEY  = contents of crownev_deploy (private key, entire file)"
echo "  VPS_PORT     = 22   (optional)"
echo ""
echo "Push to main branch to trigger deploy, or run workflow manually in Actions tab."
echo "Done."
