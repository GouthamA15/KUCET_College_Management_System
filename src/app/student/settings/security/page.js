'use client';

import { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { AlertCircle } from 'lucide-react';
import { formatInstitutionalDate, formatInstitutionalDateTime } from '@/lib/date';
import { formatIPAddress } from '@/lib/security';
import { 
  useSecurityEvents, 
  usePasswordManagement,
  useEmailVerification
} from '@/hooks/security';
import {
  SecurityCenter,
  SecurityOverview,
  SecurityActivity,
  SecurityAuthentication,
  SecurityStatusItem,
  StudentActivationUI,
  SecurityLoadingState
} from '@/components/security';

export default function SecurityCenterPage() {
  const { studentData, loading, refreshData } = useStudent();
  const student = studentData?.student;
  const [activeTab, setActiveTab] = useState('overview');
  
  const isEmailVerified = !!student?.is_email_verified;
  const isPasswordSet = !!student?.password_hash;

  const { securityEvents, eventsLoading, fetchEvents } = useSecurityEvents(student?.roll_no, isEmailVerified);

  const emailVerification = useEmailVerification(student?.roll_no, student?.email, refreshData);
  const passwordMgmt = usePasswordManagement({
    role: 'student',
    roll_no: student?.roll_no,
    isPasswordSet,
    onSuccess: async () => {
      await refreshData();
      fetchEvents();
    }
  });

  if (loading && !studentData) return <SecurityLoadingState message="Loading Security Center..." />;
  if (!student) return <div className="p-8 text-center text-red-500">Student session not found.</div>;

  if (!isEmailVerified || !isPasswordSet) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-12 px-4 sm:px-0">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">Account Activation Required</h1>
          <p className="text-sm text-gray-600 mt-1">To ensure your security and unlock all features, please complete the activation steps below.</p>
        </header>

        <StudentActivationUI 
          {...emailVerification}
          isEmailVerified={isEmailVerified}
          isPasswordSet={isPasswordSet}
          resendCountdown={emailVerification.resendCountdown}
          passwordManagement={passwordMgmt}
          generatePassword={passwordMgmt.generatePassword}
        />
        
        <div className="bg-gray-50 p-4 rounded-md border border-gray-300 flex gap-3">
          <AlertCircle className="text-gray-400 shrink-0" size={20} />
          <p className="text-xs text-gray-600 leading-relaxed">
            Activation is a one-time process. Once completed, you will be able to access your full student dashboard securely.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SecurityCenter
      userType="student"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      unreadCount={0}
      overviewContent={
        <SecurityOverview title="Security Health Overview" description="Core security status of your institutional account.">
          <SecurityStatusItem 
            label="Email Status" 
            value={student.email} 
            subValue={isEmailVerified ? "Verified Institutional Account" : "Unverified"}
            ok={isEmailVerified}
          />
          <SecurityStatusItem 
            label="Password Security" 
            value={isPasswordSet ? "Personal Password Set" : "Initial DOB Setup"} 
            subValue={isPasswordSet ? "Standard Encryption Protected" : "Action Recommended"}
            ok={isPasswordSet}
          />
          <SecurityStatusItem 
            label="Last Account Activity" 
            value={student.last_login_at ? formatInstitutionalDateTime(student.last_login_at) : 'No record found'} 
            subValue={formatIPAddress(student.last_login_ip) || "Unknown Location"}
            ok={true}
          />
          <SecurityStatusItem 
            label="Account Created" 
            value={formatInstitutionalDate(student.created_at)} 
            subValue="Official Enrollment Record"
            ok={true}
          />
          {student.password_changed_at && (
            <SecurityStatusItem 
              label="Password Last Updated" 
              value={formatInstitutionalDateTime(student.password_changed_at)} 
              subValue="Recent Authentication Change"
              ok={true}
            />
          )}
        </SecurityOverview>
      }
      activityContent={<SecurityActivity securityEvents={securityEvents} eventsLoading={eventsLoading} />}
      authContent={
        <div className="space-y-6">
          <section className="border border-gray-300 rounded-md bg-white p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Email Management</h2>
                <p className="text-sm text-gray-600">Primary contact for security alerts.</p>
              </div>
              {!emailVerification.emailEditing ? (
                <button onClick={() => emailVerification.setEmailEditing(true)} className="text-[#0b3578] font-semibold hover:underline text-xs sm:text-sm">Edit Settings</button>
              ) : (
                <button onClick={() => { emailVerification.setEmailEditing(false); emailVerification.setEmailInput(student.email); emailVerification.setOtpSent(false); }} className="text-gray-500 font-semibold hover:underline text-xs sm:text-sm">Cancel</button>
              )}
            </div>

            <div className="max-w-md space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="email" 
                  value={emailVerification.emailInput}
                  onChange={(e) => emailVerification.setEmailInput(e.target.value)}
                  readOnly={!emailVerification.emailEditing}
                  className={`flex-1 border rounded-md px-3 py-2 text-sm focus:ring-1 outline-none transition-colors ${
                    !emailVerification.emailEditing ? 'bg-gray-50 text-gray-500 border-gray-300' : 
                    (emailVerification.emailInput && !emailVerification.isEmailValid ? 'border-red-400 focus:ring-red-400 bg-red-50/10' : 'border-gray-300 focus:ring-[#0b3578] bg-white')
                  }`}
                />
                {emailVerification.emailEditing && !emailVerification.otpSent && (
                  <button 
                    onClick={emailVerification.handleSendOtp}
                    disabled={emailVerification.emailSending || !emailVerification.isEmailValid || emailVerification.emailInput === student.email}
                    className="bg-[#0b3578] text-white px-4 py-2 rounded-md font-medium hover:bg-[#0a2d66] disabled:opacity-50 text-sm"
                  >
                    {emailVerification.emailSending ? '...' : 'Verify'}
                  </button>
                )}
              </div>

              {emailVerification.otpSent && emailVerification.emailEditing && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200 animate-slideDown space-y-3">
                  <label className="block text-[10px] font-bold text-[#0b3578] uppercase tracking-wider">Verification OTP</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      maxLength={6}
                      value={emailVerification.otpInput}
                      onChange={(e) => emailVerification.setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full border border-blue-200 rounded-md px-3 py-2 text-center font-mono tracking-widest outline-none text-sm"
                    />
                    <button 
                      onClick={emailVerification.handleVerifyOtp}
                      disabled={emailVerification.otpVerifying || emailVerification.otpInput.length !== 6}
                      className="bg-[#0b3578] text-white px-6 py-2 rounded-md font-semibold hover:bg-[#0a2d66] disabled:opacity-50 shrink-0 text-sm"
                    >
                      {emailVerification.otpVerifying ? '...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <SecurityAuthentication
            isPasswordSet={isPasswordSet}
            {...passwordMgmt}
            buttonText={isPasswordSet ? 'Update Credentials' : 'Set Secure Password'}
          />
        </div>
      }
    />
  );
}
