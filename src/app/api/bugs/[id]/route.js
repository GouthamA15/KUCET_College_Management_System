import logger from '@/lib/logger';
import { db } from '@/db';
import { bugReports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { isDeveloper } from '@/lib/developers';

export async function PATCH(req, { params }) {
  try {
    let userEmail = null;

    // Try app auth (student/clerk/admin cookies)
    const user = await getAuthUser();
    if (user && user.email) {
      userEmail = user.email.toLowerCase();
    }

    if (!userEmail) {
      return apiError('You must be logged in', 401);
    }

    if (!isDeveloper(userEmail)) {
      return apiError('Only official developers can mark reports as fixed', 403);
    }

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) {
      return apiError('Invalid report ID', 400);
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'resolve') {
      const [result] = await db.update(bugReports)
        .set({
          status: 'RESOLVED',
          fixed_by: userEmail,
          fixed_at: new Date()
        })
        .where(eq(bugReports.id, reportId));

      if (result.affectedRows === 0) {
        return apiError('Report not found', 404);
      }

      return apiResponse({ success: true, message: 'Marked as fixed' });
    }

    if (action === 'reopen') {
      const [result] = await db.update(bugReports)
        .set({
          status: 'OPEN',
          fixed_by: null,
          fixed_at: null
        })
        .where(eq(bugReports.id, reportId));

      if (result.affectedRows === 0) {
        return apiError('Report not found', 404);
      }

      return apiResponse({ success: true, message: 'Reopened' });
    }

    return apiError('Invalid action. Use "resolve" or "reopen".', 400);
  } catch (error) {
    logger.error(error, 'Error updating bug report');
    return apiError('Failed to update report', 500);
  }
}
