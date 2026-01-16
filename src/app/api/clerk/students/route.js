import { getDb } from '@/lib/db';

const BRANCH_CODES = {
  '09': 'CSE',
  '30': 'CSD',
  '15': 'ECE',
  '12': 'EEE',
  '00': 'CIVIL',
  '18': 'IT',
  '03': 'MECH',
};

function getBranchFromRoll(rollno) {
    // For lateral entry, branch code is in the last 5 digits (e.g., ...XX...L)
    if (rollno.endsWith('L')) {
        const branchCode = rollno.slice(-5, -3);
        return BRANCH_CODES[branchCode];
    }
    // For regular students, branch code is in the last 4 digits (e.g., ...TXX..)
    else if (rollno.includes('T')) {
        const branchCode = rollno.slice(-4, -2);
        return BRANCH_CODES[branchCode];
    }
    return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year'); // This is the "cohort year"
    const branch = searchParams.get('branch');

    if (!year || !branch) {
      // Use NextResponse for proper JSON responses
      return new Response(JSON.stringify({ error: 'Year and branch are required' }), { status: 400 });
    }
    
    // This is a workaround for the DB connection issue, should be removed if the root cause is fixed
    const db = getDb();
    const [rows] = await db.execute('SELECT * FROM cse_students');

    const cohortYear = parseInt(year.slice(-2)); // e.g., 23 from "2023"
    const lateralAdmissionYearPrefix = (cohortYear + 1).toString(); // e.g., "24"
    const regularAdmissionYearPrefix = cohortYear.toString(); // e.g., "23"

    const filteredStudents = rows.filter(student => {
        const studentBranch = getBranchFromRoll(student.rollno);
        const branchMatch = studentBranch === BRANCH_CODES[branch];

        if (!branchMatch) {
            return false;
        }

        const isLateral = student.rollno.endsWith('L');
        const rollNoPrefix = student.rollno.substring(0, 2);

        if (isLateral) {
            return rollNoPrefix === lateralAdmissionYearPrefix;
        } else {
            return rollNoPrefix === regularAdmissionYearPrefix;
        }
    });

    return new Response(JSON.stringify({ students: filteredStudents }), { status: 200 });
  } catch (err) {
    console.error('API Route Error:', err);
    // Provide a more structured error response
    return new Response(JSON.stringify({ error: 'Server error', details: err.message }), { status: 500 });
  }
}
