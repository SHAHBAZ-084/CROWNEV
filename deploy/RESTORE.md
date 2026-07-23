# Crown EV — Restore from Google Drive backup

Backups are uploaded by `deploy/backup-db.sh` (daily) and `deploy/backup-uploads.sh` (weekly) to the **gdrive** rclone remote under `CrownEV-Backups/`.

## Prerequisites

- `rclone` configured on the machine with remote name **`gdrive`** (same as production).
- PostgreSQL client tools (`psql`, optionally `pg_restore` if you switch formats later).
- **Stop the backend** before restoring the database so nothing writes during restore.

## 1. List available backups on Drive

```bash
rclone ls gdrive:CrownEV-Backups/db/
rclone ls gdrive:CrownEV-Backups/uploads/
```

Latest DB file is usually the largest timestamp in the name, e.g. `crownev_2026-07-23_0200.sql.gz`.

## 2. Download the latest database backup

```bash
mkdir -p /tmp/crownev-restore
rclone copy gdrive:CrownEV-Backups/db/crownev_YYYY-MM-DD_HHMM.sql.gz /tmp/crownev-restore/
```

Replace the filename with the one from `rclone ls`.

## 3. Stop the backend (production VPS)

```bash
pm2 stop crownev-backend
```

Confirm API is down:

```bash
curl -fsS http://127.0.0.1:3001/health || echo "API stopped (expected)"
```

## 4. Restore PostgreSQL

Load `DATABASE_URL` from production env (or your target database):

```bash
cd /var/www/crownev/backend
set -a && source .env && set +a
```

**Full restore into the database pointed to by `DATABASE_URL`:**

```bash
gunzip -c /tmp/crownev-restore/crownev_YYYY-MM-DD_HHMM.sql.gz | psql "${DATABASE_URL}"
```

This replaces all data in that database with the dump contents. Use only when you intend a full rollback.

### Safer test restore (throwaway database)

Create an empty database and restore there first:

```bash
createdb crown_eve_restore_test
export TEST_URL="postgresql://USER:PASS@localhost:5432/crown_eve_restore_test"
gunzip -c /tmp/crownev-restore/crownev_YYYY-MM-DD_HHMM.sql.gz | psql "${TEST_URL}"
```

Drop when done:

```bash
dropdb crown_eve_restore_test
```

## 5. Verify restore worked

```bash
psql "${DATABASE_URL}" -c "SELECT COUNT(*) AS orders FROM \"Order\";"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) AS products FROM \"Product\";"
psql "${DATABASE_URL}" -c "SELECT id, email FROM \"User\" LIMIT 5;"
```

Compare row counts to expectations or to a pre-incident snapshot.

## 6. Start the backend

```bash
pm2 start crownev-backend
curl -fsS http://127.0.0.1:3001/health
```

Log in to admin/POS and spot-check a few records (recent invoice, product catalog).

## 7. Restore uploads (optional)

If product/payment images were lost:

```bash
rclone copy gdrive:CrownEV-Backups/uploads/uploads_YYYY-MM-DD.tar.gz /tmp/crownev-restore/
tar -xzf /tmp/crownev-restore/uploads_YYYY-MM-DD.tar.gz -C /var/www/crownev/backend/uploads/
chmod -R a+rX /var/www/crownev/backend/uploads
```

Only `products/` and `payments/` are included in weekly archives.

## Troubleshooting

| Problem | Action |
|--------|--------|
| `rclone` auth expired | On VPS: `rclone config reconnect gdrive:` and complete OAuth in browser |
| `psql` permission denied | Use a DB user with create/connect rights on the target DB |
| Restore errors mid-stream | Restore into a fresh empty database; do not retry on a half-written DB |
| Backup file corrupt | Download again; test with `gunzip -t backup.sql.gz` |

## Cron (production)

```cron
0 2 * * *   bash /var/www/crownev/deploy/backup-db.sh >> /var/log/crownev-backup-db.log 2>&1
0 3 * * 0   bash /var/www/crownev/deploy/backup-uploads.sh >> /var/log/crownev-backup-uploads.log 2>&1
```

Logs: `/var/log/crownev-backup-db.log`, `/var/log/crownev-backup-uploads.log`
