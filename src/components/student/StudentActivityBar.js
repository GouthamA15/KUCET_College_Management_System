'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import RealtimeListener from '@/components/RealtimeListener';
import { useStudent } from '@/context/StudentContext';
import AttendanceVerificationActivity from './AttendanceVerificationActivity';

export default function StudentActivityBar() {
  const pathname = usePathname();
  const { studentData, academicPerformance, loading: studentLoading } = useStudent();
  const [activeActivity, setActiveActivity] = useState(null);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchedPeriodRef = useRef(null);
  const isUnmountedRef = useRef(false);

  const fetchActivity = useCallback(async () => {
    if (isUnmountedRef.current || studentLoading || !studentData) return;
    try {
      const res = await fetch('/api/student/current-activity');
      if (res.status === 401 || res.status === 403) return;
      
      const data = await res.json();
      if (isUnmountedRef.current) return;

      if (res.ok && data.active) {
        setActiveActivity(data);
        lastFetchedPeriodRef.current = data.period;
      } else {
        setActiveActivity(null);
        lastFetchedPeriodRef.current = null;
      }
    } catch (e) {
      // Silent in production or if it's a transient network error during reload
    } finally {
      if (!isUnmountedRef.current) setLoading(false);
    }
  }, [studentLoading, studentData]);

  const fetchAttendanceSessions = useCallback(async () => {
    if (isUnmountedRef.current || studentLoading || !studentData || !academicPerformance?.length) return;
    
    try {
      const assignmentIds = academicPerformance.map(s => s.assignment_id).filter(Boolean);
      if (!assignmentIds.length) return;

      const res = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds.join(',')}`);
      if (res.status === 401 || res.status === 403) return;

      const json = await res.json();
      
      if (res.ok && !isUnmountedRef.current) {
        setAttendanceSessions(json.data || []);
      }
    } catch (e) {
      // Silent
    }
  }, [academicPerformance, studentLoading, studentData]);

  useEffect(() => {
    isUnmountedRef.current = false;
    const id = setTimeout(() => {
      fetchActivity();
      fetchAttendanceSessions();
    }, 0);
    
    // Check for period transitions every 30 seconds
    const interval = setInterval(() => {
      const now = new Date();
      const time = now.getHours() * 100 + now.getMinutes();
      const transitionTimes = [930, 1020, 1110, 1120, 1210, 1300, 1400, 1450, 1540, 1630];
      
      const isTransitionWindow = transitionTimes.some(t => {
        const diff = time - t;
        return diff >= 0 && diff <= 1;
      });

      if (isTransitionWindow) {
        fetchActivity();
      }
    }, 30000); 

    const backupInterval = setInterval(() => {
        fetchActivity();
        fetchAttendanceSessions();
    }, 5 * 60 * 1000); // More frequent refresh for sessions
    
    return () => {
      isUnmountedRef.current = true;
      clearTimeout(id);
      clearInterval(interval);
      clearInterval(backupInterval);
    };
  }, [fetchActivity, fetchAttendanceSessions]);

  const handleRealtimeUpdate = useCallback((data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      fetchActivity();
    } else if (data.type === 'SESSION_STARTED' || data.type === 'SESSION_ENDED') {
      fetchAttendanceSessions();
    }
  }, [fetchActivity, fetchAttendanceSessions]);

  useEffect(() => {
    const channel = new BroadcastChannel('kucet_sse_sync');
    channel.onmessage = (event) => {
      if (event.data) handleRealtimeUpdate(event.data);
    };
    return () => channel.close();
  }, [handleRealtimeUpdate]);

  const handleSessionVerified = (assignmentId) => {
    setAttendanceSessions(prev => prev.filter(s => s.assignment_id !== assignmentId));
  };

  const hasAttendance = attendanceSessions.length > 0;
  const isProfilePage = pathname === '/student/profile';
  const showBar = activeActivity || (hasAttendance && !isProfilePage);

  const activity = activeActivity;
  const period = activeActivity?.period;

  return (
    <div className="space-y-0 animate-in slide-in-from-top duration-500 shadow-md">
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      
      {/* 1. Main Activity Bar (Ongoing Lecture) */}
      {activeActivity && (
        <div className="bg-[#0b3578] border-b border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
          
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-full border border-white/20">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                 </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider">Ongoing Lecture</span>
                   <span className="text-[9px] font-medium text-white/40 uppercase">Period {period}</span>
                </div>
                <h3 className="text-white font-bold tracking-tight leading-none uppercase text-sm">
                  {activity.subject_name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-5">
               <div className="text-right border-r border-white/10 pr-5">
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-wider">Location</p>
                  <p className="text-white font-bold text-xs uppercase">{activity.room_no || 'TBD'}</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-wider">Faculty</p>
                  <p className="text-white font-bold text-[11px] uppercase truncate max-w-[120px]">{activity.faculty_name || 'Unassigned'}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Secure Attendance Extension (Hidden on Profile Page to avoid duplication) */}
      {hasAttendance && !isProfilePage && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto">
             <AttendanceVerificationActivity 
               sessions={attendanceSessions} 
               onSessionVerified={handleSessionVerified} 
             />
          </div>
        </div>
      )}
    </div>
  );
}
