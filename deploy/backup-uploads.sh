#!/usr/bin/env bash
# Weekly uploads backup (products + payments) → local disk → Google Drive
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crownev}"
ENV_FILE="${APP_DIR}/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/crownev/uploads}"
REMOTE="${RCLONE_REMOTE:-gdrive:CrownEV-Backups/uploads}"
LOG_TAG="[crownev-backup-uploads $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

die() {
  echo "${LOG_TAG} ERROR: $*" >&2
  exit 1
}

command -v rclone >/dev/null 2>&1 || die "rclone not found — install and configure gdrive remote first"

UPLOAD_DIR="${APP_DIR}/backend/uploads"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  UPLOAD_FROM_ENV="$(grep -E '^UPLOAD_DIR=' "${ENV_FILE}" | cut -d= -f2- | tr -d \"'\" || true)"
  if [[ -n "${UPLOAD_FROM_ENV}" ]]; then
    if [[ "${UPLOAD_FROM_ENV}" = /* ]]; then
      UPLOAD_DIR="${UPLOAD_FROM_ENV}"
    else
      UPLOAD_DIR="${APP_DIR}/backend/${UPLOAD_FROM_ENV#./}"
    fi
  fi
fi

[[ -d "${UPLOAD_DIR}" ]] || die "Upload directory not found: ${UPLOAD_DIR}"

for sub in products payments; do
  [[ -d "${UPLOAD_DIR}/${sub}" ]] || die "Missing uploads subfolder: ${UPLOAD_DIR}/${sub}"
done

mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%F)"
OUTFILE="${BACKUP_DIR}/uploads_${STAMP}.tar.gz"

echo "${LOG_TAG} Archiving products/ and payments/ from ${UPLOAD_DIR}"
if ! tar -czf "${OUTFILE}" -C "${UPLOAD_DIR}" products payments; then
  rm -f "${OUTFILE}"
  die "tar failed"
fi

if [[ ! -s "${OUTFILE}" ]]; then
  rm -f "${OUTFILE}"
  die "Archive is empty"
fi

echo "${LOG_TAG} Uploading to ${REMOTE}"
if ! rclone copy "${OUTFILE}" "${REMOTE}/" --contimeout 60s --timeout 600s; then
  die "rclone upload failed for ${OUTFILE}"
fi

echo "${LOG_TAG} Keeping 2 most recent local archives"
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/uploads_*.tar.gz 2>/dev/null || true)
if ((${#OLD[@]} > 2)); then
  for f in "${OLD[@]:2}"; do
    rm -f "${f}"
  done
fi

echo "${LOG_TAG} Done — $(basename "${OUTFILE}") ($(du -h "${OUTFILE}" | cut -f1))"
