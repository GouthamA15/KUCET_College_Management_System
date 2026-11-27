const path = require('path');
const fs = require('fs');

const VALID_TARGETS = new Set([
  'local',
  'development',
  'staging',
  'production-vps',
  'production-tidb',
]);

function sanitizeHost(hostStr) {
  const host = hostStr || 'unknown';
  if (host === '127.0.0.1' || host === 'localhost' || host === 'db') {
    return host;
  }
  return host.replace(/(.{4}).*(.{4}\.[^.]+$)/, '$1***$2');
}

/**
 * Loads environment variables strictly for the requested migration target
 * without overriding variables already exported by CI or deploy scripts.
 */
function loadMigrationEnv({ migrateTarget, cwd = process.cwd(), dotenv }) {
  const loadedFiles = [];
  const loadIfExists = (relPath) => {
    const fullPath = path.join(cwd, relPath);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false });
      loadedFiles.push(relPath);
    }
  };

  if (migrateTarget === 'production-vps') {
    loadIfExists('.env.production');
    loadIfExists('DEPLOYMENT_PACKAGE/.env.production');
  } else if (migrateTarget === 'production-tidb') {
    loadIfExists('.env.production');
  } else if (migrateTarget === 'staging') {
    loadIfExists('.env.staging');
    loadIfExists('.env');
  } else {
    // local / development / default: never auto-load .env.production
    loadIfExists('.env.local');
    loadIfExists('.env');
  }

  return loadedFiles;
}

/**
 * Resolves database connection configuration with deterministic precedence
 * and rejects ambiguous DATABASE_URL + MIGRATE_HOST combinations.
 */
function resolveMigrationConfig(env = process.env) {
  if (env.DATABASE_URL && env.MIGRATE_HOST) {
    throw new Error(
      'Ambiguous migration target: DATABASE_URL and MIGRATE_HOST cannot both be set. Use an explicit target or unset MIGRATE_HOST.'
    );
  }

  const connectTimeout = Number(env.DB_CONNECT_TIMEOUT) || 30000;

  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    const isTiDB = url.hostname.includes('tidbcloud.com');
    const host = url.hostname === 'db' ? '127.0.0.1' : url.hostname;
    const sslEnabled = url.searchParams.get('ssl') === 'true' || isTiDB;

    return {
      source: 'DATABASE_URL',
      host,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      port: Number(url.port) || (isTiDB ? 4000 : 3306),
      multipleStatements: true,
      connectTimeout,
      ssl: sslEnabled
        ? {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
          }
        : undefined,
    };
  }

  const rawHost = env.MIGRATE_HOST || env.DB_HOST || '127.0.0.1';
  const host = rawHost === 'db' ? '127.0.0.1' : rawHost;
  const isTiDB = host.includes('tidbcloud.com') || (env.DB_HOST && env.DB_HOST.includes('tidbcloud.com'));
  const sslEnabled = env.DB_SSL === 'true' || isTiDB;

  if (!env.DB_USER || !env.DB_DATABASE) {
    throw new Error(
      'Missing database migration credentials: set DATABASE_URL or DB_USER and DB_DATABASE.'
    );
  }

  return {
    source: env.MIGRATE_HOST ? 'MIGRATE_HOST+DB_*' : 'DB_*',
    host,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    port: Number(env.DB_PORT) || (isTiDB ? 4000 : 3306),
    multipleStatements: true,
    connectTimeout,
    ssl: sslEnabled
      ? {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        }
      : undefined,
  };
}

/**
 * Fail-closed target assertion preventing accidental cross-environment migrations.
 */
function assertMigrationTarget(dbConfig, env = process.env) {
  const target = env.MIGRATE_TARGET;
  const host = dbConfig.host || '';
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';
  const isTiDBHost = host.includes('tidbcloud.com');
  const confirmedProd = env.CONFIRM_PRODUCTION_MIGRATION === 'true';

  if (target && !VALID_TARGETS.has(target)) {
    throw new Error(
      `Invalid MIGRATE_TARGET="${target}". Expected one of: ${Array.from(VALID_TARGETS).join(', ')}.`
    );
  }

  // Never allow unconfirmed TiDB Cloud migrations even if MIGRATE_TARGET is omitted
  if (!target && isTiDBHost) {
    throw new Error(
      'Refusing unguarded migration against TiDB Cloud. Set MIGRATE_TARGET=production-tidb and CONFIRM_PRODUCTION_MIGRATION=true.'
    );
  }

  if (target === 'local' || target === 'development') {
    if (!isLocalHost || isTiDBHost) {
      throw new Error(
        `Target assertion failed for MIGRATE_TARGET=${target}: resolved host "${sanitizeHost(host)}" is not local.`
      );
    }
  } else if (target === 'staging') {
    if (isTiDBHost && env.ALLOW_STAGING_TIDB !== 'true') {
      throw new Error(
        `Target assertion failed for MIGRATE_TARGET=staging: resolved host "${sanitizeHost(host)}" is TiDB Cloud.`
      );
    }
    if (!host) {
      throw new Error('Target assertion failed for MIGRATE_TARGET=staging: empty database host.');
    }
  } else if (target === 'production-vps') {
    if (!isLocalHost || isTiDBHost) {
      throw new Error(
        `Target assertion failed for MIGRATE_TARGET=production-vps: expected local VPS MySQL host, got "${sanitizeHost(host)}".`
      );
    }
    if (!confirmedProd) {
      throw new Error(
        'Target assertion failed for MIGRATE_TARGET=production-vps: CONFIRM_PRODUCTION_MIGRATION=true is required.'
      );
    }
  } else if (target === 'production-tidb') {
    if (!isTiDBHost) {
      throw new Error(
        `Target assertion failed for MIGRATE_TARGET=production-tidb: expected tidbcloud.com host, got "${sanitizeHost(host)}".`
      );
    }
    if (!dbConfig.ssl) {
      throw new Error(
        'Target assertion failed for MIGRATE_TARGET=production-tidb: TLS/SSL is required for TiDB Cloud.'
      );
    }
    if (!confirmedProd) {
      throw new Error(
        'Target assertion failed for MIGRATE_TARGET=production-tidb: CONFIRM_PRODUCTION_MIGRATION=true is required.'
      );
    }
  }

  return {
    target: target || 'default-local',
    sanitizedHost: sanitizeHost(host),
    port: dbConfig.port,
    database: dbConfig.database,
    ssl: !!dbConfig.ssl,
    source: dbConfig.source,
  };
}

module.exports = {
  VALID_TARGETS,
  sanitizeHost,
  loadMigrationEnv,
  resolveMigrationConfig,
  assertMigrationTarget,
};
