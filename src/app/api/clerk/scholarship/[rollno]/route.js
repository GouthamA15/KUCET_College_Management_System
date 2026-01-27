// src/app/api/clerk/scholarship/[rollno]/route.js
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { computeAcademicYear } from '@/app/lib/academicYear';

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
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { rollno } = params;

    if (!rollno) {
      return NextResponse.json({ error: 'Missing rollno parameter' }, { status: 400 });
    }

    const [student] = await query('SELECT * FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const personal = (await query('SELECT * FROM student_personal_details WHERE student_id = ?', [student.id]))[0] || null;
    const academic = (await query('SELECT * FROM student_academic_background WHERE student_id = ?', [student.id]))[0] || null;
    const feeDetails = (await query('SELECT * FROM student_fee_details WHERE student_id = ?', [student.id]))[0] || null;
    let scholarship = await query('SELECT * FROM scholarship WHERE student_id = ?', [student.id]);
    // augment with derived academic_year (not stored)
    // Also resolve `updated_by` (email or clerk:id) to clerk name when possible
    const updatedByValues = Array.from(new Set(scholarship.map(s => s.updated_by).filter(Boolean)));
    const clerkIds = [];
    const clerkEmails = [];
    for (const v of updatedByValues) {
      if (!v) continue;
      const sv = String(v);
      if (sv.startsWith('clerk:')) {
        const idPart = sv.split(':')[1];
        if (idPart) clerkIds.push(idPart);
      } else if (sv.includes('@')) {
        clerkEmails.push(sv);
      }
    }

    const clerksById = {};
    const clerksByEmail = {};
    if (clerkIds.length) {
      const rows = await query(`SELECT id, name, email FROM clerks WHERE id IN (${clerkIds.map(() => '?').join(',')})`, clerkIds);
      for (const r of rows) clerksById[String(r.id)] = r;
    }
    if (clerkEmails.length) {
      const rows = await query(`SELECT id, name, email FROM clerks WHERE email IN (${clerkEmails.map(() => '?').join(',')})`, clerkEmails);
      for (const r of rows) clerksByEmail[String(r.email)] = r;
    }

    scholarship = scholarship.map(s => {
      const row = { ...s, academic_year: computeAcademicYear(student.roll_no, s.year) };
      const ub = row.updated_by;
      if (ub) {
        const su = String(ub);
        if (su.startsWith('clerk:')) {
          const id = su.split(':')[1];
          if (id && clerksById[id]) row.updated_by_name = clerksById[id].name || clerksById[id].email;
        } else if (su.includes('@')) {
          if (clerksByEmail[su]) row.updated_by_name = clerksByEmail[su].name || clerksByEmail[su].email;
        }
      }
      return row;
    });

    return NextResponse.json({ student, personal, academic, feeDetails, scholarship });
  } catch (error) {
    console.error('Error fetching student data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req, ctx) {
  const cookieStore = cookies();
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

    const updatedBy = decoded.email || (decoded.id ? `clerk:${decoded.id}` : null);

    // Update fees (if any)
    if (fees) {
      for (const fee of fees) {
        if (fee.id && !String(fee.id).startsWith('new-')) {
          await query(
            'UPDATE student_fee_transactions SET challan_type = ?, challan_no = ?, date = ?, amount = ?, bank_name_branch = ?, upit_no = ? WHERE id = ? AND student_id = ?',
            [toNull(fee.challan_type), toNull(fee.challan_no), toNull(fee.date), toNull(fee.amount), toNull(fee.bank_name_branch), toNull(fee.upit_no), fee.id, student.id]
          );
        } else {
          await query(
            'INSERT INTO student_fee_transactions (student_id, challan_type, challan_no, date, amount, bank_name_branch, upit_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student.id, toNull(fee.challan_type), toNull(fee.challan_no), toNull(fee.date), toNull(fee.amount), toNull(fee.bank_name_branch), toNull(fee.upit_no)]
          );
        }
      }
    }

    // Update scholarship records (if any)
    if (scholarship) {
      for (const s of scholarship) {
        // Determine normalized status; if this is a non-scholar payment (application_no === rollno)
        // and amount_paid is provided, treat it as Success.
        let status = normalizeStatus(s.status);
        try {
          // If proceedings_no is provided (scholar case), treat as Success
          if (s.proceedings_no && String(s.proceedings_no).trim() !== '') {
            status = 'Success';
          } else if (String(s.application_no) === String(rollno) && s.amount_paid !== undefined && String(s.amount_paid).trim() !== '') {
            // Non-scholar payment with amount_paid -> Success
            status = 'Success';
          }
        } catch (e) {
          // ignore comparison errors and keep normalized status
        }

        if (s.id && !String(s.id).startsWith('new-')) {
          await query(
            `UPDATE scholarship SET application_no = ?, proceedings_no = ?, amount_sanctioned = ?, amount_disbursed = ?, ch_no = ?, date = ?, utr_no = ?, utr_date = ?, amount_paid = ?, status = ?, year = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND student_id = ?`,
            [toNull(s.application_no), toNull(s.proceedings_no), toNull(s.amount_sanctioned), toNull(s.amount_disbursed), toNull(s.ch_no), toNull(s.date), toNull(s.utr_no), toNull(s.utr_date), toNull(s.amount_paid), status, toNull(s.year), updatedBy, s.id, student.id]
          );
        } else {
          await query(
            `INSERT INTO scholarship (student_id, year, application_no, proceedings_no, amount_sanctioned, amount_disbursed, ch_no, date, utr_no, utr_date, amount_paid, status, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [student.id, toNull(s.year), toNull(s.application_no), toNull(s.proceedings_no), toNull(s.amount_sanctioned), toNull(s.amount_disbursed), toNull(s.ch_no), toNull(s.date), toNull(s.utr_no), toNull(s.utr_date), toNull(s.amount_paid), status, updatedBy]
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
