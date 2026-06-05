import { db } from '@/db';
import { studentFeePayments, studentRequests, scholarshipSanctions, students } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import logger from '@/lib/logger';

export class FinanceService {
  /**
   * Get financial summary statistics
   */
  static async getFinancialStats() {
    try {
      const [feeRes, certRes, scholarshipRes] = await Promise.all([
        db.select({ totalFees: sql`sum(${studentFeePayments.amount})` }).from(studentFeePayments),
        db.select({ totalCertFees: sql`sum(${studentRequests.payment_amount})` }).from(studentRequests).where(eq(studentRequests.status, 'APPROVED')),
        db.select({ 
          totalSanctioned: sql`sum(${scholarshipSanctions.sanctioned_amount})`,
          totalReleased: sql`sum(${scholarshipSanctions.released_amount})`
        }).from(scholarshipSanctions)
      ]);

      const totalFees = parseFloat(feeRes[0]?.totalFees || 0);
      const totalCertFees = parseFloat(certRes[0]?.totalCertFees || 0);
      const totalScholarshipSanctioned = parseFloat(scholarshipRes[0]?.totalSanctioned || 0);
      const totalScholarshipReleased = parseFloat(scholarshipRes[0]?.totalReleased || 0);

      return {
        totalFees,
        totalCertFees,
        totalScholarshipSanctioned,
        totalScholarshipReleased,
        totalRevenue: totalFees + totalCertFees
      };
    } catch (error) {
      logger.error(error, '[FINANCE_STATS_ERROR]');
      throw error;
    }
  }

  /**
   * Get unified transaction list
   */
  static async getAllTransactions({ type, status, rollNo, limit = 50 }) {
    try {
      // Since schema is different, we fetch separately and combine or use complex SQL.
      // For Admin oversight, separate fetches with a common structure is cleaner.
      
      let transactions = [];

      // 1. Fee Payments
      if (!type || type === 'FEE') {
        const feeQuery = db.select({
          id: studentFeePayments.id,
          type: sql`'FEE'`,
          studentId: studentFeePayments.student_id,
          rollNo: students.roll_no,
          studentName: students.name,
          amount: studentFeePayments.amount,
          date: studentFeePayments.transaction_date,
          reference: studentFeePayments.transaction_ref_no,
          status: sql`'SUCCESS'`,
          details: sql`json_object('mode', ${studentFeePayments.payment_mode}, 'bank', ${studentFeePayments.bank_name})`
        })
        .from(studentFeePayments)
        .leftJoin(students, eq(studentFeePayments.student_id, students.id));

        // Add filters
        if (rollNo) feeQuery.where(eq(students.roll_no, rollNo));

        const feeResults = await feeQuery.orderBy(desc(studentFeePayments.transaction_date)).limit(limit);
        transactions.push(...feeResults);
      }

      // 2. Certificate Payments
      if (!type || type === 'CERTIFICATE') {
        const certQuery = db.select({
          id: studentRequests.request_id,
          type: sql`'CERTIFICATE'`,
          studentId: studentRequests.student_id,
          rollNo: students.roll_no,
          studentName: students.name,
          amount: studentRequests.payment_amount,
          date: studentRequests.created_at,
          reference: studentRequests.transaction_id,
          status: studentRequests.status,
          details: sql`json_object(
            'cert_type', ${studentRequests.certificate_type}, 
            'completed_at', ${studentRequests.completed_at},
            'action_by_clerk_id', ${studentRequests.action_by_clerk_id},
            'action_by_role', ${studentRequests.action_by_role},
            'reject_reason', ${studentRequests.reject_reason}
          )`
        })
        .from(studentRequests)
        .leftJoin(students, eq(studentRequests.student_id, students.id));

        if (rollNo) certQuery.where(eq(students.roll_no, rollNo));
        if (status) certQuery.where(eq(studentRequests.status, status));

        const certResults = await certQuery.orderBy(desc(studentRequests.created_at)).limit(limit);
        transactions.push(...certResults);
      }

      // 3. Scholarship Sanctions
      if (!type || type === 'SCHOLARSHIP') {
        const schQuery = db.select({
          id: scholarshipSanctions.id,
          type: sql`'SCHOLARSHIP'`,
          studentId: scholarshipSanctions.student_id,
          rollNo: students.roll_no,
          studentName: students.name,
          amount: scholarshipSanctions.released_amount,
          date: scholarshipSanctions.released_date,
          reference: scholarshipSanctions.proceeding_no,
          status: scholarshipSanctions.status,
          details: sql`json_object('app_no', ${scholarshipSanctions.application_no}, 'sanctioned', ${scholarshipSanctions.sanctioned_amount})`
        })
        .from(scholarshipSanctions)
        .leftJoin(students, eq(scholarshipSanctions.student_id, students.id));

        if (rollNo) schQuery.where(eq(students.roll_no, rollNo));
        if (status) schQuery.where(eq(scholarshipSanctions.status, status));

        const schResults = await schQuery.orderBy(desc(scholarshipSanctions.created_at)).limit(limit);
        transactions.push(...schResults);
      }

      // Sort all combined by date
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      return transactions.slice(0, limit);
    } catch (error) {
      logger.error(error, '[GET_ALL_TRANSACTIONS_ERROR]');
      throw error;
    }
  }
}
