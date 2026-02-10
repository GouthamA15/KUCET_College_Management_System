import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return payload;
  } catch (e) {
    console.error('JWT Verification failed:', e);
    return null;
  }
}

const toNull = (v) => (v === undefined || v === '' ? null : v);
const formatDateForSQL = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
};

export async function POST(req) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const roll_no = String(body.roll_no || '').trim();
    const academic_year = String(body.academic_year || '').trim();
    const application_no = toNull(body.application_no);
    const proceeding_no_raw = String(body.proceeding_no || '').trim();
    const proceeding_no = toNull(proceeding_no_raw);
    const sanctioned_amount_raw = body.sanctioned_amount;
    const sanctioned_amount = (sanctioned_amount_raw === undefined || sanctioned_amount_raw === null || sanctioned_amount_raw === '') ? null : Number(sanctioned_amount_raw);
    const sanction_date = sanctioned_amount !== null ? formatDateForSQL(body.sanction_date) : null;

    if (!roll_no) return NextResponse.json({ error: 'Missing roll_no' }, { status: 400 });
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return NextResponse.json({ error: 'Invalid academic_year' }, { status: 400 });
    if (!application_no) return NextResponse.json({ error: 'Missing application_no' }, { status: 400 });
    // Proceeding number is OPTIONAL at creation; if amount is provided, require a proceeding number
    if (sanctioned_amount !== null && !(sanctioned_amount > 0)) return NextResponse.json({ error: 'Invalid sanctioned_amount' }, { status: 400 });
    if (sanctioned_amount !== null && !proceeding_no) return NextResponse.json({ error: 'Missing proceeding_no for provided amount' }, { status: 400 });
    // Sanction date is required only when amount is provided
    if (sanctioned_amount !== null && !sanction_date) return NextResponse.json({ error: 'Invalid sanction_date' }, { status: 400 });

    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    // Fetch existing rows for student + academic_year
    const existing = await query('SELECT id, application_no, proceeding_no FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ?', [student.id, academic_year]);

    // Determine operation: UPDATE existing row or INSERT new
    const providedProceeding = proceeding_no && String(proceeding_no).trim() !== '' ? String(proceeding_no).trim() : null;
    const providedApp = application_no && String(application_no).trim() !== '' ? String(application_no).trim() : null;

    // If proceeding_no provided, try to update row with same proceeding; otherwise update base row with null proceeding; else insert
    let targetRow = null;
    if (providedProceeding) {
      targetRow = existing.find(r => String(r.proceeding_no || '') === providedProceeding) || null;
      if (targetRow) {
        // Update existing row matching proceeding_no
        await query('UPDATE scholarship_sanctions SET sanctioned_amount = ?, sanction_date = ?, application_no = COALESCE(application_no, ?) WHERE id = ?', [sanctioned_amount, sanction_date, providedApp, targetRow.id]);
        return NextResponse.json({ id: targetRow.id, student_id: student.id, academic_year, application_no: providedApp ?? targetRow.application_no, proceeding_no: providedProceeding, sanctioned_amount, sanction_date }, { status: 200 });
      }
      // No row with proceeding; see if base row without proceeding exists
      const baseRow = existing.find(r => !r.proceeding_no) || null;
      if (baseRow) {
        await query('UPDATE scholarship_sanctions SET proceeding_no = ?, sanctioned_amount = ?, sanction_date = ?, application_no = COALESCE(application_no, ?) WHERE id = ?', [providedProceeding, sanctioned_amount, sanction_date, providedApp, baseRow.id]);
        return NextResponse.json({ id: baseRow.id, student_id: student.id, academic_year, application_no: providedApp ?? baseRow.application_no, proceeding_no: providedProceeding, sanctioned_amount, sanction_date }, { status: 200 });
      }
      // Insert new row with provided proceeding
      const insertSql = 'INSERT INTO scholarship_sanctions (student_id, academic_year, application_no, proceeding_no, sanctioned_amount, sanction_date) VALUES (?, ?, ?, ?, ?, ?)';
      const ins = await query(insertSql, [student.id, academic_year, providedApp, providedProceeding, sanctioned_amount, sanction_date]);
      const insertedId = ins?.insertId || ins?.[0]?.insertId || null;
      return NextResponse.json({ id: insertedId, student_id: student.id, academic_year, application_no: providedApp, proceeding_no: providedProceeding, sanctioned_amount, sanction_date }, { status: 201 });
    }

    // No proceeding provided: ensure a base row exists (application-only case)
    const baseRow = existing.find(r => !r.proceeding_no) || null;
    if (baseRow) {
      // Update application_no if not set; otherwise keep existing
      if (providedApp && !baseRow.application_no) {
        await query('UPDATE scholarship_sanctions SET application_no = ? WHERE id = ?', [providedApp, baseRow.id]);
      }
      const appOut = providedApp || baseRow.application_no || null;
      return NextResponse.json({ id: baseRow.id, student_id: student.id, academic_year, application_no: appOut, proceeding_no: null, sanctioned_amount: null, sanction_date: null }, { status: 200 });
    }
    // Insert base row with application_no and nulls
    const insertSql = 'INSERT INTO scholarship_sanctions (student_id, academic_year, application_no, proceeding_no, sanctioned_amount, sanction_date) VALUES (?, ?, ?, NULL, NULL, NULL)';
    const ins = await query(insertSql, [student.id, academic_year, providedApp]);
    const insertedId = ins?.insertId || ins?.[0]?.insertId || null;
    return NextResponse.json({ id: insertedId, student_id: student.id, academic_year, application_no: providedApp, proceeding_no: null, sanctioned_amount: null, sanction_date: null }, { status: 201 });
  } catch (error) {
    console.error('Error inserting sanction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}