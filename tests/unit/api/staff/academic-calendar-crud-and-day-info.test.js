import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as singleDayPOST } from '@/app/api/staff/academic-calendar/route';
import { POST as bulkUpdatePOST } from '@/app/api/staff/academic-calendar/bulk-update/route';
import { GET as dayInfoGET } from '@/app/api/public/academic-calendar/day-info/route';
import { db } from '@/db';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('P3.1 — Academic Calendar CRUD & Day-Info Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single-Day Operations (/api/staff/academic-calendar)', () => {
    it('allows HOD to upsert a holiday with an occasion name', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      let upsertPayload = null;
      vi.spyOn(db, 'insert').mockReturnValue({
        values: (val) => {
          upsertPayload = val;
          return {
            onDuplicateKeyUpdate: () => Promise.resolve()
          };
        }
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-10-02',
          academic_year: '2026-27',
          semester: 1,
          day_type: 'HOLIDAY',
          holiday_name: 'Gandhi Jayanti'
        })
      });

      const res = await singleDayPOST(req);
      expect(res.status).toBe(200);
      expect(upsertPayload.date).toBe('2026-10-02');
      expect(upsertPayload.day_type).toBe('HOLIDAY');
      expect(upsertPayload.holiday_name).toBe('Gandhi Jayanti');
    });

    it('rejects holiday creation if occasion name is missing', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-10-02',
          academic_year: '2026-27',
          semester: 1,
          day_type: 'HOLIDAY',
          holiday_name: '' // Missing!
        })
      });

      const res = await singleDayPOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Holiday name is required/);
    });
  });

  describe('Bulk Update (/api/staff/academic-calendar/bulk-update)', () => {
    it('preserves configured weekend days when bulk-updating a range to WORKING', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      let updateConditions = null;

      vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => Promise.resolve([
                { min_date: '2026-08-01', max_date: '2026-12-15' }
              ])
            })
          }),
          query: {
            semesters: {
              findFirst: () => Promise.resolve({
                weekend_pattern: ['SUNDAY']
              })
            }
          },
          update: vi.fn().mockReturnValue({
            set: () => ({
              where: (cond) => {
                updateConditions = cond;
                return Promise.resolve();
              }
            })
          })
        };
        return callback(mockTx);
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2026-27',
          semester: 1,
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          day_type: 'WORKING'
        })
      });

      const res = await bulkUpdatePOST(req);
      expect(res.status).toBe(200);
      expect(updateConditions).toBeDefined();
    });

    it('rejects bulk update when range is outside the generated calendar range', async () => {
      getAuthUser.mockResolvedValue({ id: 1, role: 'admin', is_hod: true });

      vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => Promise.resolve([
                { min_date: '2026-08-01', max_date: '2026-12-15' }
              ])
            })
          })
        };
        return callback(mockTx);
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2026-27',
          semester: 1,
          start_date: '2026-07-01', // Out of range!
          end_date: '2026-09-30',
          day_type: 'HOLIDAY',
          holiday_name: 'Summer Extension'
        })
      });

      const res = await bulkUpdatePOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Bulk update range cannot be outside/);
    });
  });

  describe('Day-Info Endpoint (/api/public/academic-calendar/day-info)', () => {
    it('maps higher course semesters (e.g. Sem 5) to term 1 and resolves calendar holiday', async () => {
      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue({
        start_date: '2026-08-01',
        end_date: '2026-12-15'
      });

      vi.spyOn(db.query.academicCalendar, 'findFirst').mockResolvedValue({
        day_type: 'HOLIDAY',
        holiday_name: 'Gandhi Jayanti'
      });

      const req = new Request('http://localhost:3000/api/public/academic-calendar/day-info?date=2026-10-02&academic_year=2026-27&semester=5');
      const res = await dayInfoGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.day_type).toBe('HOLIDAY');
      expect(json.data.holiday_name).toBe('Gandhi Jayanti');
    });

    it('returns HOLIDAY status when date falls outside the academic term window', async () => {
      vi.spyOn(db.query.semesters, 'findFirst').mockResolvedValue({
        start_date: '2026-08-01',
        end_date: '2026-12-15'
      });

      const req = new Request('http://localhost:3000/api/public/academic-calendar/day-info?date=2027-01-10&academic_year=2026-27&semester=1');
      const res = await dayInfoGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.day_type).toBe('HOLIDAY');
      expect(json.data.holiday_name).toMatch(/outside the academic term window/);
    });
  });
});
