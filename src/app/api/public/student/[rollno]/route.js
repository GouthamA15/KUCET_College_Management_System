import { NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails 
} from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { 
  validateRollNo, 
  canonicalizeRollNo, 
  getBranchFromRoll, 
  getBatchFromRoll, 
  getEntryYearFromRoll 
} from '@/lib/rollNumber';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';

const BRANCH_FULL_NAMES = {
  CSE: 'Computer Science & Engineering',
  CSD: 'Computer Science & Data Science',
  ECE: 'Electronics & Communication Engineering',
  EEE: 'Electrical & Electronics Engineering',
  CIVIL: 'Civil Engineering',
  IT: 'Information Technology',
  MECH: 'Mechanical Engineering',
};

/**
 * Server-side telephone number masking.
 * Exposes strictly the masked prefix with the final 4 digits visible.
 * Example: 9876543210 -> ******3210
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '******0000';
  const clean = phone.trim();
  let decryptedPhone = clean;
  if (clean.split(':').length === 3) {
    try {
      decryptedPhone = decrypt(clean);
    } catch {
      return '******0000';
    }
  }
  const digits = String(decryptedPhone).replace(/\D/g, '');
  if (digits.length < 4) return '******0000';
  const last4 = digits.slice(-4);
  return `******${last4}`;
}

export async function GET(request, context) {
  const { rollno } = (await context?.params) || {};
  if (!rollno || typeof rollno !== 'string') {
    return NextResponse.json(
      { error: 'Valid roll number is required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const cleanRoll = canonicalizeRollNo(rollno.trim());
  const validation = validateRollNo(cleanRoll);
  if (!validation.isValid) {
    return NextResponse.json(
      { error: 'Invalid institutional roll number format' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    // Authoritative lookup strictly from students and student_personal_details
    const rows = await db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        name: studentsTable.name,
        mobile: studentsTable.mobile,
        student_status: studentsTable.student_status,
        academic_status: studentsTable.academic_status,
        father_name: studentPersonalDetails.father_name,
      })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .where(
        and(
          eq(studentsTable.roll_no, cleanRoll),
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED')
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Student record not found or not currently active' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const st = rows[0];
    const branch = validation.branch || getBranchFromRoll(cleanRoll) || '';
    const branchFullName = BRANCH_FULL_NAMES[branch] || branch;
    const academicYear = getBatchFromRoll(cleanRoll) || '';
    const admissionYear = getEntryYearFromRoll(cleanRoll) || '';
    const maskedMobile = maskPhoneNumber(st.mobile);

    // STRICT SERVER-SIDE FIELD ALLOWLIST:
    // Under zero-trust institutional privacy, profile photos, full addresses, full phone,
    // blood groups, Aadhaar, APAAR ID, email, and database primary keys are NEVER included.
    const publicProfile = {
      hallTicketNumber: st.roll_no,
      rollNo: st.roll_no,
      studentName: (st.name || '').toUpperCase().trim(),
      fatherName: (st.father_name || '').toUpperCase().trim(),
      course: `B.Tech (${branch})`,
      branch: branch,
      branchFullName: branchFullName,
      academicYear: academicYear,
      admissionYear: admissionYear,
      validUpto: academicYear,
      collegeName: 'KU COLLEGE OF ENGINEERING & TECHNOLOGY',
      collegeAddress: 'Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009',
      maskedContact: maskedMobile,
      verificationStatus: 'VERIFIED INSTITUTIONAL STUDENT',
      institutionalAuthority: 'Kakatiya University College of Engineering & Technology',
    };

    return NextResponse.json(
      {
        success: true,
        data: publicProfile,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    logger.error({ roll: cleanRoll, err: error.message }, 'Failed to resolve public student identification');
    return NextResponse.json(
      { error: 'Internal Server Error while verifying institutional record' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
