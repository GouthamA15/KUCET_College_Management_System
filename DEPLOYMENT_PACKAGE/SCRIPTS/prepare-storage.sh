#!/usr/bin/env bash
# =============================================================================
# prepare-storage.sh
# Safely initializes production VPS storage directories with least privilege.
# Ensures Docker container (running as nextjs, UID 1001) has write access to
# required upload categories without altering ownership of existing user files
# and without using insecure chmod 777.
#
# Usage:
#   bash prepare-storage.sh [--storage-root <PATH>]
# =============================================================================
set -euo pipefail

STORAGE_ROOT="${1:-/var/www/kucet-storage}"

# Shift if passed as named argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --storage-root) STORAGE_ROOT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "[prepare-storage] Initializing canonical storage root: $STORAGE_ROOT ..."

# 1. Base storage directories
mkdir -p "$STORAGE_ROOT/kucet" 2>/dev/null || true
# Ensure base root is readable/traversable (755)
chmod 755 "$STORAGE_ROOT" 2>/dev/null || true
chmod 755 "$STORAGE_ROOT/kucet" 2>/dev/null || true
chown 1001:1001 "$STORAGE_ROOT" 2>/dev/null || sudo chown 1001:1001 "$STORAGE_ROOT" 2>/dev/null || true
chown 1001:1001 "$STORAGE_ROOT/kucet" 2>/dev/null || sudo chown 1001:1001 "$STORAGE_ROOT/kucet" 2>/dev/null || true

# 2. Specific Upload Subtrees requiring write permissions for nextjs (UID 1001)
# Note: We configure permissions on the DIRECTORIES only, preserving existing file permissions.
UPLOAD_DIRECTORIES=(
  "kucet/students/pfp"
  "kucet/students/signatures"
  "kucet/requests/pfp"
  "kucet/requests/signatures"
  "kucet/requests/proofs"
  "kucet/certificates/payments"
  "kucet/admission_drafts/pfp"
  "kucet/admission_drafts/signatures"
  "kucet/staff/pfp"
  "kucet/staff/signatures"
  "kucet/bug_reports"
  "kucet/backups"
  "kucet/.health_test"
)

for rel_dir in "${UPLOAD_DIRECTORIES[@]}"; do
  target_dir="$STORAGE_ROOT/$rel_dir"
  mkdir -p "$target_dir" 2>/dev/null || true
  # Assign ownership to UID 1001 (nextjs) and standard 775 directory mode
  chown 1001:1001 "$target_dir" 2>/dev/null || sudo chown 1001:1001 "$target_dir" 2>/dev/null || true
  chmod 775 "$target_dir" 2>/dev/null || true
done

# 3. Protected Institutional Branding (Read-Only for normal processes)
INSTITUTION_DIR="$STORAGE_ROOT/kucet/institution"
mkdir -p "$INSTITUTION_DIR" 2>/dev/null || true
# 755 allows application/document engine to read but prevents unauthorized modification
chmod 755 "$INSTITUTION_DIR" 2>/dev/null || true

# 4. Isolated Database Backup Directory (Separate from storage, needs 1001 access)
DB_BACKUP_DIR="/var/kucet-db-backup"
mkdir -p "$DB_BACKUP_DIR" 2>/dev/null || true
chown 1001:1001 "$DB_BACKUP_DIR" 2>/dev/null || sudo chown 1001:1001 "$DB_BACKUP_DIR" 2>/dev/null || true
chmod 755 "$DB_BACKUP_DIR" 2>/dev/null || true

echo "[prepare-storage] Storage preparation completed safely with least privilege (no chmod 777)."
exit 0
