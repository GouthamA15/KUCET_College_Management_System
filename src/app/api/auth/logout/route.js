import { apiResponse } from '@/lib/api-utils';
import { handleLogoutRevocation, clearAllAuthCookies } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const revoked = searchParams.get('revoked');
  
  const redirectUrl = new URL(revoked === 'true' ? '/?revoked=true' : '/', request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  if (request) {
    await handleLogoutRevocation(request, 'staff');
    await handleLogoutRevocation(request, 'admin');
    await handleLogoutRevocation(request, 'student');
  }

  clearAllAuthCookies(response);
  return response;
}

export async function POST(request) {
  if (request) {
    await handleLogoutRevocation(request, 'staff');
    await handleLogoutRevocation(request, 'admin');
    await handleLogoutRevocation(request, 'student');
  }

  const response = apiResponse(
    { success: true, message: 'Logged out' },
    200,
    { 'Clear-Site-Data': '"cache", "storage"' }
  );
  
  clearAllAuthCookies(response);
  return response;
}

