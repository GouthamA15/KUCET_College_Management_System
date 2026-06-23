import { db } from '@/db';
import { 
  students, 
  clerks, 
  _branchConfig, 
  branchTimetable, 
  facultySubjectAssignments, 
  syllabusStructure,
  studentMarks,
  facultySubjectInterests,
  studentAdmissionDrafts
} from '@/db/schema';
import { eq, or, like, sql, and } from 'drizzle-orm';
import { branchCodes } from '@/lib/rollNumber';

/**
 * Service for cross-module validation and referential integrity checks
 */
export class ValidationService {
  /**
   * Check if a branch has active dependencies that prevent deletion
   * @param {string} branchName The name of the branch (e.g., 'CSE')
   * @returns {Promise<{ canDelete: boolean, reason: string | null }>}
   */
  static async checkBranchDependencies(branchName) {
    // 1. Get branch code for roll number matching
    const branchCode = Object.keys(branchCodes).find(code => branchCodes[code] === branchName);
    
    // 2. Count Students
    let studentCount = 0;
    if (branchCode) {
      const regularPattern = `%567T${branchCode}%`;
      const lateralPattern = `%567${branchCode}%L`;
      const studentRows = await db.select({ count: sql`count(*)` })
        .from(students)
        .where(or(
          like(students.roll_no, regularPattern),
          like(students.roll_no, lateralPattern)
        ));
      studentCount = Number(studentRows[0]?.count || 0);
    }

    if (studentCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${studentCount} students are still assigned to this branch.` };
    }

    // 3. Count Clerks/Faculty
    const clerkRows = await db.select({ count: sql`count(*)` })
      .from(clerks)
      .where(eq(clerks.branch, branchName));
    const clerkCount = Number(clerkRows[0]?.count || 0);
    if (clerkCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${clerkCount} staff members are still assigned to this branch.` };
    }

    // 4. Count Timetable Slots
    const timetableRows = await db.select({ count: sql`count(*)` })
      .from(branchTimetable)
      .where(eq(branchTimetable.branch, branchName));
    const timetableCount = Number(timetableRows[0]?.count || 0);
    if (timetableCount > 0) {
      return { canDelete: false, reason: `Cannot delete: This branch still has ${timetableCount} entries in the timetable.` };
    }

    // 5. Count Subject Assignments
    const assignmentRows = await db.select({ count: sql`count(*)` })
      .from(facultySubjectAssignments)
      .where(eq(facultySubjectAssignments.branch, branchName));
    const assignmentCount = Number(assignmentRows[0]?.count || 0);
    if (assignmentCount > 0) {
      return { canDelete: false, reason: `Cannot delete: This branch still has ${assignmentCount} faculty subject assignments.` };
    }

    // 6. Check Admission Drafts
    const draftRows = await db.select({ count: sql`count(*)` })
      .from(studentAdmissionDrafts)
      .where(eq(studentAdmissionDrafts.branch, branchName));
    const draftCount = Number(draftRows[0]?.count || 0);
    if (draftCount > 0) {
      return { canDelete: false, reason: `Cannot delete: There are ${draftCount} pending admission drafts for this branch.` };
    }

    // 7. Check Certificate Verifications Archive
    const { certificateVerificationsArchive, studentRequests } = await import('@/db/schema');
    const archiveRows = await db.select({ count: sql`count(*)` })
      .from(certificateVerificationsArchive)
      .innerJoin(studentRequests, eq(certificateVerificationsArchive.request_id, studentRequests.request_id))
      .innerJoin(students, eq(studentRequests.student_id, students.id))
      .where(or(
        like(students.roll_no, `%567T${branchCode}%`),
        like(students.roll_no, `%567${branchCode}%L`)
      ));
    const archiveCount = Number(archiveRows[0]?.count || 0);
    if (archiveCount > 0) {
      return { canDelete: false, reason: `Cannot delete: There are ${archiveCount} archived certificate verifications linked to this branch.` };
    }

    return { canDelete: true, reason: null };
  }

  /**
   * Check if a subject has active dependencies that prevent deletion
   * @param {string} subjectCode The subject code
   * @returns {Promise<{ canDelete: boolean, reason: string | null }>}
   */
  static async checkSubjectDependencies(subjectCode) {
    // 1. Count Marks
    const markRows = await db.select({ count: sql`count(*)` })
      .from(studentMarks)
      .innerJoin(facultySubjectAssignments, eq(studentMarks.assignment_id, facultySubjectAssignments.id))
      .where(eq(facultySubjectAssignments.subject_code, subjectCode));
    const markCount = Number(markRows[0]?.count || 0);
    if (markCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${markCount} student mark records exist for this subject.` };
    }

    // 2. Count Timetable Slots
    const timetableRows = await db.select({ count: sql`count(*)` })
      .from(branchTimetable)
      .where(eq(branchTimetable.subject_code, subjectCode));
    const timetableCount = Number(timetableRows[0]?.count || 0);
    if (timetableCount > 0) {
      return { canDelete: false, reason: `Cannot delete: This subject is still scheduled in ${timetableCount} timetable slots.` };
    }

    // 3. Count Subject Assignments
    const assignmentRows = await db.select({ count: sql`count(*)` })
      .from(facultySubjectAssignments)
      .where(eq(facultySubjectAssignments.subject_code, subjectCode));
    const assignmentCount = Number(assignmentRows[0]?.count || 0);
    if (assignmentCount > 0) {
      return { canDelete: false, reason: `Cannot delete: This subject is still assigned to ${assignmentCount} faculty members.` };
    }

    // 4. Count Syllabus Mappings
    const structureRows = await db.select({ count: sql`count(*)` })
      .from(syllabusStructure)
      .where(eq(syllabusStructure.subject_code, subjectCode));
    const structureCount = Number(structureRows[0]?.count || 0);
    if (structureCount > 0) {
      return { canDelete: false, reason: `Cannot delete: This subject is part of the syllabus structure for ${structureCount} branches/semesters.` };
    }

    // 5. Count Interests
    const interestRows = await db.select({ count: sql`count(*)` })
      .from(facultySubjectInterests)
      .where(eq(facultySubjectInterests.subject_code, subjectCode));
    const interestCount = Number(interestRows[0]?.count || 0);
    if (interestCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${interestCount} faculty members have expressed interest in this subject.` };
    }

    return { canDelete: true, reason: null };
  }

  /**
   * Check if a subject has branch-specific dependencies that prevent deletion from that branch
   * @param {string} subjectCode The subject code
   * @param {string} branch The branch name
   * @returns {Promise<{ canDelete: boolean, reason: string | null }>}
   */
  static async checkSubjectBranchDependencies(subjectCode, branch) {
    // 1. Count Marks for this branch
    const markRows = await db.select({ count: sql`count(*)` })
      .from(studentMarks)
      .innerJoin(facultySubjectAssignments, eq(studentMarks.assignment_id, facultySubjectAssignments.id))
      .where(and(
        eq(facultySubjectAssignments.subject_code, subjectCode),
        eq(facultySubjectAssignments.branch, branch)
      ));
    const markCount = Number(markRows[0]?.count || 0);
    if (markCount > 0) {
      return { canDelete: false, reason: `Cannot remove: ${markCount} student marks are already recorded for this subject in ${branch}.` };
    }

    // 2. Count Timetable Slots for this branch
    const timetableRows = await db.select({ count: sql`count(*)` })
      .from(branchTimetable)
      .where(and(
        eq(branchTimetable.subject_code, subjectCode),
        eq(branchTimetable.branch, branch)
      ));
    const timetableCount = Number(timetableRows[0]?.count || 0);
    if (timetableCount > 0) {
      return { canDelete: false, reason: `Cannot remove: This subject is still scheduled in ${timetableCount} timetable slots for ${branch}.` };
    }

    // 3. Count Subject Assignments for this branch
    const assignmentRows = await db.select({ count: sql`count(*)` })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subjectCode),
        eq(facultySubjectAssignments.branch, branch)
      ));
    const assignmentCount = Number(assignmentRows[0]?.count || 0);
    if (assignmentCount > 0) {
      return { canDelete: false, reason: `Cannot remove: This subject is still assigned to faculty in ${branch}.` };
    }

    return { canDelete: true, reason: null };
  }
}
