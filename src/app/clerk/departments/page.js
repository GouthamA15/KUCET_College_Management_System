'use client';
import ComingSoon from '@/components/ComingSoon';
import { useClerk } from '@/context/ClerkContext';

export default function ClerkDepartmentsPage() {
  const { clerkData: clerk } = useClerk();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <ComingSoon title="Departments" icon="🏢" />
    </div>
  );
}
