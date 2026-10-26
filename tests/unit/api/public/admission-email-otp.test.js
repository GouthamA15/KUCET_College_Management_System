import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { POST as sendOtpHandler, maskEmail } from '@/app/api/public/admission/email/send-otp/route.js';
import { POST as verifyOtpHandler } from '@/app/api/public/admission/email/verify-otp/route.js';
import { POST as admissionSubmissionHandler } from '@/app/api/public/admission/route.js';
import { db } from '@/db';
import { otpCodes, studentAdmissionDrafts, students, staffAccounts } from '@/db/schema';
import * as emailLib from '@/lib/email';
import * as rateLimitLib from '@/lib/rate-limit';

// Mock DB
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
    select: vi.fn(),
  },
}));

// Mock Email
vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  EMAIL_CATEGORIES: { AUTH_OTP: 'AUTH_OTP' },
}));

// Mock Rate Limiting
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getTieredKey: vi.fn((req, key) => `mock_tiered_${key}`),
}));

// Mock Storage
vi.mock('@/lib/providers', () => ({
  storage: {
    upload: vi.fn().mockResolvedValue('kucet/admissions/mock-doc.jpg'),
    delete: vi.fn().mockResolvedValue(true),
  },
}));

// Mock SSE
vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn().mockResolvedValue(true),
}));

// Mock Logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, cb) => cb()),
  },
}));

// Mock Next.js Headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

describe('Student Admission Email OTP Verification Suite', () => {
  const TEST_JWT_SECRET = 'temporary_admission_secret_at_least_32_chars!';
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: TEST_JWT_SECRET,
      NODE_ENV: 'test',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
  });

  describe('Email Masking Helper', () => {
    it('masks emails securely with middle asterisks', () => {
      expect(maskEmail('student@kucet.ac.in')).toBe('s*****t@kucet.ac.in');
      expect(maskEmail('ab@domain.com')).toBe('a*@domain.com');
      expect(maskEmail('')).toBe('');
      expect(maskEmail(null)).toBe('');
    });
  });

  describe('1. OTP Issuance (send-otp)', () => {
    const createSendRequest = (body, ip = '192.168.1.10') => {
      return new Request('http://localhost:3000/api/public/admission/email/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify(body),
      });
    };

    it('rejects missing or invalid email format', async () => {
      const res1 = await sendOtpHandler(createSendRequest({ email: '' }));
      expect(res1.status).toBe(400);

      const res2 = await sendOtpHandler(createSendRequest({ email: 'invalid-email-address' }));
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain('valid email address');
    });

    it('enforces IP rate limiting (429)', async () => {
      vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce({ success: false, remaining: 0 });
      const res = await sendOtpHandler(createSendRequest({ email: 'student@example.com' }));
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain('Too many requests');
    });

    it('enforces email identifier rate limiting (429)', async () => {
      vi.mocked(rateLimitLib.checkRateLimit)
        .mockResolvedValueOnce({ success: true, remaining: 4 }) // IP check passes
        .mockResolvedValueOnce({ success: false, remaining: 0 }); // Email check fails

      const res = await sendOtpHandler(createSendRequest({ email: 'student@example.com' }));
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain('Too many verification requests');
    });

    it('rejects if email already exists in studentAdmissionDrafts', async () => {
      vi.mocked(db.query.studentAdmissionDrafts.findFirst).mockResolvedValueOnce({ id: 1, email: 'duplicate@example.com' });
      vi.mocked(db.query.students.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.query.staffAccounts.findFirst).mockResolvedValueOnce(null);

      const res = await sendOtpHandler(createSendRequest({ email: 'duplicate@example.com' }));
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already an application or account');
    });

    it('generates 6-digit OTP, stores SHA-256 hash in DB, and sends email', async () => {
      vi.mocked(db.query.studentAdmissionDrafts.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.query.students.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.query.staffAccounts.findFirst).mockResolvedValueOnce(null);

      const insertValuesSpy = vi.fn().mockResolvedValue([{ insertId: 1 }]);
      vi.mocked(db.insert).mockReturnValueOnce({ values: insertValuesSpy });

      const res = await sendOtpHandler(createSendRequest({ email: 'NEW_STUDENT@Example.com ' }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.maskedEmail).toBe('n*********t@example.com');

      // Verify DB delete and insert
      expect(db.delete).toHaveBeenCalled();
      expect(insertValuesSpy).toHaveBeenCalled();
      const insertedObj = insertValuesSpy.mock.calls[0][0];
      expect(insertedObj.identifier).toBe('admission:new_student@example.com');
      // Stored OTP must be a 64-character SHA-256 hex string, NOT plaintext
      expect(insertedObj.otp_code).toMatch(/^[a-f0-9]{64}$/);
      expect(insertedObj.expires_at).toBeInstanceOf(Date);

      // Verify email sending
      expect(emailLib.sendInstitutionalEmail).toHaveBeenCalledTimes(1);
      const emailCall = vi.mocked(emailLib.sendInstitutionalEmail).mock.calls[0][0];
      expect(emailCall.to).toBe('new_student@example.com');
      expect(emailCall.category).toBe('AUTH_OTP');
    });

    it('returns 500 when email delivery fails', async () => {
      vi.mocked(db.query.studentAdmissionDrafts.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.query.students.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.query.staffAccounts.findFirst).mockResolvedValueOnce(null);
      vi.mocked(emailLib.sendInstitutionalEmail).mockResolvedValueOnce({ success: false, message: 'SMTP error' });

      const res = await sendOtpHandler(createSendRequest({ email: 'student@example.com' }));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Unable to send verification email');
    });
  });

  describe('2. OTP Verification (verify-otp)', () => {
    const createVerifyRequest = (body) => {
      return new Request('http://localhost:3000/api/public/admission/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    it('rejects missing fields or non-6-digit OTP', async () => {
      const res1 = await verifyOtpHandler(createVerifyRequest({ email: 'student@example.com', otp: '123' }));
      expect(res1.status).toBe(400);

      const res2 = await verifyOtpHandler(createVerifyRequest({ email: '', otp: '123456' }));
      expect(res2.status).toBe(400);
    });

    it('enforces rate limiting on verification attempts (brute-force defense)', async () => {
      vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce({ success: false, remaining: 0 });
      const res = await verifyOtpHandler(createVerifyRequest({ email: 'student@example.com', otp: '123456' }));
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain('Too many failed verification attempts');
    });

    it('rejects if OTP record does not exist', async () => {
      vi.mocked(db.query.otpCodes.findFirst).mockResolvedValueOnce(null);
      const res = await verifyOtpHandler(createVerifyRequest({ email: 'student@example.com', otp: '123456' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid or expired verification code');
    });

    it('rejects expired OTP and deletes it from database', async () => {
      const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute in the past
      vi.mocked(db.query.otpCodes.findFirst).mockResolvedValueOnce({
        id: 55,
        identifier: 'admission:student@example.com',
        otp_code: crypto.createHash('sha256').update('123456').digest('hex'),
        expires_at: expiredDate,
      });

      const res = await verifyOtpHandler(createVerifyRequest({ email: 'student@example.com', otp: '123456' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Verification code has expired');
      expect(db.delete).toHaveBeenCalled();
    });

    it('rejects incorrect OTP (timing-safe comparison)', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      vi.mocked(db.query.otpCodes.findFirst).mockResolvedValueOnce({
        id: 55,
        identifier: 'admission:student@example.com',
        otp_code: crypto.createHash('sha256').update('654321').digest('hex'),
        expires_at: futureDate,
      });

      const res = await verifyOtpHandler(createVerifyRequest({ email: 'student@example.com', otp: '123456' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid verification code');
      // Must not delete valid OTP on bad guess (until max attempts hit)
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('verifies valid OTP, deletes record immediately (replay protection), and issues signed JWT', async () => {
      const correctOtp = '482915';
      const otpHash = crypto.createHash('sha256').update(correctOtp).digest('hex');
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);

      vi.mocked(db.query.otpCodes.findFirst).mockResolvedValueOnce({
        id: 77,
        identifier: 'admission:student@example.com',
        otp_code: otpHash,
        expires_at: futureDate,
      });

      const res = await verifyOtpHandler(createVerifyRequest({ email: ' student@Example.COM ', otp: correctOtp }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.verificationToken).toBeDefined();

      // Ensure single-use: record deleted immediately
      expect(db.delete).toHaveBeenCalled();

      // Verify JWT contents
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(data.verificationToken, secret);
      expect(payload.verifiedEmail).toBe('student@example.com');
      expect(payload.purpose).toBe('student_admission_email');
      expect(payload.jti).toBeDefined();
    });
  });

  describe('3. Admission Final Submission Enforcement (POST /api/public/admission)', () => {
    const validBaseForm = {
      name: 'RAMESH KUMAR',
      admission_year: '2026-2030',
      entrance_exam: 'TG EAPCET',
      branch: 'CSE',
      religion: 'HINDU',
      mother_tongue: 'TELUGU',
      email: 'student@kucet.ac.in',
      student_mobile: '9876543210',
      guardian_mobile: '9876543211',
      dob: '2005-05-15',
      gender: 'MALE',
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

    it('rejects submission when verification_token is missing (Bypass Prevention)', async () => {
      const res = await admissionSubmissionHandler(createSubmissionRequest({
        ...validBaseForm,
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Email verification is required');
    });

    it('rejects submission when verification_token is invalid or forged', async () => {
      const res = await admissionSubmissionHandler(createSubmissionRequest({
        ...validBaseForm,
        verification_token: 'invalid.forged.jwt-token',
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid or expired email verification token');
    });

    it('rejects submission when verification_token belongs to email A but submission is for email B', async () => {
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);
      const foreignToken = await new SignJWT({
        verifiedEmail: 'attacker@kucet.ac.in',
        purpose: 'student_admission_email',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(secret);

      const res = await admissionSubmissionHandler(createSubmissionRequest({
        ...validBaseForm,
        email: 'victim@kucet.ac.in',
        verification_token: foreignToken,
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('does not match the submitted email address');
    });

    it('rejects submission when token purpose is wrong (e.g. staff registration token)', async () => {
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);
      const wrongPurposeToken = await new SignJWT({
        verifiedEmail: 'student@kucet.ac.in',
        purpose: 'staff_registration_email',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(secret);

      const res = await admissionSubmissionHandler(createSubmissionRequest({
        ...validBaseForm,
        verification_token: wrongPurposeToken,
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('does not match');
    });

    it('accepts submission when valid matching token is provided', async () => {
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);
      const validToken = await new SignJWT({
        verifiedEmail: 'student@kucet.ac.in',
        purpose: 'student_admission_email',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(secret);

      vi.mocked(db.query.studentAdmissionDrafts.findFirst).mockResolvedValue(null);
      vi.mocked(db.query.students.findFirst).mockResolvedValue(null);
      vi.mocked(db.query.staffAccounts.findFirst).mockResolvedValue(null);
      vi.mocked(db.query.studentPersonalDetails.findFirst).mockResolvedValue(null);

      const insertSpy = vi.fn().mockResolvedValue([{ insertId: 888 }]);
      vi.mocked(db.insert).mockReturnValue({ values: insertSpy });

      const res = await admissionSubmissionHandler(createSubmissionRequest({
        ...validBaseForm,
        verification_token: validToken,
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.draftId).toBe(888);
    });
  });
});
