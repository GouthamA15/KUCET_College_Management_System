const { drizzle } = require('drizzle-orm/mysql2');
const { migrate } = require('drizzle-orm/mysql2/migrator');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

async function runMigrations() {
  console.log('⏳ Running migrations...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  });

  const db = drizzle(connection);

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
