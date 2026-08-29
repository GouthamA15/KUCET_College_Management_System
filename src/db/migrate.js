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

    // 2. Check maximum applied migration timestamp in __drizzle_migrations
    const [migRows] = await connection.query('SELECT MAX(created_at) as max_created_at FROM `__drizzle_migrations`');
    const maxCreatedAt = migRows && migRows[0] && migRows[0].max_created_at ? Number(migRows[0].max_created_at) : 0;

    if (maxCreatedAt < 1787960000000) {
      // 3. Check if existing schema already has historical columns (e.g., topic_covered on attendance_sessions)
      const [colCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "attendance_sessions" AND column_name = "topic_covered"'
      );
      if (colCheck && colCheck[0] && Number(colCheck[0].count) > 0) {
        console.info(`ℹ️ Existing historical schema detected (max migration: ${maxCreatedAt}). Baselining migrations up to 0015 in __drizzle_migrations...`);
        const journalPath = path.join(__dirname, '../../drizzle/meta/_journal.json');
        if (fs.existsSync(journalPath)) {
          const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
          const historicalEntries = (journal.entries || []).filter(e => e.idx < 16 && e.when > maxCreatedAt);
          for (const entry of historicalEntries) {
            await connection.query(
              'INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)',
              ['', entry.when]
            );
          }
          console.info(`✅ Successfully baselined ${historicalEntries.length} historical migrations.`);
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
