import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBranchFromRoll, getCurrentStudyingYear, branchCodes } from '@/lib/rollNumber';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) { // Fixed typo here
    // console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function GET(req) {
  // Verify admin
  const cookieStore = await cookies(); // Fixed: Added await here
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const students = await query('SELECT roll_no FROM students');

    const stats = {};

    for (const student of students) {
      const { roll_no } = student;
      const branch = getBranchFromRoll(roll_no);
      const year = getCurrentStudyingYear(roll_no);

      if (branch && year) {
        if (!stats[branch]) {
          stats[branch] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
        }
        if (stats[branch][year] !== undefined) {
          stats[branch][year]++;
        }
        stats[branch].total++;
      }
    }

    // Ensure all branches are present in the stats object
    const allBranchNames = Object.values(branchCodes);
    for(const branchName of allBranchNames) {
        if(!stats[branchName]) {
            stats[branchName] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
        }
    }


    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
