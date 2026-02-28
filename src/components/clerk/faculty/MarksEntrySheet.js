'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function MarksEntrySheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [midMax, setMidMax] = useState(20);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/faculty/marks?assignment_id=${assignment.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      
      const payload = data.data || [];
      const studentsWithMarks = payload.map(s => ({
        ...s,
        mid1_marks: s.mid1_marks || '',
        mid2_marks: s.mid2_marks || '',
        assignment_marks: s.assignment_marks || ''
      }));
      setStudents(studentsWithMarks);
      if (data.mid_max) setMidMax(data.mid_max);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if any marks exist to lock the format
  const hasExistingMarks = students.some(s => 
    (s.mid1_marks !== '' && s.mid1_marks !== null) || 
    (s.mid2_marks !== '' && s.mid2_marks !== null) || 
    (s.assignment_marks !== '' && s.assignment_marks !== null && s.assignment_marks !== 0)
  );

  useEffect(() => {
    fetchStudents();
  }, [assignment.id]);

  const handleMarkChange = (studentId, field, value) => {
    // Basic range validation
    let numericValue = parseFloat(value);
    const assignMax = midMax === 25 ? 5 : 10;

    if (!isNaN(numericValue)) {
      if (field === 'assignment_marks') {
        if (numericValue < 0) numericValue = 0;
        if (numericValue > assignMax) numericValue = assignMax;
      } else {
        if (numericValue < 0) numericValue = 0;
        if (numericValue > midMax) numericValue = midMax;
      }
      value = numericValue;
    }

    setStudents(students.map(s => 
      s.id === studentId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveMarks = async () => {
    const assignMax = midMax === 25 ? 5 : 10;
    
    // Final check before submission
    for (const s of students) {
      if (s.mid1_marks > midMax || s.mid2_marks > midMax || s.assignment_marks > assignMax) {
        toast.error(`Invalid marks detected for ${s.roll_no}. Please correct them.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/clerk/faculty/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          mid_max: midMax,
          marks_data: students.map(s => ({
            student_id: s.id,
            mid1_marks: s.mid1_marks === '' ? null : s.mid1_marks,
            mid2_marks: s.mid2_marks === '' ? null : s.mid2_marks,
            assignment_marks: s.assignment_marks === '' ? null : s.assignment_marks
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save marks');
      toast.success('Marks saved successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 block">
            &larr; Back to Subjects
          </button>
          <h2 className="text-xl font-bold">{assignment.subject_name} - Mid Marks</h2>
          <p className="text-sm text-gray-500">{assignment.branch} | Sem {assignment.semester}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {assignment.is_active && (
            hasExistingMarks ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border rounded-lg text-gray-500">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-black uppercase tracking-tight">Format Locked ({midMax}+{midMax === 25 ? 5 : 10})</span>
              </div>
            ) : (
              <div className="bg-gray-100 p-1 rounded-lg flex items-center border">
                <span className="text-xs font-bold text-gray-500 px-3 uppercase">Pattern:</span>
                <button 
                  onClick={() => setMidMax(20)}
                  className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${midMax === 20 ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  20 + 10
                </button>
                <button 
                  onClick={() => setMidMax(25)}
                  className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${midMax === 25 ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  25 + 5
                </button>
              </div>
            )
          )}

          {assignment.is_active ? (
            <button
              onClick={handleSaveMarks}
              disabled={submitting}
              className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
            >
              {submitting ? 'Saving...' : 'Save Marks'}
            </button>
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
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase font-black">Mid-I ({midMax})</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase font-black">Mid-II ({midMax})</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase font-black">Assignment ({midMax === 25 ? 5 : 10})</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-indigo-600 bg-indigo-50 uppercase font-black">Total (30)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => {
              const m1 = student.mid1_marks !== '' ? parseFloat(student.mid1_marks) : null;
              const m2 = student.mid2_marks !== '' ? parseFloat(student.mid2_marks) : null;
              const assgn = student.assignment_marks !== '' ? parseFloat(student.assignment_marks) : 0;
              const assignMax = midMax === 25 ? 5 : 10;
              
              let internalTotal = null;
              if (m1 !== null || m2 !== null) {
                const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
                internalTotal = bestMid + assgn;
              }

              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{student.roll_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={midMax}
                      step="0.5"
                      value={student.mid1_marks}
                      onChange={(e) => handleMarkChange(student.id, 'mid1_marks', e.target.value)}
                      className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500 font-bold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={midMax}
                      step="0.5"
                      value={student.mid2_marks}
                      onChange={(e) => handleMarkChange(student.id, 'mid2_marks', e.target.value)}
                      className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500 font-bold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={assignMax}
                      step="0.5"
                      value={student.assignment_marks}
                      onChange={(e) => handleMarkChange(student.id, 'assignment_marks', e.target.value)}
                      className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500 font-bold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center bg-indigo-50/30">
                    <span className={`font-mono font-black ${internalTotal === null ? 'text-gray-300' : 'text-indigo-700'}`}>
                      {internalTotal !== null ? internalTotal.toFixed(1) : '--'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
