import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function SubjectModal({ isOpen, onClose, onSubmit, initialData, selectedSem }) {
  const [formData, setFormData] = useState({
    subject_code: '',
    subject_name: '',
    subject_type: 'theory',
    semester: selectedSem || 1
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData({
          subject_code: initialData.subject_code || '',
          subject_name: initialData.subject_name || '',
          subject_type: initialData.subject_type || 'theory',
          semester: initialData.semester || selectedSem || 1
        });
      } else {
        setFormData({
          subject_code: '',
          subject_name: '',
          subject_type: 'theory',
          semester: selectedSem || 1
        });
      }
    }
  }, [isOpen, initialData, selectedSem]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isEdit = !!initialData;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {isEdit ? 'Edit Subject' : 'Add Subject'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Subject Code</label>
            <input
              type="text"
              value={formData.subject_code}
              onChange={(e) => setFormData({...formData, subject_code: e.target.value.toUpperCase()})}
              disabled={isEdit}
              required
              maxLength={50}
              className="w-full text-sm p-2 border border-slate-200 rounded focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] outline-none disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="e.g. CS101"
            />
            {isEdit && <p className="text-[10px] text-slate-400 mt-1">Subject code cannot be changed.</p>}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Subject Name</label>
            <input
              type="text"
              value={formData.subject_name}
              onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
              required
              maxLength={255}
              className="w-full text-sm p-2 border border-slate-200 rounded focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] outline-none"
              placeholder="e.g. Data Structures"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Type</label>
              <select
                value={formData.subject_type}
                onChange={(e) => setFormData({...formData, subject_type: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 rounded focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] outline-none bg-white"
              >
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({...formData, semester: Number(e.target.value)})}
                className="w-full text-sm p-2 border border-slate-200 rounded focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] outline-none bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-[#0b3578] text-white text-xs font-bold uppercase tracking-widest py-2.5 rounded hover:bg-blue-900 transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Add Subject'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-widest py-2.5 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return null;
}
