import { Suspense } from 'react';
import HodStaffManagementClient from './HodStaffManagementClient';

export const metadata = {
  title: 'HOD Staff Management | KUCET CMS',
  description: 'Manage department faculty, subject interests, and assignments.',
};

export default function HodStaffManagementPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div></div>}>
      <HodStaffManagementClient />
    </Suspense>
  );
}
