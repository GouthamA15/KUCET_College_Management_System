import { describe, it, expect } from 'vitest';
import { InternshipOpportunityService } from '@/services/internships/InternshipOpportunityService';
import { InternshipDocumentService } from '@/services/internships/InternshipDocumentService';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import { validateRollNo } from '@/lib/rollNumber';

describe('Student Internship Edge Cases & Roll Number Derivation', () => {
  it('correctly derives branch and academic batch from roll number in evaluateEligibility', () => {
    const opp = {
      id: 101,
      title: 'Software Development Intern',
      eligible_branches: ['CSE', 'CSD'],
      eligible_academic_years: ['2021-22', '2022-23'],
      min_cgpa: null,
      deadline: new Date(Date.now() + 86400000),
    };

    // Student without direct branch or academic_year on the object, but valid CSE roll
    const cseStudent = {
      id: 1,
      roll_no: '21567T0901',
    };

    const evalResult = InternshipOpportunityService.evaluateEligibility(opp, cseStudent);
    expect(evalResult.is_eligible).toBe(true);
    expect(evalResult.ineligibility_reasons).toHaveLength(0);

    // ECE student trying to apply to CSE-only opening
    const eceStudent = {
      id: 2,
      roll_no: '21567T1501',
    };
    const eceResult = InternshipOpportunityService.evaluateEligibility(opp, eceStudent);
    expect(eceResult.is_eligible).toBe(false);
    expect(eceResult.ineligibility_reasons[0]).toContain('Restricted to branches: CSE, CSD');
    expect(eceResult.ineligibility_reasons[0]).toContain('Your branch: ECE');
  });

  it('validates roll numbers for regular and lateral entry correctly', () => {
    const regCse = validateRollNo('22567T0910');
    expect(regCse.isValid).toBe(true);
    expect(regCse.branch).toBe('CSE');
    expect(regCse.entryYear).toBe('2022');

    const latMech = validateRollNo('21567T0305L');
    expect(latMech.isValid).toBe(true);
    expect(latMech.branch).toBe('MECH');
    expect(latMech.entryYear).toBe('2021');
  });

  it('has applyToOpportunity alias function available on StudentInternshipService', () => {
    expect(typeof StudentInternshipService.applyToOpportunity).toBe('function');
    expect(typeof StudentInternshipService.applyForOpportunity).toBe('function');
  });

  it('sanitizes unsafe characters and directory traversal patterns in document service', () => {
    expect(InternshipDocumentService.sanitizePathSegment('../../../etc/passwd')).toBe('etcpasswd');
    expect(InternshipDocumentService.sanitizePathSegment('Roll..//..No\\123')).toBe('RollNo123');
    expect(InternshipDocumentService.sanitizePathSegment('')).toBe('UNKNOWN');
    expect(InternshipDocumentService.sanitizePathSegment(null, 'FALLBACK')).toBe('FALLBACK');
  });
});
