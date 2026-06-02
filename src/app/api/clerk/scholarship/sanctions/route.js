import logger from '@/lib/logger';
import { db } from '@/db';
import { scholarshipSanctions, students as studentsTable, studentPersonalDetails, studentAcademicBackground, scholarshipWindows } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import { sendInstitutionalEmail } from '@/lib/email';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { getYearlyTotalFee } from '@/lib/financial-utils';
import { calculateExpectedRTF } from '@/lib/scholarship-utils';
import IdempotencyService from '@/services/IdempotencyService';

const toNull = (v) => (!v || String(v).trim() === '') ? null : String(v).trim();

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  const idempotencyKey = req.headers.get('idempotency-key');
  let idempotencyStarted = false;

  try {
    if (idempotencyKey) {
      const { isDuplicate, response, code } = await IdempotencyService.start(idempotencyKey);
      if (isDuplicate) {
        logger.info({ key: idempotencyKey }, '[IDEMPOTENCY_HIT] Returning cached response for sanction');
        return apiResponse(response, code || 200);
      }
      idempotencyStarted = true;
    }

    const body = await req.json();
    
    // GUARANTEED TERMINAL VISIBILITY & INVESTIGATION LOGS
    if (process.env.NODE_ENV === 'development') {
      console.log('[Scholarship API] Incoming request:', JSON.stringify(body, null, 2));
      logger.info(`[Scholarship API] Incoming request for roll: ${body.roll_no}`);
    }

    const roll_no = String(body.roll_no || '').trim().toUpperCase();
    const academic_year = String(body.academic_year || '').trim();
    const application_no = toNull(body.application_no);
    const proceeding_no_raw = String(body.proceeding_no || '').trim();
    const proceeding_no = toNull(proceeding_no_raw);

    // INVESTIGATE 26000 -> 25999 BUG
    const sanctioned_amount_raw = body.sanctioned_amount;
    const sanctioned_amount = (sanctioned_amount_raw === undefined || sanctioned_amount_raw === null || sanctioned_amount_raw === '') ? null : Number(sanctioned_amount_raw);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Scholarship API DEBUG] Raw Sanctioned: ${sanctioned_amount_raw} (${typeof sanctioned_amount_raw})`);
      console.log(`[Scholarship API DEBUG] Parsed Sanctioned: ${sanctioned_amount} (${typeof sanctioned_amount})`);
    }

    const sanction_date = sanctioned_amount !== null ? toMySQLDate(body.sanction_date) : null;

    const released_amount_raw = body.released_amount;
    const released_amount = (released_amount_raw === undefined || released_amount_raw === null || released_amount_raw === '') ? null : Number(released_amount_raw);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Scholarship API DEBUG] Raw Released: ${released_amount_raw} (${typeof released_amount_raw})`);
      console.log(`[Scholarship API DEBUG] Parsed Released: ${released_amount} (${typeof released_amount})`);
    }
    const released_date = released_amount !== null ? toMySQLDate(body.released_date) : null;
    const status = (body.status || 'SANCTIONED').toUpperCase();

    if (!roll_no) return apiError('Missing roll_no', 400);
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return apiError('Invalid academic_year', 400);
    if (!application_no) return apiError('Missing application_no', 400);

    if (!['PENDING', 'SANCTIONED', 'RELEASED', 'REJECTED'].includes(status)) {
      return apiError('Invalid scholarship status', 400);
    }

    // Strict Format Validation
    const cleanAppStr = String(application_no).trim();
    if (!/^\d+$/.test(cleanAppStr)) return apiError('application_no must be numeric', 400);
    if (cleanAppStr.length < 6 || cleanAppStr.length > 15) return apiError('application_no invalid length', 400);

    if (status !== 'REJECTED' && sanctioned_amount !== null && !(sanctioned_amount > 0)) return apiError('Invalid sanctioned_amount', 400);
    if (status !== 'REJECTED' && sanctioned_amount !== null && !proceeding_no) return apiError('Missing proceeding_no for amount', 400);
    if (status !== 'REJECTED' && sanctioned_amount !== null && !sanction_date) return apiError('Invalid sanction_date', 400);

    const studentRows = await db.select({ 
        id: studentsTable.id, 
        name: studentsTable.name, 
        email: studentsTable.email, 
        is_email_verified: studentsTable.is_email_verified,
        fee_reimbursement: studentsTable.fee_reimbursement,
        category: studentPersonalDetails.category,
        religion: studentPersonalDetails.religion,
        seat_allotted_category: studentPersonalDetails.seat_allotted_category,
        ranks: studentAcademicBackground.ranks,
        previous_college_details: studentAcademicBackground.previous_college_details
    })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentPersonalDetails.student_id, studentsTable.id))
      .leftJoin(studentAcademicBackground, eq(studentAcademicBackground.student_id, studentsTable.id))
      .where(eq(studentsTable.roll_no, roll_no))
      .limit(1);
    
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    // ELIGIBILITY GUARD
    if (String(student.fee_reimbursement).toUpperCase() !== 'YES') {
      logger.warn(`[Scholarship Validation] Rejected: proceedings not allowed for non-reimbursement student ${roll_no}`);
      return apiError('Scholarship proceedings are not allowed for non-reimbursement students.', 400);
    }

    // TRANSACTIONAL EXECUTION
    const result = await db.transaction(async (tx) => {
      // Evaluate Scholarship Window
      let windowOpen = false;
      try {
        const win = await tx.query.scholarshipWindows.findFirst({ orderBy: [desc(scholarshipWindows.id)] });
        if (win && win.start_date && win.end_date) {
          const now = await getNow();
          const today = new Date(now.toISOString().slice(0, 10));
          if (today >= new Date(win.start_date) && today <= new Date(win.end_date)) {
            windowOpen = true;
          }
        }
      } catch (e) {
        console.error('[Scholarship API] Window evaluation failed:', e);
      }

      // Fetch existing rows for student + academic_year
      const existing = await tx.query.scholarshipSanctions.findMany({
        where: and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year))
      });

      const providedProceeding = proceeding_no && String(proceeding_no).trim() !== '' ? String(proceeding_no).trim() : null;

      // FINANCIAL VALIDATION (₹35,000 CAP) - INSIDE TRANSACTION
      const course = getBranchFromRoll(roll_no);
      const totalCourseFee = Number(getYearlyTotalFee(course) || 0);
      const GOVT_ELIGIBLE_CAP = calculateExpectedRTF(student, totalCourseFee);

      const existingRowForCap = providedProceeding ? existing.find(r => String(r.proceeding_no || '') === providedProceeding) : null;
      
      const otherSanctionsTotal = existing
        .filter(r => (!existingRowForCap || r.id !== existingRowForCap.id) && r.status !== 'REJECTED')
        .reduce((sum, r) => sum + Number(r.sanctioned_amount || 0), 0);
      
      const otherReleasedTotal = existing
        .filter(r => (!existingRowForCap || r.id !== existingRowForCap.id) && r.status !== 'REJECTED')
        .reduce((sum, r) => sum + Number(r.released_amount || 0), 0);

      const finalSanctionedTotal = otherSanctionsTotal + (status === 'REJECTED' ? 0 : (sanctioned_amount || 0));
      const finalReleasedTotal = otherReleasedTotal + (status === 'REJECTED' ? 0 : (released_amount || 0));

      if (status !== 'REJECTED' && sanctioned_amount !== null && finalSanctionedTotal > GOVT_ELIGIBLE_CAP) {
        throw new Error(`Scholarship sanctioned total exceeds ₹${GOVT_ELIGIBLE_CAP.toLocaleString()} government limit.`);
      }

      if (status !== 'REJECTED' && released_amount !== null && finalReleasedTotal > GOVT_ELIGIBLE_CAP) {
        throw new Error(`Scholarship released total exceeds ₹${GOVT_ELIGIBLE_CAP.toLocaleString()} government limit.`);
      }

      const prevHardcopy = existing.some(r => r.hardcopy_submitted === 1);
      const prevThumbAvailable = existing.some(r => r.thumb_update_available === 1);
      const prevThumbStatus = existing.find(r => r.thumb_update_available === 1)?.thumb_status || 'PENDING';

      const providedApp = application_no && String(application_no).trim() !== '' ? String(application_no).trim() : null;
      const providedThumbFlag = body.thumb_update_available ? 1 : 0;
      const providedThumbStatus = (body.thumb_status || 'PENDING').toUpperCase();
      const providedHardcopyFlag = body.hardcopy_submitted ? 1 : 0;

      let targetRowId = null;
      let isNewInsert = false;

      if (providedProceeding) {
        const existingRow = existing.find(r => String(r.proceeding_no || '') === providedProceeding) || null;
        if (existingRow) {
          await tx.update(scholarshipSanctions)
            .set({ 
              sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null, 
              sanction_date: sanction_date, 
              released_amount: released_amount !== null ? String(released_amount) : null,
              released_date: released_date,
              status: status,
              application_no: providedApp || existingRow.application_no 
            })
            .where(eq(scholarshipSanctions.id, existingRow.id));
          targetRowId = existingRow.id;
        } else {
          const baseRow = existing.find(r => !r.proceeding_no) || null;
          if (baseRow) {
            await tx.update(scholarshipSanctions)
              .set({ 
                proceeding_no: providedProceeding, 
                sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null, 
                sanction_date: sanction_date, 
                released_amount: released_amount !== null ? String(released_amount) : null,
                released_date: released_date,
                status: status,
                application_no: providedApp || baseRow.application_no 
              })
              .where(eq(scholarshipSanctions.id, baseRow.id));
            targetRowId = baseRow.id;
          } else {
            const [ins] = await tx.insert(scholarshipSanctions).values({
              student_id: student.id,
              academic_year: academic_year,
              application_no: providedApp || (existing.length > 0 ? existing[0].application_no : null),
              proceeding_no: providedProceeding,
              sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null,
              sanction_date: sanction_date,
              released_amount: released_amount !== null ? String(released_amount) : null,
              released_date: released_date,
              status: status
            });
            targetRowId = ins.insertId;
            isNewInsert = true;
          }
        }
      } else {
        const baseRow = existing.find(r => !r.proceeding_no) || null;
        if (baseRow) {
          if (providedApp) await tx.update(scholarshipSanctions).set({ application_no: providedApp, status: status }).where(eq(scholarshipSanctions.id, baseRow.id));
          targetRowId = baseRow.id;
        } else if (existing.length > 0) {
          if (providedApp) await tx.update(scholarshipSanctions).set({ application_no: providedApp }).where(and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year)));
          targetRowId = existing[0].id;
        } else {
          const [ins] = await tx.insert(scholarshipSanctions).values({ student_id: student.id, academic_year: academic_year, application_no: providedApp, status: status });
          targetRowId = ins.insertId;
          isNewInsert = true;
        }
      }

      // SYNC FLAGS
      await tx.update(scholarshipSanctions)
        .set({ hardcopy_submitted: providedHardcopyFlag, thumb_update_available: providedThumbFlag === 1, thumb_status: providedThumbStatus })
        .where(and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year)));

      // AUTO-PROPAGATE APPLICATION NO
      if (providedApp) {
        await tx.update(scholarshipSanctions).set({ application_no: providedApp }).where(and(eq(scholarshipSanctions.student_id, student.id), or(sql`${scholarshipSanctions.application_no} IS NULL`, eq(scholarshipSanctions.application_no, ''))));
      }

      return { targetRowId, isNewInsert, windowOpen, providedHardcopyFlag, prevHardcopy, providedThumbFlag, providedThumbStatus, prevThumbAvailable, prevThumbStatus, providedApp, existing };
    });

    const { targetRowId, isNewInsert } = result;
    const responseData = { id: targetRowId, success: true };

    if (idempotencyStarted) {
      await IdempotencyService.complete(idempotencyKey, isNewInsert ? 201 : 200, responseData);
    }

    // EMAIL TRIGGERS (OUTSIDE TRANSACTION)
    const { windowOpen, providedHardcopyFlag, prevHardcopy, providedThumbFlag, providedThumbStatus, prevThumbAvailable, prevThumbStatus, providedApp, existing } = result;
    if (windowOpen && student.email && student.is_email_verified) {
        const currentApp = providedApp || (existing.find(r => r.application_no)?.application_no);
        if (currentApp && providedHardcopyFlag === 0 && !prevHardcopy) {
            try {
                const subject = 'Scholarship Hard Copy Submission Required';
                await sendInstitutionalEmail({
                    to: student.email,
                    subject,
                    title: subject,
                    bodyHtml: `<p>Dear ${student.name},</p><p>Your scholarship application (${currentApp}) has been recorded. Please submit the hard copy documents to the scholarship office immediately.</p>`,
                    infoRows: [{ label: 'App No', value: currentApp }, { label: 'Year', value: academic_year }]
                });
            } catch (err) { console.error('[Scholarship API] Hardcopy Email Failed:', err); }
        }
        if (providedThumbFlag === 1 && providedThumbStatus === 'PENDING' && (!prevThumbAvailable || prevThumbStatus !== 'PENDING')) {
            try {
                const subject = 'Scholarship Thumb Verification Required';
                await sendInstitutionalEmail({
                    to: student.email,
                    subject,
                    title: subject,
                    bodyHtml: `<p>Dear ${student.name},</p><p>Your application (${currentApp || ''}) requires biometric (thumb) verification. Please visit a Mee-Seva center soon.</p>`,
                    infoRows: [{ label: 'App No', value: currentApp || 'N/A' }, { label: 'Year', value: academic_year }]
                });
            } catch (err) { console.error('[Scholarship API] Thumb Email Failed:', err); }
        }
    }

    return apiResponse(responseData, isNewInsert ? 201 : 200);
  } catch (error) {
    if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
    logger.error('Error inserting sanction:', error);
    if (error.message.includes('Scholarship sanctioned total exceeds') || error.message.includes('Scholarship released total exceeds')) {
      return apiError(error.message, 400);
    }
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
