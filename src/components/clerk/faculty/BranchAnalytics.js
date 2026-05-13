'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export default function BranchAnalytics({ branch }) {
  const [riskData, setRiskData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState(6);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/hod/attendance-analytics?semester=${selectedSem}`);
      const data = await res.json();
      if (res.ok) {
        setRiskData(data.data || []);
      }
    } catch (e) {
      toast.error('Failed to load branch analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedSem]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchAnalytics();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchAnalytics]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-700 text-xl">📉</div>
            Branch Performance & Risk
          </h3>
          <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-widest">Attendance Threshold: 75%</p>
        </div>
        
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          {[1,2,3,4,5,6,7,8].map(s => (
            <button 
              key={s} 
              onClick={() => setSelectedSem(s)}
              className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${selectedSem === s ? 'bg-rose-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white hover:text-gray-600'}`}
            >
              S{s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 opacity-50 font-black text-xs uppercase animate-pulse">Running Condonation Audit...</div>
      ) : (
        <div className="space-y-8">
          {/* Risk Alert Header */}
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-rose-200">⚠️</div>
                <div>
                   <h4 className="text-2xl font-black text-rose-900">Condonation Risk Alert</h4>
                   <p className="text-rose-800/60 font-medium max-w-md">The following students have fallen below the mandatory 75% attendance threshold for Semester {selectedSem}.</p>
                </div>
             </div>
             <div className="bg-white px-8 py-4 rounded-2xl border border-rose-100 text-center">
                <div className="text-3xl font-black text-rose-600">{riskData.length}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">High Risk Students</div>
             </div>
          </div>

          {/* Risk List */}
          <div className="grid grid-cols-1 gap-4">
             {riskData.map(student => (
               <div key={student.roll_no} className="bg-white border-2 border-gray-50 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center group hover:border-rose-200 transition-all shadow-sm">
                  <div className="flex items-center gap-5 w-full md:w-auto">
                     <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center font-black text-rose-600 shadow-inner">
                        {Math.floor(student.percentage)}%
                     </div>
                     <div>
                        <h5 className="font-black text-gray-800 tracking-tight leading-tight">{student.name}</h5>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-tighter">{student.roll_no}</span>
                           <span className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">
                             Needs {Math.ceil((0.75 * student.total_sessions_recorded - student.total_present))} more sessions
                           </span>
                        </div>
                     </div>
                  </div>

                  <div className="w-full md:w-64 mt-4 md:mt-0">
                     <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 transition-all duration-1000" 
                          style={{ width: `${student.percentage}%` }}
                        ></div>
                     </div>
                     <div className="flex justify-between mt-2">
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Progress</span>
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{student.total_present} / {student.total_sessions_recorded} Lectures</span>
                     </div>
                  </div>
               </div>
             ))}

             {riskData.length === 0 && (
               <div className="bg-emerald-50 border-2 border-dashed border-emerald-100 rounded-3xl py-20 flex flex-col items-center justify-center text-center px-10">
                  <div className="text-4xl mb-4">🎉</div>
                  <p className="text-emerald-600 font-black uppercase tracking-widest text-sm">Excellent! No students at risk.</p>
                  <p className="text-[10px] text-emerald-800/50 mt-2 max-w-xs font-medium">Every student in {branch} Semester {selectedSem} is currently above the 75% threshold.</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
