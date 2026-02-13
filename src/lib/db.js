import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Debugging: Log paths and dotenv result
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log(`[DB_CONFIG] Loading .env file from: ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.log(`[DB_CONFIG] .env.local not found, relying on system environment variables.`);
    dotenv.config(); // Load .env if it exists
  }
} catch (e) {
  console.error('[DB_CONFIG] Error during dotenv initialization:', e);
}


let pool;

function getPool() {
  if (!pool) {
    // Log the environment variables that are being used for connection
    console.log(`[DB_CONNECT] Creating pool with user: ${process.env.DB_USER}, host: ${process.env.DB_HOST}, database: ${process.env.DB_DATABASE}`);
    
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT, // Add this line
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export const getDb = getPool;

export async function query(sql, params) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}
