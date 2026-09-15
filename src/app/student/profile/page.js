'use client';

import React, { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll, getBatchFromRoll } from '@/lib/rollNumber';
import ProfileHeaderCard from '@/components/student/ProfileHeaderCard';
import ProfileStatusBar from '@/components/student/ProfileStatusBar';
import ProfileTabs from '@/components/student/ProfileTabs';
import PersonalInfoTab from '@/components/student/PersonalInfoTab';
import SetPasswordGate from '@/components/student/SetPasswordGate';
import ProfileActivityBar from '@/components/student/ProfileActivityBar';
import ProfileWarningBar from '@/components/student/ProfileWarningBar';
import useProfileEdit from '@/hooks/student/useProfileEdit';
import useEmailVerification from '@/hooks/student/useEmailVerification';
import usePasswordSetup from '@/hooks/student/usePasswordSetup';
import useProfileActivity from '@/hooks/student/useProfileActivity';
import Loading from './loading';

export default function StudentProfileNew() {
  const { studentData, loading: contextLoading, refreshData } = useStudent();
  const [activeTab, setActiveTab] = useState('personal');

  const activity = useProfileActivity();
  
  // Feature hooks (call unconditionally to preserve hook order)
  const password = usePasswordSetup(studentData?.student?.roll_no);
  const profileEdit = useProfileEdit(studentData, refreshData);
  const _emailVerify = useEmailVerification({
    rollno: studentData?.student?.roll_no,
    newEmail: profileEdit.email,
    setEmail: profileEdit.setEmail,
    originalEmail: profileEdit.originalEmail,
    isPasswordSet: password.isPasswordSet,
    openSetPasswordModal: password.setShowSetPasswordModal,
    refreshData,
  });

  if (!studentData && contextLoading) return <Loading />;
  if (!studentData) return null;

  const { student } = studentData;

  const branch = getBranchFromRoll(student.roll_no);
  const courseLabel = branch ? `B. Tech (${branch})` : 'B. Tech';
  const { yearOfStudy, semesterLabel, academicYear: currentAcademicYearLabel } = studentData?.academic_session || {};
  const batchString = (() => { try { return getBatchFromRoll(student.roll_no); } catch { return null; } })();

  return (
    <div className="max-w-6xl mx-auto space-y-3 animate-fadeIn">
      <SetPasswordGate show={password.showSetPasswordModal} rollno={student.roll_no} email={profileEdit.email} onPasswordSet={() => { password.setShowSetPasswordModal(false); refreshData(); }} />

      <ProfileActivityBar activity={activity} student={student} />
      <ProfileWarningBar student={student} />

      <div className="relative overflow-hidden rounded-[24px] border border-[#dfeafc] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] shadow-[0_20px_48px_rgba(11,53,120,0.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(88,140,255,0.12),_transparent_30%)]" />

        <div className="relative p-2 sm:p-3 lg:p-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr] xl:gap-4 pt-3 sm:pt-10 xl:pt-0">
            <div className="xl:mt-0">
              <ProfileHeaderCard student={student} refreshData={refreshData} />
            </div>

            <div className="space-y-4 sm:space-y-3">
              <div className="order-2 sm:order-none">
                <ProfileTabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  personalPanel={<PersonalInfoTab student={student} />}
                />
              </div>

              <div className="order-1 sm:order-none rounded-2xl border border-[#cbd9ef] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-3 shadow-[0_10px_24px_rgba(11,53,120,0.08)] xl:rounded-2xl xl:border-slate-200 xl:bg-slate-50/80 xl:p-4 xl:shadow-sm xl:backdrop-blur-sm">
                <ProfileStatusBar courseLabel={courseLabel} yearOfStudy={yearOfStudy} semesterLabel={semesterLabel} currentAcademicYearLabel={currentAcademicYearLabel} batchString={batchString} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
