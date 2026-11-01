import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  THEORY_ASSESSMENT_PATTERNS, 
  getTheoryPattern, 
  validateTheoryMarks, 
  checkPatternSwitchCompatibility 
} from '@/lib/evaluation-utils';
import * as academicUtils from '@/lib/academic-utils';
import { EvaluationReportService } from '@/services/academic/EvaluationReportService';

let mockAssignmentRows = [];
let mockMarksRows = [];
let mockPublishedRows = [];
let mockAuditInserts = [];

vi.mock('@/db', () => {
  return {
    db: {
      select: (fields) => {
        const query = {
          from: () => {
            const fromQuery = {
              leftJoin: () => fromQuery,
              where: () => {
                const whereQuery = {
                  orderBy: () => ({
                    limit: async () => [{ id: 999 }]
                  }),
                  limit: async () => {
                    if (fields && fields.id && !fields.subject_code && !fields.student_id) {
                      return mockPublishedRows;
                    }
                    return mockAssignmentRows;
                  },
                  then: (resolve) => resolve(mockMarksRows)
                };
                return whereQuery;
              },
              limit: async () => mockAssignmentRows
            };
            return fromQuery;
          }
        };
        return query;
      },
      transaction: async (cb) => {
        const tx = {
          update: () => ({
            set: () => ({
              where: async () => ({})
            })
          }),
          insert: () => ({
            values: async (data) => {
              mockAuditInserts.push(data);
              return {};
            }
          })
        };
        return cb(tx);
      }
    }
  };
});

describe('Faculty-Selected Theory Assessment Patterns Unit Tests', () => {
  beforeEach(() => {
    mockAssignmentRows = [
      {
        id: 999,
        staff_account_id: 10,
        subject_code: 'BSC101',
        subject_name: 'Physics',
        branch: 'CSE',
        course_semester: 1,
        academic_term: 1,
        academic_year: '2026-27',
        mid_max: 20,
        faculty_name: 'Dr. Test',
        faculty_email: 'test@kucet.ac.in',
        canonical_subject_type: 'theory'
      }
    ];
    mockMarksRows = [];
    mockPublishedRows = [];
    mockAuditInserts = [];
    vi.restoreAllMocks();
  });

  describe('1. Pattern Definitions & Invariants', () => {
    it('defines the three authoritative assessment patterns with total 30 marks', () => {
      const p1 = THEORY_ASSESSMENT_PATTERNS.PATTERN_1;
      const p2 = THEORY_ASSESSMENT_PATTERNS.PATTERN_2;
      const p3 = THEORY_ASSESSMENT_PATTERNS.PATTERN_3;

      expect(p1.id).toBe('MID_20_ASSIGNMENT_10');
      expect(p1.midMax).toBe(20);
      expect(p1.assignmentMax).toBe(10);
      expect(p1.totalMax).toBe(30);
      expect(p1.hasAssignment).toBe(true);

      expect(p2.id).toBe('MID_25_ASSIGNMENT_5');
      expect(p2.midMax).toBe(25);
      expect(p2.assignmentMax).toBe(5);
      expect(p2.totalMax).toBe(30);
      expect(p2.hasAssignment).toBe(true);

      expect(p3.id).toBe('MID_30_ONLY');
      expect(p3.midMax).toBe(30);
      expect(p3.assignmentMax).toBeNull(); // N/A
      expect(p3.totalMax).toBe(30);
      expect(p3.hasAssignment).toBe(false);
    });

    it('resolves patterns from numbers, keys, or IDs using getTheoryPattern', () => {
      expect(getTheoryPattern(20)?.id).toBe('MID_20_ASSIGNMENT_10');
      expect(getTheoryPattern('20')?.id).toBe('MID_20_ASSIGNMENT_10');
      expect(getTheoryPattern('MID_20_ASSIGNMENT_10')?.id).toBe('MID_20_ASSIGNMENT_10');
      expect(getTheoryPattern('20_10')?.id).toBe('MID_20_ASSIGNMENT_10');

      expect(getTheoryPattern(25)?.id).toBe('MID_25_ASSIGNMENT_5');
      expect(getTheoryPattern('MID_25_ASSIGNMENT_5')?.id).toBe('MID_25_ASSIGNMENT_5');
      expect(getTheoryPattern('25_5')?.id).toBe('MID_25_ASSIGNMENT_5');

      expect(getTheoryPattern(30)?.id).toBe('MID_30_ONLY');
      expect(getTheoryPattern('MID_30_ONLY')?.id).toBe('MID_30_ONLY');
      expect(getTheoryPattern('30_0')?.id).toBe('MID_30_ONLY');

      expect(getTheoryPattern(15)).toBeNull();
      expect(getTheoryPattern(null)).toBeNull();
      expect(getTheoryPattern(undefined)).toBeNull();
      expect(getTheoryPattern('INVALID')).toBeNull();
    });

    it('academic-utils maintains backwards-compatible re-exports from evaluation-utils', () => {
      expect(academicUtils.THEORY_ASSESSMENT_PATTERNS).toBe(THEORY_ASSESSMENT_PATTERNS);
      expect(academicUtils.getTheoryPattern).toBe(getTheoryPattern);
      expect(academicUtils.validateTheoryMarks).toBe(validateTheoryMarks);
      expect(academicUtils.checkPatternSwitchCompatibility).toBe(checkPatternSwitchCompatibility);
    });
  });

  describe('2. Marks Validation & Calculations per Pattern', () => {
    it('validates Pattern 1 (20 + 10) correctly and computes Best-of-Mids + Assignment', () => {
      // Valid: Mid1=18, Mid2=15 (best=18), Assignment=9 => Total = 27
      const res = validateTheoryMarks(20, { mid1: 18, mid2: 15, assignment: 9 });
      expect(res.valid).toBe(true);
      expect(res.total).toBe(27);

      // Mid exceeding 20
      const invalidMid = validateTheoryMarks(20, { mid1: 22, mid2: 15, assignment: 9 });
      expect(invalidMid.valid).toBe(false);
      expect(invalidMid.error).toContain('limit of 20');

      // Assignment exceeding 10
      const invalidAssign = validateTheoryMarks(20, { mid1: 18, mid2: 15, assignment: 12 });
      expect(invalidAssign.valid).toBe(false);
      expect(invalidAssign.error).toContain('limit of 10');
    });

    it('validates Pattern 2 (25 + 5) correctly and enforces assignment max 5', () => {
      // Valid: Mid1=22, Mid2=24 (best=24), Assignment=5 => Total = 29
      const res = validateTheoryMarks(25, { mid1: 22, mid2: 24, assignment: 5 });
      expect(res.valid).toBe(true);
      expect(res.total).toBe(29);

      // Assignment of 6 rejected
      const invalid = validateTheoryMarks(25, { mid1: 20, mid2: 20, assignment: 6 });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('limit of 5');

      // Mid of 25 accepted
      const edge = validateTheoryMarks(25, { mid1: 25, mid2: 0, assignment: 0 });
      expect(edge.valid).toBe(true);
      expect(edge.total).toBe(25);
    });

    it('validates Pattern 3 (30 for Mids) correctly with Assignment Not Applicable', () => {
      // Valid: Mid1=28, Mid2=26 (best=28), Assignment=null => Total = 28
      const res = validateTheoryMarks(30, { mid1: 28, mid2: 26, assignment: null });
      expect(res.valid).toBe(true);
      expect(res.total).toBe(28);

      // Empty string assignment accepted as null
      const resEmpty = validateTheoryMarks(30, { mid1: 30, mid2: 25, assignment: '' });
      expect(resEmpty.valid).toBe(true);
      expect(resEmpty.total).toBe(30);

      // Numeric assignment marks rejected for Pattern 3
      const invalid = validateTheoryMarks(30, { mid1: 25, mid2: 20, assignment: 4 });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('not applicable for Pattern 3');

      // Zero assignment marks also rejected because assignment is N/A
      const invalidZero = validateTheoryMarks(30, { mid1: 25, mid2: 20, assignment: 0 });
      expect(invalidZero.valid).toBe(false);
    });

    it('supports decimal marks (0.5 steps)', () => {
      const res = validateTheoryMarks(20, { mid1: 17.5, mid2: 18.5, assignment: 8.5 });
      expect(res.valid).toBe(true);
      expect(res.total).toBe(27);
    });
  });

  describe('3. Pattern Switching Compatibility Rules', () => {
    it('allows switching freely when no marks exist', () => {
      const res = checkPatternSwitchCompatibility([], 25);
      expect(res.compatible).toBe(true);
    });

    it('allows switching from 20+10 to 25+5 if assignment marks <= 5', () => {
      const marks = [
        { mid1_marks: 18, mid2_marks: 15, assignment_marks: 5 },
        { mid1_marks: 12, mid2_marks: 14, assignment_marks: 3 },
      ];
      const res = checkPatternSwitchCompatibility(marks, 25);
      expect(res.compatible).toBe(true);
    });

    it('rejects switching from 20+10 to 25+5 if assignment marks exceed 5', () => {
      const marks = [
        { mid1_marks: 18, mid2_marks: 15, assignment_marks: 8 },
      ];
      const res = checkPatternSwitchCompatibility(marks, 25);
      expect(res.compatible).toBe(false);
      expect(res.reason).toContain('limit of 5 for Pattern 2');
    });

    it('rejects switching from 25+5 to 20+10 if mid marks exceed 20', () => {
      const marks = [
        { mid1_marks: 23, mid2_marks: 18, assignment_marks: 4 },
      ];
      const res = checkPatternSwitchCompatibility(marks, 20);
      expect(res.compatible).toBe(false);
      expect(res.reason).toContain('limit of 20 for Pattern 1');
    });

    it('rejects switching to Pattern 3 if assignment marks were entered', () => {
      const marks = [
        { mid1_marks: 18, mid2_marks: 19, assignment_marks: 5 },
      ];
      const res = checkPatternSwitchCompatibility(marks, 30);
      expect(res.compatible).toBe(false);
      expect(res.reason).toContain('does not include an Assignment component');
    });

    it('allows switching to Pattern 3 if only mid marks exist (no assignment marks)', () => {
      const marks = [
        { mid1_marks: 18, mid2_marks: 19, assignment_marks: null },
        { mid1_marks: 22, mid2_marks: 20, assignment_marks: '' },
      ];
      const res = checkPatternSwitchCompatibility(marks, 30);
      expect(res.compatible).toBe(true);
    });
  });

  describe('4. PDF Export Integration & Pattern 3 Restrictions', () => {
    it('throws 400 error when requesting assignment report for Pattern 3', async () => {
      mockAssignmentRows = [{
        id: 999,
        staff_account_id: 10,
        subject_code: 'BSC101',
        subject_name: 'Physics',
        branch: 'CSE',
        course_semester: 1,
        academic_term: 1,
        academic_year: '2026-27',
        mid_max: 30,
        faculty_name: 'Dr. Test',
        faculty_email: 'test@kucet.ac.in',
        canonical_subject_type: 'theory'
      }];

      await expect(
        EvaluationReportService.getReportData({
          assignmentId: 999,
          view: 'assignment',
          user: { id: 10, role: 'faculty' }
        })
      ).rejects.toThrow('Assignment assessment report is not applicable for Pattern 3 (30 for Mids).');
    });
  });

  describe('5. Assessment Pattern API Routes & Strict Locking Rules', () => {
    it('5.1 GET rejects unauthenticated requests with HTTP 401', async () => {
      const { GET } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern?assignment_id=999');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('5.2 GET reports is_locked: false when no marks are saved', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 10 });

      mockMarksRows = []; // No marks
      const { GET } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern?assignment_id=999');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.is_locked).toBe(false);
      expect(json.can_change).toBe(true);
      expect(json.has_saved_marks).toBe(false);
    });

    it('5.3 GET reports is_locked: true when a student has a saved mark of 0', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 10 });

      // Saved mark of 0.00
      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 0, mid2_marks: null, assignment_marks: null }];

      const { GET } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern?assignment_id=999');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.is_locked).toBe(true);
      expect(json.can_change).toBe(false);
      expect(json.has_saved_marks).toBe(true);
    });

    it('5.4 GET treats null, empty string, or undefined as not saved', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 10 });

      // Only null or empty strings
      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: null, mid2_marks: '', assignment_marks: null }];

      const { GET } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern?assignment_id=999');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.is_locked).toBe(false);
      expect(json.can_change).toBe(true);
      expect(json.has_saved_marks).toBe(false);
    });

    it('5.5 POST allows ordinary faculty to set initial pattern when no marks exist', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 10 });

      mockMarksRows = []; // No saved marks

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: 999, pattern_id: 'MID_25_ASSIGNMENT_5' })
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mid_max).toBe(25);
      expect(mockAuditInserts.length).toBe(1);
      expect(mockAuditInserts[0].action).toBe('SET_ASSESSMENT_PATTERN');
    });

    it('5.6 POST strictly rejects ordinary faculty pattern changes when marks exist (even mark of 0)', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 10 });

      // Student has saved mark of 0
      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 0, mid2_marks: null, assignment_marks: null }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: 999, pattern_id: 'MID_25_ASSIGNMENT_5' })
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('PATTERN_LOCKED_MARKS_EXIST');
      expect(json.error).toContain('permanently locked');
    });

    it('5.7 POST rejects HOD override if reason is missing or whitespace-only', async () => {
      const apiUtils = await import('@/lib/api-utils');
      // User is HOD of CSE
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'faculty',
        id: 20,
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      });

      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 15, mid2_marks: null, assignment_marks: 5 }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: '   ' // Whitespace only
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('minimum 5 characters');
    });

    it('5.8 POST rejects HOD override if HOD is not authorized for the subject branch', async () => {
      const apiUtils = await import('@/lib/api-utils');
      // User is HOD of ECE, but assignment is CSE
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'faculty',
        id: 30,
        is_hod: true,
        branch: 'ECE',
        authorized_branches: ['ECE']
      });

      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 15, mid2_marks: null, assignment_marks: 5 }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: 'Approved by departmental academic council.'
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('not authorized');
    });

    it('5.9 POST allows authorized HOD override with valid reason and records audit log', async () => {
      const apiUtils = await import('@/lib/api-utils');
      // User is HOD of CSE
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'faculty',
        id: 20,
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      });

      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 15, mid2_marks: 14, assignment_marks: 4 }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: 'Approved by departmental academic council meeting on Oct 28.'
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mid_max).toBe(25);
      expect(mockAuditInserts.length).toBe(1);
      expect(mockAuditInserts[0].action).toBe('OVERRIDE_ASSESSMENT_PATTERN');
      expect(mockAuditInserts[0].payload_after.reason).toContain('academic council');
      expect(mockAuditInserts[0].payload_after.is_override).toBe(true);
    });

    it('5.10 POST allows Super Admin override with valid reason', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'admin',
        id: 1
      });

      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 18, mid2_marks: null, assignment_marks: 3 }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: 'Institutional curriculum realignment order #2026-44.'
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mid_max).toBe(25);
      expect(mockAuditInserts.length).toBe(1);
      expect(mockAuditInserts[0].action).toBe('OVERRIDE_ASSESSMENT_PATTERN');
    });

    it('5.11 POST rejects override when target pattern is incompatible with existing student marks', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'admin',
        id: 1
      });

      // Existing assignment marks = 8, which exceeds Pattern 2 (max 5)
      mockMarksRows = [{ id: 1, student_id: 101, mid1_marks: 18, mid2_marks: null, assignment_marks: 8 }];

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: 'Attempting invalid override.'
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toContain('limit of 5 for Pattern 2');
    });

    it('5.12 POST strictly rejects pattern modifications once marks are published', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({
        role: 'admin',
        id: 1
      });

      mockPublishedRows = [{ id: 100 }]; // Published marks exist

      const { POST } = await import('@/app/api/staff/faculty/evaluation/pattern/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 999,
          pattern_id: 'MID_25_ASSIGNMENT_5',
          reason: 'Attempt on published subject.'
        })
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('already been published');
    });
  });
});
