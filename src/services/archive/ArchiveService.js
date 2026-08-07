import { db } from '@/db';
import { 
  students, studentPersonalDetails, studentAcademicBackground,
  studentAttendance, attendanceSessions, studentMarks, studentFeePayments,
  facultySubjectAssignments,
  archiveStudents, archiveStudentPersonalDetails, archiveStudentAcademicBackground,
  archiveStudentAttendance, archiveAttendanceSessions, archiveStudentMarks, archiveStudentPayments,
  archiveOperationsLog, archiveRetentionPolicies
} from '@/db/schema';
import { eq, and, inArray, count, sql, like, or, desc } from 'drizzle-orm';
import { ArchiveMediaService } from './ArchiveMediaService';
import logger from '@/lib/logger';
import { getBranchFromRoll, branchCodes } from '@/lib/rollNumber';

/**
 * Archive Service
 * Domain service managing institutional semester archival, alumni graduation archival,
 * retention policy enforcement, and archive operational reporting.
 */
export class ArchiveService {
  /**
   * Get high-level executive archive statistics & system overview
   */
  static async getArchiveOverview() {
    try {
      // 1. Active vs Archived Students Count
      const [[activeStudentsRes], [archivedStudentsRes]] = await Promise.all([
        db.select({ count: count() }).from(students),
        db.select({ count: count() }).from(archiveStudents),
      ]);

      const activeStudentsCount = activeStudentsRes?.count || 0;
      const archivedStudentsCount = archivedStudentsRes?.count || 0;

      // 2. Active vs Archived Records
      const [[activeAttRes], [archivedAttRes], [activeMarksRes], [archivedMarksRes], [activePayRes], [archivedPayRes]] = await Promise.all([
        db.select({ count: count() }).from(studentAttendance),
        db.select({ count: count() }).from(archiveStudentAttendance),
        db.select({ count: count() }).from(studentMarks),
        db.select({ count: count() }).from(archiveStudentMarks),
        db.select({ count: count() }).from(studentFeePayments),
        db.select({ count: count() }).from(archiveStudentPayments),
      ]);

      const totalActiveRecords = (activeAttRes?.count || 0) + (activeMarksRes?.count || 0) + (activePayRes?.count || 0);
      const totalArchivedRecords = (archivedAttRes?.count || 0) + (archivedMarksRes?.count || 0) + (archivedPayRes?.count || 0);

      // 3. Operational Log Metrics
      const [logMetrics] = await db
        .select({
          totalJobs: count(),
          totalSize: sql`COALESCE(SUM(storage_size_bytes), 0)`,
          totalAffectedRecords: sql`COALESCE(SUM(affected_records_count), 0)`,
          totalAffectedMedia: sql`COALESCE(SUM(affected_media_count), 0)`,
        })
        .from(archiveOperationsLog);

      // 4. Last Executed Job
      const lastJob = await db
        .select()
        .from(archiveOperationsLog)
        .orderBy(desc(archiveOperationsLog.created_at))
        .limit(1);

      // 5. Retention Policies
      const policies = await db.select().from(archiveRetentionPolicies);

      return {
        metrics: {
          activeStudents: activeStudentsCount,
          archivedStudents: archivedStudentsCount,
          activeRecords: totalActiveRecords,
          archivedRecords: totalArchivedRecords,
          totalStorageSizeBytes: Number(logMetrics?.totalSize || 0),
          totalCompletedJobs: Number(logMetrics?.totalJobs || 0),
          totalAffectedRecords: Number(logMetrics?.totalAffectedRecords || 0),
          totalAffectedMediaCount: Number(logMetrics?.totalAffectedMedia || 0),
        },
        lastArchivalJob: lastJob[0] || null,
        retentionPolicies: policies || [],
      };
    } catch (error) {
      logger.error(error, '[ARCHIVE_OVERVIEW_ERROR]');
      throw error;
    }
  }

  /**
   * Run a semester data archival job for closed semesters
   */
  static async runSemesterArchive({ branch, semester, academic_year, archived_by = 'SYSTEM', reason = 'Semester closure' }) {
    const startTime = Date.now();
    const jobId = `JOB-SEM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      logger.info({ jobId, branch, semester, academic_year, archived_by }, '[START_SEMESTER_ARCHIVE]');

      let recordsArchived = 0;
      let mediaArchived = 0;
      let storageSizeBytes = 0;

      // 0. Find matching assignment IDs for the branch, semester, and academic_year
      const assignmentConditions = [
        eq(facultySubjectAssignments.course_semester, Number(semester)),
        eq(facultySubjectAssignments.academic_year, academic_year),
      ];
      if (branch) {
        assignmentConditions.push(eq(facultySubjectAssignments.branch, branch));
      }

      const matchingAssignments = await db
        .select({
          id: facultySubjectAssignments.id,
          branch: facultySubjectAssignments.branch,
          course_semester: facultySubjectAssignments.course_semester,
          subject_code: facultySubjectAssignments.subject_code,
          academic_year: facultySubjectAssignments.academic_year,
        })
        .from(facultySubjectAssignments)
        .where(and(...assignmentConditions));

      const assignmentMap = new Map();
      matchingAssignments.forEach(a => assignmentMap.set(a.id, a));
      const assignmentIds = matchingAssignments.map(a => a.id);

      await db.transaction(async (tx) => {
        if (assignmentIds.length > 0) {
          // 1. Move Attendance Records
          const attendanceRows = await tx
            .select({
              id: studentAttendance.id,
              student_id: studentAttendance.student_id,
              assignment_id: studentAttendance.assignment_id,
              date: studentAttendance.date,
              session: studentAttendance.session,
              status: studentAttendance.status,
              created_at: studentAttendance.created_at,
              roll_no: students.roll_no,
            })
            .from(studentAttendance)
            .leftJoin(students, eq(studentAttendance.student_id, students.id))
            .where(inArray(studentAttendance.assignment_id, assignmentIds));

          if (attendanceRows.length > 0) {
            const archiveAttEntries = attendanceRows.map(row => {
              const assignment = assignmentMap.get(row.assignment_id) || {};
              return {
                original_attendance_id: row.id,
                student_id: row.student_id,
                roll_no: row.roll_no || 'UNKNOWN',
                assignment_id: row.assignment_id,
                branch: assignment.branch || branch || 'CSE',
                semester: assignment.course_semester || Number(semester),
                academic_year: assignment.academic_year || academic_year,
                date: row.date,
                session: row.session,
                status: row.status,
                topic_covered: null,
                archived_at: new Date(),
              };
            });

            await tx.insert(archiveStudentAttendance).values(archiveAttEntries);
            const attIds = attendanceRows.map(r => r.id);
            await tx.delete(studentAttendance).where(inArray(studentAttendance.id, attIds));
            recordsArchived += attendanceRows.length;
          }

          // 2. Move Attendance Sessions
          const sessionRows = await tx
            .select()
            .from(attendanceSessions)
            .where(inArray(attendanceSessions.assignment_id, assignmentIds));

          if (sessionRows.length > 0) {
            const archiveSessEntries = sessionRows.map(row => {
              const assignment = assignmentMap.get(row.assignment_id) || {};
              return {
                original_session_id: row.id,
                assignment_id: row.assignment_id,
                branch: assignment.branch || branch || 'CSE',
                semester: assignment.course_semester || Number(semester),
                academic_year: assignment.academic_year || academic_year,
                date: row.attendance_date || new Date().toISOString().split('T')[0],
                session: row.session_number || 1,
                faculty_id: row.faculty_id,
                topic_covered: row.topic_covered,
                created_at: row.created_at,
                archived_at: new Date(),
              };
            });

            await tx.insert(archiveAttendanceSessions).values(archiveSessEntries);
            const sessionIds = sessionRows.map(r => r.id);
            await tx.delete(attendanceSessions).where(inArray(attendanceSessions.id, sessionIds));
            recordsArchived += sessionRows.length;
          }

          // 3. Move Marks Records
          const marksRows = await tx
            .select({
              id: studentMarks.id,
              student_id: studentMarks.student_id,
              assignment_id: studentMarks.assignment_id,
              mid1_marks: studentMarks.mid1_marks,
              mid2_marks: studentMarks.mid2_marks,
              assignment_marks: studentMarks.assignment_marks,
              lab_theory_marks: studentMarks.lab_theory_marks,
              lab_execution_marks: studentMarks.lab_execution_marks,
              lab_record_marks: studentMarks.lab_record_marks,
              is_published: studentMarks.is_published,
              created_at: studentMarks.created_at,
              roll_no: students.roll_no,
            })
            .from(studentMarks)
            .leftJoin(students, eq(studentMarks.student_id, students.id))
            .where(inArray(studentMarks.assignment_id, assignmentIds));

          if (marksRows.length > 0) {
            const archiveMarksEntries = marksRows.map(row => {
              const assignment = assignmentMap.get(row.assignment_id) || {};
              return {
                original_mark_id: row.id,
                student_id: row.student_id,
                roll_no: row.roll_no || 'UNKNOWN',
                assignment_id: row.assignment_id,
                subject_code: assignment.subject_code,
                branch: assignment.branch || branch || 'CSE',
                semester: assignment.course_semester || Number(semester),
                academic_year: assignment.academic_year || academic_year,
                mid1_marks: row.mid1_marks,
                mid2_marks: row.mid2_marks,
                assignment_marks: row.assignment_marks,
                lab_theory_marks: row.lab_theory_marks,
                lab_execution_marks: row.lab_execution_marks,
                lab_record_marks: row.lab_record_marks,
                is_published: row.is_published,
                created_at: row.created_at,
                archived_at: new Date(),
              };
            });

            await tx.insert(archiveStudentMarks).values(archiveMarksEntries);
            const markIds = marksRows.map(r => r.id);
            await tx.delete(studentMarks).where(inArray(studentMarks.id, markIds));
            recordsArchived += marksRows.length;
          }
        }

        // 4. Archive Financial Payment Screenshots for the Semester
        const payConditions = [
          eq(studentFeePayments.academic_year, academic_year),
        ];
        const paymentRows = await tx
          .select()
          .from(studentFeePayments)
          .where(and(...payConditions));

        for (const p of paymentRows) {
          if (p.payment_screenshot_path) {
            const { newPath, sizeBytes } = await ArchiveMediaService.archiveMediaFile(
              p.payment_screenshot_path,
              `payments/${academic_year}`
            );
            if (newPath !== p.payment_screenshot_path) {
              await tx
                .update(studentFeePayments)
                .set({ payment_screenshot_path: newPath })
                .where(eq(studentFeePayments.id, p.id));
              storageSizeBytes += sizeBytes;
              mediaArchived += 1;
            }
          }
        }

        // 5. Record Operation in Audit Log
        await tx.insert(archiveOperationsLog).values({
          job_id: jobId,
          archive_type: 'SEMESTER',
          target_scope: `${branch || 'ALL'}-SEM${semester}-${academic_year}`,
          academic_year,
          semester,
          branch,
          affected_students_count: 0,
          affected_records_count: recordsArchived,
          affected_media_count: mediaArchived,
          storage_size_bytes: storageSizeBytes,
          execution_time_ms: Date.now() - startTime,
          status: 'COMPLETED',
          archived_by,
          notes: reason,
          created_at: new Date(),
        });
      });

      const executionTimeMs = Date.now() - startTime;
      logger.info({ jobId, recordsArchived, mediaArchived, executionTimeMs }, '[SEMESTER_ARCHIVE_SUCCESS]');

      return {
        success: true,
        jobId,
        affectedRecordsCount: recordsArchived,
        affectedMediaCount: mediaArchived,
        storageSizeBytes,
        executionTimeMs,
        message: `Successfully archived ${recordsArchived} records for ${branch || 'ALL'} Semester ${semester} (${academic_year}).`,
      };
    } catch (error) {
      logger.error({ jobId, error: error.message }, '[SEMESTER_ARCHIVE_FAILURE]');

      // Log failure execution
      await db.insert(archiveOperationsLog).values({
        job_id: jobId,
        archive_type: 'SEMESTER',
        target_scope: `${branch || 'ALL'}-SEM${semester}-${academic_year}`,
        academic_year,
        semester,
        branch,
        status: 'FAILED',
        error_message: error.message,
        archived_by,
        notes: reason,
        created_at: new Date(),
      }).catch(() => { /* empty */ });

      throw error;
    }
  }

  /**
   * Run an alumni graduation archival job for passed out / completed students
   */
  static async runAlumniArchive({ graduation_year, branch, student_ids = [], archived_by = 'SYSTEM', reason = 'Course completion' }) {
    const startTime = Date.now();
    const jobId = `JOB-ALU-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      logger.info({ jobId, graduation_year, branch, student_idsCount: student_ids.length, archived_by }, '[START_ALUMNI_ARCHIVE]');

      let recordsArchived = 0;
      let mediaArchived = 0;
      let storageSizeBytes = 0;

      // Build target query for students
      const conditions = [
        or(
          eq(students.academic_status, 'GRADUATED'),
          eq(students.student_status, 'ARCHIVED')
        )
      ];

      if (graduation_year) {
        conditions.push(eq(students.academic_offset_years, 0)); // Or filter by batch/year
      }
      if (branch) {
        const branchCode = Object.keys(branchCodes).find(code => branchCodes[code].toUpperCase() === branch.toUpperCase());
        if (branchCode) {
          conditions.push(like(students.roll_no, `%${branchCode}%`));
        }
      }
      if (student_ids && student_ids.length > 0) {
        conditions.push(inArray(students.id, student_ids));
      }

      let targetStudents = await db
        .select()
        .from(students)
        .where(and(...conditions));

      if (branch) {
        targetStudents = targetStudents.filter(s => {
          const b = getBranchFromRoll(s.roll_no);
          return b && b.toUpperCase() === branch.toUpperCase();
        });
      }

      if (targetStudents.length === 0) {
        return {
          success: true,
          jobId,
          affectedStudentsCount: 0,
          affectedRecordsCount: 0,
          affectedMediaCount: 0,
          executionTimeMs: Date.now() - startTime,
          message: 'No eligible graduated students found for archival.',
        };
      }

      const targetStudentIds = targetStudents.map(s => s.id);

      await db.transaction(async (tx) => {
        // Move students to archive_students
        for (const s of targetStudents) {
          const studentBranch = getBranchFromRoll(s.roll_no) || branch || 'CSE';

          let archivedPfp = s.pfp;
          if (s.pfp) {
            const { newPath, sizeBytes } = await ArchiveMediaService.archiveMediaFile(
              s.pfp, 
              `students/${studentBranch}/profile`
            );
            archivedPfp = newPath;
            storageSizeBytes += sizeBytes;
            mediaArchived += 1;
          }

          const archiveStudentEntry = {
            original_student_id: s.id,
            roll_no: s.roll_no,
            name: s.name,
            email: s.email,
            mobile: s.mobile,
            branch: studentBranch,
            batch: `${s.admission_year || ''}-${graduation_year || ''}`,
            admission_year: s.admission_year || '2022',
            graduation_year: graduation_year || '2026',
            academic_status: 'GRADUATED',
            student_status: 'ARCHIVED',
            fee_reimbursement: s.fee_reimbursement,
            pfp: archivedPfp,
            archived_by,
            archive_reason: reason,
            archived_at: new Date(),
          };

          const [insertedStudent] = await tx.insert(archiveStudents).values(archiveStudentEntry);
          const archiveStudentId = insertedStudent.insertId;

          // Move Personal Details
          const personalRows = await tx
            .select()
            .from(studentPersonalDetails)
            .where(eq(studentPersonalDetails.student_id, s.id));

          if (personalRows.length > 0) {
            for (const pd of personalRows) {
              let archivedSig = pd.signature_path;
              if (pd.signature_path) {
                const { newPath, sizeBytes } = await ArchiveMediaService.archiveMediaFile(
                  pd.signature_path,
                  `students/${studentBranch}/signatures`
                );
                archivedSig = newPath;
                storageSizeBytes += sizeBytes;
                mediaArchived += 1;
              }

              await tx.insert(archiveStudentPersonalDetails).values({
                archive_student_id: archiveStudentId,
                original_detail_id: pd.id,
                father_name: pd.father_name,
                mother_name: pd.mother_name,
                dob: pd.dob,
                category: pd.category,
                sub_caste: pd.sub_caste,
                gender: pd.gender,
                aadhaar_no: pd.aadhaar_no,
                guardian_mobile: pd.guardian_mobile,
                permanent_address: pd.permanent_address,
                signature_path: archivedSig,
                archived_at: new Date(),
              });
            }

            await tx.delete(studentPersonalDetails).where(eq(studentPersonalDetails.student_id, s.id));
          }

          // Move Academic Background
          const backgroundRows = await tx
            .select()
            .from(studentAcademicBackground)
            .where(eq(studentAcademicBackground.student_id, s.id));

          if (backgroundRows.length > 0) {
            for (const bg of backgroundRows) {
              await tx.insert(archiveStudentAcademicBackground).values({
                archive_student_id: archiveStudentId,
                ssc_school: bg.ssc_school,
                ssc_gpa: bg.ssc_gpa,
                inter_college: bg.inter_college,
                inter_gpa: bg.inter_gpa,
                archived_at: new Date(),
              });
            }
            await tx.delete(studentAcademicBackground).where(eq(studentAcademicBackground.student_id, s.id));
          }

          recordsArchived += 1;
        }

        // Delete moved students from active table
        await tx.delete(students).where(inArray(students.id, targetStudentIds));

        await tx.insert(archiveOperationsLog).values({
          job_id: jobId,
          archive_type: 'ALUMNI',
          branch,
          academic_year: graduation_year,
          affected_students_count: targetStudents.length,
          affected_records_count: recordsArchived,
          affected_media_count: mediaArchived,
          storage_size_bytes: storageSizeBytes,
          archived_by,
          execution_time_ms: Date.now() - startTime,
          status: 'COMPLETED',
          details: JSON.stringify({ reason, count: targetStudents.length }),
        });
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        jobId,
        affectedStudentsCount: targetStudents.length,
        affectedRecordsCount: recordsArchived,
        affectedMediaCount: mediaArchived,
        storageSizeBytes,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      logger.error({ jobId, err: error.message }, '[ALUMNI_ARCHIVE_FAILED]');

      await db.insert(archiveOperationsLog).values({
        job_id: jobId,
        archive_type: 'ALUMNI',
        branch,
        academic_year: graduation_year,
        affected_students_count: 0,
        affected_records_count: 0,
        affected_media_count: 0,
        storage_size_bytes: 0,
        archived_by,
        execution_time_ms: executionTimeMs,
        status: 'FAILED',
        error_message: error.message,
        details: JSON.stringify({ reason }),
      });

      throw new Error(`Alumni archival failed: ${error.message}`);
    }
  }

  /**
   * Get archive execution audit log history
   */
  static async getArchiveHistory({ limit = 50, offset = 0, page = 1, archive_type = null }) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
      const computedOffset = offset > 0 ? offset : (pageNum - 1) * limitNum;

      const queryBuilder = db
        .select()
        .from(archiveOperationsLog);

      if (archive_type) {
        queryBuilder.where(eq(archiveOperationsLog.archive_type, archive_type));
      }

      const logs = await queryBuilder
        .orderBy(desc(archiveOperationsLog.created_at))
        .limit(limitNum)
        .offset(computedOffset);

      return logs || [];
    } catch (error) {
      logger.error({ err: error.message }, '[GET_ARCHIVE_HISTORY_ERROR]');
      throw new Error(`Failed to fetch archive history: ${error.message}`);
    }
  }

  /**
   * Get configurable retention policies
   */
  static async getRetentionPolicies() {
    try {
      let policies = await db.select().from(archiveRetentionPolicies);
      if (policies.length === 0) {
        // Seed default institutional retention policies
        const defaults = [
          { entity_type: 'ATTENDANCE', auto_archive_enabled: true, retention_months: 6, description: 'Archive student attendance logs 6 months after semester completion.' },
          { entity_type: 'MARKS', auto_archive_enabled: true, retention_months: 6, description: 'Archive internal/mid term marks after final result declaration.' },
          { entity_type: 'PAYMENT_EVIDENCE', auto_archive_enabled: true, retention_months: 12, description: 'Archive verified payment receipt screenshots after annual audit.' },
          { entity_type: 'GRADUATED_STUDENTS', auto_archive_enabled: true, retention_months: 1, description: 'Archive student profiles into Alumni database upon official graduation.' },
          { entity_type: 'SIGNATURES', auto_archive_enabled: true, retention_months: 1, description: 'Archive student signatures into persistent archive storage upon graduation.' },
        ];
        await db.insert(archiveRetentionPolicies).values(defaults);
        policies = await db.select().from(archiveRetentionPolicies);
      }
      return policies;
    } catch (error) {
      logger.error({ err: error.message }, '[GET_RETENTION_POLICIES_ERROR]');
      throw new Error(`Failed to fetch retention policies: ${error.message}`);
    }
  }

  /**
   * Update retention policy rule
   */
  static async updateRetentionPolicy(entity_type, updates = {}, updated_by = 'SYSTEM') {
    try {
      await db
        .update(archiveRetentionPolicies)
        .set({
          auto_archive_enabled: updates.auto_archive_enabled,
          retention_months: updates.retention_months,
          description: updates.description,
          updated_by,
          updated_at: new Date(),
        })
        .where(eq(archiveRetentionPolicies.entity_type, entity_type));

      return { success: true, message: `Retention policy for ${entity_type} updated successfully.` };
    } catch (error) {
      logger.error({ err: error.message, entity_type }, '[UPDATE_RETENTION_POLICY_ERROR]');
      throw new Error(`Failed to update retention policy: ${error.message}`);
    }
  }

  /**
   * Search across all archived domain entities
   */
  static async searchArchivedRecords({ search_query, entity_type = 'ALL', limit = 50 }) {
    if (!search_query || search_query.trim().length === 0) {
      return { students: [], attendance: [], marks: [], payments: [] };
    }

    const term = `%${search_query.trim()}%`;

    try {
      const results = { students: [], attendance: [], marks: [], payments: [] };

      if (entity_type === 'ALL' || entity_type === 'STUDENTS') {
        results.students = await db
          .select()
          .from(archiveStudents)
          .where(
            or(
              like(archiveStudents.roll_no, term),
              like(archiveStudents.name, term),
              like(archiveStudents.branch, term),
              like(archiveStudents.batch, term)
            )
          )
          .limit(limit);
      }

      if (entity_type === 'ALL' || entity_type === 'ATTENDANCE') {
        results.attendance = await db
          .select()
          .from(archiveStudentAttendance)
          .where(
            or(
              like(archiveStudentAttendance.roll_no, term),
              like(archiveStudentAttendance.subject_code, term),
              like(archiveStudentAttendance.branch, term),
              like(archiveStudentAttendance.academic_year, term)
            )
          )
          .limit(limit);
      }

      if (entity_type === 'ALL' || entity_type === 'MARKS') {
        results.marks = await db
          .select()
          .from(archiveStudentMarks)
          .where(
            or(
              like(archiveStudentMarks.roll_no, term),
              like(archiveStudentMarks.subject_code, term),
              like(archiveStudentMarks.branch, term),
              like(archiveStudentMarks.academic_year, term)
            )
          )
          .limit(limit);
      }

      if (entity_type === 'ALL' || entity_type === 'PAYMENTS') {
        results.payments = await db
          .select()
          .from(archiveStudentPayments)
          .where(
            or(
              like(archiveStudentPayments.roll_no, term),
              like(archiveStudentPayments.transaction_ref_no, term),
              like(archiveStudentPayments.bank_name, term),
              like(archiveStudentPayments.academic_year, term)
            )
          )
          .limit(limit);
      }

      return results;
    } catch (error) {
      logger.error({ err: error.message, search_query }, '[SEARCH_ARCHIVED_RECORDS_ERROR]');
      throw new Error(`Archive search failed: ${error.message}`);
    }
  }
}
