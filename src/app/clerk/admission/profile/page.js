'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useClerk } from '@/context/ClerkContext';
import ProfileHeaderCard from '@/components/profile/ProfileHeaderCard';
import ProfileStatusBar from '@/components/profile/ProfileStatusBar';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfileInfoList from '@/components/profile/ProfileInfoList';
import ProfileCardShell from '@/components/profile/ProfileCardShell';

export default function AdmissionClerkProfilePage() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'admission') {
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
      { key: 'address', label: 'Address', value: clerk?.address || '-' },
    ];
  }, [clerk]);

  if (isLoading && !clerk) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-100 border-t-[#0b3578] rounded-full animate-spin"></div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Profile</span>
        </div>
      </div>
    );
  }

  if (!clerk) return null;

  const name = clerk?.name || 'Admission Clerk';
  const primaryId = clerk?.employee_id || (clerk?.role ? String(clerk.role).toUpperCase() : 'ADMISSION');

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
                title="Admissions Office"
                lines={[
                  { label: 'Designation', value: 'Admission Clerk' },
                  { label: 'Responsibilities', value: 'Requests • Finalize • Certificates' },
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
