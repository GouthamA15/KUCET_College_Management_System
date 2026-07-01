// src/app/student/settings/edit-profile/page.js
'use client';

import { useEffect, useState, _useCallback, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getAssetUrl } from '@/lib/assets';

export default function EditProfilePage() {
  const router = useRouter();
  const { studentData, loading: contextLoading, _refreshData } = useStudent();
  
  const [formData, setFormData] = useState({
    student: { /* empty */ },
    personal: { /* empty */ },
    academic: { /* empty */ }
  });
  const [originalData, setOriginalData] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [_profileDataLoaded, setProfileDataLoaded] = useState(false);
  
  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

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

  const displayedPhoto = pfpDataUrl || getAssetUrl(currentPfp) || null;
  const displayedSignature = signatureDataUrl || getAssetUrl(currentSignature);

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
          setEmailVerified(false); // Reset verified state on fresh fetch
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

  // OTP Functions
  const sendOtp = async () => {
    const newEmail = formData.student.email;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        toast.error('Enter a valid email address first.');
        return;
    }
    
    setVerifying(true);
    const tid = toast.loading('Transmitting OTP to new address...');
    try {
        const res = await fetch('/api/student/send-update-email-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newEmail })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to send OTP');
        
        setOtpEmail(newEmail);
        setShowOtpModal(true);
        toast.success('Verification code dispatched.', { id: tid });
    } catch (e) {
        toast.error(e.message, { id: tid });
    } finally {
        setVerifying(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
        toast.error('Verification code must be 6 digits.');
        return;
    }
    setVerifying(true);
    const tid = toast.loading('Validating credentials...');
    try {
        const res = await fetch('/api/student/verify-update-email-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: otpEmail, otp })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Invalid code');

        setEmailVerified(true);
        setShowOtpModal(false);
        setOtp('');
        toast.success('Institutional email verified successfully.', { id: tid });
        
        // Note: Do NOT update originalData here - only update it after successful save
        // Keep verified email in transient state for validation
    } catch (e) {
        toast.error(e.message, { id: tid });
    } finally {
        setVerifying(false);
    }
  };

  const getChangedData = () => {
    if (!originalData) return null;
    const changes = { /* empty */ };
    
    ['mobile', 'email'].forEach(field => {
        if (formData.student[field] !== originalData.student[field]) {
            changes[field] = formData.student[field];
        }
    });

    const spd_fields = [
      'father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','guardian_mobile','annual_income','aadhaar_no',
      'curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode', 'curr_country',
      'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode', 'perm_country',
      'is_current_same_as_permanent',
      'seat_allotted_category','identification_marks','blood_group'
    ];
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

    // Input Validations
    if (changedData) {
        // Email Verification Check
        if (changedData.email && !emailVerified) {
            toast.error('Please verify your new email address via OTP first.');
            return;
        }

        // Mobile & Email
        if (changedData.mobile && !/^\d{10}$/.test(changedData.mobile)) {
            toast.error('Mobile number must be exactly 10 digits.');
            return;
        }

        // Personal Details
        const nameRegex = /^[a-zA-Z\s]*$/;
        if (changedData.father_name) {
            if (!nameRegex.test(changedData.father_name)) { toast.error('Father name can only contain letters.'); return; }
            if (changedData.father_name.length > 50) { toast.error('Father name too long.'); return; }
        }
        if (changedData.mother_name) {
            if (!nameRegex.test(changedData.mother_name)) { toast.error('Mother name can only contain letters.'); return; }
            if (changedData.mother_name.length > 50) { toast.error('Mother name too long.'); return; }
        }
        if (changedData.aadhaar_no && !/^\d{12}$/.test(changedData.aadhaar_no)) {
            toast.error('Aadhaar number must be exactly 12 digits.');
            return;
        }
        if (changedData.guardian_mobile && !/^\d{10}$/.test(changedData.guardian_mobile)) {
            toast.error('Guardian mobile must be 10 digits.');
            return;
        }
        const addressFields = [
            'curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode', 'curr_country',
            'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode', 'perm_country'
        ];
        for (const f of addressFields) {
            if (changedData[f] && changedData[f].length > 255) {
                toast.error(`Address field too long (max 255 chars).`);
                return;
            }
        }
        if (changedData.identification_marks && changedData.identification_marks.length > 200) {
            toast.error('Identification marks too long (max 200 chars).');
            return;
        }

        // Academic Details
        const marksRegex = /^\d{1,3}(\.\d{1,2})?$/;
        if (changedData.ssc_marks && (!marksRegex.test(changedData.ssc_marks) || parseFloat(changedData.ssc_marks) > 100)) {
            toast.error('Invalid SSC Score (max 100%).');
            return;
        }
        if (changedData.inter_marks && (!marksRegex.test(changedData.inter_marks) || parseFloat(changedData.inter_marks) > 100)) {
            toast.error('Invalid Inter Score (max 100%).');
            return;
        }
    }

    // Determine if proof is needed
    // Email and Mobile are exempt from document proof requirement
    let needsProof = false;
    if (changedData) {
        const sensitiveFields = Object.keys(changedData).filter(k => k !== 'email' && k !== 'mobile');
        if (sensitiveFields.length > 0) needsProof = true;
    }

    if (needsProof && !proofDataUrl) {
        toast.error('Verification proof is mandatory for these data updates.');
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

  const onFileSelect = async (file, type) => {
    if (latestRequest && latestRequest.status === 'pending') {
      toast.error('Pending request exists. System locked.');
      return;
    }

    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        toast.error('File format rejected. Use JPG/PNG/WEBP.');
        return;
      }

      let processedFile = file;
      try {
        const { compressImage } = await import('@/lib/image-compressor');
        processedFile = await compressImage(file, 1200, 1200, 0.6);
      } catch (err) {
        console.error('Image compression failed:', err);
      }

      if (processedFile.size > 1 * 1024 * 1024) {
        toast.error('File exceeds 1MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'pfp') setPfpDataUrl(reader.result);
        else if (type === 'sig') setSignatureDataUrl(reader.result);
        else if (type === 'proof') setProofDataUrl(reader.result);
      };
      reader.readAsDataURL(processedFile);
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

  const handleCheckboxChange = (checked) => {
    setFormData(prev => {
      const personal = { 
        ...prev.personal, 
        is_current_same_as_permanent: checked 
      };
      if (checked) {
        personal.perm_house_no = prev.personal.curr_house_no || '';
        personal.perm_street = prev.personal.curr_street || '';
        personal.perm_apartment = prev.personal.curr_apartment || '';
        personal.perm_city = prev.personal.curr_city || '';
        personal.perm_state = prev.personal.curr_state || '';
        personal.perm_pincode = prev.personal.curr_pincode || '';
        personal.perm_country = prev.personal.curr_country || 'India';
      }
      return { ...prev, personal };
    });
  };

  const handleAddressChange = (field, value) => {
    setFormData(prev => {
      const personal = { 
        ...prev.personal, 
        [field]: value 
      };
      if (prev.personal.is_current_same_as_permanent && field.startsWith('curr_')) {
        const permField = field.replace('curr_', 'perm_');
        personal[permField] = value;
      }
      return { ...prev, personal };
    });
  };

  if (!studentData && contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 font-bold uppercase tracking-widest text-xs">
        Loading Institutional Records...
      </div>
    );
  }

  const changedData = getChangedData();

  // Determine if proof is needed
  // Email and Mobile are exempt from document proof requirement
  let needsProof = false;
  if (changedData) {
      const sensitiveFields = Object.keys(changedData).filter(k => k !== 'email' && k !== 'mobile');
      if (sensitiveFields.length > 0) needsProof = true;
  }

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
                      <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={displayedPhoto} alt="Profile" width={192} height={192} unoptimized className="object-cover w-full h-full" />
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
                    <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={displayedSignature} alt="Signature" width={200} height={80} unoptimized className="object-contain w-full h-full p-2" />
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Mobile (Direct Update)</label>
                    <input 
                      value={formData.student.mobile || ''} 
                      onChange={(e) => updateField('student', 'mobile', e.target.value)}
                      maxLength={10}
                      placeholder="ENTER 10 DIGIT MOBILE"
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.student.mobile !== originalData?.student.mobile ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                    />
                    {formData.student.mobile !== originalData?.student.mobile && (
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter italic">Proof not required for mobile update</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Email Address</label>
                    <div className="relative group">
                      <input 
                        value={formData.student.email || ''} 
                        onChange={(e) => {
                            updateField('student', 'email', e.target.value);
                            setEmailVerified(false);
                        }}
                        maxLength={100}
                        disabled={emailVerified}
                        placeholder="ENTER INSTITUTIONAL EMAIL"
                        className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all pr-24 ${emailVerified ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : formData.student.email !== originalData?.student.email ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                      />
                      {formData.student.email !== originalData?.student.email && !emailVerified && (
                        <button 
                          onClick={sendOtp}
                          disabled={verifying}
                          className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-[#0b3578] text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-900 transition-colors disabled:opacity-50"
                        >
                          {verifying ? '...' : 'Verify Email'}
                        </button>
                      )}
                      {emailVerified && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                          <span className="text-emerald-500 text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Personal Records */}
              <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-6">Personal Demographic Records</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Father Name', field: 'father_name', maxLength: 50 },
                    { label: 'Mother Name', field: 'mother_name', maxLength: 50 },
                    { label: 'Nationality', field: 'nationality', maxLength: 30 },
                    { label: 'Religion', field: 'religion', type: 'select', options: COLLEGE_CONFIG.religions },
                    { label: 'Category', field: 'category', type: 'select', options: COLLEGE_CONFIG.categories },
                    { label: 'Sub Caste', field: 'sub_caste', maxLength: 50 },
                    { label: 'Area Status', field: 'area_status', type: 'select', options: ['Local', 'Non-Local'] },
                    { label: 'Mother Tongue', field: 'mother_tongue', maxLength: 30 },
                    { label: 'Place of Birth', field: 'place_of_birth', maxLength: 100 },
                    { label: 'Father Occupation', field: 'father_occupation', maxLength: 100 },
                    { label: 'Guardian Mobile', field: 'guardian_mobile', maxLength: 10 },
                    { label: 'Annual Income', field: 'annual_income', type: 'select', options: COLLEGE_CONFIG.incomeRanges },
                    { label: 'Aadhaar Card No', field: 'aadhaar_no', maxLength: 12 },
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
                          maxLength={item.maxLength}
                          className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal[item.field] !== originalData?.personal[item.field] ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}
                        />
                      )}
                    </div>
                  ))}
                  {/* Current Address */}
                  <div className="md:col-span-3 border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-sm font-bold text-indigo-900 mb-2 uppercase tracking-wider">Current Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">House No</label>
                        <input placeholder="House No*" value={formData.personal.curr_house_no || ''} onChange={e => handleAddressChange('curr_house_no', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_house_no !== originalData?.personal?.curr_house_no ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apartment / Landmark</label>
                        <input placeholder="Apartment / Landmark" value={formData.personal.curr_apartment || ''} onChange={e => handleAddressChange('curr_apartment', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_apartment !== originalData?.personal?.curr_apartment ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Street</label>
                        <input placeholder="Street*" value={formData.personal.curr_street || ''} onChange={e => handleAddressChange('curr_street', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_street !== originalData?.personal?.curr_street ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</label>
                        <input placeholder="City*" value={formData.personal.curr_city || ''} onChange={e => handleAddressChange('curr_city', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_city !== originalData?.personal?.curr_city ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State</label>
                        <input placeholder="State*" value={formData.personal.curr_state || ''} onChange={e => handleAddressChange('curr_state', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_state !== originalData?.personal?.curr_state ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN Code</label>
                        <input placeholder="PIN Code*" value={formData.personal.curr_pincode || ''} onChange={e => handleAddressChange('curr_pincode', e.target.value.replace(/\D/g, ''))} maxLength={6} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_pincode !== originalData?.personal?.curr_pincode ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Country</label>
                        <input placeholder="Country*" value={formData.personal.curr_country || ''} onChange={e => handleAddressChange('curr_country', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.curr_country !== originalData?.personal?.curr_country ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                      </div>
                    </div>
                  </div>

                  {/* Sync Checkbox */}
                  <div className="md:col-span-3 flex items-center gap-2 py-2">
                    <input 
                      type="checkbox" 
                      id="student_is_current_same_as_permanent" 
                      checked={!!formData.personal.is_current_same_as_permanent} 
                      onChange={e => handleCheckboxChange(e.target.checked)} 
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" 
                    />
                    <label htmlFor="student_is_current_same_as_permanent" className="text-sm font-bold text-gray-700 select-none cursor-pointer">
                      Mark as permanent address
                    </label>
                  </div>

                  {/* Permanent Address */}
                  <div className="md:col-span-3 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-bold text-indigo-900 mb-2 uppercase tracking-wider">Permanent Address</h4>
                    {!formData.personal.is_current_same_as_permanent ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">House No</label>
                          <input placeholder="House No*" value={formData.personal.perm_house_no || ''} onChange={e => updateField('personal', 'perm_house_no', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_house_no !== originalData?.personal?.perm_house_no ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apartment / Landmark</label>
                          <input placeholder="Apartment / Landmark" value={formData.personal.perm_apartment || ''} onChange={e => updateField('personal', 'perm_apartment', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_apartment !== originalData?.personal?.perm_apartment ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Street</label>
                          <input placeholder="Street*" value={formData.personal.perm_street || ''} onChange={e => updateField('personal', 'perm_street', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_street !== originalData?.personal?.perm_street ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</label>
                          <input placeholder="City*" value={formData.personal.perm_city || ''} onChange={e => updateField('personal', 'perm_city', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_city !== originalData?.personal?.perm_city ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State</label>
                          <input placeholder="State*" value={formData.personal.perm_state || ''} onChange={e => updateField('personal', 'perm_state', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_state !== originalData?.personal?.perm_state ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN Code</label>
                          <input placeholder="PIN Code*" value={formData.personal.perm_pincode || ''} onChange={e => updateField('personal', 'perm_pincode', e.target.value.replace(/\D/g, ''))} maxLength={6} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_pincode !== originalData?.personal?.perm_pincode ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Country</label>
                          <input placeholder="Country*" value={formData.personal.perm_country || ''} onChange={e => updateField('personal', 'perm_country', e.target.value)} className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.personal.perm_country !== originalData?.personal?.perm_country ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 p-3 rounded uppercase tracking-wide">
                        Permanent address is synchronized with current address.
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Identification Marks</label>
                    <textarea 
                      value={formData.personal.identification_marks || ''}
                      onChange={(e) => updateField('personal', 'identification_marks', e.target.value)}
                      rows={2}
                      maxLength={200}
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
                    { label: 'Qualifying Exam', field: 'qualifying_exam', maxLength: 50 },
                    { label: 'Medium of Instruction', field: 'medium_of_instruction', maxLength: 30 },
                    { label: 'State/National Rank', field: 'ranks', maxLength: 20 },
                    { label: 'SSC Score (%)', field: 'ssc_marks', maxLength: 5 },
                    { label: 'Inter/Diploma Score (%)', field: 'inter_marks', maxLength: 5 }
                  ].map((item) => (
                    <div key={item.field} className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</label>
                      <input 
                        value={formData.academic[item.field] || ''}
                        onChange={(e) => updateField('academic', item.field, e.target.value)}
                        maxLength={item.maxLength}
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
                      <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={proofDataUrl} alt="Proof" width={320} height={180} unoptimized className="object-contain w-full h-full p-1" />
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
                    {needsProof && !proofDataUrl && (
                      <div className="px-4 py-2 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-widest leading-none">
                        Error: Substantiating evidence is required for data modifications.
                      </div>
                    )}
                    {!needsProof && changedData && (
                      <div className="px-4 py-2 bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-widest leading-none">
                        Note: Document proof is not required for email or mobile updates.
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
                  className="w-full md:w-auto px-4 sm:px-8 py-3 bg-slate-100 text-slate-600 font-bold uppercase tracking-widest hover:bg-slate-200 transition-all text-[10px]"
                >
                  Dismiss Changes
                </button>
                <button 
                  disabled={saving || (!changedData && !pfpDataUrl && !signatureDataUrl)} 
                  onClick={onSave}
                  className="w-full md:w-auto px-4 sm:px-10 py-3 bg-[#0b3578] text-white font-bold uppercase tracking-widest hover:bg-blue-900 disabled:opacity-30 disabled:grayscale transition-all text-[10px] shadow-md"
                >
                  {saving ? 'Processing Application...' : 'Authenticate & Submit Modification Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#0b3578] p-4 text-white">
              <h3 className="text-xs font-black uppercase tracking-widest">Institutional Email Verification</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-4">
                <p className="text-[10px] text-blue-800 leading-relaxed font-bold uppercase tracking-wide">
                  A 6-digit verification code has been dispatched to:
                </p>
                <p className="text-sm font-black text-[#0b3578] mt-1 break-all">{otpEmail}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enter One-Time Password (OTP)</label>
                <input 
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 border-slate-200 px-4 py-4 text-2xl font-black text-center tracking-[1em] outline-none focus:border-[#0b3578] transition-colors"
                  placeholder="000000"
                />
              </div>
              <p className="text-[10px] text-slate-500 italic">Please check your inbox (and spam folder) for the code. Valid for 10 minutes.</p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={otp.length !== 6 || verifying}
                  onClick={verifyOtp}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                >
                  {verifying ? 'Validating...' : 'Verify & Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
