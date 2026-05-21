'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export default function SyllabusManager({ branch }) {
  const [syllabus, setSyllabus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState(6);
  const [editingSubject, setEditingSubject] = useState(null);

  const fetchSyllabus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clerk/hod/syllabus?semester=${selectedSem}`);
      const data = await res.json();
      if (res.ok) setSyllabus(data.data);
    } catch (e) {
      toast.error('Failed to load syllabus');
    } finally {
      setLoading(false);
    }
  }, [selectedSem]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchSyllabus();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSyllabus]);

  const handleDeleteSubject = async (code) => {
    if (!confirm('Are you sure you want to remove this subject from your branch syllabus?')) return;
    try {
      const res = await fetch('/api/clerk/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_SUBJECT', subject: { subject_code: code } })
      });
      if (res.ok) {
        toast.success('Subject removed');
        fetchSyllabus();
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      action: 'ADD_SUBJECT',
      subject: {
        subject_code: formData.get('code'),
        subject_name: formData.get('name'),
        subject_type: formData.get('type'),
        semester: selectedSem
      }
    };
    try {
      const res = await fetch('/api/clerk/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Subject saved');
        setEditingSubject(null);
        fetchSyllabus();
      }
    } catch (e) {
      toast.error('Save failed');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-[0.22em] flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center bg-blue-50 text-[#0b3578] border border-blue-100 rounded-sm text-sm">📖</span>
            Branch Syllabus
          </h3>
          <p className="text-[10px] text-slate-700 font-bold uppercase mt-1 tracking-[0.22em]">Branch: {branch}</p>
        </div>
        
        <div className="flex gap-1 bg-slate-50 border border-slate-300 p-1 rounded-sm shadow-sm">
          {[1,2,3,4,5,6,7,8].map(s => (
            <button 
              key={s} 
              onClick={() => setSelectedSem(s)}
              className={`w-10 h-10 rounded-sm font-bold text-[10px] uppercase tracking-widest transition-colors ${selectedSem === s ? 'bg-[#0b3578] text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
            >
              S{s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <button 
          onClick={() => setEditingSubject({})}
          className="w-full py-3 border border-dashed border-slate-400 rounded-sm text-slate-800 font-bold uppercase tracking-[0.22em] text-[10px] hover:border-[#0b3578]/60 hover:text-[#0b3578] transition-colors group bg-slate-50"
        >
          <span className="group-hover:scale-110 inline-block transition-transform mr-2">+</span> Add New Subject to Semester {selectedSem}
        </button>

        {loading ? (
          <div className="text-center py-16 text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse border border-slate-200 bg-white rounded-sm">
            Synchronizing Syllabus...
          </div>
        ) : (
          syllabus.map(sub => (
            <div key={sub.subject_code} className="bg-white border border-slate-300 rounded-sm overflow-hidden group hover:border-slate-400 transition-colors shadow-sm">
              <div className="p-5 flex justify-between items-start gap-4 bg-slate-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-blue-100/70 text-[#0b3578] border border-[#0b3578]/20 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                      {sub.subject_code}
                    </span>
                    <span className="text-[10px] font-bold bg-slate-200/70 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                      {sub.subject_type}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 uppercase tracking-wide leading-snug">{sub.subject_name}</h4>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingSubject(sub)} className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:text-[#0b3578] rounded-sm transition-colors text-[10px] font-bold uppercase tracking-widest">
                    Edit
                  </button>
                  <button onClick={() => handleDeleteSubject(sub.subject_code)} className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-widest">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center px-4 py-10 overflow-y-auto">
          <div className="bg-white border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 rounded-sm">
            <div className="bg-[#0b3578] p-4 text-white flex justify-between items-center border-b border-white/10">
              <h3 className="font-bold text-sm uppercase tracking-widest">Subject Registry</h3>
              <button onClick={() => setEditingSubject(null)} className="text-white/70 hover:text-white font-bold text-[10px] uppercase tracking-[0.2em]">Close</button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-6 sm:p-8 space-y-5 bg-white">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-1">Unique Subject Code</label>
                <input name="code" defaultValue={editingSubject.subject_code} required className="w-full bg-slate-50 border border-slate-200 rounded-sm p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#0b3578]/30" placeholder="e.g. PC3203CS" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-1">Full Course Name</label>
                <input name="name" defaultValue={editingSubject.subject_name} required className="w-full bg-slate-50 border border-slate-200 rounded-sm p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#0b3578]/30" placeholder="e.g. Software Engineering" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-1">Instruction Type</label>
                <select name="type" defaultValue={editingSubject.subject_type || 'theory'} className="w-full bg-slate-50 border border-slate-200 rounded-sm p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#0b3578]/30">
                  <option value="theory">Theory Course</option>
                  <option value="lab">Laboratory / Practical</option>
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-[#0b3578] text-white rounded-sm font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#0b3578]/90 transition-colors">
                Synchronize Course
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
