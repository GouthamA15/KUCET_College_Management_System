import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRunSemesterArchive, mockRunAlumniArchive } = vi.hoisted(() => ({
  mockRunSemesterArchive: vi.fn(async () => ({ success: true, jobId: 'JOB-SEM-1', affectedRecordsCount: 10 })),
  mockRunAlumniArchive: vi.fn(async () => ({ success: true, jobId: 'JOB-ALU-1', affectedStudentsCount: 5 })),
}));

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/archive/ArchiveService', () => ({
  ArchiveService: {
    runSemesterArchive: mockRunSemesterArchive,
    runAlumniArchive: mockRunAlumniArchive,
  },
}));

import { POST } from '@/app/api/webhooks/qstash/archive-job/route';

describe('QStash Archive Job Webhook (/api/webhooks/qstash/archive-job)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes structured options object to ArchiveService.runSemesterArchive', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/qstash/archive-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archiveType: 'semester',
        targetParams: {
          branch: 'CSE',
          semester: 5,
          academic_year: '2026-2027',
          archived_by: 'admin@kucet.ac.in',
        },
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRunSemesterArchive).toHaveBeenCalledWith({
      branch: 'CSE',
      semester: 5,
      academic_year: '2026-2027',
      archived_by: 'admin@kucet.ac.in',
    });
  });

  it('passes structured options object to ArchiveService.runAlumniArchive', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/qstash/archive-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archiveType: 'alumni',
        targetParams: {
          batchYear: '2026',
          branch: 'ECE',
          student_ids: [11, 12],
        },
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRunAlumniArchive).toHaveBeenCalledWith({
      graduation_year: '2026',
      branch: 'ECE',
      student_ids: [11, 12],
      archived_by: 'QSTASH_WORKER',
    });
  });

  it('rejects unsupported archiveType with 400', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/qstash/archive-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archiveType: 'unknown', targetParams: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
