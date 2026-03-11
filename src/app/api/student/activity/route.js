import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getCurrentAcademicYear } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const studentRoll = user.roll_no;
    if (!studentRoll) return apiError('Student roll number not found in session', 400);

    // Resolve student id
    const students = await query('SELECT id FROM students WHERE roll_no = ?', [studentRoll]);
    if (!students || students.length === 0) {
      return apiResponse({
        scholarshipThumbUpdate: { active: false },
        scholarshipHardcopyPending: { active: false },
      });
    }
    const studentId = students[0].id;

    // STEP 1 — Determine current academic year for this student using helper
    const collegeRows = await query('SELECT * FROM college_info WHERE id = 1', []);
    const collegeInfo = collegeRows && collegeRows[0] ? collegeRows[0] : null;

    let currentAcademicYear = null;
    try {
      currentAcademicYear = getCurrentAcademicYear(studentRoll, collegeInfo) || null;
    } catch {
      currentAcademicYear = null;
    }

    if (!currentAcademicYear) {
      return apiResponse({
        scholarshipThumbUpdate: { active: false },
        scholarshipHardcopyPending: { active: false },
        scholarshipApplicationReceived: { active: false },
        scholarshipApplicationsOpen: { active: false },
      });
    }

    // STEP 2 — Fetch latest scholarship window
    const windowRows = await query(
      'SELECT academic_year, start_date, end_date FROM scholarship_windows ORDER BY id DESC LIMIT 1',
      []
    );
    const win = windowRows && windowRows[0] ? windowRows[0] : null;

    let windowOpen = false;
    let windowStart = null;
    let windowEnd = null;

    if (win && win.start_date && win.end_date) {
      const today = new Date();
      const start = new Date(win.start_date);
      const end = new Date(win.end_date);
      if (today >= start && today <= end) {
        windowOpen = true;
        windowStart = win.start_date;
        windowEnd = win.end_date;
      }
    }

    // STEP 3 — Fetch scholarship record for CURRENT academic year only
    const recordRows = await query(
      'SELECT application_no, hardcopy_submitted, thumb_update_available, thumb_status FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ? ORDER BY id DESC LIMIT 1',
      [studentId, currentAcademicYear]
    );
    const rec = recordRows && recordRows[0] ? recordRows[0] : null;

    const applicationNo = rec && rec.application_no ? String(rec.application_no).trim() : null;
    const hardcopySubmitted = rec ? Number(rec.hardcopy_submitted) === 1 : false;
    const thumbAvailable = rec ? Number(rec.thumb_update_available) === 1 : false;
    const thumbPending = thumbAvailable && String(rec.thumb_status || '').trim().toUpperCase() === 'PENDING';

    // STEP 4 — Build lifecycle activities based on current academic year

    // Activity 1 — Scholarship Applications Open
    const scholarshipApplicationsOpen = windowOpen && !applicationNo
      ? {
          active: true,
          startDate: windowStart,
          endDate: windowEnd,
          academic_year: currentAcademicYear,
        }
      : { active: false };

    // Activity 2 — Submit Hard Copies
    const scholarshipHardcopyPending = applicationNo && !hardcopySubmitted
      ? {
          active: true,
          application_no: applicationNo,
          academic_year: currentAcademicYear,
        }
      : { active: false };

    // Activity 3 — Application Received
    const scholarshipApplicationReceived = hardcopySubmitted && !thumbAvailable
      ? {
          active: true,
          academic_year: currentAcademicYear,
        }
      : { active: false };

    // Activity 4 — Thumb Verification Required
    const scholarshipThumbUpdate = thumbPending
      ? {
          active: true,
          application_no: applicationNo,
          academic_year: currentAcademicYear,
        }
      : { active: false };

    return apiResponse({
      scholarshipThumbUpdate,
      scholarshipHardcopyPending,
      scholarshipApplicationReceived,
      scholarshipApplicationsOpen,
    });
  } catch (error) {
    console.error('Failed to fetch student activity', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
