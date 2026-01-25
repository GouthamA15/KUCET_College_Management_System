// src/app/api/clerk/scholarship/[rollno]/route.js
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// Helper function to handle undefined values
const toNull = (value) => (value === undefined || value === '' ? null : value);

export async function GET(req, ctx) {
  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { rollno } = params;

    if (!rollno) {
      return NextResponse.json({ error: 'Missing rollno parameter' }, { status: 400 });
    }

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

export async function PUT(req, ctx) {
  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { rollno } = params;
    const { fees, scholarship } = await req.json();

    if (!rollno) {
      return NextResponse.json({ error: 'Missing rollno parameter' }, { status: 400 });
    }

    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Update fees
    if (fees) {
      for (const fee of fees) {
        if (fee.id && !String(fee.id).startsWith('new-')) {
          await query(
            'UPDATE fees SET challan_type = ?, challan_no = ?, date = ?, amount = ?, bank_name_branch = ?, upit_no = ? WHERE id = ? AND student_id = ?',
            [toNull(fee.challan_type), toNull(fee.challan_no), toNull(fee.date), toNull(fee.amount), toNull(fee.bank_name_branch), toNull(fee.upit_no), fee.id, student.id]
          );
        } else {
          await query(
            'INSERT INTO fees (student_id, challan_type, challan_no, date, amount, bank_name_branch, upit_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student.id, toNull(fee.challan_type), toNull(fee.challan_no), toNull(fee.date), toNull(fee.amount), toNull(fee.bank_name_branch), toNull(fee.upit_no)]
          );
        }
      }
    }

    // Update scholarship
    if (scholarship) {
      for (const s of scholarship) {
        if (s.id && !String(s.id).startsWith('new-')) {
          await query(
            'UPDATE scholarship SET application_no = ?, proceedings_no = ?, scholarship_type = ?, status = ?, academic_year = ?, remarks = ?, amount_sanctioned = ?, amount_disbursed = ?, ch_no = ?, date = ? WHERE id = ? AND student_id = ?',
            [toNull(s.application_no), toNull(s.proceedings_no), toNull(s.scholarship_type), toNull(s.status), toNull(s.academic_year), toNull(s.remarks), toNull(s.amount_sanctioned), toNull(s.amount_disbursed), toNull(s.ch_no), toNull(s.date), s.id, student.id]
          );
        } else {
          await query(
            'INSERT INTO scholarship (student_id, application_no, proceedings_no, scholarship_type, status, academic_year, remarks, amount_sanctioned, amount_disbursed, ch_no, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [student.id, toNull(s.application_no), toNull(s.proceedings_no), toNull(s.scholarship_type), toNull(s.status), toNull(s.academic_year), toNull(s.remarks), toNull(s.amount_sanctioned), toNull(s.amount_disbursed), toNull(s.ch_no), toNull(s.date)]
          );
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Student data updated successfully' });
  } catch (error) {
    console.error('Error updating student data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}