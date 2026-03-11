import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET() {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const [hardRow] = await query(
      'SELECT COUNT(*) AS count FROM scholarship_sanctions WHERE application_no IS NOT NULL AND hardcopy_submitted = 0',
      []
    );
    const [thumbRow] = await query(
      "SELECT COUNT(*) AS count FROM scholarship_sanctions WHERE thumb_update_available = 1 AND (thumb_status IS NULL OR UPPER(thumb_status) = 'PENDING')",
      []
    );
    const [totalRow] = await query('SELECT COUNT(*) AS count FROM scholarship_sanctions', []);

    const pendingHardCopies = Number(hardRow?.count || 0);
    const pendingThumbs = Number(thumbRow?.count || 0);
    const totalRecords = Number(totalRow?.count || 0);

    const windowRows = await query(
      'SELECT id, start_date, end_date FROM scholarship_windows ORDER BY id DESC LIMIT 1',
      []
    );
    const window = windowRows && windowRows[0] ? windowRows[0] : null;

    let windowStatus = 'CLOSED';
    let windowStartDate = null;
    let windowEndDate = null;

    if (window && window.start_date && window.end_date) {
      const now = await getNow();
      // DB returns dates as strings (YYYY-MM-DD) due to dateStrings: true
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
