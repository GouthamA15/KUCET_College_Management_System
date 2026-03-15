'use client';
import ComingSoon from '@/components/ComingSoon';
import { useClerk } from '@/context/ClerkContext';

export default function ClerkEditProfilePage() {
  const { clerkData: clerk } = useClerk();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <ComingSoon title="Edit Profile" icon="👤" />
    </div>
  );
}
