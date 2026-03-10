import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Debugging: Log paths and dotenv result
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(fs.realpathSync(envPath))) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config(); // Load .env if it exists
  }
} catch (e) {
  // Silent fail
}

let pool;

export function getDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT || 3306,
      dateStrings: true, // Prevent timezone conversion issues
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // PRODUCTION HARDENING:
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      idleTimeout: 60000, // Close idle connections after 60 seconds
      maxIdle: 10, // Max idle connections, the same as the connection limit
    });
  }
  return pool;
}

/**
 * Executes a SQL query with automatic retry logic for connection resets (ECONNRESET)
 */
export async function query(sql, params, retries = 2) {
  const db = getDb();
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [rows] = await db.execute(sql, params);
      return rows;
    } catch (error) {
      const isConnectionError = error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST';
      
      if (isConnectionError && attempt < retries) {
        console.warn(`[DB] Connection reset detected. Retrying attempt ${attempt + 1}/${retries}...`);
        // Add a tiny delay before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      
      // If it's not a connection reset or we're out of retries, throw the error
      console.error(`[DB_ERROR] Query failed after ${attempt + 1} attempts:`, error.message);
      throw error;
    }
  }
}
