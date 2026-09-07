import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import logger from '../../../lib/logger';

// Load environment variables if not already loaded
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: process.env.NODE_ENV !== 'production' });
} else {
  dotenv.config();
}

let experimentPool = null;

/**
 * Resolves the configuration for the experimental college event database.
 * Supports dedicated EXPERIMENT_DB_* variables or falls back to main DB server with 'experiment_college_db'.
 */
export function getExperimentDbConfig() {
  const customUrl = process.env.EXPERIMENT_DATABASE_URL;
  if (customUrl) {
    const url = new URL(customUrl);
    const config = {
      host: url.hostname,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1) || 'experiment_college_db',
      port: Number(url.port) || 3306,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      idleTimeout: 30000,
      maxIdle: 0,
      typeCast: function (field, next) {
        if (field.type === 'JSON') return field.string('utf8');
        return next();
      },
    };

    if (url.searchParams.get('ssl') === 'true' || url.hostname.includes('tidbcloud.com')) {
      config.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
    }
    return config;
  }

  const host = process.env.EXPERIMENT_DB_HOST || process.env.DB_HOST || '127.0.0.1';
  const user = process.env.EXPERIMENT_DB_USER || process.env.DB_USER || 'cms_user';
  const password = process.env.EXPERIMENT_DB_PASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.EXPERIMENT_DB_DATABASE || 'experiment_college_db';
  const port = Number(process.env.EXPERIMENT_DB_PORT || process.env.DB_PORT || 3306);
  const sslFlag = process.env.EXPERIMENT_DB_SSL || process.env.DB_SSL;

  const poolConfig = {
    host,
    user,
    password,
    database,
    port,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 30000,
    maxIdle: 0,
    typeCast: function (field, next) {
      if (field.type === 'JSON') return field.string('utf8');
      return next();
    },
  };

  if (sslFlag === 'true' || host.includes('tidbcloud.com')) {
    poolConfig.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }

  return poolConfig;
}

/**
 * Returns the MySQL connection pool for experiment_college_db.
 */
export function getExperimentDb() {
  if (!experimentPool) {
    const config = getExperimentDbConfig();
    try {
      experimentPool = mysql.createPool(config);
      logger.info({ database: config.database, host: config.host }, '[EXPERIMENT_DB] Pool initialized successfully');
    } catch (err) {
      logger.error(err, '[EXPERIMENT_DB] Failed to create connection pool');
      throw err;
    }
  }
  return experimentPool;
}

/**
 * Executes a raw query against experiment_college_db with retry resilience.
 */
export async function queryExperimentDb(sql, params, retries = 2) {
  const pool = getExperimentDb();
  const sanitizedParams = params ? params.map(p => (p === undefined ? null : p)) : params;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [rows] = await pool.execute(sql, sanitizedParams);
      return rows;
    } catch (error) {
      const isConnectionError = error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST';
      if (isConnectionError && attempt < retries) {
        logger.warn({ attempt: attempt + 1, retries }, '[EXPERIMENT_DB] Retrying query on connection reset');
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      logger.error({ sql, err: error.message }, '[EXPERIMENT_DB_QUERY_ERROR]');
      throw error;
    }
  }
}
