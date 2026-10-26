import { GET as exportHandler } from '@/app/api/staff/admission/export-students/route';

/**
 * GET /api/staff/coordinator/export-students
 * Dedicated, purpose-limited export endpoint for First-Year Coordinators.
 * Automatically scopes data to authorized first-year cohort with APAAR ID.
 */
export async function GET(req) {
  const url = new URL(req.url);
  if (!url.searchParams.has('scope')) {
    url.searchParams.set('scope', 'first_year');
  }
  const forwardReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers
  });
  return exportHandler(forwardReq);
}
