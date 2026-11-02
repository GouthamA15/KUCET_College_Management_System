import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Import route handlers
import { POST as studentLogin } from '@/app/api/student/login/route';
import { POST as sendEmailOtp } from '@/app/api/student/send-update-email-otp/route';
import { POST as verifyEmailOtp } from '@/app/api/student/verify-update-email-otp/route';
import { POST as setPassword, GET as getPasswordStatus } from '@/app/api/student/set-password/route';

import { db } from '@/db';
import { checkRateLimit } from '@/lib/rate-limit';
import * as apiUtils from '@/lib/api-utils';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      students: {
        findFirst: vi.fn(),
      },
      otpCodes: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getTieredKey: vi.fn((req, key) => key),
}));

vi.mock('@/services/SecurityService', () => ({
  default: {
    updateLastLogin: vi.fn().mockResolvedValue(true),
    logSecurityEvent: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  issueStudentAuthCookie: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  EMAIL_CATEGORIES: {
    AUTH_OTP: 'AUTH_OTP',
  },
}));

const makeRequest = (body, headers = {}) => ({
  method: 'POST',
  json: async () => body,
  headers: {
    get: (name) => {
      const lower = name.toLowerCase();
      if (lower === 'x-forwarded-for') return headers['x-forwarded-for'] || '127.0.0.1';
      if (lower === 'user-agent') return headers['user-agent'] || 'Mozilla/5.0 TestBrowser';
      return headers[lower] || null;
    },
  },
});

describe('Resumable First-Time Student Login & Email Verification Suite (PART 3 & PART 6)', () => {
  const TEST_ROLLNO = '24567T0942';
  const TEST_DOB_STRING = '2005-02-22';
  const TEST_EMAIL = 'student.24567t0942@kucet.ac.in';

  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ success: true });
  });

  describe('Scenario A: Exit before OTP verification (3.2)', () => {
    it('allows student to exit before OTP verification and resume cleanly with DOB', async () => {
      // 1. Initial State in DB: account exists, email unverified, no password hash
      const studentRecord = {
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: false,
        email: null,
        date_of_birth: TEST_DOB_STRING,
        password_hash: null,
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      };

      // Mock DB select for login
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([studentRecord]),
            }),
          }),
        }),
      });

      // Student logs in with slash format DD/MM/YYYY
      const loginReq = makeRequest({
        rollno: TEST_ROLLNO,
        dob: '22/02/2005',
        rememberMe: false,
      });

      const loginRes = await studentLogin(loginReq);
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);
      expect(loginData.student.roll_no).toBe(TEST_ROLLNO);
      expect(loginData.student.is_email_verified).toBe(false);

      // 2. Student requests OTP
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: false,
      });

      // DB check for existing email uniqueness
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]), // email is unique
          }),
        }),
      });

      db.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce(true),
      });

      const otpReq = makeRequest({ email: TEST_EMAIL });
      const otpRes = await sendEmailOtp(otpReq);
      expect(otpRes.status).toBe(200);

      // 3. SIMULATE BROWSER / SESSION LOSS (Exit before entering OTP)
      // Student closes browser. Next day, returns to home screen and logs in again with compact DOB (DDMMYYYY).
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([studentRecord]),
            }),
          }),
        }),
      });

      const resumeLoginReq = makeRequest({
        rollno: TEST_ROLLNO,
        dob: '22022005', // compact format
        rememberMe: false,
      });

      const resumeLoginRes = await studentLogin(resumeLoginReq);
      expect(resumeLoginRes.status).toBe(200);
      const resumeLoginData = await resumeLoginRes.json();
      expect(resumeLoginData.success).toBe(true);
      expect(resumeLoginData.student.is_email_verified).toBe(false);

      // 4. Student can safely request a fresh OTP without lockout
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: false,
      });

      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      db.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce(true),
      });

      const freshOtpReq = makeRequest({ email: TEST_EMAIL });
      const freshOtpRes = await sendEmailOtp(freshOtpReq);
      expect(freshOtpRes.status).toBe(200);
    });
  });

  describe('Scenario B: Exit after OTP verification (3.3)', () => {
    it('persists verified-email state and resumes directly to password setup without repeating OTP', async () => {
      // 1. Initial State in DB: Student has completed email verification, but NOT set password
      const verifiedStudentInDb = {
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: true, // Persisted in DB!
        email: TEST_EMAIL,
        date_of_birth: TEST_DOB_STRING,
        password_hash: null, // Password setup pending!
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      };

      // 2. Student reopens browser, inputs roll number and DOB
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([verifiedStudentInDb]),
            }),
          }),
        }),
      });

      const resumeLoginReq = makeRequest({
        rollno: TEST_ROLLNO,
        dob: '22-02-2005',
        rememberMe: false,
      });

      const loginRes = await studentLogin(resumeLoginReq);
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);

      // Backend authoritative state recognizes email is ALREADY verified
      expect(loginData.student.is_email_verified).toBe(true);
      expect(loginData.student.email).toBe(TEST_EMAIL);

      // 3. Password setup status GET endpoint returns verified email & pending password
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });
      db.query.students.findFirst.mockResolvedValueOnce({
        password_hash: null,
        is_email_verified: true,
      });

      const statusReq = {
        url: `http://localhost:3000/api/student/set-password?rollno=${TEST_ROLLNO}`,
      };
      const statusRes = await getPasswordStatus(statusReq);
      expect(statusRes.status).toBe(200);
      const statusData = await statusRes.json();
      expect(statusData.isPasswordSet).toBe(false);
      expect(statusData.isEmailVerified).toBe(true);
    });
  });

  describe('Scenario C: Exit during permanent password setup (3.4)', () => {
    it('allows student to retry permanent password setup after interruption without account duplication', async () => {
      const verifiedStudent = {
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: true,
        email: TEST_EMAIL,
        password_hash: null,
      };

      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      db.query.students.findFirst.mockResolvedValueOnce(verifiedStudent);
      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce(true),
        }),
      });
      db.query.students.findFirst.mockResolvedValueOnce({
        ...verifiedStudent,
        password_hash: 'new_hashed_password',
      });

      const setPassReq = makeRequest({
        rollno: TEST_ROLLNO,
        password: 'PermanentPassword@2026',
        currentPassword: null,
      });

      const res = await setPassword(setPassReq);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('Password set successfully');
    });
  });

  describe('Scenario D: Normal login works, DOB credential retired (3.5)', () => {
    it('accepts permanent password for normal login and rejects initial DOB credential', async () => {
      const permanentPassword = 'PermanentPassword@2026';
      const permanentHash = await bcrypt.hash(permanentPassword, 12);

      const fullyActivatedStudent = {
        id: 42,
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: true,
        email: TEST_EMAIL,
        date_of_birth: TEST_DOB_STRING,
        password_hash: permanentHash, // Permanent password active!
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      };

      // Attempt 1: Normal login using permanent password -> MUST SUCCEED (200)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([fullyActivatedStudent]),
            }),
          }),
        }),
      });

      const normalLoginReq = makeRequest({
        rollno: TEST_ROLLNO,
        dob: permanentPassword, // Sent in password/dob field
        rememberMe: true,
      });

      const normalRes = await studentLogin(normalLoginReq);
      expect(normalRes.status).toBe(200);
      const normalData = await normalRes.json();
      expect(normalData.success).toBe(true);
      expect(normalData.student.roll_no).toBe(TEST_ROLLNO);

      // Attempt 2: Login using initial DOB -> MUST FAIL (401 INVALID_CREDENTIALS)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([fullyActivatedStudent]),
            }),
          }),
        }),
      });

      const dobLoginReq = makeRequest({
        rollno: TEST_ROLLNO,
        dob: '22-02-2005', // Attempt to use initial DOB
        rememberMe: false,
      });

      const dobRes = await studentLogin(dobLoginReq);
      expect(dobRes.status).toBe(401);
      const dobData = await dobRes.json();
      expect(dobData.code).toBe('INVALID_CREDENTIALS');
      // Helpful message informing student to use their updated password
      expect(dobData.details?.message).toContain('If you have already changed your password from the default date of birth, use your updated password');
    });
  });

  describe('Security & Invariant Protections', () => {
    it('REJECTS password setup if email has not been verified (prevents email bypass)', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      // Student has no password AND unverified email
      db.query.students.findFirst.mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        password_hash: null,
        is_email_verified: false, // NOT VERIFIED
      });

      const setPassReq = makeRequest({
        rollno: TEST_ROLLNO,
        password: 'BypassPassword@2026',
        currentPassword: null,
      });

      const res = await setPassword(setPassReq);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(body.error).toContain('Email verification is required');
    });

    it('PREVENTS cross-student password setup (IDOR protection)', async () => {
      // Authenticated user is student A
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: '24567T0001',
        role: 'student',
      });

      // Attempting to modify password for student B
      const setPassReq = makeRequest({
        rollno: '24567T0002',
        password: 'AttackerPassword@2026',
      });

      const res = await setPassword(setPassReq);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });

    it('rejects expired OTP with proper error message', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      const rawOtp = '654321';
      const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');

      // OTP expired 5 minutes ago
      db.query.otpCodes.findFirst.mockResolvedValueOnce({
        id: 99,
        identifier: TEST_ROLLNO,
        otp_code: hashedOtp,
        expires_at: new Date(Date.now() - 5 * 60 * 1000),
      });

      db.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });

      const verifyReq = makeRequest({
        otp: rawOtp,
        email: TEST_EMAIL,
      });

      const res = await verifyEmailOtp(verifyReq);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('OTP has expired. Please request a new one.');
    });

    it('rejects incorrect OTP with timing-safe comparison', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      const validOtp = '123456';
      const storedHash = crypto.createHash('sha256').update(validOtp).digest('hex');

      db.query.otpCodes.findFirst.mockResolvedValueOnce({
        id: 99,
        identifier: TEST_ROLLNO,
        otp_code: storedHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // valid expiry
      });

      const verifyReq = makeRequest({
        otp: '999999', // Incorrect OTP
        email: TEST_EMAIL,
      });

      const res = await verifyEmailOtp(verifyReq);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid or expired OTP.');
    });
  });

  describe('Retries, Concurrent Requests & Interrupted Requests (Verification Item 3)', () => {
    it('handles repeated OTP send requests safely by deleting prior codes and generating a fresh code', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({
        roll_no: TEST_ROLLNO,
        name: 'Arjun Reddy',
        is_email_verified: false,
      });

      // Email uniqueness check succeeds
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      let deletedRollno = null;
      let insertedValues = null;

      db.delete.mockReturnValue({
        where: vi.fn().mockImplementation((_condition) => {
          deletedRollno = TEST_ROLLNO;
          return Promise.resolve(true);
        }),
      });

      db.insert.mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return Promise.resolve(true);
        }),
      });

      // First OTP request
      const req1 = makeRequest({ email: TEST_EMAIL });
      const res1 = await sendEmailOtp(req1);
      expect(res1.status).toBe(200);
      expect(deletedRollno).toBe(TEST_ROLLNO);
      expect(insertedValues.identifier).toBe(TEST_ROLLNO);

      // Repeated OTP request (retry / resend)
      const req2 = makeRequest({ email: TEST_EMAIL });
      const res2 = await sendEmailOtp(req2);
      expect(res2.status).toBe(200);
      expect(deletedRollno).toBe(TEST_ROLLNO);
      expect(insertedValues.identifier).toBe(TEST_ROLLNO);
      // Both succeeded cleanly without DB conflict or orphaned duplicate rows
    });

    it('safely handles concurrent or repeated OTP verification submissions (single-use OTP)', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      const validOtp = '123456';
      const storedHash = crypto.createHash('sha256').update(validOtp).digest('hex');

      // Request 1 arrives: OTP exists
      db.query.otpCodes.findFirst.mockResolvedValueOnce({
        id: 101,
        identifier: TEST_ROLLNO,
        otp_code: storedHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      });

      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce(true),
        }),
      });

      db.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });

      db.query.students.findFirst.mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        email: TEST_EMAIL,
        is_email_verified: true,
      });

      const verifyReq1 = makeRequest({ otp: validOtp, email: TEST_EMAIL });
      const res1 = await verifyEmailOtp(verifyReq1);
      expect(res1.status).toBe(200);

      // Concurrent Request 2 arrives: OTP already consumed/deleted from database
      db.query.otpCodes.findFirst.mockResolvedValueOnce(null);

      const verifyReq2 = makeRequest({ otp: validOtp, email: TEST_EMAIL });
      const res2 = await verifyEmailOtp(verifyReq2);
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toBe('Invalid or expired OTP.');
    });

    it('persists verification state authoritatively even if client network drops after DB commit', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      const validOtp = '555888';
      const storedHash = crypto.createHash('sha256').update(validOtp).digest('hex');

      db.query.otpCodes.findFirst.mockResolvedValueOnce({
        id: 202,
        identifier: TEST_ROLLNO,
        otp_code: storedHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      });

      let updatedState = null;
      db.update.mockReturnValueOnce({
        set: vi.fn().mockImplementation((state) => {
          updatedState = state;
          return {
            where: vi.fn().mockResolvedValueOnce(true),
          };
        }),
      });

      db.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });

      db.query.students.findFirst.mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        email: TEST_EMAIL,
        is_email_verified: true,
      });

      const verifyReq = makeRequest({ otp: validOtp, email: TEST_EMAIL });
      const res = await verifyEmailOtp(verifyReq);
      expect(res.status).toBe(200);

      // Verify the state was written into the DB authoritatively
      expect(updatedState.is_email_verified).toBe(true);
      expect(updatedState.email).toBe(TEST_EMAIL);
      expect(updatedState.email_verified_at).toBeInstanceOf(Date);

      // When the student reconnects on next login, the DB record reflects the verified state
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([{
                id: 42,
                roll_no: TEST_ROLLNO,
                name: 'Arjun Reddy',
                is_email_verified: true,
                email: TEST_EMAIL,
                date_of_birth: TEST_DOB_STRING,
                password_hash: null,
                student_status: 'ACTIVE',
                academic_status: 'ACTIVE',
              }]),
            }),
          }),
        }),
      });

      const reconnectReq = makeRequest({ rollno: TEST_ROLLNO, dob: '22-02-2005' });
      const reconnectRes = await studentLogin(reconnectReq);
      expect(reconnectRes.status).toBe(200);
      const reconnectData = await reconnectRes.json();
      expect(reconnectData.student.is_email_verified).toBe(true);
      expect(reconnectData.student.email).toBe(TEST_EMAIL);
    });

    it('handles repeated password setup safely and requires current password once set', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({
        roll_no: TEST_ROLLNO,
        role: 'student',
      });

      const hashedPassword = await bcrypt.hash('StrongPass@123', 12);

      // Once password is set in DB:
      db.query.students.findFirst.mockResolvedValueOnce({
        id: 42,
        roll_no: TEST_ROLLNO,
        password_hash: hashedPassword, // Already set!
        is_email_verified: true,
      });

      // Repeated first-time setup request without currentPassword
      const retryReq = makeRequest({
        rollno: TEST_ROLLNO,
        password: 'AnotherPass@456',
        currentPassword: null,
      });

      const retryRes = await setPassword(retryReq);
      expect(retryRes.status).toBe(400);
      const retryBody = await retryRes.json();
      expect(retryBody.error).toBe('Current password is required to change your password.');
    });
  });
});
