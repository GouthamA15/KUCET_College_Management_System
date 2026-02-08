import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getCurrentStudyingYear, branchCodes } from '@/lib/rollNumber'; // Import branchCodes

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

// Helper to get branch code from branch name
function getBranchCodeFromName(branchName) {
    const entry = Object.entries(branchCodes).find(([, name]) => name === branchName);
    return entry ? entry[0] : null;
}

export async function GET(request) {
  const cookieStore = await cookies();
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studyingYear = searchParams.get('studyingYear'); // Renamed from 'year'
  const branchName = searchParams.get('branch'); // Renamed to branchName

  if (!studyingYear || !branchName) {
    return NextResponse.json({ error: 'Studying year and branch are required' }, { status: 400 });
  }

  const branchCode = getBranchCodeFromName(branchName);
  if (!branchCode) {
    return NextResponse.json({ error: 'Invalid branch name provided' }, { status: 400 });
  }

  try {
    // Fetch all students that belong to the given branch code (regardless of entry year for now)
    // We will filter by studyingYear programmatically using rollNumber.js utilities
    const studentsFromDb = await query('SELECT id, roll_no, name FROM students WHERE roll_no LIKE ? OR roll_no LIKE ?', [
      `%T${branchCode}%`, // Regular pattern (e.g., %T09%)
      `%${branchCode}%L`, // Lateral pattern (e.g., %09L)
    ]);

    const filteredStudents = studentsFromDb.filter(student => {
      const studentBranch = getBranchFromRoll(student.roll_no);
      const studentStudyingYear = getCurrentStudyingYear(student.roll_no);

      return studentBranch === branchName && String(studentStudyingYear) === studyingYear;
    });

    return NextResponse.json({ students: filteredStudents });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}