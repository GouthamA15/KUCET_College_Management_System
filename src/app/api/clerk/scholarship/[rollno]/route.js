import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { rollno } = params;

    const [student] = await query('SELECT * FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const fees = await query('SELECT * FROM fees WHERE student_id = ?', [student.id]);
    const scholarship = await query('SELECT * FROM scholarship WHERE student_id = ?', [student.id]);

    return NextResponse.json({ student, fees, scholarship });
  } catch (error) {
    console.error('Error fetching student data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { rollno } = params;
    const { fees, scholarship } = await req.json();

    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Update fees
    for (const fee of fees) {
      await query(
        'UPDATE fees SET challan_type = ?, challan_no = ?, date = ?, amount = ?, bank_name_branch = ?, upit_no = ? WHERE id = ? AND student_id = ?',
        [fee.challan_type, fee.challan_no, fee.date, fee.amount, fee.bank_name_branch, fee.upit_no, fee.id, student.id]
      );
    }

    // Update scholarship
    for (const s of scholarship) {
      await query(
        'UPDATE scholarship SET proceedings_no = ?, amount_sanctioned = ?, amount_disbursed = ?, ch_no = ?, date = ?, bank_status = ?, utr_no = ?, utr_date = ? WHERE id = ? AND student_id = ?',
        [s.proceedings_no, s.amount_sanctioned, s.amount_disbursed, s.ch_no, s.date, s.bank_status, s.utr_no, s.utr_date, s.id, student.id]
      );
    }

    return NextResponse.json({ success: true, message: 'Student data updated successfully' });
  } catch (error) {
    console.error('Error updating student data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}