'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AcademicTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historySubject, setHistorySubject] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchAcademicInfo = async () => {
    try {
      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch academic info');
      setData(json.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (subject) => {
    setHistorySubject(subject);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/student/attendance/history?assignment_id=${subject.assignment_id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch attendance history');
      setHistoryData(json.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchAcademicInfo();
  }, []);

  const getPercentageColor = (pct) => {
    if (pct <= 50) return 'text-red-600 bg-red-50 border-red-200';
    if (pct <= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (loading) return <div className="text-center py-8">Loading academic details...</div>;

  return (
    <div className="space-y-6">
      {/* Attendance History Modal */}
      {historySubject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-scaleUp">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Attendance History</h3>
                <p className="text-sm text-gray-500">{historySubject.subject_name}</p>
              </div>
              <button onClick={() => setHistorySubject(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="text-center py-8">Loading history...</div>
              ) : historyData.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {historyData.map((record, i) => (
                    <div key={i} className={`p-3 rounded-lg border relative overflow-hidden ${record.status === 'PRESENT' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                      <div className="text-sm font-bold">{new Date(record.date).toLocaleDateString()}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest">{record.status}</div>
                      <div className="absolute top-1 right-1 bg-white/50 px-1.5 py-0.5 rounded text-[8px] font-bold">S{record.session}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No records found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
          Current Semester Academic Performance
        </h3>
      </div>

      {data.length > 0 ? (
        <div className="overflow-x-auto border rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">Subject</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Attendance</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Mid-I</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Mid-II</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Assign.</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-600 bg-indigo-50">Total (30)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.map((sub) => {
                const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 100;
                
                // Calculate Internal Total out of 30
                // Typically: (Best of Mid1, Mid2) + Assignment
                const m1 = sub.mid1_marks !== null ? parseFloat(sub.mid1_marks) : null;
                const m2 = sub.mid2_marks !== null ? parseFloat(sub.mid2_marks) : null;
                const assgn = sub.assignment_marks !== null ? parseFloat(sub.assignment_marks) : 0;
                
                let internalTotal = null;
                if (m1 !== null || m2 !== null) {
                  const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
                  internalTotal = bestMid + assgn;
                }

                return (
                  <tr key={sub.assignment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-900">{sub.subject_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{sub.subject_code} • {sub.faculty_name}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => fetchHistory(sub)}
                        className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border transition-all hover:shadow-md active:scale-95 ${getPercentageColor(pct)}`}
                      >
                        <span className="text-sm font-black">{pct.toFixed(1)}%</span>
                        <span className="text-[9px] opacity-70 font-bold uppercase">{sub.attended_classes}/{sub.total_classes}</span>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono font-bold ${sub.mid1_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                        {sub.mid1_marks ?? '--'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono font-bold ${sub.mid2_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                        {sub.mid2_marks ?? '--'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono font-bold ${sub.assignment_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                        {sub.assignment_marks ?? '--'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center bg-indigo-50/30">
                      <span className={`font-mono font-black text-lg ${internalTotal === null ? 'text-gray-300' : 'text-indigo-700'}`}>
                        {internalTotal !== null ? internalTotal.toFixed(1) : '--'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-500 font-medium">No subjects found for the current semester.</p>
          <p className="text-xs text-gray-400 mt-1">Assignments will appear once faculty members are assigned to your class.</p>
        </div>
      )}
    </div>
  );
}
