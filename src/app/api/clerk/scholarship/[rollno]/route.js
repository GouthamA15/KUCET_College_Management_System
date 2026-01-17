
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { rollno } = params;

    const studentSql = 'SELECT * FROM students WHERE roll_no = ?';
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const student = studentResult[0];

    const scholarshipSql = 'SELECT * FROM scholarship WHERE student_id = ?';
    const scholarshipResult = await query(scholarshipSql, [student.id]);

    return NextResponse.json({ student, scholarship: scholarshipResult });
  } catch (error) {
    console.error('Error fetching student data:', error);
    return NextResponse.json({ message: 'Failed to fetch student data', error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { rollno } = params;
    const data = await req.json();
    const { year, proceedings_no, amount_sanctioned, amount_disbursed, ch_no, date } = data;

    const studentSql = 'SELECT id FROM students WHERE roll_no = ?';
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const studentId = studentResult[0].id;

    // Check if scholarship data for the year already exists
    const existingScholarshipSql = 'SELECT id FROM scholarship WHERE student_id = ? AND year = ?';
    const existingScholarshipResult = await query(existingScholarshipSql, [studentId, year]);

    let sql;
    let queryParams;

    if (existingScholarshipResult.length > 0) {
      // Update existing record
      sql = `
        UPDATE scholarship
        SET proceedings_no = ?, amount_sanctioned = ?, amount_disbursed = ?, ch_no = ?, date = ?
        WHERE student_id = ? AND year = ?
      `;
      queryParams = [proceedings_no, amount_sanctioned, amount_disbursed, ch_no, date, studentId, year];
    } else {
      // Insert new record
      sql = `
        INSERT INTO scholarship (student_id, year, proceedings_no, amount_sanctioned, amount_disbursed, ch_no, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      queryParams = [studentId, year, proceedings_no, amount_sanctioned, amount_disbursed, ch_no, date];
    }

    await query(sql, queryParams);

    return NextResponse.json({ message: 'Scholarship data updated successfully' });
  } catch (error) {
    console.error('Error updating scholarship data:', error);
    return NextResponse.json({ message: 'Failed to update scholarship data', error: error.message }, { status: 500 });
  }
}
