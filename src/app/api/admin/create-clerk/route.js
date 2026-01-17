import { query } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Name, email, password, and role are required' }), { status: 400 });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      'INSERT INTO clerks (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    return new Response(JSON.stringify({ success: true, clerkId: result.insertId }), { status: 201 });
  } catch (error) {
    console.error('Error creating clerk:', error);
    // Check for duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
