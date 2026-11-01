import { GET as exportHandler } from '@/app/api/staff/admission/export-students/route';

/**
 * GET /api/staff/hod/export-students
 * Dedicated, purpose-limited export endpoint for Heads of Department (HOD).
 * Automatically scopes data to the HOD's authorized branch with APAAR ID.
 */
export async function GET(req) {
  const url = new URL(req.url);
  if (!url.searchParams.has('scope')) {
    url.searchParams.set('scope', 'department');
  }
  const forwardReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers
  });
  return exportHandler(forwardReq);
}
