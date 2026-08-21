'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useStaff } from '@/context/StaffContext';
import ProfileHeaderCard from '@/components/profile/ProfileHeaderCard';
import ProfileStatusBar from '@/components/profile/ProfileStatusBar';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfileInfoList from '@/components/profile/ProfileInfoList';
import ProfileCardShell from '@/components/profile/ProfileCardShell';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AdmissionStaffProfilePage() {
  const { staffData: staff, loading: isLoading } = useStaff();
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (!isLoading && staff && staff.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [staff, isLoading]);

  const personalItems = useMemo(() => {
    return [
      { key: 'email', label: 'Email', value: staff?.email || '-' },
      { key: 'mobile', label: 'Mobile', value: staff?.mobile || '-' },
      { key: 'employee_id', label: 'Employee ID', value: staff?.employee_id || '-' },
      { key: 'role', label: 'Role', value: staff?.role ? String(staff.role).toUpperCase() : '-' },
      { key: 'branch', label: 'Branch', value: staff?.branch || '-' },
      { key: 'address', label: 'Address', value: staff?.address || '-' },
    ];
  }, [staff]);

  if (isLoading && !staff) {
    return <LoadingSpinner label="Loading Profile" />;
  }

  if (!staff) return null;

  const name = staff?.name || 'Admission Staff';
  const primaryId = staff?.employee_id || (staff?.role ? String(staff.role).toUpperCase() : 'ADMISSION');

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex items-start justify-center">
        <ProfileCardShell
          left={
            <ProfileHeaderCard
              name={name}
              primaryId={primaryId}
              photoUrl={staff?.pfp}
              editHref="/staff/settings/edit-profile"
              editTitle="Modify Records"
              fallback="initials"
            />
          }
          right={
            <>
              <ProfileStatusBar
                title="Admissions Office"
                lines={[
                  { label: 'Designation', value: 'Admission Staff' },
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
