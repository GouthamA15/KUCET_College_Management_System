import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as previewHandler } from '@/app/api/staff/admission/id-cards/bulk/preview/route';
import { POST as generateHandler } from '@/app/api/staff/admission/id-cards/bulk/generate/route';
import { GET as downloadHandler } from '@/app/api/staff/admission/id-cards/bulk/download/[jobId]/route';
import { BulkIdCardService } from '@/services/admission/id-card/BulkIdCardService';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

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
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({}),
    })),
    update: vi.fn(),
  },
}));

describe('Bulk Student ID Card API Routes (/api/staff/admission/id-cards/bulk/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupAuth = (user) => {
    if (!user) {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue(null);
    } else {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth' || name === 'admin_auth') return { value: 'valid-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: user.id || 101,
        staffId: user.staffId || user.id || 101,
        email: user.email || 'staff@kucet.ac.in',
        role: user.role,
        branch: user.branch,
        department_code: user.department_code,
        is_first_year_coordinator: Boolean(user.is_first_year_coordinator),
      });
    }
  };

  describe('GET /api/staff/admission/id-cards/bulk/preview', () => {
    it('returns 401 when unauthenticated', async () => {
      setupAuth(null);
      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/preview');
      const res = await previewHandler(req);
      expect([401, 403]).toContain(res.status);
    });

    it('returns 200 with summary stats for authorized Admission Staff', async () => {
      setupAuth({ id: 201, role: 'admission' });

      vi.spyOn(BulkIdCardService, 'getBulkPreview').mockResolvedValue({
        academicYear: '2026-27',
        academicLevel: 'FIRST_YEAR',
        selectedBranch: 'ALL',
        totalEligible: 45,
        photosAvailable: 42,
        photosMissing: 3,
        expectedPdfs: 45,
        branches: [],
      });

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/preview?branch=ALL');
      const res = await previewHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalEligible).toBe(45);
      expect(json.photosAvailable).toBe(42);
      expect(json.academicLevel).toBe('FIRST_YEAR');
    });

    it('returns 200 for First-Year Coordinator across all branches', async () => {
      setupAuth({ id: 101, role: 'faculty', is_first_year_coordinator: true });

      vi.spyOn(BulkIdCardService, 'getBulkPreview').mockResolvedValue({
        academicYear: '2026-27',
        academicLevel: 'FIRST_YEAR',
        selectedBranch: 'ALL',
        totalEligible: 45,
        photosAvailable: 42,
        photosMissing: 3,
        expectedPdfs: 45,
        branches: [],
        isFirstYearOnly: true,
      });

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/preview?branch=ALL&academicLevel=FIRST_YEAR');
      const res = await previewHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isFirstYearOnly).toBe(true);
    });
  });

  describe('POST /api/staff/admission/id-cards/bulk/generate', () => {
    it('returns 401 when unauthenticated', async () => {
      setupAuth(null);
      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: 'CSE' }),
      });
      const res = await generateHandler(req);
      expect([401, 403]).toContain(res.status);
    });

    it('returns 201 with job metadata on successful generation', async () => {
      setupAuth({ id: 201, role: 'admission' });

      vi.spyOn(BulkIdCardService, 'generateBulkZip').mockResolvedValue({
        success: true,
        jobId: 'mock-job-uuid-1234',
        zipFilename: 'KUCET_ID_Cards_CSE_First_Year_2026-27.zip',
        totalEligible: 20,
        generatedCount: 20,
        excludedCount: 0,
        downloadUrl: '/api/staff/admission/id-cards/bulk/download/mock-job-uuid-1234',
        exclusions: [],
      });

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: 'CSE', academicLevel: 'FIRST_YEAR' }),
      });

      const res = await generateHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('mock-job-uuid-1234');
      expect(json.downloadUrl).toContain('mock-job-uuid-1234');
    });

    it('returns 403 when First-Year Coordinator attempts to generate for another academic year', async () => {
      setupAuth({ id: 101, role: 'faculty', is_first_year_coordinator: true });

      vi.spyOn(BulkIdCardService, 'generateBulkZip').mockImplementation(async () => {
        const err = new Error('Forbidden: First Year Coordinator access is strictly restricted to First-Year students');
        err.statusCode = 403;
        throw err;
      });

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: 'ALL', academicLevel: 'SECOND_YEAR' }),
      });

      const res = await generateHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/staff/admission/id-cards/bulk/download/[jobId]', () => {
    it('returns 404 when job does not exist or has expired', async () => {
      setupAuth({ id: 201, role: 'admission' });

      vi.spyOn(BulkIdCardService, 'getJob').mockReturnValue(null);

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/download/nonexistent-job');
      const res = await downloadHandler(req, { params: Promise.resolve({ jobId: 'nonexistent-job' }) });

      expect(res.status).toBe(404);
    });

    it('returns 403 when another staff member attempts to download job', async () => {
      setupAuth({ id: 999, role: 'staff' });

      vi.spyOn(BulkIdCardService, 'getJob').mockImplementation(() => {
        const err = new Error('Forbidden: You are not authorized to download this generated package');
        err.statusCode = 403;
        throw err;
      });

      const req = new Request('http://localhost/api/staff/admission/id-cards/bulk/download/job-123');
      const res = await downloadHandler(req, { params: Promise.resolve({ jobId: 'job-123' }) });

      expect(res.status).toBe(403);
    });
  });
});
