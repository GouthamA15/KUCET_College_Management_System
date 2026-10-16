import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '@/services/AttendanceService';

describe('Academic Calendar & Attendance Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows attendance on a regular weekday within the active semester boundaries', async () => {
    // 2026-09-02 is Wednesday (weekday)
    const mockTx = {
      select: vi.fn().mockImplementation((fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              if (fields?.startDate) {
                return [{
                  startDate: '2026-08-01',
                  endDate: '2026-12-15'
                }];
              }
              // academicCalendar entry: WORKING day
              return [{ dayType: 'WORKING', holidayName: null }];
            })
          }))
        }))
      }))
    };

    const result = await AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2026-09-02',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    });

    expect(result).toBe(true);
  });

  it('rejects attendance if date is outside the active semester boundaries', async () => {
    const mockTx = {
      select: vi.fn().mockImplementation((_fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              return [{
                startDate: '2026-08-01',
                endDate: '2026-12-15'
              }];
            })
          }))
        }))
      }))
    };

    // Date is 2027-01-10 (outside 2026-08-01 to 2026-12-15)
    await expect(AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2027-01-10',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    })).rejects.toThrow(/outside the permitted semester calendar dates/);
  });

  it('rejects attendance on Sunday when no makeup-class exception exists', async () => {
    // 2026-09-06 is Sunday
    const mockTx = {
      select: vi.fn().mockImplementation((fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              if (fields?.startDate) {
                return [{ startDate: '2026-08-01', endDate: '2026-12-15' }];
              }
              if (fields?.dayType) {
                return [];
              }
              // makeupClassExceptions returns empty
              return [];
            })
          }))
        }))
      }))
    };

    await expect(AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2026-09-06',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    })).rejects.toThrow(/Sunday without an authorized makeup-class exception/);
  });

  it('allows attendance on Sunday when an authorized makeup-class exception exists', async () => {
    // 2026-09-06 is Sunday
    const mockTx = {
      select: vi.fn().mockImplementation((fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              if (fields?.startDate) {
                return [{ startDate: '2026-08-01', endDate: '2026-12-15' }];
              }
              if (fields?.dayType) {
                return [];
              }
              // makeupClassExceptions returns authorized record
              return [{ id: 99, reason: 'Compensating for symposium' }];
            })
          }))
        }))
      }))
    };

    const result = await AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2026-09-06',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    });

    expect(result).toBe(true);
  });

  it('rejects attendance on a declared HOLIDAY when no makeup-class exception exists', async () => {
    // 2026-10-02 (Gandhi Jayanti - Friday)
    const mockTx = {
      select: vi.fn().mockImplementation((fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              if (fields?.startDate) {
                return [{ startDate: '2026-08-01', endDate: '2026-12-15' }];
              }
              if (fields?.dayType) {
                return [{ dayType: 'HOLIDAY', holidayName: 'Gandhi Jayanti' }];
              }
              return [];
            })
          }))
        }))
      }))
    };

    await expect(AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2026-10-02',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    })).rejects.toThrow(/declared holiday \(Gandhi Jayanti\) without an authorized makeup-class exception/);
  });

  it('allows attendance on a declared HOLIDAY when an authorized makeup-class exception exists', async () => {
    const mockTx = {
      select: vi.fn().mockImplementation((fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              if (fields?.startDate) {
                return [{ startDate: '2026-08-01', endDate: '2026-12-15' }];
              }
              if (fields?.dayType) {
                return [{ dayType: 'HOLIDAY', holidayName: 'Gandhi Jayanti' }];
              }
              return [{ id: 105, reason: 'Special lab makeup session' }];
            })
          }))
        }))
      }))
    };

    const result = await AttendanceService.validateAttendanceDate({
      assignmentId: 101,
      date: '2026-10-02',
      sessionNumber: 1,
      academicYear: '2026-2027',
      semester: 5,
      tx: mockTx
    });

    expect(result).toBe(true);
  });
});
