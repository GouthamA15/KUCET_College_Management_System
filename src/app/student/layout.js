import { StudentProvider } from '@/context/StudentContext';

export default async function StudentLayout({ children }) {
  return (
    <StudentProvider>
      {children}
    </StudentProvider>
  );
}
