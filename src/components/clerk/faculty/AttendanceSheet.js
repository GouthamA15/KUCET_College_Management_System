'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';

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
  const [baseStudents, setBaseStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [dateValidation, setDateValidation] = useState({
    isValid: false,
    message: 'Select a WORKING day from the academic calendar.',
  });
  const [dayInfo, setDayInfo] = useState(null);

  // Sessions present for selected date (inferred from server)
  const [existingSessionsForSelectedDate, setExistingSessionsForSelectedDate] = useState([]);

  const fetchBaseStudents = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/clerk/faculty/students?assignment_id=${assignment.id}&base=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');

      const base = (data.data || []).map(s => ({ id: s.id, roll_no: s.roll_no, name: s.name }));
      setBaseStudents(base);

      // Initialize students view to base list (default NOT SET -> null)
      setStudents(base.map(s => ({ ...s, status: null })));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  const fetchAttendanceStatus = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}&date=${encodeURIComponent(selectedDate)}&session=${encodeURIComponent(selectedSession)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance status');

      const statusMap = (data.data || []).reduce((acc, r) => { acc[r.student_id] = r.status; return acc; }, {});

      const merged = baseStudents.map(s => ({ ...s, status: statusMap[s.id] ?? null }));
      setStudents(merged);
      setExistingSessionsForSelectedDate(data.sessions || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id, selectedDate, selectedSession, baseStudents]);

  // History and full-grid functions removed — single-session grid only

  useEffect(() => {
    // Load base students once per assignment
    fetchBaseStudents();
  }, [assignment.id, fetchBaseStudents]);

  useEffect(() => {
    // On date/session change, fetch only attendance status and merge into baseStudents
    if (selectedDate) {
      fetchAttendanceStatus();
    } else {
      // no date selected: show base list with default PRESENT
      setStudents(baseStudents.map(s => ({ ...s, status: 'PRESENT' })));
      setExistingSessionsForSelectedDate([]);
    }
  }, [selectedDate, selectedSession, baseStudents, fetchAttendanceStatus]);

  const toggleStatus = (studentId) => {
    setStudents(students.map(s => {
      if (s.id !== studentId) return s;
      // Cycle: null -> PRESENT -> ABSENT -> PRESENT ...
      if (s.status === null) return { ...s, status: 'PRESENT' };
      if (s.status === 'PRESENT') return { ...s, status: 'ABSENT' };
      return { ...s, status: 'PRESENT' };
    }));
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    try {
      if (!selectedDate || !dateValidation.isValid) {
        throw new Error('Select a valid WORKING day from the calendar.');
      }

      // Saving allowed for new sessions; do not block on NOT SET here.

      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          session: selectedSession,
          attendance_data: students.map(s => ({ student_id: s.id, status: s.status }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');

      toast.success('Attendance saved successfully');
      await fetchAttendanceStatus();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!selectedDate) return toast.error('No date selected');

    if (!confirm(`Are you sure you want to delete attendance for Session ${selectedSession} on ${selectedDate}?`)) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clerk/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}&session=${selectedSession}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attendance');

      toast.success('Attendance deleted successfully');
      await fetchAttendanceStatus();
      setSelectedSession(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // attendance percentage removed from UI
  const handleCalendarSelect = (dateStr, info) => {
    setSelectedDate(dateStr);
    if (info) {
      setDayInfo(info);
      if (info.day_type === 'WORKING') {
        setDateValidation({ isValid: true, message: null });
      } else {
        setDateValidation({
          isValid: false,
          message: `Attendance cannot be marked. Reason: ${info.day_type}`,
        });
      }
    }
  };

  // history save removed

  if (loading && !students.length) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Subject Identity Panel */}
      <SubjectIdentityPanel assignment={assignment} />

      {/* FACULTY ACADEMIC CALENDAR */}
      <FacultyAcademicCalendar
        assignment={assignment}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        attendanceSectionId="faculty-attendance-section"
      />

      {/* ATTENDANCE ENTRY SECTION */}
      <section id="faculty-attendance-section" className="bg-white p-4 sm:p-6 rounded-lg border-2 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 border-b pb-3">
          <div>
            <p className="text-[11px] font-bold text-gray-500 tracking-[0.18em] uppercase">ATTENDANCE ENTRY</p>
            <p className="text-sm text-gray-600 mt-1">Select a WORKING day from the calendar to record attendance.</p>
          </div>
          <div className="mt-3 md:mt-0 flex flex-col items-end text-xs gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 uppercase tracking-wide">DATE</span>
              <span className="font-mono text-gray-900">{selectedDate || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 uppercase tracking-wide">DAY TYPE</span>
              <span className="text-gray-900 font-semibold">{dayInfo?.day_type || '—'}</span>
            </div>
          </div>
        </div>

        {!selectedDate && (
          <div className="text-sm text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-md p-3">Select a WORKING day in the academic calendar above to enable attendance entry.</div>
        )}

        {selectedDate && !dateValidation.isValid && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3 font-semibold">{dateValidation.message}</div>
        )}

        {selectedDate && (
          <>
            <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2">SESSIONS</label>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border-2">
                  {[1, 2, 3, 4, 5].map(num => {
                    const isExisting = existingSessionsForSelectedDate.includes(num);
                    const isAllowedSequential = num === 1 || existingSessionsForSelectedDate.includes(num - 1);
                    const isDisabled = !assignment.is_active || !isAllowedSequential;
                    const isSelected = selectedSession === num;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => !isDisabled && setSelectedSession(num)}
                        disabled={isDisabled}
                        className={`flex-1 h-9 rounded-md text-[11px] font-bold tracking-wide uppercase transition-colors border ${
                          isSelected ? 'bg-gray-900 text-white border-gray-900' : isExisting ? 'bg-gray-50 text-gray-900 border-gray-300' : 'bg-white text-gray-600 border-gray-200'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isDisabled && num !== 1 ? `Session S${num} will be available after S${num - 1} is recorded.` : isExisting ? `S${num} already has attendance records.` : ''}
                      >
                        S{num}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">Sessions unlock sequentially. S2 requires recorded attendance for S1, and so on.</p>
              </div>

              <div className="flex flex-col items-stretch md:items-end gap-2 min-w-[180px]">
                {assignment.is_active ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveAttendance}
                      disabled={
                        submitting ||
                        !students.length ||
                        !dateValidation.isValid ||
                        !assignment.is_active
                      }
                      className="px-4 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-wide border border-gray-900 disabled:opacity-60"
                    >
                      {submitting ? 'Saving…' : 'Save Attendance'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAttendance}
                      disabled={
                        submitting ||
                        !existingSessionsForSelectedDate.includes(selectedSession) ||
                        !dateValidation.isValid ||
                        !assignment.is_active
                      }
                      className="px-4 py-2 bg-white text-red-700 text-xs font-bold uppercase tracking-wide border border-red-300 disabled:opacity-50"
                    >
                      Delete Session
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-2 bg-gray-200 text-gray-600 text-[11px] font-bold uppercase tracking-[0.18em] border text-center">Semester Ended</div>
                )}
              </div>
            </div>

            <table className="min-w-full divide-y-2 divide-gray-200 border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">{student.roll_no}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => assignment.is_active && toggleStatus(student.id)}
                        disabled={!assignment.is_active || !dateValidation.isValid}
                        className={`w-28 px-3 py-2 rounded text-sm font-bold uppercase ${
                          student.status === null
                            ? 'bg-gray-100 text-gray-700'
                            : student.status === 'PRESENT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        } ${!assignment.is_active || !dateValidation.isValid ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                      >
                        {student.status === null ? 'NOT SET' : student.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* History removed — single-session grid only */}
    </div>
  );
}
