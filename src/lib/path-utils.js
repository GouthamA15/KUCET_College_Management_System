export function getDashboardPathByRole(role) {
  switch (role) {
    case 'scholarship':
      return '/staff/scholarship/dashboard';
    case 'admission':
      return '/staff/admission/dashboard';
    case 'faculty':
      return '/staff/faculty/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/'; // Fallback for unknown roles or student login
  }
}

/**
 * Detects if the current pathname is a dashboard root page.
 * Institutional mobile headers are only shown on these pages.
 */
export function isDashboardRoot(pathname) {
  if (!pathname) return false;
  
  const dashboardRoots = [
    '/',
    '/student',
    '/staff',
    '/faculty',
    '/admin',
    '/admin/dashboard',
    '/staff/admission/dashboard',
    '/staff/scholarship/dashboard',
    '/staff/faculty/dashboard'
  ];
  
  return dashboardRoots.includes(pathname);
}

/**
 * Detects whether a pathname belongs to an authenticated dashboard area.
 * Used for the institutional mobile header/topbar system.
 */
export function isDashboardRoute(pathname) {
  if (!pathname) return false;

  // Keep the public landing page out of the dashboard header stack.
  if (pathname === '/') return false;

  return (
    pathname === '/student' || pathname.startsWith('/student/') ||
    pathname === '/staff' || pathname.startsWith('/staff/') ||
    pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/faculty' || pathname.startsWith('/faculty/')
  );
}

/**
 * Returns the institutional portal title based on the current pathname.
 */
export function getPortalTitle(pathname) {
  if (!pathname) return 'Portal';
  
  if (pathname.startsWith('/student')) return 'Student Portal';
  if (pathname.startsWith('/staff/admission')) return 'Admission Portal';
  if (pathname.startsWith('/staff/scholarship')) return 'Scholarship Portal';
  if (pathname.startsWith('/staff/faculty')) return 'Faculty Portal';
  if (pathname.startsWith('/faculty')) return 'Faculty Portal';
  if (pathname.startsWith('/admin')) return 'Admin Portal';

  if (pathname.startsWith('/staff')) return 'Clerk Portal';
  
  // HOD specific detection if needed, otherwise fallback to Faculty
  if (pathname.includes('/hod')) return 'HOD Operations';
  
  return 'KUCET Portal';
}
