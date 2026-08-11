# Database Migration Workflow & Safe Schema Protocol

## Overview

Database schema evolution in KUCET CMS is governed by Drizzle Kit (`drizzle-kit`) and a custom migration runner (`src/db/migrate.js`). The system enforces strict version control for all database DDL changes to prevent data loss or schema drift across development, staging, and production environments.

---

## The Golden Rule: NEVER Use `db:push` in Production

> [!CAUTION]
> `npm run db:push` (`drizzle-kit push`) bypasses migration files and directly mutates the target database schema. In production environments, `db:push` can cause catastrophic data loss, dropped tables, or inconsistent state. `db:push` is restricted exclusively to ephemeral local development prototypes. Production migrations MUST follow the strict generate-review-migrate protocol detailed below.

---

## Safe Schema Update Protocol

Every database schema change must adhere to the 4-step deployment pipeline:

```mermaid
flowchart LR
    Step1[1. Edit Schema Code\nsrc/db/schema/*.js] --> Step2[2. Generate Migration SQL\nnpm run db:generate]
    Step2 --> Step3[3. Manual SQL Review\nInspect drizzle/*.sql]
    Step3 --> Step4[4. Execute Migration\nnpm run db:migrate]
```

### Step 1: Modify Schema Definition
Edit the relevant modular domain file in `src/db/schema/` (e.g. adding a new column to `src/db/schema/identity.js`).

### Step 2: Generate Migration SQL
Execute Drizzle Kit generator:
```bash
npm run db:generate
```
This compares `src/db/schema.js` against existing migrations in `./drizzle/` and produces a new numbered SQL snapshot file (e.g., `./drizzle/0007_add_faculty_office.sql`).

### Step 3: Manual SQL Inspection
Open the generated `.sql` file in `./drizzle/` and review the DDL statements. Verify:
- Column data types and NULL constraints match requirements.
- Foreign key definitions enforce `ON DELETE RESTRICT` or `ON DELETE CASCADE` appropriately.
- Indexes have explicit names prefixed with `idx_` or `uq_`.

### Step 4: Execute Migration Runner
Run the migration execution script:
```bash
npm run db:migrate
```

---

## Fail-Safe Migration Execution Engine (`src/db/migrate.js`)

The project uses a custom migration execution runner that guarantees deployment stability even in heterogeneous hosting environments (Local MySQL, TiDB Cloud, Render, CI runners).

```mermaid
sequenceDiagram
    autonumber
    participant CLI / CI Pipeline
    participant Migrate Script (`src/db/migrate.js`)
    participant MySQL Database

    CLI / CI Pipeline->>Migrate Script: npm run db:migrate
    Migrate Script->>Migrate Script: Resolve DB host, port, credentials & SSL settings
    alt DB connection refused in CI environment
        Migrate Script-->>CLI / CI Pipeline: Warn & skip cleanly (Exit Code 0)
    else DB connection established
        Migrate Script->>MySQL Database: Run standard Drizzle migrator
        alt Standard Drizzle migrator succeeds
            MySQL Database-->>Migrate Script: Success
            Migrate Script-->>CLI / CI Pipeline: ✅ Migrations completed successfully!
        else Journal drift or missing migration record detected
            Migrate Script->>Migrate Script: Fallback to Direct SQL Batch Executor
            loop For each .sql file in ./drizzle/
                Migrate Script->>Migrate Script: Read & split by '--> statement-breakpoint'
                loop For each SQL statement
                    Migrate Script->>MySQL Database: Execute statement
                    alt Code 1050 (Table Exists) or 1061 (Duplicate Key)
                        MySQL Database-->>Migrate Script: Suppress warning & continue
                    end
                end
            end
            Migrate Script-->>CLI / CI Pipeline: ✅ Available migrations executed successfully!
        end
    end
```

### Resilient Features of `migrate.js`
1. **TiDB Cloud & SSL Auto-Detection**: Automatically injects TLS v1.2 configuration when connecting to TiDB Cloud or when `DB_SSL=true`.
2. **Clean CI Bypass**: Prevents build failures in CI workflows where database secrets are deliberately withheld by catching `ECONNREFUSED` and exiting cleanly.
3. **Journal Drift Auto-Recovery**: If Drizzle's `__drizzle_migrations` meta table becomes desynchronized or missing historical journal files, the script falls back to parsing raw `.sql` files, splitting by `--> statement-breakpoint`, and executing statements individually while suppressing harmless duplicate errors (MySQL codes 1050, 1061, 1060).

---

## Automated CI Drift Verification

In GitHub Actions workflows (`.github/workflows/ci.yml`), schema integrity is verified prior to merging pull requests:
1. Running `npm run db:generate` in dry-run mode.
2. Checking `git status` to ensure developers didn't alter schema files without committing corresponding migration SQL files.

---

## Cross-References

- [Database Schema Reference](./schema.md)
- [Backup & Disaster Recovery Strategy](./backup-strategy.md)
