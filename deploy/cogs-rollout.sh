#!/usr/bin/env bash
# Safe production rollout: backup → deploy → COGS backfill (dry-run, then pass A & B).
# Run on the VPS as root: bash /var/www/crownev/deploy/cogs-rollout.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
COMMIT_BACKFILL="${COMMIT_BACKFILL:-1}"

echo "==> Step 1/5: Database backup (local + Drive)"
bash "${APP_DIR}/deploy/backup-db.sh"

echo "==> Step 2/5: Deploy app (pull, migrate, build, PM2)"
bash "${APP_DIR}/deploy/deploy-app.sh"

echo "==> Step 3/5: COGS backfill dry-run (pass A + B)"
cd "${APP_DIR}/backend"
npx tsx scripts/backfill-cogs.ts

if [[ "${COMMIT_BACKFILL}" != "1" ]]; then
  echo "COMMIT_BACKFILL=0 — skipping writes. Re-run with COMMIT_BACKFILL=1 when ready."
  exit 0
fi

echo "==> Step 4/5: COGS backfill pass A (bikes) — commit"
npx tsx scripts/backfill-cogs.ts --pass a --commit

echo "==> Step 5/5: COGS backfill pass B (parts) — commit"
npx tsx scripts/backfill-cogs.ts --pass b --commit

echo "==> COGS rollout complete."
