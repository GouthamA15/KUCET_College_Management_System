// src/lib/auth-utils.js

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
