'use client';

import { StudentProvider } from '@/context/StudentContext';
import { ProfileActivityProvider } from '@/context/ProfileActivityContext';
import StudentActivityBar from '@/components/student/StudentActivityBar';

export default function StudentLayout({ children }) {
  return (
    <StudentProvider>
      <ProfileActivityProvider>
        <StudentActivityBar />
        {children}
      </ProfileActivityProvider>
    </StudentProvider>
  );
}
