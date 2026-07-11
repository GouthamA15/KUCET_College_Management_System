import { db } from '@/db';
import { studentFeePayments, studentRequests, scholarshipSanctions, students, clerks } from '@/db/schema';
import { eq, sql, desc, and, gte, lte, asc, ne } from 'drizzle-orm';
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
        feeConditions.push(gte(sql`DATE(DATE_ADD(${studentFeePayments.transaction_date}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
        certConditions.push(gte(sql`DATE(DATE_ADD(${studentRequests.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
        schConditions.push(gte(sql`DATE(DATE_ADD(${scholarshipSanctions.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
      }

      if (endDate) {
        feeConditions.push(lte(sql`DATE(DATE_ADD(${studentFeePayments.transaction_date}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
        certConditions.push(lte(sql`DATE(DATE_ADD(${studentRequests.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
        schConditions.push(lte(sql`DATE(DATE_ADD(${scholarshipSanctions.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
      }

      let feeQuery = db.select({ totalFees: sql`sum(${studentFeePayments.amount})` })
        .from(studentFeePayments)
        .leftJoin(students, eq(studentFeePayments.student_id, students.id));
      if (!startDate && !endDate) feeConditions.push(eq(students.student_status, 'ACTIVE'));
      if (feeConditions.length > 0) feeQuery = feeQuery.where(and(...feeConditions));

      let certQuery = db.select({ totalCertFees: sql`sum(${studentRequests.payment_amount})` })
        .from(studentRequests)
        .leftJoin(students, eq(studentRequests.student_id, students.id));
      if (!startDate && !endDate) certConditions.push(eq(students.student_status, 'ACTIVE'));
      if (certConditions.length > 0) certQuery = certQuery.where(and(...certConditions));

      let schQuery = db.select({ 
        totalSanctioned: sql`sum(${scholarshipSanctions.sanctioned_amount})`,
        totalReleased: sql`sum(${scholarshipSanctions.released_amount})`
      })
      .from(scholarshipSanctions)
      .leftJoin(students, eq(scholarshipSanctions.student_id, students.id));
      if (!startDate && !endDate) schConditions.push(eq(students.student_status, 'ACTIVE'));
      if (schConditions.length > 0) schQuery = schQuery.where(and(...schConditions));

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
      let transactions = [];

      // 1. Fee Payments
      if (!type || type === 'FEE') {
        let feeQuery = db.select({
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
        if (startDate) conditions.push(gte(sql`DATE(DATE_ADD(${studentFeePayments.transaction_date}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
        if (endDate) conditions.push(lte(sql`DATE(DATE_ADD(${studentFeePayments.transaction_date}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
        if (conditions.length > 0) feeQuery = feeQuery.where(and(...conditions));

        const feeResults = await feeQuery.orderBy(desc(studentFeePayments.transaction_date)).limit(limit);
        transactions.push(...feeResults);
      }

      // 2. Certificate Payments
      if (!type || type === 'CERTIFICATE') {
        let certQuery = db.select({
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
        if (startDate) conditions.push(gte(sql`DATE(DATE_ADD(${studentRequests.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
        if (endDate) conditions.push(lte(sql`DATE(DATE_ADD(${studentRequests.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
        if (conditions.length > 0) certQuery = certQuery.where(and(...conditions));

        const certResults = await certQuery.orderBy(desc(studentRequests.created_at)).limit(limit);
        transactions.push(...certResults);
      }

      // 3. Scholarship Sanctions
      if (!type || type === 'SCHOLARSHIP') {
        let schQuery = db.select({
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
        if (startDate) conditions.push(gte(sql`DATE(DATE_ADD(${scholarshipSanctions.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, startDate));
        if (endDate) conditions.push(lte(sql`DATE(DATE_ADD(${scholarshipSanctions.created_at}, INTERVAL '5:30' HOUR_MINUTE))`, endDate));
        if (conditions.length > 0) schQuery = schQuery.where(and(...conditions));

        const schResults = await schQuery.orderBy(desc(scholarshipSanctions.created_at)).limit(limit);
        transactions.push(...schResults);
      }

      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      return transactions.slice(0, limit);
    } catch (error) {
      logger.error(error, '[GET_ALL_TRANSACTIONS_ERROR]');
      throw error;
    }
  }

  /**
   * Verify transaction integrity (UTR uniqueness and Screenshot fingerprinting)
   * @param {Object} params { transactionId, paymentHash, studentId, requestId }
   * @returns {Promise<{ isFlagged: boolean, flagDetails: Object | null }>}
   */
  static async verifyTransactionIntegrity({ transactionId, paymentHash, studentId, requestId, feePaymentId }) {
    let isFlagged = false;
    let flagDetails = null;

    // 1. Transaction ID Conflict (UTR uniqueness)
    if (transactionId) {
      // Check in fee payments
      const conflictFee = await db.query.studentFeePayments.findFirst({
        where: eq(studentFeePayments.transaction_ref_no, transactionId)
      });

      if (conflictFee) {
        // Flag if it's a different student OR a different record by the same student (reusing UTR)
        if (!feePaymentId || conflictFee.id !== feePaymentId) {
          isFlagged = true;
          flagDetails = { type: 'UTR_CONFLICT_FEE', conflict_student_id: conflictFee.student_id };
        }
      }

      // Check in certificate requests
      if (!isFlagged) {
        const conflictReq = await db.query.studentRequests.findFirst({
          where: and(
            eq(studentRequests.transaction_id, transactionId),
            ne(studentRequests.status, 'REJECTED')
          )
        });

        if (conflictReq && (conflictReq.student_id !== studentId || (requestId && conflictReq.request_id !== requestId))) {
          isFlagged = true;
          flagDetails = { 
            type: 'UTR_CONFLICT_REQUEST', 
            conflict_student_id: conflictReq.student_id,
            conflict_request_id: conflictReq.request_id 
          };
        }
      }
    }

    // 2. Screenshot Hash Conflict (Fingerprinting)
    if (paymentHash && !isFlagged) {
      const conflictHash = await db.query.studentRequests.findFirst({
        where: and(
          eq(studentRequests.payment_hash, paymentHash),
          ne(studentRequests.status, 'REJECTED')
        )
      });

      if (conflictHash && (conflictHash.student_id !== studentId || (requestId && conflictHash.request_id !== requestId))) {
        isFlagged = true;
        flagDetails = {
          type: 'HASH_CONFLICT',
          conflict_student_id: conflictHash.student_id,
          conflict_request_id: conflictHash.request_id
        };
      }
    }

    return { isFlagged, flagDetails };
  }

  /**
   * Get comprehensive financial summary for a specific student and academic year
   * @param {number} studentId 
   * @param {string} academicYear 
   * @param {string} branchOrRoll Course code/name or student roll number
   * @returns {Promise<Object>} Aggregated financial summary
   */
  static async getStudentFinancialSummary(studentId, academicYear, branchOrRoll) {
    const { getYearlyTotalFee } = await import('@/lib/financial-utils');
    const { getBranchFromRoll } = await import('@/lib/rollNumber');

    // Ensure we have a valid branch name for fee lookup
    let course = branchOrRoll;
    if (branchOrRoll && branchOrRoll.length > 5) {
      course = getBranchFromRoll(branchOrRoll);
    }

    const totalFee = getYearlyTotalFee(course);
    const feeCategory = totalFee === 70000 ? 'SFC' : 'NON-SFC';

    // Use a runtime DB reference: if the top-level `db.query` is undefined
    // (happens when tests/mock import order differs), dynamically import
    // `@/db` so mocks are respected.
    const runtimeDb = (db && db.query) ? db : (await import('@/db')).db;

    const studentDataPromise = (runtimeDb.query.students && runtimeDb.query.students.findFirst)
      ? runtimeDb.query.students.findFirst({ where: eq(students.id, studentId) })
      : Promise.resolve(null);

    const [sanctions, payments, studentData] = await Promise.all([
      runtimeDb.query.scholarshipSanctions.findMany({
        where: and(
          eq(scholarshipSanctions.student_id, studentId),
          eq(scholarshipSanctions.academic_year, academicYear)
        ),
        orderBy: [asc(scholarshipSanctions.sanction_date)]
      }),
      runtimeDb.query.studentFeePayments.findMany({
        where: and(
          eq(studentFeePayments.student_id, studentId),
          eq(studentFeePayments.academic_year, academicYear)
        ),
        orderBy: [asc(studentFeePayments.transaction_date)]
      }),
      studentDataPromise
    ]);

    const { getExpectedScholarship } = await import('@/lib/financial-utils');
    let expectedGovt = getExpectedScholarship(studentData, totalFee);
    let expectedStudentLiability = Math.max(0, totalFee - expectedGovt);

    const activeSanctions = sanctions.filter(s => (s.status || 'SANCTIONED').toUpperCase() !== 'REJECTED');
    const govtPaid = activeSanctions.reduce((sum, s) => sum + (Number(s.sanctioned_amount) || 0), 0);
    const govtReleased = activeSanctions.reduce((sum, s) => sum + (Number(s.released_amount) || 0), 0);

    // Scholarship Window override has been moved to ScholarshipService.js


    
    const studentPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingFee = Math.max(0, totalFee - (govtPaid + studentPaid));

    const feeSummary = {
      totalFee,
      feeCategory,
      govtPaid,
      govtReleased,
      studentPaid,
      pendingFee,
      expectedGovt,
      expectedStudentLiability,
      status: pendingFee === 0 ? 'COMPLETED' : 'PENDING',
      // Legacy Aliases
      total_fee: totalFee,
      pending_fee: pendingFee,
      student_paid: studentPaid,
      govt_paid: govtPaid,
      govt_released: govtReleased,
      expected_govt: expectedGovt,
      expected_student_liability: expectedStudentLiability
    };

    const scholarshipProceedings = activeSanctions.map(s => ({
      id: s.id,
      proceeding_no: s.proceeding_no,
      amount: Number(s.sanctioned_amount) || 0,
      date: s.sanction_date,
      released_amount: Number(s.released_amount) || 0,
      released_date: s.released_date,
      status: s.status
    }));

    const studentPayments = payments.map(p => ({
      id: p.id,
      transaction_ref: p.transaction_ref_no,
      amount: Number(p.amount) || 0,
      date: p.transaction_date,
      payment_mode: p.payment_mode,
      bank_name: p.bank_name,
      created_at: p.created_at
    }));

    const applicationNo = sanctions.find(s => s.application_no)?.application_no || null;
    const thumbStatus = sanctions[0]?.thumb_status || null;
    const thumbUpdateAvailable = sanctions.some(s => s.thumb_update_available);
    const hardcopySubmitted = sanctions.some(s => s.hardcopy_submitted);

    return {
      academicYear,
      academic_year: academicYear,
      feeSummary,
      fee_summary: feeSummary,
      scholarshipProceedings,
      scholarship_proceedings: scholarshipProceedings,
      studentPayments,
      student_payments: studentPayments,
      applicationNo,
      application_no: applicationNo,
      thumbStatus,
      thumb_status: thumbStatus,
      thumbUpdateAvailable,
      thumb_update_available: thumbUpdateAvailable ? 1 : 0,
      hardcopySubmitted,
      hardcopy_submitted: hardcopySubmitted ? 1 : 0,
      is_scholarship_locked: false,
      record_state: (scholarshipProceedings.length === 0 && studentPayments.length === 0 && !applicationNo) 
        ? 'NO_RECORD' 
        : (feeSummary.status)
    };
  }
}
