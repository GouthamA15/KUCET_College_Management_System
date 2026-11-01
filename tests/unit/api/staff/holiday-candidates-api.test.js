import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as candidatesGET, POST as candidatesPOST } from '@/app/api/staff/academic-calendar/holiday-candidates/route';
import { db } from '@/db';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('P2.2 & P2.4 — Holiday Candidates Discovery & Approval API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/academic-calendar/holiday-candidates', () => {
    it('rejects unauthenticated or unauthorized users', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates?academic_year=2026-27&semester=1');
      const res = await candidatesGET(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid academic_year format', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates?academic_year=invalid-year&semester=1');
      const res = await candidatesGET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid academic_year format/);
    });

    it('returns 404 when semester is not configured', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates?academic_year=2026-27&semester=1');
      const res = await candidatesGET(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/Semester setup not found/);
    });

    it('returns enriched candidate list without mutating the database', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue({
        id: 1,
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-15',
        weekend_pattern: ['SUNDAY']
      });

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([
            { id: 1, date: '2026-08-15', day_type: 'HOLIDAY', holiday_name: 'Independence Day' }
          ])
        })
      });

      const insertSpy = vi.spyOn(db, 'insert');
      const updateSpy = vi.spyOn(db, 'update');
      const deleteSpy = vi.spyOn(db, 'delete');

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates?academic_year=2026-27&semester=1');
      const res = await candidatesGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.academic_year).toBe('2026-27');
      expect(json.data.candidates.length).toBeGreaterThan(0);

      // Verify no DB mutations occurred
      expect(insertSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/staff/academic-calendar/holiday-candidates', () => {
    it('validates dates are within configured semester boundaries', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue({
        id: 1,
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-15'
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2026-27',
          semester: 1,
          holidays: [
            { date: '2027-01-26', name: 'Republic Day' } // Outside Aug-Dec window!
          ]
        })
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/outside the semester window/);
    });

    it('sanitizes holiday names and preserves existing EXAM classifications unless authorized', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue({
        id: 1,
        academic_year: '2026-27',
        semester: 1,
        start_date: '2026-08-01',
        end_date: '2026-12-15'
      });

      const existingCalendarRows = [
        {
          id: 50,
          date: '2026-08-15',
          day_type: 'WORKING',
          holiday_name: null
        },
        {
          id: 51,
          date: '2026-10-02',
          day_type: 'EXAM', // Collision!
          holiday_name: null
        }
      ];

      const updatedRows = [];

      vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => Promise.resolve(existingCalendarRows)
            })
          }),
          update: vi.fn().mockImplementation(() => ({
            set: (data) => ({
              where: () => {
                updatedRows.push(data);
                return Promise.resolve();
              }
            })
          })),
          insert: vi.fn().mockImplementation(() => ({
            values: () => Promise.resolve()
          }))
        };
        return callback(mockTx);
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/holiday-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2026-27',
          semester: 1,
          holidays: [
            {
              date: '2026-08-15',
              name: '<b>Independence Day</b><script>', // Contains HTML to sanitize
              replace_conflicts: false
            },
            {
              date: '2026-10-02',
              name: 'Gandhi Jayanti',
              replace_conflicts: false // Collides with EXAM, should be skipped
            }
          ]
        })
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.approvedCount).toBe(1);
      expect(json.data.skippedCount).toBe(1);
      expect(json.data.skippedConflicts[0].date).toBe('2026-10-02');

      // Check sanitization: HTML tags were stripped
      expect(updatedRows[0].holiday_name).toBe('Independence Day');
    });
  });
});
