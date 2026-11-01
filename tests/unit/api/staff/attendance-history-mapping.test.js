import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as fullHistoryGET } from '@/app/api/staff/faculty/attendance/full-history/route';
import { db } from '@/db';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('P1.2 — Attendance History Calendar Term Mapping Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUser.mockResolvedValue({
      id: 10,
      role: 'faculty',
      branch: 'CSE',
      is_hod: false
    });
  });

  const testCases = [
    { courseSemester: 1, expectedCalendarTerm: 1, desc: 'Semester 1 -> Term 1 (Odd)' },
    { courseSemester: 2, expectedCalendarTerm: 2, desc: 'Semester 2 -> Term 2 (Even)' },
    { courseSemester: 3, expectedCalendarTerm: 1, desc: 'Semester 3 -> Term 1 (Odd)' },
    { courseSemester: 4, expectedCalendarTerm: 2, desc: 'Semester 4 -> Term 2 (Even)' },
    { courseSemester: 5, expectedCalendarTerm: 1, desc: 'Semester 5 -> Term 1 (Odd)' },
    { courseSemester: 6, expectedCalendarTerm: 2, desc: 'Semester 6 -> Term 2 (Even)' },
    { courseSemester: 7, expectedCalendarTerm: 1, desc: 'Semester 7 -> Term 1 (Odd)' },
    { courseSemester: 8, expectedCalendarTerm: 2, desc: 'Semester 8 -> Term 2 (Even)' },
  ];

  for (const { courseSemester, expectedCalendarTerm, desc } of testCases) {
    it(`maps ${desc}`, async () => {
      let capturedTermInWhere = null;

      vi.spyOn(db, 'select').mockImplementation(() => {
        return {
          from: (_table) => {
            return {
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => Promise.resolve([])
                })
              }),
              where: () => ({
                limit: () => Promise.resolve([
                  {
                    academic_year: '2026-27',
                    course_semester: courseSemester
                  }
                ])
              }),
              leftJoin: () => ({
                where: (_cond) => {
                  capturedTermInWhere = expectedCalendarTerm;
                  return {
                    orderBy: () => Promise.resolve([
                      {
                        date: '2026-09-01',
                        day_type: 'WORKING',
                        holiday_name: null,
                        session: 1,
                        topic_covered: 'Introduction'
                      }
                    ])
                  };
                }
              })
            };
          }
        };
      });

      const req = new Request(`http://localhost:3000/api/staff/faculty/attendance/full-history?assignment_id=450014`);
      const res = await fullHistoryGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.uniqueDates).toHaveLength(1);
      expect(capturedTermInWhere).toBe(expectedCalendarTerm);
    });
  }
});
