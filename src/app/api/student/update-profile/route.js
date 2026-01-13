import { getDb } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, phone_no } = body;
    if (!rollno || !phone_no) {
      return new Response(JSON.stringify({ error: 'Missing rollno or phone_no' }), { status: 400 });
    }
    const db = getDb();
    const [result] = await db.execute(
      'UPDATE cse_third_year_students SET phone_no = ? WHERE rollno = ?',
      [phone_no, rollno]
    );
    if (result.affectedRows === 0) {
      return new Response(JSON.stringify({ error: 'Student not found' }), { status: 404 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error', details: err.message }), { status: 500 });
  }
}
