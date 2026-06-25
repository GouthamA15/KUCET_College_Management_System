import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { students } from '@/db/schema';
import { getNow } from '@/lib/clock';
import { getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user || !user.roll_no) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rollNo = user.roll_no;
    const now = getNow();

    await db.update(students)
      .set({ gps_consent_granted_at: now })
      .where(eq(students.roll_no, rollNo));

    return NextResponse.json({ success: true, message: 'Consent granted' });
  } catch (error) {
    console.error('GPS Consent Error:', error);
    return NextResponse.json({ error: 'Failed to process consent' }, { status: 500 });
  }
}
