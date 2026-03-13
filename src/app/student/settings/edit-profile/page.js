'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';

export default function EditProfilePage() {
  const router = useRouter();
  const { studentData, setStudentData, loading: contextLoading, refreshData } = useStudent();
  const student = studentData?.student;

  const [formData, setFormData] = useState({
    student: {},
    personal: {},
    academic: {}
  });
  const [originalData, setOriginalData] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [sigLoading, setSigLoading] = useState(true);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);
  
  // Profile/Signature/Proof States
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
    
    // Check student table changes
    ['mobile', 'email'].forEach(field => {
        if (formData.student[field] !== originalData.student[field]) {
            changes[field] = formData.student[field];
        }
    });

    // Check personal details changes
    const spd_fields = ['father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','guardian_mobile','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks','blood_group'];
    spd_fields.forEach(field => {
        if (formData.personal[field] !== originalData.personal[field]) {
            changes[field] = formData.personal[field];
        }
    });

    // Check academic background changes
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
        toast.error('You already have a pending request.');
        return;
    }

    const changedData = getChangedData();
    if (!changedData && !pfpDataUrl && !signatureDataUrl) {
        toast.error('No changes detected.');
        return;
    }

    if (changedData && !proofDataUrl) {
        toast.error('Verification proof image is required for profile updates.');
        return;
    }

    setSaving(true);
    setMessage(null);
    const toastId = toast.loading('Submitting request...');

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
        if (!res.ok) throw new Error(resData.error || 'Update request failed');
        
        setPfpDataUrl(null);
        setSignatureDataUrl(null);
        setProofDataUrl(null);
        toast.success('Update request submitted for clerk approval.', { id: toastId });
        await fetchProfileData();
    } catch (e) {
      toast.error(e.message || 'Something went wrong.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const onFileSelect = (file, type) => {
    if (latestRequest && latestRequest.status === 'pending') {
      toast.error('Pending request exists. Please wait.');
      return;
    }

    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files allowed.');
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File size must be less than 1MB.');
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

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
        ...prev,
        [section]: {
            ...prev[section],
            [field]: value
        }
    }));
  };

  if (!studentData && contextLoading) return <div className="p-10 text-center">Loading student context...</div>;

  const changedData = getChangedData();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role={'student'} activeTab={'menu'} onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); location.href = '/'; }} />

      <main className="flex-1 px-4 py-8 max-w-7xl mx-auto w-full">
        <div className="bg-white shadow-2xl rounded-2xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-[#0b3578] px-8 py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">STUDENT PROFILE CONTROL</h1>
              <p className="text-blue-100 font-medium opacity-80 uppercase tracking-widest text-xs mt-1">Review and request updates to your records</p>
            </div>
            {latestRequest && (
                <div className={`px-5 py-2 rounded-full text-xs font-black border-2 flex items-center gap-2 ${
                    latestRequest.status === 'pending' ? 'bg-blue-600/30 text-white border-blue-400 animate-pulse' : 
                    latestRequest.status === 'rejected' ? 'bg-red-600/30 text-white border-red-400' : 'hidden'
                }`}>
                    <span className="text-base">{latestRequest.status === 'pending' ? '⏳' : '❌'}</span>
                    {latestRequest.status === 'pending' ? 'UPDATE REQUEST PENDING REVIEW' : 'LAST REQUEST REJECTED'}
                </div>
            )}
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
            {/* Left Sidebar: Photo, Sig, and Proof */}
            <div className="space-y-10">
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className={`w-48 h-48 rounded-2xl border-4 ${pfpDataUrl ? 'border-indigo-500' : 'border-gray-200'} overflow-hidden bg-gray-50 shadow-inner flex items-center justify-center relative`}>
                    {displayedPhoto ? (
                      <Image src={displayedPhoto} alt="Profile" width={192} height={192} unoptimized className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-gray-300 font-bold uppercase text-[10px] text-center px-4">No Photo Uploaded</span>
                    )}
                    {pfpDataUrl && <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase">NEW</div>}
                  </div>
                  <button 
                    ref={editBtnRef}
                    onClick={() => setPhotoMenuOpen(!photoMenuOpen)}
                    className="absolute -bottom-3 -right-3 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90 z-20 border-4 border-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                  {photoMenuOpen && (
                    <div ref={menuRef} className="absolute left-1/2 -translate-x-1/2 top-full mt-4 bg-white shadow-2xl border rounded-xl w-48 z-30 overflow-hidden py-1">
                        <button onClick={() => fileInputRef.current.click()} className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-bold flex items-center gap-3">
                           <span>📂</span> Upload Photo
                        </button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'pfp')} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Digital Signature</label>
                <div className={`w-full h-24 rounded-xl border-2 ${signatureDataUrl ? 'border-indigo-500 border-solid bg-indigo-50/30' : 'border-dashed border-gray-200 bg-gray-50'} flex items-center justify-center relative group transition-all overflow-hidden`}>
                   {displayedSignature ? (
                     <Image src={displayedSignature} alt="Signature" width={250} height={100} unoptimized className="object-contain w-full h-full p-2" />
                   ) : <span className="text-[10px] font-bold text-gray-400 uppercase">Not Uploaded</span>}
                   <button onClick={() => signatureInputRef.current.click()} className="absolute inset-0 bg-indigo-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black uppercase tracking-wider">Update Signature</button>
                   {signatureDataUrl && <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">NEW</div>}
                </div>
                <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'sig')} />
              </div>

              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm space-y-4">
                <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest block">Verification Proof</label>
                <p className="text-[10px] text-amber-800 font-medium leading-relaxed italic">Upload Aadhaar card or relevant documents to verify your update requests.</p>
                <div className={`w-full aspect-video rounded-xl border-2 ${proofDataUrl ? 'border-amber-500 border-solid bg-white' : 'border-dashed border-amber-200 bg-amber-100/30'} flex items-center justify-center relative group transition-all overflow-hidden`}>
                   {proofDataUrl ? (
                     <Image src={proofDataUrl} alt="Proof" width={250} height={150} unoptimized className="object-contain w-full h-full" />
                   ) : <span className="text-[10px] font-bold text-amber-400 uppercase">Drop Proof Image</span>}
                   <button onClick={() => proofInputRef.current.click()} className="absolute inset-0 bg-amber-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black uppercase tracking-wider">Select Proof</button>
                   {proofDataUrl && <div className="absolute top-1 right-1 bg-amber-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">NEW</div>}
                </div>
                <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'proof')} />
                {changedData && !proofDataUrl && (
                    <div className="text-[9px] font-black text-red-600 animate-bounce uppercase">⚠️ Proof is mandatory for data updates</div>
                )}
              </div>

              {latestRequest && latestRequest.status === 'rejected' && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-xl space-y-2">
                    <h3 className="text-[10px] font-black text-red-700 uppercase tracking-wider">❌ Rejection Reason</h3>
                    <p className="text-[11px] text-red-800 font-medium italic">&quot;{latestRequest.rejection_reason}&quot;</p>
                </div>
              )}
            </div>

            {/* Main Form Content */}
            <div className="space-y-12">
              {/* Section 1: Student Details */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Student Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Roll Number</label>
                    <input value={formData.student.roll_no || ''} disabled className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                    <input value={formData.student.name || ''} disabled className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mobile Number</label>
                    <input 
                        value={formData.student.mobile || ''} 
                        onChange={(e) => handleInputChange('student', 'mobile', e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${formData.student.mobile !== originalData?.student.mobile ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                    <input 
                        value={formData.student.email || ''} 
                        onChange={(e) => handleInputChange('student', 'email', e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${formData.student.email !== originalData?.student.email ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Personal Details */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Personal Details</h2>
                </div>
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
                        { label: 'Aadhaar No', field: 'aadhaar_no' },
                        { label: 'Seat Category', field: 'seat_allotted_category' },
                        { label: 'Blood Group', field: 'blood_group', type: 'select', options: COLLEGE_CONFIG.bloodGroups }
                    ].map((item) => (
                        <div key={item.field} className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{item.label}</label>
                            {item.type === 'select' ? (
                                <select 
                                    value={formData.personal[item.field] || ''}
                                    onChange={(e) => handleInputChange('personal', item.field, e.target.value)}
                                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.personal[item.field] !== originalData?.personal[item.field] ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                                >
                                    <option value="">Select {item.label}</option>
                                    {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            ) : (
                                <input 
                                    value={formData.personal[item.field] || ''}
                                    onChange={(e) => handleInputChange('personal', item.field, e.target.value)}
                                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.personal[item.field] !== originalData?.personal[item.field] ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                                />
                            )}
                        </div>
                    ))}
                    <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mailing Address</label>
                        <textarea 
                            value={formData.personal.address || ''}
                            onChange={(e) => handleInputChange('personal', 'address', e.target.value)}
                            rows={3}
                            className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.personal.address !== originalData?.personal.address ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Identification Marks</label>
                        <textarea 
                            value={formData.personal.identification_marks || ''}
                            onChange={(e) => handleInputChange('personal', 'identification_marks', e.target.value)}
                            rows={2}
                            className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.personal.identification_marks !== originalData?.personal.identification_marks ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                        />
                    </div>
                </div>
              </section>

              {/* Section 3: Academic Background */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Academic Background</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Qualifying Exam', field: 'qualifying_exam' },
                        { label: 'Medium', field: 'medium_of_instruction' },
                        { label: 'Entrance Rank', field: 'ranks' },
                        { label: 'SSC Marks', field: 'ssc_marks' },
                        { label: 'Inter/Diploma Marks', field: 'inter_marks' }
                    ].map((item) => (
                        <div key={item.field} className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{item.label}</label>
                            <input 
                                value={formData.academic[item.field] || ''}
                                onChange={(e) => handleInputChange('academic', item.field, e.target.value)}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.academic[item.field] !== originalData?.academic[item.field] ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                            />
                        </div>
                    ))}
                    <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Previous College Details</label>
                        <textarea 
                            value={formData.academic.previous_college_details || ''}
                            onChange={(e) => handleInputChange('academic', 'previous_college_details', e.target.value)}
                            rows={2}
                            className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${formData.academic.previous_college_details !== originalData?.academic.previous_college_details ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
                        />
                    </div>
                </div>
              </section>

              {/* Action Buttons */}
              <div className="pt-10 flex flex-col-reverse md:flex-row items-center justify-end gap-6 border-t border-gray-100">
                  <button 
                    onClick={() => router.back()} 
                    className="w-full md:w-auto px-10 py-4 rounded-2xl bg-gray-100 text-gray-600 font-black uppercase tracking-widest hover:bg-gray-200 transition-all text-xs"
                  >
                    Go Back
                  </button>
                  <button 
                    disabled={saving || (!changedData && !pfpDataUrl && !signatureDataUrl)} 
                    onClick={onSave}
                    className="w-full md:w-auto px-12 py-4 rounded-2xl bg-[#0b3578] text-white font-black uppercase tracking-widest hover:bg-indigo-900 shadow-xl disabled:opacity-30 disabled:grayscale transition-all text-xs"
                  >
                    {saving ? 'Processing Request...' : 'Submit Request for Approval'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
