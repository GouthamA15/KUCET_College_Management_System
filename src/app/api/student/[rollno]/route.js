
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { computeAcademicYear } from '@/app/lib/academicYear';

export async function GET(req, context) {
  try {
    const params = await context.params;
    const { rollno } = params;

    const studentSql = 'SELECT * FROM students WHERE roll_no = ?';
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const student = studentResult[0];
    const studentId = student.id;

    // Convert pfp BLOB to base64 data URL if exists
    if (student.pfp) {
      student.pfp = `data:image/jpeg;base64,${student.pfp.toString('base64')}`;
    }

    const scholarshipSql = 'SELECT * FROM scholarship WHERE student_id = ? ORDER BY year';
    let scholarship = await query(scholarshipSql, [studentId]);
    scholarship = scholarship.map(s => ({ ...s, academic_year: computeAcademicYear(student.roll_no, student.admission_type, s.year) }));

    const feesSql = 'SELECT * FROM student_fee_transactions WHERE student_id = ? ORDER BY year, date';
    const fees = await query(feesSql, [studentId]);

    const academicsSql = 'SELECT * FROM academics WHERE student_id = ? ORDER BY year';
    const academics = await query(academicsSql, [studentId]);

    // Fetch personal details from separate table if present
    let personalDetails = {};
    try {
      const pd = await query('SELECT * FROM student_personal_details WHERE student_id = ?', [studentId]);
      if (pd && pd.length > 0) personalDetails = pd[0];
    } catch (e) {
      console.warn('Could not fetch personal details:', e.message || e);
    }

    // Merge some commonly used fields for backward compatibility
    const mergedStudent = { ...student, personal_details: personalDetails };

    return NextResponse.json({ student: mergedStudent, scholarship, fees, academics });
  } catch (error) {
    console.error('Error fetching student profile data:', error);
    return NextResponse.json({ message: 'Failed to fetch student profile data', error: error.message }, { status: 500 });
  }
}
