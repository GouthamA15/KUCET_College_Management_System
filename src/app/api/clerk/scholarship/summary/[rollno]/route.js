// src/app/api/clerk/scholarship/summary/[rollno]/route.js
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getAcademicYear, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

// Helper function to handle undefined values
const toNull = (value) => (value === undefined || value === '' ? null : value);

// Normalize various date inputs to SQL DATE string 'YYYY-MM-DD' or null
const formatDateForSQL = (value) => {
  if (value === undefined || value === null || value === '') return null;
  // If it's already a Date
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
  const s = String(value);
  // If looks like YYYY-MM-DD at start
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Try parsing as date
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
};

// Normalize status to DB enum: only 'Pending' or 'Success'
const normalizeStatus = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return 'Pending';
  const v = String(value).trim().toLowerCase();
  if (['success', 'successful', 'paid'].includes(v)) return 'Success';
  if (v === 'pending') return 'Pending';
  return 'Pending';
};

export async function GET(req, ctx) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    let year = url.searchParams.get('year');
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { rollno } = params;

    if (!rollno) return NextResponse.json({ error: 'Missing rollno parameter' }, { status: 400 });

    // STEP A: Fetch student
    const [student] = await query('SELECT id, roll_no, name, fee_reimbursement, email, mobile FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // STEP B: Derive course from roll number
    const course = getBranchFromRoll(student.roll_no);
    // Admission academic year period (e.g., 2023-2027)
    const admission_year = getAcademicYear(student.roll_no);
    // Server-resolved current academic year (e.g., 2025-26)
    const current_year = getResolvedCurrentAcademicYear(student.roll_no);
    // If client did not provide year, default to current_year to avoid UI-side hardcoding
    if (!year) {
      year = current_year;
    }
    const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);
    const fee_category = SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC';

    // STEP C: Resolve total fee
    const total_fee = fee_category === 'SFC' ? 70000 : 35000;

    // STEP D: Fetch scholarship sanctions for the academic year
    const sanctionsRows = await query(
      'SELECT id, application_no, proceeding_no, sanctioned_amount, sanction_date FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ? ORDER BY sanction_date ASC',
      [student.id, year]
    );
    const scholarship_proceedings = (sanctionsRows || []).map(r => ({
      id: r.id,
      proceeding_no: r.proceeding_no,
      amount: Number(r.sanctioned_amount) || 0,
      date: r.sanction_date,
    }));
    const application_no = (sanctionsRows || []).map(r => r.application_no).find(v => v && String(v).trim() !== '') || null;
    const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // STEP E: Fetch student payments for the academic year
    const paymentsRows = await query(
      'SELECT id, transaction_ref_no, amount, transaction_date FROM student_fee_payments WHERE student_id = ? AND academic_year = ? ORDER BY transaction_date ASC',
      [student.id, year]
    );
    const student_payments = (paymentsRows || []).map(r => ({
      id: r.id,
      transaction_ref: r.transaction_ref_no,
      amount: Number(r.amount) || 0,
      date: r.transaction_date,
    }));
    const student_paid = student_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // STEP F: Compute derived fields
    const pending_fee = Math.max(0, Number(total_fee) - (Number(govt_paid) + Number(student_paid)));
    const status = pending_fee === 0 ? 'COMPLETED' : 'PENDING';

    // STEP G: Shape response exactly per contract
    const response = {
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        fee_reimbursement: student.fee_reimbursement,
        fee_category,
        course,
        email: student.email ?? null,
        mobile: student.mobile ?? null,
        admission_year,
        current_year,
      },
      academic_year: year,
      fee_summary: {
        total_fee,
        govt_paid,
        student_paid,
        pending_fee,
        status,
      },
      scholarship_proceedings,
      application_no,
      student_payments,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching student data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Unsupported methods for this endpoint until POST endpoints are implemented
export async function POST() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
