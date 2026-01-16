import { query } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const { name, email, employee_id, password } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Name, email, and password are required' }), { status: 400 });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      'INSERT INTO clerk (name, email, employee_id, password_hash) VALUES (?, ?, ?, ?)',
      [name, email, employee_id, passwordHash]
    );

    return new Response(JSON.stringify({ success: true, clerkId: result.insertId }), { status: 201 });
  } catch (error) {
    console.error('Error creating clerk:', error);
    // Check for duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'Email or Employee ID already exists' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
