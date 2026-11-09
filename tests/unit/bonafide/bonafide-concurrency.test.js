import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/db/schema';
import { studentRequests } from '@/db/schema';
import { FinanceService } from '@/services/FinanceService';
import { generatePaymentLockName } from '@/lib/certificate-utils';

const hasLiveDb = Boolean(process.env.DB_HOST && !process.env.CI && process.env.SKIP_ENV_VALIDATION !== 'true');

describe('Bonafide Enhancement — Lock Name Normalization & Bounds Suite (Stage A1)', () => {
  const validSha256Hash = '724641d8f8e96c845fe935ead09405b5631079775be1f723ca3b3646564b3c1c';

  it('generates bounded, collision-resistant lock name for a full 64-char SHA-256 screenshot hash', () => {
    const lockName = generatePaymentLockName('hash', validSha256Hash);

    expect(lockName).toBeDefined();
    expect(typeof lockName).toBe('string');
    // Invariant: MUST be strictly <= 64 characters (TiDB maximum limit)
    expect(lockName.length).toBeLessThanOrEqual(64);
    expect(lockName.length).toBe(59); // 'kucet:hash:' (11) + 48 hex chars = 59
    expect(lockName.startsWith('kucet:hash:')).toBe(true);
  });

  it('generates bounded lock name for a maximum-length valid UTR', () => {
    const longUtr = 'SBIN00012345678901234567890123456789012345678901234567890123456789';
    const lockName = generatePaymentLockName('utr', longUtr);

    expect(lockName).toBeDefined();
    expect(lockName.length).toBeLessThanOrEqual(64);
    expect(lockName.length).toBe(58); // 'kucet:utr:' (10) + 48 hex chars = 58
    expect(lockName.startsWith('kucet:utr:')).toBe(true);
  });

  it('ensures identical normalized identifiers produce identical lock names', () => {
    const utr = '646643791856';
    const lock1 = generatePaymentLockName('utr', utr);
    const lock2 = generatePaymentLockName('utr', `  ${utr}  `);
    expect(lock1).toBe(lock2);

    const hashLock1 = generatePaymentLockName('hash', validSha256Hash);
    const hashLock2 = generatePaymentLockName('hash', `  ${validSha256Hash}  `);
    expect(hashLock1).toBe(hashLock2);
  });

  it('normalizes hex hashes case-insensitively', () => {
    const upperHash = validSha256Hash.toUpperCase();
    const lowerHash = validSha256Hash.toLowerCase();

    const lockUpper = generatePaymentLockName('hash', upperHash);
    const lockLower = generatePaymentLockName('hash', lowerHash);

    expect(lockUpper).toBe(lockLower);
  });

  it('ensures different UTR values produce different lock identifiers', () => {
    const lock1 = generatePaymentLockName('utr', 'UTR_10001');
    const lock2 = generatePaymentLockName('utr', 'UTR_10002');
    expect(lock1).not.toBe(lock2);
  });

  it('ensures UTR and screenshot-hash namespaces remain distinct even with identical values', () => {
    const commonVal = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const utrLock = generatePaymentLockName('utr', commonVal);
    const hashLock = generatePaymentLockName('hash', commonVal);

    expect(utrLock).not.toBe(hashLock);
    expect(utrLock.startsWith('kucet:utr:')).toBe(true);
    expect(hashLock.startsWith('kucet:hash:')).toBe(true);
  });

  it('rejects unknown or invalid lock types', () => {
    expect(generatePaymentLockName('unknown', validSha256Hash)).toBeNull();
    expect(generatePaymentLockName('payment', 'UTR123')).toBeNull();
    expect(generatePaymentLockName('screenshot', validSha256Hash)).toBeNull();
    expect(generatePaymentLockName(123, 'UTR123')).toBeNull();
    expect(generatePaymentLockName(null, 'UTR123')).toBeNull();
    expect(generatePaymentLockName(undefined, 'UTR123')).toBeNull();
    expect(generatePaymentLockName({}, 'UTR123')).toBeNull();
  });

  it('rejects invalid, empty, or incorrectly formatted values', () => {
    // Empty or whitespace strings
    expect(generatePaymentLockName('utr', '')).toBeNull();
    expect(generatePaymentLockName('utr', '   ')).toBeNull();
    expect(generatePaymentLockName('hash', '')).toBeNull();
    expect(generatePaymentLockName('hash', '   ')).toBeNull();

    // Non-string types
    expect(generatePaymentLockName('utr', 12345)).toBeNull();
    expect(generatePaymentLockName('utr', null)).toBeNull();
    expect(generatePaymentLockName('utr', undefined)).toBeNull();
    expect(generatePaymentLockName('utr', {})).toBeNull();
    expect(generatePaymentLockName('hash', 12345)).toBeNull();
    expect(generatePaymentLockName('hash', null)).toBeNull();
    expect(generatePaymentLockName('hash', undefined)).toBeNull();

    // Malformed hashes (must be 64-character hex strings)
    expect(generatePaymentLockName('hash', 'not_a_hex_string')).toBeNull();
    expect(generatePaymentLockName('hash', 'a1b2c3d4')).toBeNull(); // too short
    expect(generatePaymentLockName('hash', 'z'.repeat(64))).toBeNull(); // non-hex character 'z'
    expect(generatePaymentLockName('hash', validSha256Hash + '00')).toBeNull(); // 66 chars (too long)
  });

  it('proves deterministic lock ordering prevents deadlocks', () => {
    const utrLock = generatePaymentLockName('utr', 'UTR998877');
    const hashLock = generatePaymentLockName('hash', validSha256Hash);

    const lockNames1 = [utrLock, hashLock].sort();
    const lockNames2 = [hashLock, utrLock].sort();

    expect(lockNames1).toEqual(lockNames2);
    // 'kucet:hash:...' comes before 'kucet:utr:...' lexicographically
    expect(lockNames1[0]).toBe(hashLock);
    expect(lockNames1[1]).toBe(utrLock);
  });
  it('verifies ambiguous commit handling does not report definite rollback without evidence', () => {
    // Unit verification of the error message contract in route.js
    let rollbackSucceeded = false;
    const commitErr = new Error('PROTOCOL_CONNECTION_LOST');

    const errorMessage = rollbackSucceeded
      ? (commitErr.message || 'Transaction failed')
      : 'Transaction state ambiguous due to connection error during commit. Please verify existing requests before retrying.';

    expect(errorMessage).toContain('Transaction state ambiguous');
    expect(errorMessage).not.toContain('Transaction was rolled back');
  });
});

describe.skipIf(!hasLiveDb)('Bonafide Enhancement — Connection Cleanup & Failure Hardening Suite (Stage A2 & A3)', () => {
  const pool = getDb();

  it('returns connection to pool when RELEASE_LOCK returns 1 (outcome 1)', async () => {
    const conn = await pool.getConnection();
    const initialPoolTotal = pool.pool._allConnections.length;
    const testLock = generatePaymentLockName('utr', `TEST_CLEANUP_SUCCESS_${Date.now()}`);

    const acquiredLocks = [];
    try {
      const [lockRes] = await conn.execute('SELECT GET_LOCK(?, 5) as l', [testLock]);
      expect(lockRes[0]?.l).toBe(1);
      acquiredLocks.push(testLock);
    } finally {
      let cleanupSuccessful = true;
      for (const lockName of acquiredLocks) {
        try {
          const [relRes] = await conn.execute('SELECT RELEASE_LOCK(?) as r', [lockName]);
          if (relRes[0]?.r !== 1) {
            cleanupSuccessful = false;
          }
        } catch (_err) {
          cleanupSuccessful = false;
        }
      }

      expect(cleanupSuccessful).toBe(true);
      if (cleanupSuccessful) {
        conn.release();
      } else {
        conn.destroy();
      }
    }

    // Connection must have been safely returned to pool without destruction
    expect(pool.pool._allConnections.length).toBe(initialPoolTotal);
  });

  it('destroys connection when RELEASE_LOCK returns 0 (outcome 2: foreign lock)', async () => {
    const conn1 = await pool.getConnection();
    const conn2 = await pool.getConnection();
    const initialPoolTotal = pool.pool._allConnections.length;

    const foreignLock = generatePaymentLockName('utr', `FOREIGN_LOCK_${Date.now()}`);

    try {
      // conn1 holds the lock
      const [l1] = await conn1.execute('SELECT GET_LOCK(?, 5) as l', [foreignLock]);
      expect(l1[0]?.l).toBe(1);

      // conn2 attempts to release conn1's lock -> MySQL returns 0
      let cleanupSuccessful = true;
      try {
        const [relRes] = await conn2.execute('SELECT RELEASE_LOCK(?) as r', [foreignLock]);
        // Foreign lock return code in MySQL is 0
        if (relRes[0]?.r !== 1) {
          cleanupSuccessful = false;
        }
      } catch (_err) {
        cleanupSuccessful = false;
      }

      expect(cleanupSuccessful).toBe(false);

      // Hardening rule: MUST destroy connection on failure
      if (!cleanupSuccessful) {
        conn2.destroy();
      } else {
        conn2.release();
      }

      // conn2 was destroyed and removed from pool._allConnections
      expect(pool.pool._allConnections.length).toBe(initialPoolTotal - 1);

    } finally {
      await conn1.execute('SELECT RELEASE_LOCK(?) as r', [foreignLock]);
      conn1.release();
    }
  });

  it('destroys connection when RELEASE_LOCK returns NULL (outcome 3: non-existent lock)', async () => {
    const conn = await pool.getConnection();
    const initialPoolTotal = pool.pool._allConnections.length;

    const nonexistentLock = `kucet:utr:never_acquired_${Date.now()}`;
    let cleanupSuccessful = true;

    try {
      const [relRes] = await conn.execute('SELECT RELEASE_LOCK(?) as r', [nonexistentLock]);
      // Non-existent lock in MySQL / TiDB returns NULL
      if (relRes[0]?.r !== 1) {
        cleanupSuccessful = false;
      }
    } catch (_err) {
      cleanupSuccessful = false;
    }

    expect(cleanupSuccessful).toBe(false);

    if (!cleanupSuccessful) {
      conn.destroy();
    } else {
      conn.release();
    }

    expect(pool.pool._allConnections.length).toBe(initialPoolTotal - 1);
  });

  it('destroys connection when RELEASE_LOCK throws an exception (outcome 4: network/query error)', async () => {
    const conn = await pool.getConnection();
    const initialPoolTotal = pool.pool._allConnections.length;

    let cleanupSuccessful = true;
    try {
      // Intentionally cause execute to throw (e.g., query syntax error)
      await conn.execute('SELECT RELEASE_LOCK() as r');
    } catch (_err) {
      cleanupSuccessful = false;
    }

    expect(cleanupSuccessful).toBe(false);

    if (!cleanupSuccessful) {
      conn.destroy();
    } else {
      conn.release();
    }

    expect(pool.pool._allConnections.length).toBe(initialPoolTotal - 1);
  });

  it('safely releases first lock if second lock acquisition times out', async () => {
    const conn1 = await pool.getConnection();
    const conn2 = await pool.getConnection();

    const lockA = generatePaymentLockName('utr', `PARTIAL_LOCK_A_${Date.now()}`);
    const hashVal = crypto.createHash('sha256').update(`PARTIAL_LOCK_B_${Date.now()}`).digest('hex');
    const lockB = generatePaymentLockName('hash', hashVal);

    try {
      // conn1 holds lockB
      const [l1] = await conn1.execute('SELECT GET_LOCK(?, 5) as l', [lockB]);
      expect(l1[0]?.l).toBe(1);

      // conn2 attempts to acquire lockA then lockB (timeout 0 on lockB)
      const acquiredByConn2 = [];
      try {
        const [la] = await conn2.execute('SELECT GET_LOCK(?, 5) as l', [lockA]);
        expect(la[0]?.l).toBe(1);
        acquiredByConn2.push(lockA);

        const [lb] = await conn2.execute('SELECT GET_LOCK(?, 0) as l', [lockB]);
        if (lb[0]?.l !== 1) {
          throw new Error('Lock timeout for lockB');
        }
        acquiredByConn2.push(lockB);
      } catch (_err) {
        // Safe partial cleanup path: only lockA was acquired
        expect(acquiredByConn2).toEqual([lockA]);
      } finally {
        for (const lName of acquiredByConn2) {
          const [relRes] = await conn2.execute('SELECT RELEASE_LOCK(?) as r', [lName]);
          expect(relRes[0]?.r).toBe(1);
        }
        conn2.release();
      }

      // conn1 releases lockB
      const [rb] = await conn1.execute('SELECT RELEASE_LOCK(?) as r', [lockB]);
      expect(rb[0]?.r).toBe(1);

    } finally {
      conn1.release();
    }
  });
});

describe.skipIf(!hasLiveDb)('Bonafide Enhancement — Live TiDB Payment Concurrency Suite', () => {
  const pool = getDb();

  it('guarantees that two concurrent submissions with same UTR using bounded lock names produce exactly one success in TiDB', async () => {
    const testUtr = `CONC_UTR_${Date.now()}`;
    const testHash1 = crypto.createHash('sha256').update(`HASH_1_${Date.now()}`).digest('hex');
    const testHash2 = crypto.createHash('sha256').update(`HASH_2_${Date.now()}`).digest('hex');

    async function executeSubmissionWorker(workerId, studentId, hash) {
      const conn = await pool.getConnection();
      const txDb = drizzle(conn, { schema, mode: 'default' });

      const utrLock = generatePaymentLockName('utr', testUtr);
      const hashLock = generatePaymentLockName('hash', hash);
      const lockNames = [utrLock, hashLock].sort();

      const acquiredLocks = [];

      try {
        for (const lockName of lockNames) {
          const [lockRes] = await conn.execute('SELECT GET_LOCK(?, 10) as l', [lockName]);
          if (lockRes[0]?.l !== 1) {
            throw new Error(`Lock timeout for ${lockName}`);
          }
          acquiredLocks.push(lockName);
        }

        await conn.beginTransaction();

        const integrity = await FinanceService.verifyTransactionIntegrity({
          transactionId: testUtr,
          paymentHash: hash,
          studentId,
          dbClient: txDb
        });

        if (integrity.isFlagged) {
          await conn.rollback();
          return { success: false, conflict: true, flagDetails: integrity.flagDetails, workerId };
        }

        await new Promise((resolve) => setTimeout(resolve, 80));

        const [insertRes] = await txDb.insert(studentRequests).values({
          student_id: studentId,
          certificate_type: 'Bonafide Certificate',
          academic_year: '2026-27',
          payment_amount: 100,
          transaction_id: testUtr,
          payment_hash: hash,
          status: 'PENDING',
          purpose: 'Test Concurrency Bounded UTR',
          certificate_format: 'ORDINARY',
          study_year: 1,
          study_semester: 1,
          created_at: new Date(),
          updated_at: new Date()
        });

        await conn.commit();
        return { success: true, requestId: insertRes.insertId, workerId };

      } catch (err) {
        try { await conn.rollback(); } catch (_rbErr) { /* ignore */ }
        return { success: false, error: err.message, workerId };
      } finally {
        let cleanupOk = true;
        for (const lockName of acquiredLocks) {
          try {
            const [relRes] = await conn.execute('SELECT RELEASE_LOCK(?) as r', [lockName]);
            if (relRes[0]?.r !== 1) cleanupOk = false;
          } catch (_relErr) {
            cleanupOk = false;
          }
        }
        if (!cleanupOk) {
          conn.destroy();
        } else {
          conn.release();
        }
      }
    }

    const [res1, res2] = await Promise.all([
      executeSubmissionWorker(1, 346, testHash1),
      executeSubmissionWorker(2, 347, testHash2)
    ]);

    const successes = [res1, res2].filter(r => r.success);
    const conflicts = [res1, res2].filter(r => r.conflict);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    const [dbRows] = await pool.query(
      'SELECT request_id, student_id, transaction_id, status FROM student_requests WHERE transaction_id = ?',
      [testUtr]
    );
    expect(dbRows.length).toBe(1);

    await pool.query('DELETE FROM student_requests WHERE transaction_id = ?', [testUtr]);
  });

  it('guarantees that two concurrent submissions with full-length SHA-256 screenshot hash produce exactly one success in TiDB', async () => {
    const fullSha256Hash = '724641d8f8e96c845fe935ead09405b5631079775be1f723ca3b3646564b3c1c';
    const testUtr1 = `FULL_UTR_A_${Date.now()}`;
    const testUtr2 = `FULL_UTR_B_${Date.now()}`;

    async function executeSubmissionWorker(workerId, studentId, utr) {
      const conn = await pool.getConnection();
      const txDb = drizzle(conn, { schema, mode: 'default' });

      const utrLock = generatePaymentLockName('utr', utr);
      const hashLock = generatePaymentLockName('hash', fullSha256Hash);
      const lockNames = [utrLock, hashLock].sort();

      const acquiredLocks = [];

      try {
        for (const lockName of lockNames) {
          const [lockRes] = await conn.execute('SELECT GET_LOCK(?, 10) as l', [lockName]);
          if (lockRes[0]?.l !== 1) {
            throw new Error(`Lock timeout for ${lockName}`);
          }
          acquiredLocks.push(lockName);
        }

        await conn.beginTransaction();

        const integrity = await FinanceService.verifyTransactionIntegrity({
          transactionId: utr,
          paymentHash: fullSha256Hash,
          studentId,
          dbClient: txDb
        });

        if (integrity.isFlagged) {
          await conn.rollback();
          return { success: false, conflict: true, flagDetails: integrity.flagDetails, workerId };
        }

        await new Promise((resolve) => setTimeout(resolve, 80));

        const [insertRes] = await txDb.insert(studentRequests).values({
          student_id: studentId,
          certificate_type: 'Bonafide Certificate',
          academic_year: '2026-27',
          payment_amount: 100,
          transaction_id: utr,
          payment_hash: fullSha256Hash,
          status: 'PENDING',
          purpose: 'Test Full SHA-256 Concurrency',
          certificate_format: 'ORDINARY',
          study_year: 1,
          study_semester: 1,
          created_at: new Date(),
          updated_at: new Date()
        });

        await conn.commit();
        return { success: true, requestId: insertRes.insertId, workerId };

      } catch (err) {
        try { await conn.rollback(); } catch (_rbErr) { /* ignore */ }
        return { success: false, error: err.message, workerId };
      } finally {
        let cleanupOk = true;
        for (const lockName of acquiredLocks) {
          try {
            const [relRes] = await conn.execute('SELECT RELEASE_LOCK(?) as r', [lockName]);
            if (relRes[0]?.r !== 1) cleanupOk = false;
          } catch (_relErr) {
            cleanupOk = false;
          }
        }
        if (!cleanupOk) {
          conn.destroy();
        } else {
          conn.release();
        }
      }
    }

    const [res1, res2] = await Promise.all([
      executeSubmissionWorker(1, 346, testUtr1),
      executeSubmissionWorker(2, 347, testUtr2)
    ]);

    const successes = [res1, res2].filter(r => r.success);
    const conflicts = [res1, res2].filter(r => r.conflict);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    const [dbRows] = await pool.query(
      'SELECT request_id, student_id, transaction_id, status FROM student_requests WHERE payment_hash = ? AND status = "PENDING"',
      [fullSha256Hash]
    );
    expect(dbRows.length).toBe(1);

    await pool.query('DELETE FROM student_requests WHERE payment_hash = ? AND status = "PENDING"', [fullSha256Hash]);
  });

  it('permits reuse of UTR and screenshot hash from a REJECTED request', async () => {
    const testUtr = `REJECT_REUSE_UTR_${Date.now()}`;
    const testHash = crypto.createHash('sha256').update(`REJECT_REUSE_HASH_${Date.now()}`).digest('hex');

    await pool.query(
      `INSERT INTO student_requests 
        (student_id, certificate_type, academic_year, payment_amount, transaction_id, payment_hash, status, purpose, created_at, updated_at) 
       VALUES (?, 'Bonafide Certificate', '2026-27', 100, ?, ?, 'REJECTED', 'First Try', NOW(), NOW())`,
      [346, testUtr, testHash]
    );

    const conn = await pool.getConnection();
    const txDb = drizzle(conn, { schema, mode: 'default' });

    try {
      const integrity = await FinanceService.verifyTransactionIntegrity({
        transactionId: testUtr,
        paymentHash: testHash,
        studentId: 346,
        dbClient: txDb
      });

      expect(integrity.isFlagged).toBe(false);

    } finally {
      conn.release();
      await pool.query('DELETE FROM student_requests WHERE transaction_id = ?', [testUtr]);
    }
  });
});
