import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  sanitizeHost,
  resolveMigrationConfig,
  assertMigrationTarget,
  loadMigrationEnv,
} = require('../../../src/db/migrate-config.js');

describe('Database Migration Config & Fail-Closed Target Assertion', () => {
  describe('sanitizeHost', () => {
    it('keeps local hostnames intact and masks remote hostnames', () => {
      expect(sanitizeHost('127.0.0.1')).toBe('127.0.0.1');
      expect(sanitizeHost('localhost')).toBe('localhost');
      expect(sanitizeHost('db')).toBe('db');
      const masked = sanitizeHost('gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
      expect(masked).toContain('***');
      expect(masked).not.toBe('gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
    });
  });

  describe('resolveMigrationConfig', () => {
    it('rejects ambiguous DATABASE_URL + MIGRATE_HOST combination', () => {
      expect(() =>
        resolveMigrationConfig({
          DATABASE_URL: 'mysql://user:pass@gateway01.tidbcloud.com:4000/kucet_cms',
          MIGRATE_HOST: '127.0.0.1',
        })
      ).toThrow(/Ambiguous migration target/i);
    });

    it('resolves TiDB Cloud DATABASE_URL with TLSv1.2 and port 4000', () => {
      const cfg = resolveMigrationConfig({
        DATABASE_URL: 'mysql://user:p%40ss@gateway01.ap-southeast-1.prod.aws.tidbcloud.com/kucet_cms',
      });
      expect(cfg.source).toBe('DATABASE_URL');
      expect(cfg.host).toBe('gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
      expect(cfg.port).toBe(4000);
      expect(cfg.password).toBe('p@ss');
      expect(cfg.database).toBe('kucet_cms');
      expect(cfg.ssl).toEqual({ minVersion: 'TLSv1.2', rejectUnauthorized: true });
    });

    it('maps Docker DB_HOST=db to 127.0.0.1 when MIGRATE_HOST is used without DATABASE_URL', () => {
      const cfg = resolveMigrationConfig({
        DB_HOST: 'db',
        MIGRATE_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_PASSWORD: 'secret',
        DB_DATABASE: 'kucet_cms',
        DB_PORT: '3306',
        DB_SSL: 'false',
      });
      expect(cfg.source).toBe('MIGRATE_HOST+DB_*');
      expect(cfg.host).toBe('127.0.0.1');
      expect(cfg.port).toBe(3306);
      expect(cfg.ssl).toBeUndefined();
    });

    it('fails fast when DB_USER or DB_DATABASE is missing', () => {
      expect(() =>
        resolveMigrationConfig({
          DB_HOST: '127.0.0.1',
        })
      ).toThrow(/Missing database migration credentials/i);
    });
  });

  describe('assertMigrationTarget', () => {
    it('refuses unguarded TiDB Cloud migration when MIGRATE_TARGET is omitted', () => {
      const cfg = resolveMigrationConfig({
        DATABASE_URL: 'mysql://u:p@gateway01.tidbcloud.com:4000/kucet',
      });
      expect(() => assertMigrationTarget(cfg, {})).toThrow(/Refusing unguarded migration/i);
    });

    it('rejects TiDB host when MIGRATE_TARGET=local', () => {
      const cfg = resolveMigrationConfig({
        DATABASE_URL: 'mysql://u:p@gateway01.tidbcloud.com:4000/kucet',
      });
      expect(() =>
        assertMigrationTarget(cfg, { MIGRATE_TARGET: 'local' })
      ).toThrow(/not local/i);
    });

    it('allows local MySQL when MIGRATE_TARGET=local', () => {
      const cfg = resolveMigrationConfig({
        DB_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_DATABASE: 'kucet_test',
      });
      const summary = assertMigrationTarget(cfg, { MIGRATE_TARGET: 'local' });
      expect(summary.target).toBe('local');
      expect(summary.sanitizedHost).toBe('127.0.0.1');
    });

    it('requires CONFIRM_PRODUCTION_MIGRATION=true for production-vps and production-tidb', () => {
      const vpsCfg = resolveMigrationConfig({
        DB_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_DATABASE: 'kucet_cms',
      });
      expect(() =>
        assertMigrationTarget(vpsCfg, { MIGRATE_TARGET: 'production-vps' })
      ).toThrow(/CONFIRM_PRODUCTION_MIGRATION=true is required/i);

      const okVps = assertMigrationTarget(vpsCfg, {
        MIGRATE_TARGET: 'production-vps',
        CONFIRM_PRODUCTION_MIGRATION: 'true',
      });
      expect(okVps.target).toBe('production-vps');

      const tidbCfg = resolveMigrationConfig({
        DATABASE_URL: 'mysql://u:p@gateway01.tidbcloud.com:4000/kucet_cms',
      });
      expect(() =>
        assertMigrationTarget(tidbCfg, { MIGRATE_TARGET: 'production-tidb' })
      ).toThrow(/CONFIRM_PRODUCTION_MIGRATION=true is required/i);

      const okTidb = assertMigrationTarget(tidbCfg, {
        MIGRATE_TARGET: 'production-tidb',
        CONFIRM_PRODUCTION_MIGRATION: 'true',
      });
      expect(okTidb.target).toBe('production-tidb');
      expect(okTidb.ssl).toBe(true);
    });

    it('rejects unknown MIGRATE_TARGET', () => {
      const cfg = resolveMigrationConfig({
        DB_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_DATABASE: 'kucet_test',
      });
      expect(() =>
        assertMigrationTarget(cfg, { MIGRATE_TARGET: 'unknown-env' })
      ).toThrow(/Invalid MIGRATE_TARGET/i);
    });
  });

  describe('loadMigrationEnv', () => {
    it('never loads .env.production when target is local', () => {
      const calls = [];
      const mockDotenv = {
        config: (opts) => calls.push(opts),
      };
      loadMigrationEnv({
        migrateTarget: 'local',
        cwd: process.cwd(),
        dotenv: mockDotenv,
      });
      for (const c of calls) {
        expect(c.path).not.toContain('.env.production');
        expect(c.override).toBe(false);
      }
    });
  });
});
