import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { AdmissionFinalizationService, FINALIZATION_STATUS } from '@/services/AdmissionFinalizationService';
import { GET, PUT } from '@/app/api/staff/admission/branch-status/route';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('AdmissionFinalizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AdmissionFinalizationService.invalidateCache();
  });

  describe('getBranchFinalizationStatus', () => {
    it('returns UNAVAILABLE when branch is empty or not a string', async () => {
      const res = await AdmissionFinalizationService.getBranchFinalizationStatus({ branch: null });
      expect(res.status).toBe(FINALIZATION_STATUS.UNAVAILABLE);
      expect(res.branch).toBeNull();
    });

    it('derives NOT_STARTED when admission drafts have pending records and 0 finalized records', async () => {
      // Mock systemConfigs query (returns empty)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // Mock studentAdmissionDrafts query
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { status: 'DRAFT' },
            { status: 'PROCESSED' },
          ]),
        }),
      });

      const res = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'CIVIL',
        admissionYear: 2026,
      });

      expect(res.status).toBe(FINALIZATION_STATUS.NOT_STARTED);
      expect(res.branch).toBe('CIVIL');
      expect(res.branchName).toBe('Civil Engineering');
      expect(res.totalDrafts).toBe(2);
    });

    it('derives IN_PROGRESS when admission drafts contain both FINALIZED and pending records', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { status: 'FINALIZED' },
            { status: 'PROCESSED' },
          ]),
        }),
      });

      const res = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'IT',
        admissionYear: 2026,
      });

      expect(res.status).toBe(FINALIZATION_STATUS.IN_PROGRESS);
      expect(res.branch).toBe('IT');
      expect(res.branchName).toBe('Information Technology');
    });

    it('derives FINALIZED when all active admission drafts are FINALIZED', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { status: 'FINALIZED' },
            { status: 'FINALIZED' },
          ]),
        }),
      });

      const res = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'CSE',
        admissionYear: 2026,
      });

      expect(res.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(res.branch).toBe('CSE');
      expect(res.branchName).toBe('Computer Science & Engineering');
    });

    it('falls back to explicit systemConfigs status when no drafts exist for the branch', async () => {
      // Mock systemConfigs query returning saved explicit status
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                config_key: 'ADMISSION_BRANCH_STATUS',
                config_value: JSON.stringify({
                  '2026': {
                    MECH: FINALIZATION_STATUS.FINALIZED,
                  },
                }),
              },
            ]),
          }),
        }),
      });

      // Mock studentAdmissionDrafts query returning empty
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      });

      const res = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'MECH',
        admissionYear: 2026,
      });

      expect(res.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(res.branch).toBe('MECH');
      expect(res.branchName).toBe('Mechanical Engineering');
    });

    it('returns cached result on subsequent calls within TTL and invalidates on invalidateCache()', async () => {
      // First call (uncached)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ status: 'FINALIZED' }]),
        }),
      });

      const firstRes = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'CSE',
        admissionYear: 2026,
      });
      expect(firstRes.status).toBe(FINALIZATION_STATUS.FINALIZED);

      // Second call (should be served from cache without querying DB)
      const cachedRes = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'CSE',
        admissionYear: 2026,
      });
      expect(cachedRes.status).toBe(FINALIZATION_STATUS.FINALIZED);
      // DB select should NOT have been called again (still total of 2 calls)
      expect(db.select).toHaveBeenCalledTimes(2);

      // Invalidate cache
      AdmissionFinalizationService.invalidateCache('CSE', 2026);

      // Third call should query DB again
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ status: 'DRAFT' }]),
        }),
      });

      const thirdRes = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch: 'CSE',
        admissionYear: 2026,
      });
      expect(thirdRes.status).toBe(FINALIZATION_STATUS.NOT_STARTED);
      expect(db.select).toHaveBeenCalledTimes(4);
    });
  });

  describe('setBranchStatus', () => {
    it('throws error for invalid branch code or invalid status', async () => {
      await expect(
        AdmissionFinalizationService.setBranchStatus({ branch: 'UNKNOWN_BRANCH', status: 'FINALIZED' })
      ).rejects.toThrow('Invalid branch code');

      await expect(
        AdmissionFinalizationService.setBranchStatus({ branch: 'CSE', status: 'INVALID_STATUS' })
      ).rejects.toThrow('Invalid status');
    });

    it('updates systemConfigs and invalidates cache on valid input', async () => {
      // Mock existing config query returning existing row
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                config_key: 'ADMISSION_BRANCH_STATUS',
                config_value: JSON.stringify({ '2026': { IT: 'IN_PROGRESS' } }),
              },
            ]),
          }),
        }),
      });

      const updateSetMock = vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(true),
      });
      db.update.mockReturnValueOnce({ set: updateSetMock });

      const res = await AdmissionFinalizationService.setBranchStatus({
        branch: 'ECE',
        admissionYear: 2026,
        status: FINALIZATION_STATUS.FINALIZED,
        updatedBy: 'admin@kucet.ac.in',
      });

      expect(res.success).toBe(true);
      expect(res.branch).toBe('ECE');
      expect(res.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('handleDraftFinalized', () => {
    it('automatically transitions branch to FINALIZED when all remaining drafts are finalized', async () => {
      // 1. remaining drafts query: all FINALIZED
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { status: 'FINALIZED' },
            { status: 'FINALIZED' },
          ]),
        }),
      });

      // 2. setBranchStatus: existing config query
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // 3. setBranchStatus insert
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce(true),
      });

      await AdmissionFinalizationService.handleDraftFinalized({
        branch: 'CIVIL',
        admissionYear: 2026,
      });

      expect(db.insert).toHaveBeenCalled();
    });
  });
});

describe('Staff Admission Branch Status Route (/api/staff/admission/branch-status)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET Endpoint Access Control & Queries', () => {
    it('returns 403 when user is unauthenticated or has unauthorized role', async () => {
      getAuthUser.mockResolvedValueOnce(null);
      const req = new Request('http://localhost/api/staff/admission/branch-status');
      const res = await GET(req);
      expect(res.status).toBe(403);

      getAuthUser.mockResolvedValueOnce({ id: 1, role: 'student' });
      const res2 = await GET(req);
      expect(res2.status).toBe(403);
    });

    it('returns 200 with specific branch status when user is admission staff', async () => {
      getAuthUser.mockResolvedValueOnce({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      // Mock service method
      vi.spyOn(AdmissionFinalizationService, 'getBranchFinalizationStatus').mockResolvedValueOnce({
        status: FINALIZATION_STATUS.FINALIZED,
        branch: 'CSE',
        branchName: 'Computer Science & Engineering',
        admissionYear: 2026,
      });

      const req = new Request('http://localhost/api/staff/admission/branch-status?branch=CSE&year=2026');
      const res = await GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(body.branch).toBe('CSE');
    });

    it('returns 200 with all branch statuses when no branch query param is provided', async () => {
      getAuthUser.mockResolvedValueOnce({ id: 1, role: 'admin', email: 'admin@kucet.ac.in' });

      vi.spyOn(AdmissionFinalizationService, 'getAllBranchStatuses').mockResolvedValueOnce({
        admissionYear: 2026,
        branches: {
          CSE: { status: FINALIZATION_STATUS.FINALIZED, branchName: 'Computer Science & Engineering' },
          CIVIL: { status: FINALIZATION_STATUS.NOT_STARTED, branchName: 'Civil Engineering' },
        },
      });

      const req = new Request('http://localhost/api/staff/admission/branch-status?year=2026');
      const res = await GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.admissionYear).toBe(2026);
      expect(body.branches.CSE.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(body.branches.CIVIL.status).toBe(FINALIZATION_STATUS.NOT_STARTED);
    });
  });

  describe('PUT Endpoint Access Control & Updates', () => {
    it('returns 403 when user is not admission staff or admin', async () => {
      getAuthUser.mockResolvedValueOnce({ id: 5, role: 'faculty' });

      const req = new Request('http://localhost/api/staff/admission/branch-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'CSE',
          status: 'FINALIZED',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it('rejects invalid payload with 400', async () => {
      getAuthUser.mockResolvedValueOnce({ id: 2, role: 'admission' });

      const req = new Request('http://localhost/api/staff/admission/branch-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'CSE',
          status: 'INVALID_STATE',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('successfully updates branch status and returns 200 when invoked by admission staff', async () => {
      getAuthUser.mockResolvedValueOnce({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      vi.spyOn(AdmissionFinalizationService, 'setBranchStatus').mockResolvedValueOnce({
        success: true,
        branch: 'CIVIL',
        admissionYear: 2026,
        status: FINALIZATION_STATUS.FINALIZED,
      });

      const req = new Request('http://localhost/api/staff/admission/branch-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'CIVIL',
          status: 'FINALIZED',
          admissionYear: 2026,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe(FINALIZATION_STATUS.FINALIZED);
      expect(body.branch).toBe('CIVIL');
    });
  });
});
