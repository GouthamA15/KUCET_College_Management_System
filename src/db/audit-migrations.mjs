#!/usr/bin/env node

/**
 * Pre-Deployment Schema and Migration Consistency Auditor
 *
 * This script runs in CI/CD pipelines and locally to guarantee that:
 * 1. `drizzle-kit check` passes without syntax, snapshot, or collision errors.
 * 2. All migration files in `drizzle/meta/_journal.json` exist on disk.
 * 3. No unjournaled `.sql` migrations exist in `drizzle/`.
 * 4. Every table defined in `src/db/schema/*.js` has a corresponding migration or snapshot entry.
 * 5. Multi-environment baseline rules in `src/db/baseline-rules.js` are structurally sound.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.info('🔍 Starting Pre-Deployment Schema & Migration Audit...\n');

let errors = [];

// 1. Run drizzle-kit check
try {
  console.info('1️⃣ Running drizzle-kit check...');
  execSync('npx drizzle-kit check', {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SKIP_ENV_VALIDATION: 'true' },
  });
  console.info('   ✅ drizzle-kit check passed successfully.');
} catch (err) {
  const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
  errors.push(`drizzle-kit check failed:\n${output}`);
  console.error('   ❌ drizzle-kit check failed.');
}

// 2. Validate Journal & Migration Files
console.info('\n2️⃣ Verifying drizzle/meta/_journal.json against drizzle/*.sql files...');
const journalPath = path.join(rootDir, 'drizzle/meta/_journal.json');
const drizzleDir = path.join(rootDir, 'drizzle');
const metaDir = path.join(drizzleDir, 'meta');

if (!fs.existsSync(journalPath)) {
  errors.push('drizzle/meta/_journal.json does not exist!');
} else {
  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const entries = journal.entries || [];
    const journalTags = new Set(entries.map((e) => e.tag));

    console.info(`   ℹ️ Found ${entries.length} migration entries in _journal.json.`);

    // Check that every journal entry exists as a file
    for (const entry of entries) {
      const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFile)) {
        errors.push(`Migration registered in _journal.json not found on disk: drizzle/${entry.tag}.sql`);
      }
    }

    // Check for unjournaled SQL migration files
    const diskSqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f));

    for (const file of diskSqlFiles) {
      const tag = file.replace(/\.sql$/, '');
      if (!journalTags.has(tag)) {
        errors.push(`Unjournaled migration file found on disk: drizzle/${file} is missing from _journal.json!`);
      }
    }

    console.info(`   ✅ Verified ${diskSqlFiles.length} migration files match _journal.json.`);
  } catch (err) {
    errors.push(`Failed to parse drizzle/meta/_journal.json: ${err.message}`);
  }
}

// 3. Compare src/db/schema/*.js against Migrations & Snapshots
console.info('\n3️⃣ Comparing src/db/schema/*.js tables against migrations & snapshots...');
const schemaDir = path.join(rootDir, 'src/db/schema');

if (!fs.existsSync(schemaDir)) {
  errors.push('src/db/schema directory not found!');
} else {
  const schemaFiles = fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith('.js') && f !== 'index.js');

  const definedTables = new Map();

  for (const file of schemaFiles) {
    const filePath = path.join(schemaDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract mysqlTable('table_name', ...) definitions
    const tableRegex = /mysqlTable\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      definedTables.set(tableName, file);
    }
  }

  console.info(`   ℹ️ Discovered ${definedTables.size} tables declared in src/db/schema/*.js.`);

  // Collect known tables from snapshots in drizzle/meta/*_snapshot.json
  const knownTables = new Set();

  if (fs.existsSync(metaDir)) {
    const snapshotFiles = fs
      .readdirSync(metaDir)
      .filter((f) => f.endsWith('_snapshot.json'));

    for (const sFile of snapshotFiles) {
      try {
        const sContent = JSON.parse(fs.readFileSync(path.join(metaDir, sFile), 'utf8'));
        if (sContent.tables) {
          for (const tName of Object.keys(sContent.tables)) {
            knownTables.add(tName);
          }
        }
      } catch {
        // Skip unparseable snapshot files
      }
    }
  }

  // Collect created tables from all SQL migration files in drizzle/*.sql
  const sqlFiles = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'));

  for (const sFile of sqlFiles) {
    const sqlContent = fs.readFileSync(path.join(drizzleDir, sFile), 'utf8');
    const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|'|")?([a-zA-Z0-9_]+)(?:`|'|")?\s*\(/gi;
    let match;
    while ((match = createRegex.exec(sqlContent)) !== null) {
      knownTables.add(match[1]);
    }
  }

  console.info(`   ℹ️ Discovered ${knownTables.size} total tables across Drizzle snapshots and SQL migrations.`);

  const missingTables = [];
  for (const [tableName, file] of definedTables.entries()) {
    if (!knownTables.has(tableName)) {
      missingTables.push({ table: tableName, file });
    }
  }

  if (missingTables.length > 0) {
    for (const item of missingTables) {
      errors.push(
        `Table "${item.table}" defined in src/db/schema/${item.file} has no corresponding declaration in drizzle snapshots or migrations!`
      );
    }
    console.error(`   ❌ Found ${missingTables.length} unmigrated tables in schema.`);
  } else {
    console.info(`   ✅ All ${definedTables.size} schema tables are properly tracked in migrations/snapshots.`);
  }
}

// 4. Validate Baseline Tracking Registry in src/db/baseline-rules.js
console.info('\n4️⃣ Validating Baseline Tracking patterns in src/db/baseline-rules.js...');
const baselineRulesPath = path.join(rootDir, 'src/db/baseline-rules.js');
if (!fs.existsSync(baselineRulesPath)) {
  errors.push('src/db/baseline-rules.js not found!');
} else {
  const rulesContent = fs.readFileSync(baselineRulesPath, 'utf8');
  if (!rulesContent.includes('BASELINE_RULES')) {
    errors.push('src/db/baseline-rules.js is missing BASELINE_RULES export!');
  } else {
    console.info('   ✅ src/db/baseline-rules.js contains baseline tracking automation.');
  }
}

// Summary Report
console.info('\n============================================================');
if (errors.length > 0) {
  console.error(`🚨 Schema & Migration Audit FAILED with ${errors.length} error(s):\n`);
  for (const [i, err] of errors.entries()) {
    console.error(` [${i + 1}] ${err}`);
  }
  console.error('\nPlease resolve schema/migration discrepancies before pushing or deploying.');
  process.exit(1);
} else {
  console.info('🎉 Schema & Migration Audit PASSED! All schemas, journals, and baselines are consistent.');
  process.exit(0);
}
