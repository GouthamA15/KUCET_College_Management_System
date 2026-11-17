import { describe, it, expect, vi } from 'vitest';
import { computeCanonicalStatus } from '@/services/internships/StudentInternshipService';
import { InternshipReportingService } from '@/services/internships/InternshipReportingService';
import { db } from '@/db';

describe('Internship Lifecycle & Canonical Status Mapping (11 Statuses)', () => {
  it('correctly maps WITHDRAWAL_REQUESTED status with highest precedence for pending withdrawals', () => {
    const status = computeCanonicalStatus({
      application_status: 'WITHDRAWAL_REQUESTED',
      completion_status: 'NOT_SUBMITTED',
      internship_status: 'ONGOING',
    });
    expect(status).toBe('WITHDRAWAL_REQUESTED');
  });

  it('correctly maps WITHDRAWN status when coordinator approves withdrawal', () => {
    const status = computeCanonicalStatus({
      application_status: 'WITHDRAWN',
      completion_status: 'NOT_SUBMITTED',
      internship_status: 'CANCELLED',
    });
    expect(status).toBe('WITHDRAWN');
  });

  it('correctly maps COMPLETED status when completion certificate is verified', () => {
    const status = computeCanonicalStatus({
      application_status: 'APPROVED',
      completion_status: 'VERIFIED_COMPLETED',
      internship_status: 'COMPLETED',
    });
    expect(status).toBe('COMPLETED');
  });

  it('correctly maps COMPLETION_SUBMITTED when student submits certificate for verification', () => {
    const status = computeCanonicalStatus({
      application_status: 'APPROVED',
      completion_status: 'SUBMITTED_FOR_VERIFICATION',
      internship_status: 'ONGOING',
    });
    expect(status).toBe('COMPLETION_SUBMITTED');
  });

  it('correctly maps CORRECTION_REQUESTED for pre-approval clarifications or post-completion corrections', () => {
    const preApprovalCorrection = computeCanonicalStatus({
      application_status: 'ADDITIONAL_INFO_REQUIRED',
      completion_status: 'NOT_SUBMITTED',
    });
    expect(preApprovalCorrection).toBe('CORRECTION_REQUESTED');

    const postCompletionCorrection = computeCanonicalStatus({
      application_status: 'APPROVED',
      completion_status: 'ADDITIONAL_DOCS_REQUESTED',
    });
    expect(postCompletionCorrection).toBe('CORRECTION_REQUESTED');
  });

  it('correctly maps REJECTED status for either application rejection or completion rejection', () => {
    const appRejected = computeCanonicalStatus({
      application_status: 'REJECTED',
      completion_status: 'NOT_SUBMITTED',
    });
    expect(appRejected).toBe('REJECTED');

    const compRejected = computeCanonicalStatus({
      application_status: 'APPROVED',
      completion_status: 'VERIFICATION_REJECTED',
    });
    expect(compRejected).toBe('REJECTED');
  });

  it('correctly maps ONGOING status when approved and current date falls between start and end dates', () => {
    const today = new Date();
    const pastDate = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const status = computeCanonicalStatus({
      application_status: 'APPROVED',
      internship_status: 'ONGOING',
      start_date: pastDate,
      end_date: futureDate,
      completion_status: 'NOT_SUBMITTED',
    });
    expect(status).toBe('ONGOING');
  });

  it('correctly maps APPROVED status when approved but future start date', () => {
    const today = new Date();
    const futureStart = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const futureEnd = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const status = computeCanonicalStatus({
      application_status: 'APPROVED',
      internship_status: 'APPROVED',
      start_date: futureStart,
      end_date: futureEnd,
      completion_status: 'NOT_SUBMITTED',
    });
    expect(status).toBe('APPROVED');
  });

  it('correctly maps UNDER_REVIEW, DRAFT, and SUBMITTED base application states', () => {
    expect(computeCanonicalStatus({ application_status: 'UNDER_REVIEW' })).toBe('UNDER_REVIEW');
    expect(computeCanonicalStatus({ application_status: 'DRAFT' })).toBe('DRAFT');
    expect(computeCanonicalStatus({ application_status: 'SUBMITTED' })).toBe('SUBMITTED');
  });
});

describe('Institutional 8-Reports Generation Engine', () => {
  it('formats CSV rows with proper quote escaping and comma separation', () => {
    const mockReport = {
      title: 'Test Report',
      columns: ['Student Name', 'Company "Quoted"', 'Role'],
      data: [
        { name: 'John Doe', company: 'Google, Inc.', role: 'Intern' },
        { name: 'Jane "Ace" Smith', company: 'Microsoft', role: 'Dev' },
      ],
      total: 2,
    };

    const header = mockReport.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    expect(header).toBe('"Student Name","Company ""Quoted""","Role"');

    const row1 = Object.values(mockReport.data[0]).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    expect(row1).toBe('"John Doe","Google, Inc.","Intern"');

    const row2 = Object.values(mockReport.data[1]).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    expect(row2).toBe('"Jane ""Ace"" Smith","Microsoft","Dev"');
  });

  it('contains all 8 required institutional report types in reporting service', async () => {
    const supportedReports = [
      'branch',
      'academic_year',
      'company',
      'student',
      'status',
      'completed',
      'pending_verification',
      'external',
    ];

    const mockRows = [{
      branch: 'CSE',
      academic_year: '2024-25',
      company_name: 'Google',
      role_title: 'SDE Intern',
      student_name: 'Rahul Sharma',
      roll_no: '21567T0901',
      application_status: 'APPROVED',
      mode: 'ON_SITE',
      total_applications: 5,
      approved_count: 3,
      ongoing_count: 2,
      completed_count: 1,
      pending_count: 1,
      verified_students_count: 1,
      avg_stipend: 25000,
      max_stipend: 30000,
      is_unverified_exception: false,
    }];

    const queryBuilder = {
      from: () => queryBuilder,
      innerJoin: () => queryBuilder,
      leftJoin: () => queryBuilder,
      where: () => queryBuilder,
      groupBy: () => queryBuilder,
      orderBy: () => queryBuilder,
      limit: () => queryBuilder,
      offset: () => Promise.resolve(mockRows),
      then: (resolve) => Promise.resolve(mockRows).then(resolve),
    };

    const spy = vi.spyOn(db, 'select').mockImplementation(() => queryBuilder);

    try {
      for (const reportType of supportedReports) {
        const result = await InternshipReportingService.getReportData({ reportType });
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('columns');
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.columns)).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.columns.length).toBeGreaterThan(0);
      }
    } finally {
      spy.mockRestore();
    }
  });
});
