import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground 
} from '@/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { encrypt, hashForIndex } from '@/lib/encryption';

/**
 * Service for Student-related business logic
 */
export class StudentService {
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
   * Create a new student with personal and academic details
   * @param {Object} data Student data
   * @param {number} clerkId ID of the clerk adding the student
   * @returns {Promise<number>} ID of the created student
   */
  static async createStudent(data, clerkId) {
    const {
      admission_no, roll_no, name, date_of_birth, gender, mobile, email,
      father_name, mother_name, religion, sub_caste, category, address,
      qualifying_exam, aadhaar_no
    } = data;

    if (!roll_no || !name) {
      throw new Error('Roll number and name are required');
    }

    const result = await db.transaction(async (tx) => {
      // 1. Insert into core students table with encrypted mobile
      const [res] = await tx.insert(studentsTable).values({
        admission_no,
        roll_no,
        name,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        gender,
        mobile: encrypt(mobile),
        mobile_hash: hashForIndex(mobile),
        email,
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
        aadhaar_no: aadhaar_no ? encrypt(aadhaar_no) : null,
        aadhaar_hash: aadhaar_no ? hashForIndex(aadhaar_no) : null,
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
