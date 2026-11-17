import { db } from '@/db';
import { 
  studentInternships, 
  internshipOpportunities, 
  internshipCompanies, 
  students 
} from '@/db/schema';
import { eq, and, count, sql, desc, inArray, like, or } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { branchCodes } from '@/lib/rollNumber';

export const sqlStudentBranch = sql`CASE
  WHEN ${students.roll_no} LIKE '%567T09%' OR ${students.roll_no} LIKE '%56709%L' THEN 'CSE'
  WHEN ${students.roll_no} LIKE '%567T30%' OR ${students.roll_no} LIKE '%56730%L' THEN 'CSD'
  WHEN ${students.roll_no} LIKE '%567T15%' OR ${students.roll_no} LIKE '%56715%L' THEN 'ECE'
  WHEN ${students.roll_no} LIKE '%567T12%' OR ${students.roll_no} LIKE '%56712%L' THEN 'EEE'
  WHEN ${students.roll_no} LIKE '%567T00%' OR ${students.roll_no} LIKE '%56700%L' THEN 'CIVIL'
  WHEN ${students.roll_no} LIKE '%567T18%' OR ${students.roll_no} LIKE '%56718%L' THEN 'IT'
  WHEN ${students.roll_no} LIKE '%567T03%' OR ${students.roll_no} LIKE '%56703%L' THEN 'MECH'
  ELSE 'CSE'
END`;

export const sqlAcademicYear = sql`CONCAT('20', SUBSTRING(${students.roll_no}, 1, 2), '-', CAST(CONCAT('20', SUBSTRING(${students.roll_no}, 1, 2)) AS SIGNED) + 1)`;

function buildStudentFilters({ branch, academicYear }) {
  const conditions = [];
  if (branch && branch !== 'ALL') {
    const branchCode = Object.keys(branchCodes).find(code => branchCodes[code].toUpperCase() === branch.toUpperCase());
    if (branchCode) {
      conditions.push(or(
        like(students.roll_no, `%567T${branchCode}%`),
        like(students.roll_no, `%567${branchCode}%L`)
      ));
    }
  }
  if (academicYear && academicYear !== 'ALL') {
    const yearPrefix = academicYear.slice(2, 4);
    if (yearPrefix) {
      conditions.push(like(students.roll_no, `${yearPrefix}%`));
    }
  }
  return conditions;
}

export class InternshipReportingService {
  /**
   * Retrieves high-level dashboard metrics for the coordinator.
   * Directly queries actual database tables for all 10 overview metrics.
   */
  static async getDashboardMetrics() {
    const [totalInternshipsRes] = await db
      .select({ total: count() })
      .from(studentInternships);

    const [pendingApprovalsRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(inArray(studentInternships.application_status, ['SUBMITTED', 'UNDER_REVIEW']));

    const [underReviewRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.application_status, 'UNDER_REVIEW'));

    const [approvedRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.application_status, 'APPROVED'));

    const [ongoingRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.internship_status, 'ONGOING'));

    const [pendingCompletionsRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.completion_status, 'SUBMITTED_FOR_VERIFICATION'));

    const [completedRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.completion_status, 'VERIFIED_COMPLETED'));

    const [withdrawalRequestsRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.application_status, 'WITHDRAWAL_REQUESTED'));

    const [correctionRequestsRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(
        or(
          eq(studentInternships.application_status, 'ADDITIONAL_INFO_REQUIRED'),
          eq(studentInternships.completion_status, 'ADDITIONAL_DOCS_REQUESTED')
        )
      );

    const [unverifiedExceptionsRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .where(eq(studentInternships.is_unverified_company_exception, true));

    const [verifiedCompaniesRes] = await db
      .select({ total: count() })
      .from(internshipCompanies)
      .where(
        and(
          eq(internshipCompanies.verification_status, 'VERIFIED'),
          eq(internshipCompanies.is_active, true)
        )
      );

    const [activeOpportunitiesRes] = await db
      .select({ total: count() })
      .from(internshipOpportunities)
      .where(eq(internshipOpportunities.status, 'PUBLISHED'));

    return {
      total_internships: totalInternshipsRes?.total || 0,
      pending_approvals: pendingApprovalsRes?.total || 0,
      under_review: underReviewRes?.total || 0,
      approved_internships: approvedRes?.total || 0,
      ongoing_internships: ongoingRes?.total || 0,
      pending_completions: pendingCompletionsRes?.total || 0,
      completed_internships: completedRes?.total || 0,
      withdrawal_requests: withdrawalRequestsRes?.total || 0,
      correction_requests: correctionRequestsRes?.total || 0,
      unverified_company_exceptions: unverifiedExceptionsRes?.total || 0,
      verified_companies: verifiedCompaniesRes?.total || 0,
      active_opportunities: activeOpportunitiesRes?.total || 0,
    };
  }

  /**
   * Retrieves analytical breakdowns by branch, year, mode, and company.
   */
  static async getAnalytics({ branch = 'ALL', academicYear = 'ALL' } = {}) {
    const conditions = buildStudentFilters({ branch, academicYear });
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const branchBreakdown = await db
      .select({
        branch: sqlStudentBranch,
        total: count(),
        verified: sql`SUM(CASE WHEN ${studentInternships.completion_status} = 'VERIFIED_COMPLETED' THEN 1 ELSE 0 END)`,
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .groupBy(sqlStudentBranch);

    const modeBreakdown = await db
      .select({
        mode: studentInternships.mode,
        total: count(),
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .groupBy(studentInternships.mode);

    const typeBreakdown = await db
      .select({
        registration_type: studentInternships.registration_type,
        total: count(),
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .groupBy(studentInternships.registration_type);

    const statusBreakdown = await db
      .select({
        application_status: studentInternships.application_status,
        total: count(),
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .groupBy(studentInternships.application_status);

    const topCompanies = await db
      .select({
        company_name: studentInternships.company_name,
        total: count(),
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .groupBy(studentInternships.company_name)
      .orderBy(desc(count()))
      .limit(10);

    return {
      branch_breakdown: branchBreakdown.map(b => ({
        branch: b.branch,
        total: Number(b.total),
        verified: Number(b.verified || 0),
      })),
      mode_breakdown: modeBreakdown.map(m => ({
        mode: m.mode,
        total: Number(m.total),
      })),
      type_breakdown: typeBreakdown.map(t => ({
        registration_type: t.registration_type,
        total: Number(t.total),
      })),
      status_breakdown: statusBreakdown.map(s => ({
        application_status: s.application_status,
        total: Number(s.total),
      })),
      top_companies: topCompanies.map(c => ({
        company_name: c.company_name,
        total: Number(c.total),
      })),
    };
  }

  /**
   * Retrieves data for the 8 required institutional reports:
   * 1. branch: Branch-wise internship report
   * 2. academic_year: Academic-year-wise internship report
   * 3. company: Company-wise internship report
   * 4. student: Individual student internship report
   * 5. status: Internship status report
   * 6. completed: Completed internship report
   * 7. pending_verification: Pending certificate verification report
   * 8. external: Independently obtained internship report
   */
  static async getReportData({
    reportType = 'branch',
    branch = 'ALL',
    academicYear = 'ALL',
    studentSearch = '',
    page = 1,
    limit = 50,
  } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const baseConditions = buildStudentFilters({ branch, academicYear });

    switch (reportType) {
      case 'branch': {
        const rows = await db
          .select({
            branch: sqlStudentBranch,
            total: count(),
            approved: sql`SUM(CASE WHEN ${studentInternships.application_status} = 'APPROVED' THEN 1 ELSE 0 END)`,
            ongoing: sql`SUM(CASE WHEN ${studentInternships.internship_status} = 'ONGOING' THEN 1 ELSE 0 END)`,
            completed: sql`SUM(CASE WHEN ${studentInternships.completion_status} = 'VERIFIED_COMPLETED' THEN 1 ELSE 0 END)`,
            pending_review: sql`SUM(CASE WHEN ${studentInternships.application_status} IN ('SUBMITTED', 'UNDER_REVIEW') THEN 1 ELSE 0 END)`,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
          .groupBy(sqlStudentBranch)
          .orderBy(desc(count()));

        return {
          title: 'Branch-wise Internship Report',
          columns: ['Branch', 'Total Registered', 'Approved', 'Ongoing', 'Completed', 'Pending Review'],
          data: rows.map(r => ({
            branch: r.branch,
            total: Number(r.total),
            approved: Number(r.approved || 0),
            ongoing: Number(r.ongoing || 0),
            completed: Number(r.completed || 0),
            pending_review: Number(r.pending_review || 0),
          })),
        };
      }

      case 'academic_year': {
        const rows = await db
          .select({
            academic_year: sqlAcademicYear,
            total: count(),
            approved: sql`SUM(CASE WHEN ${studentInternships.application_status} = 'APPROVED' THEN 1 ELSE 0 END)`,
            completed: sql`SUM(CASE WHEN ${studentInternships.completion_status} = 'VERIFIED_COMPLETED' THEN 1 ELSE 0 END)`,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
          .groupBy(sqlAcademicYear)
          .orderBy(desc(sqlAcademicYear));

        return {
          title: 'Academic-Year-wise Internship Report',
          columns: ['Academic Year', 'Total Registered', 'Approved', 'Completed'],
          data: rows.map(r => ({
            academic_year: r.academic_year,
            total: Number(r.total),
            approved: Number(r.approved || 0),
            completed: Number(r.completed || 0),
          })),
        };
      }

      case 'company': {
        const rows = await db
          .select({
            company_name: studentInternships.company_name,
            total: count(),
            verified_completed: sql`SUM(CASE WHEN ${studentInternships.completion_status} = 'VERIFIED_COMPLETED' THEN 1 ELSE 0 END)`,
            remote: sql`SUM(CASE WHEN ${studentInternships.mode} = 'ONLINE' THEN 1 ELSE 0 END)`,
            on_site: sql`SUM(CASE WHEN ${studentInternships.mode} = 'OFFLINE' THEN 1 ELSE 0 END)`,
            hybrid: sql`SUM(CASE WHEN ${studentInternships.mode} = 'HYBRID' THEN 1 ELSE 0 END)`,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
          .groupBy(studentInternships.company_name)
          .orderBy(desc(count()))
          .limit(limitNum)
          .offset(offset);

        return {
          title: 'Company-wise Internship Report',
          columns: ['Company Name', 'Total Internships', 'Completed', 'Remote', 'On-Site', 'Hybrid'],
          data: rows.map(r => ({
            company_name: r.company_name,
            total: Number(r.total),
            verified_completed: Number(r.verified_completed || 0),
            remote: Number(r.remote || 0),
            on_site: Number(r.on_site || 0),
            hybrid: Number(r.hybrid || 0),
          })),
        };
      }

      case 'student': {
        const conditions = [...baseConditions];
        if (studentSearch && studentSearch.trim()) {
          const q = `%${studentSearch.trim()}%`;
          conditions.push(or(like(students.roll_no, q), like(students.name, q)));
        }

        const rows = await db
          .select({
            id: studentInternships.id,
            roll_no: students.roll_no,
            student_name: students.name,
            branch: sqlStudentBranch,
            academic_year: sqlAcademicYear,
            company_name: studentInternships.company_name,
            role_title: studentInternships.role_title,
            mode: studentInternships.mode,
            start_date: studentInternships.start_date,
            end_date: studentInternships.end_date,
            application_status: studentInternships.application_status,
            completion_status: studentInternships.completion_status,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(studentInternships.created_at))
          .limit(limitNum)
          .offset(offset);

        return {
          title: 'Individual Student Internship Report',
          columns: ['Roll No', 'Student Name', 'Branch', 'Year', 'Company', 'Role', 'Mode', 'Dates', 'App Status', 'Completion'],
          data: rows.map(r => ({
            roll_no: r.roll_no,
            student_name: r.student_name,
            branch: r.branch,
            academic_year: r.academic_year,
            company_name: r.company_name,
            role_title: r.role_title,
            mode: r.mode,
            dates: `${r.start_date} to ${r.end_date}`,
            application_status: r.application_status,
            completion_status: r.completion_status,
          })),
        };
      }

      case 'status': {
        const rows = await db
          .select({
            application_status: studentInternships.application_status,
            total: count(),
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
          .groupBy(studentInternships.application_status);

        return {
          title: 'Internship Status Report',
          columns: ['Application Status', 'Total Count'],
          data: rows.map(r => ({
            application_status: r.application_status,
            total: Number(r.total),
          })),
        };
      }

      case 'completed': {
        const conditions = [
          ...baseConditions,
          eq(studentInternships.completion_status, 'VERIFIED_COMPLETED')
        ];

        const rows = await db
          .select({
            roll_no: students.roll_no,
            student_name: students.name,
            branch: sqlStudentBranch,
            company_name: studentInternships.company_name,
            role_title: studentInternships.role_title,
            start_date: studentInternships.start_date,
            actual_completion_date: studentInternships.actual_completion_date,
            verified_at: studentInternships.verified_at,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(and(...conditions))
          .orderBy(desc(studentInternships.actual_completion_date))
          .limit(limitNum)
          .offset(offset);

        return {
          title: 'Completed Internship Report',
          columns: ['Roll No', 'Student Name', 'Branch', 'Company', 'Role', 'Start Date', 'Completion Date', 'Verified Date'],
          data: rows.map(r => ({
            roll_no: r.roll_no,
            student_name: r.student_name,
            branch: r.branch,
            company_name: r.company_name,
            role_title: r.role_title,
            start_date: r.start_date,
            actual_completion_date: r.actual_completion_date || 'N/A',
            verified_at: r.verified_at ? new Date(r.verified_at).toLocaleDateString() : 'N/A',
          })),
        };
      }

      case 'pending_verification': {
        const conditions = [
          ...baseConditions,
          eq(studentInternships.completion_status, 'SUBMITTED_FOR_VERIFICATION')
        ];

        const rows = await db
          .select({
            roll_no: students.roll_no,
            student_name: students.name,
            branch: sqlStudentBranch,
            company_name: studentInternships.company_name,
            role_title: studentInternships.role_title,
            start_date: studentInternships.start_date,
            actual_completion_date: studentInternships.actual_completion_date,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(and(...conditions))
          .orderBy(desc(studentInternships.actual_completion_date))
          .limit(limitNum)
          .offset(offset);

        return {
          title: 'Pending Certificate Verification Report',
          columns: ['Roll No', 'Student Name', 'Branch', 'Company', 'Role', 'Start Date', 'Completion Date Submitted'],
          data: rows.map(r => ({
            roll_no: r.roll_no,
            student_name: r.student_name,
            branch: r.branch,
            company_name: r.company_name,
            role_title: r.role_title,
            start_date: r.start_date,
            actual_completion_date: r.actual_completion_date || 'N/A',
          })),
        };
      }

      case 'external': {
        const conditions = [
          ...baseConditions,
          eq(studentInternships.registration_type, 'EXTERNAL_SELF_IDENTIFIED')
        ];

        const rows = await db
          .select({
            roll_no: students.roll_no,
            student_name: students.name,
            branch: sqlStudentBranch,
            company_name: studentInternships.company_name,
            role_title: studentInternships.role_title,
            mode: studentInternships.mode,
            application_status: studentInternships.application_status,
            is_unverified_exception: studentInternships.is_unverified_company_exception,
          })
          .from(studentInternships)
          .innerJoin(students, eq(studentInternships.student_id, students.id))
          .where(and(...conditions))
          .orderBy(desc(studentInternships.created_at))
          .limit(limitNum)
          .offset(offset);

        return {
          title: 'Independently Obtained Internship Report',
          columns: ['Roll No', 'Student Name', 'Branch', 'Company', 'Role', 'Mode', 'Status', 'Unverified Exception'],
          data: rows.map(r => ({
            roll_no: r.roll_no,
            student_name: r.student_name,
            branch: r.branch,
            company_name: r.company_name,
            role_title: r.role_title,
            mode: r.mode,
            application_status: r.application_status,
            is_unverified_exception: r.is_unverified_exception ? 'YES' : 'NO',
          })),
        };
      }

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Generates a standard CSV string for any of the 8 reports.
   */
  static async generateReportCsv(params) {
    const report = await this.getReportData(params);
    const headerRow = report.columns.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    const dataRows = report.data.map(row => {
      return Object.values(row).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',');
    });
    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Generates a styled Excel workbook (.xlsx) containing comprehensive internship records.
   */
  static async exportInternshipExcel({ branch = 'ALL', academicYear = 'ALL', status = 'ALL' } = {}) {
    const conditions = buildStudentFilters({ branch, academicYear });
    if (status && status !== 'ALL') {
      if (status === 'COMPLETED') {
        conditions.push(eq(studentInternships.completion_status, 'VERIFIED_COMPLETED'));
      } else if (status === 'APPROVED') {
        conditions.push(eq(studentInternships.application_status, 'APPROVED'));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: studentInternships.id,
        roll_no: students.roll_no,
        student_name: students.name,
        student_email: students.email,
        branch: sqlStudentBranch,
        academic_year: sqlAcademicYear,
        registration_type: studentInternships.registration_type,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
        mode: studentInternships.mode,
        start_date: studentInternships.start_date,
        end_date: studentInternships.end_date,
        duration: studentInternships.duration,
        stipend: studentInternships.stipend,
        application_status: studentInternships.application_status,
        internship_status: studentInternships.internship_status,
        completion_status: studentInternships.completion_status,
        actual_completion_date: studentInternships.actual_completion_date,
        is_unverified_company_exception: studentInternships.is_unverified_company_exception,
        unverified_company_exception_reason: studentInternships.unverified_company_exception_reason,
        created_at: studentInternships.created_at,
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause)
      .orderBy(desc(studentInternships.created_at));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KUCET College Management System';
    workbook.created = new Date();

    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet('Executive Summary');
    summarySheet.views = [{ showGridLines: true }];

    const navyFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B3578' },
    };
    const whiteBold = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = navyFill;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 28;

    summarySheet.mergeCells('A2:D2');
    const subCell = summarySheet.getCell('A2');
    subCell.value = `Internship Management Report — Filter: Branch=${branch}, Year=${academicYear}`;
    subCell.font = { name: 'Calibri', size: 11, italic: true };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Count']);
    const metricHeader = summarySheet.getRow(4);
    metricHeader.font = whiteBold;
    metricHeader.getCell(1).fill = navyFill;
    metricHeader.getCell(2).fill = navyFill;

    const totalCount = rows.length;
    const completedCount = rows.filter(r => r.completion_status === 'VERIFIED_COMPLETED').length;
    const approvedCount = rows.filter(r => r.application_status === 'APPROVED').length;
    const ongoingCount = rows.filter(r => r.internship_status === 'ONGOING').length;
    const unverifiedExcCount = rows.filter(r => r.is_unverified_company_exception).length;

    summarySheet.addRow(['Total Registered Internships', totalCount]);
    summarySheet.addRow(['Approved Internships', approvedCount]);
    summarySheet.addRow(['Currently Ongoing Internships', ongoingCount]);
    summarySheet.addRow(['Completed & Verified Internships', completedCount]);
    summarySheet.addRow(['Unverified Company Exceptions Approved', unverifiedExcCount]);

    summarySheet.columns = [{ width: 35 }, { width: 18 }];

    // Sheet 2: Detailed Internships
    const dataSheet = workbook.addWorksheet('Student Internships');
    dataSheet.views = [{ showGridLines: true }];

    dataSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Roll No', key: 'roll_no', width: 15 },
      { header: 'Student Name', key: 'student_name', width: 25 },
      { header: 'Branch', key: 'branch', width: 10 },
      { header: 'Academic Year', key: 'academic_year', width: 15 },
      { header: 'Type', key: 'registration_type', width: 18 },
      { header: 'Company Name', key: 'company_name', width: 25 },
      { header: 'Role Title', key: 'role_title', width: 22 },
      { header: 'Mode', key: 'mode', width: 12 },
      { header: 'Start Date', key: 'start_date', width: 14 },
      { header: 'End Date', key: 'end_date', width: 14 },
      { header: 'Duration', key: 'duration', width: 14 },
      { header: 'Stipend', key: 'stipend', width: 14 },
      { header: 'App Status', key: 'application_status', width: 18 },
      { header: 'Completion Status', key: 'completion_status', width: 22 },
      { header: 'Completion Date', key: 'actual_completion_date', width: 16 },
      { header: 'Unverified Company Exception', key: 'is_unverified_company_exception', width: 25 },
      { header: 'Exception Reason', key: 'unverified_company_exception_reason', width: 30 },
    ];

    const dataHeaderRow = dataSheet.getRow(1);
    dataHeaderRow.font = whiteBold;
    dataHeaderRow.height = 24;
    for (let col = 1; col <= dataSheet.columns.length; col++) {
      dataHeaderRow.getCell(col).fill = navyFill;
      dataHeaderRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    rows.forEach(r => {
      dataSheet.addRow({
        id: r.id,
        roll_no: r.roll_no,
        student_name: r.student_name,
        branch: r.branch,
        academic_year: r.academic_year,
        registration_type: r.registration_type === 'INTERNAL_APPLICATION' ? 'Internal' : 'Independently Obtained',
        company_name: r.company_name,
        role_title: r.role_title,
        mode: r.mode,
        start_date: r.start_date,
        end_date: r.end_date,
        duration: r.duration || 'N/A',
        stipend: r.stipend || 'Unpaid',
        application_status: r.application_status,
        completion_status: r.completion_status,
        actual_completion_date: r.actual_completion_date || 'N/A',
        is_unverified_company_exception: r.is_unverified_company_exception ? 'YES' : 'NO',
        unverified_company_exception_reason: r.unverified_company_exception_reason || '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }
}
