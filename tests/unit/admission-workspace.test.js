import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDefaultAdmissionWorkspace,
  normalizeAdmissionWorkspace,
  validateAdmissionWorkspace,
  isSameAdmissionWorkspace,
  matchesAdmissionWorkspace,
  buildAdmissionWorkspaceConditions,
  ADMISSION_EXAM_OPTIONS,
  DEFAULT_ADMISSION_EXAM,
  DEFAULT_ADMISSION_BRANCH,
} from '@/lib/admission-workspace';
import { GET as getDraftsHandler } from '@/app/api/staff/admission/drafts/route';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/db', () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([
      {
        id: 101,
        name: 'Goutham Test',
        father_name: 'Father Test',
        exam_rank: 450,
        admission_year: '2026-2030',
        entrance_exam: 'TG EAPCET',
        branch: 'CSE',
        status: 'DRAFT',
        roll_no: null,
        email: 'goutham@test.com',
        created_at: new Date('2026-08-31T10:00:00Z'),
      },
    ]),
  };

  return {
    db: {
      select: vi.fn(() => mockSelectChain),
    },
  };
});

describe('Canonical Admission Workspace Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Default State & Constants', () => {
    it('provides valid default workspace configuration', () => {
      const defaultWs = getDefaultAdmissionWorkspace();
      expect(defaultWs.intakeExam).toBe(DEFAULT_ADMISSION_EXAM);
      expect(defaultWs.targetBranch).toBe(DEFAULT_ADMISSION_BRANCH);
      expect(typeof defaultWs.entryYear).toBe('number');
      expect(defaultWs.entryYear).toBeGreaterThanOrEqual(2020);
    });

    it('contains supported admission examination options', () => {
      expect(ADMISSION_EXAM_OPTIONS).toContain('TG EAPCET');
      expect(ADMISSION_EXAM_OPTIONS).toContain('TG ECET');
    });
  });

  describe('2. Workspace Normalization & Validation', () => {
    it('normalizes query parameter aliases into canonical workspace structure', () => {
      const parsed = normalizeAdmissionWorkspace({
        exam: 'tg eapcet',
        branch: 'cse',
        year: '2026',
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.intakeExam).toBe('TG EAPCET');
      expect(parsed?.targetBranch).toBe('CSE');
      expect(parsed?.entryYear).toBe(2026);
    });

    it('supports entrance_exam and target_branch aliases', () => {
      const parsed = normalizeAdmissionWorkspace({
        entrance_exam: 'TG ECET',
        targetBranch: 'ECE',
        entry_year: '2026',
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.intakeExam).toBe('TG ECET');
      expect(parsed?.targetBranch).toBe('ECE');
      expect(parsed?.entryYear).toBe(2026);
    });

    it('rejects invalid branches safely', () => {
      const parsed = normalizeAdmissionWorkspace({
        exam: 'TG EAPCET',
        branch: 'INVALID_BRANCH_XYZ',
        year: 2026,
      });

      expect(parsed).toBeNull();
    });

    it('rejects invalid intake examinations safely', () => {
      const parsed = normalizeAdmissionWorkspace({
        exam: 'UNKNOWN_EXAM',
        branch: 'CSE',
        year: 2026,
      });

      expect(parsed).toBeNull();
    });

    it('rejects invalid entry years safely', () => {
      const parsed = normalizeAdmissionWorkspace({
        exam: 'TG EAPCET',
        branch: 'CSE',
        year: 'abcd',
      });

      expect(parsed).toBeNull();
    });

    it('validates workspace objects with validateAdmissionWorkspace', () => {
      const valid = validateAdmissionWorkspace({
        intakeExam: 'TG EAPCET',
        targetBranch: 'CSE',
        entryYear: 2026,
      });
      expect(valid.success).toBe(true);

      const invalid = validateAdmissionWorkspace({
        intakeExam: 'INVALID',
        targetBranch: 'CSE',
        entryYear: 2026,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('3. Workspace Equality & Realtime Payload Matching', () => {
    it('correctly compares two workspaces for equality', () => {
      const wsA = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };
      const wsB = { intakeExam: 'tg eapcet', targetBranch: 'cse', entryYear: 2026 };
      const wsC = { intakeExam: 'TG ECET', targetBranch: 'CSE', entryYear: 2026 };
      const wsD = { intakeExam: 'TG EAPCET', targetBranch: 'ECE', entryYear: 2026 };
      const wsE = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2025 };

      expect(isSameAdmissionWorkspace(wsA, wsB)).toBe(true);
      expect(isSameAdmissionWorkspace(wsA, wsC)).toBe(false);
      expect(isSameAdmissionWorkspace(wsA, wsD)).toBe(false);
      expect(isSameAdmissionWorkspace(wsA, wsE)).toBe(false);
    });

    it('matches draft records with identical workspace attributes', () => {
      const currentWorkspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };

      const matchingRecord = {
        branch: 'CSE',
        entrance_exam: 'TG EAPCET',
        admission_year: '2026-2030',
      };

      expect(matchesAdmissionWorkspace(matchingRecord, currentWorkspace)).toBe(true);
    });

    it('isolates different branches (ECE does not match CSE workspace)', () => {
      const currentWorkspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };

      const eceRecord = {
        branch: 'ECE',
        entrance_exam: 'TG EAPCET',
        admission_year: '2026-2030',
      };

      expect(matchesAdmissionWorkspace(eceRecord, currentWorkspace)).toBe(false);
    });

    it('isolates different entrance exams (TG ECET does not match TG EAPCET workspace)', () => {
      const currentWorkspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };

      const ecetRecord = {
        branch: 'CSE',
        entrance_exam: 'TG ECET',
        admission_year: '2026-2029',
      };

      expect(matchesAdmissionWorkspace(ecetRecord, currentWorkspace)).toBe(false);
    });

    it('isolates different admission/entry years', () => {
      const currentWorkspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };

      const year2025Record = {
        branch: 'CSE',
        entrance_exam: 'TG EAPCET',
        admission_year: '2025-2029',
      };

      expect(matchesAdmissionWorkspace(year2025Record, currentWorkspace)).toBe(false);
    });
  });

  describe('4. Drizzle Query Condition Builder', () => {
    it('constructs correct WHERE conditions for workspace and status', () => {
      const mockTable = {
        status: 'status_col',
        branch: 'branch_col',
        entrance_exam: 'exam_col',
        admission_year: 'year_col',
      };

      const workspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };
      const conditions = buildAdmissionWorkspaceConditions(mockTable, workspace, 'DRAFT');

      expect(conditions).toBeInstanceOf(Array);
      expect(conditions.length).toBe(4); // status, branch, entrance_exam, admission_year
    });

    it('constructs search conditions when search term is supplied', () => {
      const mockTable = {
        status: 'status_col',
        branch: 'branch_col',
        entrance_exam: 'exam_col',
        admission_year: 'year_col',
        name: 'name_col',
        roll_no: 'roll_col',
        email: 'email_col'
      };

      const workspace = { intakeExam: 'TG EAPCET', targetBranch: 'CSE', entryYear: 2026 };
      const conditions = buildAdmissionWorkspaceConditions(mockTable, workspace, 'DRAFT', 'Rao');

      expect(conditions).toBeInstanceOf(Array);
      expect(conditions.length).toBe(5); // status, branch, entrance_exam, admission_year, search
    });
  });

  describe('5. API Route - GET /api/staff/admission/drafts', () => {
    it('returns 403 Forbidden when caller is not admission or admin staff', async () => {
      const { getAuthUser } = await import('@/lib/api-utils');
      getAuthUser.mockResolvedValueOnce({ role: 'faculty' });

      const req = new Request('http://localhost:3000/api/staff/admission/drafts');
      const res = await getDraftsHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('returns 400 when invalid workspace parameters are provided', async () => {
      const { getAuthUser } = await import('@/lib/api-utils');
      getAuthUser.mockResolvedValueOnce({ role: 'admission' });

      const req = new Request('http://localhost:3000/api/staff/admission/drafts?branch=NON_EXISTENT_BRANCH&entrance_exam=INVALID');
      const res = await getDraftsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid workspace');
    });

    it('successfully queries drafts for a valid workspace', async () => {
      const { getAuthUser } = await import('@/lib/api-utils');
      getAuthUser.mockResolvedValueOnce({ role: 'admission' });

      const req = new Request('http://localhost:3000/api/staff/admission/drafts?branch=CSE&entrance_exam=TG%20EAPCET&entry_year=2026&status=DRAFT');
      const res = await getDraftsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeInstanceOf(Array);
      expect(json.data.length).toBe(1);
      expect(json.data[0].branch).toBe('CSE');
      expect(json.data[0].entrance_exam).toBe('TG EAPCET');
      expect(json.workspace).toEqual({
        intakeExam: 'TG EAPCET',
        targetBranch: 'CSE',
        entryYear: 2026,
      });
    });
  });
});
