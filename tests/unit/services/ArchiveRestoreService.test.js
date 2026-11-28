import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiveRestoreService } from '@/services/archive/ArchiveRestoreService';
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

describe('ArchiveRestoreService - Restoration Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preview student archive restoration', async () => {
    db.select
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 50, original_student_id: 101, roll_no: '228W1A0501', name: 'John Alumni' }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 500 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 1 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 2 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }));

    const preview = await ArchiveRestoreService.previewRestore({ type: 'STUDENT', archive_student_id: 50 });

    expect(preview.found).toBe(true);
    expect(preview.student.name).toBe('John Alumni');
    expect(preview.counts.attendance).toBe(2);
  });

  it('should restore an archived student back to operational database idempotently', async () => {
    // 1. Mock archive_students lookup
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 50,
        original_student_id: 999,
        roll_no: '228W1A0501',
        name: 'John Alumni',
        email: 'john@kucet.ac.in',
        branch: 'CSE',
        admission_year: '2022',
        pfp: null,
      }])
    }));

    // 2. Mock existing operational student lookup inside tx (non-destructive model preserves student row)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 999 }])
    }));

    // 3. Mock update on students, student_attendance, and student_streak_snapshots
    db.update.mockImplementation(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    }));

    // 4. Mock delete snapshot rows from archive tables
    db.delete.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    }));

    // 5. Mock audit log insert
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 10 }]) }));

    const result = await ArchiveRestoreService.restoreStudent({
      archive_student_id: 50,
      restored_by: 'ADMIN',
      reason: 'Testing restoration'
    });

    expect(result.success).toBe(true);
    expect(result.roll_no).toBe('228W1A0501');
    expect(result.newStudentId).toBe(999);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
