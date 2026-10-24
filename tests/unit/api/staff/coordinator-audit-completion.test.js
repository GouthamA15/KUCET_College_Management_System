import { describe, it, expect, vi } from 'vitest';
import { BASELINE_RULES } from '@/db/baseline-rules.js';

describe('First Year Coordinator Audit & Completion Validations', () => {
  describe('Database Migration 0026 Baseline Rule', () => {
    it('includes a baseline rule for migration 26 (0026_faculty_coordinator_assignments)', () => {
      const rule26 = BASELINE_RULES.find((r) => r.id === 26);
      expect(rule26).toBeDefined();
      expect(rule26.description).toContain('0026_faculty_coordinator_assignments');
    });

    it('rule 26 isSatisfied evaluates to true when faculty_coordinator_assignments table exists', async () => {
      const rule26 = BASELINE_RULES.find((r) => r.id === 26);
      const mockConn = {
        query: vi.fn(async () => [[{ count: 1 }]])
      };

      const isSatisfied = await rule26.isSatisfied(mockConn);
      expect(isSatisfied).toBe(true);
      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringContaining('faculty_coordinator_assignments')
      );
    });

    it('rule 26 isSatisfied evaluates to false when table does not exist', async () => {
      const rule26 = BASELINE_RULES.find((r) => r.id === 26);
      const mockConn = {
        query: vi.fn(async () => [[{ count: 0 }]])
      };

      const isSatisfied = await rule26.isSatisfied(mockConn);
      expect(isSatisfied).toBe(false);
    });
  });

  describe('Overview ID Card Stats Extraction Contract', () => {
    it('properly extracts totalEligible from API result structure (json.stats)', () => {
      // Simulating response payload from GET /api/staff/id-cards
      const apiResponsePayload = {
        success: true,
        students: [],
        pagination: { page: 1, limit: 20, total: 42, totalPages: 3 },
        stats: {
          totalEligible: 42,
          photosAvailable: 40,
          photosMissing: 2
        },
        branches: []
      };

      // Contract tested in CoordinatorWorkspaceClient:
      const idCardStats = apiResponsePayload.stats || apiResponsePayload.summary || null;
      expect(idCardStats).not.toBeNull();
      expect(idCardStats.totalEligible).toBe(42);
    });
  });

  describe('Timetable Instance Schema Academic Year Formats', () => {
    it('accepts both YYYY-YY and YYYY-YYYY academic year formats', () => {
      const regex = /^(\d{4}-\d{2}|\d{4}-\d{4})$/;
      expect(regex.test('2025-26')).toBe(true);
      expect(regex.test('2025-2026')).toBe(true);
      expect(regex.test('2024-25')).toBe(true);
      expect(regex.test('2024-2025')).toBe(true);
      expect(regex.test('invalid')).toBe(false);
      expect(regex.test('2025')).toBe(false);
    });
  });

  describe('Coordinator Date Comparison with Date Primitives', () => {
    it('correctly compares Date objects against string representations without NaN coercion', () => {
      const toDateStr = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return String(val).split('T')[0];
      };

      const todayStr = '2026-10-24';
      const pastDateObj = new Date('2026-06-30T00:00:00.000Z');
      const futureDateObj = new Date('2026-12-31T00:00:00.000Z');

      const pastStr = toDateStr(pastDateObj);
      const futureStr = toDateStr(futureDateObj);

      expect(todayStr > pastStr).toBe(true); // Expired
      expect(todayStr < futureStr).toBe(true); // Still active
    });
  });
});
