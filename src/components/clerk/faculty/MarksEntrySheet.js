'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function MarksEntrySheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/faculty/students?assignment_id=${assignment.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      
      const studentsWithMarks = data.data.map(s => ({
        ...s,
        mid1_marks: s.mid1_marks || '',
        mid2_marks: s.mid2_marks || '',
        assignment_marks: s.assignment_marks || ''
      }));
      setStudents(studentsWithMarks);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [assignment.id]);

  const handleMarkChange = (studentId, field, value) => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveMarks = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/clerk/faculty/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 block">
            &larr; Back to Subjects
          </button>
          <h2 className="text-xl font-bold">{assignment.subject_name} - Mid Marks</h2>
          <p className="text-sm text-gray-500">{assignment.branch} | Sem {assignment.semester} | Sec {assignment.section}</p>
        </div>
        {assignment.is_active ? (
          <button
            onClick={handleSaveMarks}
            disabled={submitting}
            className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Marks'}
          </button>
        ) : (
          <div className="bg-gray-100 text-gray-600 px-6 py-2 rounded font-semibold border">
            View Only (Semester Ended)
          </div>
        )}
      </div>

      <div className={`overflow-x-auto border rounded-lg ${!assignment.is_active ? 'bg-gray-50 opacity-90' : ''}`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mid-I (20)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mid-II (20)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assignment (10)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.roll_no}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={student.mid1_marks}
                    onChange={(e) => handleMarkChange(student.id, 'mid1_marks', e.target.value)}
                    className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={!assignment.is_active}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={student.mid2_marks}
                    onChange={(e) => handleMarkChange(student.id, 'mid2_marks', e.target.value)}
                    className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={!assignment.is_active}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={student.assignment_marks}
                    onChange={(e) => handleMarkChange(student.id, 'assignment_marks', e.target.value)}
                    className="w-16 p-1 border rounded text-center text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={!assignment.is_active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
