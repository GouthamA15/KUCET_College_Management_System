
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

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
    const scholarship = await query(scholarshipSql, [studentId]);

    const feesSql = 'SELECT * FROM fees WHERE student_id = ? ORDER BY year, date';
    const fees = await query(feesSql, [studentId]);

    const academicsSql = 'SELECT * FROM academics WHERE student_id = ? ORDER BY year';
    const academics = await query(academicsSql, [studentId]);

    return NextResponse.json({ student, scholarship, fees, academics });
  } catch (error) {
    console.error('Error fetching student profile data:', error);
    return NextResponse.json({ message: 'Failed to fetch student profile data', error: error.message }, { status: 500 });
  }
}
