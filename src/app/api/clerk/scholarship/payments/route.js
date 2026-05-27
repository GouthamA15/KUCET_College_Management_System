import logger from '@/lib/logger';
import { db } from '@/db';
import { studentFeePayments, students as studentsTable } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getYearlyTotalFee } from '@/lib/financial-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';

const GOVT_CAP = 35000;

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
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
    })
      .from(studentsTable)
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
        const allowedPayableLimit = isScholarshipStudent ? Math.max(0, totalCourseFee - GOVT_CAP) : totalCourseFee;

        logger.info(`[Payment API] Course fee detected: ${totalCourseFee}`);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Payment API] Student reimbursement status: ${reimbursementStatus}`);
          console.log(`[Payment API] Course fee detected: ${totalCourseFee}`);
        }

        // Fetch existing payments for this year (SUM) inside transaction
        const existingPayments = await tx.select({ total: sql`SUM(amount)` })
          .from(studentFeePayments)
          .where(and(
            eq(studentFeePayments.student_id, student.id),
            eq(studentFeePayments.academic_year, academic_year)
          ));
        
        const currentPaidTotal = Number(existingPayments?.[0]?.total || 0);
        const finalPaidTotal = currentPaidTotal + amount;

        logger.info(`[Payment API] Existing payment total: ${currentPaidTotal}`);
        logger.info(`[Payment API] New calculated total: ${finalPaidTotal}`);
        logger.info(`[Payment API] Allowed payable limit: ${allowedPayableLimit}`);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Payment API] Existing payment total: ${currentPaidTotal}`);
          console.log(`[Payment API] New calculated total: ${finalPaidTotal}`);
          console.log(`[Payment API] Allowed payable limit: ${allowedPayableLimit}`);
        }

        if (finalPaidTotal > allowedPayableLimit) {
          logger.warn('[Payment API] Payment rejected due to overflow');
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Payment API] Payment rejected due to overflow');
          }
          const err = new Error('Payment exceeds allowed payable limit.');
          err.code = 'PAYMENT_LIMIT_EXCEEDED';
          throw err;
        }

        if (process.env.NODE_ENV === 'development') logger.info('[Scholarship Payment API] Inserting new payment row');
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

    if (process.env.NODE_ENV === 'development') console.log('[Scholarship Payment API] Transaction committed successfully');

    return apiResponse({
      id: resultId,
      student_id: student.id,
      academic_year,
      transaction_ref,
      amount,
      transaction_date,
      payment_mode,
      bank_name,
    }, 201);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('[Scholarship Payment API] FATAL ERROR:', error.message);
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
