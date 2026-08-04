import { db } from '@/db';
import { scholarshipSanctions, scholarshipWindows } from '@/db/schema';
import { eq, and, or, isNull, sql, desc, count } from 'drizzle-orm';
import { getNow } from '@/lib/clock';
import { toMySQLDate } from '@/lib/date';
import { FinanceService } from '../finance/FinanceService';

/**
 * Service for Scholarship-related business logic
 */
export class ScholarshipService {
  /**
   * Get the status of the institutional scholarship window
   */
  static async getWindowStatus() {
    const window = await db.query.scholarshipWindows.findFirst({
      orderBy: [desc(scholarshipWindows.id)]
    });

    if (!window || !window.start_date || !window.end_date) {
      return { status: 'CLOSED', startDate: null, endDate: null };
    }

    const now = await getNow();
    const start = new Date(new Date(window.start_date).toISOString().slice(0, 10));
    const end = new Date(new Date(window.end_date).toISOString().slice(0, 10));
    const today = new Date(now.toISOString().slice(0, 10));

    let status = 'CLOSED';
    if (today >= start && today <= end) {
      status = 'OPEN';
    }

    return {
      status,
      startDate: toMySQLDate(window.start_date),
      endDate: toMySQLDate(window.end_date),
      windowRecord: window
    };
  }

  /**
   * Get institutional scholarship metrics
   */
  static async getMetrics() {
    const [hardRow, thumbRow, totalRow, windowInfo] = await Promise.all([
      db.select({ count: count() })
        .from(scholarshipSanctions)
        .where(and(
          sql`${scholarshipSanctions.application_no} IS NOT NULL`,
          eq(scholarshipSanctions.hardcopy_submitted, 0)
        )),
      db.select({ count: count() })
        .from(scholarshipSanctions)
        .where(and(
          eq(scholarshipSanctions.thumb_update_available, true),
          or(
            isNull(scholarshipSanctions.thumb_status),
            eq(sql`UPPER(${scholarshipSanctions.thumb_status})`, 'PENDING')
          )
        )),
      db.select({ count: count() }).from(scholarshipSanctions),
      this.getWindowStatus()
    ]);

    return {
      pendingHardCopies: Number(hardRow[0]?.count || 0),
      pendingThumbs: Number(thumbRow[0]?.count || 0),
      totalRecords: Number(totalRow[0]?.count || 0),
      windowStatus: windowInfo.status,
      windowStartDate: windowInfo.startDate,
      windowEndDate: windowInfo.endDate
    };
  }

  /**
   * Check if a student has an active scholarship record for a given academic year.
   * An active record means they have an application number or at least one active sanction.
   */
  static async hasScholarshipRecord(studentId, academicYear) {
    const sanctions = await db.query.scholarshipSanctions.findMany({
      where: and(
        eq(scholarshipSanctions.student_id, studentId),
        eq(scholarshipSanctions.academic_year, academicYear)
      )
    });
    const activeSanctions = sanctions.filter(s => (s.status || 'SANCTIONED').toUpperCase() !== 'REJECTED');
    const hasApp = sanctions.some(s => s.application_no && String(s.application_no).trim() !== '');
    return hasApp || activeSanctions.length > 0;
  }

  /**
   * Get student financial summary with Scholarship Window override applied.
   * This leaves FinanceService pristine and enforces business rules in the Scholarship domain.
   */
  static async getScholarshipFinancialSummary(studentId, academicYear, rollNo) {
    // 1. Fetch raw generic financial summary
    const summary = await FinanceService.getStudentFinancialSummary(studentId, academicYear, rollNo);
    
    // 2. Fetch Scholarship Window Status
    const winStatus = await this.getWindowStatus();
    
    // 3. Check for existing active scholarship record
    const hasRecord = await this.hasScholarshipRecord(studentId, academicYear);

    summary.is_scholarship_locked = false;

    // 4. Apply Override Rule
    // If the window is CLOSED, for the current academic year, and the student has NO record:
    if (winStatus.windowRecord && winStatus.windowRecord.academic_year === academicYear) {
      if (winStatus.status === 'CLOSED' && !hasRecord) {
        summary.is_scholarship_locked = true;
        
        // Override the expected government contribution to 0 and liability to full fee
        summary.feeSummary.expectedGovt = 0;
        summary.feeSummary.expectedStudentLiability = summary.feeSummary.totalFee;
        
        // Also override legacy aliases
        summary.feeSummary.expected_govt = 0;
        summary.feeSummary.expected_student_liability = summary.feeSummary.totalFee;
        summary.fee_summary.expected_govt = 0;
        summary.fee_summary.expected_student_liability = summary.feeSummary.totalFee;
      }
    }

    return summary;
  }
}
