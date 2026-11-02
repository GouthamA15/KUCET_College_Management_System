import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Building2, 
  Calendar, 
  GraduationCap, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { 
  validateRollNo, 
  canonicalizeRollNo, 
  getBranchFromRoll, 
  getBatchFromRoll, 
  getEntryYearFromRoll 
} from '@/lib/rollNumber';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails 
} from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';

const BRANCH_FULL_NAMES = {
  CSE: 'Computer Science & Engineering',
  CSD: 'Computer Science & Data Science',
  ECE: 'Electronics & Communication Engineering',
  EEE: 'Electrical & Electronics Engineering',
  CIVIL: 'Civil Engineering',
  IT: 'Information Technology',
  MECH: 'Mechanical Engineering',
};

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

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const rawRoll = resolvedParams?.rollno || '';
  const cleanRoll = canonicalizeRollNo(rawRoll.trim());
  return {
    title: `Student Verification: ${cleanRoll || 'KUCET'} | Institutional Portal`,
    description: `Official student identity verification record for Kakatiya University College of Engineering and Technology (KUCET).`,
  };
}

export default async function PublicStudentVerificationPage({ params }) {
  const resolvedParams = await params;
  const rawRoll = resolvedParams?.rollno || '';
  const cleanRoll = canonicalizeRollNo(rawRoll.trim());
  const validation = validateRollNo(cleanRoll);

  if (!validation.isValid) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md mx-auto w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Invalid Roll Number Format</h1>
            <p className="mt-2 text-sm text-slate-600">
              The provided identifier <code className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">{rawRoll || 'Empty'}</code> does not match standard KUCET hall ticket formatting.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0b3578] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-blue-900 transition shadow-sm"
          >
            ← Return to KUCET Portal
          </Link>
        </div>
      </div>
    );
  }

  // Fetch student strictly from authoritative database
  let studentData = null;
  try {
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

    if (rows.length > 0) {
      studentData = rows[0];
    }
  } catch (_err) {
    // DB error
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md mx-auto w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Record Not Found</h1>
            <p className="mt-2 text-sm text-slate-600">
              No active student record could be located for roll number <code className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{cleanRoll}</code>.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              If this is an active student, please contact the College Admission Section for verification.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0b3578] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-blue-900 transition shadow-sm"
          >
            ← Return to KUCET Portal
          </Link>
        </div>
      </div>
    );
  }

  const branch = validation.branch || getBranchFromRoll(cleanRoll) || '';
  const branchFullName = BRANCH_FULL_NAMES[branch] || branch;
  const academicYear = getBatchFromRoll(cleanRoll) || '';
  const admissionYear = getEntryYearFromRoll(cleanRoll) || '';
  const maskedMobile = maskPhoneNumber(studentData.mobile);

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-6">
        
        {/* Institutional Top Bar */}
        <div className="bg-[#0b3578] text-white p-6 rounded-2xl shadow-md border border-[#0b3578] relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img
                src="/assets/ku-college-logo.png"
                alt="KUCET Crest"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Kakatiya University Campus
              </span>
              <h1 className="text-lg sm:text-xl font-black tracking-tight leading-snug">
                KU College of Engineering & Technology
              </h1>
              <p className="text-xs text-blue-100 font-medium">
                Vidyaranyapuri, Warangal — 506 009, Telangana
              </p>
            </div>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Status Banner */}
          <div className="bg-emerald-500 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Official Institutional Verification
              </span>
            </div>
            <span className="text-[11px] font-mono bg-emerald-600/70 px-2.5 py-0.5 rounded-full font-bold">
              VERIFIED ACTIVE
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Student Primary Identity Header */}
            <div className="border-b border-slate-100 pb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Enrolled Student Name
              </span>
              <h2 className="text-2xl font-black text-[#0b3578] tracking-tight uppercase mt-0.5">
                {studentData.name || 'N/A'}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  H.T. NO: {cleanRoll}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-[#0b3578] border border-blue-100">
                  B.Tech ({branch})
                </span>
              </div>
            </div>

            {/* Academic & Institutional Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <User className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Father&apos;s Name</span>
                </div>
                <p className="text-xs font-bold text-slate-900 uppercase">
                  {studentData.father_name || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Department / Branch</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {branchFullName}
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Academic Batch</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {academicYear}
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Admission Year</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {admissionYear}
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Validity Period</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {academicYear}
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Verified Contact</span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-900">
                  {maskedMobile}
                </p>
              </div>
            </div>

            {/* Institution Metadata */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#0b3578]">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wide">
                  KU College of Engineering & Technology
                </span>
              </div>
              <p className="text-[11px] text-slate-600 pl-5">
                Constituent College of Kakatiya University, Accredited with &apos;A+&apos; Grade by NAAC.
              </p>
            </div>

            {/* Privacy & Zero-Trust Notice */}
            <div className="bg-slate-100/70 p-4 rounded-xl border border-slate-200 text-slate-500 text-[11px] leading-relaxed space-y-1">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Institutional Data Sovereignty & Privacy Safeguard
              </p>
              <p>
                This record verifies official enrollment at KUCET. Under institutional privacy policy, sensitive records (including photographs, full residential address, complete telephone numbers, and Aadhaar identifiers) are strictly redacted on public verification endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* Portal Footer Action */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs font-bold text-[#0b3578] hover:underline uppercase tracking-wider"
          >
            ← Access KUCET College Management System
          </Link>
        </div>

      </div>
    </div>
  );
}
