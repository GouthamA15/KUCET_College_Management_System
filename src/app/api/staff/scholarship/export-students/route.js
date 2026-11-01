import { GET as exportHandler } from '@/app/api/staff/admission/export-students/route';

/**
 * GET /api/staff/scholarship/export-students
 * Dedicated, purpose-limited export endpoint for Scholarship Staff.
 * Automatically scopes data to approved scholarship fields with APAAR ID.
 */
export async function GET(req) {
  const url = new URL(req.url);
  if (!url.searchParams.has('scope')) {
    url.searchParams.set('scope', 'scholarship');
  }
  const forwardReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers
  });
  return exportHandler(forwardReq);
}
