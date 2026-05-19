'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function InterestStatusList() {
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatIstDate = (value) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      try {
        return new Date(value).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    }
  };

  const fetchInterests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clerk/faculty/interests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch interests');
      setInterests(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      fetchInterests();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
        Loading your interests…
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4">
        <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Interest Status</h2>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-1">All submitted interests and their approval state.</p>
      </div>

      <div className="p-4 md:p-6">
        {interests.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch/Sem</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Academic Year</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Applied On</th>
              </tr>
            </thead>
              <tbody className="bg-white divide-y divide-slate-200">
              {interests.map((interest) => (
                <tr key={interest.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-[11px] font-bold text-slate-800">{interest.subject_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-semibold">{interest.subject_code}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-600">
                    {interest.branch} | Sem {interest.semester}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-600">
                    {interest.academic_year}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest border ${
                      interest.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      interest.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                      'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}>
                      {interest.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-600">
                    {formatIstDate(interest.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
            You haven&apos;t expressed interest in any subjects yet.
          </div>
        )}
      </div>
    </section>
  );
}
