import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;
    console.log('GET /api/auth/reset-password/[token] - Received token:', token);

    if (!token) {
      console.log('GET /api/auth/reset-password/[token] - Missing token');
      return NextResponse.json({ status: 'INVALID', error: 'Missing token' }, { status: 200 });
    }

    const [tokenData] = await query('SELECT * FROM password_reset_tokens WHERE token = ?', [token]);
    console.log('GET /api/auth/reset-password/[token] - Query result (tokenData):', tokenData);

    if (!tokenData) {
      console.log('GET /api/auth/reset-password/[token] - Token not found in DB');
      return NextResponse.json({ status: 'INVALID', error: 'Invalid token' }, { status: 200 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('GET /api/auth/reset-password/[token] - Token expired, deleting from DB');
      await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
      return NextResponse.json({ status: 'EXPIRED', error: 'Token expired' }, { status: 200 });
    }

    console.log('GET /api/auth/reset-password/[token] - Token is VALID');
    return NextResponse.json({ status: 'VALID' }, { status: 200 });
  } catch (error) {
    console.error('TOKEN VALIDATION ERROR:', error);
    return NextResponse.json({ status: 'INVALID', error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;
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

