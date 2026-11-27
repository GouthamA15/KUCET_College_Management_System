# Attendance Achievement System — VPS Deployment & CI/CD Verification

**Branch:** `testvanilla` | **Code Commit:** `7b4f20a2816f2a72184e725ba6a3b01195903a9d`

---

## 1. Branch & Workflow Behaviour

| Event | Workflow | Behaviour |
|---|---|---|
| Push to `testvanilla` | `.github/workflows/ci.yml` | Runs lint, `db:check`, unit tests, build, Playwright; **no production deploy, no DB migration**. |
| Pull request to `main` | `.github/workflows/ci.yml` | Runs validation checks only; **no production deploy, no DB migration**. |
| Merge / Push to `main` | `.github/workflows/deploy.yml` | Runs `validate-and-test`, then `deploy.sh` on `self-hosted` VPS runner (pre-backup -> `production-vps` migration -> Docker build/up -> health check -> auto-rollback on health failure). |
| Manual TiDB Migration | `.github/workflows/db-migrate-tidb.yml` | `workflow_dispatch` only + `environment: production` + `confirm_target == 'production-tidb'`. |

---

## 2. Deployment Ordering & Safety (`DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh`)

Verified execution order:
1. Acquire `/tmp/kucet_deploy.lock` via `flock -n 200`.
2. Load `/var/www/kucet-cms/.env.production`.
3. Capture `PREV_COMMIT` for rollback and pull `origin/main`.
4. Run `nightly-backup.sh` pre-migration snapshot.
5. Run `env -u DATABASE_URL MIGRATE_TARGET=production-vps CONFIRM_PRODUCTION_MIGRATION=true MIGRATE_HOST=127.0.0.1 npm run db:migrate`; **aborts (`exit 1`) before touching containers if migration fails**.
6. Build `app` and `realtime` images while existing containers stay online, then `docker compose up -d --no-deps app realtime`.
7. Poll container health (up to 60s), reload Nginx, run `health-check.sh`, and trigger `rollback.sh "$PREV_COMMIT"` on failure.

---

## 3. VPS Read-Only Audit Findings (`kucet-dev@kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc`)

- Confirmed containers healthy: `kucet-cms-app`, `kucet-cms-realtime`, `kucet-cms-db` (`mysql:8.0`), `kucet-cms-redis`, `kucet-cms-proxy`, `kucet-cms-monitor`.
- Confirmed `deploy_20261127_133847.log` aborted safely at the migration step when `main` (`4acd9ba6`) still had `CREATE INDEX IF NOT EXISTS` in `0035`, leaving the existing production containers intact.
- **Note:** GitHub repository Environment protection rules (required reviewers on `environment: production`) reside in GitHub Settings UI and must be confirmed by a repo admin.
