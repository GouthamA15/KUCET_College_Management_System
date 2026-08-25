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

export default function FacultyProfilePage() {
  const { staffData: staff, loading: isLoading } = useStaff();
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (!isLoading && staff && staff.role !== 'faculty') {
      toast.error('Access Denied');
    }
  }, [staff, isLoading]);

  const personalItems = useMemo(() => {
    return [
      { key: 'email', label: 'Email', value: staff?.email || '-' },
      { key: 'mobile', label: 'Mobile', value: staff?.mobile || '-' },
      { key: 'employee_id', label: 'Employee ID', value: staff?.employee_id || '-' },
      { key: 'account_status', label: 'Account Status', value: staff?.is_active ? 'Active' : 'Inactive' },
      { key: 'joined', label: 'Joined', value: staff?.created_at ? new Date(staff.created_at).toLocaleDateString() : '-' },
      { key: 'last_login', label: 'Last Login', value: staff?.last_login_at ? new Date(staff.last_login_at).toLocaleString() : '-' },
      { key: 'address', label: 'Address', value: staff?.address || '-' },
    ];
  }, [staff]);

  if (isLoading && !staff) {
    return <LoadingSpinner label="Loading Profile" />;
  }

  if (!staff) return null;

  const name = staff?.name || 'Faculty';
  const primaryId = staff?.employee_id || 'FACULTY';
  const title = staff?.is_hod ? 'HOD Office' : 'Faculty';

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
                title={title}
                lines={[
                  { label: 'Designation', value: staff?.is_hod ? 'Head of Department' : 'Faculty' },
                  { label: 'Department(s)', value: staff?.branches?.length > 0 ? staff.branches.join(', ') : (staff?.branch || '-') },
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