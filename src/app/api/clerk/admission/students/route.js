import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const studentData = await req.json();

    // TODO: Add validation for the student data

    const {
      name,
      father_name,
      mother_name,
      date_of_birth,
      place_of_birth,
      gender,
      nationality,
      religion,
      caste,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      scholarship_status,
      fee_payment_details,
      course,
      branch,
      admission_type,
      mother_tongue,
      father_occupation,
      student_aadhar_no,
      father_guardian_mobile_no,
      fee_reimbursement_category,
      identification_marks,
      present_address,
      permanent_address,
      apaar_id,
    } = studentData;

    // Generate roll number (this is a simplified example)
    const year = new Date().getFullYear().toString().slice(-2);
    // This is not a robust way to get the last id, but it's a simple example
    const lastStudent = await query('SELECT id from students order by id desc limit 1');
    const nextId = lastStudent.length > 0 ? lastStudent[0].id + 1 : 1;
    const roll_no = `${year}567T${branch}${nextId.toString().padStart(2, '0')}`;


    const result = await query(
      `INSERT INTO students (
        name, father_name, mother_name, date_of_birth, place_of_birth, gender, nationality, religion, caste, sub_caste, category, address, mobile, email, qualifying_exam, scholarship_status, fee_payment_details, course, branch, admission_type, mother_tongue, father_occupation, student_aadhar_no, father_guardian_mobile_no, fee_reimbursement_category, identification_marks, present_address, permanent_address, apaar_id, roll_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        father_name,
        mother_name,
        date_of_birth,
        place_of_birth,
        gender,
        nationality,
        religion,
        caste,
        sub_caste,
        category,
        address,
        mobile,
        email,
        qualifying_exam,
        scholarship_status,
        fee_payment_details,
        course,
        branch,
        admission_type,
        mother_tongue,
        father_occupation,
        student_aadhar_no,
        father_guardian_mobile_no,
        fee_reimbursement_category,
        identification_marks,
        present_address,
        permanent_address,
        apaar_id,
        roll_no,
      ]
    );

    return NextResponse.json({ success: true, studentId: result.insertId, roll_no });
  } catch (error) {
    console.error('Error adding student:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
