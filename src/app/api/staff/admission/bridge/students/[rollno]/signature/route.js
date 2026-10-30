import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable, studentSignatures } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { serveAssetResponse } from '@/lib/server-assets';

/**
 * GET /api/staff/admission/bridge/students/[rollno]/signature
 * 
 * Secure, authenticated route for admission staff to fetch student signature.
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

    const rows = await db.select({ signature: studentSignatures.signature })
      .from(studentSignatures)
      .innerJoin(studentsTable, eq(studentSignatures.student_id, studentsTable.id))
      .where(eq(studentsTable.roll_no, cleanRoll))
      .limit(1);

    if (rows.length === 0 || !rows[0].signature) {
      return apiError('Signature not found for student', 404);
    }

    return await serveAssetResponse(rows[0].signature, {
      req,
      cacheControl: 'private, no-cache, must-revalidate',
    });

  } catch (error) {
    logger.error({ err: error.message }, 'Error serving bridge student signature');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
