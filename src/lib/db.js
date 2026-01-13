import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Debugging: Log paths and dotenv result
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  console.log(`[DB_CONFIG] Current working directory: ${process.cwd()}`);
  console.log(`[DB_CONFIG] Attempting to load .env file from: ${envPath}`);
  
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error('[DB_CONFIG] Error loading .env.local file:', result.error);
  } else {
    console.log(`[DB_CONFIG] Successfully loaded .env.local file. Parsed content:`, result.parsed);
  }
} catch (e) {
  console.error('[DB_CONFIG] A critical error occurred during dotenv initialization:', e);
}


let pool;

export function getDb() {
  if (!pool) {
    // Log the environment variables that are being used for connection
    console.log(`[DB_CONNECT] Creating pool with user: ${process.env.DB_USER}, host: ${process.env.DB_HOST}, database: ${process.env.DB_DATABASE}`);
    
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}
