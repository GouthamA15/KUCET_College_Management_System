'use client';

import { useState } from 'react';
import { useStaff } from '@/context/StaffContext';
import { formatInstitutionalDate, formatInstitutionalDateTime } from '@/lib/date';
import { formatIPAddress } from '@/lib/security';
import { 
  useSecurityEvents, 
  useSecuritySessions, 
  useSecurityNotifications, 
  usePasswordManagement,
  useEmailVerification
} from '@/hooks/security';
import {
  SecurityCenter,
  SecurityOverview,
  SecurityAlerts,
  SecurityActivity,
  SecuritySessions,
  SecurityAuthentication,
  SecurityStatusItem,
  SecurityLoadingState
} from '@/components/security';

export default function ClerkSecurityPage() {
  const { clerkData, loading, refreshClerkData } = useStaff();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { securityEvents, eventsLoading, fetchEvents } = useSecurityEvents(clerkData?.id);
  const { sessions, sessionsLoading, handleRevokeSession, handleRevokeOtherSessions } = useSecuritySessions(activeTab);
  const { 
    notifications, 
    notifsLoading, 
    unreadCount, 
    handleMarkAsRead, 
    handleMarkAllAsRead 
  } = useSecurityNotifications();

  const emailVerification = useEmailVerification(
    clerkData?.id, 
    clerkData?.email, 
    async () => {
      if (refreshClerkData) await refreshClerkData();
      fetchEvents();
    }, 
    'staff'
  );

  const passwordMgmt = usePasswordManagement({
    role: 'staff',
    onSuccess: fetchEvents
  });

  if (loading && !clerkData) return <SecurityLoadingState message="Loading Security Center..." />;
  if (!clerkData) return <div className="p-4 sm:p-8 text-center text-red-500">Staff session not found.</div>;

  return (
    <SecurityCenter
      title="Security Center"
      description={`Staff security portal for ${clerkData.name}`}
      headerBadge={
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-tight">
          {clerkData.role}
        </span>
      }
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      unreadCount={unreadCount}
      overviewContent={
        <SecurityOverview title="Staff Account Status" description="Overview of your institutional credentials and activity.">
          <SecurityStatusItem 
            label="Staff Identity" 
            value={clerkData.email} 
            subValue={
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-indigo-600 uppercase">{clerkData.role}</span>
                <span className="text-gray-400">|</span>
                <span>Institutional Role</span>
              </div>
            }
            ok={clerkData.is_active}
            okLabel={clerkData.is_active ? "Active" : "Inactive"}
          />
          <SecurityStatusItem 
            label="Password Security" 
            value="Enterprise Protected" 
            subValue={clerkData.password_changed_at ? `Last changed ${formatInstitutionalDate(clerkData.password_changed_at)}` : "Standard Security Policy"}
            ok={true}
          />
          <SecurityStatusItem 
            label="Last System Access" 
            value={clerkData.last_login_at ? formatInstitutionalDateTime(clerkData.last_login_at) : 'Never logged in'} 
            subValue={clerkData.last_login_ip ? formatIPAddress(clerkData.last_login_ip) : "No IP record"}
            ok={!!clerkData.last_login_at}
          />
          <SecurityStatusItem 
            label="Staff Record Created" 
            value={formatInstitutionalDate(clerkData.created_at)} 
            subValue="Official Institutional Record"
            ok={true}
          />
        </SecurityOverview>
      }
      alertsContent={
        <SecurityAlerts
          description="Important notifications regarding your staff account security."
          notifications={notifications}
          notifsLoading={notifsLoading}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />
      }
      activityContent={<SecurityActivity securityEvents={securityEvents} eventsLoading={eventsLoading} />}
      sessionsContent={
        <SecuritySessions
          title="Active Staff Sessions"
          description="Devices currently logged into your staff account."
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          onRevokeSession={handleRevokeSession}
          onRevokeOtherSessions={() => handleRevokeOtherSessions(fetchEvents)}
        />
      }
      authContent={
        <div className="space-y-6">
          <section className="border border-gray-400 rounded-md bg-white p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Contact Management</h2>
                <p className="text-sm text-gray-600">Primary email for security alerts and login.</p>
              </div>
            </div>

            <div className="max-w-md space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
                  {!emailVerification.emailEditing ? (
                    <button onClick={() => emailVerification.setEmailEditing(true)} className="text-[#0b3578] font-semibold hover:underline text-xs">Edit Email</button>
                  ) : (
                    <button onClick={() => { emailVerification.setEmailEditing(false); emailVerification.setEmailInput(clerkData.email); emailVerification.setOtpSent(false); }} className="text-gray-500 font-semibold hover:underline text-xs">Cancel</button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="email" 
                    value={emailVerification.emailInput}
                    onChange={(e) => emailVerification.setEmailInput(e.target.value)}
                    readOnly={!emailVerification.emailEditing}
                    className={`flex-1 border rounded-md px-3 py-2 text-sm focus:ring-1 outline-none transition-colors ${
                      !emailVerification.emailEditing ? 'bg-gray-50 text-gray-500 border-gray-600' : 
                      (emailVerification.emailInput && !emailVerification.isEmailValid ? 'border-red-400 focus:ring-red-400 bg-red-50/10' : 'border-gray-600 focus:ring-[#0b3578] bg-white text-gray-900')
                    }`}
                  />
                  {emailVerification.emailEditing && !emailVerification.otpSent && (
                    <button 
                      onClick={emailVerification.handleSendOtp}
                      disabled={emailVerification.emailSending || !emailVerification.isEmailValid || emailVerification.emailInput === clerkData.email}
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
                        className="w-full border border-blue-600 rounded-md px-3 py-2 text-center font-mono tracking-widest outline-none text-sm text-gray-900"
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
            </div>
          </section>

          <SecurityAuthentication
            {...passwordMgmt}
            buttonText="Update Staff Password"
            description="Update your staff portal access credentials."
          />
        </div>
      }
    />
  );
}
