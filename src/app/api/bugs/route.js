import logger from '@/lib/logger';
import { db } from '@/db';
import { bugReports } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function GET() {
  try {
    const admin = await getAuthUser('admin');
    if (!admin) {
      return apiError('Unauthorized to view bug reports', 401);
    }

    const reports = await db.query.bugReports.findMany({
      orderBy: [desc(bugReports.created_at)]
    });
    return apiResponse(reports);
  } catch (error) {
    logger.error(error, 'Error fetching bug reports');
    return apiError('Failed to fetch bug reports', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(); // Allows any authenticated user (student, clerk, admin)
    if (!user) {
      return apiError('Unauthorized to submit bug reports', 401);
    }

    const body = await req.json();
    const { description, screenshot } = body;

    if (!description) {
      return apiError('Description is required', 400);
    }

    let screenshotUrl = null;
    if (screenshot) {
      screenshotUrl = await uploadToCloudinary(screenshot, 'bug_reports');
    }

    const [result] = await db.insert(bugReports).values({
      description,
      screenshot_url: screenshotUrl,
      status: 'OPEN'
    });

    return apiResponse({ success: true, id: result.insertId });
  } catch (error) {
    logger.error(error, 'Error creating bug report');
    return apiError('Failed to submit bug report', 500);
  }
}
