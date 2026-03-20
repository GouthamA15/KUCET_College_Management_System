import logger from '@/lib/logger';
import { db } from '@/db';
import { scholarshipWindows, students as studentsTable } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { getNow } from '@/lib/clock';
import { sendInstitutionalEmail } from '@/lib/email';

export async function GET() {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const win = await db.query.scholarshipWindows.findFirst({
      orderBy: [desc(scholarshipWindows.id)]
    });

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
    logger.error('Error fetching scholarship window:', error);
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

    const existing = await db.query.scholarshipWindows.findFirst({
      orderBy: [desc(scholarshipWindows.id)]
    });

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
      await db.update(scholarshipWindows)
        .set({ academic_year: academicYear, start_date: startDate, end_date: endDate })
        .where(eq(scholarshipWindows.id, existing.id));
      id = existing.id;
    } else {
      const [result] = await db.insert(scholarshipWindows).values({
        academic_year: academicYear,
        start_date: startDate,
        end_date: endDate
      });
      id = result.insertId;
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

    // Email notifications based on event type
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
          return String(dateStr);
        };

        const formattedStart = formatDateDDMMYYYY(startDate);
        const formattedEnd = formatDateDDMMYYYY(endDate);
        
        const eligibleStudents = await db.select({ id: studentsTable.id, name: studentsTable.name, email: studentsTable.email })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.fee_reimbursement, 'YES'),
            eq(studentsTable.student_status, 'ACTIVE'),
            sql`${studentsTable.email} IS NOT NULL`,
            sql`${studentsTable.email} <> ''`
          ));

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
          (eligibleStudents || []).map((s) =>
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
      } catch (e) {
        logger.error('Failed to send scholarship window notification emails:', e);
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
    logger.error('Error saving scholarship window:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
