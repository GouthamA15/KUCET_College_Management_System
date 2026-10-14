import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAttendanceDisputes, 
  attendanceDisputeAttachments,
  facultySubjectAssignments, 
  students,
  staffAccounts 
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const assignmentId = searchParams.get('assignment_id') ? Number(searchParams.get('assignment_id')) : null;

    const conditions = [];

    // Role-based scope
    if (user.role !== 'admin' && !user.is_principal) {
      if (user.is_hod) {
        const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
        if (authorizedBranches.length > 0) {
          conditions.push(inArray(facultySubjectAssignments.branch, authorizedBranches));
        }
      } else {
        // Normal faculty only sees disputes for their assigned subjects
        conditions.push(eq(facultySubjectAssignments.staff_account_id, user.id));
      }
    }

    if (assignmentId) {
      conditions.push(eq(studentAttendanceDisputes.assignment_id, assignmentId));
    }

    if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED'].includes(statusFilter.toUpperCase())) {
      conditions.push(eq(studentAttendanceDisputes.status, statusFilter.toUpperCase()));
    }

    const rows = await db.select({
      id: studentAttendanceDisputes.id,
      student_id: studentAttendanceDisputes.student_id,
      assignment_id: studentAttendanceDisputes.assignment_id,
      attendance_date: studentAttendanceDisputes.attendance_date,
      session: studentAttendanceDisputes.session,
      original_status: studentAttendanceDisputes.original_status,
      requested_status: studentAttendanceDisputes.requested_status,
      category: studentAttendanceDisputes.category,
      reason: studentAttendanceDisputes.reason,
      additional_explanation: studentAttendanceDisputes.additional_explanation,
      student_declaration: studentAttendanceDisputes.student_declaration,
      proof_url: studentAttendanceDisputes.proof_url,
      status: studentAttendanceDisputes.status,
      reviewed_by_staff_id: studentAttendanceDisputes.reviewed_by_staff_id,
      reviewed_at: studentAttendanceDisputes.reviewed_at,
      rejection_reason: studentAttendanceDisputes.rejection_reason,
      reviewer_comments: studentAttendanceDisputes.reviewer_comments,
      created_at: studentAttendanceDisputes.created_at,
      roll_no: students.roll_no,
      student_name: students.name,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      reviewer_name: staffAccounts.name
    })
    .from(studentAttendanceDisputes)
    .innerJoin(students, eq(studentAttendanceDisputes.student_id, students.id))
    .innerJoin(facultySubjectAssignments, eq(studentAttendanceDisputes.assignment_id, facultySubjectAssignments.id))
    .leftJoin(staffAccounts, eq(studentAttendanceDisputes.reviewed_by_staff_id, staffAccounts.id))
    .where(and(...conditions))
    .orderBy(desc(studentAttendanceDisputes.created_at));

    // Load attachments
    const disputeIds = rows.map(r => r.id);
    let attachmentsByDispute = {};

    if (disputeIds.length > 0) {
      const attachments = await db.select({
        id: attendanceDisputeAttachments.id,
        dispute_id: attendanceDisputeAttachments.dispute_id,
        file_name: attendanceDisputeAttachments.file_name,
        file_size: attendanceDisputeAttachments.file_size,
        mime_type: attendanceDisputeAttachments.mime_type,
        created_at: attendanceDisputeAttachments.created_at
      })
      .from(attendanceDisputeAttachments)
      .where(inArray(attendanceDisputeAttachments.dispute_id, disputeIds));

      for (const att of attachments) {
        if (!attachmentsByDispute[att.dispute_id]) {
          attachmentsByDispute[att.dispute_id] = [];
        }
        attachmentsByDispute[att.dispute_id].push({
          ...att,
          download_url: `/api/student/attendance/disputes/evidence/${att.id}`
        });
      }
    }

    const result = rows.map(r => ({
      ...r,
      attachments: attachmentsByDispute[r.id] || []
    }));

    return apiResponse({ data: result });
  } catch (err) {
    logger.error('Error fetching faculty attendance disputes:', err);
    return apiError('Internal Server Error', 500);
  }
}
