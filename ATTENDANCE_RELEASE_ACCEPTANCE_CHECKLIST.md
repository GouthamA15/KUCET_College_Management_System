# Attendance Achievement System — Release Acceptance Checklist & Mandatory DB Decision

**Branch:** `testvanilla` | **Code Commit:** `7b4f20a2816f2a72184e725ba6a3b01195903a9d`

---

## 1. Mandatory Database Release Decision (Explicit Answers)

1. **Does a push to `testvanilla` trigger a production deployment?**
   - **No.** `.github/workflows/deploy.yml` triggers only on `push: branches: [main]` and `workflow_dispatch`.
2. **Does a merge/push to `main` trigger the self-hosted VPS deployment?**
   - **Yes.** `.github/workflows/deploy.yml` runs `validate-and-test` then `deploy.sh` on the `self-hosted` VPS runner.
3. **Does the deployment script automatically run VPS MySQL migrations?**
   - **Yes.** `DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh` runs `env -u DATABASE_URL MIGRATE_TARGET=production-vps CONFIRM_PRODUCTION_MIGRATION=true MIGRATE_HOST=127.0.0.1 npm run db:migrate`.
4. **Which exact database host/type/name does that migration target?**
   - **VPS Docker MySQL 8.0 (`kucet-cms-db`), `127.0.0.1:3306`, database `kucet_cms` (`DB_HOST=db` in `/var/www/kucet-cms/.env.production`).**
5. **Does the running application use that same database?**
   - **Yes.** `kucet-cms-app` uses `/var/www/kucet-cms/.env.production` (`hasDatabaseUrl=false`, `DB_HOST=db`, `DB_PORT=3306`, `DB_DATABASE=kucet_cms`).
6. **Is TiDB Cloud migrated automatically or only through its separate manual workflow?**
   - **Only through its separate manual workflow** (`.github/workflows/db-migrate-tidb.yml` via `workflow_dispatch` + `environment: production` + `confirm_target == 'production-tidb'`). Automatic `ci.yml` migration was removed.
7. **Can the application start safely if the migration fails?**
   - **No — deployment aborts before container build/restart.** `deploy.sh` exits `1` on migration failure, leaving the previous running containers untouched.
8. **Has the migration been verified on the actual database engine used by the application?**
   - **PARTIALLY VERIFIED:** `npm run db:check` (`38/38` migrations, `90` tables) and fail-closed target assertions passed locally; `0035`/`0036`/`0037` were previously verified on disposable MariaDB (`127.0.0.1:33306`). Fresh local `mysql:8.0` Docker execution was blocked because Docker daemon is not running in the sandbox, and live TiDB execution is **NOT VERIFIED**.

---

## 2. Release Checklist

- [x] Repository and branch state verified (`testvanilla`, `7b4f20a2816f2a72184e725ba6a3b01195903a9d`).
- [x] All nine milestone definitions (`5..200`) verified.
- [x] Streak business rules (`PRESENT`, `NCC`, `MEDICAL`, chronological order) verified.
- [x] Attendance corrections and disputes verified.
- [x] Achievement unlocks, goals, analytics, calendar, and notifications verified in unit/API tests.
- [x] API authentication, authorization, IDOR, and bounded pagination verified.
- [x] Migration target assertions, lock guard, and `npm run db:check` verified.
- [ ] **Staging Condition:** Authenticated Playwright E2E on `/student/academics?tab=attendance` + live Socket.IO/Redis/Web Push delivery.
- [ ] **Staging/Pre-Release Condition:** Disposable `mysql:8.0` (and TiDB if applicable) live migration run + GitHub `environment: production` reviewer check.
- [x] Production build (`npm run build`, `324/324` routes) and ESLint (`npm run lint`) passed.
- [x] No production deployment or production migration was executed.

**Final Verdict:** **CONDITIONALLY READY** — Safe to promote/test in staging; wait for staging E2E + live Socket.IO/Push sign-off and explicit human approval before merging to `main`.
