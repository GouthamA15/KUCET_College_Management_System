import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Middleware should have already verified admin_auth cookie
    const clerks = await query('SELECT id, name, email, employee_id, role, is_active, created_at, updated_at FROM clerks');
    return NextResponse.json(clerks);
  } catch (error) {
    console.error('Error fetching clerks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
