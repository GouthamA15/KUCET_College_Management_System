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

/**
 * Service for Student-related business logic
 */
export class StudentService {
  /**
   * Specialized validator for Bonafide Certificate eligibility
   */
  static async validateBonafideEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now) {
    const { getResolvedCurrentAcademicYear, getBranchFromRoll } = await import('@/lib/rollNumber');
    const { calculateYearAndSemesterAsync } = await import('@/lib/academic-utils');

    const academicYear = getResolvedCurrentAcademicYear(rollNo, collegeInfo, now);
    const branch = getBranchFromRoll(rollNo);
    const { semester } = await calculateYearAndSemesterAsync(rollNo, collegeInfo, 0);

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

    const existingApproved = approvedRequests.find(r => 
      r.certificate_type === 'Bonafide Certificate' && r.academic_year === academicYear
    );

    const isAcademicYearEligible = !existingApproved;
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
      alreadyHasApproved: !!existingApproved,
      isEligible: isAcademicYearEligible && isAttendanceEligible,
      reason: !isAcademicYearEligible ? `You have already received an approved Bonafide for ${academicYear}.` : null
    };
  }

  /**
   * Specialized validator for Transfer Certificate (TC) eligibility
   */
  static async validateTCEligibility(studentId, rollNo, studentData, approvedRequests, collegeInfo, now) {
    const { calculateYearAndSemesterAsync } = await import('@/lib/academic-utils');
    const { getResolvedCurrentAcademicYear } = await import('@/lib/rollNumber');
    const { FinanceService } = await import('./FinanceService');

    const academicYear = getResolvedCurrentAcademicYear(rollNo, collegeInfo, now);
    const { year, semester } = await calculateYearAndSemesterAsync(rollNo, collegeInfo, 0);

    const financialSummary = await FinanceService.getStudentFinancialSummary(studentId, academicYear, rollNo);
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
    // Standard NOC rules: Must be an active student (already checked by auth)
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

  /**
   * Normalize a roll number for database operations
   * @param {string} rollNo 
   * @returns {string}
   */
  static normalizeRollNo(rollNo) {
    if (!rollNo) return '';
    return String(rollNo).trim().toUpperCase();
  }

  /**
   * Normalize a mobile number (numeric only)
   * @param {string} mobile 
   * @returns {string}
   */
  static normalizeMobile(mobile) {
    if (!mobile) return '';
    return String(mobile).replace(/\D/g, '');
  }

  /**
   * Normalize an Aadhaar number (numeric only)
   * @param {string} aadhaar 
   * @returns {string}
   */
  static normalizeAadhaar(aadhaar) {
    if (!aadhaar) return '';
    return String(aadhaar).replace(/\D/g, '');
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
   * @param {string} year Academic year
   * @param {string} branch Branch code (numerical)
   * @returns {Promise<Array>} List of joined student records
   */
  static async getFullStudentDataForExport(year, branch) {
    if (!year || !branch) {
      throw new Error('Year and branch are required');
    }

    const startYear = year.split('-')[0];
    const startYearInt = parseInt(startYear, 10);
    const regularYearShort = String(startYearInt).slice(-2);
    const lateralYearShort = String(startYearInt + 1).slice(-2);
    
    const regularRollPattern = `${regularYearShort}567T${branch}%`;
    const lateralRollPattern = `${lateralYearShort}567${branch}%L`;

    const results = await db.select({
      admission_no: studentsTable.admission_no,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      gender: studentsTable.gender,
      dob: studentsTable.date_of_birth,
      fee_reimbursement: studentsTable.fee_reimbursement,
      father_name: studentPersonalDetails.father_name,
      mother_name: studentPersonalDetails.mother_name,
      nationality: studentPersonalDetails.nationality,
      religion: studentPersonalDetails.religion,
      category: studentPersonalDetails.category,
      sub_caste: studentPersonalDetails.sub_caste,
      mother_tongue: studentPersonalDetails.mother_tongue,
      place_of_birth: studentPersonalDetails.place_of_birth,
      area_status: studentPersonalDetails.area_status,
      father_occupation: studentPersonalDetails.father_occupation,
      identification_marks: studentPersonalDetails.identification_marks,
      annual_income: studentPersonalDetails.annual_income,
      aadhaar_no: studentPersonalDetails.aadhaar_no,
      guardian_mobile: studentPersonalDetails.guardian_mobile,
      permanent_address: studentPersonalDetails.address,
      seat_allotted_category: studentPersonalDetails.seat_allotted_category,
      blood_group: studentPersonalDetails.blood_group,
      qualifying_exam: studentAcademicBackground.qualifying_exam,
      ssc_marks: studentAcademicBackground.ssc_marks,
      inter_marks: studentAcademicBackground.inter_marks,
      entrance_exam_rank: studentAcademicBackground.ranks,
      previous_college: studentAcademicBackground.previous_college_details,
      photo: studentImages.pfp,
      signature: studentSignatures.signature
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
    .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
    .leftJoin(studentSignatures, eq(studentsTable.id, studentSignatures.student_id))
    .where(or(
      like(studentsTable.roll_no, regularRollPattern),
      like(studentsTable.roll_no, lateralRollPattern)
    ));

    return results.map(row => ({
      ...row,
      mobile: row.mobile ? decrypt(row.mobile) : null,
      aadhaar_no: row.aadhaar_no ? decrypt(row.aadhaar_no) : null,
      guardian_mobile: row.guardian_mobile ? decrypt(row.guardian_mobile) : null
    }));
  }

  /**
   * Upsert a student record with all related details (personal, academic, images)
   * @param {Object} data Comprehensive student data object
   * @param {number} clerkId ID of the clerk performing the action
   * @param {Object} tx Optional Drizzle transaction object
   * @returns {Promise<number>} Student ID
   */
  static async upsertStudent(data, clerkId, tx = null) {
    const {
      admission_no, roll_no, name, date_of_birth, gender, email, mobile,
      father_name, mother_name, nationality, religion, category, sub_caste,
      area_status, mother_tongue, place_of_birth, father_occupation, annual_income,
      guardian_mobile, aadhaar_no, address, seat_allotted_category, blood_group,
      identification_marks, qualifying_exam, previous_college_details,
      medium_of_instruction, ranks, ssc_marks, inter_marks, fee_reimbursement,
      pfp, signature, admission_date
    } = data;

    const roll = this.normalizeRollNo(roll_no);
    if (!roll || !name) throw new Error('MISSING_REQUIRED_FIELDS');

    const normMobile = this.normalizeMobile(mobile);
    const normGuardianMobile = this.normalizeMobile(guardian_mobile);
    const normAadhaar = this.normalizeAadhaar(aadhaar_no);

    const normalizeToMySQLDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const studentValues = {
      admission_no: admission_no || null,
      roll_no: roll,
      name,
      date_of_birth: normalizeToMySQLDate(date_of_birth),
      gender: gender || null,
      email: email ? String(email).toLowerCase() : null,
      mobile: normMobile ? encrypt(normMobile) : null,
      mobile_hash: normMobile ? hashForIndex(normMobile) : null,
      fee_reimbursement: ['YES', 'NO', 'GOV'].includes(String(fee_reimbursement).toUpperCase()) 
        ? String(fee_reimbursement).toUpperCase() 
        : 'NO',
      admission_date: normalizeToMySQLDate(admission_date) || normalizeToMySQLDate(new Date())
    };

    const personalValues = {
      father_name: father_name || null,
      mother_name: mother_name || null,
      nationality: nationality || 'Indian',
      religion: religion || null,
      category: category || null,
      sub_caste: sub_caste || null,
      area_status: area_status || 'Local',
      mother_tongue: mother_tongue || null,
      place_of_birth: place_of_birth || null,
      father_occupation: father_occupation || null,
      annual_income: annual_income || null,
      guardian_mobile: normGuardianMobile ? encrypt(normGuardianMobile) : null,
      aadhaar_no: normAadhaar ? encrypt(normAadhaar) : null,
      aadhaar_hash: normAadhaar ? hashForIndex(normAadhaar) : null,
      address: address || null,
      seat_allotted_category: seat_allotted_category || null,
      blood_group: blood_group || null,
      identification_marks: identification_marks || null
    };

    const academicValues = {
      qualifying_exam: qualifying_exam || null,
      previous_college_details: previous_college_details || null,
      medium_of_instruction: medium_of_instruction || null,
      ranks: ranks ? parseInt(ranks) : null,
      ssc_marks: ssc_marks || null,
      inter_marks: inter_marks || null
    };

    const executeUpsert = async (innerTx) => {
      const existing = await innerTx.select({ id: studentsTable.id })
        .from(studentsTable).where(eq(studentsTable.roll_no, roll)).limit(1);
      
      let studentId;
      if (existing.length > 0) {
        studentId = existing[0].id;
        await innerTx.update(studentsTable).set(studentValues).where(eq(studentsTable.id, studentId));
      } else {
        const res = await innerTx.insert(studentsTable).values({ ...studentValues, added_by_clerk_id: clerkId });
        studentId = res.insertId || res[0]?.insertId;
        if (!studentId) throw new Error('STUDENT_ID_GENERATION_FAILED');
      }

      const existingPersonal = await innerTx.select({ id: studentPersonalDetails.id })
        .from(studentPersonalDetails).where(eq(studentPersonalDetails.student_id, studentId)).limit(1);
      
      if (existingPersonal.length > 0) {
        await innerTx.update(studentPersonalDetails).set(personalValues).where(eq(studentPersonalDetails.id, existingPersonal[0].id));
      } else {
        await innerTx.insert(studentPersonalDetails).values({ student_id: studentId, ...personalValues });
      }

      const existingAcademic = await innerTx.select({ id: studentAcademicBackground.id })
        .from(studentAcademicBackground).where(eq(studentAcademicBackground.student_id, studentId)).limit(1);
      
      if (existingAcademic.length > 0) {
        await innerTx.update(studentAcademicBackground).set(academicValues).where(eq(studentAcademicBackground.id, existingAcademic[0].id));
      } else {
        await innerTx.insert(studentAcademicBackground).values({ student_id: studentId, ...academicValues });
      }

      if (pfp) {
        await innerTx.insert(studentImages).values({ student_id: studentId, pfp }).onDuplicateKeyUpdate({ set: { pfp } });
      }
      if (signature) {
        await innerTx.insert(studentSignatures).values({ student_id: studentId, signature }).onDuplicateKeyUpdate({ set: { signature } });
      }

      return studentId;
    };

    if (tx) {
      return await executeUpsert(tx);
    } else {
      return await db.transaction(executeUpsert);
    }
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
