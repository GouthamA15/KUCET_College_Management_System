'use client';

import { useState } from 'react';
import { useClerk } from '@/context/ClerkContext';
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

export default function ClerkSecurityPage() {
  const { clerkData, loading } = useClerk();
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

  const passwordMgmt = usePasswordManagement({
    role: 'clerk',
    onSuccess: fetchEvents
  });

  if (loading && !clerkData) return <SecurityLoadingState message="Loading Security Center..." />;
  if (!clerkData) return <div className="p-8 text-center text-red-500">Clerk session not found.</div>;

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
        <SecurityAuthentication
          {...passwordMgmt}
          buttonText="Update Staff Password"
          description="Update your staff portal access credentials."
        />
      }
    />
  );
}
