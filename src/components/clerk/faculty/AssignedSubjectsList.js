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
    const id = setTimeout(() => {
      fetchAssignments();
    }, 0);
    return () => clearTimeout(id);
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
    <div className="space-y-10">
      {/* Active Subjects Section */}
      <section>
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-3 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-[#0b3578]"></span>
            Active Academic Assignments
          </h2>
          <div className="text-[9px] font-bold text-[#0b3578] bg-blue-50 px-3 py-1 border border-blue-100 uppercase tracking-widest">
            {activeAssignments.length} Current Records
          </div>
        </div>

        {activeAssignments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAssignments.map((asgn) => (
              <div 
                key={asgn.id} 
                className="bg-white border border-slate-200 p-5 hover:border-[#0b3578] transition-all relative group"
              >
                <div className="relative">
                  <div className="font-bold text-base leading-tight mb-1 text-slate-800 uppercase tracking-tight">
                    {asgn.subject_name}
                  </div>
                  <div className="text-[10px] font-bold mb-4 text-[#0b3578] uppercase tracking-widest opacity-70">
                    ID: {asgn.subject_code}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className="bg-slate-50 p-2 border border-slate-100">
                      <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Branch</div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase">{asgn.branch}</div>
                    </div>
                    <div className="bg-slate-50 p-2 border border-slate-100">
                      <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Semester</div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase">Sem {asgn.semester}</div>
                    </div>
                  </div>

                  {showActions && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onSelectAssignment(asgn, 'attendance')}
                        className="w-full bg-[#0b3578] text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-900 transition-all border border-[#0b3578]"
                      >
                        Register Attendance
                      </button>
                      <button
                        onClick={() => onSelectAssignment(asgn, 'marks')}
                        className="w-full bg-white text-slate-700 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-slate-200 hover:border-[#0b3578] hover:text-[#0b3578] transition-all"
                      >
                        Manage Internal Marks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 p-10 border border-dashed border-slate-200 text-center">
            <div className="text-3xl mb-3 opacity-20">📭</div>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">No active instructional assignments found</p>
            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter italic">Official assignments will be displayed here once verified by the department registry.</p>
          </div>
        )}
      </section>

      {/* Historical Section */}
      {historicalAssignments.length > 0 && (
        <section className="pt-10 border-t border-slate-200">
          <div className="flex justify-between items-center mb-8 px-1">
            <h2 className="text-xs font-bold text-slate-400 flex items-center gap-3 uppercase tracking-widest">
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Faculty Instructional Archives
            </h2>
          </div>

          <div className="space-y-10">
            {sortedAYs.map((ay) => (
              <div key={ay} className="relative">
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 mb-4 border-b border-slate-100">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-4">
                    Academic Session {ay}
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedHistory[ay].map((asgn) => (
                    <div 
                      key={asgn.id} 
                      className="bg-slate-50/50 border border-slate-200 p-4 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-slate-700 text-[11px] leading-tight uppercase">{asgn.subject_name}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{asgn.subject_code}</div>
                        </div>
                        <span className="px-2 py-0.5 border border-slate-200 text-slate-400 text-[7px] font-bold uppercase tracking-tighter bg-white">Archived</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={() => onSelectAssignment(asgn, 'attendance')}
                          className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest hover:border-[#0b3578] hover:text-[#0b3578] transition-all"
                        >
                          View Attendance
                        </button>
                        <button
                          onClick={() => onSelectAssignment(asgn, 'marks')}
                          className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest hover:border-[#0b3578] hover:text-[#0b3578] transition-all"
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
