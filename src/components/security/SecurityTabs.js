import React from 'react';

export function SecurityTabs({ activeTab, setActiveTab, unreadCount, userType = 'clerk' }) {
  const isStudent = userType.toLowerCase() === 'student';
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <button onClick={() => setActiveTab('overview')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'overview' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>Overview</button>
      {!isStudent && (
        <button onClick={() => setActiveTab('alerts')} className={`relative px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'alerts' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>
          Alerts
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>
      )}
      <button onClick={() => setActiveTab('activity')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'activity' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>Activity</button>
      {!isStudent && (
        <button onClick={() => setActiveTab('sessions')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'sessions' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>Sessions</button>
      )}
      <button onClick={() => setActiveTab('auth')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'auth' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>Authentication</button>
    </div>
  );
}
