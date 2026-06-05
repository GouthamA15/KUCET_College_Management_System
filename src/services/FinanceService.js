import { db } from '@/db';
import { studentFeePayments, studentRequests, scholarshipSanctions, students, clerks } from '@/db/schema';
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';
import logger from '@/lib/logger';

export class FinanceService {
  /**
   * Get financial summary statistics
   */
  static async getFinancialStats({ startDate, endDate } = {}) {
    try {
      const feeConditions = [];
      const certConditions = [eq(studentRequests.status, 'APPROVED')];
      const schConditions = [];

      if (startDate) {
        const start = new Date(startDate);
        feeConditions.push(gte(studentFeePayments.transaction_date, start));
        certConditions.push(gte(studentRequests.created_at, start));
        schConditions.push(gte(scholarshipSanctions.created_at, start));
      }

      if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999Z');
        feeConditions.push(lte(studentFeePayments.transaction_date, end));
        certConditions.push(lte(studentRequests.created_at, end));
        schConditions.push(lte(scholarshipSanctions.created_at, end));
      }

      const feeQuery = db.select({ totalFees: sql`sum(${studentFeePayments.amount})` }).from(studentFeePayments);
      if (feeConditions.length > 0) feeQuery.where(and(...feeConditions));

      const certQuery = db.select({ totalCertFees: sql`sum(${studentRequests.payment_amount})` }).from(studentRequests);
      certQuery.where(and(...certConditions));

      const schQuery = db.select({ 
        totalSanctioned: sql`sum(${scholarshipSanctions.sanctioned_amount})`,
        totalReleased: sql`sum(${scholarshipSanctions.released_amount})`
      }).from(scholarshipSanctions);
      if (schConditions.length > 0) schQuery.where(and(...schConditions));

      const [feeRes, certRes, scholarshipRes] = await Promise.all([feeQuery, certQuery, schQuery]);

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
  static async getAllTransactions({ type, status, rollNo, startDate, endDate, limit = 50 }) {
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
          details: sql`json_object(
            'payment_mode', ${studentFeePayments.payment_mode}, 
            'bank_name', ${studentFeePayments.bank_name},
            'academic_year', ${studentFeePayments.academic_year}
          )`
        })
        .from(studentFeePayments)
        .leftJoin(students, eq(studentFeePayments.student_id, students.id));

        const conditions = [];
        if (rollNo) conditions.push(eq(students.roll_no, rollNo));
        if (startDate) conditions.push(gte(studentFeePayments.transaction_date, new Date(startDate)));
        if (endDate) conditions.push(lte(studentFeePayments.transaction_date, new Date(endDate + 'T23:59:59.999Z')));
        if (conditions.length > 0) feeQuery.where(and(...conditions));

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
            'purpose', ${studentRequests.purpose},
            'from_date', ${studentRequests.from_date},
            'to_date', ${studentRequests.to_date},
            'generated_cert_id', ${studentRequests.generated_certificate_id},
            'academic_year', ${studentRequests.academic_year},
            'completed_at', ${studentRequests.completed_at},
            'action_by_clerk_id', ${studentRequests.action_by_clerk_id},
            'action_by_clerk_name', ${clerks.name},
            'action_by_role', ${studentRequests.action_by_role},
            'reject_reason', ${studentRequests.reject_reason},
            'payment_screenshot', ${studentRequests.payment_screenshot},
            'is_flagged', ${studentRequests.is_flagged}
          )`
        })
        .from(studentRequests)
        .leftJoin(students, eq(studentRequests.student_id, students.id))
        .leftJoin(clerks, eq(studentRequests.action_by_clerk_id, clerks.id));

        const conditions = [];
        if (rollNo) conditions.push(eq(students.roll_no, rollNo));
        if (status) conditions.push(eq(studentRequests.status, status));
        if (startDate) conditions.push(gte(studentRequests.created_at, new Date(startDate)));
        if (endDate) conditions.push(lte(studentRequests.created_at, new Date(endDate + 'T23:59:59.999Z')));
        if (conditions.length > 0) certQuery.where(and(...conditions));

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
          details: sql`json_object(
            'application_no', ${scholarshipSanctions.application_no}, 
            'sanctioned_amount', ${scholarshipSanctions.sanctioned_amount},
            'sanctioned_date', ${scholarshipSanctions.sanction_date},
            'academic_year', ${scholarshipSanctions.academic_year}
          )`
        })
        .from(scholarshipSanctions)
        .leftJoin(students, eq(scholarshipSanctions.student_id, students.id));

        const conditions = [];
        if (rollNo) conditions.push(eq(students.roll_no, rollNo));
        if (status) conditions.push(eq(scholarshipSanctions.status, status));
        if (startDate) conditions.push(gte(scholarshipSanctions.created_at, new Date(startDate)));
        if (endDate) conditions.push(lte(scholarshipSanctions.created_at, new Date(endDate + 'T23:59:59.999Z')));
        if (conditions.length > 0) schQuery.where(and(...conditions));

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
