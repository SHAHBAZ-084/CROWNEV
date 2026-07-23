#!/usr/bin/env bash
# Daily PostgreSQL backup → local disk → Google Drive (rclone remote: gdrive)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
ENV_FILE="${APP_DIR}/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/crownev/db}"
REMOTE="${RCLONE_REMOTE:-gdrive:CrownEV-Backups/db}"
LOG_TAG="[crownev-backup-db $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

die() {
  echo "${LOG_TAG} ERROR: $*" >&2
  exit 1
}

command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found"
command -v rclone >/dev/null 2>&1 || die "rclone not found — install and configure gdrive remote first"
[[ -f "${ENV_FILE}" ]] || die "Missing ${ENV_FILE}"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set in ${ENV_FILE}"

# pg_dump does not accept Prisma's ?schema= query param
PG_URL="${DATABASE_URL%%\?*}"

mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%F_%H%M)"
OUTFILE="${BACKUP_DIR}/crownev_${STAMP}.sql.gz"

echo "${LOG_TAG} Dumping database to ${OUTFILE}"
if ! pg_dump "${PG_URL}" | gzip -c > "${OUTFILE}"; then
  rm -f "${OUTFILE}"
  die "pg_dump failed"
fi

if [[ ! -s "${OUTFILE}" ]]; then
  rm -f "${OUTFILE}"
  die "Backup file is empty after pg_dump"
fi

echo "${LOG_TAG} Removing local DB backups older than 3 days"
find "${BACKUP_DIR}" -name 'crownev_*.sql.gz' -type f -mtime +3 -delete

echo "${LOG_TAG} Uploading to ${REMOTE}"
if ! rclone copy "${OUTFILE}" "${REMOTE}/" --contimeout 60s --timeout 300s; then
  die "rclone upload failed for ${OUTFILE}"
fi

echo "${LOG_TAG} Done — $(basename "${OUTFILE}") ($(du -h "${OUTFILE}" | cut -f1))"
