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

// Fail-fast environment validation
import './env.js';

let pool;

export function getDb() {
  if (!pool) {
    const poolConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT || 3306,
      dateStrings: true, // Prevent timezone conversion issues
      waitForConnections: true,
      connectionLimit: 25,
      queueLimit: 0,
      // PRODUCTION HARDENING:
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      idleTimeout: 60000, // Close idle connections after 60 seconds
      maxIdle: 25, // Max idle connections, the same as the connection limit
    };

    // TiDB Cloud and many production databases require SSL
    if (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))) {
      poolConfig.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      };
      console.log('[DB] SSL/TLS Encryption enabled for database connection.');
    }

    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

/**
 * Executes a SQL query with automatic retry logic for connection resets (ECONNRESET)
 */
export async function query(sql, params, retries = 2) {
  const db = getDb();
  
  // PERMANENT FIX: Ensure no 'undefined' values are passed as bind parameters.
  // mysql2 throws an error if a parameter is undefined; we convert them to null.
  const sanitizedParams = params ? params.map(p => p === undefined ? null : p) : params;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [rows] = await db.execute(sql, sanitizedParams);
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
