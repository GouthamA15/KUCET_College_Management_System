'use client';

import React, { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import { getBranchFromRoll, getResolvedCurrentAcademicYear, getBatchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import StudentProfileLayout from '@/components/student/StudentProfileLayout';
import ProfileWarningBar from '@/components/student/ProfileWarningBar';
import ProfileActivityBar from '@/components/student/ProfileActivityBar';
import ProfileHeaderCard from '@/components/student/ProfileHeaderCard';
import ProfileStatusBar from '@/components/student/ProfileStatusBar';
import ProfileTabs from '@/components/student/ProfileTabs';
import PersonalInfoTab from '@/components/student/PersonalInfoTab';
import ScholarshipTableDesktop from '@/components/student/ScholarshipTableDesktop';
import ScholarshipCardsMobile from '@/components/student/ScholarshipCardsMobile';
import SetPasswordGate from '@/components/student/SetPasswordGate';
import useScholarshipRows from '@/components/student/useScholarshipRows';
import useProfileEdit from '@/components/student/hooks/useProfileEdit';
import useEmailVerification from '@/components/student/hooks/useEmailVerification';
import usePasswordSetup from '@/components/student/hooks/usePasswordSetup';
import useProfileActivity from '@/components/student/hooks/useProfileActivity';
import SyllabusTab from './SyllabusTab';
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
  const activity = useProfileActivity(studentData?.student?.roll_no);
  const { rows } = useScholarshipRows(studentData?.student?.roll_no, studentData?.scholarship || []);

  if (!studentData && contextLoading) return <Loading />;
  if (!studentData) return null;

  const { student } = studentData;

  const branch = getBranchFromRoll(student.roll_no);
  const courseLabel = branch ? `B. Tech (${branch})` : 'B. Tech';
  const { yearOfStudy, semester, semesterLabel } = calculateYearAndSemester(student.roll_no, collegeInfo);
  const currentAcademicYearLabel = (() => { try { return getResolvedCurrentAcademicYear(student.roll_no); } catch { return null; } })();
  const batchString = (() => { try { return getBatchFromRoll(student.roll_no); } catch { return null; } })();

  return (
    <StudentProfileLayout>
      <Header />
      <Navbar studentProfileMode={true} activeTab={'profile'} onLogout={async () => { try { await fetch('/api/student/logout', { method: 'POST' }); } catch {} finally { localStorage.removeItem('logged_in_student'); sessionStorage.clear(); window.location.replace('/'); } }} />

      <SetPasswordGate show={password.showSetPasswordModal} rollno={student.roll_no} email={profileEdit.email} onPasswordSet={() => { password.setShowSetPasswordModal(false); refreshData(); }} />

      <ProfileWarningBar student={student} />
      <ProfileActivityBar latestRequest={activity.latestRequest} dismissCount={activity.dismissCount} onDismiss={activity.dismiss} onReset={activity.reset} />

      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-lg p-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            <ProfileHeaderCard student={student} />
            <div className="flex flex-col justify-start">
              <ProfileStatusBar courseLabel={courseLabel} yearOfStudy={yearOfStudy} semesterLabel={semesterLabel} currentAcademicYearLabel={currentAcademicYearLabel} batchString={batchString} />
              <ProfileTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                personalPanel={<PersonalInfoTab student={student} />}
                scholarshipPanel={<>
                  <ScholarshipTableDesktop rows={rows} />
                  <ScholarshipCardsMobile rows={rows} />
                </>}
                syllabusPanel={<SyllabusTab branch={branch} semester={semester} />}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </StudentProfileLayout>
  );
}
