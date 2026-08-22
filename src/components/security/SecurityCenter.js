import React from 'react';
import { SecurityTabs } from './SecurityTabs';

export function SecurityCenter({
  title = "Security Center",
  description = "Monitor your account security and authentication activity.",
  headerBadge,
  activeTab,
  setActiveTab,
  unreadCount,
  overviewContent,
  alertsContent,
  activityContent,
  sessionsContent,
  authContent,
  userType = 'staff'
}) {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-12 px-4 sm:px-0 md:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
          {description}
          {headerBadge}
        </p>
      </header>

      <SecurityTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        unreadCount={unreadCount} 
        userType={userType}
      />

      {activeTab === 'overview' && overviewContent}
      {activeTab === 'alerts' && alertsContent}
      {activeTab === 'activity' && activityContent}
      {activeTab === 'sessions' && sessionsContent}
      {activeTab === 'auth' && authContent}
    </div>
  );
}
