'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AssignedSubjectsList({ onSelectAssignment, showActions = true }) {
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

  const grouped = assignments.reduce((acc, asgn) => {
    if (!acc[asgn.academic_year]) acc[asgn.academic_year] = [];
    acc[asgn.academic_year].push(asgn);
    return acc;
  }, {});

  const sortedAYs = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Faculty Subject History</h2>
        <div className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
          Total Subjects: {assignments.length}
        </div>
      </div>

      {assignments.length > 0 ? (
        <div className="space-y-10">
          {sortedAYs.map((ay) => (
            <div key={ay} className="border-l-4 border-indigo-200 pl-4">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 bg-indigo-50 inline-block px-4 py-1 rounded-r-lg shadow-sm">
                Academic Year {ay}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[ay].map((asgn) => (
                  <div 
                    key={asgn.id} 
                    className={`border rounded-lg p-4 hover:shadow-lg transition-all duration-300 relative group ${
                      asgn.is_active 
                        ? 'bg-white border-indigo-100 ring-1 ring-indigo-50' 
                        : 'bg-gray-50 border-gray-200 grayscale-[0.3]'
                    }`}
                  >
                    {!asgn.is_active && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[9px] font-bold uppercase rounded-sm shadow-inner">Ended</span>
                      </div>
                    )}
                    
                    <div className={`font-bold text-lg leading-tight mb-1 ${asgn.is_active ? 'text-indigo-900' : 'text-gray-700'}`}>
                      {asgn.subject_name}
                    </div>
                    <div className={`text-xs font-mono mb-3 ${asgn.is_active ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {asgn.subject_code}
                    </div>

                    <div className="grid grid-cols-2 gap-y-1 text-[11px] mb-4">
                      <div className="text-gray-500">Branch: <span className="font-semibold text-gray-700">{asgn.branch}</span></div>
                      <div className="text-gray-500">Semester: <span className="font-semibold text-gray-700">{asgn.semester}</span></div>
                    </div>

                    {showActions && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onSelectAssignment(asgn, 'attendance')}
                          className={`flex-1 px-3 py-2 rounded text-xs font-bold transition-all ${
                            asgn.is_active 
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95' 
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {asgn.is_active ? 'Attendance' : 'View Attendance'}
                        </button>
                        <button
                          onClick={() => onSelectAssignment(asgn, 'marks')}
                          className={`flex-1 px-3 py-2 rounded text-xs font-bold transition-all ${
                            asgn.is_active 
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md active:scale-95' 
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {asgn.is_active ? 'Mid Marks' : 'View Marks'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-2">📚</div>
          <div className="text-gray-500 font-medium">No subjects assigned yet.</div>
          <div className="text-sm text-gray-400">Express interest in the "Apply for Subject" tab to get started.</div>
        </div>
      )}
    </div>
  );
}
