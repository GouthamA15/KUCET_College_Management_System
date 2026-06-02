import logger from '@/lib/logger';
import { db } from '@/db';
import { studentFeePayments, students as studentsTable, studentPersonalDetails, studentAcademicBackground } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getYearlyTotalFee } from '@/lib/financial-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateExpectedRTF } from '@/lib/scholarship-utils';
import IdempotencyService from '@/services/IdempotencyService';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  const idempotencyKey = req.headers.get('idempotency-key');
  let idempotencyStarted = false;

  try {
    if (idempotencyKey) {
      const { isDuplicate, response, code } = await IdempotencyService.start(idempotencyKey);
      if (isDuplicate) {
        logger.info({ key: idempotencyKey }, '[IDEMPOTENCY_HIT] Returning cached response for payment');
        return apiResponse(response, code || 201);
      }
      idempotencyStarted = true;
    }

    const body = await req.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('[Scholarship Payment API] Incoming Payload:', JSON.stringify(body, null, 2));
    }

    const roll_no = String(body.roll_no || '').trim().toUpperCase();
    const academic_year = String(body.academic_year || '').trim();
    const transaction_ref = String(body.transaction_ref || '').trim();
    const amount_raw = body.amount;
    const amount = Number(amount_raw || 0);
    const transaction_date = toMySQLDate(body.transaction_date);
    const payment_mode = body.payment_mode || 'UPI';
    const bank_name = body.bank_name || null;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Scholarship Payment API DEBUG] Raw Amount: ${amount_raw} (${typeof amount_raw}), Parsed: ${amount}`);
    }

    if (!roll_no) return apiError('Missing roll_no', 400);
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return apiError('Invalid academic_year', 400);
    if (!transaction_ref) return apiError('Missing transaction_ref', 400);
    if (!(amount > 0)) return apiError('Invalid amount', 400);
    if (!transaction_date) return apiError('Invalid transaction_date', 400);

    const studentRows = await db.select({ 
      id: studentsTable.id,
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

    const course = getBranchFromRoll(roll_no);
    const reimbursementStatus = String(student?.fee_reimbursement || 'NO').toUpperCase();

    logger.info(`[Payment API] Student reimbursement status: ${reimbursementStatus}`);

    // TRANSACTIONAL EXECUTION
    const resultId = await db.transaction(async (tx) => {
        // FINANCIAL VALIDATION
        const totalCourseFee = Number(getYearlyTotalFee(course) || 0);
        const isScholarshipStudent = reimbursementStatus === 'YES';
        const expectedRTF = isScholarshipStudent ? calculateExpectedRTF(student, totalCourseFee) : 0;
        const allowedPayableLimit = Math.max(0, totalCourseFee - expectedRTF);

        logger.info(`[Payment API] Course fee detected: ${totalCourseFee}`);

        // Fetch existing payments for this year (SUM) inside transaction
        const existingPayments = await tx.select({ total: sql`SUM(amount)` })
          .from(studentFeePayments)
          .where(and(
            eq(studentFeePayments.student_id, student.id),
            eq(studentFeePayments.academic_year, academic_year)
          ));
        
        const currentPaidTotal = Number(existingPayments?.[0]?.total || 0);
        const finalPaidTotal = currentPaidTotal + amount;

        if (finalPaidTotal > allowedPayableLimit) {
          logger.warn('[Payment API] Payment rejected due to overflow');
          const err = new Error('Payment exceeds allowed payable limit.');
          err.code = 'PAYMENT_LIMIT_EXCEEDED';
          throw err;
        }

        const [insertResult] = await tx.insert(studentFeePayments).values({
          student_id: student.id,
          academic_year: academic_year,
          transaction_ref_no: transaction_ref,
          amount: amount,
          transaction_date: transaction_date,
          payment_mode: payment_mode,
          bank_name: bank_name,
        });

        return insertResult.insertId;
    });

    const responseData = {
      id: resultId,
      student_id: student.id,
      academic_year,
      transaction_ref,
      amount,
      transaction_date,
      payment_mode,
      bank_name,
    };

    if (idempotencyStarted) {
      await IdempotencyService.complete(idempotencyKey, 201, responseData);
    }

    return apiResponse(responseData, 201);
  } catch (error) {
    if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
    
    logger.error('Error inserting payment:', error);

    if (error?.code === 'PAYMENT_LIMIT_EXCEEDED' || error?.message === 'Payment exceeds allowed payable limit.') {
      return apiError('Payment exceeds allowed payable limit.', 400);
    }

    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
