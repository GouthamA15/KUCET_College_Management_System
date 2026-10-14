import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  attendanceDisputeAttachments, 
  studentAttendanceDisputes, 
  facultySubjectAssignments, 
  students 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import { serveAssetResponse } from '@/lib/server-assets';

export async function GET(req, context) {
  try {
    const params = await context.params;
    const { attachment_id } = params;
    const attachmentIdNum = parseInt(attachment_id, 10);

    if (!attachmentIdNum || isNaN(attachmentIdNum)) {
      return new NextResponse('Valid attachment ID required', { status: 400 });
    }

    const user = await getAuthUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 1. Fetch attachment and related dispute
    const [attachment] = await db.select({
      id: attendanceDisputeAttachments.id,
      dispute_id: attendanceDisputeAttachments.dispute_id,
      student_id: attendanceDisputeAttachments.student_id,
      file_key: attendanceDisputeAttachments.file_key,
      file_name: attendanceDisputeAttachments.file_name,
      mime_type: attendanceDisputeAttachments.mime_type,
      file_size: attendanceDisputeAttachments.file_size,
    })
    .from(attendanceDisputeAttachments)
    .where(eq(attendanceDisputeAttachments.id, attachmentIdNum))
    .limit(1);

    if (!attachment) {
      return new NextResponse('Evidence attachment not found', { status: 404 });
    }

    const [dispute] = await db.select({
      id: studentAttendanceDisputes.id,
      student_id: studentAttendanceDisputes.student_id,
      assignment_id: studentAttendanceDisputes.assignment_id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      branch: facultySubjectAssignments.branch
    })
    .from(studentAttendanceDisputes)
    .innerJoin(facultySubjectAssignments, eq(studentAttendanceDisputes.assignment_id, facultySubjectAssignments.id))
    .where(eq(studentAttendanceDisputes.id, attachment.dispute_id))
    .limit(1);

    if (!dispute) {
      return new NextResponse('Parent dispute not found', { status: 404 });
    }

    // 2. Strict authorization verification:
    // - Owner student
    // - Assigned course faculty
    // - Department HOD (or authorized branches)
    // - Principal / Academic Supervisor
    // - Super Admin
    let isAuthorized = false;

    if (user.role === 'admin' || user.is_principal) {
      isAuthorized = true;
    } else if (user.student_id && Number(user.student_id) === Number(dispute.student_id)) {
      isAuthorized = true;
    } else if (user.role === 'faculty') {
      if (Number(dispute.faculty_id) === Number(user.id) || Number(dispute.faculty_id) === Number(user.staffId)) {
        isAuthorized = true;
      } else if (user.is_hod) {
        const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
        if (authorizedBranches.length === 0 || authorizedBranches.includes(dispute.branch) || user.branch === dispute.branch) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      logger.warn({ userId: user.id, userRole: user.role, attachmentId: attachmentIdNum }, '[SECURITY] Unauthorized attempt to access dispute evidence');
      return new NextResponse('Forbidden: You do not have permission to view this evidence document', { status: 403 });
    }

    // 3. Serve the private document securely
    const response = await serveAssetResponse(attachment.file_key, {
      req,
      cacheControl: 'private, no-cache, no-store, must-revalidate'
    });

    if (response.status >= 400) {
      const { storage } = await import('@/lib/providers');
      const directUrl = storage.getUrl(attachment.file_key);
      if (directUrl && (directUrl.startsWith('http://') || directUrl.startsWith('https://'))) {
        return NextResponse.redirect(directUrl, 303);
      }
    }

    // Attach headers
    response.headers.set('Content-Type', attachment.mime_type || 'application/octet-stream');
    response.headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;

  } catch (error) {
    logger.error('Error serving dispute evidence attachment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
