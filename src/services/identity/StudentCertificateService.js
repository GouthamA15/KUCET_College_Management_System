import { db } from '@/db';
import { 
  students as studentsTable, 
  collegeInfo as collegeInfoTable,
  studentAttendance,
  studentRequests,
  facultySubjectAssignments
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Service for Student Certificate Eligibility & Validation
 */
export class StudentCertificateService {
  /**
   * Specialized validator for Bonafide Certificate eligibility
   */
  static async validateBonafideEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now) {
    const { getBranchFromRoll } = await import('@/lib/rollNumber');
    const { calculateYearAndSemesterAsync, getCollegeAcademicYear } = await import('@/lib/academic-utils');
    const { parsePurpose } = await import('@/lib/certificate-utils');

    const academicYear = await getCollegeAcademicYear();
    const branch = getBranchFromRoll(rollNo);
    const { semester } = await calculateYearAndSemesterAsync(rollNo, 0);

    const attendanceStats = await db.select({
      total_classes: sql`COUNT(DISTINCT ${studentAttendance.id})`,
      attended_classes: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'NCC', 'MEDICAL') THEN ${studentAttendance.id} END)`
    })
    .from(studentAttendance)
    .innerJoin(facultySubjectAssignments, eq(studentAttendance.assignment_id, facultySubjectAssignments.id))
    .where(and(
      eq(studentAttendance.student_id, studentId),
      eq(facultySubjectAssignments.branch, branch),
      eq(facultySubjectAssignments.course_semester, semester),
      eq(facultySubjectAssignments.academic_year, academicYear)
    ));

    const total = Number(attendanceStats[0]?.total_classes || 0);
    const attended = Number(attendanceStats[0]?.attended_classes || 0);
    const attendancePercent = total > 0 ? (attended / total) * 100 : null;

    const approvedBonafides = approvedRequests.filter(r => 
      r.certificate_type === 'Bonafide Certificate' && r.academic_year === academicYear
    );

    const approvedPurposes = approvedBonafides.map(r => {
      const parsed = parsePurpose(r.purpose);
      if (parsed.purpose_type === 'Other' && parsed.purpose_custom) {
        return parsed.purpose_custom;
      }
      return parsed.purpose_type || 'General';
    });

    const isAttendanceEligible = true; // Institutional Waiver currently active

    return {
      attendance: {
        total,
        attended,
        percentage: attendancePercent,
        isEligible: true,
        thresholdReached: attendancePercent === null || attendancePercent >= 50
      },
      feeReimbursement: studentData?.fee_reimbursement || 'NO',
      academicYear,
      approvedPurposes,
      alreadyHasApproved: approvedPurposes.length > 0,
      isEligible: isAttendanceEligible,
      reason: null
    };
  }

  /**
   * Specialized validator for Transfer Certificate (TC) eligibility
   */
  static async validateTCEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now) {
    const { calculateYearAndSemesterAsync, getCollegeAcademicYear } = await import('@/lib/academic-utils');
    const { ScholarshipService } = await import('../finance/ScholarshipService');

    const academicYear = await getCollegeAcademicYear();
    const { yearOfStudy: year, semester } = await calculateYearAndSemesterAsync(rollNo, 0);

    const financialSummary = await ScholarshipService.getScholarshipFinancialSummary(studentId, academicYear, rollNo);
    const pendingDues = financialSummary?.feeSummary?.pendingFee || 0;

    const isFinalYearCompleted = year > 4 || (year === 4 && semester >= 8);
    const hasNoDues = pendingDues <= 0;

    return {
      isFinalYearCompleted,
      hasNoDues,
      pendingDues,
      isEligible: isFinalYearCompleted && hasNoDues,
      reason: !isFinalYearCompleted 
        ? "Final academic year not completed." 
        : (!hasNoDues ? "Outstanding fee dues detected." : null)
    };
  }

  /**
   * Specialized validator for No Objection Certificate (NOC) eligibility
   */
  static async validateNOCEligibility() {
    return {
      isEligible: true,
      reason: null
    };
  }

  /**
   * Central orchestrator for certificate eligibility
   */
  static async getCertificateEligibility(studentId, rollNo) {
    const { getNow } = await import('@/lib/clock');

    const now = await getNow();
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1));
    const collegeInfo = collegeRows[0] || null;

    const studentData = await db.query.students.findFirst({
      columns: { fee_reimbursement: true },
      where: eq(studentsTable.id, studentId)
    });

    const approvedRequests = await db.query.studentRequests.findMany({
      where: and(
        eq(studentRequests.student_id, studentId),
        eq(studentRequests.status, 'APPROVED')
      )
    });

    return {
      bonafide: await this.validateBonafideEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now),
      tc: await this.validateTCEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now),
      noc: await this.validateNOCEligibility()
    };
  }
}
