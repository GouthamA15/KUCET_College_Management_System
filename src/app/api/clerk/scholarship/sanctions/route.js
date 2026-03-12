import { query } from '@/lib/db';
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
    if (String(application_no).length > 12) return apiError('application_no must be at most 12 digits', 400);
    // Proceeding number is OPTIONAL at creation; if amount is provided, require a proceeding number
    if (sanctioned_amount !== null && !(sanctioned_amount > 0)) return apiError('Invalid sanctioned_amount', 400);
    if (sanctioned_amount !== null && !proceeding_no) return apiError('Missing proceeding_no for provided amount', 400);
    // Sanction date is required only when amount is provided
    if (sanctioned_amount !== null && !sanction_date) return apiError('Invalid sanction_date', 400);

    const [student] = await query('SELECT id, name, email, is_email_verified, roll_no FROM students WHERE roll_no = ?', [roll_no]);
    if (!student) return apiError('Student not found', 404);
    // Determine if scholarship window is currently OPEN; if not, suppress student emails
    let windowAllowsEmail = false;
    try {
      const winRows = await query(
        'SELECT start_date, end_date FROM scholarship_windows ORDER BY id DESC LIMIT 1',
        []
      );
      const win = winRows && winRows[0] ? winRows[0] : null;
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
      console.error('Failed to evaluate scholarship window for sanction emails:', e);
    }
    // Fetch existing rows for student + academic_year
    const existing = await query('SELECT id, application_no, proceeding_no, thumb_update_available, thumb_status, hardcopy_submitted FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ?', [student.id, academic_year]);

    // Determine operation: UPDATE existing row or INSERT new
    const providedProceeding = proceeding_no && String(proceeding_no).trim() !== '' ? String(proceeding_no).trim() : null;
    const providedApp = application_no && String(application_no).trim() !== '' ? String(application_no).trim() : null;
    const providedThumbFlag = body.thumb_update_available ? 1 : 0;
    const providedThumbStatus = body.thumb_status ? String(body.thumb_status) : null;
    const thumbIsPending = typeof providedThumbStatus === 'string'
      && providedThumbStatus.trim().toUpperCase() === 'PENDING';
    const providedHardcopyFlag = body.hardcopy_submitted ? 1 : 0;

    // Determine previous thumb state and application state for this student+year (any existing row)
    const prevThumb = existing.some(r => !!r.thumb_update_available);
    const prevHasApplication = existing.some(r => r.application_no && String(r.application_no).trim() !== '');

    // If proceeding_no provided, try to update row with same proceeding; otherwise update base row with null proceeding; else insert
    let targetRow = null;
    if (providedProceeding) {
      targetRow = existing.find(r => String(r.proceeding_no || '') === providedProceeding) || null;
      if (targetRow) {
        // Update existing row matching proceeding_no (include thumb and hardcopy fields when provided)
        await query('UPDATE scholarship_sanctions SET sanctioned_amount = ?, sanction_date = ?, application_no = COALESCE(application_no, ?), thumb_update_available = ?, thumb_status = COALESCE(?, thumb_status), hardcopy_submitted = ? WHERE id = ?', [sanctioned_amount, sanction_date, providedApp, providedThumbFlag, providedThumbStatus, providedHardcopyFlag, targetRow.id]);
        // Send email if thumb was newly enabled
        if (!prevThumb && providedThumbFlag && thumbIsPending && windowAllowsEmail) {
          try {
            const stu = await query('SELECT name, email, is_email_verified, roll_no FROM students WHERE id = ?', [student.id]);
            const s = stu && stu[0];
            if (s && s.email && s.is_email_verified) {
              const subject = 'Scholarship Thumb Verification Required';
              const html = `<p>Dear ${s.name || 'Student'},</p><p>Your scholarship application requires biometric (thumb) verification. Please visit your nearest Mee-Seva center to complete the verification process.</p><p>Application Number: ${providedApp || ''}</p><p>Academic Year: ${academic_year}</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
              await sendInstitutionalEmail({ to: s.email, subject, title: subject, bodyHtml: html, infoRows: [{ label: 'Application Number', value: providedApp || '' }, { label: 'Academic Year', value: academic_year }] });
            }
          } catch (e) {
            console.error('Failed to send thumb notification email (proceeding update):', e);
          }
        }

        const newApp = providedApp ?? targetRow.application_no;
        if (!prevHasApplication && newApp && providedHardcopyFlag === 0 && windowAllowsEmail) {
          try {
            if (student.email && student.is_email_verified) {
              const subject = 'Scholarship Hard Copy Submission Required';
              const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${newApp}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
              await sendInstitutionalEmail({
                to: student.email,
                subject,
                title: subject,
                bodyHtml: html,
                infoRows: [
                  { label: 'Application Number', value: newApp },
                  { label: 'Academic Year', value: academic_year },
                ],
              });
            }
          } catch (e) {
            console.error('Failed to send hardcopy submission email (proceeding update):', e);
          }
        }

        return apiResponse({ id: targetRow.id, student_id: student.id, academic_year, application_no: newApp, proceeding_no: providedProceeding, sanctioned_amount, sanction_date });
      }
      // No row with proceeding; see if base row without proceeding exists
      const baseRow = existing.find(r => !r.proceeding_no) || null;
      if (baseRow) {
        await query('UPDATE scholarship_sanctions SET proceeding_no = ?, sanctioned_amount = ?, sanction_date = ?, application_no = COALESCE(application_no, ?), thumb_update_available = ?, thumb_status = COALESCE(?, thumb_status), hardcopy_submitted = ? WHERE id = ?', [providedProceeding, sanctioned_amount, sanction_date, providedApp, providedThumbFlag, providedThumbStatus, providedHardcopyFlag, baseRow.id]);
        if (!prevThumb && providedThumbFlag && thumbIsPending && windowAllowsEmail) {
          try {
            const stu = await query('SELECT name, email, is_email_verified, roll_no FROM students WHERE id = ?', [student.id]);
            const s = stu && stu[0];
            if (s && s.email && s.is_email_verified) {
              const subject = 'Scholarship Thumb Verification Required';
              const html = `<p>Dear ${s.name || 'Student'},</p><p>Your scholarship application requires biometric (thumb) verification. Please visit your nearest Mee-Seva center to complete the verification process.</p><p>Application Number: ${providedApp || ''}</p><p>Academic Year: ${academic_year}</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
              await sendInstitutionalEmail({ to: s.email, subject, title: subject, bodyHtml: html, infoRows: [{ label: 'Application Number', value: providedApp || '' }, { label: 'Academic Year', value: academic_year }] });
            }
          } catch (e) {
            console.error('Failed to send thumb notification email (baseRow update):', e);
          }
        }

        const newApp = providedApp ?? baseRow.application_no;
        if (!prevHasApplication && newApp && providedHardcopyFlag === 0 && windowAllowsEmail) {
          try {
            if (student.email && student.is_email_verified) {
              const subject = 'Scholarship Hard Copy Submission Required';
              const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${newApp}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
              await sendInstitutionalEmail({
                to: student.email,
                subject,
                title: subject,
                bodyHtml: html,
                infoRows: [
                  { label: 'Application Number', value: newApp },
                  { label: 'Academic Year', value: academic_year },
                ],
              });
            }
          } catch (e) {
            console.error('Failed to send hardcopy submission email (baseRow update):', e);
          }
        }

        return apiResponse({ id: baseRow.id, student_id: student.id, academic_year, application_no: newApp, proceeding_no: providedProceeding, sanctioned_amount, sanction_date });
      }
      // Insert new row with provided proceeding
      const insertSql = 'INSERT INTO scholarship_sanctions (student_id, academic_year, application_no, proceeding_no, sanctioned_amount, sanction_date, hardcopy_submitted) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const ins = await query(insertSql, [student.id, academic_year, providedApp, providedProceeding, sanctioned_amount, sanction_date, providedHardcopyFlag]);
      const insertedId = ins?.insertId || ins?.[0]?.insertId || null;
      // If newly inserted and thumb flag provided, update thumb fields and possibly send email
      if (providedThumbFlag) {
        try {
          await query('UPDATE scholarship_sanctions SET thumb_update_available = ?, thumb_status = ? WHERE id = ?', [providedThumbFlag, providedThumbStatus, insertedId]);
          if (!prevThumb && providedThumbFlag && thumbIsPending && windowAllowsEmail) {
            const stu = await query('SELECT name, email, is_email_verified, roll_no FROM students WHERE id = ?', [student.id]);
            const s = stu && stu[0];
            if (s && s.email && s.is_email_verified) {
              const subject = 'Scholarship Thumb Verification Required';
              const html = `<p>Dear ${s.name || 'Student'},</p><p>Your scholarship application requires biometric (thumb) verification. Please visit your nearest Mee-Seva center to complete the verification process.</p><p>Application Number: ${providedApp || ''}</p><p>Academic Year: ${academic_year}</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
              await sendInstitutionalEmail({ to: s.email, subject, title: subject, bodyHtml: html, infoRows: [{ label: 'Application Number', value: providedApp || '' }, { label: 'Academic Year', value: academic_year }] });
            }
          }
        } catch (e) {
          console.error('Failed to send thumb notification email (insert):', e);
        }
      }

      if (!prevHasApplication && providedApp && providedHardcopyFlag === 0 && windowAllowsEmail) {
        try {
          if (student.email && student.is_email_verified) {
            const subject = 'Scholarship Hard Copy Submission Required';
            const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${providedApp}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
            await sendInstitutionalEmail({
              to: student.email,
              subject,
              title: subject,
              bodyHtml: html,
              infoRows: [
                { label: 'Application Number', value: providedApp },
                { label: 'Academic Year', value: academic_year },
              ],
            });
          }
        } catch (e) {
          console.error('Failed to send hardcopy submission email (insert):', e);
        }
      }

      return apiResponse({ id: insertedId, student_id: student.id, academic_year, application_no: providedApp, proceeding_no: providedProceeding, sanctioned_amount, sanction_date }, 201);
    }

    // No proceeding provided: ensure a base row exists (application-only case)
    const baseRow = existing.find(r => !r.proceeding_no) || null;
    if (baseRow) {
      // Update application_no if not set; otherwise keep existing
      if (providedApp && !baseRow.application_no) {
        await query('UPDATE scholarship_sanctions SET application_no = ?, hardcopy_submitted = ? WHERE id = ?', [providedApp, providedHardcopyFlag, baseRow.id]);
      }
      const appOut = providedApp || baseRow.application_no || null;

      if (!prevHasApplication && appOut && providedHardcopyFlag === 0 && windowAllowsEmail) {
        try {
          if (student.email && student.is_email_verified) {
            const subject = 'Scholarship Hard Copy Submission Required';
            const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${appOut}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
            await sendInstitutionalEmail({
              to: student.email,
              subject,
              title: subject,
              bodyHtml: html,
              infoRows: [
                { label: 'Application Number', value: appOut },
                { label: 'Academic Year', value: academic_year },
              ],
            });
          }
        } catch (e) {
          console.error('Failed to send hardcopy submission email (baseRow app-only):', e);
        }
      }

      return apiResponse({ id: baseRow.id, student_id: student.id, academic_year, application_no: appOut, proceeding_no: null, sanctioned_amount: null, sanction_date: null });
    }
    // Insert base row with application_no and nulls
    const insertSql = 'INSERT INTO scholarship_sanctions (student_id, academic_year, application_no, proceeding_no, sanctioned_amount, sanction_date, hardcopy_submitted) VALUES (?, ?, ?, NULL, NULL, NULL, ?)';
    const ins = await query(insertSql, [student.id, academic_year, providedApp, providedHardcopyFlag]);
    const insertedId = ins?.insertId || ins?.[0]?.insertId || null;
    if (!prevHasApplication && providedApp && providedHardcopyFlag === 0 && windowAllowsEmail) {
      try {
        if (student.email && student.is_email_verified) {
          const subject = 'Scholarship Hard Copy Submission Required';
          const html = `<p>Dear ${student.name || 'Student'},</p><p>Your scholarship application has been recorded in the college system.</p><p>Please submit the required hard copy documents to the scholarship office.</p><p>Application Number: ${providedApp}</p><p>Failure to submit the documents may delay your scholarship processing.</p><p>KU College of Engineering &amp; Technology<br/>Warangal</p>`;
          await sendInstitutionalEmail({
            to: student.email,
            subject,
            title: subject,
            bodyHtml: html,
            infoRows: [
              { label: 'Application Number', value: providedApp },
              { label: 'Academic Year', value: academic_year },
            ],
          });
        }
      } catch (e) {
        console.error('Failed to send hardcopy submission email (baseRow insert):', e);
      }
    }
    return apiResponse({ id: insertedId, student_id: student.id, academic_year, application_no: providedApp, proceeding_no: null, sanctioned_amount: null, sanction_date: null }, 201);
  } catch (error) {
    console.error('Error inserting sanction:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }