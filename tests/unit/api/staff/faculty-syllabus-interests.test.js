import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Faculty Syllabus & Subject Interests Suite', () => {
  const interestSubmissionSchema = z.object({
    subject_code: z.string().trim().min(1, 'subject_code is required'),
    subject_name: z.string().trim().min(1, 'subject_name is required'),
    branch: z.string().trim().min(1, 'branch is required'),
    department_code: z.string().trim().min(1, 'department_code is required'),
    semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
    academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be in format YYYY-YY').optional()
  });

  describe('Subject Interest Schema Validation', () => {
    it('validates a complete faculty subject interest payload', () => {
      const valid = {
        subject_code: 'CS501',
        subject_name: 'Database Management Systems',
        branch: 'CSE',
        department_code: 'CSE',
        semester: 5,
        academic_year: '2026-27'
      };
      const result = interestSubmissionSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(result.data.semester).toBe(5);
      expect(result.data.branch).toBe('CSE');
    });

    it('rejects payload when department_code is missing', () => {
      const invalid = {
        subject_code: 'CS501',
        subject_name: 'Database Management Systems',
        branch: 'CSE',
        semester: 5
      };
      const result = interestSubmissionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid academic_year format', () => {
      const invalid = {
        subject_code: 'CS501',
        subject_name: 'Database Management Systems',
        branch: 'CSE',
        department_code: 'CSE',
        semester: 5,
        academic_year: '2026/2027'
      };
      const result = interestSubmissionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toMatch(/YYYY-YY/);
    });

    it('rejects semester out of range', () => {
      expect(interestSubmissionSchema.safeParse({
        subject_code: 'CS501',
        subject_name: 'DBMS',
        branch: 'CSE',
        department_code: 'CSE',
        semester: 0
      }).success).toBe(false);

      expect(interestSubmissionSchema.safeParse({
        subject_code: 'CS501',
        subject_name: 'DBMS',
        branch: 'CSE',
        department_code: 'CSE',
        semester: 9
      }).success).toBe(false);
    });
  });

  describe('Affiliation Authorization Boundary Logic', () => {
    it('allows interest submission when requested branch is in allowed affiliations', () => {
      const affiliations = [
        { dept_code: 'CSE', prog_code: null },
        { dept_code: 'CSE', prog_code: 'CSD' }
      ];
      const allowedBranches = Array.from(new Set(
        affiliations.flatMap(a => [a.dept_code, a.prog_code]).filter(Boolean)
      ));
      expect(allowedBranches).toContain('CSE');
      expect(allowedBranches).toContain('CSD');
      expect(allowedBranches).not.toContain('ECE');
    });

    it('blocks interest submission when requested branch is outside affiliated departments', () => {
      const allowedBranches = ['CSE', 'CSD'];
      const requestedBranch = 'MECH';
      const isAuthorized = allowedBranches.includes(requestedBranch);
      expect(isAuthorized).toBe(false);
    });
  });

  describe('Syllabus Nesting & Allocation Mapping Logic', () => {
    it('correctly maps core subjects and nested group variants with allocation flags', () => {
      const structureRows = [
        { subject_code: 'CS501', is_group: 0, parent_group_code: null, title: 'Operating Systems', subject_type: 'theory' },
        { subject_code: 'PE-I', is_group: 1, parent_group_code: null, title: 'Professional Elective I', subject_type: 'theory' },
        { subject_code: 'PE5101CS', is_group: 0, parent_group_code: 'PE-I', title: 'Web Programming', subject_type: 'theory' },
        { subject_code: 'PE5102CS', is_group: 0, parent_group_code: 'PE-I', title: 'Advanced Java', subject_type: 'theory' }
      ];

      const allocations = [
        { subject_code: 'PE5101CS', faculty_id: 101 }
      ];

      const currentUserId = 101;
      const check = (code) => {
        const allocation = allocations.find(a => a.subject_code === code);
        return {
          is_allocated: !!allocation,
          allocated_to_me: allocation ? (allocation.faculty_id === currentUserId) : false
        };
      };

      const topLevel = structureRows.filter(r => !r.parent_group_code);
      const variants = structureRows.filter(r => r.parent_group_code);

      const semSyllabus = topLevel.map(item => {
        let result = {
          code: item.subject_code,
          title: item.title,
          isGroup: !!item.is_group,
          subject_type: item.subject_type
        };

        if (item.is_group) {
          const groupVariants = variants
            .filter(v => v.parent_group_code === item.subject_code)
            .map(v => ({
              code: v.subject_code,
              title: v.title,
              subject_type: v.subject_type,
              ...check(v.subject_code)
            }));
          result.variants = groupVariants;
          result.is_allocated = groupVariants.some(v => v.is_allocated);
          result.allocated_to_me = groupVariants.some(v => v.allocated_to_me);
        } else {
          result = { ...result, ...check(item.subject_code) };
        }
        return result;
      });

      expect(semSyllabus).toHaveLength(2);
      expect(semSyllabus[0].code).toBe('CS501');
      expect(semSyllabus[0].is_allocated).toBe(false);

      expect(semSyllabus[1].code).toBe('PE-I');
      expect(semSyllabus[1].isGroup).toBe(true);
      expect(semSyllabus[1].variants).toHaveLength(2);
      expect(semSyllabus[1].variants[0].code).toBe('PE5101CS');
      expect(semSyllabus[1].variants[0].is_allocated).toBe(true);
      expect(semSyllabus[1].variants[0].allocated_to_me).toBe(true);
      expect(semSyllabus[1].is_allocated).toBe(true);
      expect(semSyllabus[1].allocated_to_me).toBe(true);
    });
  });
});
