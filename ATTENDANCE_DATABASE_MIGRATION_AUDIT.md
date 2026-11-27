# Attendance Achievement System — Database Migration Audit

**Branch:** `testvanilla` | **Code Commit:** `7b4f20a2816f2a72184e725ba6a3b01195903a9d`

---

## 1. Runtime Database vs Migration Target Comparison

| Target | Config Source | Resolved Host / Engine | Database | Migration Command |
|---|---|---|---|---|
| **VPS Production App** | `/var/www/kucet-cms/.env.production` (read-only audit) | `DB_HOST=db` -> `127.0.0.1:3306` (`kucet-cms-db`, MySQL 8.0, `hasDatabaseUrl=false`) | `kucet_cms` | `env -u DATABASE_URL MIGRATE_TARGET=production-vps CONFIRM_PRODUCTION_MIGRATION=true MIGRATE_HOST=127.0.0.1 npm run db:migrate` |
| **TiDB Cloud (Separate)** | GitHub `secrets.DATABASE_URL` / `DB_*` | `*.tidbcloud.com:4000` (TLSv1.2) | Configured TiDB schema | Manual `db-migrate-tidb.yml` (`workflow_dispatch` + `environment: production`) |
| **Local Development** | `.env.local`, `.env` (`override: false`) | `127.0.0.1` / `localhost` | Local MySQL/MariaDB | `npm run db:migrate:local` |
| **Staging** | `.env.staging`, `.env` | Explicit staging host | Staging DB | `npm run db:migrate:staging` |

**Consistency Finding:** On the self-hosted VPS, the running `kucet-cms-app` container and `deploy.sh` both target the same Docker MySQL 8.0 database (`kucet_cms` on `kucet-cms-db`). TiDB Cloud is completely isolated to its own manual protected workflow.

---

## 2. Fail-Closed Target & Concurrency Verification

Executed directly via `npx tsx src/db/migrate.js` + `tests/unit/db/migrate-config.test.js`:
1. `MIGRATE_TARGET=production-tidb` without `CONFIRM_PRODUCTION_MIGRATION=true` -> **exit 1** (`CONFIRM_PRODUCTION_MIGRATION=true is required`).
2. `MIGRATE_TARGET=local` with `DATABASE_URL` pointing to `tidbcloud.com` -> **exit 1** (`resolved host "gate***loud.com" is not local`).
3. `DATABASE_URL` + `MIGRATE_HOST` combined -> **exit 1** (`Ambiguous migration target`).
4. `src/db/migrate.js` acquires `SELECT GET_LOCK('kucet_cms_drizzle_migrate', 15)` and removes the silent `CI=true` connection-refused exit `0`.
5. `src/db/baseline-rules.js` rule `35` verifies all 3 `0035` tables + `idx_asm_required_streak`.

---

## 3. Compatibility & Backup/Restore Notes

- **MySQL 8.0 / Drizzle Check (`npm run db:check`):** Passed (`38` SQL files, `38` `_journal.json` entries, `90` schema tables, `94` total snapshot/SQL tables).
- **MariaDB Disposable Execution (earlier in session):** `0035`, `0036` (x2 idempotent), and `0037` succeeded on `127.0.0.1:33306` (`kucet_test_disposable`); local Docker daemon was unavailable in the sandbox for a fresh `mysql:8.0` container spin-up.
- **TiDB Live Execution:** **NOT VERIFIED / BLOCKED** (no disposable TiDB instance available; production TiDB Cloud strictly off-limits).
- **Backup & Restore (`DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh`):** Uses `mysqldump --no-tablespaces --single-transaction --quick` + gzip + `.sha256` checksum + 14-day retention in `/var/kucet-db-backup`, invoked automatically by `deploy.sh` prior to migrations. Forward-recovery + restore from the pre-migration `.sql.gz` snapshot is required for non-reversible DDL.
