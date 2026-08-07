import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module mocks (must come before imports) ---
vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@/db/schema', () => ({
  students: {},
  studentAttendance: {},
  studentMarks: {},
  scholarshipSanctions: {},
  studentFeePayments: {},
  studentRequests: {},
  facultySubjectAssignments: {},
  attendanceSessions: {},
}));

vi.mock('@/lib/clock', () => ({
  getNow: () => new Date('2026-08-07T00:00:00.000Z'),
}));

vi.mock('drizzle-orm', () => {
  // sql is used as a tagged template: sql`count(*)`.mapWith(Number)
  // Tagged templates call fn(strings, ...values), must return object with .mapWith()
  const mockSqlResult = { mapWith: vi.fn().mockReturnThis() };
  const sql = vi.fn(() => mockSqlResult);
  return {
    eq: vi.fn(),
    and: vi.fn(),
    isNotNull: vi.fn(),
    lt: vi.fn(),
    inArray: vi.fn(),
    count: vi.fn(() => 'COUNT(*)'),
    gte: vi.fn(),
    lte: vi.fn(),
    sql,
  };
});

import { db } from '@/db';
import { RecommendationEngine } from '@/intelligence/recommendation/RecommendationEngine';

/**
 * Build a Drizzle-like chainable mock.
 * Responses array items are returned sequentially for each terminal call.
 * Supports: .select().from().where() and .select().from().where().groupBy()
 */
function buildChainMock(responses = []) {
  let callIdx = 0;
  const nextVal = () => responses[callIdx++] ?? [];

  const groupBy = vi.fn(() => Promise.resolve(nextVal()));
  const where = vi.fn(() => ({ groupBy, then: (fn, rej) => Promise.resolve(nextVal()).then(fn, rej) }));
  const from = vi.fn(() => ({ where }));
  db.select.mockReturnValue({ from });
  return { groupBy, where, from };
}

// --- Tests ---
describe('RecommendationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new RecommendationEngine();
    vi.clearAllMocks();
  });

  describe('generateForStudent', () => {
    it('generates IMPROVE_ATTENDANCE when overall attendance is below 75%', async () => {
      // attendance query returns 7 present out of 10 (70%) via groupBy
      buildChainMock([
        [{ assignmentId: 1, total: 10, present: 7 }], // attendance groupBy result
        [],  // student info (fee_reimbursement)
        [],  // fee payments
        [],  // scholarship sanctions
        [],  // marks
        [],  // certificate requests
      ]);

      const result = await engine.generateForStudent(1, '2025-26');

      expect(result.recommendations).toBeDefined();
      const attendanceRec = result.recommendations.find(
        r => r.type === 'IMPROVE_ATTENDANCE' || r.type === 'ATTEND_REMEDIAL',
      );
      expect(attendanceRec).toBeDefined();
      expect(attendanceRec.reason).toBeDefined();
      expect(attendanceRec.thresholdCrossed).toBe(true);
      expect(attendanceRec.dataUsed).toBeDefined();
      expect(attendanceRec.ruleApplied).toBeDefined();
      expect(attendanceRec.suggestedAction).toBeDefined();
    });

    it('generates APPLY_SCHOLARSHIP when eligible but no sanction exists', async () => {
      buildChainMock([
        [],  // attendance (no groupBy rows -> no attendance rec)
        [{ id: 1, fee_reimbursement: 'YES' }], // student row
        [],  // fee payments
        [],  // scholarship sanctions (empty -> APPLY_SCHOLARSHIP triggered)
        [],  // marks
        [],  // certificate requests
      ]);

      const result = await engine.generateForStudent(1, '2025-26');
      const rec = result.recommendations.find(r => r.type === 'APPLY_SCHOLARSHIP');
      expect(rec).toBeDefined();
      expect(rec.suggestedAction).toBeDefined();
      expect(rec.reason).toBeDefined();
    });
  });

  describe('generateForFaculty', () => {
    it('generates COMPLETE_SYLLABUS when topic coverage is below 70%', async () => {
      buildChainMock([
        [{ id: 1, subject_name: 'Mathematics', subject_code: 'MA101' }], // assignments
        [], // marks
        [
          { topic_covered: 'Topic 1' },
          { topic_covered: 'Topic 2' },
          { topic_covered: 'Topic 3' },
          { topic_covered: null },
          { topic_covered: null },
        ], // sessions (3/5 = 60% -> below 70% threshold)
        [], // pending attendance sessions
      ]);

      const result = await engine.generateForFaculty(1, '2025-26');
      const rec = result.recommendations.find(r => r.type === 'COMPLETE_SYLLABUS');
      expect(rec).toBeDefined();
      expect(rec.reason).toBeDefined();
    });
  });

  describe('generateForHOD', () => {
    it('generates ALLOCATE_EXTRA_FACULTY when faculty has > 6 subjects', async () => {
      buildChainMock([
        // faculty workload groupBy result (facultyId: 1 has 7 subjects -> overloaded)
        [{ facultyId: 1, count: 7 }, { facultyId: 2, count: 2 }],
      ]);

      const result = await engine.generateForHOD('CSE', '2025-26');
      const rec = result.recommendations.find(r => r.type === 'ALLOCATE_EXTRA_FACULTY');
      expect(rec).toBeDefined();
    });
  });

  describe('generateForAdmin', () => {
    it('generates PENDING_APPROVALS when more than 10 pending certificate requests', async () => {
      buildChainMock([
        [{ count: 15 }], // pending certificate requests count
        [],              // scholarship followup
        [],              // fee defaulters
      ]);

      const result = await engine.generateForAdmin('2025-26');
      const rec = result.recommendations.find(r => r.type === 'PENDING_APPROVALS');
      expect(rec).toBeDefined();
      expect(rec.reason).toContain('15');
    });
  });

  describe('recommendation shape', () => {
    it('every recommendation includes all required explainability fields', async () => {
      buildChainMock([
        [{ assignmentId: 1, total: 10, present: 6 }], // 60% attendance
        [],
        [],
        [],
        [],
        [],
      ]);

      const result = await engine.generateForStudent(1, '2025-26');
      result.recommendations.forEach(rec => {
        expect(rec.type).toBeDefined();
        expect(rec.priority).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.reason).toBeDefined();
        expect(rec.suggestedAction).toBeDefined();
        expect(rec.ruleApplied).toBeDefined();
        expect(rec.dataUsed).toBeDefined();
        expect(typeof rec.thresholdCrossed).toBe('boolean');
        expect(rec.generatedAt).toBeDefined();
      });
    });
  });
});
