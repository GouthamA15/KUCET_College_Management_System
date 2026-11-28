import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDelete, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/db/index.js', async () => {
  const schema = await vi.importActual('../../../src/db/schema.js');
  return {
    db: {
      delete: mockDelete.mockImplementation(() => ({
        where: vi.fn(async () => ({ affectedRows: 1 })),
      })),
      update: mockUpdate.mockImplementation(() => ({
        set: mockSet.mockImplementation(() => ({
          where: vi.fn(async () => ({ affectedRows: 2 })),
        })),
      })),
    },
    __schema: schema,
  };
});

import { pruneExpiredRecords } from '@/db/prune-tokens';
import { attendanceSessions, studentAttendance } from '@/db/schema';

describe('Database Garbage Collection (src/db/prune-tokens.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates expired active attendance_sessions without ever deleting attendance_sessions or student_attendance', async () => {
    await pruneExpiredRecords();

    const deletedTables = mockDelete.mock.calls.map((c) => c[0]);
    expect(deletedTables).not.toContain(attendanceSessions);
    expect(deletedTables).not.toContain(studentAttendance);

    expect(mockUpdate).toHaveBeenCalledWith(attendanceSessions);
    expect(mockSet).toHaveBeenCalledWith({ is_active: false });
  });
});
