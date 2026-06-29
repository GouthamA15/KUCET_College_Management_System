'use client';
import { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Users, Activity, History } from 'lucide-react';

export default function AttendanceHistoryViewer({ assignment, onBack }) {
  const [historyData, setHistoryData] = useState([]);
  const [uniqueSessions, setUniqueSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);

  const toggleSession = (sessionKey) => {
    if (expandedSession === sessionKey) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionKey);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clerk/faculty/attendance/full-history?assignment_id=${assignment.id}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
        
        setHistoryData(data.data.attendance || []);
        setUniqueSessions(data.data.uniqueDates || []);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (assignment?.id) {
      fetchHistory();
    }
  }, [assignment?.id]);

  // Aggregate data for summary cards
  const totalClasses = uniqueSessions.length;
  let totalPresentCount = 0;
  let totalRecords = 0;
  
  historyData.forEach(record => {
    totalRecords++;
    if (record.status === 'PRESENT') totalPresentCount++;
  });
  
  const avgAttendance = totalRecords > 0 ? Math.round((totalPresentCount / totalRecords) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto mt-4 animate-fadeIn pb-24">
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-6 inline-flex items-center gap-2 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Mode Selection
      </button>

      <div className="bg-white border-2 border-gray-200 p-4 rounded-xl mb-6 shadow-sm">
        <div className="flex justify-between items-center border-b-2 border-gray-100 pb-3 mb-4">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" />
            Attendance History
          </h2>
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 uppercase tracking-widest">
            View Only
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Subject</div>
            <div className="font-bold text-gray-900 truncate" title={assignment.subject_name}>{assignment.subject_name}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Code</div>
            <div className="font-bold text-gray-900">{assignment.subject_code}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Branch</div>
            <div className="font-bold text-gray-900">{assignment.branch}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Semester</div>
            <div className="font-bold text-gray-900">{assignment.semester}</div>
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Classes Taken</p>
              <p className="text-2xl font-black text-indigo-700">{totalClasses}</p>
            </div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Present</p>
              <p className="text-2xl font-black text-emerald-700">{totalPresentCount}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Avg Attendance</p>
              <p className="text-2xl font-black text-amber-700">{avgAttendance}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-black text-gray-800 uppercase text-sm tracking-wide">Session Logs</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold text-gray-500">Loading history data...</p>
          </div>
        ) : uniqueSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            No attendance sessions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Present Count</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Total Headcount</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {uniqueSessions.map((session, idx) => {
                  // Calculate stats for this specific session
                  const sessionRecords = historyData.filter(r => r.date === session.date && r.session === session.session);
                  const presentCount = sessionRecords.filter(r => r.status === 'PRESENT').length;
                  const totalCount = sessionRecords.length;
                  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
                  
                  const sessionKey = `${session.date}-${session.session}-${idx}`;
                  const isExpanded = expandedSession === sessionKey;
                  
                  return (
                    <Fragment key={sessionKey}>
                      <tr onClick={() => toggleSession(sessionKey)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {session.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="bg-gray-100 text-gray-800 text-xs font-black px-2.5 py-1 rounded-md uppercase border border-gray-200">
                            S{session.session}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-emerald-600">
                          {presentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-600">
                          {totalCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-8">{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                            <div className="max-h-64 overflow-y-auto pr-2 rounded border border-gray-200 bg-white shadow-inner">
                              <table className="min-w-full divide-y divide-gray-100 text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Roll No</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {sessionRecords.sort((a, b) => (a.roll_no || '').localeCompare(b.roll_no || '')).map(record => (
                                    <tr key={record.student_id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 font-mono font-bold text-gray-700">{record.roll_no}</td>
                                      <td className="px-4 py-2 font-medium text-gray-600">{record.name}</td>
                                      <td className="px-4 py-2 text-center">
                                        {record.status === 'PRESENT' ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                            PRESENT
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                            ABSENT
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
