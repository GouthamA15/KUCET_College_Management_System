import { useState, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

export default function SlotEditorModal({
  instanceId,
  instance, // { branch, year_level, semester, section, academic_year }
  editingSlot, // { day, period, current: slot or null }
  onClose,
  onSaved,
  isEditable = true,
  entries = []
}) {
  const { hodBranchData } = useStaff();
  const [isSaving, setIsSaving] = useState(false);
  const [modalSelectedSubject, setModalSelectedSubject] = useState(editingSlot?.current?.subject_code || '');
  const formRef = useRef(null);
  
  const branchSubjects = useMemo(() => {
    const subjects = hodBranchData?.allSubjects || [];
    const seen = new Set();
    return subjects
      .filter(s => s.semester === instance.semester && s.branch === instance.branch)
      .filter(s => {
        if (seen.has(s.subject_code)) return false;
        seen.add(s.subject_code);
        return true;
      });
  }, [hodBranchData?.allSubjects, instance]);
  
  const collegeFaculty = useMemo(() => hodBranchData?.faculty || [], [hodBranchData?.faculty]);
  const officialAssignments = hodBranchData?.officialAssignments || [];
  
  const handleCopyPrevious = () => {
    if (!editingSlot || editingSlot.period === 1) return;
    const prevSlot = entries.find(
      s => s.day_of_week === editingSlot.day && s.period_number === editingSlot.period - 1
    );
    if (!prevSlot) return toast.error('No data found in the previous period to copy.');
    if (!formRef.current) return;
    const form = formRef.current;
    form.subject_code.value = prevSlot.subject_code || '';
    form.faculty_id.value = prevSlot.faculty_id || '';
    form.room_no.value = prevSlot.room_no || '';
    setModalSelectedSubject(prevSlot.subject_code || '');
    toast.success('Details copied from previous period');
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!isEditable) return;
    const formData = new FormData(e.target);
    const subject_code = formData.get('subject_code');
    const faculty_id_str = formData.get('faculty_id');
    const faculty_id = faculty_id_str ? parseInt(faculty_id_str) : null;
    const room_no = formData.get('room_no');

    if (!subject_code) return toast.error('Please select a subject or activity');
    setIsSaving(true);
    
    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: editingSlot.day,
          period_number: editingSlot.period,
          subject_code,
          faculty_id,
          room_no
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Slot updated`);
        onSaved();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editingSlot?.current) return;
    if (!isEditable) return;
    if (!confirm('Are you sure you want to delete this lecture from the timetable?')) return;
    
    setIsSaving(true);
    try {
      const entryId = editingSlot.current.id;
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}/entries?entryId=${entryId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Lecture removed');
        onSaved();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Deletion failed');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center px-4 py-10 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md animate-in zoom-in-95 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)]">
        <div className="p-5 flex justify-between items-start border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-lg text-slate-800">Update Academic Schedule</h3>
            <p className="text-slate-500 text-sm mt-0.5">Sem {instance?.semester} &bull; {editingSlot.day} &bull; Period {editingSlot.period}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSaveSlot} className="p-6 space-y-5 flex-1 overflow-y-auto">
          {editingSlot.period > 1 && isEditable && (
            <button 
              type="button" 
              onClick={handleCopyPrevious}
              className="w-full py-2.5 bg-blue-50/50 text-blue-700 text-sm font-medium rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
              Copy details from Period {editingSlot.period - 1}
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject / Activity</label>
            <select 
              name="subject_code" 
              defaultValue={editingSlot.current?.subject_code || ''} 
              onChange={(e) => setModalSelectedSubject(e.target.value)}
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 outline-none focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50"
            >
              <option value="" disabled>Select a subject...</option>
              <optgroup label={`Core Syllabus (Sem ${instance?.semester})`}>
                {branchSubjects.map(s => (
                  <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                ))}
              </optgroup>
              <optgroup label="Institutional Activities">
                {INSTITUTIONAL_ACTIVITIES.map(a => (
                  <option key={a.code} value={a.code}>{a.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assigned Faculty</label>
            <select 
              name="faculty_id" 
              defaultValue={editingSlot.current?.faculty_id || ''} 
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 outline-none focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50"
            >
              <option value="">No faculty assigned</option>
              
              {modalSelectedSubject && (
                <optgroup label="Officially Assigned">
                  {collegeFaculty
                    .filter(f => officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                    .map(f => (
                      <option key={`assigned-${f.id}`} value={f.id} className="font-semibold text-blue-700 bg-blue-50/50">
                        ★ {f.name} (Primary Instructor)
                      </option>
                    ))
                  }
                </optgroup>
              )}

              <optgroup label="All Faculty">
                {collegeFaculty
                  .filter(f => !modalSelectedSubject || !officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.home_branch ? `(${f.home_branch})` : ''}
                    </option>
                  ))
                }
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Room / Location</label>
            <input 
              name="room_no" 
              type="text" 
              placeholder="e.g. LH-113" 
              defaultValue={editingSlot.current?.room_no || ''} 
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 outline-none focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50" 
            />
          </div>

          {isEditable && (
            <div className="flex gap-3 pt-2">
              {editingSlot.current && (
                <button 
                  type="button" 
                  onClick={handleDeleteSlot}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-white text-red-600 font-medium rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50 border border-red-200 shadow-sm"
                >
                  Remove
                </button>
              )}
              <button type="submit" disabled={isSaving} className={`${editingSlot.current ? 'flex-[2]' : 'w-full'} py-2.5 bg-[#0b3578] text-white font-medium rounded-lg text-sm hover:bg-blue-900 transition-colors disabled:opacity-70 shadow-sm`}>
                {isSaving ? 'Saving...' : 'Save Class Slot'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
