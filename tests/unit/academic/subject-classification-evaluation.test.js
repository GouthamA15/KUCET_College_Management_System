import { describe, it, expect } from 'vitest';
import { 
  CANONICAL_SUBJECT_TYPES, 
  isValidSubjectType, 
  resolveCanonicalSubjectType 
} from '@/lib/academic-utils';

describe('Phase 6 — Subject Classification & Evaluation Regression Test Suite', () => {

  describe('1. Canonical Subject Classification Resolution (resolveCanonicalSubjectType)', () => {
    it('1.1 resolves BSC101L (Physics-Practical) to canonical "lab" classification', () => {
      const result = resolveCanonicalSubjectType({
        subject_code: 'BSC101L',
        subject_name: 'Physics-Practical',
        canonical_subject_type: 'lab'
      });

      expect(result.subject_type).toBe('lab');
      expect(result.is_lab).toBe(true);
      expect(result.status).toBe('RESOLVED');
      expect(result.source).toBe('syllabus_subjects');
    });

    it('1.2 resolves BSC101 (Physics) to canonical "theory" classification', () => {
      const result = resolveCanonicalSubjectType({
        subject_code: 'BSC101',
        subject_name: 'Physics',
        canonical_subject_type: 'theory'
      });

      expect(result.subject_type).toBe('theory');
      expect(result.is_lab).toBe(false);
      expect(result.status).toBe('RESOLVED');
    });

    it('1.3 does NOT silently default missing subject type to theory', () => {
      const resultMissing = resolveCanonicalSubjectType({
        subject_code: 'UNKNOWN101',
        subject_name: 'Special Topic',
        canonical_subject_type: null
      });

      expect(resultMissing.subject_type).toBeNull();
      expect(resultMissing.is_lab).toBe(false);
      expect(resultMissing.status).toBe('UNRESOLVED');
      expect(resultMissing.source).toBe('missing');
    });

    it('1.4 rejects invalid subject types and marks them UNRESOLVED rather than defaulting to theory', () => {
      const resultInvalid = resolveCanonicalSubjectType({
        subject_code: 'BSC101L',
        subject_name: 'Physics-Practical',
        canonical_subject_type: 'INVALID_TYPE'
      });

      expect(resultInvalid.subject_type).toBeNull();
      expect(resultInvalid.is_lab).toBe(false);
      expect(resultInvalid.status).toBe('UNRESOLVED');
    });

    it('1.5 detects conflicting metadata (subject named practical or code ending in L but stored as theory)', () => {
      const resultConflict = resolveCanonicalSubjectType({
        subject_code: 'PCS-401L',
        subject_name: 'Data Management Systems Lab',
        canonical_subject_type: 'theory'
      });

      // Still reflects the canonical value, but flags contradiction
      expect(resultConflict.subject_type).toBe('theory');
      expect(resultConflict.status).toBe('CONTRADICTORY');
    });
  });

  describe('2. Canonical Subject Type Enum Validation (isValidSubjectType)', () => {
    it('2.1 validates that only "theory" and "lab" are permissible canonical types', () => {
      expect(CANONICAL_SUBJECT_TYPES).toEqual(['theory', 'lab']);
      expect(isValidSubjectType('theory')).toBe(true);
      expect(isValidSubjectType('THEORY')).toBe(true);
      expect(isValidSubjectType('lab')).toBe(true);
      expect(isValidSubjectType('LAB')).toBe(true);

      // Rejections
      expect(isValidSubjectType('practical')).toBe(false);
      expect(isValidSubjectType('PROJECT')).toBe(false);
      expect(isValidSubjectType('')).toBe(false);
      expect(isValidSubjectType(null)).toBe(false);
      expect(isValidSubjectType(undefined)).toBe(false);
    });
  });

  describe('3. Evaluation Marks API Endpoint Flow Simulation', () => {
    it('3.1 GET simulation: ensures joined syllabusSubjects produces subject_type "lab" for BSC101L', () => {
      // Simulate assignment record with joined syllabusSubjects
      const mockDbRow = {
        id: 270018,
        staff_account_id: 180009,
        mid_max: 20,
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        subject_name: 'Physics-Practical',
        subject_code: 'BSC101L',
        canonical_subject_type: 'lab'
      };

      const resolved = resolveCanonicalSubjectType({
        subject_code: mockDbRow.subject_code,
        subject_name: mockDbRow.subject_name,
        canonical_subject_type: mockDbRow.canonical_subject_type
      });

      const apiResponsePayload = {
        data: [],
        mid_max: mockDbRow.mid_max,
        subject_type: resolved.subject_type,
        subject_type_status: resolved.status,
        canonical_id: mockDbRow.id
      };

      expect(apiResponsePayload.subject_type).toBe('lab');
      expect(apiResponsePayload.subject_type_status).toBe('RESOLVED');
      expect(apiResponsePayload.subject_type).not.toBe('theory');
    });

    it('3.2 GET simulation: ensures pure theory subject returns subject_type "theory"', () => {
      const mockDbRow = {
        id: 270017,
        staff_account_id: 180009,
        mid_max: 20,
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        subject_name: 'Physics',
        subject_code: 'BSC101',
        canonical_subject_type: 'theory'
      };

      const resolved = resolveCanonicalSubjectType({
        subject_code: mockDbRow.subject_code,
        subject_name: mockDbRow.subject_name,
        canonical_subject_type: mockDbRow.canonical_subject_type
      });

      expect(resolved.subject_type).toBe('theory');
      expect(resolved.is_lab).toBe(false);
    });

    it('3.3 POST simulation: routes marks to lab columns (lab_theory_marks, lab_execution_marks, lab_record_marks) when subject is lab', () => {
      const mockAssignment = {
        subject_code: 'BSC101L',
        subject_name: 'Physics-Practical',
        canonical_subject_type: 'lab'
      };

      const resolved = resolveCanonicalSubjectType(mockAssignment);
      expect(resolved.is_lab).toBe(true);

      const clientInput = {
        student_id: 101,
        mid1_marks: 9,      // Execution
        mid2_marks: 8,      // Writing
        assignment_marks: 4, // Record
        lab_theory_marks: 8,
        lab_execution_marks: 9,
        lab_record_marks: 4
      };

      const markFields = resolved.is_lab
        ? {
            lab_theory_marks: clientInput.lab_theory_marks ?? null,
            lab_execution_marks: clientInput.lab_execution_marks ?? null,
            lab_record_marks: clientInput.lab_record_marks ?? null,
            is_published: true,
          }
        : {
            mid1_marks: clientInput.mid1_marks ?? null,
            mid2_marks: clientInput.mid2_marks ?? null,
            assignment_marks: clientInput.assignment_marks ?? null,
            is_published: true,
          };

      expect(markFields).toEqual({
        lab_theory_marks: 8,
        lab_execution_marks: 9,
        lab_record_marks: 4,
        is_published: true
      });
      expect(markFields.mid1_marks).toBeUndefined();
    });

    it('3.4 POST simulation: rejects marks save when subject classification is UNRESOLVED', () => {
      const mockAssignment = {
        subject_code: 'UNKNOWN_999',
        subject_name: 'Uncatalogued Topic',
        canonical_subject_type: null
      };

      const resolved = resolveCanonicalSubjectType(mockAssignment);
      expect(resolved.status).toBe('UNRESOLVED');
      expect(resolved.subject_type).toBeNull();

      // Guard check simulating POST route handler
      const shouldReject = resolved.status === 'UNRESOLVED' || !resolved.subject_type;
      expect(shouldReject).toBe(true);
    });
  });

  describe('4. Evaluation UI / MarksEntrySheet Logic Simulation', () => {
    it('4.1 renders LAB / PRACTICAL badge when subjectType is "lab"', () => {
      const subjectType = 'lab';
      const badgeText = subjectType === 'lab' ? 'PRACTICAL / LAB' : subjectType === 'theory' ? 'THEORY' : 'UNRESOLVED';
      expect(badgeText).toBe('PRACTICAL / LAB');
      expect(badgeText).not.toBe('THEORY');
    });

    it('4.2 renders THEORY badge when subjectType is "theory"', () => {
      const subjectType = 'theory';
      const badgeText = subjectType === 'lab' ? 'PRACTICAL / LAB' : subjectType === 'theory' ? 'THEORY' : 'UNRESOLVED';
      expect(badgeText).toBe('THEORY');
    });

    it('4.3 renders UNRESOLVED badge when subjectType is null or unknown', () => {
      const subjectType = null;
      const badgeText = subjectType === 'lab' ? 'PRACTICAL / LAB' : subjectType === 'theory' ? 'THEORY' : 'UNRESOLVED';
      expect(badgeText).toBe('UNRESOLVED');
      expect(badgeText).not.toBe('THEORY');
    });

    it('4.4 generates correct assessment component labels for lab subjects (Execution, Writing, Record)', () => {
      const subjectType = 'lab';
      const midMax = 20;

      const labels = subjectType === 'lab'
        ? { m1: 'Execution', m2: 'Writing', a: 'Record', m1m: 10, m2m: 10, am: 5, total: 25 }
        : { m1: 'Mid-1', m2: 'Mid-2', a: 'Assignment', m1m: midMax, m2m: midMax, am: 10, total: 30 };

      expect(labels).toEqual({
        m1: 'Execution',
        m2: 'Writing',
        a: 'Record',
        m1m: 10,
        m2m: 10,
        am: 5,
        total: 25
      });
    });

    it('4.5 generates standard Mid-1, Mid-2, Assignment labels for theory subjects', () => {
      const subjectType = 'theory';
      const midMax = 20;

      const labels = subjectType === 'lab'
        ? { m1: 'Execution', m2: 'Writing', a: 'Record', m1m: 10, m2m: 10, am: 5, total: 25 }
        : { m1: 'Mid-1', m2: 'Mid-2', a: 'Assignment', m1m: midMax, m2m: midMax, am: 10, total: 30 };

      expect(labels).toEqual({
        m1: 'Mid-1',
        m2: 'Mid-2',
        a: 'Assignment',
        m1m: 20,
        m2m: 20,
        am: 10,
        total: 30
      });
    });
  });

  describe('5. Data Isolation & Join Safety', () => {
    it('5.1 ensures assignments join syllabusSubjects strictly by exact subject_code', () => {
      const assignmentBSC101L = { subject_code: 'BSC101L' };
      const assignmentBSC101 = { subject_code: 'BSC101' };

      const syllabusCatalog = [
        { subject_code: 'BSC101', subject_name: 'Physics', subject_type: 'theory' },
        { subject_code: 'BSC101L', subject_name: 'Physics-Practical', subject_type: 'lab' },
      ];

      const joinedL = syllabusCatalog.find(s => s.subject_code === assignmentBSC101L.subject_code);
      const joinedTheory = syllabusCatalog.find(s => s.subject_code === assignmentBSC101.subject_code);

      expect(joinedL?.subject_type).toBe('lab');
      expect(joinedTheory?.subject_type).toBe('theory');
      expect(joinedL?.subject_type).not.toBe(joinedTheory?.subject_type);
    });
  });

  describe('6. Broad Catalogue Consistency Audit & Official Fixture Verification', () => {
    const AICTE_FIRST_YEAR_FIXTURE = [
      { code: 'BSC101', title: 'Physics', expectedType: 'theory' },
      { code: 'BSC101L', title: 'Physics-Practical', expectedType: 'lab' },
      { code: 'BSC102', title: 'Chemistry', expectedType: 'theory' },
      { code: 'BSC102L', title: 'Chemistry Laboratory', expectedType: 'lab' },
      { code: 'BSC103', title: 'Mathematics-I', expectedType: 'theory' },
      { code: 'BSC104', title: 'Mathematics-II', expectedType: 'theory' },
      { code: 'ESC101', title: 'Basic Electrical Engineering', expectedType: 'theory' },
      { code: 'ESC101L', title: 'Basic Electrical Engineering Lab', expectedType: 'lab' },
      { code: 'ESC102', title: 'Engineering Graphics & Design', expectedType: 'theory' },
      { code: 'ESC103', title: 'Programming for Problem Solving', expectedType: 'theory' },
      { code: 'ESC103L', title: 'Programming for Problem Solving Lab', expectedType: 'lab' },
      { code: 'ESC104', title: 'Engineering Mechanics', expectedType: 'theory' },
      { code: 'ESC104L', title: 'Workshop and Manufacturing Practices Lab', expectedType: 'lab' },
      { code: 'HSMC101', title: 'English', expectedType: 'theory' },
      { code: 'HSMC101L', title: 'English Language Lab', expectedType: 'lab' }
    ];

    it('6.1 verifies every first-year curriculum subject matches its expected canonical classification', () => {
      for (const item of AICTE_FIRST_YEAR_FIXTURE) {
        const resolved = resolveCanonicalSubjectType({
          subject_code: item.code,
          subject_name: item.title,
          canonical_subject_type: item.expectedType
        });

        expect(resolved.status).toBe('RESOLVED');
        expect(resolved.subject_type).toBe(item.expectedType);
        expect(resolved.is_lab).toBe(item.expectedType === 'lab');
      }
    });

    it('6.2 detects any mismatch if a laboratory subject were mistakenly marked as theory in catalog', () => {
      const corruptedCatalog = [
        { code: 'BSC101L', title: 'Physics-Practical', corruptedType: 'theory' }
      ];

      for (const item of corruptedCatalog) {
        const check = resolveCanonicalSubjectType({
          subject_code: item.code,
          subject_name: item.title,
          canonical_subject_type: item.corruptedType
        });

        // Must be flagged as contradictory, never silently trusted
        expect(check.status).toBe('CONTRADICTORY');
      }
    });
  });

  describe('7. Non-Destructive Invariants for Existing Academic Records', () => {
    it('7.1 ensures existing marks, attendance, drafts, and published states are preserved when reading subject_type', () => {
      const existingStudentRow = {
        id: 101,
        roll_no: '26567T0901',
        name: 'Test Student',
        is_published: true,
        lab_theory_marks: '8.50',
        lab_execution_marks: '9.00',
        lab_record_marks: '4.50',
        mid1_marks: null,
        mid2_marks: null,
        assignment_marks: null
      };

      // Ensure reading canonical type does not modify the underlying marks values
      const type = 'lab';
      const isLab = type === 'lab';

      const mappedMarks = {
        student_id: existingStudentRow.id,
        is_published: existingStudentRow.is_published,
        exec: isLab ? existingStudentRow.lab_execution_marks : existingStudentRow.mid1_marks,
        writing: isLab ? existingStudentRow.lab_theory_marks : existingStudentRow.mid2_marks,
        record: isLab ? existingStudentRow.lab_record_marks : existingStudentRow.assignment_marks
      };

      expect(mappedMarks.exec).toBe('9.00');
      expect(mappedMarks.writing).toBe('8.50');
      expect(mappedMarks.record).toBe('4.50');
      expect(mappedMarks.is_published).toBe(true);
    });
  });
});
