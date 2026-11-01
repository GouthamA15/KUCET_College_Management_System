import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable, studentImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { serveAssetResponse } from '@/lib/server-assets';

/**
 * GET /api/staff/admission/bridge/students/[rollno]/photo
 * 
 * Secure, authenticated route for admission staff to fetch student photograph.
 * Enforces staff admission permissions.
 */
export async function GET(req, context) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);

    const userRole = (user.role || '').toLowerCase();
    const allowedRoles = ['admission', 'admission_clerk', 'admin', 'super_admin'];
    if (!allowedRoles.includes(userRole)) {
      return apiError('Forbidden: Only admission staff can access student media', 403);
    }

    const params = await context.params;
    const { rollno } = params;
    if (!rollno) return apiError('Roll number required', 400);

    const cleanRoll = rollno.trim().toUpperCase();

    const rows = await db.select({ pfp: studentImages.pfp })
      .from(studentImages)
      .innerJoin(studentsTable, eq(studentImages.student_id, studentsTable.id))
      .where(eq(studentsTable.roll_no, cleanRoll))
      .limit(1);

    if (rows.length === 0 || !rows[0].pfp) {
      return apiError('Photograph not found for student', 404);
    }

    return await serveAssetResponse(rows[0].pfp, {
      req,
      cacheControl: 'private, no-cache, must-revalidate',
    });

  } catch (error) {
    logger.error({ err: error.message }, 'Error serving bridge student photo');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
