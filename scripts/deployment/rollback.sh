#!/usr/bin/env bash
set -eo pipefail

TARGET_COMMIT=${1:-HEAD~1}

echo "========================================="
echo "KUCET CMS — Emergency Rollback Tool"
echo "Target Commit: ${TARGET_COMMIT}"
echo "========================================="

echo "1/4 Rolling back source code..."
git checkout "${TARGET_COMMIT}"

echo "2/4 Re-installing dependencies..."
npm ci || npm install

echo "3/4 Re-building production assets..."
npm run build

echo "4/4 Reloading PM2 process..."
if command -v pm2 &> /dev/null; then
  pm2 reload kucet-cms
else
  echo "Manual process restart required."
fi

echo "✅ Emergency rollback completed successfully."
