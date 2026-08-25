'use client';

import { useState } from 'react';
import { useStaff } from '@/context/StaffContext';
import { formatInstitutionalDate, formatInstitutionalDateTime } from '@/lib/date';
import { formatIPAddress } from '@/lib/security';
import { 
  useSecurityEvents, 
  useSecuritySessions, 
  useSecurityNotifications, 
  usePasswordManagement
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

export default function StaffSecurityPage() {
  const { staffData, loading } = useStaff();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { securityEvents, eventsLoading, fetchEvents } = useSecurityEvents(staffData?.id);
  const { sessions, sessionsLoading, handleRevokeSession, handleRevokeOtherSessions } = useSecuritySessions(activeTab);
  const { 
    notifications, 
    notifsLoading, 
    unreadCount, 
    handleMarkAsRead, 
    handleMarkAllAsRead 
  } = useSecurityNotifications();



  const passwordMgmt = usePasswordManagement({
    role: 'staff',
    onSuccess: fetchEvents
  });

  if (loading && !staffData) return <SecurityLoadingState message="Loading Security Center..." />;
  if (!staffData) return <div className="p-4 sm:p-8 text-center text-red-500">Staff session not found.</div>;

  return (
    <SecurityCenter
      title="Security Center"
      description={`Staff security portal for ${staffData.name}`}
      headerBadge={
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-tight">
          {staffData.role}
        </span>
      }
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      unreadCount={unreadCount}
      overviewContent={
        <SecurityOverview title="Staff Account Status" description="Overview of your institutional credentials and activity.">
          <SecurityStatusItem 
            label="Staff Identity" 
            value={staffData.email} 
            subValue={
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-indigo-600 uppercase">{staffData.role}</span>
                <span className="text-gray-400">|</span>
                <span>Institutional Role</span>
              </div>
            }
            ok={staffData.is_active}
            okLabel={staffData.is_active ? "Active" : "Inactive"}
          />
          <SecurityStatusItem 
            label="Password Security" 
            value="Enterprise Protected" 
            subValue={staffData.password_changed_at ? `Last changed ${formatInstitutionalDate(staffData.password_changed_at)}` : "Standard Security Policy"}
            ok={true}
          />
          <SecurityStatusItem 
            label="Last System Access" 
            value={staffData.last_login_at ? formatInstitutionalDateTime(staffData.last_login_at) : 'Never logged in'} 
            subValue={staffData.last_login_ip ? formatIPAddress(staffData.last_login_ip) : "No IP record"}
            ok={!!staffData.last_login_at}
          />
          <SecurityStatusItem 
            label="Staff Record Created" 
            value={formatInstitutionalDate(staffData.created_at)} 
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
          <section className="border border-gray-300 rounded-md bg-white p-4 sm:p-6">
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
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="email" 
                    value={staffData.email}
                    readOnly={true}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
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
