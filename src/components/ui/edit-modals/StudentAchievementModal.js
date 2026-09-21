'use client';
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AcademicYearSelect, { getCurrentFrontendAcademicYear } from '@/components/ui/AcademicYearSelect';

const ACHIEVEMENT_TYPES = [
  "Certification",
  "Competition",
  "Hackathon",
  "Internship",
  "Workshop",
  "Seminar",
  "Publication",
  "Research",
  "Project",
  "Sports",
  "Cultural",
  "Leadership",
  "Volunteer",
  "Other"
];

const ACHIEVEMENT_LEVELS = [
  "College",
  "University",
  "State",
  "National",
  "International"
];

export default function StudentAchievementModal({ onClose, onSaveSuccess }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const currentAcademicYear = getCurrentFrontendAcademicYear();
  const currentStartYear = parseInt(currentAcademicYear.split('-')[0], 10);
  const maxNumYears = currentStartYear - 2020 + 1;

  const [form, setForm] = useState({
    achievement_type: '',
    title: '',
    program_name: '',
    issuing_organization: '',
    academic_year: '',
    achievement_date: '',
    start_date: '',
    end_date: '',
    achievement_level: '',
    recognition: '',
    description: '',
    certificate_base64: null,
    additional_data: {}
  });

  const [previewImage, setPreviewImage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target.result);
      setForm(prev => ({ ...prev, certificate_base64: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.achievement_type || !form.title || !form.academic_year || !form.achievement_level || !form.certificate_base64) {
      toast.error('Please fill in all required fields and upload a certificate');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Achievement saved successfully!');
        onSaveSuccess(json.data || json);
        onClose();
      } else {
        toast.error(json.error || 'Failed to save achievement');
      }
    } catch (_err) {
      toast.error('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const needsDateRange = ['Internship', 'Project', 'Research'].includes(form.achievement_type);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-[#0b3578]">Add Achievement</h2>
          <button onClick={onClose} disabled={loading} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <form id="achievement-form" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Achievement Type *</label>
                <select name="achievement_type" value={form.achievement_type} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white">
                  <option value="">Select Type</option>
                  {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Academic Year *</label>
                <AcademicYearSelect 
                  name="academic_year" 
                  value={form.academic_year} 
                  onChange={handleChange} 
                  required
                  numYears={Math.max(1, maxNumYears)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. 1st Prize in Hackathon"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Program / Event Name</label>
                <input type="text" name="program_name" value={form.program_name} onChange={handleChange} placeholder="e.g. TechFest 2026"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Organizing Institution</label>
                <input type="text" name="issuing_organization" value={form.issuing_organization} onChange={handleChange} placeholder="e.g. Kakatiya University"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Level *</label>
                <select name="achievement_level" value={form.achievement_level} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white">
                  <option value="">Select Level</option>
                  {ACHIEVEMENT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Recognition / Result</label>
                <input type="text" name="recognition" value={form.recognition} onChange={handleChange} placeholder="e.g. Winner, Top 10"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
              </div>
            </div>

            {needsDateRange ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Achievement Date</label>
                <input type="date" name="achievement_date" value={form.achievement_date} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none md:w-1/2" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Brief details about the achievement..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Certificate Image *</label>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              
              {!previewImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Click to upload certificate</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</p>
                </div>
              ) : (
                <div className="relative rounded-lg border border-gray-200 p-2 bg-gray-50 flex items-center justify-center min-h-[160px]">
                  <img src={previewImage} alt="Certificate preview" className="max-h-48 rounded object-contain" />
                  <button 
                    type="button" 
                    onClick={() => { setPreviewImage(null); setForm(prev => ({...prev, certificate_base64: null})); }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

          </form>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" form="achievement-form" disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-[#0b3578] hover:bg-[#0f449a] transition-colors flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Saving...' : 'Save Achievement'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

