import logger from '@/lib/logger';
import { db } from '@/db';
import { studentFeePayments, students as studentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const roll_no = String(body.roll_no || '').trim();
    const academic_year = String(body.academic_year || '').trim();
    const transaction_ref = String(body.transaction_ref || '').trim();
    const amount = Number(body.amount || 0);
    const transaction_date = toMySQLDate(body.transaction_date);

    if (!roll_no) return apiError('Missing roll_no', 400);
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return apiError('Invalid academic_year', 400);
    if (!transaction_ref) return apiError('Missing transaction_ref', 400);
    if (!(amount > 0)) return apiError('Invalid amount', 400);
    if (!transaction_date) return apiError('Invalid transaction_date', 400);

    const studentRows = await db.select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, roll_no))
      .limit(1);
    
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    const [result] = await db.insert(studentFeePayments).values({
      student_id: student.id,
      academic_year: academic_year,
      transaction_ref_no: transaction_ref,
      amount: String(amount),
      transaction_date: transaction_date
    });

    return apiResponse({
      id: result.insertId,
      student_id: student.id,
      academic_year,
      transaction_ref,
      amount,
      transaction_date,
    }, 201);
  } catch (error) {
    logger.error('Error inserting payment:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
