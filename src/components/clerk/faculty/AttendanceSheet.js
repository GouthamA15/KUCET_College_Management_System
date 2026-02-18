'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getNowSync } from '@/lib/clock';

const SubjectIdentityPanel = ({ assignment }) => (
  <div className="bg-white border-2 border-gray-200 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2 mb-4">
      <h2 className="text-xl font-bold text-gray-800">Attendance Register</h2>
      <span className={`text-sm font-bold px-3 py-1 rounded-full ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
        {assignment.is_active ? 'Active' : 'History'}
      </span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
      <div className="font-semibold text-gray-500">Subject:</div>
      <div className="font-mono text-gray-900 col-span-3">{assignment.subject_name}</div>

      <div className="font-semibold text-gray-500">Code:</div>
      <div className="font-mono text-gray-900">{assignment.subject_code}</div>

      <div className="font-semibold text-gray-500">Branch:</div>
      <div className="font-mono text-gray-900">{assignment.branch}</div>

      <div className="font-semibold text-gray-500">Semester:</div>
      <div className="font-mono text-gray-900">{assignment.semester}</div>

      <div className="font-semibold text-gray-500">Academic Year:</div>
      <div className="font-mono text-gray-900">{assignment.academic_year}</div>
    </div>
  </div>
);


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
    
    let newStatus = 'PRESENT';
    if (currentStatus === 'PRESENT') newStatus = 'ABSENT';
    else if (currentStatus === 'ABSENT') newStatus = 'PRESENT';
    
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
      fetchStudents(); 
      setHistoryStudent(null);
    } catch (error) {
      toast.error('Failed to save some changes');
    } finally {
      setSavingHistory(false);
    }
  };

  useEffect(() => {
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
      if (sessionsToSave.length === 0) throw new Error('Please select at least one session');
      
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
      fetchStudents();
      fetchGridData();
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
      fetchStudents();
      fetchGridData();
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
        return prev.filter(n => n < num);
      } else {
        return [...prev, num].sort();
      }
    });
  };

  const getPercentageColor = (pct) => {
    if (pct <= 50) return 'text-red-700 bg-red-100';
    if (pct <= 75) return 'text-orange-700 bg-orange-100';
    return 'text-green-700 bg-green-100';
  };

  if (loading && !uniqueDates.length) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Subject Identity Panel */}
      <SubjectIdentityPanel assignment={assignment} />

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex bg-gray-100 p-1 rounded-lg w-fit border">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Daily View
          </button>
          <button
            onClick={() => setViewMode('excel')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'excel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Excel Mode (Grid)
          </button>
        </div>
      </div>

      {/* Controls and Tables */}
      <div className="bg-white p-4 sm:p-6 rounded-lg border-2">
        {viewMode === 'daily' && (
          <>
            {/* Daily Attendance Controls */}
            <div className="mb-6 pb-4 border-b-2">
              <h3 className="text-lg font-bold text-gray-700 mb-4">Attendance Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Date Selector */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="p-2 border-2 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                    disabled={!assignment.is_active}
                  />
                </div>
                
                {/* Session Selector */}
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Sessions</label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isBulkMode} 
                        onChange={(e) => {
                          setIsBulkMode(e.target.checked);
                          if (e.target.checked) setBulkSessions([selectedSession]);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-600 uppercase">Bulk Mode</span>
                    </label>
                  </div>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border-2">
                    {[1, 2, 3, 4, 5].map(num => {
                      const isExisting = existingSessionsForToday.includes(num);
                      const isSelected = isBulkMode ? bulkSessions.includes(num) : selectedSession === num;
                      const isAvailable = num === 1 || isExisting || existingSessionsForToday.includes(num - 1) || (isBulkMode && bulkSessions.includes(num - 1));
                      return (
                        <button
                          key={num}
                          onClick={() => isBulkMode ? toggleBulkSession(num) : setSelectedSession(num)}
                          disabled={!assignment.is_active || !isAvailable}
                          className={`flex-1 h-10 rounded-md text-xs font-bold transition-all flex items-center justify-center relative ${
                            isSelected ? 'bg-indigo-600 text-white shadow-md scale-105 z-10' :
                            isExisting ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' :
                            isAvailable ? 'bg-white text-gray-600 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={!isAvailable ? `Fill Session ${num-1} first` : (isExisting ? `Recorded Session ${num}` : `New Session ${num}`)}
                        >
                          S{num}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col justify-end">
                  {assignment.is_active ? (
                    <div className="flex space-x-2 justify-end">
                      <button
                        onClick={handleDeleteAttendance}
                        disabled={submitting || (isBulkMode ? bulkSessions.length === 0 : !existingSessionsForToday.includes(selectedSession))}
                        className="bg-white text-red-600 border-2 border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-50 disabled:opacity-50 transition"
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleSaveAttendance}
                        disabled={submitting}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                      >
                        {submitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold text-xs border uppercase tracking-wider text-center">Semester Ended</div>
                  )}
                </div>
              </div>
            </div>

            {/* Daily View Table */}
            <table className="min-w-full divide-y-2 divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance %</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">History</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">{student.roll_no}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPercentageColor(student.attendance_percentage)}`}>
                        {student.attendance_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => assignment.is_active && toggleStatus(student.id)}
                        disabled={!assignment.is_active}
                        className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                          student.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        } ${!assignment.is_active ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {student.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => fetchStudentHistory(student)}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {viewMode === 'excel' && (
          <div>
            {/* Excel Mode Controls */}
            <div className="mb-6 pb-4 border-b-2">
              <h3 className="text-lg font-bold text-gray-700 mb-4">Grid Management</h3>
              <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-4 rounded-xl border-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Add Column Date</label>
                  <input type="date" value={newColDate} onChange={(e) => setNewColDate(e.target.value)} className="p-2 border-2 rounded-lg text-sm bg-white" disabled={!assignment.is_active}/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Session</label>
                  <select value={newColSession} onChange={(e) => setNewColSession(parseInt(e.target.value))} className="p-2 border-2 rounded-lg text-sm bg-white" disabled={!assignment.is_active}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Session {n}</option>)}
                  </select>
                </div>
                <button onClick={handleAddColumn} disabled={!assignment.is_active} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">
                  + Add Column
                </button>
              </div>
            </div>

            {/* Excel Mode Legend */}
            <div className="mb-4 p-2 bg-gray-100 rounded-lg text-xs">
              <span className="font-bold mr-4">Legend:</span>
              <span className="mr-3"><span className="font-mono font-bold text-green-600">P</span> = Present</span>
              <span className="mr-3"><span className="font-mono font-bold text-red-600">A</span> = Absent</span>
              <span className="mr-3"><span className="font-mono font-bold text-gray-400">+</span> = Not Marked</span>
              <span className="mr-3"><span className="font-mono font-bold text-gray-400">×</span> = Locked</span>
            </div>

            {/* Excel/Grid Mode Table */}
            <div className="overflow-x-auto border-2 rounded-lg">
              {loadingGrid ? <div className="text-center py-12">Loading full attendance grid...</div>
              : uniqueDates.length > 0 ? (
                <table className="min-w-full divide-y-2 divide-gray-200 border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-100 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase border-r-2 border-b-2 tracking-wider">
                        Student
                      </th>
                      {uniqueDates.map((col, i) => (
                        <th key={i} className="px-2 py-3 text-center text-[10px] font-bold text-gray-500 uppercase border-b-2 border-r-2 min-w-[120px] relative group">
                          <div className="whitespace-nowrap mb-1">{new Date(col.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</div>
                          <div className="text-indigo-600 mb-2 font-black">SESSION {col.session}</div>
                          {assignment.is_active && (() => {
                            const isBlocked = col.session > 1 && students.some(s => (attendanceMap[`${s.id}-${col.date}-${col.session - 1}`] || 'N/A') === 'N/A');
                            return (
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleBulkColumnUpdate(col.date, col.session, 'PRESENT')} title={isBlocked ? `Complete Session ${col.session - 1} first` : "Mark all Present"} disabled={isBlocked} className={`w-7 h-6 rounded flex items-center justify-center border transition-colors ${ isBlocked ? 'bg-gray-200 text-gray-300' : 'bg-green-100 text-green-600 hover:bg-green-600 hover:text-white' }`}>P</button>
                                <button onClick={() => handleBulkColumnUpdate(col.date, col.session, 'ABSENT')} title={isBlocked ? `Complete Session ${col.session - 1} first` : "Mark all Absent"} disabled={isBlocked} className={`w-7 h-6 rounded flex items-center justify-center border transition-colors ${ isBlocked ? 'bg-gray-200 text-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-600 hover:text-white' }`}>A</button>
                              </div>
                            );
                          })()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y-2 divide-gray-100">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap border-r-2 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="text-sm font-bold text-gray-900">{student.roll_no}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{student.name}</div>
                        </td>
                        {uniqueDates.map((col, i) => {
                          const status = attendanceMap[`${student.id}-${col.date}-${col.session}`] || 'N/A';
                          const isPrevEmpty = col.session > 1 && (attendanceMap[`${student.id}-${col.date}-${col.session - 1}`] || 'N/A') === 'N/A';
                          const isDisabled = !assignment.is_active || isPrevEmpty;
                          return (
                            <td key={i} className="p-0 border-r-2 text-center align-middle">
                              <button
                                onClick={() => handleToggleCell(student.id, col.date, col.session, status)}
                                disabled={isDisabled}
                                className={`w-full h-14 text-sm font-black transition-all ${
                                  status === 'PRESENT' ? 'bg-green-50 text-green-700' : 
                                  status === 'ABSENT' ? 'bg-red-50 text-red-700' : 
                                  isPrevEmpty ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-400 hover:bg-gray-50'
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
              ) : <div className="text-center py-12 text-gray-500">No historical attendance data to display.</div>}
            </div>
          </div>
        )}
      </div>

      {historyStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{historyStudent.name}</h3>
                <p className="text-sm text-gray-500 font-medium">{historyStudent.roll_no} • {assignment.subject_name}</p>
                {!loadingHistory && historyData.length > 0 && (
                  <div className="flex gap-4 mt-3">
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">Present: {historyData.filter(r => r.status === 'PRESENT').length}</div>
                    <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">Absent: {historyData.filter(r => r.status === 'ABSENT').length}</div>
                  </div>
                )}
              </div>
              <button onClick={() => !savingHistory && setHistoryStudent(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? <div className="text-center py-20">Loading history...</div>
              : historyData.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Date</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Session</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {historyData.map((record, i) => {
                      const isModified = record.status !== originalHistoryData[i]?.status;
                      return (
                        <tr key={i} className={`hover:bg-gray-50 ${isModified ? 'bg-amber-50' : ''}`}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-700">{new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-6 py-4 text-center"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-black">S{record.session}</span></td>
                          <td className="px-6 py-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{record.status}</span></td>
                          <td className="px-6 py-4 text-right"><button onClick={() => handleToggleHistory(record)} disabled={!assignment.is_active || savingHistory} className="text-xs font-bold px-3 py-1 rounded border text-gray-600 hover:bg-gray-200">Toggle</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="text-center py-20 text-gray-500">No history found.</div>}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-xs text-gray-400">{historyData.filter((r, i) => r.status !== originalHistoryData[i]?.status).length} changes pending</div>
              <div className="flex gap-3">
                <button onClick={() => setHistoryStudent(null)} disabled={savingHistory} className="px-6 py-2 text-sm font-bold text-gray-600">Cancel</button>
                {assignment.is_active && <button onClick={handleSaveHistory} disabled={savingHistory} className="bg-indigo-600 text-white px-8 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">{savingHistory ? 'Saving...' : 'Save Changes'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
