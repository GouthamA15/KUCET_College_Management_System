import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiveService } from '@/services/archive/ArchiveService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('ArchiveService - Academic Archival Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate executive archive overview metrics', async () => {
    // Mock 4 Promise.all select counts
    db.select
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 120 }]) })) // active students
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 450 }]) })) // archived students
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 5000 }]) })) // active attendance
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 25000 }]) })) // archived attendance
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 800 }]) })) // active marks
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 4200 }]) })) // archived marks
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 300 }]) })) // active payments
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ count: 1500 }]) })) // archived payments
      .mockImplementationOnce(() => ({
        from: vi.fn().mockResolvedValue([{ totalJobs: 12, totalSize: 52428800, totalAffectedRecords: 30000, totalAffectedMedia: 150 }])
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 1, created_at: new Date('2026-08-01') }])
      }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([]) })); // policies

    const overview = await ArchiveService.getArchiveOverview();

    expect(overview.metrics.activeStudents).toBe(120);
    expect(overview.metrics.archivedStudents).toBe(450);
    expect(overview.metrics.totalCompletedJobs).toBe(12);
    expect(overview.metrics.totalStorageSizeBytes).toBe(52428800);
  });

  it('should execute semester archival for closed semester', async () => {
    // Mock attendance select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 1, student_id: 10, roll_no: '228W1A0501', assignment_id: 101, branch: 'CSE', semester: 5, academic_year: '2025-26', date: '2025-10-10', session: 1, status: 'PRESENT' }
      ])
    }));

    // Mock insert archive attendance
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));
    // Mock delete operational attendance
    db.delete.mockImplementationOnce(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));

    // Mock sessions select (empty)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));

    // Mock assignments select (empty)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));

    // Mock payments select (empty)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));

    // Mock audit log insert
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) }));

    const result = await ArchiveService.runSemesterArchive({
      branch: 'CSE',
      semester: 5,
      academic_year: '2025-26',
      archived_by: 'ADMIN',
      reason: 'Semester complete'
    });

    expect(result.success).toBe(true);
    expect(result.affectedRecordsCount).toBe(1);
  });
});
