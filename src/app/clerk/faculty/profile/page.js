'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useClerk } from '@/context/ClerkContext';
import ProfileHeaderCard from '@/components/profile/ProfileHeaderCard';
import ProfileStatusBar from '@/components/profile/ProfileStatusBar';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfileInfoList from '@/components/profile/ProfileInfoList';
import ProfileCardShell from '@/components/profile/ProfileCardShell';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function FacultyProfilePage() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'faculty') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  const personalItems = useMemo(() => {
    return [
      { key: 'email', label: 'Email', value: clerk?.email || '-' },
      { key: 'mobile', label: 'Mobile', value: clerk?.mobile || '-' },
      { key: 'employee_id', label: 'Employee ID', value: clerk?.employee_id || '-' },
      { key: 'role', label: 'Role', value: clerk?.role ? String(clerk.role).toUpperCase() : '-' },
      { key: 'branch', label: 'Branch', value: clerk?.branch || '-' },
      { key: 'hod', label: 'HOD', value: clerk?.is_hod ? 'Yes' : 'No' },
      { key: 'address', label: 'Address', value: clerk?.address || '-' },
    ];
  }, [clerk]);

  if (isLoading && !clerk) {
    return <LoadingSpinner label="Loading Profile" />;
  }

  if (!clerk) return null;

  const name = clerk?.name || 'Faculty';
  const primaryId = clerk?.employee_id || 'FACULTY';
  const title = clerk?.is_hod ? 'HOD Office' : 'Faculty';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex items-start justify-center">
        <ProfileCardShell
          left={
            <ProfileHeaderCard
              name={name}
              primaryId={primaryId}
              photoUrl={clerk?.pfp}
              editHref="/clerk/settings/edit-profile"
              editTitle="Modify Records"
              fallback="initials"
            />
          }
          right={
            <>
              <ProfileStatusBar
                title={title}
                lines={[
                  { label: 'Designation', value: clerk?.is_hod ? 'Head of Department' : 'Faculty' },
                  { label: 'Department', value: clerk?.branch || '-' },
                ]}
              />
              <ProfileTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                personalPanel={<ProfileInfoList items={personalItems} />}
              />
            </>
          }
        />
      </div>
    </div>
  );
}