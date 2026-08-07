import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures,
  scholarshipSanctions,
  studentFeePayments,
  collegeInfo as collegeInfoTable,
  studentAttendance,
  studentRequests,
  facultySubjectAssignments
} from '@/db/schema';
import { eq, or, like, desc, and, sql } from 'drizzle-orm';
import { encrypt, hashForIndex, decrypt } from '@/lib/encryption';
import { getPermanentAddressFromDetails, getContactAddressFromDetails, mapAddressStringsToFields } from '@/lib/address-utils';
import { getStorageProvider } from '@/lib/providers/storage/factory';

import { StudentCertificateService } from './StudentCertificateService';
import { StudentProfileService } from './StudentProfileService';

/**
 * Service for Student-related business logic
 */
export class StudentService {
  /**
   * Specialized validator for Bonafide Certificate eligibility
   */
  static async validateBonafideEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now) {
    const { getBranchFromRoll } = await import('@/lib/rollNumber');
    const { calculateYearAndSemesterAsync, getCollegeAcademicYear } = await import('@/lib/academic-utils');
    const { parsePurpose } = await import('@/lib/certificate-utils');

    const academicYear = await getCollegeAcademicYear();
    const branch = getBranchFromRoll(rollNo);
    const { semester } = await calculateYearAndSemesterAsync(rollNo, 0, now);

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
    const { year, semester } = await calculateYearAndSemesterAsync(rollNo, 0, now);

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
   * Specialized validator for NOC eligibility
   */
  static async validateNOCEligibility() {
    return StudentCertificateService.validateNOCEligibility();
  }

  /**
   * Central orchestrator for certificate eligibility
   */
  static async getCertificateEligibility(studentId, rollNo) {
    return StudentCertificateService.getCertificateEligibility(studentId, rollNo);
  }

  /**
   * Normalize a roll number
   */
  static normalizeRollNo(rollNo) {
    return StudentProfileService.normalizeRollNo(rollNo);
  }

  /**
   * Normalize a mobile number
   */
  static normalizeMobile(mobile) {
    return StudentProfileService.normalizeMobile(mobile);
  }

  /**
   * Normalize an Aadhaar number
   */
  static normalizeAadhaar(aadhaar) {
    return StudentProfileService.normalizeAadhaar(aadhaar);
  }

  /**
   * Fetch students filtered by year and branch
   * @param {string} year Academic year (e.g., '2025-26')
   * @param {string} branch Branch code (e.g., 'CSE')
   * @returns {Promise<Array>} List of students
   */
  static async getStudentsByYearAndBranch(year, branch) {
    if (!year || !branch) {
      throw new Error('Year and branch are required');
    }

    const yearShort = year.slice(-2);
    const regularRollPattern = `${yearShort}567T${branch}%`;
    const lateralRollPattern = `${yearShort}567${branch}%L`;

    return await db.select()
      .from(studentsTable)
      .where(or(
        like(studentsTable.roll_no, regularRollPattern),
        like(studentsTable.roll_no, lateralRollPattern)
      ));
  }

  /**
   * Fetch full student details for data migration/export
   */
  static async getFullStudentDataForExport(year, branch) {
    return StudentProfileService.getFullStudentDataForExport(year, branch);
  }

  /**
   * Upsert a student record with all related details
   */
  static async upsertStudent(data, clerkId, tx = null) {
    return StudentProfileService.upsertStudent(data, clerkId, tx);
  }

  /**
   * Fetch a full student profile with all related data (joined and collections)
   * @param {string} rollNo 
   * @returns {Promise<Object>} Full student profile
   */
  static async getStudentProfile(rollNo) {
    const roll = this.normalizeRollNo(rollNo);
    if (!roll) throw new Error('ROLL_NUMBER_REQUIRED');

    const rows = await db.select()
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
      .where(eq(studentsTable.roll_no, roll))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const studentId = row.students.id;

    const student = {
      ...row.students,
      mobile: row.students.mobile ? decrypt(row.students.mobile) : null,
      personal_details: row.student_personal_details ? {
        ...row.student_personal_details,
        contact_address: getContactAddressFromDetails(row.student_personal_details),
        permanent_address: getPermanentAddressFromDetails(row.student_personal_details),
        guardian_mobile: row.student_personal_details.guardian_mobile ? decrypt(row.student_personal_details.guardian_mobile) : null,
        aadhaar_no: row.student_personal_details.aadhaar_no ? decrypt(row.student_personal_details.aadhaar_no) : null
      } : {},
      academic_background: row.student_academic_background || null
    };

    const [pfpRow, sigRow, scholarship, fees] = await Promise.all([
      db.query.studentImages.findFirst({ where: eq(studentImages.student_id, studentId) }),
      db.query.studentSignatures.findFirst({ where: eq(studentSignatures.student_id, studentId) }),
      db.query.scholarshipSanctions.findMany({
        where: eq(scholarshipSanctions.student_id, studentId),
        orderBy: [desc(scholarshipSanctions.sanction_date)]
      }),
      db.query.studentFeePayments.findMany({
        where: eq(studentFeePayments.student_id, studentId),
        orderBy: [desc(studentFeePayments.transaction_date)]
      })
    ]);

    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      
      // Resolve relative paths using Storage Provider
      if (typeof val === 'string') {
        const storage = getStorageProvider();
        return storage.getUrl(val);
      }

      if (Buffer.isBuffer(val)) {
        // Detect MIME type from magic bytes
        let mimeType = 'application/octet-stream';
        if (val.length >= 4) {
          const header = val.slice(0, 12);
          // PNG: 89 50 4E 47
          if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
            mimeType = 'image/png';
          }
          // JPEG: FF D8 FF
          else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
            mimeType = 'image/jpeg';
          }
          // GIF: 47 49 46
          else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
            mimeType = 'image/gif';
          }
          // WEBP: RIFF...WEBP
          else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
                   header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
            mimeType = 'image/webp';
          }
        }
        return `data:${mimeType};base64,${val.toString('base64')}`;
      }
      return val;
    };

    return {
      student: {
        ...student,
        pfp: pfpRow ? imageHelper(pfpRow.pfp) : null,
        signature: sigRow ? imageHelper(sigRow.signature) : null
      },
      scholarship,
      fees,
      academics: row.student_academic_background ? [row.student_academic_background] : []
    };
  }
}
