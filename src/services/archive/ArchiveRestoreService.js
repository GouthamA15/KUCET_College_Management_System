import { db } from '@/db';
import { 
  students, studentPersonalDetails, studentAcademicBackground,
  studentAttendance, attendanceSessions, studentMarks, studentFeePayments,
  archiveStudents, archiveStudentPersonalDetails, archiveStudentAcademicBackground,
  archiveStudentAttendance, archiveAttendanceSessions, archiveStudentMarks, archiveStudentPayments,
  archiveOperationsLog
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ArchiveMediaService } from './ArchiveMediaService';
import logger from '@/lib/logger';

/**
 * Archive Restore Service
 * Handles restoration of archived student profiles, attendance records, marks, and payments
 * back into operational tables without manual SQL.
 */
export class ArchiveRestoreService {
  /**
   * Preview records that will be restored
   */
  static async previewRestore({ type = 'STUDENT', archive_student_id = null, roll_no = null, branch = null, semester = null, academic_year = null }) {
    try {
      if (type === 'STUDENT' && (archive_student_id || roll_no)) {
        const query = archive_student_id 
          ? eq(archiveStudents.id, archive_student_id)
          : eq(archiveStudents.roll_no, roll_no);

        const student = await db.select().from(archiveStudents).where(query).limit(1);
        if (student.length === 0) return { found: false, message: 'Archived student not found.' };

        const targetRoll = student[0].roll_no;
        const [personal] = await db.select().from(archiveStudentPersonalDetails).where(eq(archiveStudentPersonalDetails.archive_student_id, student[0].id));
        const [bg] = await db.select().from(archiveStudentAcademicBackground).where(eq(archiveStudentAcademicBackground.archive_student_id, student[0].id));
        const att = await db.select().from(archiveStudentAttendance).where(eq(archiveStudentAttendance.roll_no, targetRoll));
        const marks = await db.select().from(archiveStudentMarks).where(eq(archiveStudentMarks.roll_no, targetRoll));
        const payments = await db.select().from(archiveStudentPayments).where(eq(archiveStudentPayments.roll_no, targetRoll));

        return {
          found: true,
          type: 'STUDENT',
          student: student[0],
          personal: personal || null,
          background: bg || null,
          counts: {
            attendance: att.length,
            marks: marks.length,
            payments: payments.length,
          }
        };
      }

      if (type === 'SEMESTER' && branch && semester && academic_year) {
        const att = await db.select().from(archiveStudentAttendance).where(
          and(
            eq(archiveStudentAttendance.branch, branch),
            eq(archiveStudentAttendance.semester, Number(semester)),
            eq(archiveStudentAttendance.academic_year, academic_year)
          )
        );
        const sessions = await db.select().from(archiveAttendanceSessions).where(
          and(
            eq(archiveAttendanceSessions.branch, branch),
            eq(archiveAttendanceSessions.semester, Number(semester)),
            eq(archiveAttendanceSessions.academic_year, academic_year)
          )
        );
        const marks = await db.select().from(archiveStudentMarks).where(
          and(
            eq(archiveStudentMarks.branch, branch),
            eq(archiveStudentMarks.semester, Number(semester)),
            eq(archiveStudentMarks.academic_year, academic_year)
          )
        );

        return {
          found: att.length > 0 || sessions.length > 0 || marks.length > 0,
          type: 'SEMESTER',
          branch,
          semester: Number(semester),
          academic_year,
          counts: {
            attendance: att.length,
            sessions: sessions.length,
            marks: marks.length,
          }
        };
      }

      return { found: false, message: 'Invalid restore preview criteria.' };
    } catch (error) {
      logger.error({ err: error.message }, '[PREVIEW_RESTORE_ERROR]');
      throw new Error(`Failed to preview archive restoration: ${error.message}`);
    }
  }

  /**
   * Restore an archived student back to operational database
   */
  static async restoreStudent({ archive_student_id, restored_by = 'ADMIN', reason = 'Admin restoration' }) {
    const startTime = Date.now();
    const jobId = `JOB-RST-STU-${Date.now()}`;

    try {
      const archiveRows = await db
        .select()
        .from(archiveStudents)
        .where(eq(archiveStudents.id, archive_student_id))
        .limit(1);

      if (archiveRows.length === 0) {
        throw new Error(`Archived student record #${archive_student_id} not found.`);
      }

      const s = archiveRows[0];

      // Restore profile picture if archived
      let restoredPfp = s.pfp;
      if (s.pfp && s.pfp.startsWith('archive/')) {
        restoredPfp = await ArchiveMediaService.restoreMediaFile(s.pfp, 'uploads/pfp');
      }

      // Re-insert into operational students table
      const [insertedStudent] = await db.insert(students).values({
        roll_no: s.roll_no,
        name: s.name,
        email: s.email,
        mobile: s.mobile,
        academic_status: 'ACTIVE',
        student_status: 'ACTIVE',
        fee_reimbursement: s.fee_reimbursement || 'NO',
        pfp: restoredPfp,
        created_at: new Date(),
      });

      const newStudentId = insertedStudent.insertId;

      // Restore Personal Details
      const personalRows = await db
        .select()
        .from(archiveStudentPersonalDetails)
        .where(eq(archiveStudentPersonalDetails.archive_student_id, archive_student_id));

      if (personalRows.length > 0) {
        for (const pd of personalRows) {
          let restoredSig = pd.signature_path;
          if (pd.signature_path && pd.signature_path.startsWith('archive/')) {
            restoredSig = await ArchiveMediaService.restoreMediaFile(pd.signature_path, 'uploads/signatures');
          }

          await db.insert(studentPersonalDetails).values({
            student_id: newStudentId,
            father_name: pd.father_name,
            mother_name: pd.mother_name,
            dob: pd.dob,
            category: pd.category,
            sub_caste: pd.sub_caste,
            gender: pd.gender,
            aadhaar_no: pd.aadhaar_no,
            guardian_mobile: pd.guardian_mobile,
            permanent_address: pd.permanent_address,
            signature_path: restoredSig,
          });
        }
        await db.delete(archiveStudentPersonalDetails).where(eq(archiveStudentPersonalDetails.archive_student_id, archive_student_id));
      }

      // Restore Academic Background
      const bgRows = await db
        .select()
        .from(archiveStudentAcademicBackground)
        .where(eq(archiveStudentAcademicBackground.archive_student_id, archive_student_id));

      if (bgRows.length > 0) {
        for (const bg of bgRows) {
          await db.insert(studentAcademicBackground).values({
            student_id: newStudentId,
            ssc_school: bg.ssc_school,
            ssc_gpa: bg.ssc_gpa,
            inter_college: bg.inter_college,
            inter_gpa: bg.inter_gpa,
          });
        }
        await db.delete(archiveStudentAcademicBackground).where(eq(archiveStudentAcademicBackground.archive_student_id, archive_student_id));
      }

      // Delete from archive_students
      await db.delete(archiveStudents).where(eq(archiveStudents.id, archive_student_id));

      const executionTimeMs = Date.now() - startTime;

      await db.insert(archiveOperationsLog).values({
        job_id: jobId,
        archive_type: 'RESTORE',
        branch: s.branch,
        affected_students_count: 1,
        affected_records_count: 1,
        affected_media_count: s.pfp ? 1 : 0,
        storage_size_bytes: 0,
        archived_by: restored_by,
        execution_time_ms: executionTimeMs,
        status: 'RESTORED',
        details: JSON.stringify({ roll_no: s.roll_no, newStudentId, reason }),
      });

      return {
        success: true,
        jobId,
        roll_no: s.roll_no,
        newStudentId,
        executionTimeMs,
        message: `Student ${s.name} (${s.roll_no}) successfully restored to active student database.`,
      };
    } catch (error) {
      logger.error({ archive_student_id, err: error.message }, '[RESTORE_STUDENT_ERROR]');
      throw new Error(`Failed to restore student: ${error.message}`);
    }
  }

  /**
   * Restore archived semester academic records (attendance, sessions, marks)
   */
  static async restoreAcademicRecords({ branch, semester, academic_year, restored_by = 'ADMIN', reason = 'Semester restoration' }) {
    const startTime = Date.now();
    const jobId = `JOB-RST-SEM-${Date.now()}`;

    try {
      let recordsRestored = 0;

      // 1. Restore Attendance
      const archivedAtt = await db
        .select()
        .from(archiveStudentAttendance)
        .where(
          and(
            eq(archiveStudentAttendance.branch, branch),
            eq(archiveStudentAttendance.semester, Number(semester)),
            eq(archiveStudentAttendance.academic_year, academic_year)
          )
        );

      if (archivedAtt.length > 0) {
        const attEntries = archivedAtt.map(row => ({
          student_id: row.student_id,
          assignment_id: row.assignment_id,
          date: row.date,
          session: row.session,
          status: row.status,
          created_at: row.created_at || new Date(),
        }));

        await db.insert(studentAttendance).values(attEntries);
        const attIds = archivedAtt.map(r => r.id);
        await db.delete(archiveStudentAttendance).where(inArray(archiveStudentAttendance.id, attIds));
        recordsRestored += archivedAtt.length;
      }

      // 2. Restore Sessions
      const archivedSessions = await db
        .select()
        .from(archiveAttendanceSessions)
        .where(
          and(
            eq(archiveAttendanceSessions.branch, branch),
            eq(archiveAttendanceSessions.semester, Number(semester)),
            eq(archiveAttendanceSessions.academic_year, academic_year)
          )
        );

      if (archivedSessions.length > 0) {
        const sessionEntries = archivedSessions.map(row => ({
          assignment_id: row.assignment_id,
          attendance_date: row.date,
          faculty_id: row.faculty_id || 0,
          session_pin: '0000',
          session_token: `RESTORED-${row.id}-${Date.now()}`,
          is_active: false,
          expires_at: row.created_at || new Date(),
          session_number: row.session || 1,
          topic_covered: row.topic_covered,
          created_at: row.created_at || new Date(),
        }));

        await db.insert(attendanceSessions).values(sessionEntries);
        const sessionIds = archivedSessions.map(r => r.id);
        await db.delete(archiveAttendanceSessions).where(inArray(archiveAttendanceSessions.id, sessionIds));
        recordsRestored += archivedSessions.length;
      }

      // 3. Restore Marks
      const archivedMarks = await db
        .select()
        .from(archiveStudentMarks)
        .where(
          and(
            eq(archiveStudentMarks.branch, branch),
            eq(archiveStudentMarks.semester, Number(semester)),
            eq(archiveStudentMarks.academic_year, academic_year)
          )
        );

      if (archivedMarks.length > 0) {
        const markEntries = archivedMarks.map(row => ({
          student_id: row.student_id,
          assignment_id: row.assignment_id,
          mid1_marks: row.mid1_marks,
          mid2_marks: row.mid2_marks,
          assignment_marks: row.assignment_marks,
          lab_theory_marks: row.lab_theory_marks,
          lab_execution_marks: row.lab_execution_marks,
          lab_record_marks: row.lab_record_marks,
          is_published: row.is_published,
          created_at: row.created_at || new Date(),
        }));

        await db.insert(studentMarks).values(markEntries);
        const markIds = archivedMarks.map(r => r.id);
        await db.delete(archiveStudentMarks).where(inArray(archiveStudentMarks.id, markIds));
        recordsRestored += archivedMarks.length;
      }

      const executionTimeMs = Date.now() - startTime;

      await db.insert(archiveOperationsLog).values({
        job_id: jobId,
        archive_type: 'RESTORE',
        branch,
        semester: Number(semester),
        academic_year,
        affected_students_count: 0,
        affected_records_count: recordsRestored,
        affected_media_count: 0,
        storage_size_bytes: 0,
        archived_by: restored_by,
        execution_time_ms: executionTimeMs,
        status: 'RESTORED',
        details: JSON.stringify({ reason, branch, semester, academic_year }),
      });

      return {
        success: true,
        jobId,
        recordsRestored,
        executionTimeMs,
        message: `Academic records for ${branch} Sem-${semester} (${academic_year}) successfully restored to active database.`,
      };
    } catch (error) {
      logger.error({ branch, semester, academic_year, err: error.message }, '[RESTORE_ACADEMIC_RECORDS_ERROR]');
      throw new Error(`Failed to restore academic records: ${error.message}`);
    }
  }
}
