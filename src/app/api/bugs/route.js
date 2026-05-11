import logger from '@/lib/logger';
import { db } from '@/db';
import { bugReports } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return apiError('Unauthorized to view bug reports', 401);
    }
    const admin = await getAuthUser('admin');
    if (!admin) {
      return apiError('Forbidden: insufficient permissions', 403);
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
    // Normalize and parse client IP before rate limiting
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
          // If X-Forwarded-For is empty, generate a unique per-request token
          clientIp = `req-${crypto.randomBytes(8).toString('hex')}`;
        }
      }
    }
    
    // Use normalized client IP for rate limiting
    const rateCheck = await checkRateLimit(`bugs:${clientIp}`, 5, 3600); // 5 reports per hour
    if (!rateCheck.success) {
      return apiError('Too many bug reports. Please try again later.', 429);
    }

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
