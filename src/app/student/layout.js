'use client';

import { StudentProvider } from '@/context/StudentContext';
import { ProfileActivityProvider } from '@/context/ProfileActivityContext';

export default function StudentLayout({ children }) {
  return (
    <StudentProvider>
      <ProfileActivityProvider>
        {children}
      </ProfileActivityProvider>
    </StudentProvider>
  );
}
