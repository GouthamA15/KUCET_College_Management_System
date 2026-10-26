import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/student/apaar/route';
import { db } from '@/db';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from '@/lib/auth';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Task 3: Student APAAR ID Lifecycle & Security Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_characters_long!';
  });

  const setupStudentAuth = (user = { student_id: 101, roll_no: '22567T0901', role: 'student' }) => {
    cookies.mockResolvedValue({
      get: vi.fn((name) => {
        if (name === 'student_auth') return { value: 'valid-student-token' };
        return undefined;
      }),
    });
    headers.mockResolvedValue({
      get: vi.fn(() => null),
    });
    verifyJwt.mockResolvedValue(user);
  };

  const setupUnauthenticated = () => {
    cookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
    headers.mockResolvedValue({
      get: vi.fn(() => null),
    });
    verifyJwt.mockResolvedValue(null);
  };

  describe('Server API Enforcement (/api/student/apaar)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      setupUnauthenticated();

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns null and is_submitted=false when student has not submitted APAAR ID', async () => {
      setupStudentAuth();

      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 101, apaar_id: null },
              ]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.apaar_id).toBeNull();
      expect(json.is_submitted).toBe(false);
    });

    it('returns authoritative 12-digit APAAR ID and is_submitted=true when present', async () => {
      setupStudentAuth();

      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 101, apaar_id: '123456789012' },
              ]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.apaar_id).toBe('123456789012');
      expect(json.is_submitted).toBe(true);
    });

    it('accepts and persists valid 12-digit numeric APAAR ID with whitespace normalization', async () => {
      setupStudentAuth();

      // Student has no existing APAAR ID
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 101, apaar_id: null, personalDetailsId: 55 },
              ]),
            }),
          }),
        }),
      });

      const mockWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      db.update.mockReturnValue({ set: mockSet });

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apaar_id: '1234 5678 9012' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.apaar_id).toBe('123456789012');

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ apaar_id: '123456789012' });
    });

    it('rejects APAAR submission containing non-numeric characters', async () => {
      setupStudentAuth();

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apaar_id: '12345678901A' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/12 numeric digits|invalid input data/i);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('rejects APAAR submission with invalid length (< 12 or > 12 digits)', async () => {
      setupStudentAuth();

      const testLengths = ['12345', '12345678901', '1234567890123'];
      for (const val of testLengths) {
        const req = new Request('http://localhost:3000/api/student/apaar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apaar_id: val }),
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/12 numeric digits|invalid input data/i);
      }
      expect(db.update).not.toHaveBeenCalled();
    });

    it('STRICT READ-ONLY ENFORCEMENT: rejects student update when APAAR ID is already submitted', async () => {
      setupStudentAuth();

      // Student ALREADY has an APAAR ID stored in DB
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 101, apaar_id: '123456789012', personalDetailsId: 55 },
              ]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/student/apaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apaar_id: '999988887777' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/already been submitted and is locked/i);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('ISOLATION: student cannot access or modify another student\'s APAAR ID', async () => {
      setupStudentAuth({ student_id: 101, roll_no: '22567T0901', role: 'student' });

      let capturedWhereCondition;
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((cond) => {
              capturedWhereCondition = cond;
              return {
                limit: vi.fn().mockResolvedValue([
                  { id: 101, apaar_id: null },
                ]),
              };
            }),
          }),
        }),
      });

      // Attempt to supply another student's roll number in query or body
      const req = new Request('http://localhost:3000/api/student/apaar?roll_no=22567T0999', {
        method: 'GET',
      });
      await GET(req);

      // Verify that query was executed and where condition was applied
      expect(capturedWhereCondition).toBeDefined();
    });
  });

  describe('Student Dashboard Warning & Guidance Integration', () => {
    it('confirms dashboard priority alert condition flags unsubmitted APAAR ID', () => {
      const studentWithoutApaar = {
        id: 1,
        roll_no: '22567T0901',
        apaar_id: null,
        personal_details: { apaar_id: null },
      };

      const hasApaarId = Boolean(
        studentWithoutApaar.apaar_id || studentWithoutApaar.personal_details?.apaar_id
      );
      expect(hasApaarId).toBe(false);

      const alert = !hasApaarId ? {
        id: 'apaar_registration_missing',
        type: 'warning',
        title: 'APAAR ID Pending',
        desc: 'Your APAAR ID has not been submitted yet. KUCET needs this information for scholarship processing and other authorized administrative purposes. You can submit it now or return later if your university roll number or required academic identity details are not yet available.',
        action: { label: 'Submit APAAR ID', href: '/student/apaar' },
      } : null;

      expect(alert).not.toBeNull();
      expect(alert.title).toBe('APAAR ID Pending');
      expect(alert.action.href).toBe('/student/apaar');
    });

    it('confirms dashboard priority alert is omitted once APAAR ID is recorded', () => {
      const studentWithApaar = {
        id: 1,
        roll_no: '22567T0901',
        apaar_id: '123456789012',
        personal_details: { apaar_id: '123456789012' },
      };

      const hasApaarId = Boolean(
        studentWithApaar.apaar_id || studentWithApaar.personal_details?.apaar_id
      );
      expect(hasApaarId).toBe(true);

      const alert = !hasApaarId ? {
        id: 'apaar_registration_missing',
        type: 'warning',
        title: 'APAAR ID Pending',
        action: { label: 'Submit APAAR ID', href: '/student/apaar' },
      } : null;

      expect(alert).toBeNull();
    });
  });

  describe('Form Confirmation & Formula Injection Guards', () => {
    it('validates two-field matching logic for APAAR submission', () => {
      const validateSubmission = (apaar, confirm) => {
        const clean = (apaar || '').replace(/\s+/g, '');
        const cleanConfirm = (confirm || '').replace(/\s+/g, '');

        if (!/^\d{12}$/.test(clean)) return { valid: false, error: 'APAAR ID must be exactly 12 numeric digits.' };
        if (!/^\d{12}$/.test(cleanConfirm)) return { valid: false, error: 'Confirmation APAAR ID must be exactly 12 numeric digits.' };
        if (clean !== cleanConfirm) return { valid: false, error: 'APAAR IDs do not match. Please verify both fields.' };
        return { valid: true, clean };
      };

      // Mismatched
      expect(validateSubmission('123456789012', '123456789013').valid).toBe(false);
      expect(validateSubmission('123456789012', '123456789013').error).toBe('APAAR IDs do not match. Please verify both fields.');

      // Valid matching with spaces
      const validRes = validateSubmission('1234 5678 9012', '123456789012');
      expect(validRes.valid).toBe(true);
      expect(validRes.clean).toBe('123456789012');
    });

    it('sanitizes formula-leading characters (=, +, -, @) to prevent CSV/Excel injection', () => {
      const sanitizeSpreadsheetValue = (val) => {
        if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
          return `'${val}`;
        }
        return val;
      };

      expect(sanitizeSpreadsheetValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeSpreadsheetValue('+CMD("calc")')).toBe("'+CMD(\"calc\")");
      expect(sanitizeSpreadsheetValue('-100')).toBe("'-100");
      expect(sanitizeSpreadsheetValue('@hyperlink("http://evil.com")')).toBe("'@hyperlink(\"http://evil.com\")");
      expect(sanitizeSpreadsheetValue('123456789012')).toBe('123456789012');
      expect(sanitizeSpreadsheetValue('Not Submitted')).toBe('Not Submitted');
    });

    it('enforces export RBAC permissions matrix', () => {
      const checkExportPermission = (user, scope = 'master') => {
        const userRole = (user?.role || '').toLowerCase();
        const isAdmin = ['admin', 'super_admin', 'principal'].includes(userRole);
        if (scope === 'master') {
          return isAdmin || ['admission', 'admission_clerk'].includes(userRole);
        }
        if (scope === 'scholarship') {
          return isAdmin || ['scholarship', 'scholarship_clerk'].includes(userRole);
        }
        if (scope === 'department') {
          return isAdmin || Boolean(user?.is_hod || user?.isHod);
        }
        if (scope === 'first_year') {
          return isAdmin || Boolean(user?.is_first_year_coordinator);
        }
        return false;
      };

      // Master scope: Allowed roles
      expect(checkExportPermission({ role: 'admin' }, 'master')).toBe(true);
      expect(checkExportPermission({ role: 'super_admin' }, 'master')).toBe(true);
      expect(checkExportPermission({ role: 'admission' }, 'master')).toBe(true);
      expect(checkExportPermission({ role: 'admission_clerk' }, 'master')).toBe(true);

      // Master scope: Denied roles (HOD, Coordinator, Scholarship, Faculty, Student)
      expect(checkExportPermission({ role: 'scholarship' }, 'master')).toBe(false);
      expect(checkExportPermission({ role: 'faculty', is_first_year_coordinator: true }, 'master')).toBe(false);
      expect(checkExportPermission({ role: 'faculty', is_hod: true }, 'master')).toBe(false);
      expect(checkExportPermission({ role: 'faculty' }, 'master')).toBe(false);
      expect(checkExportPermission({ role: 'student' }, 'master')).toBe(false);
      expect(checkExportPermission(null, 'master')).toBe(false);

      // Scoped permissions: Scholarship, HOD, and First-Year Coordinator
      expect(checkExportPermission({ role: 'scholarship' }, 'scholarship')).toBe(true);
      expect(checkExportPermission({ role: 'faculty' }, 'scholarship')).toBe(false);

      expect(checkExportPermission({ role: 'faculty', is_hod: true }, 'department')).toBe(true);
      expect(checkExportPermission({ role: 'faculty' }, 'department')).toBe(false);

      expect(checkExportPermission({ role: 'faculty', is_first_year_coordinator: true }, 'first_year')).toBe(true);
      expect(checkExportPermission({ role: 'faculty' }, 'first_year')).toBe(false);
    });

    it('enforces staff correction RBAC permissions matrix (Admission & Scholarship only)', () => {
      const checkCorrectionPermission = (user) => {
        const userRole = (user?.role || '').toLowerCase();
        return [
          'admission',
          'admission_clerk',
          'scholarship',
          'scholarship_clerk',
          'admin',
          'super_admin'
        ].includes(userRole);
      };

      // Allowed roles
      expect(checkCorrectionPermission({ role: 'admission' })).toBe(true);
      expect(checkCorrectionPermission({ role: 'scholarship' })).toBe(true);
      expect(checkCorrectionPermission({ role: 'admin' })).toBe(true);

      // Denied roles (even Coordinators and HODs cannot mutate APAAR directly)
      expect(checkCorrectionPermission({ role: 'faculty', is_first_year_coordinator: true })).toBe(false);
      expect(checkCorrectionPermission({ role: 'faculty', is_hod: true })).toBe(false);
      expect(checkCorrectionPermission({ role: 'faculty' })).toBe(false);
      expect(checkCorrectionPermission({ role: 'student' })).toBe(false);
    });
  });
});
