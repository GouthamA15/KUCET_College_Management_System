import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as generatePOST } from '@/app/api/staff/academic-calendar/generate/route';
import { db } from '@/db';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('P1.1 — Safe Academic Calendar Generation & Holiday Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUser.mockResolvedValue({
      id: 1,
      role: 'admin',
      is_hod: true
    });
  });

  it('rejects semester duration shorter than 120 days', async () => {
    const req = new Request('http://localhost:3000/api/staff/academic-calendar/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-10-01', // ~62 days
        weekend_days: ['SUNDAY']
      })
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Minimum allowed is 120 days/);
  });

  it('rejects overlapping dates with another semester in the same academic year', async () => {
    vi.spyOn(db, 'select').mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([
          {
            id: 2,
            academic_year: '2026-27',
            semester: 2,
            start_date: '2026-12-01',
            end_date: '2027-04-30',
            weekend_pattern: ['SUNDAY']
          }
        ])
      })
    });

    const req = new Request('http://localhost:3000/api/staff/academic-calendar/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-15', // Overlaps 2026-12-01
        weekend_days: ['SUNDAY']
      })
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Overlapping dates with Semester 2/);
  });

  it('preserves existing declared holidays, occasion names, exams, and events during regeneration', async () => {
    // Mock no overlapping semesters
    vi.spyOn(db, 'select').mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([])
      })
    });

    const existingRecords = [
      {
        id: 101,
        date: '2026-08-15',
        academic_year: '2026-27',
        semester: 1,
        day_type: 'HOLIDAY',
        holiday_name: 'Independence Day'
      },
      {
        id: 102,
        date: '2026-10-02',
        academic_year: '2026-27',
        semester: 1,
        day_type: 'HOLIDAY',
        holiday_name: 'Gandhi Jayanti'
      },
      {
        id: 103,
        date: '2026-09-15',
        academic_year: '2026-27',
        semester: 1,
        day_type: 'INTERNAL',
        holiday_name: null
      },
      {
        id: 104,
        date: '2026-11-20',
        academic_year: '2026-27',
        semester: 1,
        day_type: 'EXAM',
        holiday_name: null
      },
      {
        id: 105,
        date: '2026-08-02', // Sunday
        academic_year: '2026-27',
        semester: 1,
        day_type: 'HOLIDAY',
        holiday_name: 'Weekend'
      }
    ];

    let _insertedRecords = [];
    let updatedWeekendRecords = [];
    let updatedWorkingRecords = [];
    let deletedSemester = false;
    let insertedSemester = null;

    vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: () => ({
            where: () => Promise.resolve(existingRecords)
          })
        }),
        delete: vi.fn().mockImplementation((_table) => ({
          where: () => {
            deletedSemester = true;
            return Promise.resolve();
          }
        })),
        insert: vi.fn().mockImplementation((_table) => ({
          values: (vals) => {
            if (Array.isArray(vals)) {
              _insertedRecords = vals;
            } else {
              insertedSemester = vals;
            }
            return Promise.resolve();
          }
        })),
        update: vi.fn().mockImplementation(() => ({
          set: (data) => ({
            where: () => {
              if (data.holiday_name === 'Weekend') {
                updatedWeekendRecords.push(data);
              } else if (data.day_type === 'WORKING') {
                updatedWorkingRecords.push(data);
              }
              return Promise.resolve();
            }
          })
        }))
      };

      return callback(mockTx);
    });

    const req = new Request('http://localhost:3000/api/staff/academic-calendar/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-05', // 127 days
        weekend_days: ['SUNDAY']
      })
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.preservedHolidaysCount).toBe(2); // Independence Day & Gandhi Jayanti
    expect(json.data.preservedCustomDaysCount).toBe(2); // Internal & Exam
    expect(json.data.insertedCount).toBeGreaterThan(0);
    expect(deletedSemester).toBe(true);
    expect(insertedSemester.academic_year).toBe('2026-27');
  });

  it('requires explicit confirmation when changing dates would exclude existing records', async () => {
    vi.spyOn(db, 'select').mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([])
      })
    });

    const existingRecordsWithOutlier = [
      {
        id: 201,
        date: '2026-07-25', // Before new start_date (2026-08-01)
        academic_year: '2026-27',
        semester: 1,
        day_type: 'HOLIDAY',
        holiday_name: 'Early Bridge Workshop'
      }
    ];

    vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: () => ({
            where: () => Promise.resolve(existingRecordsWithOutlier)
          })
        })
      };
      return callback(mockTx);
    });

    // Request without confirm_date_change
    const req = new Request('http://localhost:3000/api/staff/academic-calendar/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-05',
        weekend_days: ['SUNDAY']
      })
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Explicit confirmation is required/);
    expect(json.details.requires_confirmation).toBe(true);
    expect(json.details.affectedCount).toBe(1);
  });
});
