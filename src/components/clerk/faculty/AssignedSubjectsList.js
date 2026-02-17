'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AssignedSubjectsList({ onSelectAssignment }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clerk/faculty/assignments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch assignments');
      setAssignments(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  if (loading) return <div className="text-center py-4">Loading assignments...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-4">Your Assigned Subjects</h2>
      {assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((asgn) => (
            <div 
              key={asgn.id} 
              className={`border rounded-lg p-4 hover:shadow-lg transition-shadow ${
                asgn.is_active 
                  ? 'bg-indigo-50 border-indigo-100' 
                  : 'bg-gray-50 border-gray-200 opacity-80'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className={`font-bold text-lg ${asgn.is_active ? 'text-indigo-900' : 'text-gray-700'}`}>
                  {asgn.subject_name}
                </div>
                {!asgn.is_active && (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold uppercase rounded">Ended</span>
                )}
              </div>
              <div className={`text-sm mb-2 ${asgn.is_active ? 'text-indigo-700' : 'text-gray-500'}`}>{asgn.subject_code}</div>
              <div className="text-sm text-gray-600 mb-1">
                <span className="font-semibold">Branch:</span> {asgn.branch}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                <span className="font-semibold">Semester:</span> {asgn.semester}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                <span className="font-semibold">Section:</span> {asgn.section}
              </div>
              <div className="text-sm text-gray-600 mb-3">
                <span className="font-semibold">AY:</span> {asgn.academic_year}
              </div>
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => onSelectAssignment(asgn, 'attendance')}
                  className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 transition"
                >
                  Attendance
                </button>
                <button
                  onClick={() => onSelectAssignment(asgn, 'marks')}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition"
                >
                  Mid Marks
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">No subjects assigned yet. Express interest or contact admin.</div>
      )}
    </div>
  );
}
