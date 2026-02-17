'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AssignedSubjectsList({ onSelectAssignment = () => {}, showActions = true }) {
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

  const activeAssignments = assignments.filter(a => a.is_active);
  const historicalAssignments = assignments.filter(a => !a.is_active);

  const groupedHistory = historicalAssignments.reduce((acc, asgn) => {
    if (!acc[asgn.academic_year]) acc[asgn.academic_year] = [];
    acc[asgn.academic_year].push(asgn);
    return acc;
  }, {});

  const sortedAYs = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-10 mt-6">
      {/* Active Subjects Section */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
            Active Assignments
          </h2>
          <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
            {activeAssignments.length} Current
          </div>
        </div>

        {activeAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAssignments.map((asgn) => (
              <div 
                key={asgn.id} 
                className="bg-white border-2 border-indigo-50 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 relative group overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                
                <div className="relative">
                  <div className="font-black text-xl leading-tight mb-1 text-indigo-900">
                    {asgn.subject_name}
                  </div>
                  <div className="text-xs font-mono font-bold mb-4 text-indigo-500 uppercase tracking-widest">
                    {asgn.subject_code}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <div className="text-[10px] text-gray-400 font-bold uppercase">Branch</div>
                      <div className="text-xs font-bold text-gray-700">{asgn.branch}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <div className="text-[10px] text-gray-400 font-bold uppercase">Semester</div>
                      <div className="text-xs font-bold text-gray-700">Sem {asgn.semester}</div>
                    </div>
                  </div>

                  <div className="flex gap-3" style={{ display: 'none' }}>
                    <button
                      onClick={() => onSelectAssignment(asgn, 'attendance')}
                      className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                    >
                      Attendance
                    </button>
                    <button
                      onClick={() => onSelectAssignment(asgn, 'marks')}
                      className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                    >
                      Mid Marks
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 border-2 border-dashed border-gray-200 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 font-bold">No active subjects for the current semester period.</p>
            <p className="text-xs text-gray-400 mt-1">If this is a mistake, please check your interests or contact admin.</p>
          </div>
        )}
      </section>

      {/* Historical Section */}
      {historicalAssignments.length > 0 && (
        <section className="pt-10 border-t border-gray-200">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-gray-500 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Faculty Subject History
            </h2>
          </div>

          <div className="space-y-12">
            {sortedAYs.map((ay) => (
              <div key={ay} className="relative">
                <div className="sticky top-0 z-10 bg-gray-100/80 backdrop-blur-sm py-2 mb-6">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-4">
                    Academic Year {ay}
                    <div className="h-[1px] flex-1 bg-gray-200"></div>
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedHistory[ay].map((asgn) => (
                    <div 
                      key={asgn.id} 
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 grayscale-[0.8] opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-gray-700 leading-tight">{asgn.subject_name}</div>
                          <div className="text-[10px] font-mono text-gray-400">{asgn.subject_code}</div>
                        </div>
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-[8px] font-black uppercase rounded-md">Ended</span>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => onSelectAssignment(asgn, 'attendance')}
                          className="flex-1 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors"
                        >
                          View Attendance
                        </button>
                        <button
                          onClick={() => onSelectAssignment(asgn, 'marks')}
                          className="flex-1 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors"
                        >
                          View Marks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
