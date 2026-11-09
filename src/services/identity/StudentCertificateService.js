import { db } from '@/db';
import { 
  students as studentsTable, 
  collegeInfo as collegeInfoTable,
  studentAttendance,
  studentRequests,
  facultySubjectAssignments
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * Service for Certificate Eligibility and Validation logic
 */
export class StudentCertificateService {
  /**
   * Specialized validator for Bonafide Certificate eligibility
   */
  static async validateBonafideEligibility(studentId, rollNo, studentData, allRequests, _collegeInfo, _now) {
    try {
      const { getBranchFromRoll } = await import('@/lib/rollNumber');
      const { calculateYearAndSemesterAsync, getCollegeAcademicYear } = await import('@/lib/academic-utils');
      const { parsePurpose } = await import('@/lib/certificate-utils');
      const { resolveAcademicClassification, evaluateBonafideFeeEntitlement } = await import('@/lib/academicClassification');

      const academicYear = await getCollegeAcademicYear();
      const branch = getBranchFromRoll(rollNo);
      const { semester } = await calculateYearAndSemesterAsync(rollNo, 0);

      const classification = resolveAcademicClassification({
        rollNo,
        academicYear,
        studySemester: semester || null
      });

      const bonafideRequests = (allRequests || []).filter(r => r?.certificate_type === 'Bonafide Certificate');
      const feeEntitlement = evaluateBonafideFeeEntitlement({
        allBonafideRows: bonafideRequests,
        isFirstYearAtKucet: classification.isFirstYearAtKucet,
        currentAcademicYear: academicYear
      });

      let total = 0;
      let attended = 0;
      let attendancePercent = null;

      if (studentId && branch && semester) {
        try {
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

          total = Number(attendanceStats[0]?.total_classes || 0);
          attended = Number(attendanceStats[0]?.attended_classes || 0);
          attendancePercent = total > 0 ? (attended / total) * 100 : null;
        } catch (attErr) {
          logger.warn({ err: attErr.message, studentId }, '[BONAFIDE_ELIGIBILITY_ATTENDANCE_WARN]');
        }
      }

      const approvedBonafides = bonafideRequests.filter(r => 
        r?.status === 'APPROVED' && r?.academic_year === academicYear
      );

      const approvedPurposes = approvedBonafides.map(r => {
        const parsed = parsePurpose(r.purpose);
        if (parsed.purpose_type === 'Other' && parsed.purpose_custom) {
          return parsed.purpose_custom;
        }
        return parsed.purpose_type || 'General';
      });

      const isEligible = feeEntitlement.canSubmit;

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
        isEligible,
        reason: isEligible ? null : feeEntitlement.feeReason,
        classification,
        feeEntitlement
      };
    } catch (err) {
      logger.warn({ err: err.message, studentId, rollNo }, '[BONAFIDE_ELIGIBILITY_FALLBACK]');
      const { validateRollNo: parseRoll } = await import('@/lib/rollNumber').catch(() => ({ validateRollNo: () => ({ isValid: false }) }));
      const parsed = rollNo ? parseRoll(rollNo) : null;
      const entryYr = parsed?.entryYear ? parseInt(parsed.entryYear, 10) : null;
      const currentYr = new Date().getFullYear();
      const yearsAtKucet = entryYr ? Math.max(1, currentYr - entryYr + 1) : 1;
      const isFirstYear = yearsAtKucet === 1;

      return {
        attendance: { total: 0, attended: 0, percentage: null, isEligible: true, thresholdReached: true },
        feeReimbursement: studentData?.fee_reimbursement || 'NO',
        academicYear: '2026-27',
        approvedPurposes: [],
        alreadyHasApproved: false,
        isEligible: true,
        reason: null,
        classification: {
          isValid: true,
          admissionType: parsed?.admissionType || 'Regular',
          yearsAtKucet,
          studyYear: Math.min(4, yearsAtKucet),
          certificateFormat: isFirstYear ? 'ORDINARY' : 'PERCENTAGE',
          isFirstYearAtKucet: isFirstYear
        },
        feeEntitlement: {
          canSubmit: true,
          isPendingLocked: false,
          conflictDetected: false,
          requiredFee: isFirstYear ? 100 : 0,
          feeReason: isFirstYear
            ? 'First-Year Bonafide Processing Fee (₹100 payable once in Year 1 at KUCET)'
            : 'Free under Senior Year Bonafide Entitlement (Year 2+ at KUCET)'
        }
      };
    }
  }

  /**
   * Specialized validator for Transfer Certificate (TC) eligibility
   */
  static async validateTCEligibility(studentId, rollNo, _studentData, _approvedRequests, _collegeInfo, _now) {
    try {
      const { calculateYearAndSemesterAsync, getCollegeAcademicYear } = await import('@/lib/academic-utils');
      
      const academicYear = await getCollegeAcademicYear();
      let yearOfStudy = null;
      let semester = null;
      
      if (rollNo) {
        const semResult = await calculateYearAndSemesterAsync(rollNo, 0).catch(() => ({ yearOfStudy: null, semester: null }));
        yearOfStudy = semResult?.yearOfStudy || null;
        semester = semResult?.semester || null;
      }

      let pendingDues = 0;
      if (studentId) {
        try {
          const { ScholarshipService } = await import('../finance/ScholarshipService');
          const financialSummary = await ScholarshipService.getScholarshipFinancialSummary(studentId, academicYear, rollNo);
          pendingDues = financialSummary?.feeSummary?.pendingFee || 0;
        } catch (finErr) {
          logger.warn({ err: finErr.message, studentId }, '[TC_ELIGIBILITY_FINANCE_WARN]');
        }
      }

      const yearNum = Number(yearOfStudy) || 1;
      const semNum = Number(semester) || 1;
      const isFinalYearCompleted = yearNum > 4 || (yearNum === 4 && semNum >= 8);
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
    } catch (err) {
      logger.warn({ err: err.message, studentId, rollNo }, '[TC_ELIGIBILITY_FALLBACK]');
      return {
        isFinalYearCompleted: false,
        hasNoDues: true,
        pendingDues: 0,
        isEligible: false,
        reason: "Unable to verify academic completion status."
      };
    }
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
    try {
      const { getNow } = await import('@/lib/clock');

      const now = await getNow();
      const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).catch(() => []);
      const collegeInfo = collegeRows[0] || null;

      const studentData = db.query?.students
        ? await db.query.students.findFirst({
            columns: { fee_reimbursement: true, academic_offset_years: true },
            where: eq(studentsTable.id, studentId)
          }).catch(() => null)
        : null;

      const allRequests = db.query?.studentRequests
        ? await db.query.studentRequests.findMany({
            where: eq(studentRequests.student_id, studentId)
          }).catch(() => [])
        : [];

      const approvedRequests = allRequests.filter(r => r.status === 'APPROVED');

      return {
        bonafide: await this.validateBonafideEligibility(studentId, rollNo, studentData, allRequests, collegeInfo, now),
        tc: await this.validateTCEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now),
        noc: await this.validateNOCEligibility()
      };
    } catch (error) {
      logger.error({ err: error.message, studentId, rollNo }, '[GET_CERTIFICATE_ELIGIBILITY_ERROR]');
      return {
        bonafide: { attendance: { total: 0, attended: 0, percentage: null, isEligible: true, thresholdReached: true }, feeReimbursement: 'NO', academicYear: '2025-2026', approvedPurposes: [], alreadyHasApproved: false, isEligible: true, reason: null },
        tc: { isFinalYearCompleted: false, hasNoDues: true, pendingDues: 0, isEligible: false, reason: "Eligibility check unavailable." },
        noc: { isEligible: true, reason: null }
      };
    }
  }

  /**
   * Check if a branch has an active HOD assignment
   */
  static async getActiveHodForBranch(branch) {
    if (!branch) return null;
    try {
      const { facultyHodAssignments } = await import('@/db/schema');
      const { lte, or, isNull, gte, and, eq } = await import('drizzle-orm');
      const todayStr = new Date().toISOString().split('T')[0];
      
      const hodAssignment = await db.query.facultyHodAssignments.findFirst({
        where: and(
          eq(facultyHodAssignments.department_code, branch),
          eq(facultyHodAssignments.is_active, true),
          lte(facultyHodAssignments.start_date, todayStr),
          or(
            isNull(facultyHodAssignments.end_date),
            gte(facultyHodAssignments.end_date, todayStr)
          )
        )
      });
      return hodAssignment || null;
    } catch (e) {
      logger.warn({ err: e.message, branch }, '[GET_ACTIVE_HOD_WARN]');
      return null;
    }
  }

  /**
   * Determine initial routing and approval status for a certificate request
   */
  static async determineCertificateRouting(certificateType, rollNo) {
    const { getBranchFromRoll } = await import('@/lib/rollNumber');
    const branch = getBranchFromRoll(rollNo);
    
    if (certificateType === 'No Objection Certificate') {
      return {
        staffType: 'hod',
        hodApprovalStatus: 'PENDING',
        branch,
        requiresHod: true,
      };
    }
    
    if (certificateType === 'Bonafide Certificate') {
      const activeHod = await this.getActiveHodForBranch(branch);
      if (activeHod) {
        return {
          staffType: 'hod',
          hodApprovalStatus: 'PENDING',
          branch,
          requiresHod: true,
          hodStaffId: activeHod.staff_account_id,
        };
      } else {
        return {
          staffType: 'admission',
          hodApprovalStatus: 'NOT_REQUIRED',
          branch,
          requiresHod: false,
        };
      }
    }
    
    // Scholarship certificates
    if (['Income Tax (IT) Certificate', 'Custodian Certificate'].includes(certificateType)) {
      return {
        staffType: 'scholarship',
        hodApprovalStatus: 'NOT_REQUIRED',
        branch,
        requiresHod: false,
      };
    }
    
    // Default Admission certificates
    return {
      staffType: 'admission',
      hodApprovalStatus: 'NOT_REQUIRED',
      branch,
      requiresHod: false,
    };
  }
}
