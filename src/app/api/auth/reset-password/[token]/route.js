import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { PasswordResetService } from '@/services/identity/PasswordResetService';

export async function GET(req, { params }) {
  try {
    const key = getTieredKey(req, 'reset_password_get');
    const rateCheck = await checkRateLimit(key, 5, 900);
    if (!rateCheck.success) {
      return apiError('Too many password reset validation requests. Please try again in 15 minutes.', 429);
    }

    const resolved = params ? await params : {};
    const { token } = resolved || {};

    const validation = await PasswordResetService.validateToken(token);
    if (!validation.valid) {
      return apiError(validation.message, validation.statusCode, { code: validation.status, status: validation.status });
    }

    return apiResponse({ status: 'VALID' });
  } catch (_err) {
    return apiError('Unable to validate reset link. Please try again.', 400, { code: 'INVALID', status: 'INVALID' });
  }
}

export async function POST(req, { params }) {
  try {
    const key = getTieredKey(req, 'reset_password_post');
    const rateCheck = await checkRateLimit(key, 5, 900);
    if (!rateCheck.success) {
      return apiError('Too many password reset attempts. Please try again in 15 minutes.', 429);
    }

    const resolved = params ? await params : {};
    const body = await req.json().catch(() => ({}));
    const token = resolved?.token || body.token;
    const password = body.password;

    if (!token || !password) {
      return apiError('Missing token or password', 400);
    }

    const xff = req.headers.get('x-forwarded-for');
    const clientIp = xff ? xff.split(',')[0].trim() : req.ip;
    const userAgent = req.headers.get('user-agent');

    const result = await PasswordResetService.executeReset({
      rawToken: token,
      newPassword: password,
      clientIp,
      userAgent
    });

    if (!result.success) {
      return apiError(result.error, result.statusCode, result.status ? { code: result.status } : undefined);
    }

    return apiResponse({ message: result.message });
  } catch (_err) {
    return apiError('Internal server error', 500);
  }
}
