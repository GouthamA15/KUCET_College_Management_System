import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiveService } from '@/services/archive/ArchiveService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(async (cb) => cb({
      select: (...args) => db.select(...args),
      insert: (...args) => db.insert(...args),
      update: (...args) => db.update(...args),
      delete: (...args) => db.delete(...args),
    })),
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
    // 1. Mock facultySubjectAssignments select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 101, branch: 'CSE', course_semester: 5, subject_code: 'CS501', academic_year: '2025-26' }
      ])
    }));

    // 2. Mock studentAttendance select with leftJoin
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 1, student_id: 10, roll_no: '22567T0901', assignment_id: 101, date: '2025-10-10', session: 1, status: 'PRESENT' }
      ])
    }));

    // Mock insert archive attendance
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));
    // Mock delete operational attendance
    db.delete.mockImplementationOnce(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));

    // 3. Mock attendanceSessions select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));

    // 4. Mock studentMarks select with leftJoin
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));

    // 5. Mock studentFeePayments select
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

  it('should execute alumni archival with branch filtering', async () => {
    // Mock students select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 101,
          roll_no: '22567T0901',
          name: 'Graduated Student',
          email: 'graduated@kucet.ac.in',
          mobile: '9999999999',
          fee_reimbursement: 'NO',
          academic_status: 'GRADUATED',
          student_status: 'ARCHIVED',
          admission_year: '2022',
          pfp: null,
        }
      ])
    }));

    // Mock insert into archive_students
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 501 }]) }));
    // Mock personal details select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));
    // Mock academic background select
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([])
    }));
    // Mock delete active student
    db.delete.mockImplementationOnce(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));
    // Mock audit log insert
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) }));

    const result = await ArchiveService.runAlumniArchive({
      graduation_year: '2026',
      branch: 'CSE',
      archived_by: 'ADMIN',
      reason: 'Graduated batch 2026'
    });

    expect(result.success).toBe(true);
    expect(result.affectedStudentsCount).toBe(1);
  });
});
