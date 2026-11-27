const { drizzle } = require('drizzle-orm/mysql2');
const { migrate } = require('drizzle-orm/mysql2/migrator');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { BASELINE_RULES } = require('./baseline-rules.js');
const {
  loadMigrationEnv,
  resolveMigrationConfig,
  assertMigrationTarget,
} = require('./migrate-config.js');

async function runMigrations() {
  const migrateTarget = process.env.MIGRATE_TARGET;
  const loadedEnvFiles = loadMigrationEnv({ migrateTarget, dotenv });

  let dbConfig;
  let targetSummary;
  try {
    dbConfig = resolveMigrationConfig(process.env);
    targetSummary = assertMigrationTarget(dbConfig, process.env);
  } catch (configError) {
    console.error('❌ Migration configuration/target assertion failed:', configError.message);
    process.exit(1);
  }

  console.info('⏳ Running database migrations via Drizzle ORM...');
  console.info(
    `ℹ️ Target: env=${targetSummary.target}, source=${targetSummary.source}, host=${targetSummary.sanitizedHost}, port=${targetSummary.port}, database=${targetSummary.database}, ssl=${targetSummary.ssl}, envFiles=[${loadedEnvFiles.join(', ')}]`
  );

  const maxAttempts = Number(process.env.DB_MIGRATE_MAX_RETRIES) || 3;
  let connection;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      connection = await mysql.createConnection(dbConfig);
      break;
    } catch (connError) {
      lastError = connError;
      const isRetryable =
        connError.code === 'ETIMEDOUT' ||
        connError.code === 'ECONNRESET' ||
        connError.code === 'EPIPE' ||
        connError.code === 'EAI_AGAIN' ||
        connError.code === 'EHOSTUNREACH' ||
        connError.code === 'PROTOCOL_CONNECTION_LOST';

      if (attempt < maxAttempts && isRetryable) {
        const backoffMs = attempt * 2000;
        console.warn(
          `⚠️ Connection attempt ${attempt}/${maxAttempts} failed (${connError.code || connError.message}). Retrying in ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        break;
      }
    }
  }

  if (!connection) {
    console.error('❌ Failed to connect to database for migration:');
    console.error(`   Error: ${lastError?.code || 'UNKNOWN'} - ${lastError?.message}`);
    console.error(
      `   Target: env=${targetSummary.target}, host=${targetSummary.sanitizedHost}, port=${targetSummary.port}, database=${targetSummary.database}, ssl=${targetSummary.ssl}`
    );
    console.error(`   Timeout: ${dbConfig.connectTimeout}ms (${maxAttempts} attempts exhausted)`);
    process.exit(1);
  }

  const db = drizzle(connection);
  const startTime = Date.now();
  let lockAcquired = false;

  try {
    // Log database product/version for target verification
    try {
      const [verRows] = await connection.query('SELECT VERSION() AS version');
      console.info(`ℹ️ Connected DB version: ${verRows?.[0]?.version || 'unknown'}`);
    } catch (_) {}

    // Acquire database-level advisory lock to prevent concurrent CI/VPS/manual runners
    try {
      const [lockRows] = await connection.query("SELECT GET_LOCK('kucet_cms_drizzle_migrate', 15) AS acquired");
      const acquired = Number(lockRows?.[0]?.acquired);
      if (acquired === 0) {
        console.error('❌ Another migration process currently holds the database migration lock. Aborting.');
        process.exit(1);
      }
      lockAcquired = acquired === 1;
    } catch (lockErr) {
      console.warn('⚠️ Database advisory GET_LOCK unavailable on this engine, continuing:', lockErr.message);
    }

    // 1. Ensure __drizzle_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
        \`id\` bigint unsigned not null auto_increment primary key,
        \`hash\` text not null,
        \`created_at\` bigint
      )
    `);

    // 2. Fetch existing migration timestamps from __drizzle_migrations
    const [existingMigRows] = await connection.query('SELECT created_at FROM `__drizzle_migrations`');
    const appliedTimestamps = new Set((existingMigRows || []).map((r) => Number(r.created_at)));

    const journalPath = path.join(__dirname, '../../drizzle/meta/_journal.json');
    let pendingEntries = [];
    if (fs.existsSync(journalPath)) {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      const entries = journal.entries || [];

      // Helper to baseline an entry safely
      async function baselineEntry(entry, reason) {
        if (!appliedTimestamps.has(entry.when)) {
          console.info(`ℹ️ Baselining migration ${entry.tag} (${reason})...`);
          await connection.query(
            'INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)',
            ['', entry.when]
          );
          appliedTimestamps.add(entry.when);
        }
      }

      // 3. Automated Multi-Environment Baseline Tracking
      for (const rule of BASELINE_RULES) {
        const targetEntries = rule.getEntries(entries).filter((e) => !appliedTimestamps.has(e.when));
        if (targetEntries.length === 0) continue;

        try {
          const isSatisfied = await rule.isSatisfied(connection);
          if (isSatisfied) {
            console.info(
              `ℹ️ Baseline match for [${rule.description}]. Baselining ${targetEntries.length} migration(s)...`
            );
            for (const entry of targetEntries) {
              await baselineEntry(entry, rule.getReason(entry));
            }
          }
        } catch (ruleError) {
          console.warn(`⚠️ Baseline rule [${rule.description}] check skipped:`, ruleError.message);
        }
      }

      pendingEntries = entries.filter((e) => !appliedTimestamps.has(e.when));
      if (pendingEntries.length === 0) {
        console.info('ℹ️ No pending migrations to apply.');
      } else {
        console.info(
          `ℹ️ Pending migrations (${pendingEntries.length}): ${pendingEntries.map((e) => `${e.tag}.sql`).join(', ')}`
        );
      }
    }

    // 4. Clean up legacy contradictory check constraint if left over from partial migration attempts
    try {
      const [chkRows] = await connection.query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_student_gender'"
      );
      if (chkRows && chkRows.length > 0) {
        console.info('ℹ️ Cleaning up legacy chk_student_gender check constraint from students table...');
        await connection.query('ALTER TABLE `students` DROP CHECK `chk_student_gender`');
      }
    } catch (chkErr) {
      console.warn('⚠️ Legacy check constraint cleanup skipped:', chkErr.message);
    }

    // 5. Run Drizzle ORM official migration runner
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });

    const [postMigRows] = await connection.query('SELECT COUNT(*) AS total FROM `__drizzle_migrations`');
    const elapsed = Date.now() - startTime;
    console.info(
      `✅ Migrations verified and executed successfully in ${elapsed}ms! Total recorded migrations: ${postMigRows?.[0]?.total ?? 'unknown'}`
    );
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.cause) {
      console.error('   Underlying cause:', error.cause.code || error.cause.message, error.cause.sqlMessage || '');
    }
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    if (lockAcquired) {
      try {
        await connection.query("SELECT RELEASE_LOCK('kucet_cms_drizzle_migrate')");
      } catch (_) {}
    }
    await connection.end();
  }
}

runMigrations();
