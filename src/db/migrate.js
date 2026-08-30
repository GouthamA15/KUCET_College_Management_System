const { drizzle } = require('drizzle-orm/mysql2');
const { migrate } = require('drizzle-orm/mysql2/migrator');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
require('dotenv').config({ path: '.env.production', override: false });
require('dotenv').config({ path: 'DEPLOYMENT_PACKAGE/.env.production', override: false });

async function runMigrations() {
  console.info('⏳ Running database migrations via Drizzle ORM...');

  let dbConfig;
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (process.env.MIGRATE_HOST) url.hostname = process.env.MIGRATE_HOST;
    dbConfig = {
      host: url.hostname === 'db' ? '127.0.0.1' : url.hostname,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      port: Number(url.port) || 3306,
      multipleStatements: true,
      ssl: (url.searchParams.get('ssl') === 'true' || url.hostname.includes('tidbcloud.com')) ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      } : undefined,
    };
  } else {
    const rawHost = process.env.MIGRATE_HOST || process.env.DB_HOST || '127.0.0.1';
    dbConfig = {
      host: rawHost === 'db' ? '127.0.0.1' : rawHost,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: Number(process.env.DB_PORT) || 3306,
      multipleStatements: true,
      ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))) ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      } : undefined,
    };
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (connError) {
    const isConnRefused = connError.code === 'ECONNREFUSED' || connError.code === 'ENOTFOUND' || connError.errno === -111;
    const hasConfiguredCreds = !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1' && process.env.DB_HOST !== 'localhost'));
    
    if (isConnRefused && (process.env.CI || !hasConfiguredCreds)) {
      console.warn('⚠️ Database connection unavailable in CI environment (missing DB credentials/secrets). Skipping automated migrations cleanly.');
      return;
    }
    console.error('❌ Failed to connect to database for migration:', connError.message);
    process.exit(1);
  }

  const fs = require('fs');
  const db = drizzle(connection);
  const startTime = Date.now();

  try {
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
    const appliedTimestamps = new Set((existingMigRows || []).map(r => Number(r.created_at)));

    const journalPath = path.join(__dirname, '../../drizzle/meta/_journal.json');
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

      // Check 1: Historical 0000-0015 schema detection
      const [colCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "attendance_sessions" AND column_name = "topic_covered"'
      );
      if (colCheck && colCheck[0] && Number(colCheck[0].count) > 0) {
        const historicalEntries = entries.filter(e => e.idx < 16 && !appliedTimestamps.has(e.when));
        if (historicalEntries.length > 0) {
          console.info(`ℹ️ Existing historical schema detected. Baselining ${historicalEntries.length} historical migrations (0000-0015)...`);
          for (const entry of historicalEntries) {
            await baselineEntry(entry, 'historical schema exists');
          }
        }
      }

      // Check 2: 0016_reconcile_staff_and_hod_schema detection
      const entry0016 = entries.find(e => e.idx === 16);
      if (entry0016 && !appliedTimestamps.has(entry0016.when)) {
        const [deptCheck] = await connection.query(
          'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "academic_departments"'
        );
        if (deptCheck && deptCheck[0] && Number(deptCheck[0].count) > 0) {
          await baselineEntry(entry0016, 'academic_departments table already exists');
        }
      }

      // Check 3: 0017_add_staff_registration_address detection
      const entry0017 = entries.find(e => e.idx === 17);
      if (entry0017 && !appliedTimestamps.has(entry0017.when)) {
        const [addrCheck] = await connection.query(
          'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "staff_registration_requests" AND column_name = "address"'
        );
        if (addrCheck && addrCheck[0] && Number(addrCheck[0].count) > 0) {
          await baselineEntry(entry0017, 'staff_registration_requests.address column already exists');
        }
      }
    }

    // 4. Run Drizzle ORM official migration runner
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
    const elapsed = Date.now() - startTime;
    console.info(`✅ Migrations verified and executed successfully in ${elapsed}ms!`);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
