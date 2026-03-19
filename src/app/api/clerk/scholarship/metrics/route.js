import { db } from '@/db';
import { scholarshipSanctions, scholarshipWindows } from '@/db/schema';
import { eq, and, or, isNull, sql, desc, count } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET() {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const hardRow = await db.select({ count: count() })
      .from(scholarshipSanctions)
      .where(and(
        sql`${scholarshipSanctions.application_no} IS NOT NULL`,
        eq(scholarshipSanctions.hardcopy_submitted, 0)
      ));

    const thumbRow = await db.select({ count: count() })
      .from(scholarshipSanctions)
      .where(and(
        eq(scholarshipSanctions.thumb_update_available, true),
        or(
          isNull(scholarshipSanctions.thumb_status),
          eq(sql`UPPER(${scholarshipSanctions.thumb_status})`, 'PENDING')
        )
      ));

    const totalRow = await db.select({ count: count() })
      .from(scholarshipSanctions);

    const pendingHardCopies = Number(hardRow[0]?.count || 0);
    const pendingThumbs = Number(thumbRow[0]?.count || 0);
    const totalRecords = Number(totalRow[0]?.count || 0);

    const window = await db.query.scholarshipWindows.findFirst({
      orderBy: [desc(scholarshipWindows.id)]
    });

    let windowStatus = 'CLOSED';
    let windowStartDate = null;
    let windowEndDate = null;

    if (window && window.start_date && window.end_date) {
      const now = await getNow();
      const start = new Date(window.start_date);
      const end = new Date(window.end_date);
      const today = new Date(now.toISOString().slice(0, 10));

      windowStartDate = window.start_date;
      windowEndDate = window.end_date;

      if (today >= start && today <= end) {
        windowStatus = 'OPEN';
      }
    }

    return apiResponse({
      pendingHardCopies,
      pendingThumbs,
      totalRecords,
      windowStatus,
      windowStartDate,
      windowEndDate,
    });
  } catch (error) {
    console.error('Error fetching scholarship metrics:', error);
    return apiError('Internal Server Error', 500);
  }
}
