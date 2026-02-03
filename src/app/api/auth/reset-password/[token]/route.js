import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

export async function POST(req, { params }) {
  try {
    const { token } = await params;
    const { password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    }

    const [tokenData] = await query('SELECT * FROM password_reset_tokens WHERE token = ?', [token]);

    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (tokenData.user_type === 'student') {
      await query('UPDATE students SET password_hash = ? WHERE roll_no = ?', [hashedPassword, tokenData.user_id]);
    } else if (tokenData.user_type === 'clerk') {
      await query('UPDATE clerks SET password_hash = ? WHERE email = ?', [hashedPassword, tokenData.user_id]);
    } else if (tokenData.user_type === 'admin') {
      await query('UPDATE principal SET password_hash = ? WHERE email = ?', [hashedPassword, tokenData.user_id]);
    } else {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 500 });
    }

    await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    return NextResponse.json({ message: 'Password reset successful' }, { status: 200 });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
