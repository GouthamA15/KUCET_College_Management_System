import React from 'react';
import { Clock } from 'lucide-react';
import { formatInstitutionalDateTime } from '@/lib/date';
import { formatEventName, formatIPAddress } from '@/lib/security';
import { SecurityEventIcon } from './SecurityEventIcon';

import { SecurityLoadingState } from './SecurityLoadingState';
import { SecurityEmptyState } from './SecurityEmptyState';
import { History } from 'lucide-react';

export function SecurityActivity({ securityEvents, eventsLoading }) {
  return (
    <section className="border border-gray-400 rounded-md bg-white p-4 sm:p-6 animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800">Recent Security Activity</h2>
        <p className="text-sm text-gray-600">Timeline of authentication events and account changes.</p>
      </div>

      <div className="relative pl-4 sm:pl-6 border-l-2 border-gray-200 space-y-8 py-2">
        {eventsLoading ? (
          <SecurityLoadingState message="Loading activity..." />
        ) : securityEvents.length > 0 ? (
          securityEvents.map((event) => (
            <div key={event.id} className="relative">
              <div className="absolute -left-[25px] sm:-left-[33px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{formatEventName(event.event_type)}</span>
                    {event.ip_address && (
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                        {formatIPAddress(event.ip_address)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-400" />
                    {formatInstitutionalDateTime(event.created_at)}
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-2">
                  <div className="p-1.5 bg-gray-50 text-gray-400 rounded-md">
                    <SecurityEventIcon type={event.event_type} />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <SecurityEmptyState 
            icon={History} 
            message="No security events found." 
          />
        )}
      </div>
    </section>
  );
}
