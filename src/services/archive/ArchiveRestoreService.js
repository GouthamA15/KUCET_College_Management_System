import { db } from '@/db';
import {
  students, studentPersonalDetails, studentAcademicBackground,
  studentAttendance, attendanceSessions, studentMarks,
  facultySubjectAssignments,
  archiveStudents, archiveStudentPersonalDetails, archiveStudentAcademicBackground,
  archiveStudentAttendance, archiveAttendanceSessions, archiveStudentMarks, archiveStudentPayments,
  archiveOperationsLog
} from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { ArchiveMediaService } from './ArchiveMediaService';
import { UnifiedAttendanceRepository, normalizeDateStr } from '@/services/attendance/UnifiedAttendanceRepository';
import logger from '@/lib/logger';

/**
 * Archive Restore Service
 * Handles idempotent, transactionally safe restoration of archived student profiles,
 * attendance records, sessions, marks, and payments without generating duplicates or losing IDs.
 */
export class ArchiveRestoreService {
  /**
   * Preview records that will be restored (checks both logical and legacy archive tables).
   */
  static async previewRestore({ type = 'STUDENT', archive_student_id = null, roll_no = null, branch = null, semester = null, academic_year = null }) {
    try {
      if (type === 'STUDENT' && (archive_student_id || roll_no)) {
        const query = archive_student_id
          ? eq(archiveStudents.id, archive_student_id)
          : eq(archiveStudents.roll_no, roll_no);

        const archivedRows = await db.select().from(archiveStudents).where(query).limit(1);
        let studentRecord = archivedRows[0] || null;

        if (!studentRecord) {
          const fallbackQuery = archive_student_id
            ? eq(students.id, archive_student_id)
            : eq(students.roll_no, roll_no);
          const [logicalStudent] = await db.select().from(students).where(and(fallbackQuery, eq(students.is_archived, true))).limit(1);
          if (!logicalStudent) {
            return { found: false, message: 'Archived student not found.' };
          }
          studentRecord = {
            id: logicalStudent.id,
            original_student_id: logicalStudent.id,
            roll_no: logicalStudent.roll_no,
            name: logicalStudent.name,
            branch: null,
            archived_at: logicalStudent.archived_at,
          };
        }

        const targetRoll = studentRecord.roll_no;
        const origId = studentRecord.original_student_id;

        const [personal] = await db
          .select()
          .from(archiveStudentPersonalDetails)
          .where(eq(archiveStudentPersonalDetails.archive_student_id, studentRecord.id));
        const [bg] = await db
          .select()
          .from(archiveStudentAcademicBackground)
          .where(eq(archiveStudentAcademicBackground.archive_student_id, studentRecord.id));

        const [logicalAtt, legacyAtt, marks, payments] = await Promise.all([
          origId
            ? db.select({ id: studentAttendance.id }).from(studentAttendance).where(eq(studentAttendance.student_id, origId))
            : Promise.resolve([]),
          db.select({ id: archiveStudentAttendance.id }).from(archiveStudentAttendance).where(eq(archiveStudentAttendance.roll_no, targetRoll)),
          db.select({ id: archiveStudentMarks.id }).from(archiveStudentMarks).where(eq(archiveStudentMarks.roll_no, targetRoll)),
          db.select({ id: archiveStudentPayments.id }).from(archiveStudentPayments).where(eq(archiveStudentPayments.roll_no, targetRoll)),
        ]);

        return {
          found: true,
          type: 'STUDENT',
          student: studentRecord,
          personal: personal || null,
          background: bg || null,
          counts: {
            attendance: (logicalAtt?.length || 0) + (legacyAtt?.length || 0),
            marks: marks.length,
            payments: payments.length,
          }
        };
      }

      if (type === 'SEMESTER' && branch && semester && academic_year) {
        const assignmentRows = await db
          .select({ id: facultySubjectAssignments.id })
          .from(facultySubjectAssignments)
          .where(
            and(
              eq(facultySubjectAssignments.branch, branch),
              eq(facultySubjectAssignments.course_semester, Number(semester)),
              eq(facultySubjectAssignments.academic_year, academic_year)
            )
          );
        const assignmentIds = assignmentRows.map(a => a.id);

        const [logicalAtt, logicalSess, legacyAtt, legacySess, marks] = await Promise.all([
          assignmentIds.length > 0
            ? db.select({ id: studentAttendance.id }).from(studentAttendance).where(and(inArray(studentAttendance.assignment_id, assignmentIds), eq(studentAttendance.is_archived, true)))
            : Promise.resolve([]),
          assignmentIds.length > 0
            ? db.select({ id: attendanceSessions.id }).from(attendanceSessions).where(and(inArray(attendanceSessions.assignment_id, assignmentIds), eq(attendanceSessions.is_archived, true)))
            : Promise.resolve([]),
          db.select({ id: archiveStudentAttendance.id }).from(archiveStudentAttendance).where(
            and(
              eq(archiveStudentAttendance.branch, branch),
              eq(archiveStudentAttendance.semester, Number(semester)),
              eq(archiveStudentAttendance.academic_year, academic_year)
            )
          ),
          db.select({ id: archiveAttendanceSessions.id }).from(archiveAttendanceSessions).where(
            and(
              eq(archiveAttendanceSessions.branch, branch),
              eq(archiveAttendanceSessions.semester, Number(semester)),
              eq(archiveAttendanceSessions.academic_year, academic_year)
            )
          ),
          db.select({ id: archiveStudentMarks.id }).from(archiveStudentMarks).where(
            and(
              eq(archiveStudentMarks.branch, branch),
              eq(archiveStudentMarks.semester, Number(semester)),
              eq(archiveStudentMarks.academic_year, academic_year)
            )
          ),
        ]);

        const attCount = logicalAtt.length + legacyAtt.length;
        const sessCount = logicalSess.length + legacySess.length;

        return {
          found: attCount > 0 || sessCount > 0 || marks.length > 0,
          type: 'SEMESTER',
          branch,
          semester: Number(semester),
          academic_year,
          counts: {
            attendance: attCount,
            sessions: sessCount,
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
   * Idempotently restore an archived student back to active operational status.
   * Preserves existing student_id and all relational attendance/streak unlock data.
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

      let s = archiveRows[0] || null;
      if (!s) {
        // Fallback: check if archive_student_id refers to an in-place logically archived student
        const [logicalStudent] = await db
          .select()
          .from(students)
          .where(and(eq(students.id, archive_student_id), eq(students.is_archived, true)))
          .limit(1);

        if (!logicalStudent) {
          throw new Error(`Archived student record #${archive_student_id} not found.`);
        }
        s = {
          id: null,
          original_student_id: logicalStudent.id,
          roll_no: logicalStudent.roll_no,
          name: logicalStudent.name,
          email: logicalStudent.email,
          mobile: logicalStudent.mobile,
          fee_reimbursement: logicalStudent.fee_reimbursement,
          branch: null,
          pfp: null,
        };
      }

      let restoredPfp = s.pfp;
      if (s.pfp && s.pfp.startsWith('archive/')) {
        restoredPfp = await ArchiveMediaService.restoreMediaFile(s.pfp, 'uploads/pfp');
      }

      let targetStudentId = null;

      await db.transaction(async (tx) => {
        // Check if student row still exists in `students` (non-destructive model or restore retry)
        const existingStudents = await tx
          .select({ id: students.id })
          .from(students)
          .where(
            s.original_student_id
              ? eq(students.id, s.original_student_id)
              : eq(students.roll_no, s.roll_no)
          )
          .limit(1);

        if (existingStudents.length > 0) {
          targetStudentId = existingStudents[0].id;
          await tx
            .update(students)
            .set({
              academic_status: 'ACTIVE',
              student_status: 'ACTIVE',
              is_archived: false,
              archive_batch_id: null,
              archived_at: null,
            })
            .where(eq(students.id, targetStudentId));

          // Also unarchive logically archived attendance records for this student
          await tx
            .update(studentAttendance)
            .set({
              is_archived: false,
              archive_batch_id: null,
              archived_at: null,
            })
            .where(and(eq(studentAttendance.student_id, targetStudentId), eq(studentAttendance.is_archived, true)));
        } else {
          // Legacy fallback: student was physically deleted under older code
          const [insertedStudent] = await tx.insert(students).values({
            roll_no: s.roll_no,
            name: s.name,
            email: s.email,
            mobile: s.mobile,
            academic_status: 'ACTIVE',
            student_status: 'ACTIVE',
            is_archived: false,
            fee_reimbursement: s.fee_reimbursement || 'NO',
            created_at: new Date(),
          });
          targetStudentId = insertedStudent.insertId;

          const personalRows = s.id
            ? await tx.select().from(archiveStudentPersonalDetails).where(eq(archiveStudentPersonalDetails.archive_student_id, s.id))
            : [];

          for (const pd of personalRows) {
            let restoredSig = pd.signature_path;
            if (pd.signature_path && pd.signature_path.startsWith('archive/')) {
              restoredSig = await ArchiveMediaService.restoreMediaFile(pd.signature_path, 'uploads/signatures');
            }
            await tx.insert(studentPersonalDetails).values({
              student_id: targetStudentId,
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

          const bgRows = s.id
            ? await tx.select().from(archiveStudentAcademicBackground).where(eq(archiveStudentAcademicBackground.archive_student_id, s.id))
            : [];

          for (const bg of bgRows) {
            await tx.insert(studentAcademicBackground).values({
              student_id: targetStudentId,
              ssc_school: bg.ssc_school,
              ssc_gpa: bg.ssc_gpa,
              inter_college: bg.inter_college,
              inter_gpa: bg.inter_gpa,
            });
          }
        }

        if (s.id) {
          await tx.delete(archiveStudentPersonalDetails).where(eq(archiveStudentPersonalDetails.archive_student_id, s.id));
          await tx.delete(archiveStudentAcademicBackground).where(eq(archiveStudentAcademicBackground.archive_student_id, s.id));
          await tx.delete(archiveStudents).where(eq(archiveStudents.id, s.id));
        }

        await UnifiedAttendanceRepository.invalidateStreakSnapshots([targetStudentId], tx);

        await tx.insert(archiveOperationsLog).values({
          job_id: jobId,
          archive_type: 'RESTORE',
          branch: s.branch,
          affected_students_count: 1,
          affected_records_count: 1,
          affected_media_count: restoredPfp ? 1 : 0,
          storage_size_bytes: 0,
          archived_by: restored_by,
          execution_time_ms: Date.now() - startTime,
          status: 'RESTORED',
          details: JSON.stringify({ roll_no: s.roll_no, newStudentId: targetStudentId, reason }),
        });
      });

      const executionTimeMs = Date.now() - startTime;

      try {
        const { EventBus, DOMAIN_EVENTS } = await import('@/lib/events/EventBus');
        EventBus.publish(DOMAIN_EVENTS.STUDENT_RESTORED, {
          archive_student_id,
          roll_no: s.roll_no,
          student_id: targetStudentId,
          restored_by
        });
      } catch (ebErr) {
        logger.warn({ err: ebErr }, '[EventBus] Student restored publish failed');
      }

      return {
        success: true,
        jobId,
        roll_no: s.roll_no,
        newStudentId: targetStudentId,
        executionTimeMs,
        message: `Student ${s.name} (${s.roll_no}) successfully restored to active student database.`,
      };
    } catch (error) {
      logger.error({ archive_student_id, err: error.message }, '[RESTORE_STUDENT_ERROR]');
      throw new Error(`Failed to restore student: ${error.message}`);
    }
  }

  /**
   * Idempotently restore archived semester academic records (logical unarchive + legacy physical restore).
   * Preserves all status values ('PRESENT', 'ABSENT', 'NCC', 'MEDICAL') and prevents duplicate insertions.
   */
  static async restoreAcademicRecords({ branch, semester, academic_year, restored_by = 'ADMIN', reason = 'Semester restoration' }) {
    const startTime = Date.now();
    const jobId = `JOB-RST-SEM-${Date.now()}`;

    try {
      let recordsRestored = 0;
      const affectedStudentIds = new Set();

      const assignmentRows = await db
        .select({ id: facultySubjectAssignments.id })
        .from(facultySubjectAssignments)
        .where(
          and(
            eq(facultySubjectAssignments.branch, branch),
            eq(facultySubjectAssignments.course_semester, Number(semester)),
            eq(facultySubjectAssignments.academic_year, academic_year)
          )
        );
      const assignmentIds = assignmentRows.map(a => a.id);

      await db.transaction(async (tx) => {
        // 1. Unmark logically archived records in-place (primary path)
        if (assignmentIds.length > 0) {
          const { attendanceRestored, sessionsRestored } = await UnifiedAttendanceRepository.unmarkSemesterArchived({
            assignmentIds,
            tx,
          });
          recordsRestored += attendanceRestored + sessionsRestored;
        }

        // 2. Restore any legacy rows from archive_attendance_sessions (sessions FIRST so session_id can be linked)
        const archivedSessions = await tx
          .select()
          .from(archiveAttendanceSessions)
          .where(
            and(
              eq(archiveAttendanceSessions.branch, branch),
              eq(archiveAttendanceSessions.semester, Number(semester)),
              eq(archiveAttendanceSessions.academic_year, academic_year)
            )
          );

        const sessionSlotToId = new Map();
        for (const row of archivedSessions) {
          const dateStr = normalizeDateStr(row.date);
          const sessionNum = row.session || 1;
          const batchNum = row.batch_number ?? 0;

          await tx
            .insert(attendanceSessions)
            .values({
              assignment_id: row.assignment_id,
              attendance_date: row.date,
              faculty_id: row.faculty_id || 0,
              session_pin: '0000',
              session_token: `RESTORED-${row.id}-${Date.now()}`,
              is_active: false,
              is_archived: false,
              expires_at: row.created_at || new Date(),
              submitted_at: row.submitted_at || row.created_at || new Date(),
              session_number: sessionNum,
              batch_number: batchNum,
              topic_covered: row.topic_covered,
              total_students: row.total_students || 0,
              present_count: row.present_count || 0,
              absent_count: row.absent_count || 0,
              created_at: row.created_at || new Date(),
            })
            .onDuplicateKeyUpdate({
              set: {
                is_archived: false,
                topic_covered: sql`COALESCE(VALUES(topic_covered), ${attendanceSessions.topic_covered})`,
              },
            });

          const [resolvedSess] = await tx
            .select({ id: attendanceSessions.id })
            .from(attendanceSessions)
            .where(
              and(
                eq(attendanceSessions.assignment_id, row.assignment_id),
                eq(attendanceSessions.attendance_date, row.date),
                eq(attendanceSessions.session_number, sessionNum),
                eq(attendanceSessions.batch_number, batchNum)
              )
            )
            .limit(1);

          if (resolvedSess?.id) {
            sessionSlotToId.set(`${row.assignment_id}_${dateStr}_${sessionNum}`, resolvedSess.id);
          }
        }

        if (archivedSessions.length > 0) {
          const sessionIds = archivedSessions.map(r => r.id);
          await tx.delete(archiveAttendanceSessions).where(inArray(archiveAttendanceSessions.id, sessionIds));
          recordsRestored += archivedSessions.length;
        }

        // 3. Restore any legacy rows from archive_student_attendance idempotently
        const archivedAtt = await tx
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
          const attEntries = archivedAtt.map(row => {
            const dateStr = normalizeDateStr(row.date);
            const resolvedSessionId =
              row.session_id ||
              sessionSlotToId.get(`${row.assignment_id}_${dateStr}_${row.session}`) ||
              null;
            // Preserve valid operational statuses; map legacy 'EXEMPTED' only if encountered
            const mappedStatus = row.status === 'EXEMPTED' ? 'MEDICAL' : row.status;
            affectedStudentIds.add(row.student_id);

            return {
              session_id: resolvedSessionId,
              student_id: row.student_id,
              assignment_id: row.assignment_id,
              date: row.date,
              session: row.session,
              status: mappedStatus,
              is_archived: false,
              submitted_at: row.created_at || new Date(),
              created_at: row.created_at || new Date(),
            };
          });

          await tx
            .insert(studentAttendance)
            .values(attEntries)
            .onDuplicateKeyUpdate({
              set: {
                is_archived: false,
                archive_batch_id: null,
                archived_at: null,
              },
            });

          const attIds = archivedAtt.map(r => r.id);
          await tx.delete(archiveStudentAttendance).where(inArray(archiveStudentAttendance.id, attIds));
          recordsRestored += archivedAtt.length;
        }

        // 4. Restore Marks idempotently
        const archivedMarks = await tx
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

          await tx
            .insert(studentMarks)
            .values(markEntries)
            .onDuplicateKeyUpdate({
              set: {
                is_published: sql`VALUES(is_published)`,
              },
            });

          const markIds = archivedMarks.map(r => r.id);
          await tx.delete(archiveStudentMarks).where(inArray(archiveStudentMarks.id, markIds));
          recordsRestored += archivedMarks.length;
        }

        if (affectedStudentIds.size > 0) {
          await UnifiedAttendanceRepository.invalidateStreakSnapshots(Array.from(affectedStudentIds), tx);
        }

        await tx.insert(archiveOperationsLog).values({
          job_id: jobId,
          archive_type: 'RESTORE',
          branch,
          semester: Number(semester),
          academic_year,
          affected_students_count: affectedStudentIds.size,
          affected_records_count: recordsRestored,
          affected_media_count: 0,
          storage_size_bytes: 0,
          archived_by: restored_by,
          execution_time_ms: Date.now() - startTime,
          status: 'RESTORED',
          details: JSON.stringify({ reason, branch, semester, academic_year }),
        });
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        jobId,
        recordsRestored,
        executionTimeMs,
        message: `Academic records for ${branch} Sem-${semester} (${academic_year}) successfully restored to active status.`,
      };
    } catch (error) {
      logger.error({ branch, semester, academic_year, err: error.message }, '[RESTORE_ACADEMIC_RECORDS_ERROR]');
      throw new Error(`Failed to restore academic records: ${error.message}`);
    }
  }
}
