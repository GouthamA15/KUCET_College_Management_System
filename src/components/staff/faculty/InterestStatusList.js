'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';

export default function InterestStatusList() {
  const { facultyInterests = [], isLoadingFaculty } = useStaff();
  const [fetchedInterests, setFetchedInterests] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  const interests = fetchedInterests !== null ? fetchedInterests : facultyInterests;
  const loading = fetchedInterests === null ? (isFetching || isLoadingFaculty) : (isFetching && interests.length === 0);

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

  useEffect(() => {
    if (facultyInterests && facultyInterests.length > 0) {
      return;
    }
    if (!isLoadingFaculty && fetchedInterests === null && !isFetching) {
      const fetchInterests = async () => {
        setIsFetching(true);
        try {
          const res = await fetch('/api/staff/faculty/interests');
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to fetch interests');
          setFetchedInterests(data.data || []);
        } catch (error) {
          toast.error(error.message);
          setFetchedInterests([]);
        } finally {
          setIsFetching(false);
        }
      };
      fetchInterests();
    }
  }, [facultyInterests, isLoadingFaculty, fetchedInterests, isFetching]);

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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-sm">
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

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3">
            {interests.map((interest) => (
              <div key={interest.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-slate-500">{interest.subject_code}</span>
                    <span className="text-sm font-bold text-slate-800">{interest.subject_name}</span>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest border ${
                    interest.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    interest.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                    'bg-indigo-50 text-indigo-800 border-indigo-200'
                  }`}>
                    {interest.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-2 font-medium">
                  {interest.branch} | Semester {interest.semester} | {interest.academic_year}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 border-t border-slate-100 pt-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Applied: {formatIstDate(interest.created_at)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
            You haven&apos;t expressed interest in any subjects yet.
          </div>
        )}
      </div>
    </section>
  );
}
