import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { roll_no } = body;
    if (!roll_no) return NextResponse.json({ error: 'roll_no is required' }, { status: 400 });

    const studentRows = await query('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (!studentRows || studentRows.length === 0) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student_id = studentRows[0].id;

    // Allowed fields for personal details (matching reference.txt)
    const fields = [
      'father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','annual_income','aadhaar_no','guardian_mobile','address','seat_allotted_category','identification_marks','ncc_nss_details'
    ];

    // Build params
    const values = fields.map(f => body[f] || null);

    // Check if exists
    const exist = await query('SELECT id FROM student_personal_details WHERE student_id = ?', [student_id]);
    if (exist && exist.length > 0) {
      // Update
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const params = [...values, student_id];
      await query(`UPDATE student_personal_details SET ${setClause} WHERE student_id = ?`, params);
      return NextResponse.json({ success: true, message: 'Personal details updated' });
    } else {
      // Insert
      const placeholders = fields.map(_=> '?').join(', ');
      const sql = `INSERT INTO student_personal_details (student_id, ${fields.join(',')}) VALUES (?, ${placeholders})`;
      await query(sql, [student_id, ...values]);
      return NextResponse.json({ success: true, message: 'Personal details saved' }, { status: 201 });
    }
  } catch (err) {
    console.error('Personal details save error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
