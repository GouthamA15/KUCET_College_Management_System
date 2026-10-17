import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/student/login/route';
import { db } from '@/db';
import bcrypt from 'bcrypt';
import { checkRateLimit } from '@/lib/rate-limit';

import { AdmissionFinalizationService, FINALIZATION_STATUS } from '@/services/AdmissionFinalizationService';

vi.mock('@/services/AdmissionFinalizationService', () => ({
  FINALIZATION_STATUS: {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    FINALIZED: 'FINALIZED',
    UNAVAILABLE: 'UNAVAILABLE',
  },
  AdmissionFinalizationService: {
    getBranchFinalizationStatus: vi.fn(),
    setBranchStatus: vi.fn(),
    handleDraftFinalized: vi.fn(),
    getAllBranchStatuses: vi.fn(),
    invalidateCache: vi.fn(),
  },
  default: {
    getBranchFinalizationStatus: vi.fn(),
    setBranchStatus: vi.fn(),
    handleDraftFinalized: vi.fn(),
    getAllBranchStatuses: vi.fn(),
    invalidateCache: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
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

const makeMockRequest = (body) => ({
  method: 'POST',
  json: async () => body,
  headers: {
    get: (name) => {
      if (name.toLowerCase() === 'x-forwarded-for') return '127.0.0.1';
      if (name.toLowerCase() === 'user-agent') return 'Mozilla/5.0 Test';
      return null;
    },
  },
});

function mockDbSelectResult(rows) {
  db.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValueOnce({
      leftJoin: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce(rows),
        }),
      }),
    }),
  });
}

describe('Student Login API (/api/student/login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ success: true });
  });

  describe('Dynamic Branch-Wide Admission Finalization & Nonexistent Account Handling', () => {
    it('Case A (BRANCH_FINALIZATION_PENDING): returns 404 with branch name when branch finalization is NOT_STARTED', async () => {
      mockDbSelectResult([]);
      AdmissionFinalizationService.getBranchFinalizationStatus.mockResolvedValueOnce({
        status: FINALIZATION_STATUS.NOT_STARTED,
        branch: 'CIVIL',
        branchName: 'Civil Engineering',
        admissionYear: 2026,
      });

      const req = makeMockRequest({
        rollno: '26567T0001', // CIVIL, entry year 2026
        dob: '2004-05-15',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Admission finalization pending');
      expect(body.code).toBe('BRANCH_FINALIZATION_PENDING');
      expect(body.details?.code).toBe('BRANCH_FINALIZATION_PENDING');
      expect(body.details?.title).toBe('Admission Finalization Pending');
      expect(body.details?.branch).toBe('CIVIL');
      expect(body.details?.branchName).toBe('Civil Engineering');
      expect(body.details?.message).toContain('Admission finalization for Civil Engineering is currently pending');
      expect(body.details?.message).toContain('Please wait for your official admission-finalization email');
      // Invariant: zero hardcoded branch lists
      expect(body.details?.message).not.toContain('CSE, IT, and Mechanical');
    });

    it('Case B (BRANCH_FINALIZED_ACCOUNT_NOT_FOUND): returns 404 when branch is FINALIZED but student account not found', async () => {
      mockDbSelectResult([]);
      AdmissionFinalizationService.getBranchFinalizationStatus.mockResolvedValueOnce({
        status: FINALIZATION_STATUS.FINALIZED,
        branch: 'CSE',
        branchName: 'Computer Science & Engineering',
        admissionYear: 2026,
      });

      const req = makeMockRequest({
        rollno: '26567T0901', // CSE, entry year 2026
        dob: '2004-05-15',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Student account not found');
      expect(body.code).toBe('BRANCH_FINALIZED_ACCOUNT_NOT_FOUND');
      expect(body.details?.code).toBe('BRANCH_FINALIZED_ACCOUNT_NOT_FOUND');
      expect(body.details?.title).toBe('Student Account Not Found');
      expect(body.details?.branch).toBe('CSE');
      expect(body.details?.branchName).toBe('Computer Science & Engineering');
      expect(body.details?.message).toContain('No active student account was found for this roll number in the portal');
      expect(body.details?.message).toContain('admission finalization for Computer Science & Engineering has been completed');
      expect(body.details?.message).toContain('contact college administration or the admission office');
      expect(body.details?.message).not.toContain('CSE, IT, and Mechanical');
    });

    it('Case C (BRANCH_FINALIZATION_IN_PROGRESS): returns 404 with active setup notice when branch is IN_PROGRESS', async () => {
      mockDbSelectResult([]);
      AdmissionFinalizationService.getBranchFinalizationStatus.mockResolvedValueOnce({
        status: FINALIZATION_STATUS.IN_PROGRESS,
        branch: 'IT',
        branchName: 'Information Technology',
        admissionYear: 2026,
      });

      const req = makeMockRequest({
        rollno: '26567T1801', // IT, entry year 2026
        dob: '2004-05-15',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Admission finalization in progress');
      expect(body.code).toBe('BRANCH_FINALIZATION_IN_PROGRESS');
      expect(body.details?.code).toBe('BRANCH_FINALIZATION_IN_PROGRESS');
      expect(body.details?.title).toBe('Admission Finalization In Progress');
      expect(body.details?.branch).toBe('IT');
      expect(body.details?.branchName).toBe('Information Technology');
      expect(body.details?.message).toContain('Admission finalization for Information Technology is currently in progress');
      expect(body.details?.message).toContain('student accounts are actively being set up');
      expect(body.details?.message).toContain('Please wait for your official admission-finalization email');
      expect(body.details?.message).not.toContain('CSE, IT, and Mechanical');
    });

    it('Case E1: returns neutral STUDENT_NOT_FOUND for older admission batch without claiming admission is pending', async () => {
      mockDbSelectResult([]);

      const req = makeMockRequest({
        rollno: '24567T0001', // CIVIL, entry year 2024 (prior batch)
        dob: '2004-05-15',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Student account not found');
      expect(body.code).toBe('STUDENT_NOT_FOUND');
      expect(body.details?.code).toBe('STUDENT_NOT_FOUND');
      expect(body.details?.title).toBe('Student Account Not Found');
      expect(body.details?.message).toContain("We couldn't find an active student account for this roll number in the portal.");
      expect(body.details?.message).toContain('If you believe your account should be active, please contact the college administration.');
      // Should not claim admission finalization is pending for a historical year
      expect(body.details?.message).not.toContain('currently in progress');
      expect(body.details?.message).not.toContain('CSE, IT, and Mechanical');
    });

    it('Case E2: returns BRANCH_STATUS_UNAVAILABLE when roll number format or branch cannot be parsed', async () => {
      mockDbSelectResult([]);

      const req = makeMockRequest({
        rollno: '26567T9999', // 99 is not a registered branch code
        dob: '2004-05-15',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Student account not found');
      expect(body.code).toBe('BRANCH_STATUS_UNAVAILABLE');
      expect(body.details?.code).toBe('BRANCH_STATUS_UNAVAILABLE');
      expect(body.details?.title).toBe('Student Account Not Found');
      expect(body.details?.message).toContain("We couldn't find an active student account for this roll number in the portal.");
    });
  });

  describe('Existing Account Credential Failure', () => {
    it('returns 401 Invalid credentials when password does not match, without STUDENT_NOT_FOUND', async () => {
      const hashed = await bcrypt.hash('CorrectPassword123', 10);
      mockDbSelectResult([{
        id: 101,
        roll_no: '24567T0901',
        name: 'Jane Doe',
        password_hash: hashed,
        date_of_birth: new Date('2004-01-01'),
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0901',
        dob: 'WrongPassword!',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe('Invalid credentials');
      expect(body.code).toBeUndefined();
      expect(body.details).toBeUndefined();
    });

    it('returns 401 Invalid credentials when DOB does not match initial account DOB', async () => {
      mockDbSelectResult([{
        id: 102,
        roll_no: '24567T0902',
        name: 'John Smith',
        password_hash: null,
        date_of_birth: new Date('2004-05-15'),
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0902',
        dob: '2004-05-20',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe('Invalid credentials');
      expect(body.code).toBeUndefined();
    });
  });

  describe('Successful Authentication', () => {
    it('authenticates successfully with password and returns 200 with sanitized profile', async () => {
      const hashed = await bcrypt.hash('MySecretPassword123', 10);
      mockDbSelectResult([{
        id: 103,
        roll_no: '24567T0903',
        name: 'Alice Johnson',
        password_hash: hashed,
        date_of_birth: new Date('2003-08-20'),
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0903',
        dob: 'MySecretPassword123',
        rememberMe: true,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.student.roll_no).toBe('24567T0903');
      expect(body.student.name).toBe('Alice Johnson');
      expect(body.student.password_hash).toBeUndefined();
      expect(body.student.date_of_birth).toBeUndefined();
    });

    it('authenticates successfully with DOB (in DD-MM-YYYY format) on first login', async () => {
      mockDbSelectResult([{
        id: 104,
        roll_no: '24567T0904',
        name: 'Bob Ross',
        password_hash: null,
        date_of_birth: new Date('2004-12-31'),
        student_status: 'ACTIVE',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0904',
        dob: '31-12-2004',
        rememberMe: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.student.roll_no).toBe('24567T0904');
    });

    it('permits login for students from non-finalized branches (e.g. CIVIL, EEE, ECE, CSD) when account exists', async () => {
      const branches = [
        { code: '00', name: 'CIVIL', roll: '24567T0012' },
        { code: '15', name: 'ECE', roll: '24567T1515' },
        { code: '12', name: 'EEE', roll: '24567T1205' },
        { code: '30', name: 'CSD', roll: '24567T3009' },
      ];

      for (const b of branches) {
        mockDbSelectResult([{
          id: 200,
          roll_no: b.roll,
          name: `${b.name} Student`,
          password_hash: null,
          date_of_birth: new Date('2004-06-10'),
          student_status: 'ACTIVE',
          academic_status: 'ACTIVE',
        }]);

        const req = makeMockRequest({
          rollno: b.roll,
          dob: '2004-06-10',
          rememberMe: false,
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.student.roll_no).toBe(b.roll);
      }
    });
  });

  describe('Account Status and Lifecycle Verification', () => {
    it('blocks login with 403 for INACTIVE_ATTENDANCE accounts', async () => {
      mockDbSelectResult([{
        id: 105,
        roll_no: '24567T0905',
        name: 'Inactive Student',
        student_status: 'INACTIVE_ATTENDANCE',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0905',
        dob: 'AnyPassword',
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('deactivated due to prolonged attendance inactivity');
    });

    it('blocks login with 403 for DISCONTINUED accounts', async () => {
      mockDbSelectResult([{
        id: 106,
        roll_no: '24567T0906',
        name: 'Discontinued Student',
        student_status: 'DISCONTINUED',
        academic_status: 'ACTIVE',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0906',
        dob: 'AnyPassword',
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('marked as discontinued');
    });

    it('blocks login with 403 for SUSPENDED accounts', async () => {
      mockDbSelectResult([{
        id: 107,
        roll_no: '24567T0907',
        name: 'Suspended Student',
        student_status: 'ACTIVE',
        academic_status: 'SUSPENDED',
      }]);

      const req = makeMockRequest({
        rollno: '24567T0907',
        dob: 'AnyPassword',
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('suspended');
    });
  });

  describe('Validation & Malformed Input Handling', () => {
    it('rejects roll numbers shorter than 10 characters with 400', async () => {
      const req = makeMockRequest({
        rollno: '24567T09',
        dob: 'Password123',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects missing roll number with 400', async () => {
      const req = makeMockRequest({
        dob: 'Password123',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Rate Limiting & Security Defenses', () => {
    it('returns 429 when IP rate limit is exceeded', async () => {
      checkRateLimit.mockResolvedValueOnce({ success: false });

      const req = makeMockRequest({
        rollno: '24567T0901',
        dob: 'Password123',
      });

      const res = await POST(req);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain('Too many login attempts');
    });

    it('returns 429 when account-specific lockout limit is exceeded', async () => {
      checkRateLimit
        .mockResolvedValueOnce({ success: true }) // IP check passes
        .mockResolvedValueOnce({ success: false }); // Account lockout triggers

      const req = makeMockRequest({
        rollno: '24567T0901',
        dob: 'Password123',
      });

      const res = await POST(req);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain('Account temporarily locked');
    });
  });
});
