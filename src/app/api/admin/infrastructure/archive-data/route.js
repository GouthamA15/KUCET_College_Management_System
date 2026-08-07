import { apiError } from '@/lib/api-utils';

/**
 * @deprecated Legacy archive endpoint removed in favor of DDD Archive Architecture.
 * Use /api/admin/archive (GET) and /api/admin/archive/run (POST).
 */
export async function POST() {
  return apiError(
    'This legacy archive endpoint has been deprecated. Please use the authoritative Archive Management API at /api/admin/archive/run.',
    410
  );
}

export async function GET() {
  return apiError(
    'This legacy archive endpoint has been deprecated. Please use the authoritative Archive Management API at /api/admin/archive.',
    410
  );
}
