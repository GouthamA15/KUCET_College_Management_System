import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentAchievements } from '@/db/schema';
import { staffAcademicAffiliations, students as studentsTable, academicPrograms } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { branchCodes, getBranchFromRoll } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin' && user.role !== 'hod')) {
      return apiError('Unauthorized', 401);
    }

    const { studentIds } = await request.json();
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    let validStudentIds = studentIds;

    if (user.role !== 'admin') {
      const affil = await db.select({ 
        prog_code: academicPrograms.program_code 
      })
      .from(staffAcademicAffiliations)
      .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
      .where(eq(staffAcademicAffiliations.staff_account_id, user.id));
      
      const allowedPrograms = Array.from(new Set(affil.map(a => a.prog_code).filter(Boolean)));
      const allowedBranchCodes = allowedPrograms.map(p => Object.keys(branchCodes).find(key => branchCodes[key] === p)).filter(Boolean);

      const targetStudents = await db.select({ id: studentsTable.id, roll_no: studentsTable.roll_no })
        .from(studentsTable)
        .where(inArray(studentsTable.id, studentIds));

      validStudentIds = targetStudents
        .filter(s => {
          let branchCode = null;
          const rollNo = s.roll_no;
          const match = rollNo.match(/567T(\d{2})/);
          const matchLe = rollNo.match(/567(\d{2}).*L/);
          if (match) branchCode = match[1];
          else if (matchLe) branchCode = matchLe[1];
          else if (rollNo.length === 10) branchCode = rollNo.substring(6, 8);

          const branchName = getBranchFromRoll(rollNo);
          return (branchCode && allowedBranchCodes.includes(branchCode)) || 
                 (branchName && allowedPrograms.includes(branchName));
        })
        .map(s => s.id);
    }

    if (validStudentIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const achievements = await db.select()
      .from(studentAchievements)
      .where(inArray(studentAchievements.student_id, validStudentIds));

    return NextResponse.json({ data: achievements });
  } catch (error) {
    logger.error({ err: error }, 'Server error generating bulk achievements');
    return apiError('Server error generating bulk achievements', 500);
  }
}
