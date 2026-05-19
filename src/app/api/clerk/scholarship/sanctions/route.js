import logger from '@/lib/logger';
import { db } from '@/db';
import { scholarshipSanctions, students as studentsTable, scholarshipWindows } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { sendInstitutionalEmail } from '@/lib/email';
import { getNow } from '@/lib/clock';

const toNull = (v) => (v === undefined || v === '' ? null : v);

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const roll_no = String(body.roll_no || '').trim();
    const academic_year = String(body.academic_year || '').trim();
    const application_no = toNull(body.application_no);
    const proceeding_no_raw = String(body.proceeding_no || '').trim();
    const proceeding_no = toNull(proceeding_no_raw);
    const sanctioned_amount_raw = body.sanctioned_amount;
    const sanctioned_amount = (sanctioned_amount_raw === undefined || sanctioned_amount_raw === null || sanctioned_amount_raw === '') ? null : Number(sanctioned_amount_raw);
    const sanction_date = sanctioned_amount !== null ? toMySQLDate(body.sanction_date) : null;

    if (!roll_no) return apiError('Missing roll_no', 400);
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return apiError('Invalid academic_year', 400);
    if (!application_no) return apiError('Missing application_no', 400);

    // Strict Format Validation: Must be purely numeric and between 6 to 15 digits
    const cleanAppStr = String(application_no).trim();
    if (!/^\d+$/.test(cleanAppStr)) {
      return apiError('application_no must be a numeric string', 400);
    }
    if (cleanAppStr.length < 6 || cleanAppStr.length > 15) {
      return apiError('application_no must be between 6 and 15 digits', 400);
    }

    if (sanctioned_amount !== null && !(sanctioned_amount > 0)) return apiError('Invalid sanctioned_amount', 400);
    if (sanctioned_amount !== null && !proceeding_no) return apiError('Missing proceeding_no for provided amount', 400);
    if (sanctioned_amount !== null && !sanction_date) return apiError('Invalid sanction_date', 400);

    const studentRows = await db.select({ id: studentsTable.id, name: studentsTable.name, email: studentsTable.email, is_email_verified: studentsTable.is_email_verified })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, roll_no))
      .limit(1);
    
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    // Determine if scholarship window is currently OPEN
    let windowAllowsEmail = false;
    try {
      const win = await db.query.scholarshipWindows.findFirst({
        orderBy: [desc(scholarshipWindows.id)]
      });
      if (win && win.start_date && win.end_date) {
        const now = await getNow();
        const today = new Date(now.toISOString().slice(0, 10));
        const start = new Date(win.start_date);
        const end = new Date(win.end_date);
        if (today >= start && today <= end) {
          windowAllowsEmail = true;
        }
      }
    } catch (e) {
      logger.error('Failed to evaluate scholarship window for sanction emails:', e);
    }

    // Fetch existing rows for student + academic_year
    const existing = await db.query.scholarshipSanctions.findMany({
      where: and(
        eq(scholarshipSanctions.student_id, student.id),
        eq(scholarshipSanctions.academic_year, academic_year)
      )
    });

    const providedProceeding = proceeding_no && String(proceeding_no).trim() !== '' ? String(proceeding_no).trim() : null;
    const providedApp = application_no && String(application_no).trim() !== '' ? String(application_no).trim() : null;
    
    const providedThumbFlag = body.thumb_update_available ? 1 : 0;
    const providedThumbStatus = body.thumb_status ? String(body.thumb_status) : null;
    const thumbIsPending = typeof providedThumbStatus === 'string'
      && providedThumbStatus.trim().toUpperCase() === 'PENDING';
    const providedHardcopyFlag = body.hardcopy_submitted ? 1 : 0;

    const prevThumb = existing.some(r => !!r.thumb_update_available);
    const prevHasApplication = existing.some(r => r.application_no && String(r.application_no).trim() !== '');

    let targetRowId = null;
    let isNewInsert = false;

    if (providedProceeding) {
      const existingRow = existing.find(r => String(r.proceeding_no || '') === providedProceeding) || null;
      if (existingRow) {
        await db.update(scholarshipSanctions)
          .set({ 
            sanctioned_amount: sanctioned_amount ? String(sanctioned_amount) : null, 
            sanction_date: sanction_date, 
            application_no: sql`COALESCE(${scholarshipSanctions.application_no}, ${providedApp})` 
          })
          .where(eq(scholarshipSanctions.id, existingRow.id));
        targetRowId = existingRow.id;
      } else {
        const baseRow = existing.find(r => !r.proceeding_no) || null;
        if (baseRow) {
          await db.update(scholarshipSanctions)
            .set({ 
              proceeding_no: providedProceeding, 
              sanctioned_amount: sanctioned_amount ? String(sanctioned_amount) : null, 
              sanction_date: sanction_date, 
              application_no: sql`COALESCE(${scholarshipSanctions.application_no}, ${providedApp})` 
            })
            .where(eq(scholarshipSanctions.id, baseRow.id));
          targetRowId = baseRow.id;
        } else {
          const [ins] = await db.insert(scholarshipSanctions).values({
            student_id: student.id,
            academic_year: academic_year,
            application_no: providedApp,
            proceeding_no: providedProceeding,
            sanctioned_amount: sanctioned_amount ? String(sanctioned_amount) : null,
            sanction_date: sanction_date
          });
          targetRowId = ins.insertId;
          isNewInsert = true;
        }
      }
    } else {
      const baseRow = existing.find(r => !r.proceeding_no) || null;
      if (baseRow) {
        if (providedApp && !baseRow.application_no) {
          await db.update(scholarshipSanctions)
            .set({ application_no: providedApp })
            .where(eq(scholarshipSanctions.id, baseRow.id));
        }
        targetRowId = baseRow.id;
      } else {
        const [ins] = await db.insert(scholarshipSanctions).values({
          student_id: student.id,
          academic_year: academic_year,
          application_no: providedApp,
          proceeding_no: null,
          sanctioned_amount: null,
          sanction_date: null
        });
        targetRowId = ins.insertId;
        isNewInsert = true;
      }
    }

    // MANDATORY SYNC STEP: Update flags for this specific year
    await db.update(scholarshipSanctions)
      .set({ 
        hardcopy_submitted: providedHardcopyFlag, 
        thumb_update_available: providedThumbFlag === 1, 
        thumb_status: providedThumbStatus 
      })
      .where(and(
        eq(scholarshipSanctions.student_id, student.id),
        eq(scholarshipSanctions.academic_year, academic_year)
      ));

    // AUTOMATED PROPAGATION: If application_no is provided, propagate it to all other years for this student
    if (providedApp) {
      await db.update(scholarshipSanctions)
        .set({ application_no: providedApp })
        .where(and(
          eq(scholarshipSanctions.student_id, student.id),
          or(
            sql`${scholarshipSanctions.application_no} IS NULL`,
            eq(scholarshipSanctions.application_no, '')
          )
        ));
    }

    const currentApp = providedApp || (existing.find(r => r.application_no)?.application_no) || null;

    // Email trigger: Thumb Verification
    if (!prevThumb && providedThumbFlag && thumbIsPending && windowAllowsEmail) {
      try {
        if (student.email && student.is_email_verified) {
          const subject = 'Scholarship Thumb Verification Required';
          const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application requires biometric (thumb) verification. Please visit your nearest Mee-Seva center to complete the verification process.</p><p>Application Number: ${currentApp || ''}</p><p>Academic Year: ${academic_year}</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
          await sendInstitutionalEmail({ 
            to: student.email, 
            subject, 
            title: subject, 
            bodyHtml: html, 
            infoRows: [
              { label: 'Application Number', value: currentApp || '' }, 
              { label: 'Academic Year', value: academic_year }
            ] 
          });
        }
      } catch (e) {
        logger.error('Failed to send thumb notification email:', e);
      }
    }

    // Email trigger: Hard Copy Submission
    if (!prevHasApplication && currentApp && providedHardcopyFlag === 0 && windowAllowsEmail) {
      try {
        if (student.email && student.is_email_verified) {
          const subject = 'Scholarship Hard Copy Submission Required';
          const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${currentApp}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
          await sendInstitutionalEmail({
            to: student.email,
            subject,
            title: subject,
            bodyHtml: html,
            infoRows: [
              { label: 'Application Number', value: currentApp },
              { label: 'Academic Year', value: academic_year },
            ],
          });
        }
      } catch (e) {
        logger.error('Failed to send hardcopy submission email:', e);
      }
    }

    return apiResponse({ 
      id: targetRowId, 
      student_id: student.id, 
      academic_year, 
      application_no: currentApp, 
      proceeding_no: providedProceeding, 
      sanctioned_amount, 
      sanction_date 
    }, isNewInsert ? 201 : 200);
  } catch (error) {
    logger.error('Error inserting sanction:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
