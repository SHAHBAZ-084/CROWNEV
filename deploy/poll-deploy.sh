#!/usr/bin/env bash
# Pull-based deploy — runs on the VPS (cron) when GitHub Actions SSH is blocked.
# Usage: bash deploy/poll-deploy.sh
# Cron example (every 3 min): */3 * * * * bash /var/www/crownev/deploy/poll-deploy.sh >> /var/log/crownev-poll-deploy.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
LOCK="/tmp/crownev-poll-deploy.lock"
LOG_TAG="[poll-deploy $(date -Is)]"

exec 9>"${LOCK}"
if ! flock -n 9; then
  echo "${LOG_TAG} skip — another deploy running"
  exit 0
fi

cd "${APP_DIR}"
git fetch origin main --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [[ "${LOCAL}" == "${REMOTE}" ]]; then
  exit 0
fi

echo "${LOG_TAG} ${LOCAL:0:7} -> ${REMOTE:0:7} — deploying"
export RUN_PARTS_SEED=0
export RUN_DB_SEED=0
bash "${APP_DIR}/deploy/deploy-app.sh"
echo "${LOG_TAG} done"
