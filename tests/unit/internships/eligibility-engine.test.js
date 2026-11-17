import { describe, it, expect } from 'vitest';
import { InternshipOpportunityService } from '@/services/internships/InternshipOpportunityService';

describe('Internship Opportunity Eligibility Engine', () => {
  const baseOpportunity = {
    id: 1,
    title: 'Full Stack Engineer Intern',
    eligible_branches: ['CSE', 'IT'],
    eligible_academic_years: ['2024-2025'],
    min_cgpa: '7.50',
    deadline: '2027-12-31', // future deadline
  };

  it('marks eligible student with matching branch, year, and sufficient CGPA', () => {
    const student = {
      branch: 'CSE',
      academic_year: '2024-2025',
      cgpa: '8.20',
    };

    const result = InternshipOpportunityService.evaluateEligibility(baseOpportunity, student);
    expect(result.is_eligible).toBe(true);
    expect(result.ineligibility_reasons).toHaveLength(0);
    expect(result.already_applied).toBe(false);
  });

  it('permits any branch when eligible_branches contains ALL', () => {
    const opp = {
      ...baseOpportunity,
      eligible_branches: ['ALL'],
    };
    const student = {
      branch: 'MECH',
      academic_year: '2024-2025',
      cgpa: '8.00',
    };

    const result = InternshipOpportunityService.evaluateEligibility(opp, student);
    expect(result.is_eligible).toBe(true);
  });

  it('rejects student whose branch is not in the eligible list', () => {
    const student = {
      branch: 'CIVIL',
      academic_year: '2024-2025',
      cgpa: '8.50',
    };

    const result = InternshipOpportunityService.evaluateEligibility(baseOpportunity, student);
    expect(result.is_eligible).toBe(false);
    expect(result.ineligibility_reasons[0]).toContain('Restricted to branches');
  });

  it('rejects student with CGPA below the required minimum threshold', () => {
    const student = {
      branch: 'CSE',
      academic_year: '2024-2025',
      cgpa: '7.20',
    };

    const result = InternshipOpportunityService.evaluateEligibility(baseOpportunity, student);
    expect(result.is_eligible).toBe(false);
    expect(result.ineligibility_reasons[0]).toContain('Minimum CGPA required is 7.50');
  });

  it('rejects student when opportunity deadline has passed', () => {
    const expiredOpp = {
      ...baseOpportunity,
      deadline: '2020-01-01',
    };
    const student = {
      branch: 'CSE',
      academic_year: '2024-2025',
      cgpa: '8.50',
    };

    const result = InternshipOpportunityService.evaluateEligibility(expiredOpp, student);
    expect(result.is_eligible).toBe(false);
    expect(result.ineligibility_reasons[0]).toContain('deadline expired');
  });

  it('flags already applied status when prior application record exists', () => {
    const student = {
      branch: 'CSE',
      academic_year: '2024-2025',
      cgpa: '8.50',
    };
    const priorRecord = { id: 42, application_status: 'SUBMITTED' };

    const result = InternshipOpportunityService.evaluateEligibility(baseOpportunity, student, priorRecord);
    expect(result.is_eligible).toBe(true);
    expect(result.already_applied).toBe(true);
    expect(result.student_application_id).toBe(42);
    expect(result.student_application_status).toBe('SUBMITTED');
  });
});
