import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiveRestoreService } from '@/services/archive/ArchiveRestoreService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('ArchiveRestoreService - Restoration Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preview student archive restoration', async () => {
    db.select
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 50, roll_no: '228W1A0501', name: 'John Alumni' }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 500 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }));

    const preview = await ArchiveRestoreService.previewRestore({ type: 'STUDENT', archive_student_id: 50 });

    expect(preview.found).toBe(true);
    expect(preview.student.name).toBe('John Alumni');
    expect(preview.counts.attendance).toBe(2);
  });

  it('should restore an archived student back to operational database', async () => {
    // Mock archive student query
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 50,
        roll_no: '228W1A0501',
        name: 'John Alumni',
        email: 'john@kucet.ac.in',
        branch: 'CSE',
        admission_year: '2022',
        pfp: null,
      }])
    }));

    // Mock insert to operational students
    db.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 999 }])
    }));

    // Mock personal details select & delete
    db.select.mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }));
    // Mock background select & delete
    db.select.mockImplementationOnce(() => ({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }));

    // Mock delete from archive_students
    db.delete.mockImplementationOnce(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }));

    // Mock insert into audit log
    db.insert.mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 10 }]) }));

    const result = await ArchiveRestoreService.restoreStudent({
      archive_student_id: 50,
      restored_by: 'ADMIN',
      reason: 'Testing restoration'
    });

    expect(result.success).toBe(true);
    expect(result.roll_no).toBe('228W1A0501');
    expect(result.newStudentId).toBe(999);
  });
});
