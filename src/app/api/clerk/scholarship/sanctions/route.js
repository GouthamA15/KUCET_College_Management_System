import { db } from '@/db';
import { scholarshipSanctions, students } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { wrapHandler, apiError, apiSuccess } from '@/lib/api-utils';
import logger from '@/lib/logger';
import { IdempotencyService } from '@/services/IdempotencyService';
import { ScholarshipService } from '@/services/ScholarshipService';

/**
 * SCHOLARSHIP SANCTIONS API
 * Handles recording and updating institutional/gov scholarship records.
 */

export const POST = wrapHandler(async (req, { user }) => {
  const body = await req.json();
  const { 
    roll_no, 
    academic_year, 
    application_no, 
    proceeding_no, 
    sanctioned_amount, 
    sanction_date,
    released_amount,
    released_date,
    status,
    thumb_update_available,
    thumb_status,
    hardcopy_submitted,
    original_version // For Optimistic Locking
  } = body;

  const idempotencyKey = req.headers.get('x-idempotency-key');
  let idempotencyStarted = false;

  try {
    if (idempotencyKey) {
      const existingResponse = await IdempotencyService.check(idempotencyKey);
      if (existingResponse) return existingResponse;
      await IdempotencyService.start(idempotencyKey);
      idempotencyStarted = true;
    }

    // 1. Resolve Student
    const studentRows = await db.select().from(students).where(eq(students.roll_no, roll_no)).limit(1);
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    const { SystemConfigService } = await import('@/services/SystemConfigService');        
    const feeConfig = await SystemConfigService.getFeeStructures();

    // TRANSACTIONAL EXECUTION
    const result = await db.transaction(async (tx) => {
      // 1. If student is currently marked 'NO' but a sanction is being added,
      // flip them to 'YES' automatically.
      if (student.fee_reimbursement === 'NO' && status !== 'REJECTED') {
        await tx.update(students)
          .set({ fee_reimbursement: 'YES' })
          .where(eq(students.id, student.id));
      }

      // 2. Scholarship Window Check (Soft check, logic handled by Service)
      try {
        const window = await ScholarshipService.getActiveWindow(academic_year);
        if (!window && user.role !== 'admin') {
          // If window is closed and user is not admin, we might want to block
          // but for now we allow clerks to record historical data.
        }
      } catch (e) {
        console.error('[Scholarship API] Window evaluation failed:', e);
      }

      // Fetch existing rows for student + academic_year
      const existing = await tx.query.scholarshipSanctions.findMany({
        where: and(eq(scholarshipSanctions.student_id, student.id), eq(scholarshipSanctions.academic_year, academic_year))
      });

      // Business Rule: Total sanctioned cannot exceed tuition fee
      const currentSanctionedTotal = existing.reduce((sum, s) => sum + Number(s.sanctioned_amount || 0), 0);
      const newTotal = currentSanctionedTotal + Number(sanctioned_amount || 0);
      
      // Determine max fee for student
      const isSfc = feeConfig.SFC_COURSES?.some(c => student.roll_no.includes(c));
      const maxFee = isSfc ? feeConfig.SFC : feeConfig.REGULAR;

      if (newTotal > maxFee) {
        throw new Error(`Scholarship sanctioned total exceeds annual fee limit (${maxFee})`);
      }

      // 3. Upsert Logic
      // If application_no matches an existing record for this student/year, update it.
      const match = existing.find(s => s.application_no === application_no);

      if (match) {
        // OPTIMISTIC LOCKING CHECK
        if (original_version !== undefined && match.version !== original_version) {
          throw new Error('CONCURRENCY_CONFLICT: Record was modified by another user. Please refresh.');
        }

        const updateData = {
          proceeding_no: proceeding_no || match.proceeding_no,
          sanctioned_amount: sanctioned_amount !== undefined ? sanctioned_amount : match.sanctioned_amount,
          sanction_date: sanction_date || match.sanction_date,
          released_amount: released_amount !== undefined ? released_amount : match.released_amount,
          released_date: released_date || match.released_date,
          status: status || match.status,
          thumb_update_available: thumb_update_available !== undefined ? thumb_update_available : match.thumb_update_available,
          thumb_status: thumb_status || match.thumb_status,
          hardcopy_submitted: hardcopy_submitted !== undefined ? hardcopy_submitted : match.hardcopy_submitted,
          version: match.version + 1,
          updated_at: new Date()
        };

        await tx.update(scholarshipSanctions)
          .set(updateData)
          .where(eq(scholarshipSanctions.id, match.id));
        
        return { id: match.id, action: 'UPDATED' };
      } else {
        // Create New
        const insertData = {
          student_id: student.id,
          academic_year,
          application_no,
          proceeding_no: proceeding_no || null,
          sanctioned_amount: sanctioned_amount || 0,
          sanction_date: sanction_date || null,
          released_amount: released_amount || 0,
          released_date: released_date || null,
          status: status || 'PENDING',
          thumb_update_available: !!thumb_update_available,
          thumb_status: thumb_status || 'PENDING',
          hardcopy_submitted: !!hardcopy_submitted,
          version: 1
        };

        const [res] = await tx.insert(scholarshipSanctions).values(insertData);
        return { id: res.insertId, action: 'CREATED' };
      }
    });

    const response = apiSuccess(result, result.action === 'CREATED' ? 201 : 200);
    if (idempotencyKey) await IdempotencyService.complete(idempotencyKey, response);
    return response;

  } catch (error) {
    if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
    logger.error('Error inserting sanction:', error);
    
    if (error.message.includes('CONCURRENCY_CONFLICT')) {
        return apiError(error.message, 409);
    }
    
    if (error.message.includes('Scholarship sanctioned total exceeds')) {
      return apiError(error.message, 400);
    }
    return apiError('Internal Server Error', 500);
  }
});

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
