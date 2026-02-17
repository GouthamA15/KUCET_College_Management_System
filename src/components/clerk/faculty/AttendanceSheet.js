'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AttendanceSheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/faculty/students?assignment_id=${assignment.id}`);
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
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleHistory = async (record) => {
    if (!assignment.is_active) return;

    const newStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    const originalStatus = record.status;

    // Optimistic update in history modal
    setHistoryData(historyData.map(r => r.date === record.date ? { ...r, status: newStatus } : r));

    try {
      // Use the same POST endpoint which handles INSERT ... ON DUPLICATE KEY UPDATE
      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          // Format date for MySQL: record.date might be ISO string or YYYY-MM-DD
          date: new Date(record.date).toISOString().split('T')[0],
          attendance_data: [{ student_id: historyStudent.id, status: newStatus }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance');
      
      toast.success(`Updated ${new Date(record.date).toLocaleDateString()} to ${newStatus}`);
      fetchStudents(); // Refresh main list to update percentages
    } catch (error) {
      toast.error(error.message);
      // Revert optimistic update
      setHistoryData(historyData.map(r => r.date === record.date ? { ...r, status: originalStatus } : r));
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [assignment.id]);

  const toggleStatus = (studentId) => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, status: s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT' } : s
    ));
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          attendance_data: students.map(s => ({ student_id: s.id, status: s.status }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');
      toast.success('Attendance saved successfully');
      fetchStudents(); // Refresh to update percentages
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!confirm(`Are you sure you want to delete all attendance records for ${selectedDate}? This action cannot be undone.`)) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clerk/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attendance');
      toast.success('Attendance deleted successfully');
      fetchStudents(); // Refresh to update percentages
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPercentageColor = (pct) => {
    if (pct <= 50) return 'text-red-600 bg-red-50 border-red-200';
    if (pct <= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (loading) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      {/* History Modal Overlay */}
      {historyStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{historyStudent.name}'s Attendance History</h3>
                <p className="text-sm text-gray-500">{historyStudent.roll_no} | {assignment.subject_name}</p>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="text-center py-8">Loading history...</div>
              ) : historyData.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {historyData.map((record, i) => (
                    <div 
                      key={i} 
                      onClick={() => handleToggleHistory(record)}
                      className={`p-2 rounded border text-center text-sm transition-all shadow-sm ${
                        assignment.is_active 
                          ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-95' 
                          : 'cursor-default opacity-80'
                      } ${
                        record.status === 'PRESENT' 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      <div className="font-semibold">{new Date(record.date).toLocaleDateString()}</div>
                      <div className="text-xs font-bold uppercase">{record.status}</div>
                      {assignment.is_active && (
                        <div className="text-[10px] opacity-50 mt-1 italic">Click to toggle</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No attendance records found for this student.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 block">
            &larr; Back to Subjects
          </button>
          <h2 className="text-xl font-bold">{assignment.subject_name} - Attendance</h2>
          <p className="text-sm text-gray-500">{assignment.branch} | Sem {assignment.semester} | Sec {assignment.section}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded text-sm"
              disabled={!assignment.is_active}
            />
          </div>
          {assignment.is_active ? (
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteAttendance}
                disabled={submitting}
                className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-semibold hover:bg-red-100 disabled:opacity-50 transition"
              >
                Delete
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {submitting ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-600 px-6 py-2 rounded font-semibold border">
              View Only (Semester Ended)
            </div>
          )}
        </div>
      </div>

      <div className={`overflow-x-auto border rounded-lg ${!assignment.is_active ? 'bg-gray-50 opacity-90' : ''}`}>
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
      </div>
    </div>
  );
}
