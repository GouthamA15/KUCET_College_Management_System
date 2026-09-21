'use client';
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import AcademicYearSelect, { getCurrentFrontendAcademicYear } from '@/components/ui/AcademicYearSelect';
import { getAssetUrl } from '@/lib/assets';
import { compressImage } from '@/lib/image-compressor';

import { ACHIEVEMENT_TYPES, ACHIEVEMENT_CONFIG } from '@/lib/achievement-config';

export default function StudentAchievementModal({ onClose, onSaveSuccess, achievement = null }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const isEditMode = !!achievement;

  const currentAcademicYear = getCurrentFrontendAcademicYear();
  const currentStartYear = parseInt(currentAcademicYear.split('-')[0], 10);
  const maxNumYears = currentStartYear - 2020 + 1;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const parseAdditional = (data) => {
    if (!data) return {};
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch(e) { return {}; }
    }
    return data;
  };

  const [form, setForm] = useState({
    achievement_type: achievement?.achievement_type || '',
    title: achievement?.title || '',
    program_name: achievement?.program_name || '',
    issuing_organization: achievement?.issuing_organization || '',
    academic_year: achievement?.academic_year || '',
    achievement_date: formatDate(achievement?.achievement_date),
    start_date: formatDate(achievement?.start_date),
    end_date: formatDate(achievement?.end_date),
    achievement_level: achievement?.achievement_level || '',
    recognition: achievement?.recognition || '',
    description: achievement?.description || '',
    certificate_base64: null,
    additional_data: parseAdditional(achievement?.additional_data)
  });

  const [previewImage, setPreviewImage] = useState(null);
  const existingImage = achievement?.certificate_file_path || null;

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const newConfig = ACHIEVEMENT_CONFIG[newType];
    
    let newForm = { ...form, achievement_type: newType };
    let newAdditional = {};
    
    if (newConfig) {
      const allFields = Object.values(newConfig.groups).flat();
      const allowedAdditional = allFields.filter(f => f.isAdditional).map(f => f.name);
      const allowedBase = allFields.filter(f => !f.isAdditional).map(f => f.name);
      
      // Keep relevant additional_data
      for (const key of allowedAdditional) {
        if (form.additional_data?.[key]) {
          newAdditional[key] = form.additional_data[key];
        }
      }
      
      // Clear irrelevant base fields to prevent submitting stale unused data
      const baseFieldsToManage = ['title', 'program_name', 'issuing_organization', 'achievement_date', 'start_date', 'end_date', 'achievement_level', 'recognition'];
      for (const key of baseFieldsToManage) {
        if (!allowedBase.includes(key)) {
          newForm[key] = '';
        }
      }
    }
    
    newForm.additional_data = newAdditional;
    setForm(newForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    let finalFile = file;

    if (file.size > 1024 * 1024) {
      const loadingToast = toast.loading('Compressing image...');
      try {
        finalFile = await compressImage(file, 1600, 1600, 0.7);
        toast.dismiss(loadingToast);
        
        if (finalFile.size > 1024 * 1024) {
             finalFile = await compressImage(finalFile, 1200, 1200, 0.5);
        }
        if (finalFile.size > 1024 * 1024) {
             toast.error('Image is still too large after compression. Please upload a smaller image.');
             return;
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error('Failed to compress image');
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target.result);
      setForm(prev => ({ ...prev, certificate_base64: event.target.result }));
    };
    reader.readAsDataURL(finalFile);
  };

  const validateForm = () => {
    if (!form.achievement_type) return 'Please select an Achievement Type';
    if (!form.academic_year) return 'Please select an Academic Year';
    
    const config = ACHIEVEMENT_CONFIG[form.achievement_type];
    if (!config) return null;
    
    for (const group of Object.values(config.groups)) {
      for (const field of group) {
        if (field.required) {
          const val = field.isAdditional ? form.additional_data[field.name] : form[field.name];
          if (!val || String(val).trim() === '') {
            return `Please fill in required field: ${field.label}`;
          }
        }
      }
    }
    
    if (!isEditMode && !form.certificate_base64) {
      return 'Please upload a certificate or supporting image';
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errorMsg = validateForm();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      const url = isEditMode ? `/api/student/achievements/${achievement.id}` : '/api/student/achievements';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Failed to save achievement');
      
      toast.success(isEditMode ? 'Achievement updated successfully' : 'Achievement saved successfully');
      
      const returnedData = json.data || json;
      const cleanData = Array.isArray(returnedData) ? returnedData[0] : returnedData;
      
      onSaveSuccess(cleanData);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field) => {
    const isAdd = field.isAdditional;
    const val = isAdd ? (form.additional_data?.[field.name] || '') : form[field.name];

    const onChange = (e) => {
      if (isAdd) {
        setForm(prev => ({
          ...prev,
          additional_data: { ...prev.additional_data, [field.name]: e.target.value }
        }));
      } else {
        setForm(prev => ({ ...prev, [field.name]: e.target.value }));
      }
    };

    const baseClasses = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white placeholder:text-gray-400";

    let inputEl = null;

    if (field.type === 'select') {
      inputEl = (
        <select name={field.name} value={val} onChange={onChange} className={baseClasses}>
          <option value="">Select...</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (field.type === 'datalist') {
      const listId = `list_${field.name}`;
      inputEl = (
        <>
          <input type="text" name={field.name} value={val} onChange={onChange} list={listId} className={baseClasses} placeholder="Type or select..." />
          <datalist id={listId}>
            {field.options?.map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      );
    } else if (field.type === 'date') {
      inputEl = <input type="date" name={field.name} value={val} onChange={onChange} className={baseClasses} />;
    } else if (field.type === 'number') {
      inputEl = <input type="number" name={field.name} value={val} onChange={onChange} className={baseClasses} placeholder={field.placeholder || ''} />;
    } else {
      inputEl = <input type="text" name={field.name} value={val} onChange={onChange} className={baseClasses} placeholder={field.placeholder || ''} />;
    }

    return (
      <div key={field.name} className={field.span === 2 ? 'md:col-span-2' : ''}>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        {inputEl}
      </div>
    );
  };

  const activeConfig = ACHIEVEMENT_CONFIG[form.achievement_type];

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <h2 className="text-lg font-bold text-gray-800">
            {isEditMode ? 'Edit Achievement' : 'Add New Achievement'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 shrink">
          <form id="achievement-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Top Base Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Achievement Type <span className="text-red-500">*</span>
                </label>
                <select name="achievement_type" value={form.achievement_type} onChange={handleTypeChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white">
                  <option value="">Select type...</option>
                  {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <AcademicYearSelect 
                  name="academic_year" 
                  value={form.academic_year} 
                  onChange={handleChange} 
                  numYears={maxNumYears}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white" 
                />
              </div>
            </div>

            {/* Dynamic Type Config Section */}
            {activeConfig && (
              <div className="space-y-6">
                {Object.entries(activeConfig.groups).map(([groupName, fields]) => (
                  <div key={groupName} className="space-y-3">
                    <h3 className="text-[10px] font-extrabold text-[#0b3578] uppercase tracking-widest border-b border-gray-100 pb-2">
                      {groupName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map(renderField)}
                    </div>
                  </div>
                ))}

                {activeConfig.hasDescription !== false && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-extrabold text-[#0b3578] uppercase tracking-widest border-b border-gray-100 pb-2">
                      {activeConfig.descLabel || 'Description'}
                    </h3>
                    <div>
                      <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Brief details about the achievement..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none resize-none placeholder:text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Upload Section */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-extrabold text-[#0b3578] uppercase tracking-widest border-b border-gray-100 pb-2">
                Document Upload
              </h3>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Certificate / Supporting Image {isEditMode ? '(Optional to change)' : <span className="text-red-500">*</span>}
                </label>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                
                {isEditMode && !previewImage && existingImage ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <img src={getAssetUrl(existingImage)} alt="Current Certificate" className="w-24 h-24 object-cover rounded-md border border-gray-300 shadow-sm" />
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm font-semibold text-gray-700 flex items-center justify-center sm:justify-start gap-1">
                        <ImageIcon className="w-4 h-4" /> Current Certificate
                      </p>
                      <p className="text-xs text-gray-500 mb-3 mt-1">This image is currently attached to your achievement. You can upload a new one to replace it.</p>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors font-medium">
                        Select New Image
                      </button>
                    </div>
                  </div>
                ) : !previewImage ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors bg-white"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Click to upload certificate</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG (Auto-compressed to &le; 1MB)</p>
                  </div>
                ) : (
                  <div className="relative rounded-lg border border-gray-200 p-2 bg-gray-50 flex items-center justify-center min-h-[160px]">
                    <img src={previewImage} alt="Certificate preview" className="max-h-48 rounded object-contain shadow-sm" />
                    <button 
                      type="button" 
                      onClick={() => { setPreviewImage(null); setForm(prev => ({...prev, certificate_base64: null})); }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {isEditMode && (
                      <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                        <span className="bg-black/60 text-white text-[10px] uppercase font-bold px-2 py-1 rounded">Replacement Image Ready</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Achievement')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
