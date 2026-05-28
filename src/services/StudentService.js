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
   * Create a new student with personal and academic details
   * @param {Object} data Student data
   * @param {number} clerkId ID of the clerk adding the student
   * @returns {Promise<number>} ID of the created student
   */
  static async createStudent(data, clerkId) {
    let {
      admission_no, roll_no, name, date_of_birth, gender, mobile, email,
      father_name, mother_name, religion, sub_caste, category, address,
      qualifying_exam, aadhaar_no, annual_income, admission_date
    } = data;

    if (!roll_no || !name) {
      throw new Error('Roll number and name are required');
    }

    // Invisible Normalization Hooks
    roll_no = String(roll_no).trim().toUpperCase();
    const normalizedMobile = mobile ? String(mobile).replace(/\D/g, '') : null;
    const normalizedAadhaar = aadhaar_no ? String(aadhaar_no).replace(/\D/g, '') : null;

    const result = await db.transaction(async (tx) => {
      // 1. Insert into core students table with encrypted mobile
      const [res] = await tx.insert(studentsTable).values({
        admission_no,
        roll_no,
        name,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        gender,
        mobile: normalizedMobile ? encrypt(normalizedMobile) : null,
        mobile_hash: normalizedMobile ? hashForIndex(normalizedMobile) : null,
        email,
        admission_date: admission_date ? new Date(admission_date) : new Date(),
        added_by_clerk_id: clerkId
      });
      const studentId = res.insertId;

      // 2. Insert into personal details with encrypted Aadhaar
      await tx.insert(studentPersonalDetails).values({
        student_id: studentId,
        father_name,
        mother_name,
        religion,
        sub_caste,
        category,
        annual_income,
        aadhaar_no: normalizedAadhaar ? encrypt(normalizedAadhaar) : null,
        aadhaar_hash: normalizedAadhaar ? hashForIndex(normalizedAadhaar) : null,
        address
      });

      // 3. Insert into academic background
      if (qualifying_exam) {
        await tx.insert(studentAcademicBackground).values({
          student_id: studentId,
          qualifying_exam
        });
      }

      return res;
    });

    return result.insertId;
  }
}
