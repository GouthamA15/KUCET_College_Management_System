import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable } from '@/db/schema';
import { eq, and, like, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const url = req.nextUrl;
    const nameRaw = url.searchParams.get('name') || '';
    const name = String(nameRaw).trim();

    if (!name || name.length < 2) {
      return apiError('Name must be at least 2 characters', 400);
    }

    const rows = await db.select({
      id: studentsTable.id,
      roll_number: studentsTable.roll_no,
      name: studentsTable.name,
      admission_no: studentsTable.admission_no
    })
    .from(studentsTable)
    .where(and(
      like(studentsTable.name, `%${name}%`),
      eq(studentsTable.student_status, 'ACTIVE')
    ))
    .limit(10);

    return apiResponse({ students: rows || [] });
  } catch (error) {
    logger.error('Error searching scholarship students by name:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
