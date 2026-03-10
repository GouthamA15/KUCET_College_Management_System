import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { isSemesterActive } from '@/lib/academic-utils';
import { branchCodes } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    const db = getDb();
    
    // Fetch assignment details including mid_max
    const [assignments] = await db.execute(
      'SELECT id, mid_max, branch, course_semester, academic_year, subject_name, subject_code FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const { branch, course_semester, academic_year, subject_name, subject_code } = assignment;
    const midMax = assignment.mid_max || 20;
    const isLab = subject_name?.toLowerCase().includes('lab');

    // --- SHARED DATA LOGIC: Canonical ID ---
    // Multiple faculty sharing the same subject identity will see the same marks data
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const canonicalId = canonicalRows[0]?.id || assignment_id;

    // --- PRECISE SEMESTER-AWARE STUDENT FILTERING ---
    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(course_semester / 2);
    const entryYearRegular = (startYear - (studyingYear - 1)).toString().slice(-2);
    const entryYearLateral = (startYear - (studyingYear - 2)).toString().slice(-2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      return apiError('Invalid branch in assignment', 400);
    }

    const regularPattern = `${entryYearRegular}567T${branchCode}%`;
    const lateralPattern = `${entryYearLateral}567${branchCode}%L`;

    let studentsQuery = `
      SELECT 
        s.id, s.roll_no, s.name,
        sm.mid1_marks, sm.mid2_marks, sm.assignment_marks,
        sm.lab_theory_marks, sm.lab_execution_marks, sm.lab_record_marks
      FROM students s
      LEFT JOIN student_marks sm ON s.id = sm.student_id AND sm.assignment_id = ?
      WHERE (s.roll_no LIKE ?
    `;

    const params = [canonicalId, regularPattern];
    if (studyingYear >= 2) {
      studentsQuery += ' OR s.roll_no LIKE ?';
      params.push(lateralPattern);
    }
    studentsQuery += ') ORDER BY s.roll_no ASC';

    const [students] = await db.execute(studentsQuery, params);

    // Fetch HOD recommendation for this branch and semester
    const [branchConfig] = await db.execute(
      'SELECT mid_max FROM branch_config WHERE branch = ? AND academic_year = ? AND semester = ?',
      [branch, academic_year, course_semester]
    );
    const recommendedMidMax = branchConfig[0]?.mid_max || null;

    return apiResponse({ 
      data: students, 
      mid_max: midMax, 
      recommended_mid_max: recommendedMidMax,
      subject_type: isLab ? 'lab' : 'theory',
      canonical_id: canonicalId 
    });
  } catch (error) {
    console.error('Marks Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, marks_data, mid_max } = body;

    if (!assignment_id || !Array.isArray(marks_data) || marks_data.length === 0) {
      return apiError('Missing or empty marks data', 400);
    }

    const db = getDb();
    const [assignments] = await db.execute(
      'SELECT id, subject_code, branch, course_semester, academic_year, subject_name FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year, subject_name } = assignment;
    const isLab = subject_name?.toLowerCase().includes('lab');

    // --- SHARED DATA LOGIC: Target Canonical ID ---
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Marks locked.', 403);
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      if (mid_max !== undefined) {
        await connection.execute(
          'UPDATE faculty_subject_assignments SET mid_max = ? WHERE id = ?',
          [mid_max, targetAssignmentId]
        );
      }

      const values = [];
      const placeholders = [];
      
      marks_data.forEach(item => {
        if (isLab) {
          placeholders.push('(?, ?, ?, ?, ?)');
          values.push(
            item.student_id,
            targetAssignmentId,
            item.lab_theory_marks ?? null,
            item.lab_execution_marks ?? null,
            item.lab_record_marks ?? null
          );
        } else {
          placeholders.push('(?, ?, ?, ?, ?)');
          values.push(
            item.student_id,
            targetAssignmentId,
            item.mid1_marks ?? null,
            item.mid2_marks ?? null,
            item.assignment_marks ?? null
          );
        }
      });

      const sql = isLab
        ? `
        INSERT INTO student_marks (student_id, assignment_id, lab_theory_marks, lab_execution_marks, lab_record_marks)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE 
          lab_theory_marks = VALUES(lab_theory_marks),
          lab_execution_marks = VALUES(lab_execution_marks),
          lab_record_marks = VALUES(lab_record_marks)
      `
        : `
        INSERT INTO student_marks (student_id, assignment_id, mid1_marks, mid2_marks, assignment_marks)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE 
          mid1_marks = VALUES(mid1_marks),
          mid2_marks = VALUES(mid2_marks),
          assignment_marks = VALUES(assignment_marks)
      `;

      await connection.execute(sql, values);
      await connection.commit();
      
      return apiResponse({ message: `Successfully updated ${marks_data.length} records` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Marks Bulk Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
