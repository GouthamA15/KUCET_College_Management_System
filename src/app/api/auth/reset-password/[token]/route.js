import { query, getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Validation endpoint (read-only): check token status
export async function GET(req, { params }) {
  try {
    // `params` may be a Promise in Next.js dynamic route handlers; await it.
    const resolved = params ? await params : {};
    const { token } = resolved || {};
    if (!token) {
      console.log('[RESET VALIDATION] missing token');
      return NextResponse.json({ status: 'INVALID' }, { status: 400 });
    }

    // Debug logging (temporary)
    try { console.log(`[RESET VALIDATION] rawToken length=${String(token).length}, alg=sha256`); } catch (e) {}

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log(`[RESET VALIDATION] incomingHash=${tokenHash}`);

    const rows = await query('SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
    console.log('[RESET VALIDATION] db rows found=', rows?.length ?? 0);
    const tokenData = rows[0];

    if (!tokenData) {
      console.log('[RESET VALIDATION] tokenData not found for hash');
      return NextResponse.json({ status: 'INVALID' }, { status: 400 });
    }
    if (tokenData.used_at) {
      console.log('[RESET VALIDATION] token already used_at=', tokenData.used_at);
      return NextResponse.json({ status: 'USED' }, { status: 409 });
    }
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('[RESET VALIDATION] token expired at=', tokenData.expires_at);
      return NextResponse.json({ status: 'EXPIRED' }, { status: 410 });
    }

    return NextResponse.json({ status: 'VALID' }, { status: 200 });
  } catch (err) {
    console.error('RESET TOKEN VALIDATION ERROR:', err);
    return NextResponse.json({ status: 'INVALID' }, { status: 400 });
  }
}

// Consumption endpoint: set new password and mark token used in a transaction
export async function POST(req, { params }) {
  let conn;
  try {
    const resolved = params ? await params : {};
    const { token } = resolved || {};
    const { password } = await req.json();

    if (!token || !password) {
      console.log('[RESET CONSUME] missing token or password');
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    }

    try { console.log(`[RESET CONSUME] rawToken length=${String(token).length}, alg=sha256`); } catch (e) {}
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log(`[RESET CONSUME] incomingHash=${tokenHash}`);
    const rows = await query('SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
    console.log('[RESET CONSUME] db rows found=', rows?.length ?? 0);
    const tokenData = rows[0];

    if (!tokenData) {
      console.log('[RESET CONSUME] tokenData not found for hash');
      return NextResponse.json({ status: 'INVALID' }, { status: 400 });
    }
    if (tokenData.used_at) {
      console.log('[RESET CONSUME] token already used_at=', tokenData.used_at);
      return NextResponse.json({ status: 'USED' }, { status: 409 });
    }
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('[RESET CONSUME] token expired at=', tokenData.expires_at);
      return NextResponse.json({ status: 'EXPIRED' }, { status: 410 });
    }

    // Begin transaction
    const pool = getDb();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let updateResult;
    if (tokenData.user_type === 'student') {
      updateResult = await conn.execute('UPDATE students SET password_hash = ? WHERE roll_no = ?', [hashedPassword, tokenData.user_id]);
    } else if (tokenData.user_type === 'clerk') {
      updateResult = await conn.execute('UPDATE clerks SET password_hash = ? WHERE email = ?', [hashedPassword, tokenData.user_id]);
    } else if (tokenData.user_type === 'admin') {
      updateResult = await conn.execute('UPDATE principal SET password_hash = ? WHERE email = ?', [hashedPassword, tokenData.user_id]);
    } else {
      await conn.rollback();
      return NextResponse.json({ error: 'Invalid user type' }, { status: 500 });
    }

    // Mark token as used (single-use) - only succeed if token wasn't used concurrently
    const [res] = await conn.execute('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', [new Date(), tokenHash]);
    // res.affectedRows may be available depending on driver
    const affected = res && (res.affectedRows ?? res.affected_rows ?? (Array.isArray(res) ? res[0]?.affectedRows : undefined));

    if (!affected || affected === 0) {
      await conn.rollback();
      return NextResponse.json({ status: 'USED' }, { status: 409 });
    }

    await conn.commit();
    return NextResponse.json({ message: 'Password reset successful' }, { status: 200 });
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    try { if (conn) await conn.rollback(); } catch (e) {}
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    try { if (conn) conn.release(); } catch (e) {}
  }
}