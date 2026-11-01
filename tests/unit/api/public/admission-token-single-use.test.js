import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { POST as admissionSubmissionHandler } from '@/app/api/public/admission/route.js';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    query: {
      studentAdmissionDrafts: { findFirst: vi.fn() },
      students: { findFirst: vi.fn() },
      staffAccounts: { findFirst: vi.fn() },
      studentPersonalDetails: { findFirst: vi.fn() },
      otpCodes: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 999 }]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true),
    })),
    transaction: vi.fn(async (cb) => cb(db)),
    select: vi.fn(),
  },
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  EMAIL_CATEGORIES: { AUTH_OTP: 'AUTH_OTP' },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getTieredKey: vi.fn((_req, key) => `mock_tiered_${key}`),
}));

vi.mock('@/lib/providers', () => ({
  storage: {
    upload: vi.fn().mockResolvedValue('kucet/admissions/mock-doc.jpg'),
    delete: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

describe('P3: Single-Use Admission Email Verification Token Enforcement', () => {
  const TEST_JWT_SECRET = 'temporary_admission_secret_at_least_32_chars!';
  const originalEnv = process.env;

  const validBaseForm = {
    name: 'Kavitha Devi',
    admission_year: '2026-2027',
    entrance_exam: 'TG EAPCET',
    branch: 'CSE',
    religion: 'Hindu',
    mother_tongue: 'Telugu',
    email: 'kavitha@kucet.ac.in',
    student_mobile: '9876543210',
    dob: '2008-04-12',
    gender: 'FEMALE',
    perm_house_no: '12-34',
    perm_street: 'Main Road',
    perm_city: 'Warangal',
    perm_state: 'Telangana',
    perm_pincode: '506009',
    legal_consent: true,
  };

  const createSubmissionRequest = (body) => {
    return new Request('http://localhost:3000/api/public/admission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    });
  };

  const generateToken = async ({ email = 'kavitha@kucet.ac.in', jti = crypto.randomUUID() } = {}) => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({
      verifiedEmail: email,
      purpose: 'student_admission_email',
      jti,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('2h')
      .sign(secret);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: TEST_JWT_SECRET,
      NODE_ENV: 'test',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    vi.mocked(db.query.studentAdmissionDrafts.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.students.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.staffAccounts.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.studentPersonalDetails.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.otpCodes.findFirst).mockResolvedValue(null);
  });

  it('records token consumption atomically in otpCodes upon successful submission', async () => {
    const tokenJti = crypto.randomUUID();
    const token = await generateToken({ jti: tokenJti });

    const insertedRecords = [];
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        insertedRecords.push(val);
        return Promise.resolve([{ insertId: 777 }]);
      }),
    });

    const res = await admissionSubmissionHandler(createSubmissionRequest({
      ...validBaseForm,
      verification_token: token,
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.draftId).toBe(777);

    // Verify token was marked consumed in otpCodes
    const tokenConsumedRecord = insertedRecords.find(
      (r) => r.identifier === `consumed_admission_token:${tokenJti}`
    );
    expect(tokenConsumedRecord).toBeDefined();
    expect(tokenConsumedRecord.otp_code).toBe('CONSUMED');
  });

  it('rejects duplicate submission when verification token is reused (single-use enforcement)', async () => {
    const tokenJti = crypto.randomUUID();
    const token = await generateToken({ jti: tokenJti });

    // Simulate that token was already consumed in previous request
    vi.mocked(db.query.otpCodes.findFirst).mockImplementation(({ where: _where }) => {
      return Promise.resolve({
        id: 1,
        identifier: `consumed_admission_token:${tokenJti}`,
        otp_code: 'CONSUMED',
        expires_at: new Date(Date.now() + 3600000),
      });
    });

    const res = await admissionSubmissionHandler(createSubmissionRequest({
      ...validBaseForm,
      verification_token: token,
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Verification token has already been used');
  });

  it('rejects submission during transaction if token is consumed concurrently', async () => {
    const tokenJti = crypto.randomUUID();
    const token = await generateToken({ jti: tokenJti });

    // Fast pre-check sees null, but transactional check finds it consumed (simulating race)
    let callCount = 0;
    vi.mocked(db.query.otpCodes.findFirst).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(null); // pre-check
      return Promise.resolve({ identifier: `consumed_admission_token:${tokenJti}` }); // inside transaction
    });

    const res = await admissionSubmissionHandler(createSubmissionRequest({
      ...validBaseForm,
      verification_token: token,
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Verification token has already been used');
  });

  it('preserves token as unconsumed when database draft insertion fails (rollback safety)', async () => {
    const tokenJti = crypto.randomUUID();
    const token = await generateToken({ jti: tokenJti });

    let tokenMarkedInTx = false;
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        if (val.identifier?.startsWith('consumed_admission_token')) {
          tokenMarkedInTx = true;
          return Promise.resolve();
        }
        // Draft insert fails
        return Promise.reject(new Error('ER_LOCK_DEADLOCK: Deadlock found when trying to get lock'));
      }),
    });

    // Simulate transaction rollback behavior: on error, tx rejects and no changes persist
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      try {
        return await callback(db);
      } catch (err) {
        // Rollback: revert state
        tokenMarkedInTx = false;
        throw err;
      }
    });

    const res = await admissionSubmissionHandler(createSubmissionRequest({
      ...validBaseForm,
      verification_token: token,
    }));

    // Should return 500 because draft insert threw deadlock
    expect(res.status).toBe(500);
    // Token was rolled back
    expect(tokenMarkedInTx).toBe(false);
  });
});
