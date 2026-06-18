import { db } from '@/db';
import { scholarshipSanctions, scholarshipWindows } from '@/db/schema';
import { eq, and, or, isNull, sql, desc, count } from 'drizzle-orm';
import { getNow } from '@/lib/clock';
import { toMySQLDate } from '@/lib/date';

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
   * Atomic update for scholarship sanctions with optimistic locking
   */
  static async updateSanctionAtomic(id, data, originalVersion, tx = db) {
    const res = await tx.update(scholarshipSanctions)
      .set({
        ...data,
        version: sql`${scholarshipSanctions.version} + 1`
      })
      .where(and(
        eq(scholarshipSanctions.id, id),
        eq(scholarshipSanctions.version, originalVersion)
      ));

    const header = Array.isArray(res) ? res[0] : res;
    return (header?.affectedRows || 0) > 0;
  }
}
