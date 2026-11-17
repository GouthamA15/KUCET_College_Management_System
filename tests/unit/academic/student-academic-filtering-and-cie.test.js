import { describe, it, expect } from 'vitest';
import { calculateStudentCIE } from '@/lib/evaluation-utils';

describe('Student Academic Module — CIE Calculation & Subject Filtering Invariants', () => {

  describe('1. Authoritative Continuous Internal Evaluation (CIE) Calculation', () => {
    it('1.1 returns clean empty state when no subjects are provided', () => {
      const result = calculateStudentCIE([]);
      expect(result.hasMarks).toBe(false);
      expect(result.evaluatedCount).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.averageScore).toBeNull();
      expect(result.averagePercentage).toBeNull();
      expect(result.isPartial).toBe(false);
      expect(result.isComplete).toBe(false);
      expect(result.maxMarks).toBe(30);
    });

    it('1.2 returns clean un-evaluated state when subjects exist but no marks are entered', () => {
      const subjects = [
        { subject_code: 'CS301', subject_name: 'Data Structures', subject_type: 'theory', mid1_marks: null, mid2_marks: null, assignment_marks: null },
        { subject_code: 'CS302', subject_name: 'Algorithms', subject_type: 'theory', mid1_marks: null, mid2_marks: null, assignment_marks: null },
        { subject_code: 'CS301L', subject_name: 'DS Lab', subject_type: 'lab', lab_execution_marks: null, lab_theory_marks: null, lab_record_marks: null }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(false);
      expect(result.evaluatedCount).toBe(0);
      expect(result.totalCount).toBe(3);
      expect(result.averageScore).toBeNull();
      expect(result.averagePercentage).toBeNull();
      expect(result.isPartial).toBe(false);
      expect(result.isComplete).toBe(false);
    });

    it('1.3 evaluates theory subject with Mid-1 only (pure Best-of-Mids)', () => {
      const subjects = [
        {
          subject_code: 'CS401',
          subject_name: 'Operating Systems',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '16.5',
          mid2_marks: null,
          assignment_marks: null
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.evaluatedCount).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(result.averageScore).toBe(16.5);
      expect(result.averagePercentage).toBe(55); // (16.5 / 30) * 100 = 55%
      expect(result.isComplete).toBe(true);
      expect(result.isPartial).toBe(false);
    });

    it('1.4 evaluates theory subject with both Mid-1 and Mid-2 plus Assignment', () => {
      const subjects = [
        {
          subject_code: 'CS401',
          subject_name: 'Operating Systems',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '14.0',
          mid2_marks: '18.5', // Best of Mids: 18.5
          assignment_marks: '9.0' // 18.5 + 9.0 = 27.5
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.averageScore).toBe(27.5);
      expect(result.averagePercentage).toBe(91.7); // (27.5 / 30) * 100 = 91.666... -> 91.7%
    });

    it('1.5 respects Pattern 3 (mid_max = 30) where Assignment is Not Applicable', () => {
      const subjects = [
        {
          subject_code: 'HS301',
          subject_name: 'Managerial Economics',
          subject_type: 'theory',
          mid_max: 30, // Pattern 3: Mids Only (30)
          mid1_marks: '22.0',
          mid2_marks: '26.0',
          assignment_marks: '10.0' // Should be ignored in Pattern 3
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.averageScore).toBe(26.0); // Best of (22, 26) = 26.0 (assignment not added)
    });

    it('1.6 evaluates laboratory subject (Execution + Writing + Record)', () => {
      const subjects = [
        {
          subject_code: 'CS401L',
          subject_name: 'Operating Systems Lab',
          subject_type: 'lab',
          lab_execution_marks: '9.5',
          lab_theory_marks: '8.5',
          lab_record_marks: '4.5' // 9.5 + 8.5 + 4.5 = 22.5
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.averageScore).toBe(22.5);
      expect(result.averagePercentage).toBe(75); // (22.5 / 30) * 100 = 75%
    });

    it('1.7 computes arithmetic mean across mixed theory and laboratory subjects', () => {
      const subjects = [
        {
          subject_code: 'CS501',
          subject_name: 'Computer Networks',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '18.0',
          mid2_marks: '16.0',
          assignment_marks: '8.0' // Best mid 18 + 8 = 26.0
        },
        {
          subject_code: 'CS502',
          subject_name: 'Compiler Design',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '15.0',
          mid2_marks: '19.0',
          assignment_marks: '9.0' // Best mid 19 + 9 = 28.0
        },
        {
          subject_code: 'CS501L',
          subject_name: 'CN Lab',
          subject_type: 'lab',
          lab_execution_marks: '10.0',
          lab_theory_marks: '9.0',
          lab_record_marks: '5.0' // 10 + 9 + 5 = 24.0
        }
      ];

      // Mean: (26.0 + 28.0 + 24.0) / 3 = 78.0 / 3 = 26.0
      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.evaluatedCount).toBe(3);
      expect(result.totalCount).toBe(3);
      expect(result.averageScore).toBe(26.0);
      expect(result.averagePercentage).toBe(86.7);
      expect(result.isComplete).toBe(true);
      expect(result.isPartial).toBe(false);
    });

    it('1.8 correctly flags partial evaluation when only some subjects have marks', () => {
      const subjects = [
        {
          subject_code: 'CS601',
          subject_name: 'Software Engineering',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '18.0',
          mid2_marks: null,
          assignment_marks: null // Score: 18.0
        },
        {
          subject_code: 'CS602',
          subject_name: 'Cloud Computing',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: null,
          mid2_marks: null,
          assignment_marks: null // Not evaluated
        },
        {
          subject_code: 'CS603',
          subject_name: 'Artificial Intelligence',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: null,
          mid2_marks: null,
          assignment_marks: null // Not evaluated
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.hasMarks).toBe(true);
      expect(result.evaluatedCount).toBe(1);
      expect(result.totalCount).toBe(3);
      expect(result.isPartial).toBe(true);
      expect(result.isComplete).toBe(false);
      expect(result.averageScore).toBe(18.0);
    });

    it('1.9 caps total score per subject at 30 max marks', () => {
      const subjects = [
        {
          subject_code: 'CS701',
          subject_name: 'Cryptography',
          subject_type: 'theory',
          mid_max: 20,
          mid1_marks: '25.0', // Out of bounds mock
          mid2_marks: '22.0',
          assignment_marks: '10.0' // 25 + 10 = 35 -> capped to 30
        }
      ];

      const result = calculateStudentCIE(subjects);
      expect(result.averageScore).toBe(30.0);
      expect(result.subjectBreakdown[0].total).toBe(30.0);
    });
  });

  describe('2. Subject Filtering and Semester Break Logic Simulation', () => {
    it('2.1 simulates term break response when sessionStatus is PREVIOUS or UPCOMING', () => {
      const simulateAcademicInfoResponse = (session) => {
        const { status: sessionStatus, isCurrent, semester, academicYear } = session;

        if (sessionStatus !== 'ACTIVE' || !isCurrent) {
          return {
            data: [],
            semester: semester || null,
            academicYear: academicYear || null,
            status: sessionStatus,
            isCurrent: false,
            isTermBreak: true,
            message: sessionStatus === 'PREVIOUS'
              ? 'Academic semester has completed. Term break in progress.'
              : 'No academic semester is currently active.'
          };
        }

        return {
          data: [{ subject_code: 'CS301' }],
          semester,
          academicYear,
          status: 'ACTIVE',
          isCurrent: true,
          isTermBreak: false
        };
      };

      // Scenario: Semester between completed sem 4 and upcoming sem 5
      const previousSession = { status: 'PREVIOUS', isCurrent: false, semester: 4, academicYear: '2025-2026' };
      const res = simulateAcademicInfoResponse(previousSession);

      expect(res.isTermBreak).toBe(true);
      expect(res.data).toEqual([]);
      expect(res.isCurrent).toBe(false);
      expect(res.status).toBe('PREVIOUS');
    });

    it('2.2 resolves elective group to the student selected variant and excludes alternative options', () => {
      // Simulate elective group resolution logic from route.js
      const electiveGroupMap = new Map([
        ['CS501A', 'PE-1'],
        ['CS501B', 'PE-1'],
        ['CS501C', 'PE-1']
      ]);

      const mockRetrievedSubjects = [
        // Core subjects
        { subject_code: 'CS501', subject_name: 'Core 1', parent_group_code: null, attended_classes: 10, mid1_marks: '15' },
        { subject_code: 'CS502', subject_name: 'Core 2', parent_group_code: null, attended_classes: 12, mid1_marks: '18' },
        // Elective group PE-1 variants
        { subject_code: 'CS501A', subject_name: 'Machine Learning', parent_group_code: 'PE-1', attended_classes: 8, mid1_marks: '17' },
        { subject_code: 'CS501B', subject_name: 'Mobile Computing', parent_group_code: 'PE-1', attended_classes: 0, mid1_marks: null },
        { subject_code: 'CS501C', subject_name: 'Cloud Computing', parent_group_code: 'PE-1', attended_classes: 0, mid1_marks: null }
      ];

      const countMarks = (s) => (s.mid1_marks ? 1 : 0);

      const coreSubjects = [];
      const electiveGroupsMap = new Map();

      for (const row of mockRetrievedSubjects) {
        const groupCode = row.parent_group_code || electiveGroupMap.get(row.subject_code) || null;
        if (!groupCode) {
          coreSubjects.push(row);
        } else {
          if (!electiveGroupsMap.has(groupCode)) electiveGroupsMap.set(groupCode, []);
          electiveGroupsMap.get(groupCode).push(row);
        }
      }

      const selectedElectives = [];
      for (const [, variants] of electiveGroupsMap.entries()) {
        const activeStudentVariants = variants.filter(v => countMarks(v) > 0 || v.attended_classes > 0);
        if (activeStudentVariants.length > 0) {
          selectedElectives.push(activeStudentVariants[0]);
        }
      }

      const finalSubjects = [...coreSubjects, ...selectedElectives];

      // Student must see exactly Core 1, Core 2, and their chosen Machine Learning elective
      expect(finalSubjects.length).toBe(3);
      expect(finalSubjects.map(s => s.subject_code)).toEqual(['CS501', 'CS502', 'CS501A']);
      // Alternative unselected variants CS501B and CS501C are excluded
      expect(finalSubjects.some(s => s.subject_code === 'CS501B')).toBe(false);
      expect(finalSubjects.some(s => s.subject_code === 'CS501C')).toBe(false);
    });
  });
});
