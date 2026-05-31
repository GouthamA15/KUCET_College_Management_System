import React from 'react';
import { Globe, MapPin } from 'lucide-react';
import { formatTimeAgo, formatIPAddress } from '@/lib/security';

import { SecurityLoadingState } from './SecurityLoadingState';
import { SecurityEmptyState } from './SecurityEmptyState';

export function SecuritySessions({ 
  title = "Active Sessions",
  description = "Devices currently logged into your account.",
  sessions, 
  sessionsLoading, 
  onRevokeSession, 
  onRevokeOtherSessions 
}) {
  return (
    <section className="border border-gray-300 rounded-md bg-white p-4 sm:p-6 animate-fadeIn">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {sessions.length > 1 && (
          <button 
            onClick={onRevokeOtherSessions}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md border border-red-100 transition-colors"
          >
            Logout Other Devices
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sessionsLoading ? (
          <SecurityLoadingState message="Loading active sessions..." />
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <div key={session.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-md ${session.isCurrent ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Globe size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{session.deviceName || 'Unknown Device'}</span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[9px] font-bold uppercase rounded border border-green-100">
                        Current Device
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {session.browser} on {session.os}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                    <MapPin size={10} />
                    {formatIPAddress(session.ip)} • Last active {formatTimeAgo(session.lastSeen)}
                  </div>
                </div>
              </div>
              
              {!session.isCurrent && (
                <button 
                  onClick={() => onRevokeSession(session.id)}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-600 uppercase tracking-wider px-2 py-1 rounded border border-gray-200 hover:border-red-200 transition-all"
                >
                  Logout
                </button>
              )}
            </div>
          ))
        ) : (
          <SecurityEmptyState 
            icon={Globe} 
            message="No active sessions found." 
          />
        )}
      </div>
    </section>
  );
}
