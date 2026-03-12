import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { getNow } from '@/lib/clock';
import { sendInstitutionalEmail } from '@/lib/email';

export async function GET() {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const rows = await query(
      'SELECT id, academic_year, start_date, end_date FROM scholarship_windows ORDER BY id DESC LIMIT 1',
      []
    );
    const win = rows && rows[0] ? rows[0] : null;

    if (!win) {
      return apiResponse({ window: null });
    }

    let status = 'CLOSED';
    if (win.start_date && win.end_date) {
      const now = await getNow();
      const start = new Date(win.start_date);
      const end = new Date(win.end_date);
      const today = new Date(now.toISOString().slice(0, 10));
      if (today >= start && today <= end) {
        status = 'OPEN';
      }
    }

    return apiResponse({
      window: {
        id: win.id,
        startDate: win.start_date,
        endDate: win.end_date,
        status,
      },
    });
  } catch (error) {
    console.error('Error fetching scholarship window:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const rawStart = body.startDate;
    const rawEnd = body.endDate;

    const startDate = toMySQLDate(rawStart);
    const endDate = toMySQLDate(rawEnd);

    if (!startDate || !endDate) {
      return apiError('Invalid start or end date', 400);
    }

    if (new Date(startDate) > new Date(endDate)) {
      return apiError('Start date cannot be after end date', 400);
    }

    const rows = await query(
      'SELECT id, academic_year, start_date, end_date FROM scholarship_windows ORDER BY id DESC LIMIT 1',
      []
    );
    const existing = rows && rows[0] ? rows[0] : null;

    const oldStartDate = existing?.start_date || null;
    const oldEndDate = existing?.end_date || null;
    const oldAcademicYear = existing?.academic_year || null;

    // Derive academic year label from startDate (e.g., 2025-26)
    const startYear = new Date(startDate).getFullYear();
    const academicYear = `${startYear}-${String(startYear + 1).slice(-2)}`;

    // Determine event type
    let eventType = null; // 'WINDOW_CREATED' | 'WINDOW_EXTENDED' | null
    if (!existing || !oldAcademicYear || oldAcademicYear !== academicYear) {
      eventType = 'WINDOW_CREATED';
    } else if (oldEndDate) {
      const newEnd = new Date(endDate);
      const prevEndDate = new Date(oldEndDate);
      if (newEnd > prevEndDate) {
        eventType = 'WINDOW_EXTENDED';
      }
    }

    let id;
    if (existing) {
      await query(
        'UPDATE scholarship_windows SET academic_year = ?, start_date = ?, end_date = ? WHERE id = ?',
        [academicYear, startDate, endDate, existing.id]
      );
      id = existing.id;
    } else {
      const result = await query(
        'INSERT INTO scholarship_windows (academic_year, start_date, end_date) VALUES (?, ?, ?)',
        [academicYear, startDate, endDate]
      );
      id = result?.insertId || result?.[0]?.insertId || null;
    }

    // Compute current status for UI (OPEN/CLOSED)
    let status = 'CLOSED';
    const now = await getNow();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date(now.toISOString().slice(0, 10));
    if (today >= start && today <= end) {
      status = 'OPEN';
    }

    // STEP 5–8: Email notifications based on event type
    // Do not send if the computed window status is CLOSED (e.g., deadline has passed or not yet open)
    if ((eventType === 'WINDOW_CREATED' || eventType === 'WINDOW_EXTENDED') && status === 'OPEN') {
      try {
        const formatDateDDMMYYYY = (dateStr) => {
          if (!dateStr) return 'N/A';
          const d = new Date(dateStr);
          if (!Number.isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
          }
          const parts = String(dateStr).split('-');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return String(dateStr);
        };

        const formattedStart = formatDateDDMMYYYY(startDate);
        const formattedEnd = formatDateDDMMYYYY(endDate);
        const students = await query(
          "SELECT id, name, email FROM students WHERE fee_reimbursement = 'YES' AND student_status = 'ACTIVE' AND email IS NOT NULL AND email <> ''",
          []
        );

        const subject =
          eventType === 'WINDOW_CREATED'
            ? 'Scholarship Applications Open'
            : 'Scholarship Submission Deadline Extended';

        const title = subject;

          const bodyHtml =
          eventType === 'WINDOW_CREATED'
            ? `<p>Dear Student,</p>
               <p>Scholarship applications are now open for the academic year ${academicYear}.</p>
               <p>Please apply online and submit the required hard copy documents at the scholarship office.</p>
              <p>Start Date: ${formattedStart}<br/>Last Date: ${formattedEnd}</p>
               <p>KU College of Engineering &amp; Technology<br/>Warangal</p>`
            : `<p>Dear Student,</p>
               <p>The deadline for scholarship document submission has been extended.</p>
               <p>Please submit your scholarship hard copy documents before the new deadline.</p>
              <p>New Last Date: ${formattedEnd}</p>
               <p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;

        await Promise.all(
          (students || []).map((s) =>
            sendInstitutionalEmail({
              to: s.email,
              subject,
              title,
              bodyHtml,
              infoRows: [
                { label: 'Academic Year', value: academicYear },
                { label: 'Student Name', value: s.name || 'Student' },
              ],
            }).catch(() => null)
          )
        );

        console.log(
          'Scholarship window notification sent',
          'Event:',
          eventType,
          'Eligible students notified:',
          students?.length || 0
        );
      } catch (e) {
        console.error('Failed to send scholarship window notification emails:', e);
      }
    }

    return apiResponse(
      {
        window: {
          id,
          startDate,
          endDate,
          status,
        },
      },
      existing ? 200 : 201
    );
  } catch (error) {
    console.error('Error saving scholarship window:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
