'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function MarksEntrySheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [midMax, setMidMax] = useState(20);
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
        // For lab subjects, reuse UI fields but map to lab_* columns
        mid1_marks: isLab ? (s.lab_execution_marks || '') : (s.mid1_marks || ''),
        mid2_marks: isLab ? (s.lab_theory_marks || '') : (s.mid2_marks || ''),       
        assignment_marks: isLab ? (s.lab_record_marks || '') : (s.assignment_marks || ''),
      }));      setStudents(studentsWithMarks);
      if (data.mid_max) setMidMax(data.mid_max);
      setSubjectType(detectedType);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  // Check if any marks exist to lock the format
  const hasExistingMarks = students.some(s => 
    (s.mid1_marks !== '' && s.mid1_marks !== null) || 
    (s.mid2_marks !== '' && s.mid2_marks !== null) || 
    (s.assignment_marks !== '' && s.assignment_marks !== null && s.assignment_marks !== 0)
  );

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Track viewport type for responsive sticky behavior
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

  // Measure roll column width for scroll-based toggle
  useEffect(() => {
    if (rollHeaderRef.current) {
      setRollColWidth(rollHeaderRef.current.offsetWidth || 0);
    }
  }, [students.length]);

  const handleScroll = (event) => {
    setScrollLeft(event.target.scrollLeft || 0);
  };

  const handleMarkChange = (studentId, field, value) => {
    // Basic range validation
    let numericValue = parseFloat(value);
    
    // Determine max based on subject type and pattern
    let max;
    if (subjectType === 'lab') {
      if (field === 'mid1_marks') max = 10; // Execution
      else if (field === 'mid2_marks') max = 10; // Writing
      else if (field === 'assignment_marks') max = 5; // Record
    } else {
      // Theory
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
    // Final validation loop
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save marks');
      toast.success('Marks saved successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-600">Loading students...</div>;

  // UI Helper for Labels
  const labels = subjectType === 'lab' 
    ? { m1: 'Execution', m2: 'Writing', a: 'Record', m1m: 10, m2m: 10, am: 5, total: 25 }
    : { m1: 'Mid-I', m2: 'Mid-II', a: 'Assignment', m1m: midMax, m2m: midMax, am: (midMax === 25 ? 5 : 10), total: 30 };

  return (
    <div className="border border-gray-300 rounded-md bg-white p-4 mt-6 text-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-[#0b3578] hover:underline mb-2"
          >
            &larr; Back to Subjects
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">{assignment.subject_name}</h2>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                subjectType === 'lab'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {subjectType === 'lab' ? 'Lab' : 'Theory'}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {assignment.branch} &middot; Semester {assignment.semester} &middot; {assignment.academic_year}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {assignment.is_active && subjectType === 'theory' && (
            hasExistingMarks ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[11px] font-semibold tracking-tight">Format locked ({midMax} + {midMax === 25 ? 5 : 10})</span>
              </div>
            ) : (
              <div className="bg-gray-50 px-2 py-1 rounded-md flex items-center border border-gray-200">
                <span className="text-[11px] font-semibold text-gray-600 px-2 uppercase">Pattern:</span>
                <button 
                  onClick={() => setMidMax(20)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold border ${
                    midMax === 20 ? 'bg-white text-[#0b3578] border-gray-300' : 'text-gray-500 border-transparent'
                  }`}
                >
                  20 + 10
                </button>
                <button 
                  onClick={() => setMidMax(25)}
                  className={`ml-1 px-3 py-1 rounded text-[11px] font-semibold border ${
                    midMax === 25 ? 'bg-white text-[#0b3578] border-gray-300' : 'text-gray-500 border-transparent'
                  }`}
                >
                  25 + 5
                </button>
              </div>
            )
          )}

          {subjectType === 'lab' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
               <span className="text-[11px] font-semibold uppercase tracking-tight">Lab pattern: 10 + 10 + 5</span>
            </div>
          )}

          {assignment.is_active ? (
            <button
              onClick={handleSaveMarks}
              disabled={submitting}
              className="bg-[#0b3578] text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save Marks'}
            </button>
          ) : (
            <div className="bg-gray-50 text-gray-600 px-4 py-2 rounded-md text-sm font-semibold border border-gray-200">
              View Only (Semester Ended)
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={isMobile ? handleScroll : undefined}
        className={`overflow-x-auto border border-gray-300 rounded-md ${!assignment.is_active ? 'bg-gray-50' : ''}`}
      >
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th
                ref={rollHeaderRef}
                className={`px-2 py-2 text-center text-sm font-semibold text-gray-700 uppercase ${
                  isMobile
                    ? 'sticky left-0 z-10 bg-gray-100 border-r border-gray-300 w-10 min-w-10'
                    : ''
                }`}
              >
                Roll
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase">Name</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-700 uppercase">{labels.m1} ({labels.m1m})</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-700 uppercase">{labels.m2} ({labels.m2m})</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-700 uppercase">{labels.a} ({labels.am})</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold text-[#0b3578] uppercase bg-gray-50 border-l border-gray-300">Total ({labels.total})</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => {
              const m1 = student.mid1_marks !== '' ? parseFloat(student.mid1_marks) : null;
              const m2 = student.mid2_marks !== '' ? parseFloat(student.mid2_marks) : null;
              const assgn = student.assignment_marks !== '' ? parseFloat(student.assignment_marks) : 0;
              
              let internalTotal = null;
              if (subjectType === 'lab') {
                // Lab Total = Execution + Writing + Record
                internalTotal = (m1 ?? 0) + (m2 ?? 0) + (assgn ?? 0);
              } else {
                // Theory Total = Best of Mid + Assignment
                if (m1 !== null || m2 !== null) {
                  const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
                  internalTotal = bestMid + assgn;
                }
              }

              const fullRoll = student.roll_no || '';
              let baseRoll = fullRoll;
              if (baseRoll.endsWith('L')) {
                baseRoll = baseRoll.slice(0, -1);
              }
              const shortRoll = baseRoll.slice(-2) || baseRoll;

              const showCompact = isMobile && scrollLeft > rollColWidth;

              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td
                    className={`px-2 py-2 whitespace-nowrap font-mono font-semibold text-gray-900 text-center ${
                      isMobile
                        ? 'sticky left-0 z-10 bg-white border-r border-gray-200 w-10 min-w-10'
                        : ''
                    }`}
                    title={fullRoll}
                  >
                    {/* Full roll (initial state on mobile, always on desktop) */}
                    <span
                      className={`inline-block transition-all duration-200 ease-out ${
                        isMobile
                          ? showCompact
                            ? 'opacity-0 -translate-x-2'
                            : 'opacity-100 translate-x-0'
                          : 'opacity-100 translate-x-0'
                      }`}
                    >
                      {fullRoll}
                    </span>

                    {/* Compact sticky roll (slides in on mobile after scroll) */}
                    {isMobile && (
                      <span
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out ${
                          showCompact
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 translate-x-2'
                        }`}
                      >
                        {shortRoll}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">{student.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={labels.m1m}
                      step="0.5"
                      value={student.mid1_marks}
                      onChange={(e) => handleMarkChange(student.id, 'mid1_marks', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs disabled:bg-gray-100 disabled:text-gray-500 font-semibold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={labels.m2m}
                      step="0.5"
                      value={student.mid2_marks}
                      onChange={(e) => handleMarkChange(student.id, 'mid2_marks', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs disabled:bg-gray-100 disabled:text-gray-500 font-semibold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0"
                      max={labels.am}
                      step="0.5"
                      value={student.assignment_marks}
                      onChange={(e) => handleMarkChange(student.id, 'assignment_marks', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs disabled:bg-gray-100 disabled:text-gray-500 font-semibold"
                      disabled={!assignment.is_active}
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-center bg-gray-50">
                    <span className={`font-mono text-sm font-bold ${internalTotal === null ? 'text-gray-300' : 'text-[#0b3578]'}`}>
                      {internalTotal !== null ? internalTotal.toFixed(1) : '--'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
