'use client';
import { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Users, Activity, History, BookOpen, Edit3, Plus } from 'lucide-react';
import LectureTopicModal from './LectureTopicModal';

export default function AttendanceHistoryViewer({ assignment, onBack }) {
  const [historyData, setHistoryData] = useState([]);
  const [uniqueSessions, setUniqueSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [topicModalSession, setTopicModalSession] = useState(null);

  const toggleSession = (sessionKey) => {
    if (expandedSession === sessionKey) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionKey);
    }
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clerk/faculty/attendance/full-history?assignment_id=${assignment.id}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
        
        if (isMounted) {
          setHistoryData(data.data.attendance || []);
          setUniqueSessions(data.data.uniqueDates || []);
        }
      } catch (err) {
        if (isMounted) toast.error(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (assignment?.id) {
      fetchHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [assignment?.id]);

  const handleOpenTopicModal = (session, e) => {
    if (e) e.stopPropagation();
    setTopicModalSession({
      assignmentId: assignment.id,
      date: session.date,
      session: session.session,
      initialTopic: session.topic_covered || ''
    });
  };

  const handleTopicSavedInHistory = (newTopic) => {
    if (!topicModalSession) return;
    setUniqueSessions((prev) =>
      prev.map((s) => {
        if (s.date === topicModalSession.date && s.session === topicModalSession.session) {
          return { ...s, topic_covered: newTopic };
        }
        return s;
      })
    );
  };

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
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-6 inline-flex items-center gap-2 transition-colors cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
        Back to Mode Selection
      </button>

      <div className="bg-white border-2 border-gray-200 p-4 rounded-xl mb-6 shadow-sm">
        <div className="flex justify-between items-center border-b-2 border-gray-100 pb-3 mb-4">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" />
            Attendance History & Teaching Record
          </h2>
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 uppercase tracking-widest">
            View & Manage Topics
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
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Classes Conducted</p>
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
          <h3 className="font-black text-gray-800 uppercase text-sm tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0b3578]" />
            Session Logs & Topics Taught
          </h3>
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
          <>
            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Session</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Topic Covered</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {uniqueSessions.map((session, idx) => {
                    const sessionRecords = historyData.filter(r => r.date === session.date && r.session === session.session);
                    const presentCount = sessionRecords.filter(r => r.status === 'PRESENT').length;
                    const totalCount = sessionRecords.length;
                    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
                    
                    const sessionKey = `${session.date}-${session.session}-${idx}`;
                    const isExpanded = expandedSession === sessionKey;
                    
                    return (
                      <Fragment key={sessionKey}>
                        <tr onClick={() => toggleSession(sessionKey)} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            {session.date}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="bg-gray-100 text-gray-800 text-xs font-black px-2.5 py-1 rounded-md uppercase border border-gray-200">
                              S{session.session}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {session.topic_covered ? (
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-gray-800 line-clamp-2 leading-relaxed" title={session.topic_covered}>
                                  {session.topic_covered}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenTopicModal(session, e)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors shrink-0 cursor-pointer"
                                  title="Edit Topic"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400 italic text-xs font-medium">Not added yet</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenTopicModal(session, e)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition-colors shrink-0 cursor-pointer"
                                  title="Add Topic Covered"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Topic</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-bold text-emerald-600">
                            {presentCount}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-600">
                            {totalCount}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
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
                            <td colSpan="6" className="px-6 py-4 bg-gray-50 border-t border-gray-100">
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
                                          ) : record.status === 'NCC' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                              NCC
                                            </span>
                                          ) : record.status === 'MEDICAL' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                              MEDICAL
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

            {/* Mobile Card Layout */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 bg-gray-50">
              {uniqueSessions.map((session, idx) => {
                const sessionRecords = historyData.filter(r => r.date === session.date && r.session === session.session);
                const presentCount = sessionRecords.filter(r => r.status === 'PRESENT').length;
                const totalCount = sessionRecords.length;
                const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
                
                const sessionKey = `${session.date}-${session.session}-${idx}`;
                const isExpanded = expandedSession === sessionKey;

                return (
                  <div key={sessionKey} className="flex flex-col bg-white">
                    <div onClick={() => toggleSession(sessionKey)} className="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{session.date}</span>
                          <span className="bg-gray-100 text-gray-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-gray-200">
                            Session {session.session}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold">
                          {isExpanded ? '▲ HIDE' : '▼ VIEW'}
                        </div>
                      </div>

                      {/* Mobile Topic Section */}
                      <div className="mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-[#0b3578]" />
                            Topic Covered
                          </span>
                          {session.topic_covered ? (
                            <button
                              type="button"
                              onClick={(e) => handleOpenTopicModal(session, e)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase"
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleOpenTopicModal(session, e)}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-800">
                          {session.topic_covered || <span className="text-slate-400 italic">Not added yet</span>}
                        </p>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Attendance</span>
                          <span className="text-sm font-black text-emerald-600">{presentCount} <span className="text-xs text-gray-400 font-medium">/ {totalCount} students</span></span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-black text-indigo-600">{percentage}%</span>
                          <div className="w-16 bg-gray-200 rounded-full h-1 overflow-hidden">
                            <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100 p-3 shadow-inner">
                        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                          {sessionRecords.sort((a, b) => (a.roll_no || '').localeCompare(b.roll_no || '')).map(record => (
                            <div key={record.student_id} className="bg-white border border-gray-200 rounded p-2 flex justify-between items-center shadow-sm">
                              <div>
                                <div className="text-[10px] font-mono font-bold text-gray-600 leading-none mb-1">{record.roll_no}</div>
                                <div className="text-xs font-semibold text-gray-800 leading-none">{record.name}</div>
                              </div>
                              <div>
                                {record.status === 'PRESENT' ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-700">PRESENT</span>
                                ) : record.status === 'NCC' ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700">NCC</span>
                                ) : record.status === 'MEDICAL' ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700">MEDICAL</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-sm bg-rose-100 text-rose-700">ABSENT</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Topic Edit/Add Modal in History */}
      <LectureTopicModal
        isOpen={Boolean(topicModalSession)}
        assignmentId={topicModalSession?.assignmentId}
        date={topicModalSession?.date}
        session={topicModalSession?.session}
        initialTopic={topicModalSession?.initialTopic || ''}
        onClose={() => setTopicModalSession(null)}
        onTopicSaved={handleTopicSavedInHistory}
      />
    </div>
  );
}
