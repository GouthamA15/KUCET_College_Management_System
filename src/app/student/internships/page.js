import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Internships & Achievements | KUCET CMS',
  description: 'Student internships have been integrated into Academics Achievements.',
};

export default function StudentInternshipsRedirect() {
  redirect('/student/academics?tab=achievements');
}
