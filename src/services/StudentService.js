import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures
} from '@/db/schema';
import { eq, or, like, and } from 'drizzle-orm';
import { encrypt, hashForIndex, decrypt } from '@/lib/encryption';

/**
 * Service for Student-related business logic
 */
export class StudentService {
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

    // Extract the last 2 digits of the START year (e.g., '23' from '2023-24' or '2023-2027')
    const startYear = year.split('-')[0];
    const yearShort = startYear.slice(-2);
    
    const regularRollPattern = `${yearShort}567T${branch}%`;
    const lateralRollPattern = `${yearShort}567${branch}%L`;

    const results = await db.select({
      // 1. Core
      admission_no: studentsTable.admission_no,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      gender: studentsTable.gender,
      dob: studentsTable.date_of_birth,
      fee_reimbursement: studentsTable.fee_reimbursement,
      // 2. Personal
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
      // 3. Academic
      qualifying_exam: studentAcademicBackground.qualifying_exam,
      ssc_marks: studentAcademicBackground.ssc_marks,
      inter_marks: studentAcademicBackground.inter_marks,
      entrance_exam_rank: studentAcademicBackground.ranks,
      previous_college: studentAcademicBackground.previous_college_details,
      // 4. Assets
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

    // Decrypt sensitive fields with null-safety checks
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

    // Normalization & Encryption
    const normMobile = this.normalizeMobile(mobile);
    const normGuardianMobile = this.normalizeMobile(guardian_mobile);
    const normAadhaar = this.normalizeAadhaar(aadhaar_no);

    const studentValues = {
      admission_no: admission_no || null,
      roll_no: roll,
      name,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      gender: gender || null,
      email: email ? String(email).toLowerCase() : null,
      mobile: normMobile ? encrypt(normMobile) : null,
      mobile_hash: normMobile ? hashForIndex(normMobile) : null,
      fee_reimbursement: String(fee_reimbursement).toUpperCase() === 'YES' ? 'YES' : 'NO',
      admission_date: admission_date ? new Date(admission_date) : new Date()
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
      // 1. Core Student Record
      const existing = await innerTx.select({ id: studentsTable.id })
        .from(studentsTable).where(eq(studentsTable.roll_no, roll)).limit(1);
      
      let studentId;
      if (existing.length > 0) {
        studentId = existing[0].id;
        await innerTx.update(studentsTable).set(studentValues).where(eq(studentsTable.id, studentId));
      } else {
        const [res] = await innerTx.insert(studentsTable).values({ ...studentValues, added_by_clerk_id: clerkId });
        studentId = res.insertId;
      }

      // 2. Personal Details
      const existingPersonal = await innerTx.select({ id: studentPersonalDetails.id })
        .from(studentPersonalDetails).where(eq(studentPersonalDetails.student_id, studentId)).limit(1);
      
      if (existingPersonal.length > 0) {
        await innerTx.update(studentPersonalDetails).set(personalValues).where(eq(studentPersonalDetails.id, existingPersonal[0].id));
      } else {
        await innerTx.insert(studentPersonalDetails).values({ student_id: studentId, ...personalValues });
      }

      // 3. Academic Background
      const existingAcademic = await innerTx.select({ id: studentAcademicBackground.id })
        .from(studentAcademicBackground).where(eq(studentAcademicBackground.student_id, studentId)).limit(1);
      
      if (existingAcademic.length > 0) {
        await innerTx.update(studentAcademicBackground).set(academicValues).where(eq(studentAcademicBackground.id, existingAcademic[0].id));
      } else {
        await innerTx.insert(studentAcademicBackground).values({ student_id: studentId, ...academicValues });
      }

      // 4. Images
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
}
