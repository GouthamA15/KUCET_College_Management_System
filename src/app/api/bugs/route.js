import logger from '@/lib/logger';
import { db } from '@/db';
import { bugReports } from '@/db/schema';
import { desc, eq, or, like, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');
    const severityFilter = searchParams.get('severity');
    const searchQuery = searchParams.get('q');

    let conditions = [];

    if (typeFilter && ['BUG', 'FEATURE_REQUEST'].includes(typeFilter)) {
      conditions.push(eq(bugReports.type, typeFilter));
    }
    if (statusFilter && ['OPEN', 'RESOLVED', 'CLOSED'].includes(statusFilter)) {
      conditions.push(eq(bugReports.status, statusFilter));
    }
    if (severityFilter && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severityFilter)) {
      conditions.push(eq(bugReports.severity, severityFilter));
    }
    if (searchQuery && searchQuery.trim()) {
      conditions.push(
        or(
          like(bugReports.description, `%${searchQuery.trim()}%`),
          like(bugReports.submitted_by, `%${searchQuery.trim()}%`),
          like(bugReports.affected_page, `%${searchQuery.trim()}%`)
        )
      );
    }

    const reports = await db.query.bugReports.findMany({
      where: conditions.length > 0 ? (and(...conditions)) : undefined,
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
    let clientIp = 'unknown';
    if (req.ip) {
      clientIp = req.ip;
    } else {
      const xForwardedFor = req.headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        const firstIp = ips[0];
        if (firstIp && firstIp.length > 0) {
          clientIp = firstIp;
        } else {
          clientIp = `req-${crypto.randomBytes(8).toString('hex')}`;
        }
      }
    }

    const rateCheck = await checkRateLimit(`bugs:${clientIp}`, 5, 3600);
    if (!rateCheck.success) {
      return apiError('Too many reports. Please try again later.', 429);
    }

    const user = await getAuthUser();
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { description, screenshot, severity, affected_page, type } = body;

    if (!description) {
      return apiError('Description is required', 400);
    }

    const validTypes = ['BUG', 'FEATURE_REQUEST'];
    const reportType = type && validTypes.includes(type) ? type : 'BUG';

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const bugSeverity = severity && validSeverities.includes(severity) ? severity : 'MEDIUM';

    let screenshotUrl = null;
    if (screenshot) {
      screenshotUrl = await storage.upload(screenshot, 'bug_reports');
    }

    let userType = 'student';
    let userIdentifier = user.roll_no || user.email;

    if (user.role) {
      userType = user.role === 'admin' ? 'admin' : 'clerk';
    }

    const browserInfo = req.headers.get('user-agent') || 'Unknown';

    const [result] = await db.insert(bugReports).values({
      description,
      screenshot_url: screenshotUrl,
      type: reportType,
      status: 'OPEN',
      severity: bugSeverity,
      submitted_by: userIdentifier,
      user_type: userType,
      affected_page: affected_page || null,
      browser_info: browserInfo
    });

    return apiResponse({ success: true, id: result.insertId });
  } catch (error) {
    logger.error(error, 'Error creating report');
    return apiError('Failed to submit report', 500);
  }
}
