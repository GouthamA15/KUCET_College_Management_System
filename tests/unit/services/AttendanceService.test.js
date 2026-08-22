import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '@/services/attendance/AttendanceService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

describe('AttendanceService - Lecture Topic Tracking', () => {
  const mockUser = { id: 10, role: 'faculty', branch: 'CSE', is_hod: false };
  const mockAssignment = { id: 101, branch: 'CSE', faculty_id: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save topic covered for authorized faculty', async () => {
    // Mock assignment query
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAssignment])
    }));

    // Mock existing session lookup (not found)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    }));

    // Mock insert
    db.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 501 }])
    }));

    const result = await AttendanceService.updateLectureTopic({
      assignmentId: 101,
      date: '2026-08-05',
      sessionNumber: 1,
      topicCovered: 'Deadlocks and Banker Algorithm',
      user: mockUser
    });

    expect(result.success).toBe(true);
    expect(result.topic_covered).toBe('Deadlocks and Banker Algorithm');
  });

  it('should reject empty or whitespace-only topic', async () => {
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAssignment])
    }));

    await expect(
      AttendanceService.updateLectureTopic({
        assignmentId: 101,
        date: '2026-08-05',
        sessionNumber: 1,
        topicCovered: '   ',
        user: mockUser
      })
    ).rejects.toThrow('Topic covered is required (minimum 2 characters)');
  });

  it('should truncate topics exceeding 500 characters to 500 characters', async () => {
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAssignment])
    }));

    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 301 }])
    }));

    db.update.mockImplementationOnce(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    }));

    const longTopic = 'A'.repeat(600);
    const result = await AttendanceService.updateLectureTopic({
      assignmentId: 101,
      date: '2026-08-05',
      sessionNumber: 1,
      topicCovered: longTopic,
      user: mockUser
    });

    expect(result.success).toBe(true);
    expect(result.topic_covered?.length).toBe(500);
  });

  it('should reject unauthorized faculty attempting to modify another faculty session', async () => {
    const unauthorizedUser = { id: 99, role: 'faculty', branch: 'ECE', is_hod: false };

    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAssignment])
    }));

    // Mock substitution lookup (none found)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    }));

    await expect(AttendanceService.updateLectureTopic({
      assignmentId: 101,
      date: '2026-08-05',
      sessionNumber: 1,
      topicCovered: 'Malicious Edit',
      user: unauthorizedUser
    })).rejects.toThrow('Unauthorized to modify lecture topics for this assignment');
  });
});
