#!/usr/bin/env bash
# =============================================================================
# KUCET CMS — Production Automated Database Backup & Retention Script
# Runs daily at 02:30 AM VPS time.
# Features:
#   - Atomic dump & Gzip compression
#   - SHA-256 Checksum validation
#   - 14-day retention pruning (Preserves newest backup invariant)
#   - Concurrency lock protection
#   - Zero credential exposure in logs
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Configuration & Environment
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="${KUCET_CMS_DIR:-/var/www/kucet-cms}"
ENV_FILE="$KUCET_CMS_DIR/.env.production"
BACKUP_DIR="${DB_BACKUP_PATH:-/var/kucet-db-backup}"
CONTAINER_NAME="kucet-cms-db"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="kucet_cms_${TIMESTAMP}.sql.gz"
# Ensure backup directory exists and is writable (with resilient fallback)
if ! mkdir -p "$BACKUP_DIR" 2>/dev/null || [ ! -w "$BACKUP_DIR" ]; then
  if [ -d "/home/kucet-dev/backups" ] && [ -w "/home/kucet-dev/backups" ]; then
    BACKUP_DIR="/home/kucet-dev/backups"
  elif mkdir -p "/home/kucet-dev/backups" 2>/dev/null; then
    BACKUP_DIR="/home/kucet-dev/backups"
  else
    BACKUP_DIR="$KUCET_CMS_DIR/backups"
    mkdir -p "$BACKUP_DIR"
  fi
fi
chmod 755 "$BACKUP_DIR" 2>/dev/null || true
LOCK_FILE="$BACKUP_DIR/.backup.lock"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DATABASE_BACKUP] $*"
}

cleanup() {
  # Remove lock file and temporary working files on exit
  rm -f "$LOCK_FILE" || true
  rm -f "$BACKUP_DIR/${FILENAME}.tmp.sql" || true
  rm -f "$BACKUP_DIR/${FILENAME}.tmp.gz" || true
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# 1. Concurrency Lock Guard
# ---------------------------------------------------------------------------
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE_SEC=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE_SEC" -lt 900 ]; then
    log "ERROR: Another backup or restore operation is active (Lock age: ${LOCK_AGE_SEC}s). Aborting."
    exit 1
  else
    log "WARN: Found stale lock file (>15 mins). Removing."
    rm -f "$LOCK_FILE"
  fi
fi

echo "{\"operation\":\"cron-backup\",\"timestamp\":$(date +%s),\"pid\":$$}" > "$LOCK_FILE"

# ---------------------------------------------------------------------------
# 2. Extract Credentials Securely from .env.production
# ---------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  # Parse specific DB keys without exporting untrusted shell code
  DB_USER_VAL=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "root")
  DB_PASS_VAL=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
  DB_NAME_VAL=$(grep -E '^DB_DATABASE=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "kucet_cms")
else
  DB_USER_VAL="${DB_USER:-root}"
  DB_PASS_VAL="${DB_PASSWORD:-}"
  DB_NAME_VAL="${DB_DATABASE:-kucet_cms}"
fi

TMP_SQL="$BACKUP_DIR/${FILENAME}.tmp.sql"
TMP_GZ="$BACKUP_DIR/${FILENAME}.tmp.gz"
FINAL_FILE="$BACKUP_DIR/$FILENAME"
CHECKSUM_FILE="$BACKUP_DIR/${FILENAME}.sha256"

log "Starting database backup snapshot for database: '$DB_NAME_VAL'"

# ---------------------------------------------------------------------------
# 3. Database Dump (Dockerized or Host CLI)
# ---------------------------------------------------------------------------
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "Dumping via Docker container: $CONTAINER_NAME..."
  if ! docker exec "$CONTAINER_NAME" mysqldump \
    --no-tablespaces \
    --single-transaction \
    --quick \
    -u "$DB_USER_VAL" \
    -p"$DB_PASS_VAL" \
    "$DB_NAME_VAL" > "$TMP_SQL"; then
    log "ERROR: Docker mysqldump execution failed!"
    exit 1
  fi
elif command -v mysqldump >/dev/null 2>&1; then
  log "Dumping via Host mysqldump binary..."
  MYSQL_PWD="$DB_PASS_VAL" mysqldump \
    --single-transaction \
    --quick \
    -u "$DB_USER_VAL" \
    "$DB_NAME_VAL" > "$TMP_SQL"
else
  log "ERROR: Neither Docker container '$CONTAINER_NAME' nor host 'mysqldump' found!"
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Integrity Verification & Sanity Checks
# ---------------------------------------------------------------------------
if [ ! -s "$TMP_SQL" ]; then
  log "ERROR: Exported SQL file is missing or 0 bytes. Aborting."
  exit 1
fi

SQL_SIZE=$(wc -c < "$TMP_SQL")
if [ "$SQL_SIZE" -lt 1024 ]; then
  log "ERROR: Exported SQL file is suspiciously small ($SQL_SIZE bytes). Aborting."
  exit 1
fi

if ! head -n 50 "$TMP_SQL" | grep -Eq "(MySQL dump|CREATE TABLE|Table structure)"; then
  log "ERROR: Dump header validation failed! File content is not a valid MySQL dump."
  exit 1
fi

# ---------------------------------------------------------------------------
# 5. Gzip Compression & SHA-256 Checksum Calculation
# ---------------------------------------------------------------------------
log "Compressing backup snapshot with Gzip..."
gzip -9 -c "$TMP_SQL" > "$TMP_GZ"
rm -f "$TMP_SQL"

SHA256_HASH=$(sha256sum "$TMP_GZ" | awk '{print $1}')
echo "$SHA256_HASH  $FILENAME" > "$CHECKSUM_FILE"

# ---------------------------------------------------------------------------
# 6. Atomic Rename to Final Backup
# ---------------------------------------------------------------------------
mv "$TMP_GZ" "$FINAL_FILE"
chmod 600 "$FINAL_FILE" || true
chmod 644 "$CHECKSUM_FILE" || true

FINAL_SIZE=$(wc -c < "$FINAL_FILE")
log "SUCCESS: Backup created -> $FINAL_FILE ($(( FINAL_SIZE / 1024 )) KB)"
log "SHA-256 Checksum -> $SHA256_HASH"

# ---------------------------------------------------------------------------
# 7. Retention Policy Enforcement (14 Days)
# ---------------------------------------------------------------------------
log "Enforcing $RETENTION_DAYS-day retention policy on $BACKUP_DIR..."

# Collect all backups sorted newest to oldest
ALL_BACKUPS=$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "kucet_cms_*.sql.gz" -o -name "db_*.sql.gz" -o -name "*.sql.gz" \) | sort -r || true)
BACKUP_COUNT=$(echo "$ALL_BACKUPS" | grep -v '^$' | wc -l || echo 0)

if [ "$BACKUP_COUNT" -gt 1 ]; then
  # Find expired backups older than 14 days, skipping the very latest one
  LATEST_BACKUP=$(echo "$ALL_BACKUPS" | head -n 1)
  
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "kucet_cms_*.sql.gz" -o -name "db_*.sql.gz" \) -mtime +$RETENTION_DAYS | while read -r old_file; do
    if [ "$old_file" != "$LATEST_BACKUP" ]; then
      log "Pruning expired backup (>14 days): $old_file"
      rm -f "$old_file" "${old_file}.sha256" || true
    else
      log "Preserving latest backup even if older than $RETENTION_DAYS days: $old_file"
    fi
  done
fi

log "Backup cycle completed successfully at $(date '+%Y-%m-%d %H:%M:%S')."
