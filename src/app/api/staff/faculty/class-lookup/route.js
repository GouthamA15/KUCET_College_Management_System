import { students as studentsTable } from '@/db/schema';
import { db } from '@/db';
import { eq, and, asc, like, or, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { branchCodes } from '@/lib/rollNumber';
import logger from '@/lib/logger';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { staffAcademicAffiliations, academicDepartments, academicPrograms } from '@/db/schema';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program');
    const yearOfStudy = searchParams.get('yearOfStudy') ? parseInt(searchParams.get('yearOfStudy')) : null;
    
    const searchRoll = searchParams.get('roll_no');
    const searchName = searchParams.get('name');
    
    const isSearchMode = !!(searchRoll || searchName);

    if (!isSearchMode && (!program || !yearOfStudy || isNaN(yearOfStudy))) {
      return apiError('Program and yearOfStudy are required for class lookup', 400);
    }

    if (!isSearchMode && (yearOfStudy < 1 || yearOfStudy > 4)) {
      return apiError('Invalid year of study', 400);
    }

    // Server-side Authorization: Determine allowed programs
    const affil = await db.select({ 
      dept_code: academicDepartments.department_code, 
      prog_code: academicPrograms.program_code 
    })
    .from(staffAcademicAffiliations)
    .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
    .where(eq(staffAcademicAffiliations.staff_account_id, user.id));
    
    const allowedPrograms = Array.from(new Set(affil.map(a => a.prog_code || a.dept_code).filter(Boolean)));
    const allowedBranchCodes = allowedPrograms.map(p => Object.keys(branchCodes).find(key => branchCodes[key] === p)).filter(Boolean);

    if (allowedBranchCodes.length === 0) {
      return apiError('No programs assigned to your department', 403);
    }

    // Determine active academic year
    const activeAY = await getCollegeAcademicYear();
    if (!activeAY) {
      return apiError('Academic calendar not configured', 500);
    }
    const currentStartYear = parseInt(activeAY.split('-')[0], 10);

    let conditions = [eq(studentsTable.student_status, 'ACTIVE')];

    if (isSearchMode) {
      // Search Mode: enforce department constraints across all allowed branches
      const branchConditions = allowedBranchCodes.flatMap(bc => [
        like(studentsTable.roll_no, `%567T${bc}%`),
        like(studentsTable.roll_no, `%567${bc}%L`)
      ]);
      conditions.push(or(...branchConditions));

      if (searchRoll) {
        conditions.push(like(studentsTable.roll_no, `%${searchRoll}%`));
      }
      if (searchName) {
        conditions.push(like(studentsTable.name, `%${searchName}%`));
      }
    } else {
      // Lookup Mode: enforce single program
      if (!allowedPrograms.includes(program)) {
        return apiError('You are not authorized to view students for this program', 403);
      }
      const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === program);
      if (!branchCode) return apiError('Invalid program code', 400);

      conditions.push(or(
        like(studentsTable.roll_no, `%567T${branchCode}%`),
        like(studentsTable.roll_no, `%567${branchCode}%L`)
      ));
      
      conditions.push(sql`CASE 
        WHEN ${studentsTable.roll_no} LIKE '%T%' THEN 
          (${currentStartYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
        WHEN ${studentsTable.roll_no} LIKE '%L' THEN 
          (${currentStartYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
        ELSE 0
      END = ${yearOfStudy}`);
    }
    
    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      admission_no: studentsTable.admission_no,
      academic_offset_years: studentsTable.academic_offset_years
    })
    .from(studentsTable)
    .where(and(...conditions))
    .orderBy(asc(studentsTable.roll_no))
    .limit(isSearchMode ? 50 : 200); // Limit search results

    const formattedStudents = students.map(s => {
      // Reconstruct branch and year for display
      const match = s.roll_no.match(/^(\d{2})567T?(\d{2})([A-Z0-9]{2})(L?)$/i);
      let branchName = 'Unknown';
      if (match) {
        const [, , bc] = match;
        branchName = branchCodes[bc] || 'Unknown';
      }

      return {
        id: s.id,
        roll_no: s.roll_no,
        name: s.name,
        admission_no: s.admission_no,
        branch: branchName
      };
    });

    return apiResponse({ 
      data: formattedStudents,
      meta: { activeAcademicYear: activeAY, isSearchMode }
    });
  } catch (error) {
    logger.error('Class Lookup Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
