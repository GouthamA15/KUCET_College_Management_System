import { NextResponse } from 'next/server';
import { db } from '@/db';
import { students as studentsTable, staffAcademicAffiliations, academicPrograms, studentAchievements } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/api-utils';
import { branchCodes, getBranchFromRoll } from '@/lib/rollNumber';
import logger from '@/lib/logger';

function apiError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin' && user.role !== 'hod')) {
      return apiError('Unauthorized', 401);
    }

    const { student_id } = await params;
    if (!student_id) {
      return apiError('Student ID is required', 400);
    }

    // 1. Authorize: Ensure the faculty is allowed to view this student
    const student = await db.query.students.findFirst({
      where: eq(studentsTable.id, parseInt(student_id)),
      columns: { roll_no: true }
    });

    if (!student) {
      return apiError('Student not found', 404);
    }

    // Super Admin bypasses department affiliation checks
    if (user.role !== 'admin') {
      const rollNo = student.roll_no;
      let branchCode = null;
      const match = rollNo.match(/567T(\d{2})/);
      const matchLe = rollNo.match(/567(\d{2}).*L/);
      if (match) branchCode = match[1];
      else if (matchLe) branchCode = matchLe[1];
      else if (rollNo.length === 10) {
        branchCode = rollNo.substring(6, 8);
      }

      const branchName = getBranchFromRoll(rollNo);

      const affil = await db.select({ 
        prog_code: academicPrograms.program_code 
      })
      .from(staffAcademicAffiliations)
      .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
      .where(eq(staffAcademicAffiliations.staff_account_id, user.id));
      
      const allowedPrograms = Array.from(new Set(affil.map(a => a.prog_code).filter(Boolean)));
      const allowedBranchCodes = allowedPrograms.map(p => Object.keys(branchCodes).find(key => branchCodes[key] === p)).filter(Boolean);

      const isAuthorizedBranch = (branchCode && allowedBranchCodes.includes(branchCode)) || 
                                 (branchName && allowedPrograms.includes(branchName));

      if (!isAuthorizedBranch) {
        return apiError('Unauthorized to view achievements for this branch', 403);
      }
    }

    // 2. Fetch Achievements
    const achievements = await db.query.studentAchievements.findMany({
      where: eq(studentAchievements.student_id, parseInt(student_id)),
      orderBy: [
        desc(studentAchievements.achievement_date),
        desc(studentAchievements.end_date),
        desc(studentAchievements.id)
      ]
    });

    return NextResponse.json({ data: achievements });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching student achievements');
    return apiError('Internal Server Error', 500);
  }
}
