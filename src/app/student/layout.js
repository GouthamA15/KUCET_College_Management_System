import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function StudentLayout({ children }) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');

  if (!studentAuthCookie || studentAuthCookie.value !== 'true') {
    redirect('/');
  }

  const headersList = await headers();
  const pathname = headersList.get('x-next-pathname');

  if (pathname === '/student') {
    redirect('/student/profile');
  }

  return <>{children}</>;
}
