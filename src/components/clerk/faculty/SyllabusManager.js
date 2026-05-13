'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export default function SyllabusManager({ branch }) {
  const [syllabus, setSyllabus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState(6);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);

  // Helper to safely parse JSON strings or return empty array
  const safeParse = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [data];
    } catch (e) {
      console.warn('JSON Parse Error for topics:', e, data);
      return [data]; // Return as single topic if parse fails
    }
  };

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

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      action: 'SAVE_UNIT',
      unit: {
        subject_code: editingUnit.subject_code,
        unit_order: formData.get('order'),
        unit_name: formData.get('name'),
        topics: formData.get('topics').split('\n').filter(t => t.trim())
      }
    };
    try {
      const res = await fetch('/api/clerk/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Unit details saved');
        setEditingUnit(null);
        fetchSyllabus();
      }
    } catch (e) {
      toast.error('Save failed');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 text-xl">📖</div>
            Curriculum Management
          </h3>
          <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-widest">Branch: {branch}</p>
        </div>
        
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          {[1,2,3,4,5,6,7,8].map(s => (
            <button 
              key={s} 
              onClick={() => setSelectedSem(s)}
              className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${selectedSem === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white hover:text-gray-600'}`}
            >
              S{s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <button 
          onClick={() => setEditingSubject({})}
          className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 font-black uppercase tracking-widest text-xs hover:border-indigo-300 hover:text-indigo-500 transition-all group"
        >
          <span className="group-hover:scale-110 inline-block transition-transform mr-2">+</span> Add New Subject to Semester {selectedSem}
        </button>

        {loading ? (
          <div className="text-center py-20 opacity-50 font-black text-xs uppercase animate-pulse">Synchronizing Syllabus...</div>
        ) : (
          syllabus.map(sub => (
            <div key={sub.subject_code} className="bg-white border-2 border-gray-50 rounded-3xl overflow-hidden shadow-sm group hover:border-indigo-100 transition-all">
              <div className="p-6 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">{sub.subject_code}</span>
                    <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">{sub.subject_type}</span>
                  </div>
                  <h4 className="text-lg font-black text-gray-800">{sub.subject_name}</h4>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingSubject(sub)} className="p-2 bg-gray-50 text-gray-400 hover:text-indigo-600 rounded-xl transition-colors">✏️</button>
                  <button onClick={() => handleDeleteSubject(sub.subject_code)} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-xl transition-colors">🗑️</button>
                </div>
              </div>

              <div className="px-6 pb-6 space-y-3">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Unit Details ({sub.units?.length || 0})</div>
                {sub.units?.map(u => {
                  const topics = safeParse(u.topics);
                  return (
                    <div key={u.id} className="bg-gray-50/50 rounded-2xl p-4 border border-transparent hover:border-indigo-50 hover:bg-white transition-all">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-black text-gray-700 text-sm">{u.unit_name}</h5>
                        <button onClick={() => setEditingUnit(u)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-tighter">Modify Topics</button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topics.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-[9px] font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-lg line-clamp-1">{t}</span>
                        ))}
                        {topics.length > 3 && <span className="text-[9px] font-bold text-gray-300 px-1">+{topics.length - 3} more</span>}
                      </div>
                    </div>
                  );
                })}
                <button 
                  onClick={() => setEditingUnit({ subject_code: sub.subject_code, topics: '[]', unit_order: (sub.units?.length || 0) + 1 })}
                  className="w-full py-3 bg-gray-50 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                >
                  + Add Unit to {sub.subject_code}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-black text-gray-800 uppercase tracking-tight">Subject Registry</h3>
              <button onClick={() => setEditingSubject(null)} className="text-gray-400 hover:text-gray-600 font-black">CLOSE</button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unique Subject Code</label>
                <input name="code" defaultValue={editingSubject.subject_code} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500" placeholder="e.g. PC3203CS" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Full Course Name</label>
                <input name="name" defaultValue={editingSubject.subject_name} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500" placeholder="e.g. Software Engineering" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Instruction Type</label>
                <select name="type" defaultValue={editingSubject.subject_type || 'theory'} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500">
                  <option value="theory">Theory Course</option>
                  <option value="lab">Laboratory / Practical</option>
                </select>
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                Synchronize Course
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Unit/Topic Modal */}
      {editingUnit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-black text-gray-800 uppercase tracking-tight">Modify Unit Content</h3>
              <button onClick={() => setEditingUnit(null)} className="text-gray-400 hover:text-gray-600 font-black">CLOSE</button>
            </div>
            <form onSubmit={handleSaveUnit} className="p-8 space-y-5">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Order</label>
                  <input name="order" type="number" defaultValue={editingUnit.unit_order} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500" />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unit Title</label>
                  <input name="name" defaultValue={editingUnit.unit_name} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500" placeholder="e.g. UNIT-I INTRODUCTION" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Detailed Topics (One per line)</label>
                <textarea 
                  name="topics" 
                  defaultValue={safeParse(editingUnit.topics).join('\n')} 
                  required 
                  rows={10} 
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-indigo-500 resize-none" 
                  placeholder="Enter each sub-topic on a new line..." 
                />
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                Publish Unit Data
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
