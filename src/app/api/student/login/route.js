import { getDb } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, dob } = body;
    if (!rollno || !dob) {
      return new Response(JSON.stringify({ error: 'Missing rollno or dob' }), { status: 400 });
    }
    const db = getDb();
    const [rows] = await db.execute(
      'SELECT rollno, student_name, father_name, gender, category, phone_no, dob FROM cse_third_year_students WHERE rollno = ?',
      [rollno]
    );
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Student not found' }), { status: 404 });
    }
    const student = rows[0];
    // Convert input dob (yyyy-mm-dd) to dd-mm-yyyy for comparison
    function toDDMMYYYY(dateStr) {
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    }
    const dobInput = dob.includes('-') && dob.length === 10 ? toDDMMYYYY(dob) : dob;
    // Convert DB value to dd-mm-yyyy (ignore time and timezone)
    function dbToDDMMYYYY(dbDob) {
      const date = new Date(dbDob);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}-${m}-${y}`;
    }
    const dbDobFormatted = dbToDDMMYYYY(student.dob);
    if (dbDobFormatted !== String(dobInput).trim()) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }
    const { dob: _dob, ...profile } = student;
    return new Response(JSON.stringify({ student: profile }), { status: 200 });
  } catch (err) {
     console.error(err)
    return new Response(JSON.stringify({ error: 'Server error', details: err.message }), { status: 500 });
  }
}
