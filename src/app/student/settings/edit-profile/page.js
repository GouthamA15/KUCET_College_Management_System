// src/app/student/settings/edit-profile/page.js
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';

export default function EditProfilePage() {
  const router = useRouter();
  const { studentData, loading: contextLoading, refreshData } = useStudent();
  
  const [formData, setFormData] = useState({
    student: {},
    personal: {},
    academic: {}
  });
  const [originalData, setOriginalData] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);
  
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [currentPfp, setCurrentPfp] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [currentSignature, setCurrentSignature] = useState(null);
  const [proofDataUrl, setProofDataUrl] = useState(null);
  const [latestRequest, setLatestRequest] = useState(null);

  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const proofInputRef = useRef(null);
  const menuRef = useRef(null);
  const editBtnRef = useRef(null);

  const displayedPhoto = pfpDataUrl || currentPfp || null;
  const displayedSignature = signatureDataUrl || currentSignature;

  useEffect(() => {
    fetchProfileData();
  }, []);

  async function fetchProfileData() {
    try {
      const res = await fetch('/api/student/signature');
      if (res.ok) {
        const data = await res.json();
        setCurrentSignature(data.signature);
        setCurrentPfp(data.pfp);
        setLatestRequest(data.latestRequest);
        
        if (data.details) {
          setFormData(data.details);
          setOriginalData(JSON.parse(JSON.stringify(data.details)));
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    } finally {
      setProfileDataLoaded(true);
    }
  }

  // Close photo menu when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (!photoMenuOpen) return;
      const t = e.target;
      if (menuRef.current && menuRef.current.contains(t)) return;
      if (editBtnRef.current && editBtnRef.current.contains(t)) return;
      setPhotoMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [photoMenuOpen]);

  const getChangedData = () => {
    if (!originalData) return null;
    const changes = {};
    
    ['mobile', 'email'].forEach(field => {
        if (formData.student[field] !== originalData.student[field]) {
            changes[field] = formData.student[field];
        }
    });

    const spd_fields = ['father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','guardian_mobile','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks','blood_group'];
    spd_fields.forEach(field => {
        if (formData.personal[field] !== originalData.personal[field]) {
            changes[field] = formData.personal[field];
        }
    });

    const sab_fields = ['qualifying_exam','previous_college_details','medium_of_instruction','ranks','ssc_marks','inter_marks'];
    sab_fields.forEach(field => {
        if (formData.academic[field] !== originalData.academic[field]) {
            changes[field] = formData.academic[field];
        }
    });

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const onSave = async () => {
    if (latestRequest && latestRequest.status === 'pending') {
        toast.error('A pending request is already under review.');
        return;
    }

    const changedData = getChangedData();
    if (!changedData && !pfpDataUrl && !signatureDataUrl) {
        toast.error('No modifications detected.');
        return;
    }

    if (changedData && !proofDataUrl) {
        toast.error('Verification proof is mandatory for data updates.');
        return;
    }

    setSaving(true);
    const toastId = toast.loading('Transmitting request to administrative office...');

    try {
        const res = await fetch('/api/student/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signature: signatureDataUrl || null,
            pfp: pfpDataUrl || null,
            data: changedData,
            proof: proofDataUrl || null
          })
        });
        
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Submission failed');
        
        setPfpDataUrl(null);
        setSignatureDataUrl(null);
        setProofDataUrl(null);
        toast.success('Official update request submitted successfully.', { id: toastId });
        await fetchProfileData();
    } catch (e) {
      toast.error(e.message || 'System error occurred.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const onFileSelect = (file, type) => {
    if (latestRequest && latestRequest.status === 'pending') {
      toast.error('Pending request exists. System locked.');
      return;
    }

    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('File format rejected. Use JPG/PNG.');
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File exceeds 1MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'pfp') setPfpDataUrl(reader.result);
        else if (type === 'sig') setSignatureDataUrl(reader.result);
        else if (type === 'proof') setProofDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
    if (type === 'pfp') setPhotoMenuOpen(false);
  };

  const updateField = (section, field, value) => {
    setFormData(prev => ({
        ...prev,
        [section]: {
            ...prev[section],
            [field]: value
        }
    }));
  };

  if (!studentData && contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 font-bold uppercase tracking-widest text-xs">
        Loading Institutional Records...
      </div>
    );
  }

  const changedData = getChangedData();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-[#0b3578] px-6 py-4 border-b border-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight">Record Modification Portal</h1>
            <p className="text-blue-100 text-sm mt-1">Official Student Data Management System</p>
          </div>
          {latestRequest && (
            <div className={`px-4 py-1.5 border rounded-sm text-[10px] font-black uppercase tracking-widest ${
              latestRequest.status === 'pending' ? 'bg-blue-900/50 text-white border-blue-400 animate-pulse' : 
              latestRequest.status === 'rejected' ? 'bg-rose-900/50 text-white border-rose-400' : 'hidden'
            }`}>
              {latestRequest.status === 'pending' ? '● Application Under Review' : '● Modification Rejected'}
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
            
            {/* Identity Assets Sidebar */}
            <aside className="space-y-10">
              <div className="text-center">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Identification Photo</span>
                <div className="relative inline-block">
                  <div className={`w-48 h-48 border-2 ${pfpDataUrl ? 'border-[#0b3578]' : 'border-slate-200'} bg-slate-50 overflow-hidden flex items-center justify-center`}>
                    {displayedPhoto ? (
                      <Image src={displayedPhoto} alt="Profile" width={192} height={192} unoptimized className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-slate-300 font-bold uppercase text-[9px]">No Record Found</span>
                    )}
                  </div>
                  <button 
                    ref={editBtnRef}
                    onClick={() => setPhotoMenuOpen(!photoMenuOpen)}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#0b3578] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-900 transition-all z-20 border-2 border-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                  {photoMenuOpen && (
                    <div ref={menuRef} className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white shadow-xl border border-slate-200 w-44 z-30 py-1 rounded-sm">
                      <button onClick={() => fileInputRef.current.click()} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-[11px] font-bold uppercase tracking-wide">
                        Upload New Image
                      </button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'pfp')} />
                </div>
                {pfpDataUrl && <span className="block text-[9px] font-black text-[#0b3578] uppercase mt-2">New Image Staged</span>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Signature Record</label>
                <div className={`w-full h-20 border-2 ${signatureDataUrl ? 'border-[#0b3578] bg-blue-50/20' : 'border-dashed border-slate-200 bg-slate-50'} flex items-center justify-center relative group overflow-hidden`}>
                  {displayedSignature ? (
                    <Image src={displayedSignature} alt="Signature" width={200} height={80} unoptimized className="object-contain w-full h-full p-2" />
                  ) : <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Unrecorded</span>}
                  <button onClick={() => signatureInputRef.current.click()} className="absolute inset-0 bg-[#0b3578]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">Update Signature</button>
                </div>
                {signatureDataUrl && <span className="block text-[9px] font-black text-[#0b3578] uppercase text-center italic">New Signature Staged</span>}
                <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'sig')} />
              </div>

              {latestRequest && latestRequest.status === 'rejected' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-sm">
                  <h3 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-2">Rejection Analysis</h3>
                  <p className="text-[11px] text-rose-800 leading-relaxed italic font-medium">&quot;{latestRequest.rejection_reason}&quot;</p>
                </div>
              )}
            </aside>

            {/* Modification Form */}
            <div className="space-y-12">
              
              {/* 1. System Identity */}
              <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-6">Core Identification</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Permanent Roll No</label>
                    <input value={formData.student.roll_no || ''} disabled className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed uppercase" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Registered Name</label>
                    <input value={formData.student.name || ''} disabled className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed uppercase" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Mobile</label>
                    <input 
                      value={formData.student.mobile || ''} 
                      onChange={(e) => updateField('student', 'mobile', e.target.value)}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.student.mobile !== originalData?.student.mobile ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Email Address</label>
                    <input 
                      value={formData.student.email || ''} 
                      onChange={(e) => updateField('student', 'email', e.target.value)}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.student.email !== originalData?.student.email ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                  </div>
                </div>
              </section>

              {/* 2. Personal Records */}
              <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-6">Personal Demographic Records</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Father Name', field: 'father_name' },
                    { label: 'Mother Name', field: 'mother_name' },
                    { label: 'Nationality', field: 'nationality' },
                    { label: 'Religion', field: 'religion' },
                    { label: 'Category', field: 'category', type: 'select', options: COLLEGE_CONFIG.categories },
                    { label: 'Sub Caste', field: 'sub_caste' },
                    { label: 'Area Status', field: 'area_status', type: 'select', options: ['Local', 'Non-Local'] },
                    { label: 'Mother Tongue', field: 'mother_tongue' },
                    { label: 'Place of Birth', field: 'place_of_birth' },
                    { label: 'Father Occupation', field: 'father_occupation' },
                    { label: 'Guardian Mobile', field: 'guardian_mobile' },
                    { label: 'Annual Income', field: 'annual_income' },
                    { label: 'Aadhaar Card No', field: 'aadhaar_no' },
                    { label: 'Allotted Category', field: 'seat_allotted_category' },
                    { label: 'Blood Group', field: 'blood_group', type: 'select', options: COLLEGE_CONFIG.bloodGroups }
                  ].map((item) => (
                    <div key={item.field} className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</label>
                      {item.type === 'select' ? (
                        <select 
                          value={formData.personal[item.field] || ''}
                          onChange={(e) => updateField('personal', item.field, e.target.value)}
                          className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal[item.field] !== originalData?.personal[item.field] ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                        >
                          <option value="">SELECT {item.label.toUpperCase()}</option>
                          {item.options.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                        </select>
                      ) : (
                        <input 
                          value={formData.personal[item.field] || ''}
                          onChange={(e) => updateField('personal', item.field, e.target.value)}
                          className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal[item.field] !== originalData?.personal[item.field] ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                        />
                      )}
                    </div>
                  ))}
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Permanent Mailing Address</label>
                    <textarea 
                      value={formData.personal.address || ''}
                      onChange={(e) => updateField('personal', 'address', e.target.value)}
                      rows={3}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.address !== originalData?.personal.address ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Identification Marks</label>
                    <textarea 
                      value={formData.personal.identification_marks || ''}
                      onChange={(e) => updateField('personal', 'identification_marks', e.target.value)}
                      rows={2}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.identification_marks !== originalData?.personal.identification_marks ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                  </div>
                </div>
              </section>

              {/* 3. Academic Background */}
              <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-6">Prior Academic Background</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Qualifying Exam', field: 'qualifying_exam' },
                    { label: 'Medium of Instruction', field: 'medium_of_instruction' },
                    { label: 'State/National Rank', field: 'ranks' },
                    { label: 'SSC Score (%)', field: 'ssc_marks' },
                    { label: 'Inter/Diploma Score (%)', field: 'inter_marks' }
                  ].map((item) => (
                    <div key={item.field} className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</label>
                      <input 
                        value={formData.academic[item.field] || ''}
                        onChange={(e) => updateField('academic', item.field, e.target.value)}
                        className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.academic[item.field] !== originalData?.academic[item.field] ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                      />
                    </div>
                  ))}
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Educational Institution</label>
                    <textarea 
                      value={formData.academic.previous_college_details || ''}
                      onChange={(e) => updateField('academic', 'previous_college_details', e.target.value)}
                      rows={2}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.academic.previous_college_details !== originalData?.academic.previous_college_details ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                  </div>
                </div>
              </section>

              {/* Verification Evidence */}
              <section className="bg-slate-50 border border-slate-200 p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Verification Evidence Submission</h2>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic uppercase tracking-wider">
                  Provide a high-resolution scan of your Aadhaar card or Government ID to validate the modification requests initiated above.
                </p>
                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className={`w-full md:w-80 aspect-video border-2 ${proofDataUrl ? 'border-[#0b3578] bg-white' : 'border-dashed border-slate-300 bg-white'} flex items-center justify-center relative group overflow-hidden`}>
                    {proofDataUrl ? (
                      <Image src={proofDataUrl} alt="Proof" width={320} height={180} unoptimized className="object-contain w-full h-full p-1" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl opacity-20">📄</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Pending Upload</span>
                      </div>
                    )}
                    <button onClick={() => proofInputRef.current.click()} className="absolute inset-0 bg-[#0b3578]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black uppercase tracking-widest">Select Evidence File</button>
                  </div>
                  <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'proof')} />
                  
                  <div className="flex-1 space-y-4">
                    {changedData && !proofDataUrl && (
                      <div className="px-4 py-2 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-widest leading-none">
                        Error: Substantiating evidence is required for data modifications.
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      SYSTEM SPECIFICATIONS: MAX FILE SIZE 1MB. AUTHORIZED FORMATS: JPG, PNG. ENSURE LEGIBILITY FOR AUDIT PURPOSES.
                    </p>
                  </div>
                </div>
              </section>

              {/* Form Actions */}
              <div className="pt-8 flex flex-col-reverse md:flex-row items-center justify-end gap-4 border-t border-slate-200">
                <button 
                  onClick={() => router.back()} 
                  className="w-full md:w-auto px-8 py-3 bg-slate-100 text-slate-600 font-bold uppercase tracking-widest hover:bg-slate-200 transition-all text-[10px]"
                >
                  Dismiss Changes
                </button>
                <button 
                  disabled={saving || (!changedData && !pfpDataUrl && !signatureDataUrl)} 
                  onClick={onSave}
                  className="w-full md:w-auto px-10 py-3 bg-[#0b3578] text-white font-bold uppercase tracking-widest hover:bg-blue-900 disabled:opacity-30 disabled:grayscale transition-all text-[10px] shadow-md"
                >
                  {saving ? 'Processing Application...' : 'Authenticate & Submit Modification Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
