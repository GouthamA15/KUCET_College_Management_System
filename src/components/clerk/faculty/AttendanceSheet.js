'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getNowSync } from '@/lib/clock';

export default function AttendanceSheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getNowSync().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState(1);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSessions, setBulkSessions] = useState([1]);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'excel'
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [originalHistoryData, setOriginalHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  // Excel Mode specific states
  const [allAttendance, setAllAttendance] = useState([]); 
  const [uniqueDates, setUniqueDates] = useState([]); 
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [newColDate, setNewColDate] = useState(getNowSync().toISOString().split('T')[0]);
  const [newColSession, setNewColSession] = useState(1);

  // Get existing sessions for the selected date
  const existingSessionsForToday = uniqueDates
    .filter(d => d.date === selectedDate)
    .map(d => d.session)
    .sort((a, b) => a - b);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/faculty/students?assignment_id=${assignment.id}&session=${selectedSession}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      
      // Initialize student status from data or default to PRESENT
      const studentsWithStatus = data.data.map(s => {
        const total = s.total_classes || 0;
        const attended = s.attended_classes || 0;
        const percentage = total > 0 ? (attended / total) * 100 : 100;
        return {
          ...s,
          status: s.attendance_status || 'PRESENT',
          attendance_percentage: percentage
        };
      });
      setStudents(studentsWithStatus);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentHistory = async (student) => {
    setHistoryStudent(student);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/clerk/faculty/attendance/history?student_id=${student.id}&assignment_id=${assignment.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
      setHistoryData(data.data || []);
      setOriginalHistoryData(JSON.parse(JSON.stringify(data.data || []))); // Deep copy
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchGridData = async () => {
    setLoadingGrid(true);
    try {
      const res = await fetch(`/api/clerk/faculty/attendance/full-history?assignment_id=${assignment.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
      
      setAllAttendance(data.attendance || []);
      // Sort unique dates: ASC (Oldest first)
      const sorted = (data.uniqueDates || []).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.session - b.session;
      });
      setUniqueDates(sorted);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleAddColumn = () => {
    if (!assignment.is_active) return;
    
    const exists = uniqueDates.some(d => d.date === newColDate && d.session === newColSession);
    if (exists) {
      toast.error("Column already exists in the grid");
      return;
    }

    // Sequential Check: Cannot add Session 2 if Session 1 doesn't exist for this date
    if (newColSession > 1) {
      const prevExists = uniqueDates.some(d => d.date === newColDate && d.session === newColSession - 1);
      if (!prevExists) {
        toast.error(`Please add Session ${newColSession - 1} for ${newColDate} first`);
        return;
      }
    }

    const newUniqueDates = [...uniqueDates, { date: newColDate, session: newColSession }].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.session - b.session;
    });
    setUniqueDates(newUniqueDates);
    toast.success(`Added column for ${newColDate} (S${newColSession})`);

    // Set defaults for NEXT add
    if (newColSession < 5) {
      setNewColSession(newColSession + 1);
    } else {
      const nextDate = new Date(newColDate);
      nextDate.setDate(nextDate.getDate() + 1);
      setNewColDate(nextDate.toISOString().split('T')[0]);
      setNewColSession(1);
    }
  };

  const handleBulkColumnUpdate = async (dateStr, session, status) => {
    if (!assignment.is_active || submitting) return;
    
    // Sequential Check: Can we mark this entire column?
    if (session > 1) {
      const prevSessionKey = (studentId) => `${studentId}-${dateStr}-${session - 1}`;
      const anyPrevEmpty = students.some(s => (attendanceMap[prevSessionKey(s.id)] || 'N/A') === 'N/A');
      
      if (anyPrevEmpty) {
        toast.error(`Cannot bulk update Session ${session} because some students have no records for Session ${session - 1}`);
        return;
      }
    }

    const confirmed = confirm(`Mark all students as ${status} for ${dateStr} Session ${session}?`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: dateStr,
          session: session,
          attendance_data: students.map(s => ({ student_id: s.id, status }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk update failed');
      toast.success(`Updated all to ${status}`);
      fetchGridData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Optimization: Create a lookup map for the grid
  const attendanceMap = allAttendance.reduce((acc, curr) => {
    const key = `${curr.student_id}-${curr.date}-${curr.session}`;
    acc[key] = curr.status;
    return acc;
  }, {});

  const handleToggleCell = async (studentId, dateStr, session, currentStatus) => {
    if (!assignment.is_active) return;
    
    // Cycle: N/A (+) -> PRESENT (P) -> ABSENT (A) -> PRESENT (P)
    let newStatus = 'PRESENT';
    if (currentStatus === 'PRESENT') newStatus = 'ABSENT';
    else if (currentStatus === 'ABSENT') newStatus = 'PRESENT';
    // If currentStatus is 'N/A', it will default to 'PRESENT'
    
    // Optimistic local update
    const newRecord = { student_id: studentId, date: dateStr, session: session, status: newStatus };
    setAllAttendance(prev => {
      const filtered = prev.filter(a => !(a.student_id === studentId && a.date === dateStr && a.session === session));
      return [...filtered, newRecord];
    });

    try {
      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: dateStr,
          session: session,
          attendance_data: [{ student_id: studentId, status: newStatus }]
        })
      });
      if (!res.ok) throw new Error('Update failed');
      // If this was a new session, refresh grid data to update existingSessionsForToday
      if (!uniqueDates.some(d => d.date === dateStr && d.session === session)) {
        fetchGridData();
      }
    } catch (error) {
      toast.error('Update failed');
      fetchGridData(); 
    }
  };

  const handleToggleHistory = (record) => {
    if (!assignment.is_active) return;
    const newStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    setHistoryData(historyData.map(r => 
      (r.date === record.date && r.session === record.session) ? { ...r, status: newStatus } : r
    ));
  };

  const handleSaveHistory = async () => {
    const changes = historyData.filter((record, index) => {
      const original = originalHistoryData[index];
      return original && record.status !== original.status;
    });

    if (changes.length === 0) {
      setHistoryStudent(null);
      return;
    }

    setSavingHistory(true);
    try {
      // Execute saves sequentially or in parallel
      const savePromises = changes.map(change => 
        fetch('/api/clerk/faculty/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            date: new Date(change.date).toISOString().split('T')[0],
            session: change.session,
            attendance_data: [{ student_id: historyStudent.id, status: change.status }]
          })
        })
      );

      await Promise.all(savePromises);
      toast.success(`Updated ${changes.length} records`);
      fetchStudents(); // Refresh percentages
      setHistoryStudent(null);
    } catch (error) {
      toast.error('Failed to save some changes');
    } finally {
      setSavingHistory(false);
    }
  };

  useEffect(() => {
    // Always fetch grid data to know existing sessions
    fetchGridData();
  }, [assignment.id]);

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchStudents();
    }
  }, [assignment.id, selectedSession, selectedDate, viewMode]);

  const toggleStatus = (studentId) => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, status: s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT' } : s
    ));
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    try {
      const sessionsToSave = isBulkMode ? bulkSessions : [selectedSession];
      
      if (sessionsToSave.length === 0) {
        throw new Error('Please select at least one session');
      }

      // Execute saves in parallel
      const savePromises = sessionsToSave.map(sessionNum => 
        fetch('/api/clerk/faculty/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            date: selectedDate,
            session: sessionNum,
            attendance_data: students.map(s => ({ student_id: s.id, status: s.status }))
          })
        }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      );

      const results = await Promise.all(savePromises);
      const firstError = results.find(r => !r.ok);
      if (firstError) throw new Error(firstError.data.error || 'Failed to save attendance');

      toast.success(isBulkMode ? `Attendance saved for ${sessionsToSave.length} sessions` : 'Attendance saved successfully');
      fetchStudents(); // Refresh to update percentages
      fetchGridData(); // Update existing sessions
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async () => {
    const sessionsToDelete = isBulkMode ? bulkSessions : [selectedSession];
    if (sessionsToDelete.length === 0) return toast.error('No sessions selected');

    if (!confirm(`Are you sure you want to delete attendance for ${isBulkMode ? `${sessionsToDelete.length} sessions` : `Session ${selectedSession}`} on ${selectedDate}?`)) return;
    
    setSubmitting(true);
    try {
      const deletePromises = sessionsToDelete.map(sessionNum => 
        fetch(`/api/clerk/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}&session=${sessionNum}`, {
          method: 'DELETE'
        }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      );

      const results = await Promise.all(deletePromises);
      const firstError = results.find(r => !r.ok);
      if (firstError) throw new Error(firstError.data.error || 'Failed to delete attendance');

      toast.success('Attendance deleted successfully');
      fetchStudents(); // Refresh to update percentages
      fetchGridData(); // Update existing sessions
      if (!isBulkMode) setSelectedSession(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBulkSession = (num) => {
    setBulkSessions(prev => {
      if (prev.includes(num)) {
        // Removing: also remove all sessions AFTER this one to maintain sequence
        return prev.filter(n => n < num);
      } else {
        // Adding: handled by the 'isAvailable' logic in the button disabled prop
        return [...prev, num].sort();
      }
    });
  };

  const getPercentageColor = (pct) => {
    if (pct <= 50) return 'text-red-600 bg-red-50 border-red-200';
    if (pct <= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (loading && !uniqueDates.length) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      {/* History Modal Overlay */}
      {historyStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{historyStudent.name}</h3>
                <p className="text-sm text-gray-500 font-medium">{historyStudent.roll_no} • {assignment.subject_name}</p>
                
                {/* Stats Summary */}
                {!loadingHistory && historyData.length > 0 && (
                  <div className="flex gap-4 mt-3">
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                      Present: {historyData.filter(r => r.status === 'PRESENT').length}
                    </div>
                    <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                      Absent: {historyData.filter(r => r.status === 'ABSENT').length}
                    </div>
                    <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">
                      Total: {historyData.length}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => !savingHistory && setHistoryStudent(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-0">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading history records...</p>
                </div>
              ) : historyData.length > 0 ? (
                <div className="min-w-full">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Session</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {historyData.map((record, i) => {
                        const isModified = record.status !== originalHistoryData[i]?.status;
                        return (
                          <tr key={i} className={`group hover:bg-gray-50 transition-colors ${isModified ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                              {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">S{record.session}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                                record.status === 'PRESENT' 
                                  ? 'bg-green-100 text-green-800 border-green-200' 
                                  : 'bg-red-100 text-red-800 border-red-200'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button 
                                onClick={() => handleToggleHistory(record)}
                                disabled={!assignment.is_active || savingHistory}
                                className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all ${
                                  assignment.is_active 
                                    ? 'border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm hover:border-indigo-300 hover:text-indigo-600 active:scale-95' 
                                    : 'opacity-0 cursor-default'
                                }`}
                              >
                                Toggle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                  </div>
                  <p className="text-gray-500 font-medium">No attendance history found.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-xs text-gray-400 font-medium">
                {historyData.filter((r, i) => r.status !== originalHistoryData[i]?.status).length} changes pending
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setHistoryStudent(null)}
                  disabled={savingHistory}
                  className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {assignment.is_active && (
                  <button 
                    onClick={handleSaveHistory}
                    disabled={savingHistory || historyData.length === 0}
                    className="bg-indigo-600 text-white px-8 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2"
                  >
                    {savingHistory ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 block">
            &larr; Back to Subjects
          </button>
          <h2 className="text-xl font-bold">{assignment.subject_name} - Attendance</h2>
          <p className="text-sm text-gray-500">{assignment.branch} | Sem {assignment.semester}</p>
          <div className="mt-3 flex bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${viewMode === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Daily View
            </button>
            <button
              onClick={() => setViewMode('excel')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${viewMode === 'excel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Excel Mode (Grid)
            </button>
          </div>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-xl border">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 border rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={!assignment.is_active}
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase">Sessions Today</label>
                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={isBulkMode} 
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsBulkMode(checked);
                      if (checked) {
                        // Reset bulkSessions to current single selection when entering bulk mode
                        setBulkSessions([selectedSession]);
                      }
                    }}
                    className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-600 uppercase tracking-tighter transition-colors">Multiple</span>
                </label>
              </div>
              <div className="flex gap-1.5 bg-white p-1 rounded-lg border shadow-sm">
                {[1, 2, 3, 4, 5].map(num => {
                  const isExisting = existingSessionsForToday.includes(num);
                  const isSelected = isBulkMode ? bulkSessions.includes(num) : selectedSession === num;
                  
                  // Session is available if:
                  // 1. It's the first session
                  // 2. It already has data (existing)
                  // 3. The previous session has data
                  // 4. In bulk mode, the previous session is currently selected
                  const isAvailable = num === 1 || 
                                     isExisting || 
                                     existingSessionsForToday.includes(num - 1) ||
                                     (isBulkMode && bulkSessions.includes(num - 1));

                  return (
                    <button
                      key={num}
                      onClick={() => isBulkMode ? toggleBulkSession(num) : setSelectedSession(num)}
                      disabled={!assignment.is_active || !isAvailable}
                      className={`w-10 h-8 rounded-md text-xs font-bold transition-all flex items-center justify-center relative ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-md scale-110 z-10' 
                          : isExisting
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : isAvailable
                              ? 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                      }`}
                      title={!isAvailable ? `Fill Session ${num-1} first` : (isExisting ? `Recorded Session ${num}` : `New Session ${num}`)}
                    >
                      {isExisting && !isSelected && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
                      )}
                      {isBulkMode && isSelected && (
                        <span className="absolute -top-1 -right-1">
                          <svg className="w-3 h-3 text-white fill-indigo-600" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        </span>
                      )}
                      {isExisting ? `S${num}` : num}
                    </button>
                  );
                })}
              </div>
            </div>

            {assignment.is_active ? (
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteAttendance}
                  disabled={submitting || (isBulkMode ? bulkSessions.length === 0 : !existingSessionsForToday.includes(selectedSession))}
                  className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-50 disabled:opacity-30 transition shadow-sm"
                >
                  Delete
                </button>
                <button
                  onClick={handleSaveAttendance}
                  disabled={submitting}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            ) : (
              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold text-xs border uppercase tracking-wider">
                Semester Ended
              </div>
            )}
          </div>
        ) : (
          /* Excel Mode Add Column UI */
          <div className="flex flex-wrap items-end gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1.5 tracking-widest">Add Column Date</label>
              <input
                type="date"
                value={newColDate}
                onChange={(e) => setNewColDate(e.target.value)}
                className="p-2 border rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={!assignment.is_active}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1.5 tracking-widest">Session</label>
              <select
                value={newColSession}
                onChange={(e) => setNewColSession(parseInt(e.target.value))}
                className="p-2 border rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={!assignment.is_active}
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Session {n}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddColumn}
              disabled={!assignment.is_active}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              + Add Column
            </button>
            <div className="ml-auto text-[10px] font-medium text-gray-400 italic max-w-[150px] leading-tight text-right">
              Added columns appear in the grid. Toggle cells to save.
            </div>
          </div>
        )}
      </div>

      <div className={`overflow-x-auto border rounded-lg ${!assignment.is_active ? 'bg-gray-50 opacity-90' : ''}`}>
        {viewMode === 'daily' ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Percentage</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">History</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.roll_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getPercentageColor(student.attendance_percentage)}`}>
                      {student.attendance_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => assignment.is_active && toggleStatus(student.id)}
                      disabled={!assignment.is_active}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                        student.status === 'PRESENT' 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      } ${!assignment.is_active ? 'cursor-default grayscale-[0.5]' : 'cursor-pointer'}`}
                    >
                      {student.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => fetchStudentHistory(student)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Excel/Grid Mode */
          <div className="min-w-full inline-block align-middle">
            {loadingGrid ? (
              <div className="text-center py-12">Loading full attendance grid...</div>
            ) : uniqueDates.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase border-r border-b">
                      Students / Dates
                    </th>
                    {uniqueDates.map((col, i) => (
                      <th key={i} className="px-2 py-3 text-center text-[10px] font-bold text-gray-500 uppercase border-b border-r min-w-[100px] relative group">
                        <div className="whitespace-nowrap mb-1">{new Date(col.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</div>
                        <div className="text-indigo-600 mb-2">Session {col.session}</div>
                        
                        {/* Column Actions */}
                        {assignment.is_active && (
                          <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Sequential Logic Check for the Header Button Visibility */}
                            {(() => {
                              const isBlocked = col.session > 1 && students.some(s => (attendanceMap[`${s.id}-${col.date}-${col.session - 1}`] || 'N/A') === 'N/A');
                              return (
                                <>
                                  <button 
                                    onClick={() => handleBulkColumnUpdate(col.date, col.session, 'PRESENT')}
                                    title={isBlocked ? `Complete Session ${col.session - 1} first` : "Mark all Present"}
                                    disabled={isBlocked}
                                    className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                                      isBlocked ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border-green-200'
                                    }`}
                                  >P</button>
                                  <button 
                                    onClick={() => handleBulkColumnUpdate(col.date, col.session, 'ABSENT')}
                                    title={isBlocked ? `Complete Session ${col.session - 1} first` : "Mark all Absent"}
                                    disabled={isBlocked}
                                    className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                                      isBlocked ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-red-200'
                                    }`}
                                  >A</button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="text-xs font-bold text-gray-900">{student.roll_no}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{student.name}</div>
                      </td>
                      {uniqueDates.map((col, i) => {
                        const status = attendanceMap[`${student.id}-${col.date}-${col.session}`] || 'N/A';
                        
                        // Sequential Logic: Is the previous session for THIS STUDENT empty?
                        const isPrevEmpty = col.session > 1 && (attendanceMap[`${student.id}-${col.date}-${col.session - 1}`] || 'N/A') === 'N/A';
                        const isDisabled = !assignment.is_active || isPrevEmpty;

                        return (
                          <td 
                            key={i} 
                            className="p-0 border-r border-b text-center align-middle"
                          >
                            <button
                              onClick={() => handleToggleCell(student.id, col.date, col.session, status)}
                              disabled={isDisabled}
                              className={`w-full h-12 text-[10px] font-black transition-all ${
                                status === 'PRESENT' ? 'bg-green-100 text-green-800' : 
                                status === 'ABSENT' ? 'bg-red-100 text-red-800' : 
                                isPrevEmpty ? 'bg-gray-50 text-gray-200 cursor-not-allowed' :
                                'bg-gray-50 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                              } ${!isDisabled ? 'cursor-pointer' : ''}`}
                              title={isPrevEmpty ? `Fill Session ${col.session - 1} first` : ''}
                            >
                              {status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : isPrevEmpty ? '×' : '+'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-gray-500">No historical attendance data found to display in grid.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
