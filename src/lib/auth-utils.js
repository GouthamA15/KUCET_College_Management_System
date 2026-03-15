import { SignJWT } from 'jose';

export function getDashboardPathByRole(role) {
  switch (role) {
    case 'scholarship':
      return '/clerk/scholarship/dashboard';
    case 'admission':
      return '/clerk/admission/dashboard';
    case 'faculty':
      return '/clerk/faculty/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/'; // Fallback for unknown roles or student login
  }
}

/**
 * Generates a student auth JWT and attaches it to the provided NextResponse.
 */
export async function issueStudentAuthCookie(response, student, rememberMe = false) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const sessionDuration = rememberMe ? '30d' : '1h';
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 60 * 60;

  const token = await new SignJWT({
    student_id: student.id || student.student_id,
    roll_no: student.roll_no,
    name: student.name,
    is_email_verified: student.is_email_verified === 1 || student.is_email_verified === true,
    has_password_set: !!(student.password_hash || student.has_password_set)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  response.cookies.set('student_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
    path: '/',
  });

  return response;
}
