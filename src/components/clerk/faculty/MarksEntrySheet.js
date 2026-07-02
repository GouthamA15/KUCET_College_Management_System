'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function MarksEntrySheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [midMax, setMidMax] = useState(20);
  const [_recommendedMidMax, setRecommendedMidMax] = useState(null);
  const [subjectType, setSubjectType] = useState('theory'); // 'theory' | 'lab'
  const [marksMode, setMarksMode] = useState('overview'); // 'overview' | 'mid1' | 'mid2' | 'assignment'
  const [isMobile, setIsMobile] = useState(false);
  const [_scrollLeft, setScrollLeft] = useState(0);
  const [_rollColWidth, setRollColWidth] = useState(0);

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
        is_published: Boolean(s.is_published),
        mid1_marks: isLab ? (s.lab_execution_marks ?? '') : (s.mid1_marks ?? ''),
        mid2_marks: isLab ? (s.lab_theory_marks ?? '') : (s.mid2_marks ?? ''),       
        assignment_marks: isLab ? (s.lab_record_marks ?? '') : (s.assignment_marks ?? ''),
      }));
      
      setStudents(studentsWithMarks);
      setDirty(false);
      if (data.mid_max) setMidMax(data.mid_max);
      if (data.recommended_mid_max) setRecommendedMidMax(data.recommended_mid_max);
      setSubjectType(detectedType);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  const hasAnyMarks = students.some(s => 
    (s.mid1_marks !== '' && s.mid1_marks !== null && s.mid1_marks !== undefined) || 
    (s.mid2_marks !== '' && s.mid2_marks !== null && s.mid2_marks !== undefined) || 
    (s.assignment_marks !== '' && s.assignment_marks !== null && s.assignment_marks !== undefined)
  );

  const isPublishedLocked = students.some(s => Boolean(s.is_published));

  useEffect(() => {
    const id = setTimeout(() => {
      fetchStudents();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchStudents]);

  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    const id = setTimeout(() => {
      updateIsMobile();
    }, 0);
    window.addEventListener('resize', updateIsMobile);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', updateIsMobile);
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (rollHeaderRef.current) {
        setRollColWidth(rollHeaderRef.current.offsetWidth || 0);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [students.length]);

  const handleScroll = (event) => {
    setScrollLeft(event.target.scrollLeft || 0);
  };

  const getFieldMax = (field) => {
    if (subjectType === 'lab') {
      if (field === 'mid1_marks') return 10;
      if (field === 'mid2_marks') return 10;
      return 5;
    }
    if (field === 'assignment_marks') return midMax === 25 ? 5 : 10;
    return midMax;
  };

  const toNumberOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  };

  const computeTotal = (student) => {
    const m1 = toNumberOrNull(student.mid1_marks);
    const m2 = toNumberOrNull(student.mid2_marks);
    const a = toNumberOrNull(student.assignment_marks);

    const hasAny = m1 !== null || m2 !== null || a !== null;
    if (!hasAny) return null;

    if (subjectType === 'lab') {
      return (m1 ?? 0) + (m2 ?? 0) + (a ?? 0);
    }

    const best = Math.max(m1 ?? 0, m2 ?? 0);
    return best + (a ?? 0);
  };

  const handleMarkChange = (studentId, field, value) => {
    if (value === '') {
      setDirty(true);
      setStudents((prev) => prev.map(s => 
        s.id === studentId ? { ...s, [field]: '' } : s
      ));
      return;
    }

    let numericValue = parseFloat(value);
    if (!Number.isFinite(numericValue)) return;

    // Prevent decimal abuse: allow up to 2 decimals.
    numericValue = Math.round(numericValue * 100) / 100;

    const max = getFieldMax(field);
    if (numericValue < 0) numericValue = 0;
    if (numericValue > max) numericValue = max;

    setDirty(true);
    setStudents((prev) => prev.map(s => 
      s.id === studentId ? { ...s, [field]: numericValue } : s
    ));
  };

  const handleSave = async (publish) => {
    if (!assignment.is_active) return;
    if (isPublishedLocked) {
      toast.error('Marks already published and locked.');
      return;
    }

    if (publish) {
      const ok = confirm('Publish marks now? This will lock editing for this subject.');
      if (!ok) return;
    }

    for (const s of students) {
      const m1 = toNumberOrNull(s.mid1_marks);
      const m2 = toNumberOrNull(s.mid2_marks);
      const a = toNumberOrNull(s.assignment_marks);

      const m1Max = getFieldMax('mid1_marks');
      const m2Max = getFieldMax('mid2_marks');
      const aMax = getFieldMax('assignment_marks');

      if ((m1 !== null && (m1 < 0 || m1 > m1Max)) || (m2 !== null && (m2 < 0 || m2 > m2Max)) || (a !== null && (a < 0 || a > aMax))) {
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
          publish,
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save marks');

      toast.success(publish ? 'Marks published and locked.' : 'Draft saved successfully.');
      await fetchStudents();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-sm text-gray-600">Loading students and departmental recommendations...</div>;

  const labels = subjectType === 'lab' 
    ? { m1: 'Execution', m2: 'Writing', a: 'Record', m1m: 10, m2m: 10, am: 5, total: 25 }
    : { m1: 'Mid-1', m2: 'Mid-2', a: 'Assignment', m1m: midMax, m2m: midMax, am: (midMax === 25 ? 5 : 10), total: 30 };

  const modeMeta = {
    overview: { label: 'Overview', field: 'all', max: labels.total },
    mid1: { label: labels.m1, field: 'mid1_marks', max: labels.m1m },
    mid2: { label: labels.m2, field: 'mid2_marks', max: labels.m2m },
    assignment: { label: labels.a, field: 'assignment_marks', max: labels.am },
  };

  const activeMode = modeMeta[marksMode] || modeMeta.overview;

  const handleBack = () => {
    if (dirty && !confirm('You have unsaved changes. Go back without saving?')) return;
    onBack();
  };

  return (
    <div className="border border-slate-300 rounded-sm bg-white p-3 mt-4 shadow-sm">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b border-slate-100 pb-3">
        <div className="flex flex-col gap-1">
          <button onClick={handleBack} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-indigo-600 flex items-center gap-1">
            <span className="text-sm">←</span> BACK TO SUBJECTS
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{assignment.subject_name}</h2>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${subjectType === 'lab' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>{subjectType === 'lab' ? 'LAB' : 'THEORY'}</span>
            {isPublishedLocked ? (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-rose-50 border-rose-200 text-rose-700">PUBLISHED</span>
            ) : hasAnyMarks ? (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-slate-50 border-slate-200 text-slate-500">DRAFT</span>
            ) : null}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
            {assignment.branch} • SEM {assignment.semester} • {assignment.academic_year}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switching (Government Style) */}
          <div className="flex border border-slate-200 rounded-sm overflow-hidden">
            {Object.keys(modeMeta).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarksMode(m)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-slate-200 ${marksMode === m ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {modeMeta[m].label}
              </button>
            ))}
          </div>

          {/* Action Buttons (Compact Utility) */}
          {assignment.is_active ? (
            isPublishedLocked ? (
              <div className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-sm text-[9px] font-bold uppercase border border-rose-200">LOCKED</div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={submitting}
                  className="bg-white text-slate-700 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {submitting ? '...' : 'SAVE DRAFT'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={submitting}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? '...' : 'PUBLISH'}
                </button>
              </div>
            )
          ) : (
            <div className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-sm text-[9px] font-bold uppercase border border-slate-200">FINALIZED</div>
          )}
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-3 mt-4">
        {students.map((student) => {
          const internalTotal = computeTotal(student);
          const fullRoll = student.roll_no || '';
          const disabled = !assignment.is_active || isPublishedLocked;

          return (
            <div key={student.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-mono font-bold text-slate-800">{fullRoll}</span>
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mt-1">{student.name}</div>
                </div>
                
                {marksMode === 'overview' && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total</span>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      {internalTotal !== null ? internalTotal.toFixed(1) : '-'}
                    </span>
                  </div>
                )}
              </div>
              
              {marksMode !== 'overview' && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{activeMode.label} ({activeMode.max})</span>
                  <input
                    type="number"
                    min="0"
                    max={activeMode.max}
                    step="0.5"
                    value={student[activeMode.field]}
                    onChange={(e) => handleMarkChange(student.id, activeMode.field, e.target.value)}
                    className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-black text-slate-800 focus:bg-white focus:border-indigo-500 outline-none disabled:opacity-50 focus:ring-2 focus:ring-indigo-200 transition-all"
                    disabled={disabled}
                    inputMode="decimal"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table Layout */}
      <div ref={scrollContainerRef} onScroll={isMobile ? handleScroll : undefined} className="hidden md:block overflow-x-auto border border-slate-200 mt-4 rounded-lg">
        <table className="min-w-full text-xs border-collapse divide-y-2 divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th ref={rollHeaderRef} className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Roll No</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Student Name</th>
              
              {marksMode === 'overview' ? (
                <>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">{labels.m1}</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">{labels.m2}</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">{labels.a}</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/50">Total</th>
                </>
              ) : (
                <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{activeMode.label} ({activeMode.max})</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {students.map((student) => {
              const internalTotal = computeTotal(student);
              const fullRoll = student.roll_no || '';
              const disabled = !assignment.is_active || isPublishedLocked;

              return (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 font-mono font-bold text-left border-r border-slate-100">
                    <span className="inline-block transition-all opacity-100 scale-100">{fullRoll}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-100">
                    <div className="text-[12px] font-bold text-slate-700 uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-xs" title={student.name}>
                      {student.name}
                    </div>
                  </td>
                  
                  {marksMode === 'overview' ? (
                    <>
                      <td className="px-4 py-3 text-center font-mono text-slate-600 border-r border-slate-100">{student.mid1_marks === '' ? '-' : student.mid1_marks}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600 border-r border-slate-100">{student.mid2_marks === '' ? '-' : student.mid2_marks}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600 border-r border-slate-100">{student.assignment_marks === '' ? '-' : student.assignment_marks}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-indigo-700 bg-indigo-50/20">{internalTotal !== null ? internalTotal.toFixed(1) : '-'}</td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={activeMode.max}
                        step="0.5"
                        value={student[activeMode.field]}
                        onChange={(e) => handleMarkChange(student.id, activeMode.field, e.target.value)}
                        className="w-full max-w-[100px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-center text-[12px] font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none disabled:opacity-50"
                        disabled={disabled}
                        inputMode="decimal"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
