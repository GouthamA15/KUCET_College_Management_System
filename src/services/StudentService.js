import { db } from '@/db';
import logger from '@/lib/logger';
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
import { getStorageProvider } from '@/lib/providers/storage/factory';

/**
 * Service for Student-related business logic
 */
export class StudentService {
  /**
   * Check Bonafide certificate eligibility for a student
   * @param {number} studentId 
   * @param {string} rollNo 
   * @returns {Promise<Object>} Eligibility details
   */
  static async getBonafideEligibility(studentId, rollNo) {
    const { calculateYearAndSemesterAsync } = await import('@/lib/academic-utils');
    const { getResolvedCurrentAcademicYear, getBranchFromRoll } = await import('@/lib/rollNumber');
    const { getNow } = await import('@/lib/clock');

    const now = await getNow();
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1));
    const collegeInfo = collegeRows[0] || null;

    const { semester } = await calculateYearAndSemesterAsync(rollNo, collegeInfo, 0);
    const academicYear = getResolvedCurrentAcademicYear(rollNo, collegeInfo, now);
    const branch = getBranchFromRoll(rollNo);

    // 1. Attendance Calculation
    // We join with faculty assignments to filter by current semester and academic year
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

    // 2. Fee Reimbursement
    const student = await db.query.students.findFirst({
      columns: { fee_reimbursement: true },
      where: eq(studentsTable.id, studentId)
    });

    // 3. Existing Approved Bonafide for current year
    const existingApproved = await db.query.studentRequests.findFirst({
      where: and(
        eq(studentRequests.student_id, studentId),
        eq(studentRequests.certificate_type, 'Bonafide Certificate'),
        eq(studentRequests.academic_year, academicYear),
        eq(studentRequests.status, 'APPROVED')
      )
    });

    const isAttendanceEligible = attendancePercent === null || attendancePercent >= 50;
    const isAcademicYearEligible = !existingApproved;

    return {
      attendance: {
        total,
        attended,
        percentage: attendancePercent,
        isEligible: isAttendanceEligible
      },
      feeReimbursement: student?.fee_reimbursement || 'NO',
      academicYear,
      alreadyHasApproved: !!existingApproved,
      isEligible: isAttendanceEligible && isAcademicYearEligible,
      reason: !isAttendanceEligible 
        ? 'Attendance is below 50%.' 
        : (!isAcademicYearEligible ? `You have already received an approved Bonafide for ${academicYear}.` : null)
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

    const storage = getStorageProvider();
    const uploadedPaths = [];

    let pfpPath = pfp;
    let sigPath = signature;

    try {
      // 1. Upload to storage BEFORE transaction
      if (typeof pfp === 'string' && pfp.startsWith('data:')) {
        pfpPath = await storage.upload(pfp, 'students/pfp', roll);
        uploadedPaths.push(pfpPath);
      }
      if (typeof signature === 'string' && signature.startsWith('data:')) {
        sigPath = await storage.upload(signature, 'students/signatures', `${roll}-sig`);
        uploadedPaths.push(sigPath);
      }

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

        if (pfpPath) {
          await innerTx.insert(studentImages).values({ student_id: studentId, pfp: pfpPath }).onDuplicateKeyUpdate({ set: { pfp: pfpPath } });
        }
        if (sigPath) {
          await innerTx.insert(studentSignatures).values({ student_id: studentId, signature: sigPath }).onDuplicateKeyUpdate({ set: { signature: sigPath } });
        }

        return studentId;
      };

      if (tx) {
        return await executeUpsert(tx);
      } else {
        return await db.transaction(executeUpsert);
      }
    } catch (error) {
      // Cleanup uploaded files on error
      for (const path of uploadedPaths) {
        try { await storage.delete(path); }
        catch (delErr) { logger.error({ err: delErr, path }, 'Orphaned student asset cleanup failed'); }
      }
      logger.error({ err: error, roll }, 'Upsert student failed');
      throw error;
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

    const storage = getStorageProvider();
    const imageHelper = (val) => {
      if (!val) return null;
      // 1. Data URI or Absolute URL
      if (typeof val === 'string' && (val.startsWith('http') || /^data:[^;]+;base64,/.test(val))) return val;
      
      // 2. Legacy Raw Base64 Detection
      if (typeof val === 'string' && val.length > 50) {
        let mimeType = null;
        if (val.startsWith('iVBORw')) mimeType = 'image/png';
        else if (val.startsWith('/9j/')) mimeType = 'image/jpeg';
        else if (val.startsWith('R0lGOD')) mimeType = 'image/gif';
        else if (val.startsWith('UklGR')) mimeType = 'image/webp';
        
        if (mimeType) return `data:${mimeType};base64,${val}`;
      }

      // 3. Buffer Magic Byte Detection
      if (Buffer.isBuffer(val)) {
        let mimeType = 'application/octet-stream';
        if (val.length >= 4) {
          // PNG: 89 50 4E 47
          if (val[0] === 0x89 && val[1] === 0x50 && val[2] === 0x4E && val[3] === 0x47) mimeType = 'image/png';
          // JPEG: FF D8 FF
          else if (val[0] === 0xFF && val[1] === 0xD8 && val[2] === 0xFF) mimeType = 'image/jpeg';
          // GIF: 47 49 46 38
          else if (val[0] === 0x47 && val[1] === 0x49 && val[2] === 0x46 && val[3] === 0x38) mimeType = 'image/gif';
          // WEBP: RIFF...WEBP
          else if (val[0] === 0x52 && val[1] === 0x49 && val[2] === 0x46 && val[3] === 0x46 &&
                   val[8] === 0x57 && val[9] === 0x45 && val[10] === 0x42 && val[11] === 0x50) mimeType = 'image/webp';
        }
        return `data:${mimeType};base64,${val.toString('base64')}`;
      }

      // 4. Relative Path
      try {
        return storage.getUrl(val);
      } catch (e) {
        logger.error({ err: e, val, func: 'imageHelper' }, 'Failed to resolve image URL');
        return null;
      }
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
