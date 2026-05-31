import React from 'react';
import { Bell, Clock, Eye, Shield } from 'lucide-react';
import { formatInstitutionalDateTime } from '@/lib/date';

import { SecurityLoadingState } from './SecurityLoadingState';
import { SecurityEmptyState } from './SecurityEmptyState';

export function SecurityAlerts({ 
  title = "Security Alerts", 
  description = "Important notifications regarding your account security.",
  notifications, 
  notifsLoading, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead 
}) {
  return (
    <section className="border border-gray-300 rounded-md bg-white p-4 sm:p-6 animate-fadeIn">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={onMarkAllAsRead}
            className="text-xs font-bold text-[#0b3578] hover:text-[#0a2d66] bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifsLoading && notifications.length === 0 ? (
          <SecurityLoadingState message="Loading alerts..." />
        ) : notifications.length > 0 ? (
          notifications.map((notif) => (
            <div key={notif.id} className={`flex items-start justify-between p-4 border rounded-lg transition-colors ${notif.is_read ? 'bg-white border-gray-100' : 'bg-blue-50/30 border-blue-100 shadow-sm'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-md ${
                  notif.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' : 
                  notif.severity === 'WARNING' ? 'bg-amber-50 text-amber-600' : 
                  'bg-blue-50 text-blue-600'
                }`}>
                  <Bell size={18} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</span>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-2xl">{notif.message}</p>
                  <div className="text-[10px] text-gray-400 pt-1 flex items-center gap-1.5">
                    <Clock size={10} />
                    {formatInstitutionalDateTime(notif.created_at)}
                  </div>
                </div>
              </div>
              {!notif.is_read && (
                <button 
                  onClick={() => onMarkAsRead(notif.id)}
                  className="text-gray-400 hover:text-[#0b3578] p-1 rounded-md hover:bg-blue-50 transition-colors"
                  title="Mark as read"
                >
                  <Eye size={16} />
                </button>
              )}
            </div>
          ))
        ) : (
          <SecurityEmptyState 
            icon={Shield} 
            message="You're all caught up! No security alerts to show." 
          />
        )}
      </div>
    </section>
  );
}
