'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function MarksEntrySheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [midMax, setMidMax] = useState(20);
  const [recommendedMidMax, setRecommendedMidMax] = useState(null);
  const [subjectType, setSubjectType] = useState('theory'); // 'theory' | 'lab'
  const [isMobile, setIsMobile] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [rollColWidth, setRollColWidth] = useState(0);

  const scrollContainerRef = useRef(null);
  const rollHeaderRef = useRef(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/faculty/marks?assignment_id=${assignment.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      
      const payload = data.data || [];
      const detectedType = data.subject_type || 'theory';
      const isLab = detectedType === 'lab';
      const studentsWithMarks = payload.map(s => ({
        ...s,
        mid1_marks: isLab ? (s.lab_execution_marks || '') : (s.mid1_marks || ''),
        mid2_marks: isLab ? (s.lab_theory_marks || '') : (s.mid2_marks || ''),       
        assignment_marks: isLab ? (s.lab_record_marks || '') : (s.assignment_marks || ''),
      }));
      
      setStudents(studentsWithMarks);
      if (data.mid_max) setMidMax(data.mid_max);
      if (data.recommended_mid_max) setRecommendedMidMax(data.recommended_mid_max);
      setSubjectType(detectedType);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  const hasExistingMarks = students.some(s => 
    (s.mid1_marks !== '' && s.mid1_marks !== null) || 
    (s.mid2_marks !== '' && s.mid2_marks !== null) || 
    (s.assignment_marks !== '' && s.assignment_marks !== null && s.assignment_marks !== 0)
  );

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (rollHeaderRef.current) {
      setRollColWidth(rollHeaderRef.current.offsetWidth || 0);
    }
  }, [students.length]);

  const handleScroll = (event) => {
    setScrollLeft(event.target.scrollLeft || 0);
  };

  const handleMarkChange = (studentId, field, value) => {
    let numericValue = parseFloat(value);
    let max;
    if (subjectType === 'lab') {
      if (field === 'mid1_marks') max = 10;
      else if (field === 'mid2_marks') max = 10;
      else if (field === 'assignment_marks') max = 5;
    } else {
      if (field === 'assignment_marks') {
        max = midMax === 25 ? 5 : 10;
      } else {
        max = midMax;
      }
    }

    if (!isNaN(numericValue)) {
      if (numericValue < 0) numericValue = 0;
      if (numericValue > max) numericValue = max;
      value = numericValue;
    }

    setStudents(students.map(s => 
      s.id === studentId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveMarks = async () => {
    for (const s of students) {
      let m1Max, m2Max, aMax;
      if (subjectType === 'lab') {
        m1Max = 10; m2Max = 10; aMax = 5;
      } else {
        m1Max = midMax; m2Max = midMax; aMax = (midMax === 25 ? 5 : 10);
      }
      if (s.mid1_marks > m1Max || s.mid2_marks > m2Max || s.assignment_marks > aMax) {
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
          marks_data: students.map(s => {
            if (subjectType === 'lab') {
              return {
                student_id: s.id,
                lab_theory_marks: s.mid2_marks === '' ? null : s.mid2_marks,
                lab_execution_marks: s.mid1_marks === '' ? null : s.mid1_marks,
                lab_record_marks: s.assignment_marks === '' ? null : s.assignment_marks,
              };
            }
            return {
              student_id: s.id,
              mid1_marks: s.mid1_marks === '' ? null : s.mid1_marks,
              mid2_marks: s.mid2_marks === '' ? null : s.mid2_marks,
              assignment_marks: s.assignment_marks === '' ? null : s.assignment_marks,
            };
          })
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save marks');
      }
      toast.success('Marks saved successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-sm text-gray-600">Loading students and departmental recommendations...</div>;

  const labels = subjectType === 'lab' 
    ? { m1: 'Execution', m2: 'Writing', a: 'Record', m1m: 10, m2m: 10, am: 5, total: 25 }
    : { m1: 'Mid-I', m2: 'Mid-II', a: 'Assignment', m1m: midMax, m2m: midMax, am: (midMax === 25 ? 5 : 10), total: 30 };

  return (
    <div className="border border-gray-300 rounded-xl bg-white p-6 mt-6 shadow-sm">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <button onClick={onBack} className="text-xs font-bold text-[#0b3578] uppercase tracking-widest hover:underline mb-3 block">&larr; Back to Subjects</button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-gray-900">{assignment.subject_name}</h2>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 ${subjectType === 'lab' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>{subjectType === 'lab' ? 'Lab' : 'Theory'}</span>
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tighter">{assignment.branch} &bull; Semester {assignment.semester} &bull; {assignment.academic_year}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {assignment.is_active && subjectType === 'theory' && (
            hasExistingMarks ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl text-gray-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                <span className="text-[11px] font-black uppercase tracking-widest">Format locked ({midMax} + {midMax === 25 ? 5 : 10})</span>
              </div>
            ) : (
              <div className="bg-gray-50 p-1.5 rounded-2xl flex items-center border-2 border-gray-100 gap-1">
                <span className="text-[10px] font-black text-gray-400 px-3 uppercase tracking-widest">Pattern</span>
                <button 
                  onClick={() => setMidMax(20)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center ${midMax === 20 ? 'bg-white text-[#0b3578] shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <span>20 + 10</span>
                  {recommendedMidMax === 20 && <span className="text-[8px] text-blue-600 animate-pulse">RECOMMENDED</span>}
                </button>
                <button 
                  onClick={() => setMidMax(25)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center ${midMax === 25 ? 'bg-white text-[#0b3578] shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <span>25 + 5</span>
                  {recommendedMidMax === 25 && <span className="text-[8px] text-blue-600 animate-pulse">RECOMMENDED</span>}
                </button>
              </div>
            )
          )}

          {assignment.is_active ? (
            <button
              onClick={handleSaveMarks}
              disabled={submitting}
              className="bg-[#0b3578] text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Publish Marks'}
            </button>
          ) : (
            <div className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-red-100">Semester Finalized</div>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={isMobile ? handleScroll : undefined} className="overflow-x-auto rounded-2xl border-2 border-gray-50 shadow-inner">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b-2 border-gray-100">
              <th ref={rollHeaderRef} className={`p-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest ${isMobile ? 'sticky left-0 z-10 bg-gray-50 border-r-2 border-gray-100' : ''}`}>Roll No</th>
              <th className="p-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Student Name</th>
              <th className="p-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">{labels.m1} ({labels.m1m})</th>
              <th className="p-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">{labels.m2} ({labels.m2m})</th>
              <th className="p-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">{labels.a} ({labels.am})</th>
              <th className="p-4 text-center text-[11px] font-black text-[#0b3578] uppercase tracking-widest bg-blue-50/30 border-l-2 border-gray-100">Total ({labels.total})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {students.map((student) => {
              const m1 = student.mid1_marks !== '' ? parseFloat(student.mid1_marks) : null;
              const m2 = student.mid2_marks !== '' ? parseFloat(student.mid2_marks) : null;
              const assgn = student.assignment_marks !== '' ? parseFloat(student.assignment_marks) : 0;
              let internalTotal = (subjectType === 'lab') ? ((m1 ?? 0) + (m2 ?? 0) + (assgn ?? 0)) : ((m1 !== null || m2 !== null) ? (Math.max(m1 ?? 0, m2 ?? 0) + assgn) : null);
              const fullRoll = student.roll_no || '';
              const showCompact = isMobile && scrollLeft > rollColWidth;
              const shortRoll = fullRoll.endsWith('L') ? fullRoll.slice(-3) : fullRoll.slice(-2);

              return (
                <tr key={student.id} className="hover:bg-blue-50/20 transition-colors group">
                  <td className={`p-4 font-mono font-bold text-center ${isMobile ? 'sticky left-0 z-10 bg-white group-hover:bg-blue-50/50 border-r-2 border-gray-100' : ''}`}>
                    <span className={`inline-block transition-all ${isMobile && showCompact ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>{fullRoll}</span>
                    {isMobile && <span className={`absolute inset-0 flex items-center justify-center transition-all ${showCompact ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>{shortRoll}</span>}
                  </td>
                  <td className="p-4 text-xs font-bold text-gray-600 uppercase tracking-tight">{student.name}</td>
                  <td className="p-4 text-center"><input type="number" min="0" max={labels.m1m} step="0.5" value={student.mid1_marks} onChange={(e) => handleMarkChange(student.id, 'mid1_marks', e.target.value)} className="w-20 px-3 py-2 bg-gray-50 border-none rounded-xl text-center text-xs font-black text-gray-700 focus:ring-2 ring-blue-500 outline-none disabled:opacity-30" disabled={!assignment.is_active} /></td>
                  <td className="p-4 text-center"><input type="number" min="0" max={labels.m2m} step="0.5" value={student.mid2_marks} onChange={(e) => handleMarkChange(student.id, 'mid2_marks', e.target.value)} className="w-20 px-3 py-2 bg-gray-50 border-none rounded-xl text-center text-xs font-black text-gray-700 focus:ring-2 ring-blue-500 outline-none disabled:opacity-30" disabled={!assignment.is_active} /></td>
                  <td className="p-4 text-center"><input type="number" min="0" max={labels.am} step="0.5" value={student.assignment_marks} onChange={(e) => handleMarkChange(student.id, 'assignment_marks', e.target.value)} className="w-20 px-3 py-2 bg-gray-50 border-none rounded-xl text-center text-xs font-black text-gray-700 focus:ring-2 ring-blue-500 outline-none disabled:opacity-30" disabled={!assignment.is_active} /></td>
                  <td className="p-4 text-center bg-blue-50/10"><span className={`font-mono text-base font-black ${internalTotal === null ? 'text-gray-200' : 'text-[#0b3578]'}`}>{internalTotal !== null ? internalTotal.toFixed(1) : '--'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
