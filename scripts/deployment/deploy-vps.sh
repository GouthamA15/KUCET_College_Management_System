#!/usr/bin/env bash
set -eo pipefail

echo "========================================="
echo "KUCET CMS — Zero-Downtime Deployment"
echo "========================================="

# 1. Environment Validation
if [ ! -f .env ] && [ ! -f .env.local ]; then
  echo "❌ Error: Configuration file (.env or .env.local) missing."
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/release_${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"

BRANCH="${1:-${DEPLOY_BRANCH:-main}}"

echo "1/5 Validating environment and pulling latest release ($BRANCH)..."
git fetch origin "$BRANCH"
PREV_COMMIT=$(git rev-parse HEAD)
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "2/5 Installing dependencies & running database migrations..."
npm ci --only=production || npm install
npm run db:migrate

echo "3/5 Compiling production build..."
npm run build

echo "4/5 Restarting application process via PM2 / Docker..."
if command -v pm2 &> /dev/null; then
  pm2 reload kucet-cms || pm2 start npm --name "kucet-cms" -- start
elif command -v docker-compose &> /dev/null; then
  docker-compose up -d --build
else
  npm run start &
fi

echo "5/5 Performing post-deployment health check..."
sleep 5
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "500")

if [ "$HEALTH_STATUS" -eq 200 ]; then
  echo "✅ Deployment succeeded! Health status 200 OK."
else
  echo "❌ Health check failed with status ${HEALTH_STATUS}. Initiating rollback to commit ${PREV_COMMIT}..."
  git checkout "${PREV_COMMIT}"
  npm install
  npm run build
  pm2 reload kucet-cms || true
  exit 1
fi
