'use client';

import React, { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll, getResolvedCurrentAcademicYear, getBatchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import ProfileHeaderCard from '@/components/student/ProfileHeaderCard';
import ProfileStatusBar from '@/components/student/ProfileStatusBar';
import ProfileTabs from '@/components/student/ProfileTabs';
import PersonalInfoTab from '@/components/student/PersonalInfoTab';
import SetPasswordGate from '@/components/student/SetPasswordGate';
import useProfileEdit from '@/components/student/hooks/useProfileEdit';
import useEmailVerification from '@/components/student/hooks/useEmailVerification';
import usePasswordSetup from '@/components/student/hooks/usePasswordSetup';
import Loading from './loading';

export default function StudentProfileNew() {
  const { studentData, collegeInfo, loading: contextLoading, refreshData } = useStudent();
  const [activeTab, setActiveTab] = useState('personal');
  
  // Feature hooks (call unconditionally to preserve hook order)
  const password = usePasswordSetup(studentData?.student?.roll_no);
  const profileEdit = useProfileEdit(studentData, refreshData);
  const emailVerify = useEmailVerification({
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
  const { yearOfStudy, semester, semesterLabel } = calculateYearAndSemester(student.roll_no, collegeInfo);
  const currentAcademicYearLabel = (() => { try { return getResolvedCurrentAcademicYear(student.roll_no, collegeInfo); } catch { return null; } })();
  const batchString = (() => { try { return getBatchFromRoll(student.roll_no); } catch { return null; } })();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
      <SetPasswordGate show={password.showSetPasswordModal} rollno={student.roll_no} email={profileEdit.email} onPasswordSet={() => { password.setShowSetPasswordModal(false); refreshData(); }} />

      <div className="flex items-start justify-center">
        <div className="w-full bg-white shadow-xl rounded-lg p-6 overflow-hidden border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            <ProfileHeaderCard student={student} />
            <div className="flex flex-col justify-start">
              <ProfileStatusBar courseLabel={courseLabel} yearOfStudy={yearOfStudy} semesterLabel={semesterLabel} currentAcademicYearLabel={currentAcademicYearLabel} batchString={batchString} />
              <ProfileTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                personalPanel={<PersonalInfoTab student={student} />}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
