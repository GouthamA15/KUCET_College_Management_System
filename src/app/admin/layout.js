import { AdminProvider } from '@/context/AdminContext';

export default async function AdminLayout({ children }) {
  return (
    <AdminProvider>
      {children}
    </AdminProvider>
  );
}
