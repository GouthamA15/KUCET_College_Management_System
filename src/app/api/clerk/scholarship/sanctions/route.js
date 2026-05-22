import logger from '@/lib/logger';
import { db } from '@/db';
import { scholarshipSanctions, students as studentsTable, scholarshipWindows } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import { sendInstitutionalEmail } from '@/lib/email';

const toNull = (v) => (!v || String(v).trim() === '') ? null : String(v).trim();

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    
    // GUARANTEED TERMINAL VISIBILITY & INVESTIGATION LOGS
    if (process.env.NODE_ENV === 'development') {
      console.log('[Scholarship API] Incoming request:', JSON.stringify(body, null, 2));
      logger.info(`[Scholarship API] Incoming request for roll: ${body.roll_no}`);
    }

    const roll_no = String(body.roll_no || '').trim();
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

    if (!roll_no) return apiError('Missing roll_no', 400);
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return apiError('Invalid academic_year', 400);
    if (!application_no) return apiError('Missing application_no', 400);

    // Strict Format Validation
    const cleanAppStr = String(application_no).trim();
    if (!/^\d+$/.test(cleanAppStr)) return apiError('application_no must be numeric', 400);
    if (cleanAppStr.length < 6 || cleanAppStr.length > 15) return apiError('application_no invalid length', 400);

    if (sanctioned_amount !== null && !(sanctioned_amount > 0)) return apiError('Invalid sanctioned_amount', 400);
    if (sanctioned_amount !== null && !proceeding_no) return apiError('Missing proceeding_no for amount', 400);
    if (sanctioned_amount !== null && !sanction_date) return apiError('Invalid sanction_date', 400);

    const studentRows = await db.select({ 
        id: studentsTable.id, 
        name: studentsTable.name, 
        email: studentsTable.email, 
        is_email_verified: studentsTable.is_email_verified,
        fee_reimbursement: studentsTable.fee_reimbursement
    })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, roll_no))
      .limit(1);
    
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    // ELIGIBILITY GUARD
    if (String(student.fee_reimbursement).toUpperCase() !== 'YES') {
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[Scholarship Validation] Rejected: Student ${roll_no} not eligible for reimbursement.`);
        console.warn(`[Scholarship Validation] Rejected: Student ${roll_no} not eligible for reimbursement.`);
      }
      return apiError('Student is not eligible for fee reimbursement. Scholarship registry disabled.', 403);
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
        if (process.env.NODE_ENV === 'development') console.log(`[Scholarship API] Window evaluated. Open: ${windowOpen}`);
      } catch (e) {
        console.error('[Scholarship API] Window evaluation failed:', e);
      }

      // Fetch existing rows for student + academic_year
      const existing = await tx.query.scholarshipSanctions.findMany({
        where: and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year))
      });

      const providedProceeding = proceeding_no && String(proceeding_no).trim() !== '' ? String(proceeding_no).trim() : null;

      // FINANCIAL VALIDATION (₹35,000 CAP) - INSIDE TRANSACTION
      const GOVT_ELIGIBLE_CAP = 35000;
      const existingRowForCap = providedProceeding ? existing.find(r => String(r.proceeding_no || '') === providedProceeding) : null;
      
      const otherSanctionsTotal = existing
        .filter(r => !existingRowForCap || r.id !== existingRowForCap.id)
        .reduce((sum, r) => sum + Number(r.sanctioned_amount || 0), 0);
      
      const otherReleasedTotal = existing
        .filter(r => !existingRowForCap || r.id !== existingRowForCap.id)
        .reduce((sum, r) => sum + Number(r.released_amount || 0), 0);

      const finalSanctionedTotal = otherSanctionsTotal + (sanctioned_amount || 0);
      const finalReleasedTotal = otherReleasedTotal + (released_amount || 0);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Scholarship Validation] Existing Sanctioned: ${otherSanctionsTotal}, Incoming: ${sanctioned_amount}, Final: ${finalSanctionedTotal}`);
        console.log(`[Scholarship Validation] Existing Released: ${otherReleasedTotal}, Incoming: ${released_amount}, Final: ${finalReleasedTotal}`);
      }

      if (sanctioned_amount !== null && finalSanctionedTotal > GOVT_ELIGIBLE_CAP) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn(`[Scholarship Validation] Total sanctioned exceeded. Final: ${finalSanctionedTotal}, Cap: ${GOVT_ELIGIBLE_CAP}`);
          console.warn(`[Scholarship Validation] Total sanctioned exceeded. Final: ${finalSanctionedTotal}, Cap: ${GOVT_ELIGIBLE_CAP}`);
        }
        throw new Error(`Scholarship sanctioned total exceeds ₹${GOVT_ELIGIBLE_CAP.toLocaleString()} government limit.`);
      }

      if (released_amount !== null && finalReleasedTotal > GOVT_ELIGIBLE_CAP) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn(`[Scholarship Validation] Released amount exceeded. Final: ${finalReleasedTotal}, Cap: ${GOVT_ELIGIBLE_CAP}`);
          console.warn(`[Scholarship Validation] Released amount exceeded. Final: ${finalReleasedTotal}, Cap: ${GOVT_ELIGIBLE_CAP}`);
        }
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
          if (process.env.NODE_ENV === 'development') console.log(`[Scholarship API] Updating existing proceeding ID: ${existingRow.id}`);
          await tx.update(scholarshipSanctions)
            .set({ 
              sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null, 
              sanction_date: sanction_date, 
              released_amount: released_amount !== null ? String(released_amount) : null,
              released_date: released_date,
              application_no: providedApp || existingRow.application_no 
            })
            .where(eq(scholarshipSanctions.id, existingRow.id));
          targetRowId = existingRow.id;
        } else {
          const baseRow = existing.find(r => !r.proceeding_no) || null;
          if (baseRow) {
            if (process.env.NODE_ENV === 'development') console.log(`[Scholarship API] Converting base row ID: ${baseRow.id} to proceeding`);
            await tx.update(scholarshipSanctions)
              .set({ 
                proceeding_no: providedProceeding, 
                sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null, 
                sanction_date: sanction_date, 
                released_amount: released_amount !== null ? String(released_amount) : null,
                released_date: released_date,
                application_no: providedApp || baseRow.application_no 
              })
              .where(eq(scholarshipSanctions.id, baseRow.id));
            targetRowId = baseRow.id;
          } else {
            if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Inserting new proceeding row');
            const [ins] = await tx.insert(scholarshipSanctions).values({
              student_id: student.id,
              academic_year: academic_year,
              application_no: providedApp || (existing.length > 0 ? existing[0].application_no : null),
              proceeding_no: providedProceeding,
              sanctioned_amount: sanctioned_amount !== null ? String(sanctioned_amount) : null,
              sanction_date: sanction_date,
              released_amount: released_amount !== null ? String(released_amount) : null,
              released_date: released_date
            });
            targetRowId = ins.insertId;
            isNewInsert = true;
          }
        }
      } else {
        const baseRow = existing.find(r => !r.proceeding_no) || null;
        if (baseRow) {
          if (process.env.NODE_ENV === 'development') console.log(`[Scholarship API] Updating base row ID: ${baseRow.id}`);
          if (providedApp) await tx.update(scholarshipSanctions).set({ application_no: providedApp }).where(eq(scholarshipSanctions.id, baseRow.id));
          targetRowId = baseRow.id;
        } else if (existing.length > 0) {
          if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Syncing application_no to all proceedings');
          if (providedApp) await tx.update(scholarshipSanctions).set({ application_no: providedApp }).where(and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year)));
          targetRowId = existing[0].id;
        } else {
          if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Inserting initial base row');
          const [ins] = await tx.insert(scholarshipSanctions).values({ student_id: student.id, academic_year: academic_year, application_no: providedApp });
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

    // EMAIL TRIGGERS (OUTSIDE TRANSACTION TO AVOID LOCKING)
    const { windowOpen, providedHardcopyFlag, prevHardcopy, providedThumbFlag, providedThumbStatus, prevThumbAvailable, prevThumbStatus, providedApp, existing } = result;

    if (windowOpen && student.email && student.is_email_verified) {
        const currentApp = providedApp || (existing.find(r => r.application_no)?.application_no);
        
        // Trigger 1: Hardcopy Required
        if (currentApp && providedHardcopyFlag === 0 && !prevHardcopy) {
            if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Triggering Hardcopy Email');
            try {
                const subject = 'Scholarship Hard Copy Submission Required';
                await sendInstitutionalEmail({
                    to: student.email,
                    subject,
                    title: subject,
                    bodyHtml: `<p>Dear ${student.name},</p><p>Your scholarship application (${currentApp}) has been recorded. Please submit the hard copy documents to the scholarship office immediately.</p>`,
                    infoRows: [{ label: 'App No', value: currentApp }, { label: 'Year', value: academic_year }]
                });
                if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Hardcopy Email Sent');
            } catch (err) { console.error('[Scholarship API] Hardcopy Email Failed:', err); }
        }

        // Trigger 2: Thumb Verification Required
        if (providedThumbFlag === 1 && providedThumbStatus === 'PENDING' && (!prevThumbAvailable || prevThumbStatus !== 'PENDING')) {
            if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Triggering Thumb Email');
            try {
                const subject = 'Scholarship Thumb Verification Required';
                await sendInstitutionalEmail({
                    to: student.email,
                    subject,
                    title: subject,
                    bodyHtml: `<p>Dear ${student.name},</p><p>Your application (${currentApp || ''}) requires biometric (thumb) verification. Please visit a Mee-Seva center soon.</p>`,
                    infoRows: [{ label: 'App No', value: currentApp || 'N/A' }, { label: 'Year', value: academic_year }]
                });
                if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Thumb Email Sent');
            } catch (err) { console.error('[Scholarship API] Thumb Email Failed:', err); }
        }
    } else {
        if (process.env.NODE_ENV === 'development') console.log(`[Scholarship API] Email skipped. Window: ${windowOpen}, Verified Email: ${!!(student.email && student.is_email_verified)}`);
    }

    if (process.env.NODE_ENV === 'development') console.log('[Scholarship API] Transaction committed successfully');
    return apiResponse({ id: result.targetRowId, success: true }, result.isNewInsert ? 201 : 200);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('[Scholarship API] FATAL ERROR:', error.message);
    logger.error('Error inserting sanction:', error);
    
    // Distinguish between validation errors and internal errors
    if (error.message.includes('Scholarship sanctioned total exceeds') || error.message.includes('Scholarship released total exceeds')) {
      return apiError(error.message, 400);
    }

    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
